// Assinatura recorrente do PLANO (Mercado Pago preapproval).
//
// Substitui o mercadopago-checkout (pagamento único) para novos clientes:
// cria uma assinatura que recorre no ciclo escolhido — mensal (1), trimestral
// (3), semestral (6) ou anual (12) — cobrando o TOTAL DO CICLO e renovando
// sozinha. O mercadopago-checkout antigo segue existindo para não quebrar
// nada; o site passa a chamar esta função.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const CICLO_MESES: Record<string, number> = { mensal: 1, trimestral: 3, semestral: 6, anual: 12 };
const CICLO_LABEL: Record<string, string> = {
  mensal: "Mensal", trimestral: "Trimestral", semestral: "Semestral", anual: "Anual",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) return json({ error: "MERCADOPAGO_ACCESS_TOKEN não configurado" }, 500);

    const body = await req.json();
    const { plano_id, plano_nome, preco_mensal, ciclo, email, origin, ref_codigo } = body as {
      plano_id: string; plano_nome: string; preco_mensal: number; ciclo: string;
      email?: string; origin?: string; ref_codigo?: string;
    };
    if (!plano_id || !plano_nome || !preco_mensal || !ciclo) {
      return json({ error: "Parâmetros obrigatórios ausentes" }, 400);
    }

    const meses = CICLO_MESES[ciclo] ?? 1;
    const cicloLabel = CICLO_LABEL[ciclo] ?? ciclo;
    const totalCiclo = Math.round(preco_mensal * meses * 100) / 100; // total cobrado por ciclo
    const baseUrl = origin || req.headers.get("origin") || "https://youreyes.com.br";
    const externalReference = `plano-${plano_id}-${ciclo}-${Date.now()}`;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const webhookUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;

    // Assinatura recorrente: cobra o total do ciclo a cada N meses.
    const preapprovalBody: Record<string, unknown> = {
      reason: `YourEyes ${plano_nome} — ${cicloLabel}`,
      external_reference: externalReference,
      payer_email: email,
      back_url: `${baseUrl}/site?pagamento=sucesso&plano=${plano_id}`,
      auto_recurring: {
        frequency: meses,
        frequency_type: "months",
        transaction_amount: totalCiclo,
        currency_id: "BRL",
      },
      status: "pending",
      notification_url: webhookUrl,
    };

    const res = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify(preapprovalBody),
    });
    const mpJson = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[mp-subscription] MP erro:", mpJson);
      return json({ error: "Erro ao criar assinatura no Mercado Pago", detail: mpJson }, 502);
    }

    const isTest = accessToken.startsWith("TEST-");
    const checkoutUrl = mpJson.init_point || mpJson.sandbox_init_point;

    // Registro pendente da assinatura (subscription_type = recurring)
    try {
      const supabase = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
      await supabase.from("assinaturas").insert({
        plano_id, plano_nome, ciclo,
        preco_mensal,
        valor_total: totalCiclo,
        meses,
        status: "pending",
        payer_email: email ?? null,
        external_reference: externalReference,
        mp_preapproval_id: mpJson.id ?? null,
        subscription_type: "recurring",
        ref_codigo: ref_codigo ?? null,
      });
    } catch (e) {
      console.error("[mp-subscription] registrar pendente:", e);
    }

    return json({ checkout_url: checkoutUrl, preapproval_id: mpJson.id, sandbox: isTest }, 200);
  } catch (err) {
    console.error("[mp-subscription] erro:", err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
