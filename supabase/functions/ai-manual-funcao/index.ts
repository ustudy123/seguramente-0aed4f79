import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCompanyContext } from '../_shared/ai-helper.ts';

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
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

    const token = authHeader.replace("Bearer ", "");
    let userId: string;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (!payload.sub || (payload.exp && payload.exp * 1000 < Date.now())) {
        throw new Error("Invalid token");
      }
      userId = payload.sub;
    } catch {
      throw new Error("Unauthorized");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", userId)
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

    // Fetch cargos with new fields
    let cargosQuery = supabase
      .from("cargos")
      .select("id, nome, nivel, descricao, responsabilidade, subordinacao, interfaces_cargo, objetivo_funcao, escopo_geral, padroes_execucao, cultura_esperada, erros_riscos, criterios_sucesso, ferramentas_cargo")
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

    const [atividadesRes, competenciasRes, episRes, responsabilidadesRes, indicadoresRes, ferramentasRes] = await Promise.all([
      supabase.from("funcao_atividades").select("*").eq("tenant_id", tenantId).in("cargo_id", cargoIds),
      supabase.from("funcao_competencias").select("*").eq("tenant_id", tenantId).in("cargo_id", cargoIds),
      supabase.from("funcao_epi_vinculacoes").select("*").eq("tenant_id", tenantId).in("cargo_id", cargoIds),
      supabase.from("funcao_responsabilidades").select("*").eq("tenant_id", tenantId),
      supabase.from("funcao_indicadores").select("*").eq("tenant_id", tenantId).in("cargo_id", cargoIds),
      supabase.from("funcao_ferramentas").select("*").eq("tenant_id", tenantId),
    ]);

    const atividades = atividadesRes.data || [];
    const competencias = competenciasRes.data || [];
    const epis = episRes.data || [];
    const responsabilidades = responsabilidadesRes.data || [];
    const indicadores = indicadoresRes.data || [];
    const ferramentas = ferramentasRes.data || [];

    // Build per-cargo sections with 13-section model
    const cargoSections = cargos.map((cargo: any) => {
      const cargoAtividades = atividades.filter((a: any) => a.cargo_id === cargo.id);
      const cargoCompetencias = competencias.filter((c: any) => c.cargo_id === cargo.id);
      const cargoEpis = epis.filter((e: any) => e.cargo_id === cargo.id);
      const cargoIndicadores = indicadores.filter((i: any) => i.cargo_id === cargo.id);

      const atividadeIds = cargoAtividades.map((a: any) => a.id);
      const cargoResponsabilidades = responsabilidades.filter((r: any) => atividadeIds.includes(r.atividade_id));
      const cargoFerramentas = ferramentas.filter((f: any) => atividadeIds.includes(f.atividade_id));

      // Group activities by process
      const processos = new Map<string, any[]>();
      cargoAtividades.forEach((a: any) => {
        const proc = a.processo || "Geral";
        if (!processos.has(proc)) processos.set(proc, []);
        processos.get(proc)!.push(a);
      });

      const atividadesText = Array.from(processos.entries()).map(([proc, atvs]) => {
        const items = atvs.map((a: any) => {
          const resp = cargoResponsabilidades.find((r: any) => r.atividade_id === a.id);
          let text = `    - ${a.nome} (Freq: ${a.frequencia}, Compl: ${a.complexidade}, Class: ${a.classificacao})`;
          if (a.descricao) text += `\n      O que: ${a.descricao}`;
          if (a.como) text += `\n      Como: ${a.como}`;
          if (a.resultado_esperado) text += `\n      Resultado: ${a.resultado_esperado}`;
          if (resp?.responsavel_direto) text += `\n      Responsável: ${resp.responsavel_direto}`;
          if (resp?.interfaces) text += `\n      Interfaces: ${resp.interfaces}`;
          if (resp?.consequencia_erro) text += `\n      Consequência de erro: ${resp.consequencia_erro}`;
          return text;
        }).join("\n\n");
        return `  🔹 Processo: ${proc}\n${items}`;
      }).join("\n\n") || "  (nenhuma atividade cadastrada)";

      // Routine grouped by frequency
      const rotina: Record<string, string[]> = { diaria: [], semanal: [], mensal: [], eventual: [] };
      cargoAtividades.forEach((a: any) => {
        if (rotina[a.frequencia]) rotina[a.frequencia].push(a.nome);
      });
      const rotinaText = Object.entries(rotina)
        .filter(([, items]) => items.length > 0)
        .map(([freq, items]) => `  ${freq.charAt(0).toUpperCase() + freq.slice(1)}:\n${items.map(i => `    - ${i}`).join("\n")}`)
        .join("\n") || "  (sem rotina definida)";

      // Competências by type
      const compTecnicas = cargoCompetencias.filter((c: any) => c.tipo === "tecnica");
      const compComportamentais = cargoCompetencias.filter((c: any) => c.tipo === "comportamental");
      const compCognitivas = cargoCompetencias.filter((c: any) => c.tipo === "cognitiva");
      const formatComp = (list: any[]) => list.map((c: any) =>
        `    - ${c.nome}${c.descricao ? `: ${c.descricao}` : ""}`
      ).join("\n") || "    (nenhuma)";

      const competenciasText = `  Técnicas (${compTecnicas.length}):\n${formatComp(compTecnicas)}\n  Comportamentais (${compComportamentais.length}):\n${formatComp(compComportamentais)}\n  Cognitivas (${compCognitivas.length}):\n${formatComp(compCognitivas)}`;

      const episText = cargoEpis.map((e: any) =>
        `  - ${e.epi_tipo_nome || "EPI"} (${e.obrigatoriedade})${e.epi_tipo_categoria ? ` — Cat: ${e.epi_tipo_categoria}` : ""}`
      ).join("\n") || "  (nenhum EPI vinculado)";

      const indicadoresText = cargoIndicadores.length > 0
        ? cargoIndicadores.map((i: any) =>
          `  - ${i.nome}${i.meta ? ` | Meta: ${i.meta}` : ""}${i.periodicidade ? ` | Per: ${i.periodicidade}` : ""}${i.descricao ? ` — ${i.descricao}` : ""}`
        ).join("\n")
        : "  (nenhum indicador definido)";

      // Interfaces consolidadas
      const interfacesSet = new Set<string>();
      cargoResponsabilidades.forEach((r: any) => {
        if (r.interfaces) r.interfaces.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean).forEach((s: string) => interfacesSet.add(s));
      });
      if (cargo.interfaces_cargo) {
        cargo.interfaces_cargo.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean).forEach((s: string) => interfacesSet.add(s));
      }

      // Ferramentas consolidadas
      const ferramentasSet = new Set<string>();
      cargoFerramentas.forEach((f: any) => ferramentasSet.add(`${f.nome} (${f.tipo})`));
      if (cargo.ferramentas_cargo) {
        cargo.ferramentas_cargo.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean).forEach((s: string) => ferramentasSet.add(s));
      }

      return `
══════════════════════════════════════════════════════
1. IDENTIFICAÇÃO DO CARGO
══════════════════════════════════════════════════════
Nome: ${cargo.nome}${cargo.nivel ? ` | Nível: ${cargo.nivel}` : ""}
${cargo.subordinacao ? `Subordinação: ${cargo.subordinacao}` : ""}
${cargo.interfaces_cargo ? `Interfaces: ${cargo.interfaces_cargo}` : ""}
${cargo.descricao ? `Descrição: ${cargo.descricao}` : ""}

2. OBJETIVO DA FUNÇÃO:
${cargo.objetivo_funcao || "(a ser gerado pela IA com base nos dados)"}

3. ESCOPO GERAL:
${cargo.escopo_geral || "(a ser gerado pela IA)"}

4. RESPONSABILIDADES DETALHADAS (por processo):
${cargo.responsabilidade ? `ESCOPO & RESPONSABILIDADE:\n${cargo.responsabilidade}\n` : ""}
${atividadesText}

5. ROTINA ESTRUTURADA:
${rotinaText}

6. PADRÕES DE EXECUÇÃO:
${cargo.padroes_execucao || "(a ser definido pela IA)"}

7. COMPETÊNCIAS (${cargoCompetencias.length}):
${competenciasText}

8. INDICADORES (KPIs) (${cargoIndicadores.length}):
${indicadoresText}

9. ERROS E RISCOS:
${cargo.erros_riscos || "(a ser identificado pela IA)"}

10. INTERFACES E FLUXOS (${interfacesSet.size}):
${interfacesSet.size > 0 ? Array.from(interfacesSet).map(i => `  - ${i}`).join("\n") : "  (nenhuma interface definida)"}

11. FERRAMENTAS (${ferramentasSet.size}):
${ferramentasSet.size > 0 ? Array.from(ferramentasSet).map(f => `  - ${f}`).join("\n") : "  (nenhuma ferramenta definida)"}

12. CRITÉRIOS DE SUCESSO:
${cargo.criterios_sucesso || "(a ser definido pela IA)"}

13. CULTURA ESPERADA:
${cargo.cultura_esperada || "(a ser definido pela IA)"}

EPIs (${cargoEpis.length}):
${episText}`;
    }).join("\n\n");

    const isGlobal = !cargo_ids || cargo_ids.length === 0 || cargo_ids.length > 1;
    const tituloManual = isGlobal
      ? `Manual de Funções — ${nomeEmpresa}`
      : `Manual da Função: ${cargos[0].nome} — ${nomeEmpresa}`;

    const prompt = `Você é um consultor sênior de RH e Gestão de Pessoas. Com base nos dados abaixo, gere um MANUAL DE FUNÇÕES profissional e visualmente rico em HTML seguindo o modelo de 13 seções.

${companyContext}

TÍTULO: ${tituloManual}
EMPRESA: ${nomeEmpresa}
TOTAL DE FUNÇÕES: ${cargos.length}

${cargoSections}

INSTRUÇÕES OBRIGATÓRIAS:

1. O manual DEVE seguir o MODELO DE 13 SEÇÕES para cada função:
   - Capa com título "${tituloManual}" e data de geração
   - Sumário com links
   - Para CADA função:
     1. Identificação (Nome, Área, Subordinação, Interfaces)
     2. Objetivo da Função
     3. Escopo Geral
     4. Responsabilidades Detalhadas (agrupadas por processo, com O que/Como/Frequência/Resultado)
     5. Rotina Estruturada (Diário/Semanal/Mensal)
     6. Padrões de Execução
     7. Competências (Técnicas/Comportamentais/Cognitivas em cards)
     8. KPIs (tabela com nome, meta, periodicidade)
     9. Erros e Riscos (com consequências)
     10. Interfaces e Fluxos (Recebe/Entrega/Depende de)
     11. Ferramentas
     12. Critérios de Sucesso
     13. Cultura Esperada
   ${isGlobal ? "- Quadro comparativo consolidado no final" : ""}
   - Rodapé com data e empresa

2. Se alguma seção estiver marcada como "(a ser gerado pela IA)" ou "(a ser definido pela IA)", COMPLETE COM CONTEÚDO RELEVANTE baseado no cargo e contexto.

3. NÃO INCLUIR:
   - POPs (Procedimentos Operacionais Padrão)
   - Passos detalhados de execução
   - Materiais de treinamento

4. FORMATAÇÃO HTML:
   - CSS inline em cada elemento
   - Paleta: primário #1e3a5f, secundário #2d8a6e, accent #f4a261, fundo #f8f9fa, texto #1a1a2e
   - Fonte: 'Segoe UI', 'Inter', system-ui, sans-serif
   - Cards com border-radius: 12px, box-shadow, padding 24px+
   - Tabelas estilizadas com cabeçalho colorido e zebra
   - Badges coloridos para frequência, complexidade, tipo
   - Ícones emoji: 🎯 🧠 🛡️ ⚙️ 👤 📊 📋 ⚠️ ✅ 🔧 🏢
   - Divisores visuais entre seções
   - Numeração de seções (1-13)
   - Tamanho: 15px corpo, 28px títulos, 42px capa
   - @media print

5. HTML SELF-CONTAINED, sem referências externas, começando com <!DOCTYPE html>.
6. Aspecto de manual corporativo premium.

Retorne APENAS o HTML completo sem explicações, markdown ou code blocks.`;

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Você é um designer e consultor de RH. Gere apenas HTML completo e profissional para manuais de funções seguindo o modelo de 13 seções. Complete seções marcadas como 'a ser gerado/definido pela IA' com conteúdo relevante. Sem POPs, sem passos detalhados. Nunca inclua markdown, code blocks ou explicações — apenas o HTML puro." },
          { role: "user", content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes no workspace OpenAI. Adicione créditos em Settings → Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      throw new Error(`AI Gateway error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    let html = data.choices?.[0]?.message?.content?.trim() || "";

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
