import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") || "https://seguramente.lovable.app";

type Payload = {
  email: string;
  nomeCompleto: string;
  role: "admin" | "manager" | "user";
  method: "invite" | "password";
  password?: string;
};

serve(async (req) => {
  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

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
  const callerClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(jwt);
  if (claimsError || !claimsData?.claims) return json({ error: "Invalid token" }, 401);
  const callerId = claimsData.claims.sub as string;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Get full user data for audit logs
  const { data: userData } = await admin.auth.admin.getUserById(callerId);

  // Get caller's tenant and role
  const { data: callerProfile } = await admin
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", callerId)
    .single();

  if (!callerProfile?.tenant_id) return json({ error: "Caller has no tenant" }, 403);

  // Check caller is at least admin
  const { data: callerRoles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId);

  const roles = callerRoles?.map((r) => r.role) || [];
  const isOwnerOrAdmin = roles.includes("owner") || roles.includes("admin");
  // Also check superadmin
  const { data: superCheck } = await admin
    .from("superadmins")
    .select("id")
    .eq("user_id", callerId)
    .eq("ativo", true)
    .maybeSingle();

  if (!isOwnerOrAdmin && !superCheck) {
    return json({ error: "Sem permissão para convidar usuários" }, 403);
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { email, nomeCompleto, role, method, password } = payload;

  if (!email || !nomeCompleto || !role) {
    return json({ error: "Campos obrigatórios: email, nomeCompleto, role" }, 400);
  }

  // Owners can only be created by superadmin (via the other function)
  if (role === "owner") {
    return json({ error: "Não é possível criar owners por esta função" }, 400);
  }

  const tenantId = callerProfile.tenant_id;

  // Check if email already exists as a user in this tenant
  const { data: existingUsers } = await admin.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (existingUser) {
    // Check if already in this tenant
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("user_id", existingUser.id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (existingProfile) {
      return json({ error: "Este e-mail já possui acesso a esta empresa" }, 409);
    }
  }

  let newUserId: string;

  if (method === "invite") {
    const { data: invitedUser, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      email,
      {
        data: { tenant_id: tenantId, nome_completo: nomeCompleto },
        redirectTo: `${SITE_URL}/login`,
      }
    );
    if (inviteError || !invitedUser?.user) {
      return json({ error: inviteError?.message ?? "Falha ao enviar convite" }, 500);
    }
    newUserId = invitedUser.user.id;
  } else {
    if (!password || password.length < 6) {
      return json({ error: "Senha deve ter no mínimo 6 caracteres" }, 400);
    }
    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError || !newUser?.user) {
      return json({ error: createError?.message ?? "Falha ao criar usuário" }, 500);
    }
    newUserId = newUser.user.id;
  }

  // Create profile
  const { error: profileError } = await admin.from("profiles").insert({
    user_id: newUserId,
    tenant_id: tenantId,
    nome_completo: nomeCompleto,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(newUserId);
    return json({ error: profileError.message }, 500);
  }

  // Assign role
  const { error: roleError } = await admin.from("user_roles").insert({
    user_id: newUserId,
    role,
  });

  if (roleError) {
    return json({ error: roleError.message }, 500);
  }

  // Audit log
  await admin.from("audit_logs").insert({
    tenant_id: tenantId,
    user_id: callerId,
    user_name: userData?.user?.user_metadata?.nome_completo || userData?.user?.email,
    user_email: userData?.user?.email,
    action: method === "invite" ? "user.invited" : "user.created",
    module: "equipe",
    description: method === "invite"
      ? `Convidou "${nomeCompleto}" (${email}) com perfil "${role}"`
      : `Criou usuário "${nomeCompleto}" (${email}) com perfil "${role}"`,
    target_type: "user",
    target_id: newUserId,
    target_name: nomeCompleto,
    metadata: { email, role, method },
  });

  return json({
    ok: true,
    userId: newUserId,
    inviteSent: method === "invite",
  });
});
