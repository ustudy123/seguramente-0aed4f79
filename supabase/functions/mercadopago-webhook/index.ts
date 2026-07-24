// Webhook do Mercado Pago — recebe notificações de pagamento e atualiza assinaturas.
// Público (verify_jwt=false). MP não envia JWT; validação por consulta autenticada à API do MP.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const STATUS_MAP: Record<string, string> = {
  approved: "approved",
  authorized: "approved",
  pending: "pending",
  in_process: "pending",
  in_mediation: "pending",
  rejected: "rejected",
  cancelled: "cancelled",
  refunded: "refunded",
  charged_back: "charged_back",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!accessToken || !supabaseUrl || !serviceRole) {
      return new Response(JSON.stringify({ error: "missing_env" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const qType = url.searchParams.get("type") || url.searchParams.get("topic");
    const qId = url.searchParams.get("data.id") || url.searchParams.get("id");

    let body: any = {};
    try {
      body = await req.json();
    } catch (_) {}

    const type = body?.type || body?.topic || qType;
    const paymentId =
      body?.data?.id ||
      body?.resource?.toString().split("/").pop() ||
      qId;

    console.log("[mp-webhook] evento:", { type, paymentId });

    // Sempre 200 rápido pra MP não reenviar — mas processa quando for payment
    if (!paymentId || (type && type !== "payment" && type !== "payment.updated")) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca detalhes do pagamento no MP (fonte da verdade)
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payment = await mpRes.json();
    if (!mpRes.ok) {
      console.error("[mp-webhook] erro buscar pagamento:", payment);
      return new Response(JSON.stringify({ ok: true, error: "fetch_failed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false },
    });

    const status = STATUS_MAP[payment.status] || payment.status || "pending";
    const externalReference = payment.external_reference as string | null;
    const preferenceId = (payment.additional_info?.preference_id ||
      payment.order?.id ||
      null) as string | null;
    const meta = payment.metadata || {};

    const patch: Record<string, unknown> = {
      status,
      payment_id: String(payment.id),
      payer_email: payment.payer?.email ?? null,
      payment_method: payment.payment_method_id ?? payment.payment_type_id ?? null,
      raw_payload: payment,
      approved_at: status === "approved" ? new Date().toISOString() : null,
      external_reference: externalReference,
    };

    // Tenta localizar assinatura já criada no checkout
    let existingId: string | null = null;
    if (externalReference) {
      const { data } = await supabase
        .from("assinaturas")
        .select("id")
        .eq("external_reference", externalReference)
        .maybeSingle();
      existingId = data?.id ?? null;
    }
    if (!existingId && preferenceId) {
      const { data } = await supabase
        .from("assinaturas")
        .select("id")
        .eq("preference_id", preferenceId)
        .maybeSingle();
      existingId = data?.id ?? null;
    }

    if (existingId) {
      const { error } = await supabase.from("assinaturas").update(patch).eq("id", existingId);
      if (error) console.error("[mp-webhook] update erro:", error);
    } else {
      // Cria registro se checkout não tiver persistido (fallback)
      const preco_mensal = Number(meta.preco_mensal ?? payment.transaction_amount ?? 0);
      const meses = Number(meta.meses ?? 1);
      const { error } = await supabase.from("assinaturas").insert({
        plano_id: meta.plano_id ?? "desconhecido",
        plano_nome: meta.plano_nome ?? payment.description ?? "Assinatura",
        ciclo: meta.ciclo ?? "mensal",
        preco_mensal,
        valor_total: Number(payment.transaction_amount ?? preco_mensal * meses),
        meses,
        preference_id: preferenceId,
        ...patch,
      });
      if (error) console.error("[mp-webhook] insert erro:", error);
    }

    return new Response(JSON.stringify({ ok: true, status }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[mp-webhook] erro:", err);
    // Retorna 200 mesmo em erro pra evitar reenvios infinitos; log fica registrado.
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
