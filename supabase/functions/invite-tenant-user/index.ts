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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

  // Validate caller using admin.auth.getUser with the JWT
  let callerId: string;
  try {
    const { data: callerUser, error: callerError } = await admin.auth.admin.getUserById(
      // First decode the JWT to get the sub
      JSON.parse(atob(jwt.split('.')[1])).sub
    );
    if (callerError || !callerUser?.user) {
      console.error("Caller validation error:", callerError?.message);
      return json({ error: "Invalid token" }, 401);
    }
    callerId = callerUser.user.id;
  } catch (e) {
    console.error("JWT decode error:", e);
    return json({ error: "Invalid token" }, 401);
  }

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

  // Check if email already exists - use listUsers with filter instead of loading all
  let existingUser: any = null;
  try {
    const { data: listData } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });
    // Search by email using a targeted approach
    const { data: userByEmail } = await admin
      .from("profiles")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .limit(1);
    
    // Try to find user by email directly
    const { data: allUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
    existingUser = allUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
  } catch (e) {
    console.error("Error checking existing users:", e);
  }

  if (existingUser) {
    // Check if already in this tenant
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("user_id", existingUser.id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (existingProfile) {
      // User already exists in this tenant — return their id so frontend can just link them
      return json({
        ok: true,
        userId: existingUser.id,
        inviteSent: false,
        alreadyExists: true,
      });
    }
  }

  let newUserId: string;

  try {
    if (method === "invite") {
      const { data: invitedUser, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
        email,
        {
          data: { tenant_id: tenantId, nome_completo: nomeCompleto },
          redirectTo: `${SITE_URL}/login`,
        }
      );
      if (inviteError || !invitedUser?.user) {
        console.error("Invite error:", inviteError?.message);
        // If user already exists in auth but not in this tenant, reuse
        if (inviteError?.message?.includes("already been registered") && existingUser) {
          newUserId = existingUser.id;
        } else {
          return json({ error: inviteError?.message ?? "Falha ao enviar convite" }, 500);
        }
      } else {
        newUserId = invitedUser.user.id;
      }
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
        console.error("Create error:", createError?.message);
        if (createError?.message?.includes("already been registered") && existingUser) {
          newUserId = existingUser.id;
        } else {
          return json({ error: createError?.message ?? "Falha ao criar usuário" }, 500);
        }
      } else {
        newUserId = newUser.user.id;
      }
    }
  } catch (e: any) {
    console.error("Auth operation error:", e?.message);
    return json({ error: e?.message || "Erro ao criar usuário" }, 500);
  }

  // Create profile
  const { error: profileError } = await admin.from("profiles").insert({
    user_id: newUserId!,
    tenant_id: tenantId,
    nome_completo: nomeCompleto,
  });

  if (profileError) {
    console.error("Profile error:", profileError.message);
    // If profile already exists, it's ok (user exists in another tenant scenario)
    if (!profileError.message.includes("duplicate")) {
      await admin.auth.admin.deleteUser(newUserId!);
      return json({ error: profileError.message }, 500);
    }
  }

  // Assign role
  const { error: roleError } = await admin.from("user_roles").insert({
    user_id: newUserId!,
    role,
  });

  if (roleError) {
    console.error("Role error:", roleError.message);
    // Ignore duplicate role errors
    if (!roleError.message.includes("duplicate")) {
      return json({ error: roleError.message }, 500);
    }
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
    target_id: newUserId!,
    target_name: nomeCompleto,
    metadata: { email, role, method },
  });

  // Enviar email de boas-vindas via Resend (não bloqueia o fluxo)
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (RESEND_API_KEY) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Seguramente <noreply@seguramente.app.br>",
          to: [email],
          subject: "Você foi convidado para o Seguramente",
          html: `
            <div style="font-family: 'Inter', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 28px; background: #ffffff;">
              <div style="text-align: center; margin-bottom: 8px;">
                <p style="font-size: 24px; font-weight: bold; color: hsl(262, 52%, 50%); margin: 0;">🛡️ Seguramente</p>
              </div>
              <hr style="border-color: #e8e5f0; margin: 16px 0;" />
              <h1 style="font-size: 22px; font-weight: bold; color: hsl(260, 20%, 16%); margin: 0 0 16px;">Olá, ${nomeCompleto}!</h1>
              <p style="font-size: 14px; color: hsl(260, 10%, 46%); line-height: 1.6; margin: 0 0 20px;">
                Você foi convidado(a) para acessar a plataforma <strong>Seguramente</strong>, a solução completa em Saúde e Segurança do Trabalho.
              </p>
              <p style="font-size: 14px; color: hsl(260, 10%, 46%); line-height: 1.6; margin: 0 0 20px;">
                ${method === "invite" 
                  ? "Verifique seu e-mail para o link de ativação da sua conta."
                  : "Suas credenciais foram criadas. Acesse a plataforma para começar."}
              </p>
              <div style="text-align: center; margin: 24px 0;">
                <a href="${SITE_URL}/login" style="background-color: hsl(262, 52%, 50%); color: #ffffff; font-size: 14px; font-weight: 600; border-radius: 10px; padding: 14px 28px; text-decoration: none; display: inline-block;">
                  Acessar Plataforma
                </a>
              </div>
              <hr style="border-color: #e8e5f0; margin: 16px 0;" />
              <p style="font-size: 11px; color: #b3b3b3; text-align: center; margin: 8px 0 0;">Seguramente — Plataforma de SST</p>
            </div>
          `,
        }),
      });
    } catch (emailErr) {
      console.error("Erro ao enviar email via Resend:", emailErr);
    }
  }

  return json({
    ok: true,
    userId: newUserId!,
    inviteSent: method === "invite",
  });
});
