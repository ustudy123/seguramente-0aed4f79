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
      const { assinatura_base64 } = await req.json();

      if (!assinatura_base64) {
        return new Response(JSON.stringify({ error: "Assinatura obrigatória" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch link with PDI info
      const { data: link, error: linkError } = await supabase
        .from("pdi_assinatura_links")
        .select("*, pdis(colaborador_id, colaborador_nome, titulo)")
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

      // Get client info
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

      // === INJECT SIGNATURE INTO DOCUMENT AND UPDATE ===
      try {
        await injectSignatureIntoDocument(supabase, link, assinatura_base64);
      } catch (docErr) {
        console.error("Erro ao atualizar documento com assinatura:", docErr);
        // Non-blocking: signature is already saved, document update is best-effort
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

async function injectSignatureIntoDocument(
  supabase: any,
  link: any,
  assinaturaBase64: string,
) {
  if (!link.documento_storage_path) return;

  // 1. Download the original HTML document
  const { data: fileData, error: dlError } = await supabase.storage
    .from("documentos")
    .download(link.documento_storage_path);

  if (dlError || !fileData) {
    console.error("Erro ao baixar documento original:", dlError);
    return;
  }

  let htmlContent = await fileData.text();

  // 2. Build the signature block HTML
  const dataAssinatura = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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

  // 3. Inject signature before </body> or at the end
  if (htmlContent.includes("</body>")) {
    htmlContent = htmlContent.replace("</body>", signatureBlock + "\n</body>");
  } else {
    htmlContent += signatureBlock;
  }

  // 4. Upload the signed version (overwrite the original)
  const signedBlob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });

  const { error: uploadErr } = await supabase.storage
    .from("documentos")
    .upload(link.documento_storage_path, signedBlob, {
      contentType: "text/html",
      upsert: true,
    });

  if (uploadErr) {
    console.error("Erro ao fazer upload do documento assinado:", uploadErr);
    return;
  }

  // 5. Update documentos table record with new size
  const { error: updateDocErr } = await supabase
    .from("documentos")
    .update({
      tamanho: signedBlob.size,
      observacoes: `Documento PDI assinado por ${link.signatario_nome} (${link.signatario_papel}) em ${dataAssinatura}`,
    })
    .eq("storage_path", link.documento_storage_path)
    .eq("tenant_id", link.tenant_id);

  if (updateDocErr) {
    console.error("Erro ao atualizar registro do documento:", updateDocErr);
  }

  // 6. Check if ALL signatories have signed → update document name to indicate fully signed
  const { data: allLinks } = await supabase
    .from("pdi_assinatura_links")
    .select("status")
    .eq("pdi_id", link.pdi_id)
    .eq("tenant_id", link.tenant_id);

  if (allLinks && allLinks.every((l: any) => l.status === "assinado")) {
    // All signed: update document name to reflect
    await supabase
      .from("documentos")
      .update({
        nome_original: `PDI - ${link.pdis?.titulo || "PDI"} - ${link.pdis?.colaborador_nome || ""} (Assinado).html`,
        observacoes: `Documento PDI totalmente assinado. Todas as partes concluíram a assinatura digital.`,
      })
      .eq("storage_path", link.documento_storage_path)
      .eq("tenant_id", link.tenant_id);
  }

  console.log(`Documento atualizado com assinatura de ${link.signatario_nome}`);
}