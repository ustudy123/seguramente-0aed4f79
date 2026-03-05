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

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let payload: {
    activation_token: string;
    nome_completo: string;
    email: string;
    password: string;
    telefone?: string;
  };

  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { activation_token, nome_completo, email, password } = payload;
  if (!activation_token || !nome_completo || !email || !password) {
    return json({ error: "Missing required fields" }, 400);
  }

  // 1. Fetch cliente by token
  const { data: cliente, error: clienteError } = await admin
    .from("programa_validador_clientes")
    .select("id, nome_empresa, tenant_id, conta_ativada, activation_token_expires_at")
    .eq("activation_token", activation_token)
    .maybeSingle();

  if (clienteError || !cliente) {
    return json({ error: "Token inválido ou expirado" }, 404);
  }

  if (cliente.conta_ativada) {
    return json({ error: "Esta conta já foi ativada" }, 409);
  }

  if (cliente.activation_token_expires_at && new Date(cliente.activation_token_expires_at) < new Date()) {
    return json({ error: "Token expirado. Solicite um novo convite." }, 410);
  }

  // 2. Create auth user
  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome_completo },
  });

  if (createError || !newUser?.user) {
    // Check if email already exists
    if (createError?.message?.includes("already registered")) {
      return json({ error: "Este e-mail já está cadastrado. Faça login normalmente." }, 409);
    }
    return json({ error: createError?.message ?? "Erro ao criar usuário" }, 500);
  }

  const userId = newUser.user.id;
  const tenantId = cliente.tenant_id;

  // 3. Create profile
  const { error: profileError } = await admin.from("profiles").insert({
    user_id: userId,
    tenant_id: tenantId,
    nome_completo,
    telefone: payload.telefone || null,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return json({ error: profileError.message }, 500);
  }

  // 4. Assign owner role
  const { error: roleError } = await admin.from("user_roles").insert({
    user_id: userId,
    role: "owner",
  });

  if (roleError) {
    return json({ error: roleError.message }, 500);
  }

  // 5. Get IP from headers
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  // 6. Mark account as activated
  const { error: updateError } = await admin
    .from("programa_validador_clientes")
    .update({
      conta_ativada: true,
      conta_ativada_em: new Date().toISOString(),
      user_id: userId,
      aceite_ip: ip,
      aceite_user_agent: userAgent,
      aceite_termos_em: new Date().toISOString(),
      aceite_versao_termos: "1.0",
    } as never)
    .eq("activation_token", activation_token);

  if (updateError) {
    return json({ error: updateError.message }, 500);
  }

  // 7. Sign in the user to get session
  const { data: signInData, error: signInError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  return json({
    ok: true,
    userId,
    tenantId,
    onboardingToken: null,
    email,
  });
});
