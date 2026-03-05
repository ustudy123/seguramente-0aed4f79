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

  // Validate user from JWT
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  console.log("JWT validation result:", userError ? userError.message : "OK", "userId:", userData?.user?.id);
  if (userError || !userData?.user) {
    return json({ error: "Invalid token" }, 401);
  }

  const userId = userData.user.id;

  let payload: Payload;
  try {
    payload = await req.json();
    console.log("Payload received:", JSON.stringify(payload));
  } catch {
    return json({ error: "Invalid JSON" }, 400);
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

  // Prevent double-creation if profile already exists
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

  // Ensure tenant slug isn't already used
  const { data: existingTenant, error: existingTenantError } = await admin
    .from("tenants")
    .select("id")
    .eq("slug", tenantSlug)
    .maybeSingle();

  if (existingTenantError) {
    return json({ error: existingTenantError.message }, 500);
  }

  if (existingTenant?.id) {
    return json({ error: "Tenant slug already exists" }, 409);
  }

  // 1) Create tenant
  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .insert({ nome: tenantNome, slug: tenantSlug, plano })
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

  // 4) Create empresa_cadastro (pre-registration) if documento provided
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

  return json({ ok: true, tenantId: tenant.id }, 200);
});
