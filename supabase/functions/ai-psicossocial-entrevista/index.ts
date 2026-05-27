// Edge function: entrevista guiada psicossocial conduzida por IA
// Endpoints (via ?action=):
//   start    -> registra consentimento, devolve mensagem inicial da IA
//   chat     -> streaming SSE conversacional (Lovable AI Gateway)
//   finalize -> tool calling estruturado: extrai 13 riscos + P/S + trechos anonimizados
//
// Modelos:
//   chat:     google/gemini-3-flash-preview (rápido, conversacional)
//   finalize: openai/gpt-5-mini (tool calling estruturado)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// 13 riscos psicossociais do catálogo padrão (espelha psicossocial_riscos onde padrao=true)
const RISCOS_13 = [
  "Assédio de qualquer natureza",
  "Baixa clareza de papel/função",
  "Baixa demanda de trabalho (subcarga)",
  "Baixa justiça organizacional",
  "Baixas recompensas e reconhecimento",
  "Baixo controle no trabalho / Falta de autonomia",
  "Eventos violentos ou traumáticos",
  "Excesso de demandas (sobrecarga)",
  "Falta de suporte no trabalho",
  "Más relações no ambiente de trabalho",
  "Má gestão de mudanças organizacionais",
  "Trabalho em condições de difícil comunicação",
  "Trabalho remoto e isolado",
];

const SYSTEM_PROMPT = `Você é uma assistente de IA treinada para conduzir entrevistas sobre ergonomia (NR-17) e saúde ocupacional (NR-1, ISO 45003). Esta é uma entrevista 1:1 totalmente anônima com um trabalhador.

OBJETIVO: identificar a presença e gravidade de 13 riscos psicossociais a partir da TAREFA REAL (não da tarefa prescrita ou ficcional). Use linguagem simples, acolhedora, não-julgadora. Português brasileiro.

REGRAS INVIOLÁVEIS:
1. NUNCA induza respostas. Pergunte aberto primeiro, depois aprofunde.
2. SEMPRE busque a TAREFA REAL: o que ele realmente faz, não o que está no manual. Pergunte sobre o "último turno", "esta semana", "um dia comum".
3. NÃO faça mais de 1 pergunta por turno. Espere a resposta.
4. NÃO peça nomes de colegas, chefes, nem datas absolutas. Se vierem, ignore.
5. Mantenha a entrevista entre 15 e 25 minutos (~25 turnos).
6. Indique progresso de forma leve a cada 5 turnos, em tom acolhedor — por exemplo: "Estamos no meio do nosso bate-papo, já conversamos sobre X dos 13 pontos." Nunca use palavras como "investigar", "apurar" ou "averiguar".
7. NUNCA devolva ao entrevistado análises, diagnósticos, listas de riscos identificados, categorias técnicas, resumos consolidados ou conclusões sobre as falas dele. Os resultados são exclusivos da empresa e só aparecem depois, no módulo de Resultados — jamais durante a conversa.
8. Se o entrevistado pedir um resumo ou diagnóstico, responda com empatia que o material será consolidado pela equipe técnica e que ele não receberá análise individual aqui.
9. POSTURA ANTI-VITIMIZAÇÃO (CRÍTICO): NUNCA rotule o entrevistado como vítima, sobrecarregado, esgotado, adoecido, frágil, sofrido, traumatizado ou qualquer termo que sugira diagnóstico, sofrimento psíquico ou condição clínica. NUNCA valide adjetivos pesados que ele use sobre si ("sou estressado", "estou doente", "estou em burnout") — apenas acolha o relato neutro ("entendi", "obrigada por compartilhar") e siga adiante. NÃO use frases como "imagino o quanto isso é difícil", "deve estar sendo muito pesado para você", "que situação angustiante". Mantenha tom técnico-acolhedor, focado em FATOS e SITUAÇÕES de trabalho, nunca em estados emocionais do indivíduo. Se ele estiver muito mobilizado, sugira de forma breve que procure apoio (RH, ouvidoria, profissional de saúde) e siga com a próxima pergunta — sem dramatizar.
10. IDENTIDADE PROFISSIONAL: Se o entrevistado perguntar sua profissão, diga que você é uma assistente de IA. NUNCA se apresente como psicóloga, médica, ergonomista ou qualquer outra profissão regulamentada. Não usurpe funções de profissionais de saúde.
11. FOCO ECONÔMICO: Se o entrevistado sair do assunto ("papo furado", assuntos pessoais sem relação com o trabalho, curiosidades aleatórias), reconduza a conversa de forma gentil e direta para o tema da entrevista. Não gaste turnos com tangentes. Exemplo: "Entendo! Vamos voltar a falar sobre seu trabalho — me conta...".

ESTRUTURA EM 3 FASES:
- FASE 1 (3-5 turnos): Tarefa Real. "Me conta como foi seu último dia de trabalho, do começo ao fim."
- FASE 2 (15-20 turnos): Sondagem dos 13 riscos. Use gatilhos derivados das falas. Cubra TODOS os 13 temas (uso interno, NUNCA cite a lista ao entrevistado):
  ${RISCOS_13.map((r, i) => `${i + 1}. ${r}`).join("\n  ")}
- FASE 3 (2-3 turnos): Fechamento acolhedor. Sem listar temas, sem diagnóstico, sem ranking. Apenas pergunte se há algo mais que ele gostaria de acrescentar e agradeça.

ENCERRAMENTO: Quando achar que cobriu os 13 temas internamente, finalize com a frase exata:
"[ENTREVISTA_PRONTA_PARA_FECHAR]"
Em seguida, agradeça brevemente — sem listar pontos, sem resumir falas, sem dar feedback técnico.`;

