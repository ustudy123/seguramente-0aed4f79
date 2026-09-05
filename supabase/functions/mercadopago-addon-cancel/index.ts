// Cancelamento de ADD-ON: encerra a assinatura mensal no Mercado Pago e
// remove o efeito no motor (via my_cancelar_addon, chamada pela tela).
//
// Chamada pela tela "Meu Plano" ao clicar "Cancelar". Recebe o feature_key;
// resolve o tenant pelo JWT; cancela no MP toda assinatura ativa daquele
// add-on. É idempotente: se não houver assinatura no MP, apenas retorna ok.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!accessToken || !supabaseUrl || !serviceRole) return json({ error: "missing_env" }, 500);

    const { feature_key } = (await req.json()) as { feature_key?: string };
    if (!feature_key) return json({ error: "feature_key ausente" }, 400);

    const authHeader = req.headers.get("Authorization") ?? "";
    const asUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? serviceRole, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData } = await asUser.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "nao_autenticado" }, 401);

    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
    const { data: prof } = await admin
      .from("profiles").select("tenant_id").eq("user_id", user.id).maybeSingle();
    if (!prof?.tenant_id) return json({ error: "sem_tenant" }, 403);

    // Assinaturas MP ativas deste add-on no tenant
    const { data: rows } = await admin
      .from("subscription_addons")
      .select("id, mp_preapproval_id")
      .eq("tenant_id", prof.tenant_id)
      .eq("feature_key", feature_key)
      .not("mp_preapproval_id", "is", null)
      .in("mp_status", ["authorized", "pending"]);

    const cancelados: string[] = [];
    for (const r of rows ?? []) {
      if (!r.mp_preapproval_id) continue;
      const res = await fetch(`https://api.mercadopago.com/preapproval/${r.mp_preapproval_id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (res.ok) cancelados.push(r.mp_preapproval_id);
      else console.error("[mp-addon-cancel] MP erro:", r.mp_preapproval_id, res.status, await res.text());
    }

    // Remove efeito e marca cancelado no banco (função do próprio usuário)
    const { error: rpcErr } = await asUser.rpc("my_cancelar_addon", { _feature_key: feature_key });
    if (rpcErr) console.error("[mp-addon-cancel] my_cancelar_addon:", rpcErr);

    return json({ ok: true, cancelados_no_mp: cancelados.length }, 200);
  } catch (err) {
    console.error("[mp-addon-cancel] erro:", err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
