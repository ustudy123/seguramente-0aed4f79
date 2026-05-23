import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { admissao_id } = await req.json();
    if (!admissao_id) {
      return new Response(JSON.stringify({ error: "admissao_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: adm } = await supabase
      .from("admissoes")
      .select("id, login_interno, nome_completo")
      .eq("id", admissao_id)
      .maybeSingle();

    if (!adm?.login_interno) {
      return new Response(JSON.stringify({ error: "Colaborador não possui login interno provisionado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const redirectTo = `https://youreyes.com.br/reset-password`;
    const { data: link, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: adm.login_interno,
      options: { redirectTo },
    });

    if (error || !link) {
      return new Response(JSON.stringify({ error: error?.message || "Falha ao gerar link" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("admissoes")
      .update({ precisa_redefinir_senha: true, senha_resetada_em: new Date().toISOString() })
      .eq("id", admissao_id);

    return new Response(
      JSON.stringify({
        login: adm.login_interno,
        action_link: link.properties?.action_link,
        nome: adm.nome_completo,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
