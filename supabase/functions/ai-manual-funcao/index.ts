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

4. FORMATAÇÃO — LEIA COM ATENÇÃO:
   O design NÃO é sua responsabilidade. Uma folha de estilo profissional
   será aplicada automaticamente sobre o seu HTML.

   PROIBIDO:
   - <!DOCTYPE>, <html>, <head>, <body> — retorne apenas o conteúdo
   - qualquer <style>, <link> ou atributo style="..."
   - escolher fontes, cores, tamanhos, sombras ou espaçamentos
   - emojis como ícone de seção

   OBRIGATÓRIO — use exatamente esta estrutura semântica:

   <header class="capa">
     <h1>${tituloManual}</h1>
     <p class="capa-empresa">${nomeEmpresa}</p>
   </header>

   <nav class="sumario">
     <h2>Sumário</h2>
     <ol><li><a href="#f1-s1">Identificação do Cargo</a></li>...</ol>
   </nav>

   <article class="funcao">
     <h2 class="funcao-titulo">Nome da Função</h2>

     <section id="f1-s1" class="secao">
       <h3><span class="num">1</span>Identificação do Cargo</h3>
       <dl class="campos">
         <dt>Nome</dt><dd>...</dd>
         <dt>Área</dt><dd>...</dd>
       </dl>
     </section>

     <section id="f1-s4" class="secao">
       <h3><span class="num">4</span>Responsabilidades Detalhadas</h3>
       <div class="grupo">
         <h4>Nome do processo</h4>
         <table class="tabela">
           <thead><tr><th>O que</th><th>Como</th><th>Frequência</th><th>Resultado</th></tr></thead>
           <tbody><tr><td>...</td><td>...</td><td><span class="badge">Diário</span></td><td>...</td></tr></tbody>
         </table>
       </div>
     </section>

     <section id="f1-s7" class="secao">
       <h3><span class="num">7</span>Competências</h3>
       <div class="cards">
         <div class="card"><h4>Técnicas</h4><ul><li>...</li></ul></div>
         <div class="card"><h4>Comportamentais</h4><ul><li>...</li></ul></div>
         <div class="card"><h4>Cognitivas</h4><ul><li>...</li></ul></div>
       </div>
     </section>
   </article>

   Regras de conteúdo:
   - Use <table class="tabela"> para KPIs, responsabilidades e rotina.
   - Use <div class="cards"> + <div class="card"> para competências.
   - Use <span class="badge"> para frequência/complexidade/tipo.
   - Use <p class="vazio"> quando não houver conteúdo — mas SÓ se realmente
     não houver dado. Prefira gerar conteúdo relevante ao cargo.
   - Numere as seções de 1 a 13 dentro de <span class="num">.
   - ids no padrão f{N}-s{M} (função N, seção M), casando com o sumário.

5. NÃO inclua data de geração nem rodapé — são inseridos automaticamente.

