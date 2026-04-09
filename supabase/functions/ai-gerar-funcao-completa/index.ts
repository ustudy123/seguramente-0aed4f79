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
    const { descricao_livre, cargo_id } = await req.json();

    if (!descricao_livre || descricao_livre.trim().length < 3) {
      throw new Error("Descrição da função é obrigatória");
    }

    const companyContext = await getCompanyContext(supabase, tenantId);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `Você é um consultor sênior de RH, Gestão de Pessoas e SST (Segurança e Saúde do Trabalho).
Sua tarefa é gerar uma estrutura COMPLETA de função/cargo a partir de uma descrição livre.

${companyContext}

Retorne APENAS um JSON válido (sem markdown, sem code blocks, sem explicações) com a seguinte estrutura:

{
  "nome": "Nome do Cargo",
  "nivel": "operacional|tatico|estrategico",
  "descricao": "Descrição geral do cargo (1-2 parágrafos)",
  "responsabilidade": "Responsabilidade e escopo da função (2-3 parágrafos detalhados)",
  "subordinacao": "A quem se reporta",
  "interfaces_cargo": "Áreas/cargos com os quais interage",
  "objetivo_funcao": "Objetivo principal da função (1 parágrafo)",
  "escopo_geral": "Lista resumida do escopo de atuação",
  "padroes_execucao": "Padrões e regras de execução da função",
  "cultura_esperada": "Comportamentos e valores esperados",
  "erros_riscos": "Principais erros, riscos e consequências",
  "criterios_sucesso": "Critérios para avaliar sucesso na função",
  "ferramentas_cargo": "Ferramentas, sistemas e equipamentos utilizados",
  "atividades": [
    {
      "nome": "Nome da atividade",
      "descricao": "O que faz e por quê",
      "como": "Como a atividade é executada",
      "resultado_esperado": "Resultado esperado",
      "processo": "Grupo/processo (ex: Contas a Pagar)",
      "frequencia": "diaria|semanal|mensal|eventual",
      "complexidade": "baixa|media|alta",
      "classificacao": "rotineira|critica|excepcional",
      "responsavel_direto": "Quem executa",
      "interfaces": "Com quem interage nesta atividade",
      "consequencia_erro": "O que acontece se errar"
    }
  ],
  "competencias": [
    {
      "nome": "Nome da competência",
      "tipo": "tecnica|comportamental|cognitiva",
      "descricao": "Descrição breve da competência"
    }
  ],
  "indicadores": [
    {
      "nome": "Nome do KPI",
      "descricao": "O que mede",
      "meta": "Meta esperada (ex: >95%)",
      "periodicidade": "diaria|semanal|mensal|trimestral|anual"
    }
  ]
}

REGRAS:
- Gere entre 5-10 atividades relevantes, agrupadas por processo
- Gere entre 6-12 competências (mix de técnicas, comportamentais e cognitivas)
- Gere entre 3-6 indicadores de desempenho mensuráveis
- Use a descrição do setor/CNAE da empresa para contextualizar
- Seja específico e profissional, evite genéricos
- Todos os textos devem ser em português brasileiro`;

    const userPrompt = `Gere a estrutura completa da seguinte função:

"${descricao_livre}"

Considere o contexto da empresa para personalizar atividades, competências e indicadores.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
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
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
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
        'erros_riscos', 'criterios_sucesso', 'ferramentas_cargo'];
      
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
