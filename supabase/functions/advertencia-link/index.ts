import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(JSON.stringify({ error: "Token obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET") {
      // Buscar dados da advertência pelo token
      const { data: link, error } = await supabase
        .from("advertencia_links")
        .select("*, ocorrencias(*)")
        .eq("token", token)
        .single();

      if (error || !link) {
        return new Response(JSON.stringify({ error: "Link não encontrado ou expirado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verificar expiração
      if (new Date(link.expira_em) < new Date()) {
        return new Response(JSON.stringify({ error: "Este link expirou" }), {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        ocorrencia: {
          colaborador_nome: link.ocorrencias?.colaborador_nome,
          colaborador_cargo: link.ocorrencias?.colaborador_cargo,
          descricao: link.ocorrencias?.descricao,
          data_ocorrencia: link.ocorrencias?.data_ocorrencia,
          registrado_por_nome: link.ocorrencias?.registrado_por_nome,
        },
        status: link.status,
        expira_em: link.expira_em,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      // Upload de documento formalizado
      const formData = await req.formData();
      const file = formData.get("documento") as File;

      if (!file) {
        return new Response(JSON.stringify({ error: "Arquivo obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Buscar link
      const { data: link, error: linkError } = await supabase
        .from("advertencia_links")
        .select("*, ocorrencias(tenant_id, colaborador_id)")
        .eq("token", token)
        .single();

      if (linkError || !link) {
        return new Response(JSON.stringify({ error: "Link não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Upload do documento
      const timestamp = Date.now();
      const fileName = `${link.tenant_id}/advertencias/${timestamp}_${file.name}`;
      const arrayBuffer = await file.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(fileName, arrayBuffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Atualizar status
      await supabase
        .from("advertencia_links")
        .update({
          status: "formalizada",
          documento_url: fileName,
          documento_nome: file.name,
          formalizado_em: new Date().toISOString(),
        })
        .eq("token", token);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
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
