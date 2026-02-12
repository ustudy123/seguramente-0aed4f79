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
      // Fetch signature link data
      const { data: link, error } = await supabase
        .from("pdi_assinatura_links")
        .select("*, pdis(titulo, colaborador_nome, colaborador_cargo, data_inicio, data_fim, periodo, progresso, responsavel_nome)")
        .eq("token", token)
        .single();

      if (error || !link) {
        return new Response(JSON.stringify({ error: "Link não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (new Date(link.expira_em) < new Date()) {
        return new Response(JSON.stringify({ error: "Este link expirou" }), {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get signed URL for the document
      let documentoUrl = null;
      if (link.documento_storage_path) {
        const { data: signedData } = await supabase.storage
          .from("documentos")
          .createSignedUrl(link.documento_storage_path, 3600);
        documentoUrl = signedData?.signedUrl || null;
      }

      return new Response(JSON.stringify({
        pdi: link.pdis,
        signatario_nome: link.signatario_nome,
        signatario_papel: link.signatario_papel,
        status: link.status,
        assinado_em: link.assinado_em,
        expira_em: link.expira_em,
        documento_url: documentoUrl,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      // Process signature submission
      const { assinatura_base64 } = await req.json();

      if (!assinatura_base64) {
        return new Response(JSON.stringify({ error: "Assinatura obrigatória" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch link
      const { data: link, error: linkError } = await supabase
        .from("pdi_assinatura_links")
        .select("*")
        .eq("token", token)
        .single();

      if (linkError || !link) {
        return new Response(JSON.stringify({ error: "Link não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (link.status === "assinado") {
        return new Response(JSON.stringify({ error: "Este documento já foi assinado" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (new Date(link.expira_em) < new Date()) {
        return new Response(JSON.stringify({ error: "Este link expirou" }), {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Save signature image to storage
      const base64Data = assinatura_base64.replace(/^data:image\/\w+;base64,/, "");
      const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      const timestamp = Date.now();
      const sigPath = `${link.tenant_id}/pdi-assinaturas/${link.pdi_id}/${link.signatario_papel}_${timestamp}.png`;

      const { error: uploadError } = await supabase.storage
        .from("epi-signatures")
        .upload(sigPath, binaryData, {
          contentType: "image/png",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get client info from headers
      const userAgent = req.headers.get("user-agent") || "unknown";
      const forwarded = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";

      // Update link status
      const { error: updateError } = await supabase
        .from("pdi_assinatura_links")
        .update({
          status: "assinado",
          assinatura_url: sigPath,
          assinado_em: new Date().toISOString(),
          ip_assinatura: forwarded,
          user_agent_assinatura: userAgent,
        })
        .eq("id", link.id);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true, message: "Assinatura registrada com sucesso!" }), {
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
