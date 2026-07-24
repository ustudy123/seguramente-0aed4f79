import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface FatorEntrada {
  fator_id: string;
  fator: string;
  nivel_gro: "trivial" | "baixo" | "medio" | "alto" | "critico";
  score: number;
  dimensoes?: string[];
  norma?: string;
}

interface Body {
  ghe_nome: string;
  respondentes: number;
  composicao?: string[];
  instrumento?: string;
  fatores: FatorEntrada[];
  /** Quantas opções gerar por fator. */
  opcoes_por_fator?: number;
}

const PRAZO_DIAS: Record<string, number> = {
  critico: 30,
  alto: 60,
  medio: 90,
  baixo: 180,
  trivial: 0,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

    const body: Body = await req.json();
    const {
      ghe_nome,
      respondentes,
      composicao = [],
      instrumento = "COPSOQ",
      fatores = [],
      opcoes_por_fator = 3,
    } = body;

    if (fatores.length === 0) {
      return new Response(JSON.stringify({ sugestoes: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const listaFatores = fatores
      .map(
        (f) =>
          `- id="${f.fator_id}" | fator="${f.fator}" | nível GRO=${f.nivel_gro.toUpperCase()} | score de risco=${f.score}%` +
          (f.dimensoes?.length ? ` | dimensões=${f.dimensoes.join(", ")}` : "") +
          (f.norma ? ` | base normativa=${f.norma}` : "") +
          ` | prazo máximo=${PRAZO_DIAS[f.nivel_gro] || "sem prazo (registro documental)"} dias`,
      )
      .join("\n");

    const prompt = `
Você é especialista em saúde e segurança ocupacional, com domínio de NR-01 (GRO/PGR),
NR-17 e ISO 45003, atuando na elaboração de planos de ação para riscos psicossociais.

CONTEXTO
Grupo Homogêneo de Exposição (GHE): ${ghe_nome}
Respondentes do GHE: ${respondentes}
${composicao.length ? `Composição: ${composicao.join("; ")}` : ""}
Instrumento aplicado: ${instrumento}

FATORES DE RISCO IDENTIFICADOS
${listaFatores}

TAREFA
Para CADA fator acima, proponha ${opcoes_por_fator} ações DISTINTAS entre si, no formato 5W2H.
As opções devem representar abordagens realmente diferentes (ex.: uma organizacional,
uma de capacitação, uma de acompanhamento), não variações da mesma ideia.

REGRAS
- "o_que": a ação a ser executada. Verbo no infinitivo, específico e verificável.
- "quem": o papel responsável (ex.: "RH e liderança do setor", "SESMT", "Gestor imediato").
  Não invente nomes de pessoas.
- "onde": o meio ou local onde a ação acontece (ex.: "Reuniões quinzenais da equipe",
  "Plataforma de treinamento corporativa").
- "por_que": a justificativa técnica, ancorada no fator e no nível de risco.
- "como": o método de execução, em 1 ou 2 frases práticas.
- "quanto": o tipo de recurso necessário. Use uma das formas: "Tempo interno",
  "Tempo interno + custo baixo", "Investimento financeiro", "Sem custo direto".
  Se envolver custo, indique a natureza (ex.: "Investimento financeiro — consultoria externa").
- Priorize controles ORGANIZACIONAIS sobre individuais: a NR-01 exige atuar na fonte
  do risco, não apenas no indivíduo.
- Não proponha intervenção clínica, diagnóstico ou tratamento de saúde mental.
- Português brasileiro. Máximo 220 caracteres por campo.

FORMATO DE SAÍDA
Responda SOMENTE com JSON válido, sem markdown, sem cercas de código, no formato:
{"sugestoes":[{"fator_id":"...","opcoes":[{"o_que":"...","quem":"...","onde":"...","por_que":"...","como":"...","quanto":"..."}]}]}
`.trim();

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Você responde exclusivamente com JSON válido, sem markdown e sem texto fora do objeto.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const detalhe = await resp.text();
      throw new Error(`Falha na OpenAI (${resp.status}): ${detalhe.slice(0, 300)}`);
    }

    const data = await resp.json();
    const bruto = data.choices?.[0]?.message?.content ?? "{}";
    const limpo = bruto.replace(/```json|```/g, "").trim();

    let parsed: { sugestoes?: unknown };
    try {
      parsed = JSON.parse(limpo);
    } catch {
      throw new Error("A IA devolveu um JSON inválido. Tente novamente.");
    }

    // Só devolve fatores que realmente foram pedidos — evita a IA inventar ids.
    const idsValidos = new Set(fatores.map((f) => f.fator_id));
    const sugestoes = Array.isArray(parsed.sugestoes)
      ? (parsed.sugestoes as Array<{ fator_id?: string; opcoes?: unknown }>).filter(
          (s) => s.fator_id && idsValidos.has(s.fator_id) && Array.isArray(s.opcoes),
        )
      : [];

    return new Response(JSON.stringify({ sugestoes }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
