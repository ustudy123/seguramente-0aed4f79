// Supabase Edge Function: onboarding-signup
// Creates a new tenant + profile + owner role for the newly created user
// OR creates an owner for an existing tenant (when called by superadmin)
 // OR invites an owner via email for an existing tenant (invite mode)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const SITE_URL = Deno.env.get("SITE_URL") || "https://seguramente.lovable.app";

type Payload = {
  tenantNome: string;
  tenantSlug: string;
  nomeCompleto: string;
  // New fields for superadmin creating owner for existing tenant
  tenantId?: string;
  email?: string;
  password?: string;
  // Invite mode: send magic link instead of creating with password
  inviteMode?: boolean;
  // Plan for new tenant
  plano?: string;
  // Company pre-registration
  tipoPessoa?: string;
  documento?: string;
  // Fallback userId for signup flow (no session)
  userId?: string;
};

serve(async (req) => {
  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const authHeader = req.headers.get("authorization") ?? "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!jwt) {
    return json({ error: "Missing Authorization" }, 401);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let payload: Payload;
  try {
    payload = await req.json();
    console.log("Payload received:", JSON.stringify(payload));
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  // Validate user from JWT — or fall back to userId in payload (signup flow where no session exists yet)
  let userId: string;
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  console.log("JWT validation result:", userError ? userError.message : "OK", "userId:", userData?.user?.id);

  if (!userError && userData?.user) {
    userId = userData.user.id;
  } else if (payload.userId) {
    // Verify the user actually exists via admin
    const { data: fallbackUser, error: fallbackError } = await admin.auth.admin.getUserById(payload.userId);
    if (fallbackError || !fallbackUser?.user) {
      console.log("Fallback userId invalid:", payload.userId);
      return json({ error: "Invalid token" }, 401);
    }
    userId = fallbackUser.user.id;
    console.log("Using fallback userId from payload:", userId);
  } else {
    return json({ error: "Invalid token" }, 401);
  }

  const tenantNome = (payload.tenantNome ?? "").trim();
  const tenantSlug = (payload.tenantSlug ?? "").trim();
  const nomeCompleto = (payload.nomeCompleto ?? "").trim();
  const existingTenantId = (payload.tenantId ?? "").trim();
  const email = (payload.email ?? "").trim();
  const password = (payload.password ?? "").trim();
  const inviteMode = payload.inviteMode === true;
  const plano = (payload.plano ?? "starter").trim();
  const tipoPessoa = (payload.tipoPessoa ?? "").trim();
  const documento = (payload.documento ?? "").trim();

  // Mode 1: Superadmin creating owner for existing tenant (with password or invite)
  if (existingTenantId && email && nomeCompleto) {
    // Check if caller is superadmin
    const { data: superadminCheck } = await admin
      .from("superadmins")
      .select("id")
      .eq("user_id", userId)
      .eq("ativo", true)
      .maybeSingle();

    if (!superadminCheck) {
      return json({ error: "Only superadmins can create owners for existing tenants" }, 403);
    }

    let newUserId: string;

    if (inviteMode) {
      // Mode 1a: Invite user by email (magic link)
      const { data: invitedUser, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
        email,
        {
          data: {
            tenant_id: existingTenantId,
            nome_completo: nomeCompleto,
          },
          redirectTo: `${SITE_URL}/login`,
        }
      );

      if (inviteError || !invitedUser?.user) {
        return json({ error: inviteError?.message ?? "Failed to invite user" }, 500);
      }

      newUserId = invitedUser.user.id;
    } else {
      // Mode 1b: Create user with password
      if (!password) {
        return json({ error: "Password is required when not using invite mode" }, 400);
      }

      const { data: newUser, error: createUserError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (createUserError || !newUser?.user) {
        return json({ error: createUserError?.message ?? "Failed to create user" }, 500);
      }

      newUserId = newUser.user.id;
    }

    // Create profile for new user
    const { error: profileError } = await admin.from("profiles").insert({
      user_id: newUserId,
      tenant_id: existingTenantId,
      nome_completo: nomeCompleto,
    });

    if (profileError) {
      // Cleanup user if profile creation fails
      await admin.auth.admin.deleteUser(newUserId);
      return json({ error: profileError.message }, 500);
    }

    // Assign owner role
    const { error: roleError } = await admin.from("user_roles").insert({
      user_id: newUserId,
      role: "owner",
    });

    if (roleError) {
      return json({ error: roleError.message }, 500);
    }

    return json({ 
      ok: true, 
      userId: newUserId, 
      tenantId: existingTenantId,
      inviteSent: inviteMode,
    }, 200);
  }

  // Mode 2: Regular signup - create new tenant
  if (!tenantNome || !tenantSlug || !nomeCompleto) {
    return json({ error: "Missing fields" }, 400);
  }

  // Enforce slug format
  if (!/^[a-z0-9-]+$/.test(tenantSlug) || tenantSlug.length < 3) {
    return json({ error: "Invalid tenantSlug" }, 400);
  }

  // Check if CPF/CNPJ already exists in empresa_cadastro
  if (documento) {
    const docField = tipoPessoa === "pf" ? "cpf" : "cnpj";
    const { data: existingDoc } = await admin
      .from("empresa_cadastro")
      .select("id")
      .eq(docField, documento)
      .maybeSingle();

    if (existingDoc) {
      // Cleanup: delete the auth user since registration can't proceed
      await admin.auth.admin.deleteUser(userId);
      const docLabel = tipoPessoa === "pf" ? "CPF" : "CNPJ";
      return json({ error: `${docLabel} já cadastrado no sistema. Utilize outro documento ou entre em contato com o suporte.` }, 409);
    }
  }

  const { data: existingProfile, error: existingProfileError } = await admin
    .from("profiles")
    .select("id, tenant_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingProfileError) {
    return json({ error: existingProfileError.message }, 500);
  }

  if (existingProfile?.tenant_id) {
    return json({ ok: true, tenantId: existingProfile.tenant_id }, 200);
  }

  // Ensure tenant slug is unique — auto-append suffix if taken
  let finalSlug = tenantSlug;
  let slugAttempt = 0;
  while (true) {
    const { data: existingTenant, error: existingTenantError } = await admin
      .from("tenants")
      .select("id")
      .eq("slug", finalSlug)
      .maybeSingle();

    if (existingTenantError) {
      return json({ error: existingTenantError.message }, 500);
    }

    if (!existingTenant?.id) break;

    slugAttempt++;
    finalSlug = `${tenantSlug}-${slugAttempt}`;
  }

  // 1) Create tenant
  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .insert({ nome: tenantNome, slug: finalSlug, plano })
    .select("id")
    .single();

  if (tenantError || !tenant?.id) {
    return json({ error: tenantError?.message ?? "Tenant create failed" }, 500);
  }

  // 2) Create profile
  const { error: profileError } = await admin.from("profiles").insert({
    user_id: userId,
    tenant_id: tenant.id,
    nome_completo: nomeCompleto,
  });

  if (profileError) {
    // Best effort cleanup
    await admin.from("tenants").delete().eq("id", tenant.id);
    return json({ error: profileError.message }, 500);
  }

  // 3) Assign owner role
  const { error: roleError } = await admin.from("user_roles").insert({
    user_id: userId,
    role: "owner",
  });

  if (roleError) {
    return json({ error: roleError.message }, 500);
  }

  // 4) Create default perfis de acesso for the new tenant
  const defaultPerfis = [
    { nome: "Administrador Master", descricao: "Acesso total à plataforma, incluindo configurações e gestão de usuários.", cor: "#dc2626", tipo_usuario_sugerido: "admin" },
    { nome: "Gestor / Líder", descricao: "Acesso aos módulos de gestão de equipe, SST e indicadores.", cor: "#059669", tipo_usuario_sugerido: "gestor" },
    { nome: "RH / Gestão de Pessoas", descricao: "Acesso aos módulos de RH, admissões, folha e benefícios.", cor: "#7c3aed", tipo_usuario_sugerido: "rh_dp" },
    { nome: "Financeiro / Administrativo", descricao: "Acesso ao hub contábil, guias e relatórios financeiros.", cor: "#0891b2", tipo_usuario_sugerido: "financeiro" },
    { nome: "Profissional SST / Clínica", descricao: "Acesso aos módulos de SST, atestados, ergonomia e saúde.", cor: "#b45309", tipo_usuario_sugerido: "sst" },
    { nome: "Colaborador com Acesso", descricao: "Acesso básico: perfil, trilhas, bem-estar e academia.", cor: "#d97706", tipo_usuario_sugerido: "colaborador" },
    { nome: "Consultor Externo", descricao: "Acesso restrito para consultores e auditores externos.", cor: "#475569", tipo_usuario_sugerido: "consultor" },
  ];

  const { error: perfisError } = await admin
    .from("perfis_acesso")
    .insert(defaultPerfis.map(p => ({
      tenant_id: tenant.id,
      ...p,
      tipo: "padrao_sistema",
      ativo: true,
      permite_acumulo: false,
      total_usuarios: 0,
    })));

  if (perfisError) {
    console.error("Error creating default perfis_acesso:", perfisError.message);
  }

  // 5) Create empresa_cadastro (pre-registration) if documento provided
  if (documento) {
    const empresaPayload: Record<string, unknown> = {
      tenant_id: tenant.id,
      razao_social: tenantNome,
      nome_fantasia: tenantNome,
      tipo_pessoa: tipoPessoa === "pf" ? "pf" : "pj",
      cnpj: tipoPessoa === "pj" ? documento : null,
      cpf: tipoPessoa === "pf" ? documento : null,
      tipo_unidade: "matriz",
      ativo: true,
      total_colaboradores: 0,
      cnaes_secundarios: [],
      sesmt_profissionais: [],
      cipa_membros: [],
      fap_historico: [],
      tac_detalhes: [],
      turnos: [],
      condicoes_especiais_detalhes: {},
      sesmt_obrigatorio: false,
      cipa_obrigatoria: false,
      pcd_obrigatoria: false,
      pcd_quantidade_exigida: 0,
      pcd_quantidade_atual: 0,
      aprendiz_quantidade_minima: 0,
      aprendiz_quantidade_maxima: 0,
      aprendiz_quantidade_atual: 0,
      tac_possui: false,
      possui_terceiro_turno: false,
      possui_escalas_especiais: false,
      trabalho_altura: false,
      espaco_confinado: false,
      insalubridade: false,
      periculosidade: false,
      aposentadoria_especial: false,
    };

    const { error: empresaError } = await admin
      .from("empresa_cadastro")
      .insert(empresaPayload);

    if (empresaError) {
      console.error("Error creating empresa_cadastro:", empresaError.message);
      // Non-blocking: tenant and profile already created successfully
    }
  }

  // 5) Create programa_validador_clientes record for onboarding portal
  const { data: pvCliente, error: pvError } = await admin
    .from("programa_validador_clientes")
    .insert({
      tenant_id: tenant.id,
      nome_empresa: tenantNome,
      cnpj: tipoPessoa === "pj" ? documento : null,
      poc_nome: nomeCompleto,
      poc_email: email || null,
      fase: "configuracao",
      tipo_cliente: "tester",
      conta_ativada: true,
      conta_ativada_em: new Date().toISOString(),
      user_id: userId,
    })
    .select("onboarding_token")
    .single();

  let onboardingToken: string | null = null;
  if (pvError) {
    console.error("Error creating programa_validador_clientes:", pvError.message);
  } else {
    onboardingToken = pvCliente?.onboarding_token ?? null;

    // Store onboarding_token on profile for quick access
    if (onboardingToken) {
      await admin
        .from("profiles")
        .update({ onboarding_token: onboardingToken })
        .eq("user_id", userId);
    }
  }

  return json({ ok: true, tenantId: tenant.id, onboardingToken }, 200);
});
