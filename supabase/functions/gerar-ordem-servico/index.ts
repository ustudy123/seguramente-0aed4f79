// Edge Function: gerar-ordem-servico
// Gera o conteúdo de uma Ordem de Serviço (NR-1) cruzando o PGR vigente
// com os dados de função/cargo/EPI/treinamento do colaborador.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

interface ReqBody {
  colaborador_id: string;
  pgr_id?: string;
  responsavel_emissao_id?: string;
  responsavel_emissao_nome?: string;
  responsavel_tecnico_nome?: string;
  responsavel_tecnico_registro?: string;
}

function escapeHtml(s: any): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function normalize(s: string | null | undefined): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body: ReqBody = await req.json();
    if (!body.colaborador_id) {
      return new Response(JSON.stringify({ error: "colaborador_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth do chamador
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1. Buscar colaborador (admissoes)
    const { data: colab, error: colabErr } = await admin
      .from("admissoes")
      .select("*")
      .eq("id", body.colaborador_id)
      .maybeSingle();
    if (colabErr || !colab) throw new Error("Colaborador não encontrado");

    // 2. Buscar empresa
    const { data: empresa } = await admin
      .from("empresa_cadastro")
      .select("razao_social, cnpj, nome_fantasia")
      .eq("id", colab.empresa_id)
      .maybeSingle();

    // 3. PGR vigente
    let pgrQuery = admin
      .from("sst_documentos")
      .select("*")
      .eq("tenant_id", colab.tenant_id)
      .eq("tipo", "PGR")
      .order("data_emissao", { ascending: false, nullsFirst: false });
    if (colab.empresa_id) pgrQuery = pgrQuery.eq("empresa_id", colab.empresa_id);
    if (body.pgr_id) pgrQuery = admin.from("sst_documentos").select("*").eq("id", body.pgr_id);

    const { data: pgrRows } = await pgrQuery.limit(1);
    const pgr = pgrRows?.[0];
    if (!pgr) throw new Error("Nenhum PGR vigente encontrado para esta empresa.");
    if (pgr.analise_ia_status !== "concluida") {
      throw new Error("PGR ainda não foi analisado pela IA. Aguarde a extração concluir.");
    }

    // 4. Localizar cargo do colaborador (por nome, case-insensitive)
    const cargoNomeColab = normalize(colab.cargo);
    const { data: cargosTenant } = await admin
      .from("cargos")
      .select("id, nome")
      .eq("tenant_id", colab.tenant_id);
    const cargo = cargosTenant?.find(c => normalize(c.nome) === cargoNomeColab);

    // 5. EPIs, treinamentos, atividades, POPs da função
    let funcao_epis: any[] = [];
    let funcao_treinamentos: any[] = [];
    let funcao_atividades: any[] = [];
    let funcao_pops: any[] = [];
    if (cargo?.id) {
      const [epis, trein, atv, pops] = await Promise.all([
        admin.from("funcao_epis").select("*, epi_tipos(nome, ca_numero)").eq("cargo_id", cargo.id),
        admin.from("funcao_treinamentos").select("*").eq("cargo_id", cargo.id),
        admin.from("funcao_atividades").select("*").eq("cargo_id", cargo.id),
        admin.from("funcao_pops").select("titulo, descricao").eq("cargo_id", cargo.id),
      ]);
      funcao_epis = epis.data || [];
      funcao_treinamentos = trein.data || [];
      funcao_atividades = atv.data || [];
      funcao_pops = pops.data || [];
    }

    // 6. Riscos do PGR aplicáveis (filtrar por cargo/setor quando possível)
    const inventario = (pgr.analise_ia?.inventario_riscos || []) as any[];
    const setorColab = normalize(colab.departamento);
    const cargoColabNorm = normalize(colab.cargo);
    const riscosAplicaveis = inventario.filter((r: any) => {
      const setor = normalize(r.setor);
      const cargo = normalize(r.cargo);
      const matchSetor = !setor || setor.includes(setorColab) || setorColab.includes(setor);
      const matchCargo = !cargo || cargo.includes(cargoColabNorm) || cargoColabNorm.includes(cargo);
      return matchSetor || matchCargo;
    });

    // 7. Chamar IA para redigir procedimentos seguros e condutas proibidas
    const promptCtx = {
      cargo: colab.cargo,
      setor: colab.departamento,
      riscos: riscosAplicaveis.slice(0, 15).map(r => ({
        tipo: r.tipo, perigo: r.perigo_identificado || r.descricao, nivel: r.nivel_risco,
      })),
      atividades: funcao_atividades.slice(0, 10).map(a => a.nome),
      epis: funcao_epis.map(e => e.epi_tipos?.nome).filter(Boolean),
    };

    const promptText = `Você é especialista em SST. Redija para a Ordem de Serviço (NR-1) do cargo "${colab.cargo}" no setor "${colab.departamento}":
1) PROCEDIMENTOS SEGUROS DE TRABALHO (lista de 5-8 itens objetivos, ação concreta)
2) CONDUTAS PROIBIDAS (lista de 5-7 itens, comportamentos vedados)

Use apenas os dados abaixo, sem inventar riscos:
${JSON.stringify(promptCtx).slice(0, 2500)}

Responda APENAS em JSON: {"procedimentos":["..."],"condutas_proibidas":["..."]}`;

    let iaTexto: { procedimentos: string[]; condutas_proibidas: string[] } = {
      procedimentos: [],
      condutas_proibidas: [],
    };
    try {
      const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: promptText }],
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(50000),
      });
      if (aiResp.ok) {
        const j = await aiResp.json();
        const content = j.choices?.[0]?.message?.content;
        if (content) iaTexto = JSON.parse(content);
      }
    } catch (e) {
      console.warn("IA falhou, usando defaults:", e);
    }

    // 8. Montar HTML
    const proced = (iaTexto.procedimentos?.length ? iaTexto.procedimentos : [
      "Cumprir as normas de segurança aplicáveis à função",
      "Utilizar corretamente os EPIs fornecidos",
      "Comunicar imediatamente qualquer condição insegura ao gestor",
      "Participar dos treinamentos obrigatórios",
      "Manter o local de trabalho organizado",
    ]);
    const condutas = (iaTexto.condutas_proibidas?.length ? iaTexto.condutas_proibidas : [
      "Operar máquinas/equipamentos sem treinamento",
      "Remover dispositivos de segurança",
      "Trabalhar sob efeito de álcool ou substâncias psicoativas",
      "Usar EPI danificado ou em desuso",
      "Realizar atividades fora da função sem autorização",
    ]);

    const dataEmissao = new Date();
    const dataVigencia = pgr.data_vigencia || new Date(dataEmissao.getTime() + 365 * 86400000).toISOString().slice(0, 10);

    const html = `
<div class="os-documento" style="font-family: Arial, sans-serif; color:#222; line-height:1.5;">
  <h1 style="text-align:center; font-size:18px; border-bottom:2px solid #333; padding-bottom:8px;">ORDEM DE SERVIÇO</h1>
  <table style="width:100%; font-size:12px; margin:12px 0;">
    <tr><td><b>Empresa:</b> ${escapeHtml(empresa?.razao_social)}</td><td><b>CNPJ:</b> ${escapeHtml(empresa?.cnpj)}</td></tr>
    <tr><td><b>Colaborador:</b> ${escapeHtml(colab.nome_completo)}</td><td><b>CPF:</b> ${escapeHtml(colab.cpf)}</td></tr>
    <tr><td><b>Função:</b> ${escapeHtml(colab.cargo)}</td><td><b>Setor:</b> ${escapeHtml(colab.departamento)}</td></tr>
    <tr><td><b>Emissão:</b> ${dataEmissao.toLocaleDateString("pt-BR")}</td><td><b>Vigência até:</b> ${new Date(dataVigencia).toLocaleDateString("pt-BR")}</td></tr>
  </table>

  <h3 style="font-size:13px; background:#f0f0f0; padding:6px;">1. BASE LEGAL</h3>
  <p style="font-size:12px;">Esta Ordem de Serviço é emitida em cumprimento à <b>NR-1, item 1.4.1 alínea "b"</b> e ao <b>art. 157 da CLT</b>, dando ao empregado ciência dos riscos ocupacionais da função, das medidas de prevenção, dos procedimentos seguros e das penalidades pelo descumprimento.</p>

  <h3 style="font-size:13px; background:#f0f0f0; padding:6px;">2. RISCOS OCUPACIONAIS DA FUNÇÃO</h3>
  ${riscosAplicaveis.length === 0
    ? '<p style="font-size:12px; color:#a00;"><i>Nenhum risco específico mapeado no PGR para esta função/setor. Recomenda-se revisão do PGR.</i></p>'
    : `<ul style="font-size:12px;">${riscosAplicaveis.slice(0, 20).map(r =>
        `<li><b>[${escapeHtml(r.tipo || r.subtipo || "Risco")}]</b> ${escapeHtml(r.perigo_identificado || r.descricao || r.titulo)} — <i>Nível: ${escapeHtml(r.nivel_risco || "n/d")}</i></li>`
      ).join("")}</ul>`}

  <h3 style="font-size:13px; background:#f0f0f0; padding:6px;">3. MEDIDAS DE PREVENÇÃO (EPC)</h3>
  <ul style="font-size:12px;">
    ${riscosAplicaveis.slice(0, 10).flatMap(r => (r.medidas_existentes || []).concat(r.medidas_recomendadas || []))
      .filter(Boolean).slice(0, 15).map(m => `<li>${escapeHtml(m)}</li>`).join("") ||
      "<li>Conforme medidas de controle estabelecidas no PGR vigente da empresa.</li>"}
  </ul>

  <h3 style="font-size:13px; background:#f0f0f0; padding:6px;">4. EPI OBRIGATÓRIO PARA A FUNÇÃO</h3>
  ${funcao_epis.length === 0
    ? '<p style="font-size:12px;"><i>Sem EPI específico mapeado para esta função.</i></p>'
    : `<ul style="font-size:12px;">${funcao_epis.map((e: any) =>
        `<li>${escapeHtml(e.epi_tipos?.nome)} ${e.epi_tipos?.ca_numero ? `(CA ${escapeHtml(e.epi_tipos.ca_numero)})` : ""} ${e.obrigatorio ? "<b>[obrigatório]</b>" : ""}</li>`
      ).join("")}</ul>`}

  <h3 style="font-size:13px; background:#f0f0f0; padding:6px;">5. PROCEDIMENTOS SEGUROS DE TRABALHO</h3>
  <ul style="font-size:12px;">${proced.map(p => `<li>${escapeHtml(p)}</li>`).join("")}</ul>

  <h3 style="font-size:13px; background:#f0f0f0; padding:6px;">6. TREINAMENTOS NORMATIVOS</h3>
  ${funcao_treinamentos.length === 0
    ? '<p style="font-size:12px;"><i>Verificar matriz de treinamentos da empresa.</i></p>'
    : `<ul style="font-size:12px;">${funcao_treinamentos.map((t: any) =>
        `<li>${escapeHtml(t.titulo)} ${t.carga_horaria_min ? `— ${t.carga_horaria_min}h` : ""} ${t.obrigatorio ? "<b>[obrigatório]</b>" : ""}</li>`
      ).join("")}</ul>`}

  <h3 style="font-size:13px; background:#f0f0f0; padding:6px;">7. CONDUTAS PROIBIDAS</h3>
  <ul style="font-size:12px;">${condutas.map(c => `<li>${escapeHtml(c)}</li>`).join("")}</ul>

  <h3 style="font-size:13px; background:#f0f0f0; padding:6px;">8. PENALIDADES</h3>
  <p style="font-size:12px;">Conforme <b>art. 158, parágrafo único, da CLT</b>, constitui <b>ato faltoso</b> a recusa injustificada à observância das instruções aqui contidas e ao uso dos EPIs fornecidos. O descumprimento poderá ensejar, conforme a gravidade: <b>advertência verbal, advertência escrita, suspensão disciplinar ou rescisão por justa causa</b> (art. 482, "h", da CLT).</p>

  <h3 style="font-size:13px; background:#f0f0f0; padding:6px;">9. DECLARAÇÃO DE CIÊNCIA E RECEBIMENTO</h3>
  <p style="font-size:12px;">Declaro ter recebido esta Ordem de Serviço, tomado ciência dos riscos da minha função, das medidas de prevenção, dos procedimentos seguros, dos EPIs obrigatórios e das penalidades aplicáveis em caso de descumprimento. Comprometo-me a cumprir integralmente as orientações aqui descritas.</p>

  <p style="font-size:12px; margin-top:24px;">
    <b>Responsável pela emissão:</b> ${escapeHtml(body.responsavel_emissao_nome || "—")}<br/>
    <b>Responsável Técnico (SESMT):</b> ${escapeHtml(body.responsavel_tecnico_nome || "—")} ${body.responsavel_tecnico_registro ? `— ${escapeHtml(body.responsavel_tecnico_registro)}` : ""}
  </p>
</div>
`.trim();

    const conteudoJson = {
      pgr_id: pgr.id,
      pgr_emissao: pgr.data_emissao,
      empresa: { razao_social: empresa?.razao_social, cnpj: empresa?.cnpj },
      colaborador: {
        nome: colab.nome_completo, cpf: colab.cpf, cargo: colab.cargo,
        setor: colab.departamento, matricula: colab.matricula_esocial,
      },
      riscos: riscosAplicaveis,
      epis: funcao_epis,
      treinamentos: funcao_treinamentos,
      atividades: funcao_atividades,
      procedimentos: proced,
      condutas_proibidas: condutas,
    };

    return new Response(JSON.stringify({
      conteudo_html: html,
      conteudo_json: conteudoJson,
      pgr_id: pgr.id,
      cargo_id: cargo?.id || null,
      cargo_nome: colab.cargo,
      setor_nome: colab.departamento,
      data_vigencia: dataVigencia,
      ano: dataEmissao.getFullYear(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    console.error("gerar-ordem-servico erro:", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