6. Retorne APENAS o HTML do conteúdo, sem markdown e sem code blocks.`;

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
        max_tokens: 8000,
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

    // ── Normalização: o design é nosso, não da IA ──────────────────
    // Mesmo instruída, a IA às vezes devolve documento completo e estilos
    // próprios. Aqui isso é removido, para o manual sair idêntico toda vez.
    if (/<body[\s>]/i.test(html)) {
      html = html.replace(/[\s\S]*<body[^>]*>/i, "").replace(/<\/body>[\s\S]*/i, "");
    }
    html = html
      .replace(/<!DOCTYPE[^>]*>/gi, "")
      .replace(/<\/?(?:html|head|body)[^>]*>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<link[^>]*>/gi, "")
      .replace(/\sstyle="[^"]*"/gi, "")
      .replace(/\sstyle='[^']*'/gi, "")
      .trim();

    // Data real de geração — antes a IA inventava (chegou a sair "2023-10-01")
    const geradoEm = new Date().toLocaleDateString("pt-BR", {
      day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo",
    });

    const CSS = `
  :root{
    --tinta:#16202e; --tinta-suave:#5b6878; --linha:#e3e8ef;
    --primaria:#1e3a5f; --accent:#2d8a6e; --fundo-suave:#f7f9fb;
  }
  *{box-sizing:border-box;}
  body{
    margin:0; padding:0; background:#fff; color:var(--tinta);
    font-family:'Segoe UI','Inter',system-ui,-apple-system,sans-serif;
    font-size:10.5pt; line-height:1.65;
    -webkit-font-smoothing:antialiased;
  }
  .folha{max-width:210mm; margin:0 auto; padding:0 0 16mm;}
  .folha > *:not(.capa){margin-left:14mm; margin-right:14mm;}

  /* Capa — herói com gradiente (padrão do Manual de Cultura) */
  .capa{
    background:linear-gradient(135deg,#1b3457 0%,#22587a 55%,#2d8a6e 100%);
    color:#fff; text-align:center;
    padding:52px 40px 44px; margin:0 0 30px;
    display:flex; flex-direction:column; align-items:center;
    /* sem isto o navegador remove o fundo ao imprimir/gerar PDF */
    -webkit-print-color-adjust:exact; print-color-adjust:exact;
  }
  .capa h1{
    font-size:19pt; line-height:1.3; font-weight:600; letter-spacing:-.2px;
    color:#fff; margin:0; max-width:26em;
  }
  .capa-empresa{
    order:-1;                       /* empresa em destaque, acima do título */
    font-size:15pt; font-weight:800; letter-spacing:.3px;
    color:#f4a261; margin:0 0 10px; line-height:1.25;
  }
  .capa-data{
    font-size:8.5pt; color:rgba(255,255,255,.8); margin:26px 0 0;
    text-transform:uppercase; letter-spacing:1px;
  }

  /* Sumário */
  .sumario{
    background:var(--fundo-suave); border:1px solid var(--linha);
    border-radius:8px; padding:18px 22px; margin:26px 0 34px;
  }
  .sumario h2{
    font-size:9pt; text-transform:uppercase; letter-spacing:1px;
    color:var(--tinta-suave); margin:0 0 10px; font-weight:700;
  }
  .sumario ol{margin:0; padding-left:20px; columns:2; column-gap:32px;}
  .sumario li{margin:3px 0; font-size:9.5pt; break-inside:avoid;}
  .sumario a{color:var(--tinta); text-decoration:none;}
  .sumario a:hover{color:var(--accent);}

  /* Função */
  .funcao{margin-top:8px;}
  .funcao + .funcao{border-top:1px solid var(--linha); margin-top:38px; padding-top:30px;}
  .funcao-titulo{
    font-size:16pt; font-weight:700; color:var(--primaria);
    margin:0 0 4px; letter-spacing:-.2px;
  }

  /* Seções */
  .secao{margin:26px 0; break-inside:avoid;}
  .secao h3{
    display:flex; align-items:center; gap:10px;
    font-size:11.5pt; font-weight:700; color:var(--primaria);
    margin:0 0 12px; padding-bottom:7px;
    border-bottom:1px solid var(--linha);
  }
  .secao h3 .num{
    flex:none; width:22px; height:22px; border-radius:5px;
    background:var(--primaria); color:#fff;
    font-size:8.5pt; font-weight:700;
    display:inline-flex; align-items:center; justify-content:center;
  }
  .secao h4{
    font-size:10pt; font-weight:600; color:var(--tinta);
    margin:16px 0 7px;
  }
  .secao p{margin:0 0 9px;}   /* sem justificar: evita rios no texto */
  .secao ul{margin:0 0 9px; padding-left:18px;}
  .secao li{margin:3px 0;}

  /* Campos (definição) */
  .campos{
    display:grid; grid-template-columns:max-content 1fr;
    gap:6px 18px; margin:0;
  }
  .campos dt{font-weight:600; color:var(--tinta-suave); font-size:9.5pt;}
  .campos dd{margin:0;}

  /* Tabelas */
  .tabela{
    width:100%; border-collapse:collapse; margin:10px 0 14px;
    font-size:9.5pt; break-inside:avoid;
  }
  .tabela th{
    background:var(--primaria); color:#fff; text-align:left;
    padding:8px 10px; font-weight:600; font-size:9pt;
  }
  .tabela th:first-child{border-radius:5px 0 0 0;}
  .tabela th:last-child{border-radius:0 5px 0 0;}
  .tabela td{padding:8px 10px; border-bottom:1px solid var(--linha); vertical-align:top;}
  .tabela tbody tr:nth-child(even){background:var(--fundo-suave);}

  /* Cards */
  .cards{display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin:10px 0;}
  .card{
    border:1px solid var(--linha); border-top:3px solid var(--accent);
    border-radius:8px; padding:14px 16px; background:#fff; break-inside:avoid;
  }
  .card h4{margin:0 0 8px; font-size:9.5pt; color:var(--accent); font-weight:700;}
  .card ul{margin:0; padding-left:16px; font-size:9.5pt;}

  .grupo{margin:14px 0;}

  /* Badge */
  .badge{
    display:inline-block; padding:2px 8px; border-radius:20px;
    background:var(--fundo-suave); border:1px solid var(--linha);
    font-size:8pt; font-weight:600; color:var(--tinta-suave); white-space:nowrap;
  }

  /* Estado vazio — discreto, sem parecer erro */
  .vazio{
    color:var(--tinta-suave); font-style:italic; font-size:9.5pt;
    background:var(--fundo-suave); border-left:2px solid var(--linha);
    padding:7px 12px; margin:6px 0; border-radius:0 4px 4px 0;
  }

  /* Rodapé */
  .rodape{
    margin-top:40px; padding-top:14px; border-top:1px solid var(--linha);
    font-size:8pt; color:var(--tinta-suave);
    display:flex; justify-content:space-between; gap:16px;
  }

  /* Impressão / PDF */
  @page{size:A4; margin:14mm 12mm;}
  @media print{
    .folha{max-width:none; padding:0;}
    .folha > *:not(.capa){margin-left:0; margin-right:0;}
    .capa{break-after:page;}
    .funcao{break-before:page;}
    .secao, .card, .tabela tr{break-inside:avoid;}
    .secao h3, .funcao-titulo{break-after:avoid;}
    .sumario{background:#fff;}
    a{color:inherit; text-decoration:none;}
  }
  @media (max-width:640px){
    .cards{grid-template-columns:1fr;}
    .sumario ol{columns:1;}
    .folha > *:not(.capa){margin-left:16px; margin-right:16px;}
    .capa{padding:38px 22px 32px;}
    .capa h1{font-size:16pt;}
    .capa-empresa{font-size:13pt;}
  }`;

    // Data na capa (a IA foi proibida de inventá-la)
    if (/<\/header>/i.test(html)) {
      html = html.replace(/<\/header>/i, `<p class="capa-data">Gerado em ${geradoEm}</p></header>`);
    }

    const rodape = `<footer class="rodape"><span>${nomeEmpresa}</span><span>Gerado em ${geradoEm}</span></footer>`;

    html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">`
      + `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
      + `<title>${tituloManual}</title><style>${CSS}</style></head><body>`
      + `<div class="folha">${html}${rodape}</div></body></html>`;

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
