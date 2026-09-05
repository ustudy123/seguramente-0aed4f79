// Checkout de ADD-ON (assinatura mensal separada no Mercado Pago).
//
// Chamada pela tela "Meu Plano" logo após my_contratar_addon() ter criado
// a linha PENDENTE. Monta no MP:
//   1) uma cobrança PROPORCIONAL aos dias restantes do mês (Checkout Pro,
//      pagamento único) — é o que o cliente paga agora e o que LIBERA o
//      módulo/vidas quando aprovado (via webhook);
//   2) uma ASSINATURA MENSAL (preapproval) que passa a cobrar o valor cheio
//      todo mês, a partir do 1º dia do mês seguinte.
//
// verify_jwt = true (padrão): só usuário autenticado chama. O tenant é
// resolvido a partir do próprio add-on (que já nasceu preso ao tenant).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!accessToken || !supabaseUrl || !serviceRole) {
      return json({ error: "missing_env" }, 500);
    }

    const { addon_id, origin } = (await req.json()) as { addon_id?: string; origin?: string };
    if (!addon_id) return json({ error: "addon_id ausente" }, 400);

    // Identifica o usuário pelo JWT recebido
    const authHeader = req.headers.get("Authorization") ?? "";
    const asUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? serviceRole, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData } = await asUser.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "nao_autenticado" }, 401);

    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

    // Lê o add-on pendente e confere que pertence ao tenant do usuário
    const { data: addon } = await admin
      .from("subscription_addons")
      .select("id, tenant_id, feature_key, kind, quantity, unit_price_cents, proporcional_cents, recorrencia_inicio, mp_status")
      .eq("id", addon_id)
      .maybeSingle();
    if (!addon) return json({ error: "addon_nao_encontrado" }, 404);
    if (addon.mp_status !== "pending") return json({ error: "addon_nao_pendente", mp_status: addon.mp_status }, 409);

    const { data: prof } = await admin
      .from("profiles").select("tenant_id").eq("user_id", user.id).maybeSingle();
    if (!prof || prof.tenant_id !== addon.tenant_id) return json({ error: "sem_permissao" }, 403);

    const nomeFeature = await featureName(admin, addon.feature_key);
    const mensalCents = addon.kind === "life"
      ? addon.quantity * addon.unit_price_cents
      : addon.unit_price_cents;
    const mensalReais = round2(mensalCents / 100);
    const propReais = round2((addon.proporcional_cents ?? 0) / 100);
    const baseUrl = origin || req.headers.get("origin") || "https://youreyes.com.br";
    const webhookUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;
    const payerEmail = user.email ?? undefined;

    // ---------- 1) Assinatura MENSAL (preapproval), início no mês seguinte ----------
    const startDate = isoStartOfNextMonth(addon.recorrencia_inicio);
    const preapprovalBody: Record<string, unknown> = {
      reason: `YourEyes — ${nomeFeature} (add-on mensal)`,
      external_reference: `addon-sub-${addon.id}`,
      payer_email: payerEmail,
      back_url: `${baseUrl}/meu-plano?addon=assinado`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: mensalReais,
        currency_id: "BRL",
        start_date: startDate,
      },
      status: "pending",
      notification_url: webhookUrl,
    };
    const preapproval = await mpFetch(accessToken, "https://api.mercadopago.com/preapproval", preapprovalBody);
    if (!preapproval.ok) return json({ error: "erro_preapproval", detail: preapproval.body }, 502);
    const preapprovalId = preapproval.body?.id as string | undefined;
    const preapprovalInit = preapproval.body?.init_point as string | undefined;

    // grava o id da assinatura no add-on
    await admin.from("subscription_addons")
      .update({ mp_preapproval_id: preapprovalId ?? null })
      .eq("id", addon.id);

    // ---------- 2) Cobrança PROPORCIONAL agora (Checkout Pro) ----------
    // Se a proporcional for zero (contratou no último dia do mês), não há
    // cobrança avulsa: o cliente autoriza direto a assinatura mensal.
    if ((addon.proporcional_cents ?? 0) <= 0) {
      return json({
        checkout_url: preapprovalInit,
        preapproval_id: preapprovalId,
        modo: "somente_assinatura",
      }, 200);
    }

    const isTest = accessToken.startsWith("TEST-");
    const preference = {
      items: [{
        id: `addon-prop-${addon.id}`,
        title: `YourEyes — ${nomeFeature} (proporcional do mês)`,
        description: `Parcial do mês atual — R$ ${propReais.toFixed(2)}. A partir do próximo mês: R$ ${mensalReais.toFixed(2)}/mês.`,
        quantity: 1,
        currency_id: "BRL",
        unit_price: propReais,
      }],
      payer: payerEmail ? { email: payerEmail } : undefined,
      back_urls: {
        success: `${baseUrl}/meu-plano?addon=sucesso`,
        failure: `${baseUrl}/meu-plano?addon=falha`,
        pending: `${baseUrl}/meu-plano?addon=pendente`,
      },
      auto_return: "approved",
      statement_descriptor: "YOUREYES",
      external_reference: `addon-prop-${addon.id}`,
      notification_url: webhookUrl,
      metadata: { kind: "addon_prorata", addon_id: addon.id, tenant_id: addon.tenant_id },
    };
    const pref = await mpFetch(accessToken, "https://api.mercadopago.com/checkout/preferences", preference);
    if (!pref.ok) return json({ error: "erro_preference", detail: pref.body }, 502);

    await admin.from("subscription_addons")
      .update({ proporcional_payment_id: null })
      .eq("id", addon.id);

    return json({
      checkout_url: isTest ? pref.body?.sandbox_init_point : pref.body?.init_point,
      preference_id: pref.body?.id,
      preapproval_id: preapprovalId,
      proporcional_reais: propReais,
      mensal_reais: mensalReais,
      sandbox: isTest,
    }, 200);
  } catch (err) {
    console.error("[mp-addon-checkout] erro:", err);
    return json({ error: String(err) }, 500);
  }
});

// ---------------- helpers ----------------
function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function round2(n: number) { return Math.round(n * 100) / 100; }
async function featureName(admin: any, key: string): Promise<string> {
  const { data } = await admin.from("features").select("name").eq("key", key).maybeSingle();
  return data?.name ?? key;
}
function isoStartOfNextMonth(recorrenciaInicio: string | null): string {
  // recorrencia_inicio já vem como 1º do mês seguinte (date). Formata em ISO
  // com hora, como o MP espera (YYYY-MM-DDTHH:mm:ss.sssZ).
  const d = recorrenciaInicio ? new Date(recorrenciaInicio + "T12:00:00Z") : nextMonthFirst();
  return d.toISOString();
}
function nextMonthFirst(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 12, 0, 0));
}
async function mpFetch(token: string, url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  });
  const parsed = await res.json().catch(() => ({}));
  if (!res.ok) console.error("[mp-addon-checkout] MP erro:", url, res.status, parsed);
  return { ok: res.ok, body: parsed };
}
