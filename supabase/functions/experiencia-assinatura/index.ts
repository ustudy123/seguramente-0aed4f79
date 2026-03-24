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

    // Use SECURITY DEFINER RPC to fetch link data
    const { data: linkData, error: rpcError } = await supabase.rpc(
      "buscar_experiencia_assinatura_link",
      { p_token: token }
    );

    if (rpcError || !linkData) {
      return new Response(JSON.stringify({ error: "Link não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const link = linkData;

    if (req.method === "GET") {
      if (new Date(link.expira_em) < new Date()) {
        return new Response(JSON.stringify({ error: "Este link expirou" }), {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get signed URL for document if stored
      let documentoUrl = null;
      if (link.documento_storage_path) {
        const { data: signedData } = await supabase.storage
          .from("documentos")
          .createSignedUrl(link.documento_storage_path, 3600);
        documentoUrl = signedData?.signedUrl || null;
      }

      return new Response(JSON.stringify({
        signatario_nome: link.signatario_nome,
        signatario_papel: link.signatario_papel,
        tipo_documento: link.tipo_documento,
        status: link.status,
        assinado_em: link.assinado_em,
        expira_em: link.expira_em,
        colaborador_nome: link.colaborador_nome,
        cargo: link.cargo,
        data_admissao: link.data_admissao,
        documento_html: link.documento_html,
        documento_url: documentoUrl,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      const { assinatura_base64 } = await req.json();

      if (!assinatura_base64) {
        return new Response(JSON.stringify({ error: "Assinatura obrigatória" }), {
          status: 400,
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
      const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      const timestamp = Date.now();
      const sigPath = `${link.tenant_id}/experiencia-assinaturas/${link.contrato_id}/${link.signatario_papel}_${timestamp}.png`;

      const { error: uploadError } = await supabase.storage
        .from("epi-signatures")
        .upload(sigPath, binaryData, {
          contentType: "image/png",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Client info
      const userAgent = req.headers.get("user-agent") || "unknown";
      const forwarded = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";

      // Update link status
      const { error: updateError } = await supabase
        .from("experiencia_assinatura_links")
        .update({
          status: "assinado",
          assinatura_url: sigPath,
          assinado_em: new Date().toISOString(),
          ip_assinatura: forwarded,
          user_agent_assinatura: userAgent,
        })
        .eq("id", link.id);

      if (updateError) throw updateError;

      // Inject signature into stored document (best-effort)
      try {
        if (link.documento_storage_path) {
          await injectSignatureIntoDocument(supabase, link, assinatura_base64);
        } else if (link.documento_html) {
          // Update HTML in the link record itself
          const injectedHtml = injectSignatureHtml(link.documento_html, link, assinatura_base64);
          await supabase
            .from("experiencia_assinatura_links")
            .update({ documento_html: injectedHtml })
            .eq("id", link.id);
        }
      } catch (docErr) {
        console.error("Erro ao atualizar documento com assinatura:", docErr);
      }

      // Register in contract history
      try {
        await supabase.from("contratos_experiencia_historico").insert({
          tenant_id: link.tenant_id,
          contrato_id: link.contrato_id,
          acao: "assinatura_digital",
          descricao: `Documento "${link.tipo_documento}" assinado digitalmente por ${link.signatario_nome} (${link.signatario_papel}).`,
          usuario_nome: link.signatario_nome,
        } as never);
      } catch (histErr) {
        console.error("Erro ao registrar histórico:", histErr);
      }

      // Archive signed document to Documentos module
      try {
        await arquivarDocumentoNoDossie(supabase, link, assinatura_base64);
      } catch (archErr) {
        console.error("Erro ao arquivar no dossiê:", archErr);
      }

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

function injectSignatureHtml(html: string, link: any, assinaturaBase64: string): string {
  const dataAssinatura = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const signatureBlock = `
    <div style="margin-top: 30px; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #f9fafb; page-break-inside: avoid;">
      <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; color: #374151;">
        ✅ Assinatura Digital — ${link.signatario_nome} (${link.signatario_papel})
      </p>
      <img src="${assinaturaBase64}" style="max-width: 250px; height: auto; border: 1px solid #d1d5db; border-radius: 4px; background: white; padding: 4px;" />
      <p style="margin: 8px 0 0; font-size: 10px; color: #6b7280;">
        Assinado em: ${dataAssinatura}
      </p>
    </div>
  `;

  if (html.includes("</body>")) {
    return html.replace("</body>", signatureBlock + "\n</body>");
  }
  return html + signatureBlock;
}

async function injectSignatureIntoDocument(supabase: any, link: any, assinaturaBase64: string) {
  const { data: fileData, error: dlError } = await supabase.storage
    .from("documentos")
    .download(link.documento_storage_path);

  if (dlError || !fileData) {
    console.error("Erro ao baixar documento:", dlError);
    return;
  }

  let htmlContent = await fileData.text();
  htmlContent = injectSignatureHtml(htmlContent, link, assinaturaBase64);

  const signedBlob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });

  const { error: uploadErr } = await supabase.storage
    .from("documentos")
    .upload(link.documento_storage_path, signedBlob, {
      contentType: "text/html",
      upsert: true,
    });

  if (uploadErr) {
    console.error("Erro ao upload documento assinado:", uploadErr);
    return;
  }

  // Update document record
  await supabase
    .from("documentos")
    .update({
      tamanho: signedBlob.size,
      observacoes: `Contrato de experiência assinado por ${link.signatario_nome} (${link.signatario_papel})`,
    })
    .eq("storage_path", link.documento_storage_path)
    .eq("tenant_id", link.tenant_id);

  console.log(`Documento atualizado com assinatura de ${link.signatario_nome}`);
}
