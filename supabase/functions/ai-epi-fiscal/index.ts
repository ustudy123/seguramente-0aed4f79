import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Extract JWT to get tenant
    const token = authHeader?.replace("Bearer ", "");
    let tenantId: string | null = null;

    if (token && token !== Deno.env.get("SUPABASE_ANON_KEY")) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("user_id", user.id)
          .single();
        tenantId = profile?.tenant_id;
      }
    }

    const { tenant_id: bodyTenantId } = await req.json();
    tenantId = tenantId || bodyTenantId;

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: "Tenant não identificado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch EPI data for analysis
    const [entregasRes, movimentacoesRes, tiposRes, episRes] = await Promise.all([
      supabase
        .from("epi_entregas")
        .select("colaborador_nome, colaborador_cpf, colaborador_cargo, colaborador_departamento, quantidade, data_entrega, motivo_entrega, status, data_validade, epi_id")
        .eq("tenant_id", tenantId)
        .order("data_entrega", { ascending: false })
        .limit(500),
      supabase
        .from("epi_movimentacoes")
        .select("tipo, quantidade, motivo, created_at, epi_id")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("epi_tipos")
        .select("id, nome, categoria, ca_numero, validade_meses")
        .eq("tenant_id", tenantId),
      supabase
        .from("epis")
        .select("id, tipo_id, quantidade_estoque, quantidade_minima, data_validade, status")
        .eq("tenant_id", tenantId),
    ]);

    const entregas = entregasRes.data || [];
    const movimentacoes = movimentacoesRes.data || [];
    const tipos = tiposRes.data || [];
    const epis = episRes.data || [];

    // Build summary statistics for the AI
    const entregasPorColaborador: Record<string, { nome: string; cargo: string; depto: string; total: number; motivos: Record<string, number> }> = {};
    entregas.forEach((e: any) => {
      const key = e.colaborador_cpf || e.colaborador_nome;
      if (!entregasPorColaborador[key]) {
        entregasPorColaborador[key] = {
          nome: e.colaborador_nome,
          cargo: e.colaborador_cargo || "N/A",
          depto: e.colaborador_departamento || "N/A",
          total: 0,
          motivos: {},
        };
      }
      entregasPorColaborador[key].total += e.quantidade || 1;
      const motivo = e.motivo_entrega || "Não informado";
      entregasPorColaborador[key].motivos[motivo] = (entregasPorColaborador[key].motivos[motivo] || 0) + 1;
    });

    const entregasPorDepto: Record<string, number> = {};
    entregas.forEach((e: any) => {
      const depto = e.colaborador_departamento || "Sem departamento";
      entregasPorDepto[depto] = (entregasPorDepto[depto] || 0) + (e.quantidade || 1);
    });

    const extraviados = entregas.filter((e: any) => e.status === "extraviado");
    const substituicoesPorDano = entregas.filter((e: any) => 
      e.motivo_entrega && e.motivo_entrega.toLowerCase().includes("dano")
    );
    const substituicoesPorPerda = entregas.filter((e: any) => 
      e.motivo_entrega && e.motivo_entrega.toLowerCase().includes("perda")
    );

    const dataSummary = {
      total_entregas: entregas.length,
      total_movimentacoes: movimentacoes.length,
      total_tipos_epi: tipos.length,
      total_itens_estoque: epis.length,
      entregas_por_colaborador: Object.values(entregasPorColaborador)
        .sort((a: any, b: any) => b.total - a.total)
        .slice(0, 20),
      entregas_por_departamento: entregasPorDepto,
      extraviados: {
        total: extraviados.length,
        colaboradores: extraviados.map((e: any) => ({
          nome: e.colaborador_nome,
          data: e.data_entrega,
        })),
      },
      substituicoes_por_dano: substituicoesPorDano.length,
      substituicoes_por_perda: substituicoesPorPerda.length,
      estoque_critico: epis.filter((e: any) => e.quantidade_estoque <= e.quantidade_minima).length,
      epis_vencidos: epis.filter((e: any) => e.data_validade && new Date(e.data_validade) < new Date()).length,
    };

    const systemPrompt = `Você é um Fiscal Interno de EPI especializado em análise de padrões suspeitos e conformidade com as normas brasileiras (NR-6, NR-9, NR-15).

Sua função é analisar os dados de entregas, movimentações e estoque de EPIs de uma empresa e identificar:

1. **Padrões Suspeitos**: Colaboradores com frequência anormal de substituições, perdas ou extravios. Departamentos com consumo desproporcional.

2. **Riscos de Conformidade**: EPIs vencidos em uso, CAs expirados, tipos de EPI sem entrega recente para funções que exigem.

3. **Anomalias Operacionais**: Picos incomuns de consumo, categorias com desgaste acelerado, falta de devoluções.

4. **Recomendações Práticas**: Ações concretas para mitigar riscos identificados, priorizadas por gravidade.

Formato da resposta:
- Use markdown com títulos claros
- Inclua emojis para severidade: 🔴 Crítico, 🟠 Alto, 🟡 Médio, 🟢 Baixo
- Seja direto e objetivo
- Cite números específicos dos dados
- Termine com um resumo executivo com as 3 ações prioritárias

Responda em português brasileiro.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Analise os seguintes dados de EPIs da empresa e identifique padrões suspeitos, riscos e recomendações:\n\n${JSON.stringify(dataSummary, null, 2)}`,
          },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Limite da API OpenAI atingido. Verifique o saldo/limites da chave." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao consultar IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("ai-epi-fiscal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
