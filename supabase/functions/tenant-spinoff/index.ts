// Edge Function: tenant-spinoff
// Promove uma empresa cliente (gerida por uma consultoria/tenant raiz) a uma
// nova conta-raiz independente. Migração DEFINITIVA — o tenant de origem perde
// acesso total à empresa migrada.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") || "https://youreyes.com.br";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Mode = "dry_run" | "execute";

type Payload = {
  mode: Mode;
  empresaId: string;
  // execute apenas:
  novoTenant?: { nome: string; slug: string; plano?: string };
  owner?: {
    email: string;
    nome: string;
    password?: string;
    inviteMode?: boolean;
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!jwt) return json({ error: "Missing Authorization" }, 401);

    // Cliente impersonando o caller (para validação de superadmin e auditoria via auth.uid())
    const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Auth inválido" }, 401);

    const { data: isSuper } = await admin.rpc("is_superadmin", {
      _user_id: userData.user.id,
    });
    if (!isSuper) return json({ error: "Acesso negado (super admin necessário)" }, 403);

    const payload = (await req.json()) as Payload;
    if (!payload?.empresaId) return json({ error: "empresaId obrigatório" }, 400);

    // ---------- DRY RUN ----------
    if (payload.mode === "dry_run") {
      const { data, error } = await callerClient.rpc("superadmin_spinoff_dry_run", {
        p_empresa_id: payload.empresaId,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ dryRun: data });
    }

    // ---------- EXECUTE ----------
    if (payload.mode !== "execute") return json({ error: "Modo inválido" }, 400);
    if (!payload.novoTenant?.nome || !payload.novoTenant?.slug)
      return json({ error: "novoTenant.nome e novoTenant.slug obrigatórios" }, 400);
    if (!payload.owner?.email || !payload.owner?.nome)
      return json({ error: "owner.email e owner.nome obrigatórios" }, 400);

    const email = payload.owner.email.toLowerCase().trim();

    // 1) Cria novo tenant
    const { data: novoTenant, error: tErr } = await admin
      .from("tenants")
      .insert({
        nome: payload.novoTenant.nome,
        slug: payload.novoTenant.slug,
        plano: payload.novoTenant.plano || "starter",
        ativo: true,
      })
      .select()
      .single();
    if (tErr) return json({ error: `Erro ao criar tenant: ${tErr.message}` }, 400);

    const novoTenantId = novoTenant.id as string;
    const ownerInfo: { userId: string; inviteSent: boolean; emailJaExistia: boolean } = {
      userId: "",
      inviteSent: false,
      emailJaExistia: false,
    };

    try {
      // 2) Localiza ou cria o usuário owner
      const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const found = existing?.users?.find(
        (u) => (u.email || "").toLowerCase() === email,
      );

      if (found) {
        ownerInfo.userId = found.id;
        ownerInfo.emailJaExistia = true;
      } else if (payload.owner.inviteMode) {
        const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
          redirectTo: `${SITE_URL}/auth/login`,
          data: { nome_completo: payload.owner.nome, tenant_id: novoTenantId },
        });
        if (invErr || !invited?.user) throw new Error(invErr?.message || "Falha ao convidar owner");
        ownerInfo.userId = invited.user.id;
        ownerInfo.inviteSent = true;
      } else {
        if (!payload.owner.password || payload.owner.password.length < 6)
          throw new Error("Senha do owner deve ter ao menos 6 caracteres");
        const { data: created, error: cErr } = await admin.auth.admin.createUser({
          email,
          password: payload.owner.password,
          email_confirm: true,
          user_metadata: { nome_completo: payload.owner.nome, tenant_id: novoTenantId },
        });
        if (cErr || !created?.user) throw new Error(cErr?.message || "Falha ao criar owner");
        ownerInfo.userId = created.user.id;
      }

      // 3) Profile (upsert por user_id, força tenant_id = novo)
      const { error: profErr } = await admin
        .from("profiles")
        .upsert(
          {
            user_id: ownerInfo.userId,
            tenant_id: novoTenantId,
            nome_completo: payload.owner.nome,
            onboarding_concluido: true,
          },
          { onConflict: "user_id" },
        );
      if (profErr) throw new Error(`Erro em profiles: ${profErr.message}`);

      // 4) Role admin
      const { error: roleErr } = await admin
        .from("user_roles")
        .upsert(
          { user_id: ownerInfo.userId, role: "admin" },
          { onConflict: "user_id,role" },
        );
      if (roleErr) throw new Error(`Erro em user_roles: ${roleErr.message}`);

      // 5) usuarios_base (Proprietário do novo tenant)
      const { data: uBase, error: ubErr } = await admin
        .from("usuarios_base")
        .insert({
          tenant_id: novoTenantId,
          auth_user_id: ownerInfo.userId,
          nome_completo: payload.owner.nome,
          email_principal: email,
          tipo_usuario: "administrador",
          status: "ativo",
          origem_cadastro: "tenant_spinoff",
        })
        .select("id")
        .single();
      if (ubErr) throw new Error(`Erro em usuarios_base: ${ubErr.message}`);

      // 6) Executa a migração de dados via RPC (roda como super admin)
      const { data: rpcResult, error: rpcErr } = await callerClient.rpc(
        "superadmin_spinoff_execute",
        {
          p_empresa_id: payload.empresaId,
          p_novo_tenant_id: novoTenantId,
          p_owner_email: email,
          p_owner_user_id: ownerInfo.userId,
        },
      );
      if (rpcErr) throw new Error(`Erro na migração de dados: ${rpcErr.message}`);

      // 7) Vínculo do owner com a empresa migrada
      await admin.from("usuario_vinculos").insert({
        tenant_id: novoTenantId,
        usuario_id: uBase.id,
        empresa_id: payload.empresaId,
        tipo_vinculo: "administrador",
        status: "ativo",
        data_inicio: new Date().toISOString().split("T")[0],
      });

      return json({
        ok: true,
        novoTenantId,
        owner: ownerInfo,
        migracao: rpcResult,
      });
    } catch (innerErr: any) {
      // Cleanup do tenant criado em caso de falha
      console.error("Spinoff falhou, fazendo rollback do tenant:", innerErr);
      await admin.from("tenants").delete().eq("id", novoTenantId);
      return json({ error: innerErr.message || "Falha na promoção" }, 500);
    }
  } catch (e: any) {
    console.error("tenant-spinoff erro:", e);
    return json({ error: e.message || "Erro desconhecido" }, 500);
  }
});
