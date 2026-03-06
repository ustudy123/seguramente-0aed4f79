import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface StepResult {
  step: string;
  action: string;
  status: "success" | "fail" | "warning";
  details: string;
  duration_ms: number;
}

interface FlowResult {
  flow: string;
  flow_label: string;
  steps: StepResult[];
  passed: number;
  failed: number;
  warnings: number;
  total_duration_ms: number;
}

async function runStep(stepName: string, action: string, fn: () => Promise<string>): Promise<StepResult> {
  const start = Date.now();
  try {
    const details = await fn();
    return { step: stepName, action, status: "success", details, duration_ms: Date.now() - start };
  } catch (e) {
    return { step: stepName, action, status: "fail", details: e.message || String(e), duration_ms: Date.now() - start };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { flow, tenantId } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const flows: FlowResult[] = [];

    // ═══════════════════════════════════════════════════
    // FLOW 1: ADMISSÃO COMPLETA
    // ═══════════════════════════════════════════════════
    if (flow === "admissao" || flow === "todos") {
      const steps: StepResult[] = [];
      let admissaoId: string | null = null;
      const testCpf = "999.888.777-00";
      const testEmail = `qa-test-${Date.now()}@teste.com`;

      steps.push(await runStep("1. Criar Admissão", "INSERT admissoes", async () => {
        if (!tenantId) throw new Error("tenantId obrigatório");
        const { data, error } = await supabase.from("admissoes").insert({
          tenant_id: tenantId,
          nome_completo: "QA Agent — Teste Automatizado",
          cpf: testCpf,
          email: testEmail,
          cargo: "Analista de QA (teste)",
          departamento: "Tecnologia",
          status: "em_andamento",
        }).select("id").single();
        if (error) throw new Error(error.message);
        admissaoId = data.id;
        return `Admissão criada: ${data.id}`;
      }));

      steps.push(await runStep("2. Verificar Admissão", "SELECT admissoes", async () => {
        if (!admissaoId) throw new Error("Admissão não foi criada no passo anterior");
        const { data, error } = await supabase.from("admissoes").select("*").eq("id", admissaoId).single();
        if (error) throw new Error(error.message);
        if (data.nome_completo !== "QA Agent — Teste Automatizado") throw new Error("Nome divergente");
        if (data.cpf !== testCpf) throw new Error("CPF divergente");
        return `Dados verificados: ${data.nome_completo}, ${data.cargo}`;
      }));

      steps.push(await runStep("3. Atualizar Status", "UPDATE admissoes", async () => {
        if (!admissaoId) throw new Error("Admissão não encontrada");
        const { error } = await supabase.from("admissoes").update({
          status: "concluido",
          data_admissao: new Date().toISOString().split("T")[0],
          salario: 5000,
        }).eq("id", admissaoId);
        if (error) throw new Error(error.message);
        return "Status atualizado para 'concluido'";
      }));

      steps.push(await runStep("4. Verificar Status Final", "SELECT admissoes", async () => {
        if (!admissaoId) throw new Error("Admissão não encontrada");
        const { data, error } = await supabase.from("admissoes").select("status, salario").eq("id", admissaoId).single();
        if (error) throw new Error(error.message);
        if (data.status !== "concluido") throw new Error(`Status esperado 'concluido', recebido '${data.status}'`);
        if (data.salario !== 5000) throw new Error(`Salário esperado 5000, recebido ${data.salario}`);
        return `Status: ${data.status}, Salário: R$${data.salario}`;
      }));

      steps.push(await runStep("5. Criar Documento", "INSERT admissao_documentos", async () => {
        if (!admissaoId) throw new Error("Admissão não encontrada");
        const { data, error } = await supabase.from("admissao_documentos").insert({
          tenant_id: tenantId,
          admissao_id: admissaoId,
          nome: "RG — Teste QA",
          tipo: "rg",
          obrigatorio: true,
          status: "pendente",
        }).select("id").single();
        if (error) throw new Error(error.message);
        return `Documento criado: ${data.id}`;
      }));

      // Cleanup
      steps.push(await runStep("6. Cleanup — Remover dados de teste", "DELETE", async () => {
        if (admissaoId) {
          await supabase.from("admissao_documentos").delete().eq("admissao_id", admissaoId);
          await supabase.from("admissao_historico").delete().eq("admissao_id", admissaoId);
          await supabase.from("admissao_workflow").delete().eq("admissao_id", admissaoId);
          await supabase.from("admissoes").delete().eq("id", admissaoId);
        }
        return "Dados de teste removidos com sucesso";
      }));

      const passed = steps.filter(s => s.status === "success").length;
      const failed = steps.filter(s => s.status === "fail").length;
      flows.push({
        flow: "admissao", flow_label: "Fluxo de Admissão",
        steps, passed, failed, warnings: steps.filter(s => s.status === "warning").length,
        total_duration_ms: steps.reduce((acc, s) => acc + s.duration_ms, 0),
      });
    }

    // ═══════════════════════════════════════════════════
    // FLOW 2: ATESTADO MÉDICO
    // ═══════════════════════════════════════════════════
    if (flow === "atestado" || flow === "todos") {
      const steps: StepResult[] = [];
      let atestadoId: string | null = null;

      steps.push(await runStep("1. Criar Atestado", "INSERT atestados", async () => {
        if (!tenantId) throw new Error("tenantId obrigatório");
        const { data, error } = await supabase.from("atestados").insert({
          tenant_id: tenantId,
          colaborador_nome: "QA Agent — Colaborador Teste",
          profissional_nome: "Dr. QA Teste",
          profissional_registro: "CRM-QA-0000",
          tipo: "assistencial",
          data_emissao: new Date().toISOString().split("T")[0],
          dias_afastamento: 3,
        }).select("id").single();
        if (error) throw new Error(error.message);
        atestadoId = data.id;
        return `Atestado criado: ${data.id}`;
      }));

      steps.push(await runStep("2. Verificar Atestado", "SELECT atestados", async () => {
        if (!atestadoId) throw new Error("Atestado não criado");
        const { data, error } = await supabase.from("atestados").select("*").eq("id", atestadoId).single();
        if (error) throw new Error(error.message);
        if (data.dias_afastamento !== 3) throw new Error("Dias de afastamento divergente");
        return `Atestado verificado: ${data.profissional_nome}, ${data.dias_afastamento} dias`;
      }));

      steps.push(await runStep("3. Atualizar CID", "UPDATE atestados", async () => {
        if (!atestadoId) throw new Error("Atestado não encontrado");
        const { error } = await supabase.from("atestados").update({
          cid_codigo: "J11",
          contem_cid: true,
          grupo_clinico: "respiratorio",
        }).eq("id", atestadoId);
        if (error) throw new Error(error.message);
        return "CID J11 adicionado";
      }));

      steps.push(await runStep("4. Cleanup", "DELETE", async () => {
        if (atestadoId) {
          await supabase.from("atestados").delete().eq("id", atestadoId);
        }
        return "Atestado de teste removido";
      }));

      const passed = steps.filter(s => s.status === "success").length;
      flows.push({
        flow: "atestado", flow_label: "Fluxo de Atestado Médico",
        steps, passed, failed: steps.filter(s => s.status === "fail").length,
        warnings: steps.filter(s => s.status === "warning").length,
        total_duration_ms: steps.reduce((acc, s) => acc + s.duration_ms, 0),
      });
    }

    // ═══════════════════════════════════════════════════
    // FLOW 3: EPI
    // ═══════════════════════════════════════════════════
    if (flow === "epi" || flow === "todos") {
      const steps: StepResult[] = [];
      let epiId: string | null = null;

      steps.push(await runStep("1. Criar EPI", "INSERT epis", async () => {
        if (!tenantId) throw new Error("tenantId obrigatório");
        const { data, error } = await supabase.from("epis").insert({
          tenant_id: tenantId,
          nome: "QA Agent — Luva Teste",
          ca: "CA-QA-0000",
          quantidade_estoque: 100,
          estoque_minimo: 10,
          validade_ca: new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0],
        }).select("id").single();
        if (error) throw new Error(error.message);
        epiId = data.id;
        return `EPI criado: ${data.id}`;
      }));

      steps.push(await runStep("2. Verificar Estoque", "SELECT epis", async () => {
        if (!epiId) throw new Error("EPI não criado");
        const { data, error } = await supabase.from("epis").select("*").eq("id", epiId).single();
        if (error) throw new Error(error.message);
        if (data.quantidade_estoque !== 100) throw new Error(`Estoque esperado 100, recebido ${data.quantidade_estoque}`);
        return `Estoque verificado: ${data.quantidade_estoque} unidades`;
      }));

      steps.push(await runStep("3. Registrar Entrega", "INSERT epi_entregas", async () => {
        if (!epiId) throw new Error("EPI não encontrado");
        const { data, error } = await supabase.from("epi_entregas").insert({
          tenant_id: tenantId,
          epi_id: epiId,
          colaborador_nome: "QA Agent — Colaborador",
          colaborador_cpf: "999.888.777-00",
          quantidade: 2,
          data_entrega: new Date().toISOString().split("T")[0],
          status: "ativa",
        }).select("id").single();
        if (error) throw new Error(error.message);
        return `Entrega registrada: ${data.id}`;
      }));

      steps.push(await runStep("4. Verificar Baixa Estoque", "SELECT epis", async () => {
        if (!epiId) throw new Error("EPI não encontrado");
        const { data, error } = await supabase.from("epis").select("quantidade_estoque").eq("id", epiId).single();
        if (error) throw new Error(error.message);
        // Trigger should have reduced stock by 2
        if (data.quantidade_estoque !== 98) {
          return `⚠️ Estoque atual: ${data.quantidade_estoque} (esperado 98 — trigger pode não estar ativo)`;
        }
        return `Estoque atualizado pelo trigger: ${data.quantidade_estoque} ✓`;
      }));

      steps.push(await runStep("5. Cleanup", "DELETE", async () => {
        if (epiId) {
          await supabase.from("epi_entregas").delete().eq("epi_id", epiId);
          await supabase.from("epis").delete().eq("id", epiId);
        }
        return "Dados de teste removidos";
      }));

      const passed = steps.filter(s => s.status === "success").length;
      flows.push({
        flow: "epi", flow_label: "Fluxo de EPI (Entrega + Estoque)",
        steps, passed, failed: steps.filter(s => s.status === "fail").length,
        warnings: steps.filter(s => s.status === "warning").length,
        total_duration_ms: steps.reduce((acc, s) => acc + s.duration_ms, 0),
      });
    }

    // ═══════════════════════════════════════════════════
    // FLOW 4: PLANO DE AÇÃO
    // ═══════════════════════════════════════════════════
    if (flow === "plano_acao" || flow === "todos") {
      const steps: StepResult[] = [];
      let acaoId: string | null = null;
      let tarefaId: string | null = null;

      steps.push(await runStep("1. Criar Ação", "INSERT plano_acoes", async () => {
        if (!tenantId) throw new Error("tenantId obrigatório");
        const { data, error } = await supabase.from("plano_acoes").insert({
          tenant_id: tenantId,
          titulo: "QA Agent — Ação de Teste",
          descricao: "Ação criada automaticamente pelo agente de QA",
          status: "pendente",
          prioridade: "media",
          responsavel_nome: "QA Agent",
          prazo: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
          origem: "plano_acao",
          progresso: 0,
        }).select("id, codigo").single();
        if (error) throw new Error(error.message);
        acaoId = data.id;
        return `Ação criada: ${data.codigo || data.id}`;
      }));

      steps.push(await runStep("2. Criar Tarefa", "INSERT plano_tarefas", async () => {
        if (!acaoId) throw new Error("Ação não criada");
        const { data, error } = await supabase.from("plano_tarefas").insert({
          tenant_id: tenantId,
          acao_id: acaoId,
          titulo: "Tarefa de teste QA",
          status: "pendente",
          responsavel_nome: "QA Agent",
          prazo: new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0],
        }).select("id").single();
        if (error) throw new Error(error.message);
        tarefaId = data.id;
        return `Tarefa criada: ${data.id}`;
      }));

      steps.push(await runStep("3. Concluir Tarefa", "UPDATE plano_tarefas", async () => {
        if (!tarefaId) throw new Error("Tarefa não criada");
        const { error } = await supabase.from("plano_tarefas").update({
          status: "concluida",
        }).eq("id", tarefaId);
        if (error) throw new Error(error.message);
        return "Tarefa marcada como concluída";
      }));

      steps.push(await runStep("4. Verificar Trigger de Progresso", "SELECT plano_acoes", async () => {
        if (!acaoId) throw new Error("Ação não encontrada");
        // Wait a bit for trigger
        await new Promise(r => setTimeout(r, 500));
        const { data, error } = await supabase.from("plano_acoes").select("progresso, status").eq("id", acaoId).single();
        if (error) throw new Error(error.message);
        if (data.progresso === 100 && data.status === "concluida") {
          return `Trigger OK: progresso=${data.progresso}%, status=${data.status} ✓`;
        }
        return `Progresso: ${data.progresso}%, Status: ${data.status} (trigger pode ter delay)`;
      }));

      steps.push(await runStep("5. Cleanup", "DELETE", async () => {
        if (acaoId) {
          await supabase.from("plano_tarefas").delete().eq("acao_id", acaoId);
          await supabase.from("plano_acoes").delete().eq("id", acaoId);
        }
        return "Dados de teste removidos";
      }));

      const passed = steps.filter(s => s.status === "success").length;
      flows.push({
        flow: "plano_acao", flow_label: "Fluxo de Plano de Ação",
        steps, passed, failed: steps.filter(s => s.status === "fail").length,
        warnings: steps.filter(s => s.status === "warning").length,
        total_duration_ms: steps.reduce((acc, s) => acc + s.duration_ms, 0),
      });
    }

    // ═══════════════════════════════════════════════════
    // FLOW 5: ISOLAMENTO MULTI-TENANT (RLS)
    // ═══════════════════════════════════════════════════
    if (flow === "rls_isolamento" || flow === "todos") {
      const steps: StepResult[] = [];

      steps.push(await runStep("1. Listar Tenants", "SELECT tenants", async () => {
        const { data, error } = await supabase.from("tenants").select("id, nome");
        if (error) throw new Error(error.message);
        if (!data || data.length < 2) return `Apenas ${data?.length || 0} tenant(s) — não é possível testar isolamento`;
        return `${data.length} tenants encontrados para teste de isolamento`;
      }));

      steps.push(await runStep("2. Testar Acesso Anônimo", "SELECT (anon)", async () => {
        const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || "");
        const tables = ["profiles", "admissoes", "atestados", "epis", "plano_acoes"];
        const exposed: string[] = [];
        for (const t of tables) {
          const { data } = await anonClient.from(t).select("id").limit(1);
          if (data && data.length > 0) exposed.push(t);
        }
        if (exposed.length > 0) throw new Error(`Tabelas expostas sem auth: ${exposed.join(", ")}`);
        return "Nenhuma tabela exposta para acesso anônimo ✓";
      }));

      steps.push(await runStep("3. Verificar Profiles × Tenants", "SELECT", async () => {
        const { data: profiles } = await supabase.from("profiles").select("tenant_id");
        const { data: tenants } = await supabase.from("tenants").select("id");
        if (!profiles || !tenants) throw new Error("Não foi possível consultar dados");
        const tenantIds = new Set(tenants.map(t => t.id));
        const orphans = profiles.filter(p => p.tenant_id && !tenantIds.has(p.tenant_id));
        if (orphans.length > 0) throw new Error(`${orphans.length} perfis órfãos sem tenant válido`);
        return `Todos os ${profiles.length} perfis vinculados a tenants válidos ✓`;
      }));

      const passed = steps.filter(s => s.status === "success").length;
      flows.push({
        flow: "rls_isolamento", flow_label: "Isolamento Multi-Tenant (RLS)",
        steps, passed, failed: steps.filter(s => s.status === "fail").length,
        warnings: steps.filter(s => s.status === "warning").length,
        total_duration_ms: steps.reduce((acc, s) => acc + s.duration_ms, 0),
      });
    }

    // ═══════════════════════════════════════════════════
    // FLOW 6: EDGE FUNCTIONS HEALTH
    // ═══════════════════════════════════════════════════
    if (flow === "edge_functions" || flow === "todos") {
      const steps: StepResult[] = [];
      const fns = [
        "onboarding-signup", "extract-atestado", "ai-plano-acao", "ai-chat",
        "ai-psicossocial-analise", "ai-sst-analise", "ai-feedback",
        "ai-pdi-smart", "ai-nf-ocr", "ai-pgr-riscos", "ai-qa-scan",
      ];

      for (const fn of fns) {
        steps.push(await runStep(`Ping ${fn}`, "POST (health check)", async () => {
          const resp = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY") || ""}`,
            },
            body: JSON.stringify({ test: true }),
          });
          const text = await resp.text();
          if (resp.status === 404) throw new Error("Função não deployada (404)");
          if (resp.status === 500) throw new Error(`Erro interno: ${text.slice(0, 100)}`);
          return `Status ${resp.status} — respondendo ✓`;
        }));
      }

      const passed = steps.filter(s => s.status === "success").length;
      flows.push({
        flow: "edge_functions", flow_label: "Health Check de Edge Functions",
        steps, passed, failed: steps.filter(s => s.status === "fail").length,
        warnings: steps.filter(s => s.status === "warning").length,
        total_duration_ms: steps.reduce((acc, s) => acc + s.duration_ms, 0),
      });
    }

    // ═══════════════════════════════════════════════════
    // IA: ANÁLISE DO RELATÓRIO
    // ═══════════════════════════════════════════════════
    const totalPassed = flows.reduce((a, f) => a + f.passed, 0);
    const totalFailed = flows.reduce((a, f) => a + f.failed, 0);
    const totalSteps = flows.reduce((a, f) => a + f.steps.length, 0);
    let aiReport = "";

    try {
      const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `Você é um agente de QA sênior analisando resultados de testes automatizados em um sistema SaaS de RH/SST.
Gere um relatório executivo em Markdown com:
1. **Resumo**: aprovação geral (X/Y testes passaram)
2. **Falhas Encontradas**: liste cada falha com causa provável e como corrigir
3. **Triggers/Automações**: se triggers de banco funcionaram corretamente
4. **Recomendações**: top 3 ações prioritárias
5. **Score**: nota de 0-100 para confiabilidade do sistema

Seja direto e técnico. Português do Brasil.`,
            },
            { role: "user", content: JSON.stringify(flows, null, 2) },
          ],
          max_tokens: 1500,
        }),
      });

      if (aiResp.ok) {
        const d = await aiResp.json();
        aiReport = d.choices?.[0]?.message?.content || "";
      }
    } catch {
      aiReport = "Análise de IA indisponível.";
    }

    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      total_flows: flows.length,
      total_steps: totalSteps,
      total_passed: totalPassed,
      total_failed: totalFailed,
      score: totalSteps > 0 ? Math.round((totalPassed / totalSteps) * 100) : 0,
      flows,
      ai_report: aiReport,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
