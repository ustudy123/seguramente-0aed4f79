import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

    const { image_base64 } = await req.json();

    if (!image_base64) {
      return new Response(
        JSON.stringify({ error: "Nenhuma imagem enviada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Você é um especialista em leitura de documentos fiscais brasileiros (NF-e, cupom fiscal, recibo, DANFE, etc).

Analise a imagem e extraia TODOS os dados possíveis. Responda APENAS com um JSON válido sem markdown, no formato:

{
  "tipo_documento": "cupom_fiscal" | "nfe" | "danfe" | "recibo" | "outro",
  "numero_nf": "número do documento",
  "serie": "série se houver",
  "data_emissao": "YYYY-MM-DD",
  "fornecedor_nome": "nome do estabelecimento/fornecedor",
  "fornecedor_cnpj": "CNPJ se visível",
  "valor_total": 0.00,
  "chave_acesso": "chave de acesso se visível",
  "itens": [
    {
      "descricao": "descrição do produto",
      "quantidade": 1,
      "valor_unitario": 0.00,
      "valor_total": 0.00
    }
  ],
  "observacoes": "qualquer info adicional relevante"
}

REGRAS:
1. Se não conseguir ler algum campo, use null.
2. Valores monetários devem ser números (não strings).
3. Data no formato YYYY-MM-DD.
4. Extraia TODOS os itens visíveis.
5. Se a imagem não for um documento fiscal, retorne {"error": "Imagem não é um documento fiscal válido"}.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia todos os dados deste documento fiscal:" },
              {
                type: "image_url",
                image_url: { url: image_base64 },
              },
            ],
          },
        ],
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: `Erro na API OpenAI: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await response.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";

    let cleanedContent = aiContent.trim();
    if (cleanedContent.startsWith("```")) {
      cleanedContent = cleanedContent.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }

    let parsed;
    try {
      parsed = JSON.parse(cleanedContent);
    } catch {
      console.error("Failed to parse AI response:", cleanedContent);
      return new Response(
        JSON.stringify({ error: "Erro ao interpretar resposta da IA", raw: cleanedContent }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (parsed.error) {
      return new Response(
        JSON.stringify({ error: parsed.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("ai-nf-ocr error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
