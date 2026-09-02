// =====================================================================
// seed-e2e-user — garante a conta-robô que a suíte Cypress usa para logar
//
// O problema que resolve: a suíte de TELA loga com uma conta fixa (o
// padrão em cypress.config.ts — teste@lucas.com). Essa conta não era
// criada por ninguém: nem migration, nem seed, nem a esteira. Resultado:
// o login falhava em silêncio, o token de sessão nunca aparecia, o
// `beforeEach` de CADA spec estourava e o Cypress derrubava o arquivo
// inteiro — 5 falhas + o resto "pulado". Esta função cria/atualiza essa
// conta a cada corrida, já vinculada à Empresa Staging, de forma
// idempotente, e a deixa pronta para entrar.
//
// Dois portões, como o resto da casa:
//   1) TOKEN combinado — x-qa-token == QA_E2E_TOKEN (o MESMO segredo da
//      qa-registrar-e2e; segredos de Edge Function são por projeto). Sem
//      ele, recusa. Um endpoint aberto de criação de usuário seria um
//      problema permanente.
//   2) TRAVA DE AMBIENTE — só roda no TESTE (staging) ou na HOMOLOGAÇÃO,
//      os dois ambientes sem dado real (fictício no teste, mascarado na
//      homologação). Se o deploy um dia levar esta função para a produção,
//      ela se recusa: nunca cria conta fictícia em cima de dado real.
//
// A conta e o vínculo espelham o que docs/PROMPT_INICIAL_DEV.md (seção 5)
// e supabase/seeds/staging.sql já faziam à mão: profile + papel + vínculo
// em usuarios_base, no tenant fixo da Empresa Staging. Além da conta, esta
// função planta as FIXTURES PROFUNDAS da ilha (departamentos, cargos e 20
// colaboradores) — o staging as tem do seed manual e persiste; a homologação
// é recriada a cada RECRIAR e chegaria sem elas, e sem colaborador o spec de
// Desligamento não acha ninguém para desligar.
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// .trim(): espaço/quebra de linha a mais no copiar-colar do segredo é a
// causa mais comum de "Token invalido". Mesma blindagem da qa-registrar-e2e.
const QA_E2E_TOKEN = (Deno.env.get("QA_E2E_TOKEN") ?? "").trim();

// Refs onde é seguro semear conta e dados fictícios: o TESTE (staging) e a
// HOMOLOGAÇÃO. Os dois só têm dado fictício (teste) ou mascarado (homologação),
// nunca dado real de cliente. É uma ALLOWLIST, não uma denylist: ambiente novo
// só entra aqui de propósito — o que esquecêssemos de listar é recusado, não
// liberado. A produção NÃO está na lista, e ainda é barrada explicitamente
// pela constante abaixo (duas provas para o pior caso: semear sobre dado real).
const REFS_PERMITIDOS = [
  "bmehdgthciuvdbvutsdv", // teste (staging)
  "fgsblefvdabgdouipigz", // homologação
];
const REF_PRODUCAO = "diayjpsrcerycycyaxst";

// Fixtures da Empresa Staging — os mesmos IDs de supabase/seeds/staging.sql,
// para a conta cair no tenant que o resto do ambiente de teste já usa.
const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const EMPRESA_ID = "22222222-2222-2222-2222-222222222222";

// Padrão idêntico ao de cypress.config.ts. Se a esteira mandar email/senha
// no corpo (quando alguém setar os secrets CYPRESS_*), esses vencem — assim
// a conta semeada e a conta que loga são sempre a mesma, sem drift.
const EMAIL_PADRAO = "teste@lucas.com";
const SENHA_PADRAO = "7654321";
// CPF fictício com dígito verificador válido, reservado para o robô (fora
// dos exemplos de docs/PROMPT_INICIAL_DEV.md, para não colidir com contas
// criadas à mão).
const CPF_ROBO = "90000010642";

