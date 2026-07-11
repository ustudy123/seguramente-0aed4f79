import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
        .from("ferias_assinatura_links")
        .select("*")
        .eq("token", token)
        .single();

      if (error || !link) {
        return new Response(
          JSON.stringify({ error: "Link não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (new Date(link.expira_em) < new Date()) {
        return new Response(
          JSON.stringify({ error: "Este link expirou" }),
          { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let documentoUrl = null;
      if (link.documento_storage_path) {
        const { data: signedData } = await supabase.storage
          .from("documentos")
          .createSignedUrl(link.documento_storage_path, 3600);
        documentoUrl = signedData?.signedUrl || null;
      }

      return new Response(
        JSON.stringify({
          colaborador_nome: link.colaborador_nome,
          departamento: link.departamento,
          cargo: link.cargo,
          data_inicio: link.data_inicio_ferias,
          data_fim: link.data_fim_ferias,
          dias_ferias: link.dias_ferias,
          abono_pecuniario: link.abono_pecuniario,
          dias_abono: link.dias_abono,
          tipo_documento: link.tipo_documento || "aviso",
          status: link.status,
          documento_url: documentoUrl,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    }

    if (req.method === "POST") {
      const body = await req.json();
      const { assinatura_imagem } = body;

      if (!assinatura_imagem) {
        return new Response(
          JSON.stringify({ error: "Assinatura obrigatória" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get link
      const { data: link, error: linkError } = await supabase
        .from("ferias_assinatura_links")
        .select("*")
        .eq("token", token)
        .single();

      if (linkError || !link) {
        return new Response(
          JSON.stringify({ error: "Link não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (link.status === "assinado") {
        return new Response(
          JSON.stringify({ error: "Este documento já foi assinado" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (new Date(link.expira_em) < new Date()) {
        return new Response(
          JSON.stringify({ error: "Este link expirou" }),
          { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get client IP
      const clientIP =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        "unknown";

      // If there's an HTML document, inject the signature
      if (link.documento_storage_path) {
        try {
          const { data: fileData } = await supabase.storage
            .from("documentos")
            .download(link.documento_storage_path);

          if (fileData) {
            const htmlContent = await fileData.text();
            const timestamp = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

            const signatureBlock = `
              <div style="margin-top:40px;padding:20px;border-top:2px solid #333;page-break-inside:avoid;">
                <h3 style="margin:0 0 10px;font-size:14px;">Assinatura Digital — Colaborador</h3>
                <div style="display:flex;gap:20px;align-items:flex-end;">
                  <img src="${assinatura_imagem}" style="max-width:300px;max-height:100px;border-bottom:1px solid #000;" />
                  <div style="font-size:11px;color:#666;">
                    <p style="margin:2px 0;"><strong>${link.colaborador_nome}</strong></p>
                    <p style="margin:2px 0;">Assinado em: ${timestamp}</p>
                    <p style="margin:2px 0;">IP: ${clientIP}</p>
                  </div>
                </div>
              </div>`;

            const updatedHtml = htmlContent.replace("</body>", signatureBlock + "</body>");

            // Rename path to include (Assinado)
            const originalPath = link.documento_storage_path;
            const signedPath = originalPath.replace(".html", " (Assinado).html");

            await supabase.storage
              .from("documentos")
              .upload(signedPath, new Blob([updatedHtml], { type: "text/html" }), {
                upsert: true,
                contentType: "text/html",
              });

            // Update link with new path
            await supabase
              .from("ferias_assinatura_links")
              .update({
                status: "assinado",
                assinado_em: new Date().toISOString(),
                assinatura_ip: clientIP,
                documento_storage_path: signedPath,
              })
              .eq("id", link.id);

            // Auto-archive to Documentos module (pasta do colaborador)
            try {
              const tipo = link.tipo_documento === "recibo"
                ? "Recibo de Férias (Assinado)"
                : "Aviso de Férias (Assinado)";
              const nomeOriginal = `${tipo} - ${link.colaborador_nome}.html`;

              // Resolve/create colaborador folder if colaborador_id present
              let pastaId: string | null = null;
              if (link.colaborador_id) {
                const { data: pasta } = await supabase
                  .from("documento_pastas")
                  .select("id")
                  .eq("tenant_id", link.tenant_id)
                  .eq("colaborador_id", link.colaborador_id)
                  .maybeSingle();
                pastaId = pasta?.id || null;
              }

              const { data: docIns } = await supabase.from("documentos").insert({
                tenant_id: link.tenant_id,
                empresa_id: link.empresa_id || null,
                colaborador_id: link.colaborador_id || null,
                colaborador_nome: link.colaborador_nome,
                colaborador_cpf: link.colaborador_cpf || null,
                nome_arquivo: signedPath,
                nome_original: nomeOriginal,
                tipo,
                tamanho: new Blob([updatedHtml]).size,
                mime_type: "text/html",
                storage_path: signedPath,
                status: "valido",
                observacoes: `Assinado digitalmente em ${new Date().toISOString()} (IP ${clientIP})`,
                pasta_id: pastaId,
                versao_atual: 1,
                total_versoes: 1,
              }).select("id").single();

              if (docIns?.id) {
                await supabase
                  .from("ferias_assinatura_links")
                  .update({ documento_arquivado_id: docIns.id })
                  .eq("id", link.id);
              }

              // Mark recibo_gerado on the solicitacao when it's a recibo
              if (link.tipo_documento === "recibo" && link.ferias_solicitacao_id) {
                await supabase
                  .from("ferias_solicitacoes")
                  .update({ recibo_gerado: true, assinatura_status: "assinado" })
                  .eq("id", link.ferias_solicitacao_id);
              } else if (link.ferias_solicitacao_id) {
                await supabase
                  .from("ferias_solicitacoes")
                  .update({ assinatura_status: "assinado" })
                  .eq("id", link.ferias_solicitacao_id);
              }
            } catch (archErr) {
              console.error("Erro ao arquivar em Documentos:", archErr);
            }

          }
        } catch (docError) {
          console.error("Erro ao processar documento:", docError);
          // Still mark as signed even if doc processing fails
          await supabase
            .from("ferias_assinatura_links")
            .update({
              status: "assinado",
              assinado_em: new Date().toISOString(),
              assinatura_ip: clientIP,
            })
            .eq("id", link.id);
        }
      } else {
        // No document, just mark as signed
        await supabase
          .from("ferias_assinatura_links")
          .update({
            status: "assinado",
            assinado_em: new Date().toISOString(),
            assinatura_ip: clientIP,
          })
          .eq("id", link.id);
      }

      return new Response(
        JSON.stringify({ success: true, message: "Aviso de férias assinado com sucesso!" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
