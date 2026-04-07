import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCompanyContext } from '../_shared/ai-helper.ts'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();
    if (!profile?.tenant_id) throw new Error("Tenant not found");

    const tenantId = profile.tenant_id;
    const { cargo_ids, empresa_nome } = await req.json();

    const companyContext = await getCompanyContext(supabase, tenantId);

    const { data: tenant } = await supabase
      .from("tenants")
      .select("nome")
      .eq("id", tenantId)
      .single();

    const nomeEmpresa = empresa_nome || tenant?.nome || "Nossa Empresa";

    // Fetch cargos
    let cargosQuery = supabase
      .from("cargos")
      .select("id, nome, nivel, descricao, responsabilidade")
      .eq("tenant_id", tenantId)
      .eq("ativo", true)
      .order("nome");

    if (cargo_ids && cargo_ids.length > 0) {
      cargosQuery = cargosQuery.in("id", cargo_ids);
    }

    const { data: cargos } = await cargosQuery;
    if (!cargos || cargos.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhuma função encontrada." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cargoIds = cargos.map((c: any) => c.id);

    // Fetch related data (WITHOUT POPs and conteúdos - manual focuses on structure only)
    const [atividadesRes, competenciasRes, episRes, responsabilidadesRes, indicadoresRes] = await Promise.all([
      supabase.from("funcao_atividades").select("*").eq("tenant_id", tenantId).in("cargo_id", cargoIds),
      supabase.from("funcao_competencias").select("*").eq("tenant_id", tenantId).in("cargo_id", cargoIds),
      supabase.from("funcao_epi_vinculacoes").select("*").eq("tenant_id", tenantId).in("cargo_id", cargoIds),
      supabase.from("funcao_responsabilidades").select("*").eq("tenant_id", tenantId),
      supabase.from("funcao_indicadores").select("*").eq("tenant_id", tenantId).in("cargo_id", cargoIds),
    ]);

    const atividades = atividadesRes.data || [];
    const competencias = competenciasRes.data || [];
    const epis = episRes.data || [];
    const responsabilidades = responsabilidadesRes.data || [];
    const indicadores = indicadoresRes.data || [];

    // Build per-cargo sections
    const cargoSections = cargos.map((cargo: any) => {
      const cargoAtividades = atividades.filter((a: any) => a.cargo_id === cargo.id);
      const cargoCompetencias = competencias.filter((c: any) => c.cargo_id === cargo.id);
      const cargoEpis = epis.filter((e: any) => e.cargo_id === cargo.id);
      const cargoIndicadores = indicadores.filter((i: any) => i.cargo_id === cargo.id);

      const atividadeIds = cargoAtividades.map((a: any) => a.id);
      const cargoResponsabilidades = responsabilidades.filter((r: any) => atividadeIds.includes(r.atividade_id));

      // Atividades resumidas (SEM passo a passo, SEM POPs)
      const atividadesText = cargoAtividades.map((a: any) => {
        const resp = cargoResponsabilidades.find((r: any) => r.atividade_id === a.id);

        let text = `  - ${a.nome} (Frequência: ${a.frequencia}, Complexidade: ${a.complexidade}, Classificação: ${a.classificacao})`;
        if (a.descricao) text += `\n    Descrição: ${a.descricao}`;
        if (resp?.responsavel_direto) text += `\n    Responsável Direto: ${resp.responsavel_direto}`;
        if (resp?.interfaces) text += `\n    Interfaces: ${resp.interfaces}`;

        return text;
      }).join("\n\n") || "  (nenhuma atividade cadastrada)";

      // Competências organizadas por tipo
      const compTecnicas = cargoCompetencias.filter((c: any) => c.tipo === "tecnica");
      const compComportamentais = cargoCompetencias.filter((c: any) => c.tipo === "comportamental");
      const compCognitivas = cargoCompetencias.filter((c: any) => c.tipo === "cognitiva");

      const formatComp = (list: any[]) => list.map((c: any) =>
        `    - ${c.nome}${c.descricao ? `: ${c.descricao}` : ""}`
      ).join("\n") || "    (nenhuma)";

      const competenciasText = `  Técnicas (${compTecnicas.length}):\n${formatComp(compTecnicas)}\n  Comportamentais (${compComportamentais.length}):\n${formatComp(compComportamentais)}\n  Cognitivas (${compCognitivas.length}):\n${formatComp(compCognitivas)}`;

      const episText = cargoEpis.map((e: any) =>
        `  - ${e.epi_tipo_nome || "EPI"} (${e.obrigatoriedade})${e.epi_tipo_categoria ? ` — Categoria: ${e.epi_tipo_categoria}` : ""}`
      ).join("\n") || "  (nenhum EPI vinculado)";

      // Indicadores
      const indicadoresText = cargoIndicadores.length > 0
        ? cargoIndicadores.map((i: any) =>
          `  - ${i.nome}${i.meta ? ` | Meta: ${i.meta}` : ""}${i.periodicidade ? ` | Periodicidade: ${i.periodicidade}` : ""}${i.descricao ? ` — ${i.descricao}` : ""}`
        ).join("\n")
        : "  (nenhum indicador definido)";

      // Interfaces consolidadas
      const interfacesSet = new Set<string>();
      cargoResponsabilidades.forEach((r: any) => {
        if (r.interfaces) {
          r.interfaces.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean).forEach((s: string) => interfacesSet.add(s));
        }
      });
      const interfacesText = interfacesSet.size > 0
        ? Array.from(interfacesSet).map(i => `  - ${i}`).join("\n")
        : "  (nenhuma interface definida)";

      return `
══════════════════════════════════════════════════════
FUNÇÃO: ${cargo.nome}${cargo.nivel ? ` (Nível: ${cargo.nivel})` : ""}
══════════════════════════════════════════════════════
${cargo.descricao ? `Descrição: ${cargo.descricao}` : ""}
${cargo.responsabilidade ? `\nRESPONSABILIDADE & ESCOPO:\n${cargo.responsabilidade}` : ""}

ATIVIDADES (${cargoAtividades.length}):
${atividadesText}

COMPETÊNCIAS (${cargoCompetencias.length}):
${competenciasText}

INDICADORES DE DESEMPENHO (${cargoIndicadores.length}):
${indicadoresText}

INTERFACES (${interfacesSet.size}):
${interfacesText}

EPIs (${cargoEpis.length}):
${episText}`;
    }).join("\n\n");

    const isGlobal = !cargo_ids || cargo_ids.length === 0 || cargo_ids.length > 1;
    const tituloManual = isGlobal
      ? `Manual de Funções — ${nomeEmpresa}`
      : `Manual da Função: ${cargos[0].nome} — ${nomeEmpresa}`;

    const prompt = `Você é um consultor sênior de RH e Gestão de Pessoas. Com base nos dados abaixo, gere um MANUAL DE FUNÇÕES conciso, profissional e visualmente rico em HTML.

${companyContext}

TÍTULO: ${tituloManual}
EMPRESA: ${nomeEmpresa}
TOTAL DE FUNÇÕES: ${cargos.length}

${cargoSections}

INSTRUÇÕES OBRIGATÓRIAS:

1. O manual DEVE conter APENAS:
   - Capa com título "${tituloManual}" e data de geração
   - Sumário com links para cada função
   - Para CADA função, uma seção com:
     * Nome e nível do cargo em header destacado
     * Descrição do cargo (expanda brevemente se necessário)
     * Responsabilidade & Escopo (se houver), em caixa visual destacada
     * Tabela de Atividades RESUMIDA com colunas: Nome, Frequência, Complexidade, Classificação, Responsável
     * Cards de Competências organizados por tipo (Técnica, Comportamental, Cognitiva) com ícones
     * Indicadores de Desempenho em tabela ou cards
     * Interfaces (áreas/cargos com os quais interage)
     * EPIs obrigatórios/recomendados
   ${isGlobal ? "- Quadro comparativo consolidado no final (resumo de todas as funções)" : ""}
   - Rodapé com data de geração e nome da empresa

2. NÃO INCLUIR:
   - POPs (Procedimentos Operacionais Padrão)
   - Passos detalhados ou etapas de execução
   - Materiais de treinamento ou links de conteúdo
   - Checklists de procedimento
   - O manual deve ser CONCISO e OBJETIVO

3. FORMATAÇÃO HTML:
   - CSS inline em cada elemento
   - Paleta: primário #1e3a5f, secundário #2d8a6e, accent #f4a261, fundo #f8f9fa, texto #1a1a2e
   - Fonte: font-family: 'Segoe UI', 'Inter', system-ui, sans-serif
   - Cards com border-radius: 12px, box-shadow, padding 24px+
   - Tabelas estilizadas com cabeçalho colorido e linhas zebradas
   - Badges coloridos para frequência, complexidade e tipo de competência
   - Ícones emoji relevantes (🎯 🧠 🛡️ ⚙️ 👤 📊)
   - Divisores visuais entre funções
   - Tamanho mínimo: 15px corpo, 28px títulos, 42px capa
   - @media print para impressão

4. HTML SELF-CONTAINED, sem referências externas, começando com <!DOCTYPE html>.
5. Aspecto de manual corporativo premium e conciso.

Retorne APENAS o HTML completo sem explicações, markdown ou code blocks.`;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um designer e consultor de RH. Gere apenas HTML completo e profissional para manuais de funções. O manual deve ser CONCISO — sem POPs, sem passos detalhados, sem materiais de treinamento. Nunca inclua markdown, code blocks ou explicações — apenas o HTML puro." },
          { role: "user", content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      throw new Error(`AI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    let html = data.choices?.[0]?.message?.content?.trim() || "";

    // Sanitize markdown fences
    if (html.startsWith("```")) {
      html = html.replace(/^```(?:html)?\s*\n?/, "").replace(/\n?\s*```\s*$/, "");
    }

    if (html && !html.toLowerCase().includes("<!doctype")) {
      html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{margin:0;padding:20px;font-family:'Segoe UI','Inter',system-ui,sans-serif;}</style></head><body>${html}</body></html>`;
    }

    if (html && !html.toLowerCase().includes("viewport")) {
      html = html.replace(/<head>/i, '<head><meta name="viewport" content="width=device-width, initial-scale=1.0">');
    }

    return new Response(JSON.stringify({ html }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
