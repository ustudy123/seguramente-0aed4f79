import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") || "https://youreyes.com.br";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  let email: string;
  try {
    const body = await req.json();
    email = (body.email ?? "").trim().toLowerCase();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (!email) return json({ error: "Email é obrigatório" }, 400);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Generate recovery link without sending default email
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: `${SITE_URL}/reset-password`,
    },
  });

  if (linkError) {
    // Usuário inexistente cai aqui. Por segurança NÃO revelamos isso ao
    // cliente — respondemos ok. Mas logamos com marcador para diagnóstico.
    console.warn("[recovery] generateLink falhou (provável usuário inexistente):", linkError.message, "email:", email);
    return json({ ok: true });
  }

  const recoveryUrl = linkData?.properties?.action_link;
  if (!recoveryUrl) {
    console.error("[recovery] generateLink OK porém sem action_link. email:", email);
    return json({ ok: true });
  }

  // Send branded email via Resend
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.error("[recovery] RESEND_API_KEY não configurada");
    return json({ error: "Serviço de e-mail não configurado" }, 500);
  }

  const userName = linkData?.user?.user_metadata?.nome_completo || "";

  try {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "YourEyes <noreply@youreyes.com.br>",
        to: [email],
        subject: "Recuperação de senha — YourEyes",
        html: `
          <div style="font-family: 'Inter', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 28px; background: #ffffff;">
            <div style="text-align: center; margin-bottom: 8px;">
              <p style="font-size: 24px; font-weight: bold; color: hsl(262, 52%, 50%); margin: 0;">YourEyes</p>
            </div>
            <hr style="border-color: #e8e5f0; margin: 16px 0;" />
            <h1 style="font-size: 22px; font-weight: bold; color: hsl(260, 20%, 16%); margin: 0 0 16px;">
              Recuperar senha
            </h1>
            <p style="font-size: 14px; color: hsl(260, 10%, 46%); line-height: 1.6; margin: 0 0 20px;">
              ${userName ? `Olá, ${userName}! ` : ""}Recebemos uma solicitação para redefinir sua senha na plataforma <strong>YourEyes</strong>.
            </p>
            <p style="font-size: 14px; color: hsl(260, 10%, 46%); line-height: 1.6; margin: 0 0 20px;">
              Clique no botão abaixo para criar uma nova senha. Este link é válido por 1 hora.
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${recoveryUrl}" style="background-color: hsl(262, 52%, 50%); color: #ffffff; font-size: 14px; font-weight: 600; border-radius: 10px; padding: 14px 28px; text-decoration: none; display: inline-block;">
                Redefinir Minha Senha
              </a>
            </div>
            <p style="font-size: 12px; color: #999999; margin: 24px 0 0; word-break: break-all;">
              Se o botão não funcionar, copie e cole este endereço no navegador:<br/>${recoveryUrl}
            </p>
            <p style="font-size: 12px; color: #999999; margin: 16px 0 0;">
              Se você não solicitou a recuperação de senha, ignore este e-mail.
            </p>
            <hr style="border-color: #e8e5f0; margin: 16px 0;" />
            <p style="font-size: 11px; color: #b3b3b3; text-align: center; margin: 8px 0 0;">YourEyes — Plataforma de SST</p>
          </div>
        `,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      console.error("[recovery] Resend rejeitou o envio. status:", resendRes.status, "body:", err);
      // ANTES: retornava ok mesmo com falha, e o front mostrava "E-mail enviado!".
      // Agora informamos a falha real para o usuário poder reagir (tentar de novo,
      // avisar o suporte) em vez de esperar um e-mail que nunca chega.
      return json({ error: "Não foi possível enviar o e-mail no momento. Tente novamente em instantes." }, 502);
    }

    const okData = await resendRes.json().catch(() => ({}));
    console.log("[recovery] e-mail enviado. id:", (okData as any)?.id ?? "-", "email:", email);
  } catch (e) {
    console.error("[recovery] erro de rede ao enviar e-mail:", e);
    return json({ error: "Falha de comunicação com o serviço de e-mail. Tente novamente." }, 502);
  }

  return json({ ok: true });
});