// Fixtures profundas da ilha (os MESMOS dados de supabase/seeds/staging.sql,
// seções 3–6). Um departamento -> um cargo; 20 colaboradores com CPF fictício
// de DV válido. Ficam aqui para o TESTE e a HOMOLOGAÇÃO terem a mesma ilha.
const DEPARTAMENTOS = [
  { nome: "Administrativo", descricao: "Gestão administrativa e financeira" },
  { nome: "Recursos Humanos", descricao: "Departamento pessoal e SST" },
  { nome: "Operações", descricao: "Operações e produção" },
  { nome: "Tecnologia", descricao: "Desenvolvimento e infraestrutura" },
];
// Mapa departamento -> cargo, na MESMA ordem do CASE de staging.sql (n % 4:
// 0 Financeiro, 1 RH, 2 Produção, 3 Full Stack).
const CARGOS = [
  "Analista Financeiro",
  "Analista de RH",
  "Operador de Produção",
  "Desenvolvedor Full Stack",
];
const DEPTOS = ["Administrativo", "Recursos Humanos", "Operações", "Tecnologia"];
const CPFS_COLAB = [
  "90000000175", "90000000256", "90000000337", "90000000418", "90000000507",
  "90000000680", "90000000760", "90000000841", "90000000922", "90000001066",
  "90000001147", "90000001228", "90000001309", "90000001490", "90000001570",
  "90000001651", "90000001732", "90000001813", "90000001902", "90000002038",
];
const AI_CONTEXT =
  "Empresa de tecnologia e serviços de SST. Processos: financeiros, DP, " +
  "operação de produção e desenvolvimento de software. Atividades esperadas: " +
  "contas a pagar/receber, folha de pagamento, admissão/demissão, controle de " +
  "EPIs, desenvolvimento de funcionalidades, suporte a clientes internos.";

// Cliente admin tipado sem importar o tipo (evita mais um import de esm.sh).
// Cliente admin sem tipos gerados: o schema do projeto não é conhecido aqui.
// deno-lint-ignore-next-line no-explicit-any
type Admin = ReturnType<typeof createClient<any, "public", any>>;

