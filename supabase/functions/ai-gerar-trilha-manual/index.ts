import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCompanyContext } from '../_shared/ai-helper.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();
    if (!profile?.tenant_id) throw new Error("Tenant not found");

    const tenantId = profile.tenant_id;
    const { cargo_id } = await req.json();

    if (!cargo_id) throw new Error("Cargo ID is required");

    const companyContext = await getCompanyContext(supabase, tenantId);

    // Fetch cargo data
    const { data: cargo } = await supabase
      .from("cargos")
      .select("*")
      .eq("id", cargo_id)
      .single();

    if (!cargo) throw new Error("Cargo not found");

    // Fetch related manual data
    const [atividadesRes, competenciasRes, episRes, responsabilidadesRes, indicadoresRes] = await Promise.all([
      supabase.from("funcao_atividades").select("*").eq("tenant_id", tenantId).eq("cargo_id", cargo_id),
      supabase.from("funcao_competencias").select("*").eq("tenant_id", tenantId).eq("cargo_id", cargo_id),
      supabase.from("funcao_epi_vinculacoes").select("*").eq("tenant_id", tenantId).eq("cargo_id", cargo_id),
      supabase.from("funcao_responsabilidades").select("*").eq("tenant_id", tenantId),
      supabase.from("funcao_indicadores").select("*").eq("tenant_id", tenantId).eq("cargo_id", cargo_id),
    ]);

    const atividades = atividadesRes.data || [];
    const competencias = competenciasRes.data || [];
    const indicators = indicadoresRes.data || [];

    const manualContext = `
Cargo: ${cargo.nome}
Descrição: ${cargo.descricao || ''}
Objetivo: ${cargo.objetivo_funcao || ''}
Escopo Geral: ${cargo.escopo_geral || ''}

Atividades:
${atividades.map(a => `- ${a.nome}: ${a.descricao || ''} (Como: ${a.como || ''})`).join('\n')}

Competências:
${competencias.map(c => `- ${c.nome} (${c.tipo}): ${c.descricao || ''}`).join('\n')}

Indicadores (KPIs):
${indicators.map(i => `- ${i.nome}: ${i.descricao || ''}`).join('\n')}
`;

    const prompt = `Você é um especialista em Treinamento e Desenvolvimento (T&D). 
Com base no Manual de Função abaixo, gere uma TRILHA DE APRENDIZAGEM completa e estruturada para treinar um novo colaborador nessa função.

CONTEXTO DA EMPRESA:
${companyContext}

DADOS DO MANUAL DE FUNÇÃO:
${manualContext}

INSTRUÇÕES:
1. Gere uma trilha com pelo menos 4-6 módulos.
2. Cada módulo deve ter um objetivo claro e conteúdo relevante.
3. Inclua pelo menos um QUIZ ao final da trilha para validar o aprendizado.
4. O conteúdo deve ser didático e prático, focado no que o colaborador precisa SABER e FAZER.
5. Tipos de módulos permitidos: "video", "pdf", "link", "apresentacao", "conteudo_interno", "quiz", "atividade_pratica", "checklist", "reflexao", "estudo_caso", "microdesafio".

RETORNO ESPERADO (JSON APENAS):
{
  "nome": "Trilha de Treinamento: ${cargo.nome}",
  "descricao": "Trilha completa para capacitação na função de ${cargo.nome}, cobrindo atividades, competências e padrões esperados.",
  "objetivo": "Capacitar o colaborador para executar com excelência as responsabilidades do cargo.",
  "tipo": "tecnica",
  "prioridade": "obrigatoria",
  "modulos": [
    {
      "titulo": "Introdução à Função",
      "descricao": "Visão geral do papel e importância estratégica.",
      "objetivo": "Alinhamento de expectativas e visão macro.",
      "tipo": "conteudo_interno",
      "conteudo_texto": "Texto rico com orientações...",
      "tempo_estimado_min": 15,
      "pontuacao": 10,
      "ordem": 1
    },
    {
      "titulo": "Processos e Atividades Chave",
      "descricao": "Detalhamento de como executar as principais tarefas.",
      "objetivo": "Domínio técnico operacional.",
      "tipo": "microdesafio",
      "conteudo_texto": "Instruções do desafio...",
      "tempo_estimado_min": 30,
      "pontuacao": 20,
      "ordem": 2
    },
    {
      "titulo": "Avaliação de Conhecimento",
      "descricao": "Quiz para validar os pontos principais.",
      "objetivo": "Certificar o entendimento.",
      "tipo": "quiz",
      "tempo_estimado_min": 10,
      "pontuacao": 50,
      "ordem": 3,
      "quiz_perguntas": [
        {
          "pergunta": "Qual a principal responsabilidade do cargo?",
          "opcoes": ["Opção A", "Opção B", "Opção C", "Opção D"],
          "resposta_correta": 0
        }
      ]
    }
  ]
}

Retorne APENAS o JSON, sem markdown ou explicações.`;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um especialista em T&D. Gere apenas JSON puro para trilhas de aprendizagem." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(`AI Gateway error: ${aiResponse.status} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content?.trim() || "";

    // Limpar markdown se houver
    if (content.startsWith("```")) {
      content = content.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?\s*```\s*$/, "");
    }

    const trailData = JSON.parse(content);

    return new Response(JSON.stringify(trailData), {
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