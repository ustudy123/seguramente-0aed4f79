import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { nomeCompleto, email, tipoPessoa, documento, tenantNome, tenantSlug } = await req.json();

    if (!nomeCompleto || !email || !tenantNome) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios não preenchidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if email already exists in programa_validador_clientes
    const { data: existing } = await supabaseAdmin
      .from("programa_validador_clientes")
      .select("id")
      .eq("poc_email", email)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: "Este e-mail já possui um pré-cadastro. Nossa equipe entrará em contato em breve." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert into programa_validador_clientes
    const { error } = await supabaseAdmin
      .from("programa_validador_clientes")
      .insert({
        nome_empresa: tenantNome,
        cnpj: tipoPessoa === "pj" ? documento : null,
        poc_nome: nomeCompleto,
        poc_email: email,
        tipo_cliente: "pagante",
        fase: "prospeccao",
        observacoes: `Cadastro público | Tipo: ${tipoPessoa === "pj" ? "PJ" : "PF"} | Doc: ${documento} | Slug: ${tenantSlug}`,
      });

    if (error) {
      console.error("Insert error:", error);
      return new Response(JSON.stringify({ error: "Erro ao salvar pré-cadastro" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Pre-register error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
