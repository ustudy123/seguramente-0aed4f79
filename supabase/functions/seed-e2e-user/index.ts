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
//   2) TRAVA DE AMBIENTE — só roda se o projeto for o de TESTE
//      (SUPABASE_URL contém o ref do staging). Se o deploy um dia levar
//      esta função para a produção, ela se recusa a rodar lá: nunca cria
//      conta fictícia em cima de dado real de cliente.
//
// A conta e o vínculo espelham o que docs/PROMPT_INICIAL_DEV.md (seção 5)
// e supabase/seeds/staging.sql já faziam à mão: profile + papel + vínculo
// em usuarios_base, no tenant fixo da Empresa Staging.
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// .trim(): espaço/quebra de linha a mais no copiar-colar do segredo é a
// causa mais comum de "Token invalido". Mesma blindagem da qa-registrar-e2e.
const QA_E2E_TOKEN = (Deno.env.get("QA_E2E_TOKEN") ?? "").trim();

// Ref do projeto de TESTE. A função só age se estiver falando com ele.
const STAGING_REF = "bmehdgthciuvdbvutsdv";

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
  if (!SUPABASE_URL.includes(STAGING_REF)) {
    return json(
      {
        error:
          "Recusado: esta funcao so semeia conta ficticia no ambiente de " +
          "TESTE (" + STAGING_REF + "). O projeto atual nao e o de teste.",
      },
      403,
    );
  }

  let body: { email?: string; senha?: string } = {};
  try {
    const texto = await req.text();
    if (texto) body = JSON.parse(texto);
  } catch {
    return json({ error: "Corpo nao e JSON valido." }, 400);
  }

  const email = (body.email || EMAIL_PADRAO).trim();
  const senha = body.senha || SENHA_PADRAO;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
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
