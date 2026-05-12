// Finaliza assinatura do Manual da Função: monta HTML final com selos de assinatura
// e arquiva no módulo Documentos na pasta do colaborador.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escape(v: any): string {
  if (v == null) return "";
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildSelo(payload: any, papel: string): string {
  if (!payload) return `<div style="border:1px dashed #999;padding:8px;font-size:11px;color:#666;">Aguardando assinatura — ${papel}</div>`;
  const data = payload.data ? new Date(payload.data).toLocaleString("pt-BR") : "—";
  const geo = payload.geo?.lat && payload.geo?.lng ? `${Number(payload.geo.lat).toFixed(5)}, ${Number(payload.geo.lng).toFixed(5)}` : "—";
  const cpf = payload.cpf ? `***.${String(payload.cpf).slice(3, 6)}.***-**` : "—";
  return `<div style="border:1px dashed #2563eb;background:#eff6ff;padding:10px;border-radius:6px;font-size:11px;text-align:left;">
    <div style="font-weight:bold;color:#1e3a5f;">✓ Assinatura Digital — ${escape(papel)}</div>
    <div><strong>Nome:</strong> ${escape(payload.nome)}</div>
    <div><strong>CPF:</strong> ${escape(cpf)}</div>
    <div><strong>Data/Hora:</strong> ${data}</div>
    <div><strong>IP:</strong> ${escape(payload.ip || "—")}</div>
    <div><strong>Geo:</strong> ${escape(geo)}</div>
    <div style="word-break:break-all;"><strong>Hash:</strong> ${escape(payload.hash)}</div>
  </div>`;
}

async function findOrCreateColabFolder(supabase: any, tenantId: string, colabId: string, colabNome: string, empresaId: string | null): Promise<string | null> {
  // Tenta achar pasta existente do colaborador
  const { data: existing } = await supabase
    .from("documento_pastas")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("colaborador_id", colabId)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;

  // Procura/cria pasta pai "Gestão de Pessoas"
  let { data: parent } = await supabase
    .from("documento_pastas")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("nome", "Gestão de Pessoas")
    .is("pasta_pai_id", null)
    .limit(1)
    .maybeSingle();

  if (!parent?.id) {
    const { data: newParent } = await supabase
      .from("documento_pastas")
      .insert({ tenant_id: tenantId, empresa_id: empresaId, nome: "Gestão de Pessoas", icone: "Users", cor: "#3b82f6" })
      .select("id")
      .single();
    parent = newParent;
  }

  const { data: newFolder } = await supabase
    .from("documento_pastas")
    .insert({
      tenant_id: tenantId,
      empresa_id: empresaId,
      nome: colabNome,
      pasta_pai_id: parent?.id || null,
      colaborador_id: colabId,
      icone: "User",
    })
    .select("id")
    .single();

  return newFolder?.id || null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const { assinatura_id } = await req.json();
    if (!assinatura_id) return new Response(JSON.stringify({ error: "assinatura_id obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: a, error } = await supabase
      .from("manual_funcao_assinaturas")
      .select("*")
      .eq("id", assinatura_id)
      .maybeSingle();

    if (error || !a) {
      return new Response(JSON.stringify({ error: "Registro não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (a.status !== "concluido") {
      return new Response(JSON.stringify({ ok: false, motivo: "ainda_nao_concluido" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (a.documento_arquivado_id) {
      return new Response(JSON.stringify({ ok: true, ja_arquivado: true, documento_id: a.documento_arquivado_id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Monta HTML final
    const finalHtml = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${escape(a.manual_titulo || "Manual da Função")} — Assinado</title>
<style>body{font-family:Arial,sans-serif;max-width:900px;margin:0 auto;padding:20px;color:#111;}</style></head><body>
${a.manual_html_snapshot || ""}
${a.termo_html || ""}
<section style="page-break-before:always;padding:32px 28px;">
  <h2 style="font-size:18px;color:#1e3a5f;border-bottom:2px solid #2563eb;padding-bottom:6px;">Selos de Assinatura Digital</h2>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;">
    <div>${buildSelo(a.assinatura_colaborador, "Colaborador")}</div>
    <div>${buildSelo(a.assinatura_gestor, a.gestor_id || a.gestor_nome ? "Gestor Imediato" : "Gestor (não informado)")}</div>
  </div>
  <p style="margin-top:18px;font-size:11px;color:#555;text-align:center;">
    Documento finalizado em ${new Date(a.data_conclusao || Date.now()).toLocaleString("pt-BR")}.
    Validade jurídica conforme MP 2.200-2/2001 e Lei nº 14.063/2020.
  </p>
</section>
</body></html>`;

    const blob = new Blob([finalHtml], { type: "text/html;charset=utf-8" });
    const safeNome = (a.colaborador_nome || "colaborador").replace(/[^a-zA-Z0-9]/g, "_").substring(0, 40);
    const fileName = `Manual-Funcao-${safeNome}-${Date.now()}.html`;
    const storagePath = `${a.tenant_id}/colaboradores/${a.colaborador_id}/${Date.now()}_${fileName}`;

    const { error: upErr } = await supabase.storage.from("documentos").upload(storagePath, blob, { contentType: "text/html;charset=utf-8", upsert: false });
    if (upErr) throw upErr;

    const pastaId = await findOrCreateColabFolder(supabase, a.tenant_id, a.colaborador_id, a.colaborador_nome, a.empresa_id);

    const { data: doc, error: docErr } = await supabase
      .from("documentos")
      .insert({
        tenant_id: a.tenant_id,
        empresa_id: a.empresa_id,
        colaborador_id: a.colaborador_id,
        colaborador_nome: a.colaborador_nome,
        colaborador_cpf: a.colaborador_cpf,
        nome_arquivo: storagePath,
        nome_original: fileName,
        tipo: "Manual da Função (Assinado)",
        tamanho: blob.size,
        mime_type: "text/html",
        storage_path: storagePath,
        status: "valido",
        observacoes: `Manual da Função "${a.cargo_nome}" assinado digitalmente por colaborador${a.gestor_id || a.gestor_nome ? " e gestor" : ""}.`,
        criado_por: a.enviado_por,
        criado_por_nome: a.enviado_por_nome || "Sistema",
        pasta_id: pastaId,
        versao_atual: 1,
        total_versoes: 1,
      })
      .select("id")
      .single();

    if (docErr) {
      await supabase.storage.from("documentos").remove([storagePath]);
      throw docErr;
    }

    await supabase
      .from("manual_funcao_assinaturas")
      .update({ documento_arquivado_id: doc.id, pdf_storage_path: storagePath })
      .eq("id", a.id);

    return new Response(JSON.stringify({ ok: true, documento_id: doc.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[manual-funcao-assinatura-finalizar]", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
