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

    const { descricao_livre, cargo_id } = await req.json();

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

REGRAS CRÍTICAS:
- Mínimo de 8 atividades detalhadas.
- Mínimo de 10 competências (divididas entre Soft e Hard skills).
- Mínimo de 5 indicadores de performance (KPIs) realistas e mensuráveis.
- Use a descrição do setor/CNAE da empresa para contextualizar profundamente.
- Tudo em Português (Brasil).
- Respeite rigorosamente o CONTEXTO DA EMPRESA fornecido.`;

    const userPrompt = `Gere a estrutura completa da seguinte função:

"${descricao_livre}"

IMPORTANTE: Integre o contexto da empresa (Cultura, Setor, CNAE) para que as atividades e competências não sejam genéricas, mas sim específicas para esta organização.`;


    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
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

    // If cargo_id is provided, persist data directly
    if (cargo_id) {
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
        await supabase.from("cargos").update(cargoUpdate).eq("id", cargo_id);
      }

      // Create activities
      if (parsed.atividades?.length) {
        for (const atv of parsed.atividades) {
          const { data: atvData } = await supabase.from("funcao_atividades").insert({
            tenant_id: tenantId,
            cargo_id: cargo_id,
            nome: atv.nome,
            descricao: atv.descricao || null,
            como: atv.como || null,
            resultado_esperado: atv.resultado_esperado || null,
            processo: atv.processo || null,
            frequencia: atv.frequencia || "diaria",
            complexidade: atv.complexidade || "media",
            classificacao: atv.classificacao || "rotineira",
          }).select("id").single();

          // Create responsibility
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

      // Create competencies
      if (parsed.competencias?.length) {
        for (const comp of parsed.competencias) {
          await supabase.from("funcao_competencias").insert({
            tenant_id: tenantId,
            cargo_id: cargo_id,
            nome: comp.nome,
            tipo: comp.tipo || "tecnica",
            descricao: comp.descricao || null,
          });
        }
      }

      // Create indicators
      if (parsed.indicadores?.length) {
        for (const ind of parsed.indicadores) {
          await supabase.from("funcao_indicadores").insert({
            tenant_id: tenantId,
            cargo_id: cargo_id,
            nome: ind.nome,
            descricao: ind.descricao || null,
            meta: ind.meta || null,
            periodicidade: ind.periodicidade || "mensal",
          });
        }
      }
    }

    return new Response(JSON.stringify({ resultado: parsed, persistido: !!cargo_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
