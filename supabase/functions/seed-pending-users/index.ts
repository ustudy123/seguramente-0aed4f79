import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const TENANT_ID = "299779a8-1cd2-4ffe-9462-78181426cd1a";
  const DEFAULT_PASSWORD = "Mudar123";

  const pendingUsers = [
    { id: "7973595c-5d29-4add-a9ec-f1d542492eea", email: "adriano_nuernberg@hotmail.com", nome: "Adriano Cássio Nuernberg" },
    { id: "56a676bb-f63a-4d78-8881-0e19c42d7d61", email: "alexandreambiental30@gmail.com", nome: "Alexandre Miguel Figueira de Barros" },
    { id: "35dba579-5cc8-4255-bb38-1fc2b42438c3", email: "tecnico.capanema@sudomed.com.br", nome: "Cassiano Henrique Rodrigues Silva" },
  ];

  const results = [];

  for (const u of pendingUsers) {
    try {
      // Create auth user
      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        email: u.email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: { nome_completo: u.nome },
      });

      if (createError) {
        results.push({ email: u.email, error: createError.message });
        continue;
      }

      const authUserId = newUser.user.id;

      // Update usuarios_base with auth_user_id
      const { error: updateError } = await admin
        .from("usuarios_base")
        .update({
          auth_user_id: authUserId,
          status: "ativo",
          email_validado: true,
        })
        .eq("id", u.id);

      if (updateError) {
        results.push({ email: u.email, authUserId, updateError: updateError.message });
        continue;
      }

      // Create profile
      await admin.from("profiles").insert({
        user_id: authUserId,
        tenant_id: TENANT_ID,
        nome_completo: u.nome,
      });

      // Create user role
      await admin.from("user_roles").insert({
        user_id: authUserId,
        role: "user",
      });

      results.push({ email: u.email, authUserId, ok: true });
    } catch (e: any) {
      results.push({ email: u.email, error: e.message });
    }
  }

  return json({ results });
});
