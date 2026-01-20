// Supabase Edge Function: onboarding-signup
// Creates a new tenant + profile + owner role for the newly created user.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Payload = {
  tenantNome: string;
  tenantSlug: string;
  nomeCompleto: string;
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!jwt) {
    return new Response(JSON.stringify({ error: "Missing Authorization" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Validate user from JWT
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const tenantNome = (payload.tenantNome ?? "").trim();
  const tenantSlug = (payload.tenantSlug ?? "").trim();
  const nomeCompleto = (payload.nomeCompleto ?? "").trim();

  if (!tenantNome || !tenantSlug || !nomeCompleto) {
    return new Response(JSON.stringify({ error: "Missing fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Enforce slug format
  if (!/^[a-z0-9-]+$/.test(tenantSlug) || tenantSlug.length < 3) {
    return new Response(JSON.stringify({ error: "Invalid tenantSlug" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userId = userData.user.id;

  // Prevent double-creation if profile already exists
  const { data: existingProfile, error: existingProfileError } = await admin
    .from("profiles")
    .select("id, tenant_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingProfileError) {
    return new Response(JSON.stringify({ error: existingProfileError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (existingProfile?.tenant_id) {
    return new Response(
      JSON.stringify({ ok: true, tenantId: existingProfile.tenant_id }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Ensure tenant slug isn't already used
  const { data: existingTenant, error: existingTenantError } = await admin
    .from("tenants")
    .select("id")
    .eq("slug", tenantSlug)
    .maybeSingle();

  if (existingTenantError) {
    return new Response(JSON.stringify({ error: existingTenantError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (existingTenant?.id) {
    return new Response(
      JSON.stringify({ error: "Tenant slug already exists" }),
      {
        status: 409,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // 1) Create tenant
  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .insert({ nome: tenantNome, slug: tenantSlug })
    .select("id")
    .single();

  if (tenantError || !tenant?.id) {
    return new Response(JSON.stringify({ error: tenantError?.message ?? "Tenant create failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
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
    return new Response(JSON.stringify({ error: profileError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 3) Assign owner role
  const { error: roleError } = await admin.from("user_roles").insert({
    user_id: userId,
    role: "owner",
  });

  if (roleError) {
    return new Response(JSON.stringify({ error: roleError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, tenantId: tenant.id }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
