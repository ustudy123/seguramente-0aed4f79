import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Sem autenticação" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validar usuário e checar superadmin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isSuper } = await admin.rpc("is_superadmin", { _user_id: userData.user.id });
    if (!isSuper) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { telefone, mensagem, lead_id } = await req.json();
    if (!telefone || !mensagem) {
      return new Response(JSON.stringify({ error: "Telefone e mensagem obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = Deno.env.get("WHATSAPI_TOKEN");
    const baseUrl = Deno.env.get("WHATSAPI_BASE_URL");
    if (!token || !baseUrl) {
      return new Response(JSON.stringify({ error: "WhatsApp API não configurada (WHATSAPI_TOKEN/WHATSAPI_BASE_URL)" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phoneClean = telefone.replace(/\D/g, "");
    const phoneNum = phoneClean.startsWith("55") ? phoneClean : `55${phoneClean}`;

    const sendRes = await fetch(`${baseUrl}/message/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token },
      body: JSON.stringify({ phone: phoneNum, message: mensagem }),
    });
    const sendJson = await sendRes.json().catch(() => ({}));

    // Log no histórico de interações se houver lead
    if (lead_id) {
      await admin.from("lead_interacoes").insert({
        lead_id,
        tipo: "whatsapp",
        conteudo: mensagem,
        metadata: { telefone: phoneNum, response: sendJson, status: sendRes.status },
        created_by: userData.user.id,
      });
      await admin.from("leads").update({ ultimo_contato_at: new Date().toISOString() }).eq("id", lead_id);
    }

    return new Response(
      JSON.stringify({ sucesso: sendRes.ok, status: sendRes.status, response: sendJson }),
      { status: sendRes.ok ? 200 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
