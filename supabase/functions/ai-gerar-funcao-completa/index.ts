import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCompanyContext } from '../_shared/ai-helper.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function persistirResultado(supabase: any, tenantId: string, cargoId: string, parsed: any) {
  // Update cargo fields
  const cargoUpdate: Record<string, unknown> = {};
  const fields = ['descricao', 'responsabilidade', 'subordinacao', 'interfaces_cargo',
    'objetivo_funcao', 'escopo_geral', 'padroes_execucao', 'cultura_esperada',
    'erros_riscos', 'criterios_sucesso', 'ferramentas_cargo', 'requisitos_formacao', 'requisitos_experiencia'];
  for (const f of fields) {
    if (parsed[f]) cargoUpdate[f] = parsed[f];
  }
  if (parsed.nivel) cargoUpdate['nivel'] = parsed.nivel;

  if (Object.keys(cargoUpdate).length > 0) {
    await supabase.from("cargos").update(cargoUpdate).eq("id", cargoId);
  }

  if (parsed.atividades?.length) {
    for (const atv of parsed.atividades) {
      const { data: atvData } = await supabase.from("funcao_atividades").insert({
        tenant_id: tenantId,
        cargo_id: cargoId,
        nome: atv.nome,
        descricao: atv.descricao || null,
        como: atv.como || null,
        resultado_esperado: atv.resultado_esperado || null,
        processo: atv.processo || null,
        frequencia: atv.frequencia || "diaria",
        complexidade: atv.complexidade || "media",
        classificacao: atv.classificacao || "rotineira",
      }).select("id").single();

      if (atvData && (atv.responsavel_direto || atv.interfaces || atv.consequencia_erro)) {
        await supabase.from("funcao_responsabilidades").insert({
          tenant_id: tenantId,
          atividade_id: atvData.id,
          responsavel_direto: atv.responsavel_direto || null,
          interfaces: atv.interfaces || null,
          consequencia_erro: atv.consequencia_erro || null,
        });
      }
    }
  }

  if (parsed.competencias?.length) {
    for (const comp of parsed.competencias) {
      await supabase.from("funcao_competencias").insert({
        tenant_id: tenantId,
        cargo_id: cargoId,
        nome: comp.nome,
        tipo: comp.tipo || "tecnica",
        descricao: comp.descricao || null,
      });
    }
  }

  if (parsed.indicadores?.length) {
    for (const ind of parsed.indicadores) {
      await supabase.from("funcao_indicadores").insert({
        tenant_id: tenantId,
        cargo_id: cargoId,
        nome: ind.nome,
        descricao: ind.descricao || null,
        meta: ind.meta || null,
        periodicidade: ind.periodicidade || "mensal",
      });
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = authHeader.replace("Bearer ", "");

    // Decode JWT payload (the Supabase gateway already validated the apikey)
    let userId: string;
    try {
      const payload = JSON.parse(
        atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
      );
      userId = payload.sub;
      if (!userId) throw new Error("missing sub");
      if (payload.exp && payload.exp * 1000 < Date.now()) throw new Error("token expired");
    } catch (e) {
      throw new Error("Unauthorized: " + (e as Error).message);
    }

    const supabase = createClient(supabaseUrl, serviceKey);


    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", userId)
      .single();
    if (!profile?.tenant_id) throw new Error("Tenant not found");

    const tenantId = profile.tenant_id;

    const body = await req.json();
    const { descricao_livre, cargo_id, persistir = true, dados } = body;

    // MODO 2: Persistir dados já prontos (vindos da tela de preview editada)
    if (dados && cargo_id) {
      await persistirResultado(supabase, tenantId, cargo_id, dados);
      return new Response(JSON.stringify({ resultado: dados, persistido: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!descricao_livre || descricao_livre.trim().length < 3) {
      throw new Error("Descrição da função é obrigatória");
    }

    const companyContext = await getCompanyContext(supabase, tenantId);

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

    const systemPrompt = `Você é um consultor sênior de RH e especialista em Desenvolvimento Humano Organizacional (DHO).
Sua tarefa é gerar uma descrição de cargo EXTREMAMENTE DETALHADA e PROFISSIONAL, adequada para manuais de cargos de empresas de alta performance.

${companyContext}

Instruções Adicionais de Contexto:
- Use uma linguagem corporativa polida, técnica e assertiva.
- Evite generalismos. Se a empresa é do setor industrial, as atividades devem refletir o ambiente fabril. Se é tecnologia, devem refletir metodologias ágeis, etc.
- A "Missão do Cargo" deve ser inspiradora e estratégica.
- As "Atividades" devem ser descritas com o método: O QUE FAZ + COMO FAZ + PARA QUE FAZ.

Retorne APENAS um JSON válido (sem markdown, sem code blocks, sem explicações) com a seguinte estrutura:

{
  "nome": "Nome do Cargo",
  "nivel": "operacional|tatico|estrategico",
  "descricao": "Descrição sumária detalhada (mínimo 3 parágrafos)",
  "responsabilidade": "Responsabilidades e escopo detalhado de autoridade e decisão (mínimo 2 parágrafos)",
  "requisitos_formacao": "Escolaridade e cursos técnicos/superiores exigidos",
  "requisitos_experiencia": "Tempo de experiência e vivências anteriores necessárias",
  "subordinacao": "Estrutura de reporte (ex: Reporta-se ao Diretor de Operações)",
  "interfaces_cargo": "Principais stakeholders internos e externos com quem interage",
  "objetivo_funcao": "Missão/Objetivo estratégico principal do cargo",
  "escopo_geral": "Áreas de influência e limites de atuação",
  "padroes_execucao": "Normas, metodologias e padrões de qualidade a serem seguidos",
  "cultura_esperada": "Fit cultural e comportamentos exemplares esperados",
  "erros_riscos": "Análise de riscos do cargo e impactos de falhas operacionais ou estratégicas",
  "criterios_sucesso": "Indicadores qualitativos de que o ocupante está performando bem",
  "ferramentas_cargo": "Sistemas (ERP/CRM), ferramentas físicas e softwares específicos",
  "atividades": [
    {
      "nome": "Nome da atividade (verbo no infinitivo)",
      "descricao": "Descrição detalhada do O QUE e PARA QUE",
      "como": "Passo a passo ou método de execução (COMO)",
      "resultado_esperado": "Entregável ou evidência de conclusão",
      "processo": "Macroprocesso ao qual pertence (ex: Gestão de Talentos)",
      "frequencia": "diaria|semanal|mensal|eventual",
      "complexidade": "baixa|media|alta",
      "classificacao": "rotineira|critica|excepcional",
      "responsavel_direto": "Nível de autonomia na execução",
      "interfaces": "Quem apoia ou é consultado nesta tarefa",
      "consequencia_erro": "Impacto imediato de falha nesta atividade"
    }
  ],
  "competencias": [
    {
      "nome": "Nome da competência",
      "tipo": "tecnica|comportamental|cognitiva",
      "descricao": "Definição clara do comportamento ou conhecimento esperado"
    }
  ],
  "indicadores": [
    {
      "nome": "KPI (Nome claro)",
      "descricao": "O que mede e por que é importante",
      "meta": "Exemplo de meta aceitável (ex: Redução de 10% no turnover)",
      "periodicidade": "diaria|semanal|mensal|trimestral|anual"
    }
  ]
}

REGRAS CRÍTICAS DE COBERTURA (LEIA COM ATENÇÃO):
- COBERTURA TOTAL: Se o usuário fornecer uma descrição detalhada com listas, tópicos, bullets ou subitens (ex: "Admissão", "Desligamento", "Compras", "Benefícios", "LGPD", "ASOs", "Atestados", "Periódicos"), você DEVE criar UMA atividade separada para CADA item mencionado. NÃO agrupe, NÃO resuma, NÃO omita nenhum item citado pelo usuário.
- Se a descrição do usuário tiver 50 subitens, gere 50+ atividades. Se tiver 100, gere 100+.
- Percorra a descrição do usuário do início ao fim e faça um "checklist mental" garantindo que TODO tópico/subitem virou uma atividade no JSON.
- Além dos itens explícitos, adicione atividades complementares relacionadas ao cargo que não foram citadas mas são inerentes à função.
- Mínimo ABSOLUTO de 8 atividades (mas SEMPRE prefira cobrir todos os itens do texto do usuário).
- Mínimo de 10 competências (Soft + Hard skills).
- Mínimo de 5 indicadores (KPIs) realistas e mensuráveis; se o usuário listar KPIs, inclua TODOS.
- Use a descrição do setor/CNAE da empresa para contextualizar profundamente.
- Tudo em Português (Brasil).
- Respeite rigorosamente o CONTEXTO DA EMPRESA fornecido.
- Seja conciso nos campos de texto (descricao, como, resultado_esperado ~1-2 frases cada) para caber TODAS as atividades sem truncar o JSON.`;

    const userPrompt = `Gere a estrutura completa da seguinte função:

"${descricao_livre}"

IMPORTANTE:
1. Integre o contexto da empresa (Cultura, Setor, CNAE) para que as atividades não sejam genéricas.
2. COBERTURA TOTAL: cada item, bullet, tópico ou subitem citado acima DEVE virar uma atividade específica no array "atividades". Não agrupe, não resuma, não pule nenhum. Ao final, revise mentalmente se todos os itens do texto foram contemplados.`;


    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        max_tokens: 16000,
        temperature: 0.4,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em breve." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Limite da API OpenAI atingido. Verifique o saldo/limites da chave." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      throw new Error(`AI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content?.trim() || "";

    // Sanitize markdown fences
    if (content.startsWith("```")) {
      content = content.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?\s*```\s*$/, "");
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("A IA não retornou um JSON válido. Tente novamente.");
    }

    // Persist only when explicitly requested (default true for backward compat)
    if (cargo_id && persistir) {
      await persistirResultado(supabase, tenantId, cargo_id, parsed);
    }

    return new Response(JSON.stringify({ resultado: parsed, persistido: !!(cargo_id && persistir) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
