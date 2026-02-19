import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

  const authHeader = req.headers.get("authorization") ?? "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!jwt) return json({ error: "Missing Authorization" }, 401);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Validate caller
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userData?.user) return json({ error: "Invalid token" }, 401);
  const callerId = userData.user.id;

  // Get caller's tenant
  const { data: callerProfile } = await admin
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", callerId)
    .single();
  if (!callerProfile?.tenant_id) return json({ error: "Caller has no tenant" }, 403);
  const tenantId = callerProfile.tenant_id;

  // Check caller is admin/owner/superadmin
  const { data: callerRoles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId);
  const roles = callerRoles?.map((r) => r.role) || [];
  const isOwnerOrAdmin = roles.includes("owner") || roles.includes("admin");

  const { data: superCheck } = await admin
    .from("superadmins")
    .select("id")
    .eq("user_id", callerId)
    .eq("ativo", true)
    .maybeSingle();

  if (!isOwnerOrAdmin && !superCheck) {
    return json({ error: "Sem permissão" }, 403);
  }

  let payload: { action: string; [key: string]: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { action } = payload;

  // ─── LIST USERS WITH EMAILS & STATUS ───
  if (action === "list") {
    const { data: profiles } = await admin
      .from("profiles")
      .select("user_id, nome_completo")
      .eq("tenant_id", tenantId)
      .order("nome_completo");

    if (!profiles || profiles.length === 0) return json({ users: [] });

    const userIds = profiles.map((p) => p.user_id);

    // Get roles
    const { data: allRoles } = await admin
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", userIds);

    const roleMap: Record<string, string[]> = {};
    allRoles?.forEach((r) => {
      if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
      roleMap[r.user_id].push(r.role);
    });

    // Get auth user details (email, confirmation status)
    const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const authMap: Record<string, { email: string; confirmed: boolean; last_sign_in: string | null }> = {};
    authUsers?.users?.forEach((u) => {
      authMap[u.id] = {
        email: u.email || "",
        confirmed: !!u.email_confirmed_at,
        last_sign_in: u.last_sign_in_at || null,
      };
    });

    const users = profiles.map((p) => ({
      user_id: p.user_id,
      nome_completo: p.nome_completo,
      email: authMap[p.user_id]?.email || "",
      roles: roleMap[p.user_id] || ["user"],
      confirmed: authMap[p.user_id]?.confirmed ?? false,
      last_sign_in: authMap[p.user_id]?.last_sign_in || null,
    }));

    return json({ users });
  }

  // ─── UPDATE ROLE ───
  if (action === "update_role") {
    const { userId, newRole } = payload as { userId: string; newRole: string; action: string };
    if (!userId || !newRole) return json({ error: "userId e newRole obrigatórios" }, 400);
    if (!["admin", "manager", "user"].includes(newRole)) {
      return json({ error: "Role inválida" }, 400);
    }

    // Verify target user belongs to same tenant
    const { data: targetProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!targetProfile) return json({ error: "Usuário não pertence a este tenant" }, 403);

    // Cannot change owner role (only superadmin can)
    const { data: targetRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (targetRoles?.some((r) => r.role === "owner") && !superCheck) {
      return json({ error: "Não é possível alterar role de owner" }, 403);
    }

    // Don't allow changing own role
    if (userId === callerId) {
      return json({ error: "Não é possível alterar sua própria role" }, 400);
    }

    // Delete existing non-owner roles and insert new one
    await admin
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .neq("role", "owner");

    const { error: roleError } = await admin
      .from("user_roles")
      .insert({ user_id: userId, role: newRole });

    if (roleError) return json({ error: roleError.message }, 500);

    // Audit log
    await admin.from("audit_logs").insert({
      tenant_id: tenantId,
      user_id: callerId,
      user_name: userData.user.user_metadata?.nome_completo || userData.user.email,
      user_email: userData.user.email,
      action: "user.role_updated",
      module: "equipe",
      description: `Alterou perfil de acesso para "${newRole}"`,
      target_type: "user",
      target_id: userId,
      target_name: (await admin.from("profiles").select("nome_completo").eq("user_id", userId).single()).data?.nome_completo || userId,
      metadata: { old_roles: targetRoles?.map(r => r.role), new_role: newRole },
    });

    return json({ ok: true });
  }

  // ─── REMOVE USER FROM TENANT ───
  if (action === "remove") {
    const { userId } = payload as { userId: string; action: string };
    if (!userId) return json({ error: "userId obrigatório" }, 400);

    // Cannot remove yourself
    if (userId === callerId) {
      return json({ error: "Não é possível remover a si mesmo" }, 400);
    }

    // Verify target user belongs to same tenant
    const { data: targetProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!targetProfile) return json({ error: "Usuário não pertence a este tenant" }, 403);

    // Cannot remove owner
    const { data: targetRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (targetRoles?.some((r) => r.role === "owner")) {
      return json({ error: "Não é possível remover o owner da empresa" }, 403);
    }

    // Get target name before deleting
    const { data: targetProfileData } = await admin.from("profiles").select("nome_completo").eq("user_id", userId).single();
    const targetName = targetProfileData?.nome_completo || userId;

    // Delete profile (removes from tenant)
    await admin.from("profiles").delete().eq("user_id", userId).eq("tenant_id", tenantId);
    // Delete roles
    await admin.from("user_roles").delete().eq("user_id", userId);

    // Audit log
    await admin.from("audit_logs").insert({
      tenant_id: tenantId,
      user_id: callerId,
      user_name: userData.user.user_metadata?.nome_completo || userData.user.email,
      user_email: userData.user.email,
      action: "user.removed",
      module: "equipe",
      description: `Removeu "${targetName}" do sistema`,
      target_type: "user",
      target_id: userId,
      target_name: targetName,
    });

    return json({ ok: true });
  }

  // ─── RESEND INVITE ───
  if (action === "resend_invite") {
    const { userId } = payload as { userId: string; action: string };
    if (!userId) return json({ error: "userId obrigatório" }, 400);

    // Get user email
    const { data: authUser, error: authError } = await admin.auth.admin.getUserById(userId);
    if (authError || !authUser?.user) return json({ error: "Usuário não encontrado" }, 404);

    const email = authUser.user.email;
    if (!email) return json({ error: "Usuário sem e-mail" }, 400);

    // Already confirmed
    if (authUser.user.email_confirmed_at) {
      return json({ error: "Usuário já confirmou o e-mail" }, 400);
    }

    // Resend invite
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: (Deno.env.get("SITE_URL") || "https://seguramente.lovable.app") + "/login",
    });

    if (inviteError) return json({ error: inviteError.message }, 500);

    // Audit log
    await admin.from("audit_logs").insert({
      tenant_id: tenantId,
      user_id: callerId,
      user_name: userData.user.user_metadata?.nome_completo || userData.user.email,
      user_email: userData.user.email,
      action: "user.invite_resent",
      module: "equipe",
      description: `Reenviou convite para "${email}"`,
      target_type: "user",
      target_id: userId,
      target_name: email,
    });

    return json({ ok: true });
  }

  return json({ error: "Ação desconhecida" }, 400);
});
