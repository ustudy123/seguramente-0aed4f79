import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const CICLO_MESES: Record<string, number> = {
  mensal: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

const CICLO_LABEL: Record<string, string> = {
  mensal: "Mensal",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "MERCADOPAGO_ACCESS_TOKEN não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      plano_id,
      plano_nome,
      preco_mensal,
      ciclo,
      email,
      origin,
    } = body as {
      plano_id: string;
      plano_nome: string;
      preco_mensal: number;
      ciclo: string;
      email?: string;
      origin?: string;
    };

    if (!plano_id || !plano_nome || !preco_mensal || !ciclo) {
      return new Response(JSON.stringify({ error: "Parâmetros obrigatórios ausentes" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const meses = CICLO_MESES[ciclo] ?? 1;
    const cicloLabel = CICLO_LABEL[ciclo] ?? ciclo;
    const total = Math.round(preco_mensal * meses * 100) / 100;
    const baseUrl = origin || req.headers.get("origin") || "https://youreyes.com.br";

    const externalReference = `${plano_id}-${ciclo}-${Date.now()}`;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const webhookUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;

    const preference = {
      items: [
        {
          id: `${plano_id}-${ciclo}`,
          title: `YourEyes ${plano_nome} — ${cicloLabel}`,
          description: `Assinatura do plano ${plano_nome} (${cicloLabel}) — R$ ${preco_mensal.toFixed(2)}/mês x ${meses} mês(es)`,
          quantity: 1,
          currency_id: "BRL",
          unit_price: total,
        },
      ],
      payer: email ? { email } : undefined,
      back_urls: {
        success: `${baseUrl}/site?pagamento=sucesso&plano=${plano_id}`,
        failure: `${baseUrl}/site?pagamento=falha&plano=${plano_id}`,
        pending: `${baseUrl}/site?pagamento=pendente&plano=${plano_id}`,
      },
      auto_return: "approved",
      statement_descriptor: "YOUREYES",
      external_reference: externalReference,
      notification_url: webhookUrl,
      metadata: { plano_id, plano_nome, ciclo, preco_mensal, meses },
    };

    const idempotencyKey = crypto.randomUUID();
    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(preference),
    });

    const mpJson = await mpRes.json();
    if (!mpRes.ok) {
      console.error("Erro Mercado Pago:", mpJson);
      return new Response(
        JSON.stringify({ error: "Erro ao criar preferência no Mercado Pago", detail: mpJson }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const isTest = accessToken.startsWith("TEST-");
    const checkoutUrl = isTest ? mpJson.sandbox_init_point : mpJson.init_point;

    return new Response(
      JSON.stringify({
        checkout_url: checkoutUrl,
        preference_id: mpJson.id,
        sandbox: isTest,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Erro mercadopago-checkout:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