// Planta departamentos, cargos e 20 colaboradores no tenant fixo da ilha.
// Idempotente (só insere onde ainda não há nada) e chamada de forma NÃO-FATAL:
// o login já funciona sem isto, então nada aqui pode derrubar o seed.
async function semearFixturesProfundas(admin: Admin, userId: string) {
  // Departamentos — só se o tenant ainda não tiver nenhum.
  const { data: deptExist } = await admin
    .from("departamentos").select("id").eq("tenant_id", TENANT_ID).limit(1);
  if (!deptExist || deptExist.length === 0) {
    const { error } = await admin.from("departamentos").insert(
      DEPARTAMENTOS.map((d) => ({
        tenant_id: TENANT_ID, empresa_id: EMPRESA_ID,
        nome: d.nome, descricao: d.descricao, ativo: true,
      })),
    );
    if (error) console.error("departamentos:", error.message);
  }

  // Relê para pegar os ids (recém-criados ou já existentes) e ligar os cargos.
  const { data: depts } = await admin
    .from("departamentos").select("id, nome").eq("tenant_id", TENANT_ID);

  // Cargos — um por departamento, só se ainda não houver cargos.
  const { data: cargoExist } = await admin
    .from("cargos").select("id").eq("tenant_id", TENANT_ID).limit(1);
  if ((!cargoExist || cargoExist.length === 0) && depts && depts.length > 0) {
    const linhas = depts
      .map((d) => {
        const i = DEPTOS.indexOf(d.nome as string);
        if (i < 0) return null;
        return {
          tenant_id: TENANT_ID, empresa_id: EMPRESA_ID,
          nome: CARGOS[i],
          descricao: "Cargo de testes para ambiente de teste",
          departamento_id: d.id, ativo: true,
          objetivo_funcao: "Objetivo genérico da função",
          escopo_geral: "Escopo genérico da função",
          responsabilidade: "Responsabilidade genérica",
          nivel: "pleno",
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    if (linhas.length > 0) {
      const { error } = await admin.from("cargos").insert(linhas);
      if (error) console.error("cargos:", error.message);
    }
  }

  // Colaboradores (admissões concluídas) — só se o tenant ainda não tiver
  // nenhuma admissão, para não duplicar a cada corrida.
  const { data: admExist } = await admin
    .from("admissoes").select("id").eq("tenant_id", TENANT_ID).limit(1);
  if (!admExist || admExist.length === 0) {
    const linhas = CPFS_COLAB.map((cpf, idx) => {
      const n = idx + 1;
      return {
        tenant_id: TENANT_ID, empresa_id: EMPRESA_ID,
        status: "concluido",
        nome_completo: "Colaborador " + n,
        cpf,
        data_nascimento: "1990-01-01",
        estado_civil: "solteiro",
        genero: "masculino",
        email: "colaborador" + n + "@youreyes.local",
        telefone: "(11) 99999-" + String(n).padStart(4, "0"),
        cidade: "São Paulo", estado: "SP",
        cargo: CARGOS[n % 4], departamento: DEPTOS[n % 4],
        data_admissao: "2024-01-01",
        tipo_contrato: "CLT", jornada_trabalho: "8h diárias",
        salario: 5000,
        gestor_imediato: "Gestor Staging",
        // criado_por aponta para o próprio robô (existe em auth.users). O
        // staging.sql usava um uuid-zero de placeholder, que só não quebra
        // porque a coluna não tem FK; usar o robô é o valor correto e seguro.
        criado_por: userId,
      };
    });
    const { error } = await admin.from("admissoes").insert(linhas);
    if (error) console.error("admissoes (colaboradores):", error.message);
  }

  // Contexto de IA da empresa (specs de geração de função leem isto).
  const { error: aiErr } = await admin
    .from("empresa_cadastro").update({ ai_context: AI_CONTEXT }).eq("id", EMPRESA_ID);
  if (aiErr) console.error("ai_context:", aiErr.message);
}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-qa-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  // ── Portão 1: token combinado ──
  if (!QA_E2E_TOKEN) {
    return json(
      { error: "QA_E2E_TOKEN nao configurado neste projeto. Seed recusado." },
      503,
    );
  }
  if ((req.headers.get("x-qa-token") ?? "").trim() !== QA_E2E_TOKEN) {
    return json(
      {
        error:
          "Token invalido: o valor de QA_E2E_TOKEN no GitHub difere do " +
          "valor no Supabase. Confira que sao identicos nos dois lugares.",
      },
      401,
    );
  }

  // ── Portão 2: trava de ambiente (nunca semear produção) ──
  // Primeiro a recusa explícita da produção: mesmo que alguém um dia inclua o
  // ref dela em REFS_PERMITIDOS por engano, esta linha barra antes.
  if (SUPABASE_URL.includes(REF_PRODUCAO)) {
    return json(
      { error: "Recusado: esta funcao NUNCA semeia conta ficticia na PRODUCAO." },
      403,
    );
  }
  if (!REFS_PERMITIDOS.some((ref) => SUPABASE_URL.includes(ref))) {
    return json(
      {
        error:
          "Recusado: esta funcao so semeia no TESTE ou na HOMOLOGACAO. " +
          "O projeto atual nao e nenhum dos dois.",
      },
      403,
    );
  }

  // O corpo é um override OPCIONAL das credenciais. Se vier vazio ou
  // ilegível, NÃO derruba o seed: segue com os padrões (os mesmos de
  // cypress.config.ts). Um corpo que não parseia nunca deve impedir a
  // conta-robô de existir — isso só recriaria a falha de login que a
  // função existe para evitar. Loga o bruto para diagnóstico.
  let body: { email?: string; senha?: string } = {};
  const bruto = (await req.text()).trim();
  if (bruto) {
    try {
      body = JSON.parse(bruto);
    } catch (e) {
      console.warn(
        "Corpo ignorado (nao-JSON), usando credenciais padrao:",
        (e as Error).message,
        "| primeiros 80 chars:",
        bruto.slice(0, 80),
      );
    }
  }

  const email = (body.email || EMAIL_PADRAO).trim();
  const senha = body.senha || SENHA_PADRAO;

  // deno-lint-ignore-next-line no-explicit-any
  const admin = createClient<any, "public", any>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // 1) Garante o tenant da Empresa Staging. Confere-e-insere (não upsert):
    //    no caminho normal a linha já existe, então nada é inserido e não há
    //    risco de esbarrar em NOT NULL de coluna omitida. Só um banco de teste
    //    zerado cai no INSERT — e aí seguimos o seed canônico (staging.sql).
    const { data: tExist } = await admin
      .from("tenants")
      .select("id")
      .eq("id", TENANT_ID)
      .maybeSingle();
    if (!tExist) {
      const { error: tErr } = await admin.from("tenants").insert({
        id: TENANT_ID,
        nome: "Empresa Staging LTDA",
        slug: "empresa-staging",
        plano: "enterprise",
        ativo: true,
        configuracoes: { demo: true, ambiente: "staging" },
      });
      if (tErr) throw new Error("tenants: " + tErr.message);
    }

    // 2) Garante a empresa (matriz). Sem empresa vinculada, os painéis
    //    filtrados pela empresa do topo mostram "Acesso Restrito".
    const { data: eExist } = await admin
      .from("empresa_cadastro")
      .select("id")
      .eq("id", EMPRESA_ID)
      .maybeSingle();
    if (!eExist) {
      const { error: eErr } = await admin.from("empresa_cadastro").insert({
        id: EMPRESA_ID,
        tenant_id: TENANT_ID,
        razao_social: "Empresa Staging LTDA",
        nome_fantasia: "Empresa Staging",
        cnpj: "00.000.000/0001-00",
        cidade: "São Paulo",
        estado: "SP",
        cep: "01000-000",
        telefone: "(11) 99999-9999",
        email: "staging@youreyes.local",
        cnae_principal: "6201501",
        cnae_descricao: "Desenvolvimento de programas de computador sob encomenda",
        grau_risco: 2,
        tipo_pessoa: "juridica",
        tipo_unidade: "matriz",
        ativo: true,
      });
      if (eErr) throw new Error("empresa_cadastro: " + eErr.message);
    }

    // 2b) AMBIENTE DETERMINÍSTICO (uma empresa ativa só).
    //     A conta-robô tem acesso global e enxerga TODAS as empresas ATIVAS do
    //     tenant. Se corridas antigas (ou o onboarding) deixaram empresas
    //     extras, a lista/ordenação de empresas oscila durante o login: a
    //     "empresa ativa" pisca (o EmpresaAtivaContext re-seleciona empresas[0]
    //     a cada mudança da lista) e o EmpresaSelector fica em "Sincronizando
    //     empresas". Pior: um GHE criado sob a empresa A "some" da listagem
    //     quando a ativa troca para B, porque a lista de GHE filtra por
    //     empresa_id — daí o falso "Nenhum GHE cadastrado" que derrubava os
    //     testes de GHE. Garantindo UMA única empresa ativa, não há o que
    //     oscilar. É seguro: o portão STAGING_REF acima recusa fora do staging,
    //     e mexemos apenas no tenant fixo de teste. Não-fatal por design
    //     (console.error): o login já funciona sem isto, é só estabilidade.
    const { error: reErr } = await admin
      .from("empresa_cadastro")
      .update({ ativo: true })
      .eq("id", EMPRESA_ID)
      .eq("tenant_id", TENANT_ID);
    if (reErr) console.error("empresa_cadastro(reativar matriz):", reErr.message);

    const { error: offErr } = await admin
      .from("empresa_cadastro")
      .update({ ativo: false })
      .eq("tenant_id", TENANT_ID)
      .neq("id", EMPRESA_ID)
      .eq("ativo", true);
    if (offErr) console.error("empresa_cadastro(desativar extras):", offErr.message);

    // 3) Conta de autenticação. Cria se não existe; se existe, garante a
    //    senha e o e-mail confirmado (sem confirmação, o login nunca entra).
    let userId: string;
    const { data: lista, error: lErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (lErr) throw new Error("listUsers: " + lErr.message);

    const existente = lista?.users?.find(
      (u) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
    );

    if (existente) {
      userId = existente.id;
      const { error: uErr } = await admin.auth.admin.updateUserById(userId, {
        password: senha,
        email_confirm: true,
      });
      if (uErr) throw new Error("updateUserById: " + uErr.message);
    } else {
      const { data: novo, error: cErr } = await admin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        user_metadata: { nome_completo: "Robô de Testes (Cypress)" },
      });
      if (cErr) throw new Error("createUser: " + cErr.message);
      userId = novo.user!.id;
    }

    // 4) Perfil ligado ao tenant.
    const { error: pErr } = await admin.from("profiles").upsert(
      {
        user_id: userId,
        tenant_id: TENANT_ID,
        nome_completo: "Robô de Testes (Cypress)",
        onboarding_concluido: true,
      },
      { onConflict: "user_id" },
    );
    if (pErr) throw new Error("profiles: " + pErr.message);

    // 5) Papel amplo — a suíte percorre muitos módulos, então o robô é owner.
    const { error: rErr } = await admin
      .from("user_roles")
      .upsert({ user_id: userId, role: "owner" }, { onConflict: "user_id,role" });
    if (rErr) throw new Error("user_roles: " + rErr.message);

    // 6) Vínculo em usuarios_base (o app resolve o tenant também por aqui).
    //    Idempotente por auth_user_id: existe -> atualiza; senão -> insere.
    const { data: ub } = await admin
      .from("usuarios_base")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (ub) {
      const { error: ubErr } = await admin
        .from("usuarios_base")
        .update({
          tenant_id: TENANT_ID,
          nome_completo: "Robô de Testes (Cypress)",
          email_principal: email,
          tipo_usuario: "administrador",
          status: "ativo",
        })
        .eq("auth_user_id", userId);
      if (ubErr) throw new Error("usuarios_base(update): " + ubErr.message);
    } else {
      const { error: ubErr } = await admin.from("usuarios_base").insert({
        tenant_id: TENANT_ID,
        auth_user_id: userId,
        nome_completo: "Robô de Testes (Cypress)",
        email_principal: email,
        cpf: CPF_ROBO,
        tipo_usuario: "administrador",
        status: "ativo",
      });
      // CPF já em uso por outra conta de teste não deve derrubar o seed: o
      // login já funciona com profile + papel. Só registra e segue.
      if (ubErr) console.error("usuarios_base(insert):", ubErr.message);
    }

    // 7) Fixtures profundas da ilha (departamentos, cargos, colaboradores).
    //    NÃO-FATAL: envolto em try/catch para nunca impedir a conta-robô de
    //    existir. Em staging as fixtures já existem (idempotente = pula); na
    //    homologação recém-recriada, é aqui que os colaboradores nascem.
    try {
      await semearFixturesProfundas(admin, userId);
    } catch (e) {
      console.error("Fixtures profundas (nao-fatal):", (e as Error).message);
    }

    return json({
      ok: true,
      email,
      user_id: userId,
      tenant_id: TENANT_ID,
      mensagem: "Conta-robô pronta para a suíte Cypress entrar.",
    });
  } catch (erro) {
    console.error("Falha ao semear a conta de teste:", erro);
    return json({ error: (erro as Error).message }, 500);
  }
});
