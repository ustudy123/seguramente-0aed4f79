import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Simple hash for phone (SHA-256)
async function hashPhone(phone: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(phone);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, telefone, campanha_id, codigo, telefone_hash_direto } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const whatsapiToken = Deno.env.get("WHATSAPI_TOKEN");
    const whatsapiBaseUrl = Deno.env.get("WHATSAPI_BASE_URL");

    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!campanha_id) {
      return new Response(
        JSON.stringify({ erro: "Campanha não informada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── CONFIRMAR USO (chamado APÓS submissão do questionário) ──
    // Aceita o hash já calculado (o respondente não precisa reenviar o telefone em texto puro).
    if (action === "confirmar_uso") {
      const hashFinal = telefone_hash_direto || (telefone ? await hashPhone(telefone.replace(/\D/g, "")) : null);
      if (!hashFinal) {
        return new Response(
          JSON.stringify({ erro: "Hash de telefone não informado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      await supabase.from("psicossocial_telefone_usado").upsert(
        { campanha_id, telefone_hash: hashFinal },
        { onConflict: "campanha_id,telefone_hash" }
      );
      return new Response(
        JSON.stringify({ sucesso: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!whatsapiToken || !whatsapiBaseUrl) {
      throw new Error("WhatsApp API não configurada");
    }

    // Limpar telefone - apenas dígitos
    const telefoneLimpo = telefone?.replace(/\D/g, "") || "";

    if (!telefoneLimpo || telefoneLimpo.length < 10) {
      return new Response(
        JSON.stringify({ erro: "Telefone inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const telefoneHash = await hashPhone(telefoneLimpo);

    // ─── ENVIAR CÓDIGO ─────────────────────────────────────
    if (action === "enviar") {
      // Verificar se telefone já foi usado nesta campanha
      const { data: jaUsado } = await supabase
        .from("psicossocial_telefone_usado")
        .select("id")
        .eq("campanha_id", campanha_id)
        .eq("telefone_hash", telefoneHash)
        .maybeSingle();

      if (jaUsado) {
        return new Response(
          JSON.stringify({ erro: "Este telefone já respondeu a esta campanha." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verificar rate limit - max 3 OTPs por telefone em 10 min
      const { count } = await supabase
        .from("psicossocial_otp_verificacao")
        .select("id", { count: "exact", head: true })
        .eq("telefone_hash", telefoneHash)
        .eq("campanha_id", campanha_id)
        .gte("criado_em", new Date(Date.now() - 10 * 60 * 1000).toISOString());

      if ((count || 0) >= 3) {
        return new Response(
          JSON.stringify({ erro: "Muitas tentativas. Aguarde 10 minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const otp = generateOTP();

      // Salvar OTP no banco
      await supabase.from("psicossocial_otp_verificacao").insert({
        campanha_id,
        telefone_hash: telefoneHash,
        codigo: otp,
        expira_em: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

      // Enviar via WhatsApp API
      const whatsResponse = await fetch(`${whatsapiBaseUrl}/send/text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          token: whatsapiToken,
        },
        body: JSON.stringify({
          number: `55${telefoneLimpo}`,
          text: `🔐 Seu código de verificação Seguramente: *${otp}*\n\nEste código expira em 10 minutos.\nNão compartilhe com ninguém.`,
        }),
      });

      const whatsResult = await whatsResponse.json();
      const enviado = whatsResult?.messageid || whatsResult?.messageId || whatsResult?._status === 200;

      if (!enviado) {
        console.error("Erro ao enviar WhatsApp:", JSON.stringify(whatsResult));
        return new Response(
          JSON.stringify({ erro: "Erro ao enviar o código. Verifique o número." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ sucesso: true, mensagem: "Código enviado via WhatsApp" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── VERIFICAR CÓDIGO ──────────────────────────────────
    if (action === "verificar") {
      if (!codigo) {
        return new Response(
          JSON.stringify({ erro: "Código não informado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buscar OTP válido mais recente
      const { data: otp } = await supabase
        .from("psicossocial_otp_verificacao")
        .select("*")
        .eq("telefone_hash", telefoneHash)
        .eq("campanha_id", campanha_id)
        .eq("verificado", false)
        .gte("expira_em", new Date().toISOString())
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!otp) {
        return new Response(
          JSON.stringify({ erro: "Código expirado ou inválido. Solicite um novo." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Incrementar tentativas
      await supabase
        .from("psicossocial_otp_verificacao")
        .update({ tentativas: otp.tentativas + 1 })
        .eq("id", otp.id);

      if (otp.tentativas >= 5) {
        return new Response(
          JSON.stringify({ erro: "Máximo de tentativas excedido. Solicite um novo código." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (otp.codigo !== codigo) {
        return new Response(
          JSON.stringify({ erro: "Código incorreto. Tente novamente." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Marcar como verificado
      await supabase
        .from("psicossocial_otp_verificacao")
        .update({ verificado: true, verificado_em: new Date().toISOString() })
        .eq("id", otp.id);

      // NÃO registrar telefone como usado aqui — só após o questionário ser concluído.
      // Isso evita que respondentes que abandonem antes de finalizar fiquem bloqueados.
      return new Response(
        JSON.stringify({ sucesso: true, telefone_hash: telefoneHash }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    return new Response(
      JSON.stringify({ erro: "Ação inválida" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Erro OTP:", err);
    return new Response(
      JSON.stringify({ erro: err.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