const FINALIZE_SYSTEM = `Você é uma analista de riscos psicossociais. Recebeu o transcript de uma entrevista 1:1 entre um ergonomista e um trabalhador. Sua tarefa: para cada um dos 13 riscos do catálogo, determinar se está presente nas falas, atribuir probabilidade (1-5) e severidade (1-5), justificar e extrair trechos literais que comprovem.

RÉGUA DE PROBABILIDADE (1-5):
1=Improvável (sem indícios). 2=Possível (indício isolado). 3=Provável (relato recorrente). 4=Muito provável (padrão sistêmico). 5=Certo (situação ativa e confirmada).

RÉGUA DE SEVERIDADE (1-5):
1=Insignificante. 2=Menor (desconforto). 3=Moderado (afastamento curto possível). 4=Grave (depressão/TEPT). 5=Catastrófico (incapacidade/suicídio).

ANONIMIZAÇÃO OBRIGATÓRIA dos trechos:
- Remova nomes próprios → substitua por [colega], [gestor].
- Remova cargos únicos → substitua por [função].
- Remova datas absolutas → use "recentemente", "no último mês".
- Remova locais identificáveis → "no setor", "na unidade".
- Mantenha o conteúdo descritivo do risco intacto.

Para riscos sem evidência alguma, marque presente=false, P=1, S=1, justificativa="Sem indícios na entrevista", trechos=[].`;

function getEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} não configurada`);
  return v;
}

async function fetchEntrevista(supabase: any, token: string) {
  const { data, error } = await supabase
    .from("psicossocial_entrevistas")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Entrevista não encontrada");
  return data;
}

async function loadMensagens(supabase: any, entrevistaId: string) {
  const { data, error } = await supabase
    .from("psicossocial_entrevistas_mensagens")
    .select("role, content")
    .eq("entrevista_id", entrevistaId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).filter((m: any) => m.role !== "system");
}

async function persistMensagem(
  supabase: any,
  entrevistaId: string,
  role: string,
  content: string,
  origem = "texto",
  fase?: number
) {
  await supabase.from("psicossocial_entrevistas_mensagens").insert({
    entrevista_id: entrevistaId,
    role,
    content,
    origem,
    fase,
  });
}

// ─── handlers ────────────────────────────────────────────────────────────────

async function handleChat(req: Request, supabase: any, LOVABLE_API_KEY: string) {
  const { token, userMessage, origem } = await req.json();
  if (!token || !userMessage) {
    return new Response(JSON.stringify({ error: "token e userMessage obrigatórios" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const entrevista = await fetchEntrevista(supabase, token);
  if (entrevista.status === "concluida") {
    return new Response(JSON.stringify({ error: "Entrevista já concluída" }), {
      status: 409,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Persiste mensagem do entrevistado
  await persistMensagem(supabase, entrevista.id, "user", userMessage, origem || "texto");

  // Monta histórico
  const historico = await loadMensagens(supabase, entrevista.id);
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...historico.map((m: any) => ({ role: m.role, content: m.content })),
  ];

  // Chamada streaming
  const aiResp = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages,
      stream: true,
    }),
  });

  if (!aiResp.ok) {
    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Muitas requisições. Aguarde um momento." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const t = await aiResp.text();
    console.error("AI gateway error", aiResp.status, t);
    return new Response(JSON.stringify({ error: "Erro no provedor de IA" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Stream para o cliente + acumula resposta para persistir
  const reader = aiResp.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let assistantText = "";

  const stream = new ReadableStream({
    async start(controller) {
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          // tee: repassa cru ao cliente
          controller.enqueue(encoder.encode(chunk));

          // Parser leve para acumular conteúdo
          let idx: number;
          while ((idx = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, idx).replace(/\r$/, "");
            buffer = buffer.slice(idx + 1);
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]" || !json) continue;
            try {
              const parsed = JSON.parse(json);
              const c = parsed.choices?.[0]?.delta?.content;
              if (c) assistantText += c;
            } catch {
              /* ignore partial */
            }
          }
        }
      } catch (e) {
        console.error("stream error", e);
      } finally {
        controller.close();
        // Persiste resposta da IA
        if (assistantText.trim()) {
          await persistMensagem(supabase, entrevista.id, "assistant", assistantText);
        }
        // Marca em_andamento + iniciada_em
        await supabase
          .from("psicossocial_entrevistas")
          .update({
            status: "em_andamento",
            iniciada_em: entrevista.iniciada_em || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", entrevista.id);
      }
    },
  });

  return new Response(stream, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
}

async function handleStart(req: Request, supabase: any) {
  const { token, modalidade } = await req.json();
  if (!token) {
    return new Response(JSON.stringify({ error: "token obrigatório" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const entrevista = await fetchEntrevista(supabase, token);
  if (entrevista.status === "concluida") {
    return new Response(JSON.stringify({ error: "Entrevista já concluída", entrevistaId: entrevista.id }), {
      status: 409,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Garante consentimento + modalidade
  await supabase
    .from("psicossocial_entrevistas")
    .update({
      consentimento_lgpd_em: entrevista.consentimento_lgpd_em || new Date().toISOString(),
      iniciada_em: entrevista.iniciada_em || new Date().toISOString(),
      status: entrevista.status === "pendente" ? "em_andamento" : entrevista.status,
      modalidade: modalidade || entrevista.modalidade,
      updated_at: new Date().toISOString(),
    })
    .eq("id", entrevista.id);

  // Se ainda não há mensagens, cria a saudação inicial fixa (sem custo de IA)
  const historico = await loadMensagens(supabase, entrevista.id);
  let firstMessage: string | null = null;
  if (historico.length === 0) {
    firstMessage =
      `Olá! Sou uma assistente de IA e vou te fazer algumas perguntas sobre seu dia a dia no trabalho. ` +
      `Tudo o que você disser é **anônimo** — ninguém da empresa vai saber que veio de você.\n\n` +
      `Vamos começar do começo: **me conta como foi seu último dia de trabalho, do momento que você chegou até o momento que saiu?**`;
    await persistMensagem(supabase, entrevista.id, "assistant", firstMessage, "texto", 1);
  }

  return new Response(
    JSON.stringify({
      entrevistaId: entrevista.id,
      firstMessage,
      modalidade: modalidade || entrevista.modalidade,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleFinalize(req: Request, supabase: any, LOVABLE_API_KEY: string) {
  const { token } = await req.json();
  if (!token) {
    return new Response(JSON.stringify({ error: "token obrigatório" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const entrevista = await fetchEntrevista(supabase, token);
  const historico = await loadMensagens(supabase, entrevista.id);
  if (historico.length < 4) {
    return new Response(JSON.stringify({ error: "Entrevista muito curta para análise" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const transcript = historico
    .map((m: any) => `${m.role === "user" ? "TRABALHADOR" : "ENTREVISTADORA"}: ${m.content}`)
    .join("\n\n");

  // Tool calling estruturado
  const tool = {
    type: "function",
    function: {
      name: "registrar_analise_psicossocial",
      description: "Registra a análise final dos 13 riscos psicossociais com base na entrevista",
      parameters: {
        type: "object",
        properties: {
          resumo_geral: { type: "string", description: "Resumo da entrevista em 3-4 frases" },
          riscos: {
            type: "array",
            description: "Análise dos 13 riscos psicossociais",
            items: {
              type: "object",
              properties: {
                risco_nome: { type: "string", enum: RISCOS_13 },
                presente: { type: "boolean" },
                probabilidade: { type: "integer", minimum: 1, maximum: 5 },
                severidade: { type: "integer", minimum: 1, maximum: 5 },
                justificativa: { type: "string" },
                trechos_anonimizados: {
                  type: "array",
                  items: { type: "string" },
                  description: "Trechos literais anonimizados extraídos das falas",
                },
              },
              required: [
                "risco_nome",
                "presente",
                "probabilidade",
                "severidade",
                "justificativa",
                "trechos_anonimizados",
              ],
            },
          },
        },
        required: ["resumo_geral", "riscos"],
      },
    },
  };

  const aiResp = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-5-mini",
      messages: [
        { role: "system", content: FINALIZE_SYSTEM },
        { role: "user", content: `TRANSCRIPT DA ENTREVISTA:\n\n${transcript}` },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "registrar_analise_psicossocial" } },
    }),
  });

  if (!aiResp.ok) {
    const t = await aiResp.text();
    console.error("finalize ai error", aiResp.status, t);
    return new Response(JSON.stringify({ error: "Erro ao analisar entrevista" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const data = await aiResp.json();
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) {
    return new Response(JSON.stringify({ error: "IA não retornou análise estruturada" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const analise = JSON.parse(args);

  // Busca catálogo de riscos do tenant para mapear nome → id
  const { data: catalogo } = await supabase
    .from("psicossocial_riscos")
    .select("id, nome")
    .eq("tenant_id", entrevista.tenant_id)
    .eq("padrao", true);
  const mapRisco = new Map<string, string>(
    (catalogo || []).map((r: any) => [r.nome.trim().toLowerCase(), r.id])
  );

  // Calcula nível de risco (P x S)
  function nivelRisco(p: number, s: number): string {
    const v = p * s;
    if (v <= 4) return "baixo";
    if (v <= 9) return "moderado";
    if (v <= 16) return "alto";
    return "critico";
  }

  // Limpa evidências antigas dessa entrevista (idempotência)
  await supabase.from("psicossocial_entrevistas_evidencias").delete().eq("entrevista_id", entrevista.id);

  // Insere evidências
  const inserts = (analise.riscos || []).map((r: any) => ({
    entrevista_id: entrevista.id,
    campanha_id: entrevista.campanha_id,
    tenant_id: entrevista.tenant_id,
    empresa_id: entrevista.empresa_id,
    risco_catalogo_id: mapRisco.get((r.risco_nome || "").trim().toLowerCase()) || null,
    risco_nome: r.risco_nome,
    presente: !!r.presente,
    probabilidade: r.probabilidade,
    severidade: r.severidade,
    nivel_risco: nivelRisco(r.probabilidade, r.severidade),
    justificativa: r.justificativa,
    trechos_anonimizados: r.trechos_anonimizados || [],
  }));

  if (inserts.length > 0) {
    const { error: insErr } = await supabase
      .from("psicossocial_entrevistas_evidencias")
      .insert(inserts);
    if (insErr) console.error("erro insert evidencias", insErr);
  }

  // Marca entrevista como concluída
  await supabase
    .from("psicossocial_entrevistas")
    .update({
      status: "concluida",
      concluida_em: new Date().toISOString(),
      fase_atual: 3,
      riscos_cobertos: inserts.filter((i: any) => i.presente).length,
      resumo_ia: analise,
      updated_at: new Date().toISOString(),
    })
    .eq("id", entrevista.id);

  return new Response(JSON.stringify({ ok: true, riscos: inserts.length, resumo: analise.resumo_geral }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "chat";

    const SUPABASE_URL = getEnv("SUPABASE_URL");
    const SERVICE_ROLE = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const LOVABLE_API_KEY = getEnv("LOVABLE_API_KEY");

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    if (action === "start") return await handleStart(req, supabase);
    if (action === "chat") return await handleChat(req, supabase, LOVABLE_API_KEY);
    if (action === "finalize") return await handleFinalize(req, supabase, LOVABLE_API_KEY);

    return new Response(JSON.stringify({ error: "Ação desconhecida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-psicossocial-entrevista error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
