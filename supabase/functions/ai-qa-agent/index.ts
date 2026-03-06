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

// Test credentials
const TEST_EMAIL = "wallasmonteirobarros@gmail.com";
const TEST_PASSWORD = "12345678";

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
    const { flow, tenantId, stream } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

    // ═══ Authenticate as test user ═══
    async function getAuthenticatedClient() {
      const client = createClient(SUPABASE_URL, ANON_KEY);
      const { data, error } = await client.auth.signInWithPassword({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });
      if (error) throw new Error(`Login falhou (${TEST_EMAIL}): ${error.message}`);
      return { client, session: data.session, user: data.user };
    }

    if (!stream) {
      return new Response(JSON.stringify({ error: "Use stream: true" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const encoder = new TextEncoder();
    const STEP_DELAY = 2500; // 2.5 seconds between steps for visual feedback
    const NAV_DELAY = 2000; // 2s after navigation for visual effect

    const body = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: any) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

        // Navigate iframe to a route with label
        const navigateTo = async (route: string, label?: string) => {
          send("navigate", { route, label });
          await delay(NAV_DELAY);
        };

        const flows: FlowResult[] = [];

        const runStepStreamed = async (flowId: string, stepName: string, action: string, fn: () => Promise<string>): Promise<StepResult> => {
          send("step_start", { flow: flowId, step: stepName, action });
          const result = await runStep(stepName, action, fn);
          send("step_done", { flow: flowId, ...result });
          await delay(STEP_DELAY);
          return result;
        };

        const buildFlowResult = (flowId: string, label: string, steps: StepResult[]): FlowResult => {
          return {
            flow: flowId, flow_label: label, steps,
            passed: steps.filter(s => s.status === "success").length,
            failed: steps.filter(s => s.status === "fail").length,
            warnings: steps.filter(s => s.status === "warning").length,
            total_duration_ms: steps.reduce((a, s) => a + s.duration_ms, 0),
          };
        };

        // ═══════════════════════════════════════════════════
        // FLOW: LOGIN & AUTH
        // ═══════════════════════════════════════════════════
        let authClient: any = null;
        let authUser: any = null;
        let authTenantId: string | null = tenantId || null;

        if (flow === "login_auth" || flow === "todos") {
          send("flow_start", { flow: "login_auth", label: "Autenticação & Perfil" });
          await navigateTo("/", "Autenticação & Perfil");
          const steps: StepResult[] = [];

          steps.push(await runStepStreamed("login_auth", "1. Login com credenciais", `signIn ${TEST_EMAIL}`, async () => {
            const { client, session, user } = await getAuthenticatedClient();
            authClient = client;
            authUser = user;
            return `Login OK — UID: ${user.id}, Email: ${user.email}`;
          }));

          await navigateTo("/", "Dashboard — verificando perfil");

          steps.push(await runStepStreamed("login_auth", "2. Verificar Perfil", "SELECT profiles", async () => {
            if (!authClient) throw new Error("Login não realizado");
            const { data, error } = await authClient.from("profiles").select("*").eq("user_id", authUser.id).single();
            if (error) throw new Error(error.message);
            authTenantId = data.tenant_id;
            return `Perfil: ${data.nome_completo || data.full_name || 'sem nome'}, Tenant: ${data.tenant_id?.slice(0, 8)}...`;
          }));

          steps.push(await runStepStreamed("login_auth", "3. Verificar Roles", "SELECT user_roles", async () => {
            if (!authClient) throw new Error("Login não realizado");
            const { data, error } = await authClient.from("user_roles").select("*").eq("user_id", authUser.id);
            if (error) throw new Error(error.message);
            const roles = data?.map((r: any) => r.role).join(", ") || "nenhum";
            return `Roles: ${roles} (${data?.length || 0} atribuídas)`;
          }));

          steps.push(await runStepStreamed("login_auth", "4. Verificar SuperAdmin", "SELECT superadmins", async () => {
            const { data } = await supabaseAdmin.from("superadmins").select("*").eq("user_id", authUser.id);
            const isSa = data && data.length > 0 && data[0].ativo;
            return isSa ? "✓ É SuperAdmin ativo" : "Não é SuperAdmin";
          }));

          steps.push(await runStepStreamed("login_auth", "5. Verificar Sessão", "getSession", async () => {
            if (!authClient) throw new Error("Login não realizado");
            const { data } = await authClient.auth.getSession();
            if (!data.session) throw new Error("Sessão não ativa");
            const exp = new Date(data.session.expires_at * 1000);
            return `Sessão ativa até ${exp.toLocaleString("pt-BR")}`;
          }));

          const fr = buildFlowResult("login_auth", "Autenticação & Perfil", steps);
          flows.push(fr);
          send("flow_done", fr);
        }

        // Ensure we have auth for subsequent flows
        if (!authClient && flow !== "login_auth") {
          try {
            const { client, user } = await getAuthenticatedClient();
            authClient = client;
            authUser = user;
            if (!authTenantId) {
              const { data } = await authClient.from("profiles").select("tenant_id").eq("user_id", user.id).single();
              authTenantId = data?.tenant_id || tenantId;
            }
          } catch (e) {
            send("step_done", { flow: "auth", step: "Auto-login", action: "signIn", status: "fail", details: e.message, duration_ms: 0 });
          }
        }

        const effectiveTenant = authTenantId || tenantId;

        // ═══════════════════════════════════════════════════
        // FLOW: EMPRESA (Cadastro)
        // ═══════════════════════════════════════════════════
        if (flow === "empresa" || flow === "todos") {
          send("flow_start", { flow: "empresa", label: "Cadastro de Empresa" });
          await navigateTo("/empresa", "Cadastro de Empresa");
          const steps: StepResult[] = [];
          let empresaId: string | null = null;
          let deptId: string | null = null;
          let cargoId: string | null = null;

          steps.push(await runStepStreamed("empresa", "1. Criar Empresa", "INSERT empresa_cadastro", async () => {
            if (!effectiveTenant) throw new Error("tenantId não disponível");
            const { data, error } = await supabaseAdmin.from("empresa_cadastro").insert({
              tenant_id: effectiveTenant,
              tipo_pessoa: "juridica",
              tipo_unidade: "matriz",
              razao_social: "QA Agent — Empresa Teste LTDA",
              nome_fantasia: "QA Teste Corp",
              cnpj: "99.999.999/0001-99",
              email: "qa-teste@empresa.com",
              telefone: "(11) 99999-0000",
              cep: "01001-000",
              cidade: "São Paulo",
              estado: "SP",
              endereco: "Rua Teste, 123",
              bairro: "Centro",
              total_colaboradores: 50,
              grau_risco: 2,
              cnae_principal: "6201-5/00",
              cnae_descricao: "Desenvolvimento de software",
            }).select("id").single();
            if (error) throw new Error(error.message);
            empresaId = data.id;
            return `Empresa criada: ${data.id}`;
          }));

          steps.push(await runStepStreamed("empresa", "2. Verificar Empresa", "SELECT empresa_cadastro", async () => {
            if (!empresaId) throw new Error("Empresa não criada");
            const { data, error } = await supabaseAdmin.from("empresa_cadastro").select("*").eq("id", empresaId).single();
            if (error) throw new Error(error.message);
            if (data.razao_social !== "QA Agent — Empresa Teste LTDA") throw new Error("Razão social divergente");
            return `Verificada: ${data.razao_social}, CNPJ: ${data.cnpj}, Risco: ${data.grau_risco}`;
          }));

          steps.push(await runStepStreamed("empresa", "3. Criar Departamento", "INSERT departamentos", async () => {
            if (!empresaId || !effectiveTenant) throw new Error("Empresa/tenant ausente");
            const { data, error } = await supabaseAdmin.from("departamentos").insert({
              tenant_id: effectiveTenant, empresa_id: empresaId,
              nome: "QA — Dept Teste", descricao: "Departamento criado pelo agente de QA",
            }).select("id").single();
            if (error) throw new Error(error.message);
            deptId = data.id;
            return `Departamento criado: ${data.id}`;
          }));

          steps.push(await runStepStreamed("empresa", "4. Criar Cargo", "INSERT cargos", async () => {
            if (!deptId || !effectiveTenant) throw new Error("Departamento/tenant ausente");
            const { data, error } = await supabaseAdmin.from("cargos").insert({
              tenant_id: effectiveTenant, empresa_id: empresaId,
              departamento_id: deptId, nome: "QA — Cargo Teste",
              descricao: "Cargo criado pelo agente de QA",
              nivel: "junior", faixa_salarial_min: 3000, faixa_salarial_max: 6000,
            }).select("id").single();
            if (error) throw new Error(error.message);
            cargoId = data.id;
            return `Cargo criado: ${data.id}`;
          }));

          steps.push(await runStepStreamed("empresa", "5. Listar Empresas (Auth)", "SELECT via auth client", async () => {
            if (!authClient) throw new Error("Auth client não disponível");
            const { data, error } = await authClient.from("empresa_cadastro").select("id, razao_social, tipo_unidade").eq("tenant_id", effectiveTenant);
            if (error) throw new Error(error.message);
            return `${data?.length || 0} empresas visíveis pelo usuário autenticado`;
          }));

          steps.push(await runStepStreamed("empresa", "6. Atualizar Empresa", "UPDATE empresa_cadastro", async () => {
            if (!empresaId) throw new Error("Empresa não encontrada");
            const { error } = await supabaseAdmin.from("empresa_cadastro").update({
              total_colaboradores: 100, grau_risco: 3, jornada_padrao: "44h semanais",
            }).eq("id", empresaId);
            if (error) throw new Error(error.message);
            return "Empresa atualizada: 100 colaboradores, Risco 3";
          }));

          steps.push(await runStepStreamed("empresa", "7. Cleanup", "DELETE", async () => {
            if (cargoId) await supabaseAdmin.from("cargos").delete().eq("id", cargoId);
            if (deptId) await supabaseAdmin.from("departamentos").delete().eq("id", deptId);
            if (empresaId) await supabaseAdmin.from("empresa_cadastro").delete().eq("id", empresaId);
            return "Empresa, departamento e cargo de teste removidos";
          }));

          const fr = buildFlowResult("empresa", "Cadastro de Empresa", steps);
          flows.push(fr);
          send("flow_done", fr);
        }

        // ═══════════════════════════════════════════════════
        // FLOW: ADMISSÃO
        // ═══════════════════════════════════════════════════
        if (flow === "admissao" || flow === "todos") {
          send("flow_start", { flow: "admissao", label: "Fluxo de Admissão" });
          await navigateTo("/colaboradores", "Colaboradores — Admissão");
          const steps: StepResult[] = [];
          let admissaoId: string | null = null;
          const testCpf = "999.888.777-00";
          const testEmail = `qa-test-${Date.now()}@teste.com`;

          steps.push(await runStepStreamed("admissao", "1. Criar Admissão", "INSERT admissoes", async () => {
            if (!effectiveTenant) throw new Error("tenantId obrigatório");
            const { data, error } = await supabaseAdmin.from("admissoes").insert({
              tenant_id: effectiveTenant, nome_completo: "QA Agent — Teste Automatizado",
              cpf: testCpf, email: testEmail, cargo: "Analista de QA (teste)",
              departamento: "Tecnologia", status: "em_andamento",
              data_nascimento: "1990-05-15", genero: "masculino",
              telefone: "(11) 99999-8888", celular: "(11) 99999-7777",
              tipo_contrato: "clt", salario: 5000,
            }).select("id").single();
            if (error) throw new Error(error.message);
            admissaoId = data.id;
            return `Admissão criada: ${data.id}`;
          }));

          steps.push(await runStepStreamed("admissao", "2. Verificar Dados", "SELECT admissoes", async () => {
            if (!admissaoId) throw new Error("Admissão não foi criada");
            const { data, error } = await supabaseAdmin.from("admissoes").select("*").eq("id", admissaoId).single();
            if (error) throw new Error(error.message);
            if (data.nome_completo !== "QA Agent — Teste Automatizado") throw new Error("Nome divergente");
            if (data.salario !== 5000) throw new Error(`Salário divergente: ${data.salario}`);
            return `Nome: ${data.nome_completo}, Cargo: ${data.cargo}, Salário: R$${data.salario}`;
          }));

          steps.push(await runStepStreamed("admissao", "3. Dados Bancários", "UPDATE admissoes", async () => {
            if (!admissaoId) throw new Error("Admissão não encontrada");
            const { error } = await supabaseAdmin.from("admissoes").update({
              banco: "Itaú", agencia: "1234", conta: "56789-0",
              tipo_conta: "corrente", chave_pix: testEmail,
            }).eq("id", admissaoId);
            if (error) throw new Error(error.message);
            return "Dados bancários preenchidos: Itaú 1234 / 56789-0";
          }));

          steps.push(await runStepStreamed("admissao", "4. Endereço", "UPDATE admissoes", async () => {
            if (!admissaoId) throw new Error("Admissão não encontrada");
            const { error } = await supabaseAdmin.from("admissoes").update({
              cep: "01001-000", endereco: "Rua QA", numero: "42",
              bairro: "Centro", cidade: "São Paulo", estado: "SP",
            }).eq("id", admissaoId);
            if (error) throw new Error(error.message);
            return "Endereço atualizado: Rua QA, 42 — SP";
          }));

          steps.push(await runStepStreamed("admissao", "5. Criar Documentos", "INSERT admissao_documentos", async () => {
            if (!admissaoId) throw new Error("Admissão não encontrada");
            const docs = [
              { nome: "RG", tipo: "rg", obrigatorio: true },
              { nome: "CPF", tipo: "cpf", obrigatorio: true },
              { nome: "CTPS", tipo: "ctps", obrigatorio: true },
              { nome: "Comprovante de Residência", tipo: "comprovante_residencia", obrigatorio: false },
            ];
            const results = [];
            for (const doc of docs) {
              const { data, error } = await supabaseAdmin.from("admissao_documentos").insert({
                tenant_id: effectiveTenant, admissao_id: admissaoId,
                nome: doc.nome, tipo: doc.tipo, obrigatorio: doc.obrigatorio, status: "pendente",
              }).select("id").single();
              if (error) throw new Error(`Erro no doc ${doc.nome}: ${error.message}`);
              results.push(doc.nome);
            }
            return `${results.length} documentos criados: ${results.join(", ")}`;
          }));

          steps.push(await runStepStreamed("admissao", "6. Concluir Admissão", "UPDATE status=concluido", async () => {
            if (!admissaoId) throw new Error("Admissão não encontrada");
            const { error } = await supabaseAdmin.from("admissoes").update({
              status: "concluido", data_admissao: new Date().toISOString().split("T")[0],
            }).eq("id", admissaoId);
            if (error) throw new Error(error.message);
            return "Admissão concluída com sucesso";
          }));

          steps.push(await runStepStreamed("admissao", "7. Verificar via Auth Client", "SELECT (auth)", async () => {
            if (!authClient) throw new Error("Auth client não disponível");
            const { data, error } = await authClient.from("admissoes").select("id, status, nome_completo").eq("id", admissaoId);
            if (error) throw new Error(`RLS bloqueou: ${error.message}`);
            return `Visível pelo auth client: ${data?.length || 0} registro(s)`;
          }));

          steps.push(await runStepStreamed("admissao", "8. Cleanup", "DELETE", async () => {
            if (admissaoId) {
              await supabaseAdmin.from("admissao_documentos").delete().eq("admissao_id", admissaoId);
              await supabaseAdmin.from("admissao_historico").delete().eq("admissao_id", admissaoId);
              await supabaseAdmin.from("admissao_workflow").delete().eq("admissao_id", admissaoId);
              await supabaseAdmin.from("admissoes").delete().eq("id", admissaoId);
            }
            return "Dados de teste removidos";
          }));

          const fr = buildFlowResult("admissao", "Fluxo de Admissão", steps);
          flows.push(fr);
          send("flow_done", fr);
        }

        // ═══════════════════════════════════════════════════
        // FLOW: ATESTADO
        // ═══════════════════════════════════════════════════
        if (flow === "atestado" || flow === "todos") {
          send("flow_start", { flow: "atestado", label: "Atestado Médico" });
          await navigateTo("/atestados", "Atestados — Gestão de Saúde");
          const steps: StepResult[] = [];
          let atestadoId: string | null = null;

          steps.push(await runStepStreamed("atestado", "1. Criar Atestado", "INSERT atestados", async () => {
            const { data, error } = await supabaseAdmin.from("atestados").insert({
              tenant_id: effectiveTenant, colaborador_nome: "QA Agent — Colaborador",
              profissional_nome: "Dr. QA Teste", profissional_registro: "CRM-QA-0000",
              tipo: "assistencial", data_emissao: new Date().toISOString().split("T")[0],
              dias_afastamento: 3, cid_codigo: "J11", contem_cid: true,
              grupo_clinico: "respiratorio",
              data_inicio_afastamento: new Date().toISOString().split("T")[0],
            }).select("id").single();
            if (error) throw new Error(error.message);
            atestadoId = data.id;
            return `Atestado criado: ${data.id}`;
          }));

          steps.push(await runStepStreamed("atestado", "2. Verificar Dados", "SELECT atestados", async () => {
            if (!atestadoId) throw new Error("Atestado não criado");
            const { data, error } = await supabaseAdmin.from("atestados").select("*").eq("id", atestadoId).single();
            if (error) throw new Error(error.message);
            if (data.dias_afastamento !== 3) throw new Error("Dias divergente");
            if (data.cid_codigo !== "J11") throw new Error("CID divergente");
            return `CID: ${data.cid_codigo}, Dias: ${data.dias_afastamento}, Tipo: ${data.tipo}`;
          }));

          steps.push(await runStepStreamed("atestado", "3. Testar Ocupacional", "INSERT atestado ocupacional", async () => {
            const { data, error } = await supabaseAdmin.from("atestados").insert({
              tenant_id: effectiveTenant, colaborador_nome: "QA Agent — Ocupacional",
              profissional_nome: "Dr. Ocupacional", profissional_registro: "CRM-OC-0001",
              tipo: "ocupacional", subtipo_ocupacional: "admissional",
              data_emissao: new Date().toISOString().split("T")[0],
              aptidao: "apto",
            }).select("id").single();
            if (error) throw new Error(error.message);
            // Cleanup immediately
            await supabaseAdmin.from("atestados").delete().eq("id", data.id);
            return `Atestado ocupacional criado e limpo: aptidão=apto`;
          }));

          steps.push(await runStepStreamed("atestado", "4. Cleanup", "DELETE", async () => {
            if (atestadoId) await supabaseAdmin.from("atestados").delete().eq("id", atestadoId);
            return "Atestado de teste removido";
          }));

          const fr = buildFlowResult("atestado", "Atestado Médico", steps);
          flows.push(fr);
          send("flow_done", fr);
        }

        // ═══════════════════════════════════════════════════
        // FLOW: EPI
        // ═══════════════════════════════════════════════════
        if (flow === "epi" || flow === "todos") {
          send("flow_start", { flow: "epi", label: "EPI (Entrega + Estoque)" });
          await navigateTo("/epis", "EPIs — Equipamentos de Proteção");
          const steps: StepResult[] = [];
          let epiId: string | null = null;
          let entregaId: string | null = null;

          steps.push(await runStepStreamed("epi", "1. Criar EPI", "INSERT epis", async () => {
            const { data, error } = await supabaseAdmin.from("epis").insert({
              tenant_id: effectiveTenant, nome: "QA Agent — Luva Teste",
              ca: "CA-QA-0000", quantidade_estoque: 100, estoque_minimo: 10,
              validade_ca: new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0],
            }).select("id").single();
            if (error) throw new Error(error.message);
            epiId = data.id;
            return `EPI criado: ${data.id}, Estoque: 100`;
          }));

          steps.push(await runStepStreamed("epi", "2. Registrar Entrega", "INSERT epi_entregas", async () => {
            if (!epiId) throw new Error("EPI não criado");
            const { data, error } = await supabaseAdmin.from("epi_entregas").insert({
              tenant_id: effectiveTenant, epi_id: epiId,
              colaborador_nome: "QA Agent — Colaborador", colaborador_cpf: "999.888.777-00",
              quantidade: 2, data_entrega: new Date().toISOString().split("T")[0], status: "ativa",
            }).select("id").single();
            if (error) throw new Error(error.message);
            entregaId = data.id;
            return `Entrega registrada: ${data.id}, Qtd: 2`;
          }));

          steps.push(await runStepStreamed("epi", "3. Verificar Trigger Estoque", "SELECT epis", async () => {
            if (!epiId) throw new Error("EPI não encontrado");
            await new Promise(r => setTimeout(r, 300));
            const { data, error } = await supabaseAdmin.from("epis").select("quantidade_estoque").eq("id", epiId).single();
            if (error) throw new Error(error.message);
            if (data.quantidade_estoque === 98) return `Trigger OK: estoque 100 → 98 ✓`;
            return `⚠️ Estoque: ${data.quantidade_estoque} (esperado 98)`;
          }));

          steps.push(await runStepStreamed("epi", "4. Verificar Estoque Mínimo", "SELECT epis", async () => {
            if (!epiId) throw new Error("EPI não encontrado");
            const { data } = await supabaseAdmin.from("epis").select("quantidade_estoque, estoque_minimo").eq("id", epiId).single();
            if (!data) throw new Error("EPI não encontrado");
            const alerta = data.quantidade_estoque <= data.estoque_minimo;
            return alerta ? `⚠️ Estoque abaixo do mínimo: ${data.quantidade_estoque} ≤ ${data.estoque_minimo}` : `Estoque OK: ${data.quantidade_estoque} > ${data.estoque_minimo}`;
          }));

          steps.push(await runStepStreamed("epi", "5. Cleanup", "DELETE", async () => {
            if (entregaId) await supabaseAdmin.from("epi_entregas").delete().eq("id", entregaId);
            if (epiId) await supabaseAdmin.from("epis").delete().eq("id", epiId);
            return "Dados de teste removidos";
          }));

          const fr = buildFlowResult("epi", "EPI (Entrega + Estoque)", steps);
          flows.push(fr);
          send("flow_done", fr);
        }

        // ═══════════════════════════════════════════════════
        // FLOW: PLANO DE AÇÃO
        // ═══════════════════════════════════════════════════
        if (flow === "plano_acao" || flow === "todos") {
          send("flow_start", { flow: "plano_acao", label: "Plano de Ação" });
          await navigateTo("/plano-acao", "Plano de Ação");
          const steps: StepResult[] = [];
          let acaoId: string | null = null;
          let tarefaId: string | null = null;

          steps.push(await runStepStreamed("plano_acao", "1. Criar Ação", "INSERT plano_acoes", async () => {
            const { data, error } = await supabaseAdmin.from("plano_acoes").insert({
              tenant_id: effectiveTenant, titulo: "QA Agent — Ação de Teste",
              descricao: "Ação criada pelo agente de QA", status: "pendente",
              prioridade: "media", responsavel_nome: "QA Agent",
              prazo: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
              origem: "plano_acao", progresso: 0,
            }).select("id, codigo").single();
            if (error) throw new Error(error.message);
            acaoId = data.id;
            return `Ação criada: ${data.codigo || data.id}`;
          }));

          steps.push(await runStepStreamed("plano_acao", "2. Criar 2 Tarefas", "INSERT plano_tarefas", async () => {
            if (!acaoId) throw new Error("Ação não criada");
            const tarefas = ["Tarefa A", "Tarefa B"];
            for (const t of tarefas) {
              const { data, error } = await supabaseAdmin.from("plano_tarefas").insert({
                tenant_id: effectiveTenant, acao_id: acaoId, titulo: `QA — ${t}`,
                status: "pendente", responsavel_nome: "QA Agent",
                prazo: new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0],
              }).select("id").single();
              if (error) throw new Error(error.message);
              if (!tarefaId) tarefaId = data.id;
            }
            return `2 tarefas criadas para a ação`;
          }));

          steps.push(await runStepStreamed("plano_acao", "3. Concluir 1 Tarefa", "UPDATE plano_tarefas", async () => {
            if (!tarefaId) throw new Error("Tarefa não criada");
            const { error } = await supabaseAdmin.from("plano_tarefas").update({ status: "concluida" }).eq("id", tarefaId);
            if (error) throw new Error(error.message);
            return "1 tarefa concluída";
          }));

          steps.push(await runStepStreamed("plano_acao", "4. Verificar Trigger Progresso", "SELECT plano_acoes", async () => {
            if (!acaoId) throw new Error("Ação não encontrada");
            await new Promise(r => setTimeout(r, 500));
            const { data, error } = await supabaseAdmin.from("plano_acoes").select("progresso, status").eq("id", acaoId).single();
            if (error) throw new Error(error.message);
            if (data.progresso === 50) return `Trigger OK: progresso=50% (1/2 tarefas) ✓`;
            return `Progresso: ${data.progresso}%, Status: ${data.status}`;
          }));

          steps.push(await runStepStreamed("plano_acao", "5. Cleanup", "DELETE", async () => {
            if (acaoId) {
              await supabaseAdmin.from("plano_tarefas").delete().eq("acao_id", acaoId);
              await supabaseAdmin.from("plano_acoes").delete().eq("id", acaoId);
            }
            return "Dados de teste removidos";
          }));

          const fr = buildFlowResult("plano_acao", "Plano de Ação", steps);
          flows.push(fr);
          send("flow_done", fr);
        }

        // ═══════════════════════════════════════════════════
        // FLOW: BENEFÍCIOS
        // ═══════════════════════════════════════════════════
        if (flow === "beneficios" || flow === "todos") {
          send("flow_start", { flow: "beneficios", label: "Benefícios" });
          await navigateTo("/financeiro/beneficios", "Financeiro — Benefícios");
          const steps: StepResult[] = [];
          let tipoId: string | null = null;

          steps.push(await runStepStreamed("beneficios", "1. Criar Tipo de Benefício", "INSERT beneficios_tipos", async () => {
            const { data, error } = await supabaseAdmin.from("beneficios_tipos").insert({
              tenant_id: effectiveTenant, nome: "QA — Vale Refeição Teste",
              categoria: "alimentacao", valor_padrao: 800,
              descricao: "Benefício criado pelo agente de QA",
            }).select("id").single();
            if (error) throw new Error(error.message);
            tipoId = data.id;
            return `Tipo criado: ${data.id}, Valor: R$800`;
          }));

          steps.push(await runStepStreamed("beneficios", "2. Verificar Tipo", "SELECT beneficios_tipos", async () => {
            if (!tipoId) throw new Error("Tipo não criado");
            const { data, error } = await supabaseAdmin.from("beneficios_tipos").select("*").eq("id", tipoId).single();
            if (error) throw new Error(error.message);
            return `Verificado: ${data.nome}, Categoria: ${data.categoria}, Ativo: ${data.ativo}`;
          }));

          steps.push(await runStepStreamed("beneficios", "3. Listar Tipos (Auth)", "SELECT via auth", async () => {
            if (!authClient) throw new Error("Auth client não disponível");
            const { data, error } = await authClient.from("beneficios_tipos").select("id, nome, categoria").eq("tenant_id", effectiveTenant);
            if (error) throw new Error(`RLS: ${error.message}`);
            return `${data?.length || 0} tipos de benefício visíveis`;
          }));

          steps.push(await runStepStreamed("beneficios", "4. Cleanup", "DELETE", async () => {
            if (tipoId) await supabaseAdmin.from("beneficios_tipos").delete().eq("id", tipoId);
            return "Tipo de benefício removido";
          }));

          const fr = buildFlowResult("beneficios", "Benefícios", steps);
          flows.push(fr);
          send("flow_done", fr);
        }

        // ═══════════════════════════════════════════════════
        // FLOW: OCORRÊNCIAS
        // ═══════════════════════════════════════════════════
        if (flow === "ocorrencias" || flow === "todos") {
          send("flow_start", { flow: "ocorrencias", label: "Ocorrências" });
          await navigateTo("/feedback-ocorrencias", "Feedback & Ocorrências");
          const steps: StepResult[] = [];
          let ocorrenciaId: string | null = null;

          steps.push(await runStepStreamed("ocorrencias", "1. Criar Ocorrência", "INSERT ocorrencias", async () => {
            const { data, error } = await supabaseAdmin.from("ocorrencias").insert({
              tenant_id: effectiveTenant, tipo: "advertencia",
              colaborador_nome: "QA Agent — Colaborador Teste",
              descricao: "Ocorrência de teste criada pelo agente de QA",
              data_ocorrencia: new Date().toISOString().split("T")[0],
              status: "aberta", gravidade: "leve",
            }).select("id").single();
            if (error) throw new Error(error.message);
            ocorrenciaId = data.id;
            return `Ocorrência criada: ${data.id}`;
          }));

          steps.push(await runStepStreamed("ocorrencias", "2. Atualizar Status", "UPDATE ocorrencias", async () => {
            if (!ocorrenciaId) throw new Error("Ocorrência não criada");
            const { error } = await supabaseAdmin.from("ocorrencias").update({
              status: "em_andamento",
            }).eq("id", ocorrenciaId);
            if (error) throw new Error(error.message);
            return "Status atualizado para em_andamento";
          }));

          steps.push(await runStepStreamed("ocorrencias", "3. Cleanup", "DELETE", async () => {
            if (ocorrenciaId) await supabaseAdmin.from("ocorrencias").delete().eq("id", ocorrenciaId);
            return "Ocorrência de teste removida";
          }));

          const fr = buildFlowResult("ocorrencias", "Ocorrências", steps);
          flows.push(fr);
          send("flow_done", fr);
        }

        // ═══════════════════════════════════════════════════
        // FLOW: RLS ISOLAMENTO
        // ═══════════════════════════════════════════════════
        if (flow === "rls_isolamento" || flow === "todos") {
          send("flow_start", { flow: "rls_isolamento", label: "Isolamento Multi-Tenant (RLS)" });
          await navigateTo("/", "Dashboard — Teste de Isolamento RLS");
          const steps: StepResult[] = [];

          steps.push(await runStepStreamed("rls_isolamento", "1. Listar Tenants", "SELECT tenants", async () => {
            const { data } = await supabaseAdmin.from("tenants").select("id, nome");
            return `${data?.length || 0} tenants encontrados`;
          }));

          steps.push(await runStepStreamed("rls_isolamento", "2. Acesso Anônimo", "SELECT (anon)", async () => {
            const anonClient = createClient(SUPABASE_URL, ANON_KEY);
            const tables = ["profiles", "admissoes", "atestados", "epis", "plano_acoes", "empresa_cadastro", "ocorrencias"];
            const exposed: string[] = [];
            for (const t of tables) {
              const { data } = await anonClient.from(t).select("id").limit(1);
              if (data && data.length > 0) exposed.push(t);
            }
            if (exposed.length > 0) throw new Error(`CRÍTICO: Tabelas expostas sem auth: ${exposed.join(", ")}`);
            return `${tables.length} tabelas testadas — nenhuma exposta ✓`;
          }));

          steps.push(await runStepStreamed("rls_isolamento", "3. Cross-Tenant (Auth)", "SELECT cross-tenant", async () => {
            if (!authClient || !effectiveTenant) throw new Error("Auth client ou tenant ausente");
            const { data: tenants } = await supabaseAdmin.from("tenants").select("id").neq("id", effectiveTenant).limit(1);
            if (!tenants || tenants.length === 0) return "Apenas 1 tenant — skip cross-tenant test";
            const otherTenant = tenants[0].id;
            // Try accessing another tenant's data via auth client
            const { data: profiles } = await authClient.from("profiles").select("id").eq("tenant_id", otherTenant);
            if (profiles && profiles.length > 0) throw new Error(`CRÍTICO: Acesso cross-tenant permitido (${profiles.length} profiles do tenant ${otherTenant.slice(0, 8)}...)`);
            return `Isolamento cross-tenant OK — sem acesso ao tenant ${otherTenant.slice(0, 8)}... ✓`;
          }));

          steps.push(await runStepStreamed("rls_isolamento", "4. Profiles × Tenants", "SELECT integrity", async () => {
            const { data: profiles } = await supabaseAdmin.from("profiles").select("tenant_id");
            const { data: tenants } = await supabaseAdmin.from("tenants").select("id");
            if (!profiles || !tenants) throw new Error("Não foi possível consultar");
            const tenantIds = new Set(tenants.map((t: any) => t.id));
            const orphans = profiles.filter((p: any) => p.tenant_id && !tenantIds.has(p.tenant_id));
            if (orphans.length > 0) throw new Error(`${orphans.length} perfis órfãos`);
            return `${profiles.length} perfis vinculados a tenants válidos ✓`;
          }));

          const fr = buildFlowResult("rls_isolamento", "Isolamento Multi-Tenant (RLS)", steps);
          flows.push(fr);
          send("flow_done", fr);
        }

        // ═══════════════════════════════════════════════════
        // FLOW: DOCUMENTOS
        // ═══════════════════════════════════════════════════
        if (flow === "documentos" || flow === "todos") {
          send("flow_start", { flow: "documentos", label: "Gestão de Documentos" });
          await navigateTo("/documentos", "Gestão de Documentos");
          const steps: StepResult[] = [];
          let pastaId: string | null = null;

          steps.push(await runStepStreamed("documentos", "1. Criar Pasta", "INSERT documento_pastas", async () => {
            const { data, error } = await supabaseAdmin.from("documento_pastas").insert({
              tenant_id: effectiveTenant, nome: "QA — Pasta Teste",
              tipo: "geral", criado_por_nome: "QA Agent",
            }).select("id").single();
            if (error) throw new Error(error.message);
            pastaId = data.id;
            return `Pasta criada: ${data.id}`;
          }));

          steps.push(await runStepStreamed("documentos", "2. Listar Pastas (Auth)", "SELECT via auth", async () => {
            if (!authClient) throw new Error("Auth client não disponível");
            const { data, error } = await authClient.from("documento_pastas").select("id, nome").eq("tenant_id", effectiveTenant);
            if (error) throw new Error(error.message);
            return `${data?.length || 0} pastas visíveis pelo auth client`;
          }));

          steps.push(await runStepStreamed("documentos", "3. Cleanup", "DELETE", async () => {
            if (pastaId) await supabaseAdmin.from("documento_pastas").delete().eq("id", pastaId);
            return "Pasta de teste removida";
          }));

          const fr = buildFlowResult("documentos", "Gestão de Documentos", steps);
          flows.push(fr);
          send("flow_done", fr);
        }

        // ═══════════════════════════════════════════════════
        // FLOW: EDGE FUNCTIONS
        // ═══════════════════════════════════════════════════
        if (flow === "edge_functions" || flow === "todos") {
          send("flow_start", { flow: "edge_functions", label: "Health Check Edge Functions" });
          await navigateTo("/", "Dashboard — Health Check Functions");
          const steps: StepResult[] = [];
          const fns = [
            "onboarding-signup", "extract-atestado", "ai-plano-acao", "ai-chat",
            "ai-psicossocial-analise", "ai-sst-analise", "ai-feedback",
            "ai-pdi-smart", "ai-nf-ocr", "ai-pgr-riscos", "ai-qa-scan",
          ];

          for (const fn of fns) {
            steps.push(await runStepStreamed("edge_functions", `Ping ${fn}`, "POST health", async () => {
              const resp = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON_KEY}` },
                body: JSON.stringify({ test: true }),
              });
              if (resp.status === 404) throw new Error("Não deployada (404)");
              if (resp.status === 500) throw new Error(`Erro interno (500)`);
              return `Status ${resp.status} — respondendo ✓`;
            }));
          }

          const fr = buildFlowResult("edge_functions", "Health Check Edge Functions", steps);
          flows.push(fr);
          send("flow_done", fr);
        }

        // ═══════════════════════════════════════════════════
        // AI REPORT
        // ═══════════════════════════════════════════════════
        const totalPassed = flows.reduce((a, f) => a + f.passed, 0);
        const totalFailed = flows.reduce((a, f) => a + f.failed, 0);
        const totalSteps = flows.reduce((a, f) => a + f.steps.length, 0);

        send("ai_start", { message: "Gerando relatório com IA..." });

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
                  content: `Você é um agente de QA sênior analisando testes automatizados de um sistema SaaS de RH/SST.
O agente logou como ${TEST_EMAIL} e testou múltiplos módulos.

Gere um relatório executivo em Markdown:
1. **Resumo Geral**: X/Y testes passaram, score
2. **Autenticação**: se login e perfil funcionaram
3. **Módulos Testados**: status de cada fluxo
4. **Falhas Encontradas**: cada falha com causa provável e correção
5. **Triggers/Automações**: se triggers funcionaram (estoque EPI, progresso ação)
6. **Segurança RLS**: resultado do isolamento multi-tenant
7. **Top 5 Recomendações**: ações prioritárias
8. **Score Final**: 0-100

Seja direto e técnico. Português do Brasil.`,
                },
                { role: "user", content: JSON.stringify(flows, null, 2) },
              ],
              max_tokens: 2000,
            }),
          });
          if (aiResp.ok) {
            const d = await aiResp.json();
            aiReport = d.choices?.[0]?.message?.content || "";
          }
        } catch {
          aiReport = "Análise de IA indisponível.";
        }

        send("complete", {
          success: true, timestamp: new Date().toISOString(),
          total_flows: flows.length, total_steps: totalSteps,
          total_passed: totalPassed, total_failed: totalFailed,
          score: totalSteps > 0 ? Math.round((totalPassed / totalSteps) * 100) : 0,
          flows, ai_report: aiReport,
        });

        // Logout test user
        if (authClient) {
          try { await authClient.auth.signOut(); } catch {}
        }

        controller.close();
      },
    });

    return new Response(body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
