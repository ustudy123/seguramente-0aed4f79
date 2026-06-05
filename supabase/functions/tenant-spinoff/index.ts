// Edge Function: tenant-spinoff
// Promove uma OU várias empresas cliente (geridas por uma consultoria/tenant raiz)
// a uma nova conta-raiz independente com UM dono único.
// Migração DEFINITIVA — o tenant de origem perde acesso total às empresas migradas.

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
  // Aceita 1 (retrocompatível) ou N empresas
  empresaId?: string;
  empresaIds?: string[];
  // Se informado, migra para um tenant já existente em vez de criar um novo
  targetTenantId?: string;
  // execute apenas (se targetTenantId não informado):
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

    const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Auth inválido" }, 401);

    const { data: canMigrate, error: roleErr } = await admin.rpc("has_minimum_role", {
      _user_id: userData.user.id,
      _minimum_role: "admin",
    });
    
    console.log(`Checking permission for user ${userData.user.id} (${userData.user.email}): canMigrate=${canMigrate}, roleErr=${roleErr?.message}`);

    if (roleErr) {
      return json({ error: `Falha ao validar permissão: ${roleErr.message}` }, 500);
    }
    if (!canMigrate) {
      // Let's check if the user is a super_admin as a fallback
      const { data: isSuperAdmin } = await admin.from('user_roles').select('role').eq('user_id', userData.user.id).eq('role', 'super_admin').maybeSingle();
      if (!isSuperAdmin) {
        return json({ error: "Acesso negado: apenas administradores e donos podem realizar migrações." }, 403);
      }
    }

    const payload = (await req.json()) as Payload;

    // Normaliza para sempre operar como array (retrocompatível com empresaId único)
    const empresaIds: string[] = payload.empresaIds && payload.empresaIds.length > 0
      ? payload.empresaIds
      : (payload.empresaId ? [payload.empresaId] : []);

    if (empresaIds.length === 0) {
      return json({ error: "Informe empresaId ou empresaIds" }, 400);
    }

    // ---------- DRY RUN ----------
    if (payload.mode === "dry_run") {
      const { data, error } = await callerClient.rpc("superadmin_spinoff_dry_run_multi", {
        p_empresa_ids: empresaIds,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ dryRun: data });
    }

    // ---------- EXECUTE ----------
    if (payload.mode !== "execute") return json({ error: "Modo inválido" }, 400);

    let finalTenantId: string;
    let finalOwnerEmail: string;
    let finalOwnerUserId: string;
    let ownerInfoResult: any = null;

    if (payload.targetTenantId) {
      // MIGRAR PARA TENANT EXISTENTE
      const { data: targetTenant, error: ttErr } = await admin
        .from("tenants")
        .select("id, nome")
        .eq("id", payload.targetTenantId)
        .single();
      
      if (ttErr || !targetTenant) {
        return json({ error: `Tenant destino não encontrado (ID: ${payload.targetTenantId})` }, 400);
      }
      
      finalTenantId = targetTenant.id;

      // Localiza o administrador do tenant destino
      const { data: adminUser, error: auErr } = await admin
        .from("usuarios_base")
        .select("auth_user_id, email_principal, nome_completo")
        .eq("tenant_id", finalTenantId)
        .eq("tipo_usuario", "administrador")
        .eq("status", "ativo")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (auErr || !adminUser || !adminUser.auth_user_id) {
        return json({ error: "Não foi possível encontrar um administrador ativo no tenant de destino para atribuir as empresas." }, 400);
      }

      finalOwnerEmail = adminUser.email_principal;
      finalOwnerUserId = adminUser.auth_user_id;
      ownerInfoResult = { 
        userId: finalOwnerUserId, 
        email: finalOwnerEmail, 
        nome: adminUser.nome_completo,
        existing: true 
      };

    } else {
      // CRIAR NOVO TENANT (FLUXO ORIGINAL)
      if (!payload.novoTenant?.nome || !payload.novoTenant?.slug)
        return json({ error: "novoTenant.nome e novoTenant.slug obrigatórios" }, 400);
      if (!payload.owner?.email || !payload.owner?.nome)
        return json({ error: "owner.email e owner.nome obrigatórios" }, 400);

      const email = payload.owner.email.toLowerCase().trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email))
        return json({ error: `E-mail inválido: "${email}". Use o formato nome@dominio.com` }, 400);

      // 1) Cria novo tenant (com retry automático em caso de slug duplicado)
      const baseSlug = payload.novoTenant.slug.trim();
      let slugToUse = baseSlug;
      let novoTenant: any = null;
      let tErr: any = null;
      for (let attempt = 0; attempt < 6; attempt++) {
        const res = await admin
          .from("tenants")
          .insert({
            nome: payload.novoTenant.nome.trim(),
            slug: slugToUse,
            plano: payload.novoTenant.plano || "starter",
            ativo: true,
          })
          .select()
          .single();
        if (!res.error) { novoTenant = res.data; tErr = null; break; }
        tErr = res.error;
        const msg = (res.error.message || "").toLowerCase();
        const isSlugDup = msg.includes("tenants_slug_key") || (msg.includes("duplicate") && msg.includes("slug"));
        if (!isSlugDup) break;
        const suffix = Math.random().toString(36).slice(2, 7);
        slugToUse = `${baseSlug}-${suffix}`;
      }
      if (tErr || !novoTenant) return json({ error: `Erro ao criar tenant: ${tErr?.message || "desconhecido"}` }, 400);

      finalTenantId = novoTenant.id as string;
      const ownerInfo: { userId: string; inviteSent: boolean; emailJaExistia: boolean } = {
        userId: "",
        inviteSent: false,
        emailJaExistia: false,
      };

      try {
        // 2) Localiza ou cria o usuário owner
        const { data: existingUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const found = existingUsers?.users?.find(
          (u) => (u.email || "").toLowerCase() === email,
        );

        if (found) {
          ownerInfo.userId = found.id;
          ownerInfo.emailJaExistia = true;
        } else if (payload.owner.inviteMode) {
          const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
            redirectTo: `${SITE_URL}/auth/login`,
            data: { nome_completo: payload.owner.nome, tenant_id: finalTenantId },
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
            user_metadata: { nome_completo: payload.owner.nome, tenant_id: finalTenantId },
          });
          if (cErr || !created?.user) throw new Error(cErr?.message || "Falha ao criar owner");
          ownerInfo.userId = created.user.id;
        }

        // 3) Profile
        const { error: profErr } = await admin
          .from("profiles")
          .upsert(
            {
              user_id: ownerInfo.userId,
              tenant_id: finalTenantId,
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

        // 5) usuarios_base
        const { data: existingBase } = await admin
          .from("usuarios_base")
          .select("id, tenant_id")
          .eq("auth_user_id", ownerInfo.userId)
          .maybeSingle();

        let uBaseId: string;
        if (existingBase) {
          const { error: updErr } = await admin
            .from("usuarios_base")
            .update({
              tenant_id: finalTenantId,
              nome_completo: payload.owner.nome,
              email_principal: email,
              tipo_usuario: "administrador",
              status: "ativo",
            })
            .eq("id", existingBase.id);
          if (updErr) throw new Error(`Erro ao atualizar usuarios_base: ${updErr.message}`);
          uBaseId = existingBase.id as string;
        } else {
          const { data: uBase, error: ubErr } = await admin
            .from("usuarios_base")
            .insert({
              tenant_id: finalTenantId,
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
          uBaseId = uBase.id as string;
        }
        
        finalOwnerEmail = email;
        finalOwnerUserId = ownerInfo.userId;
        ownerInfoResult = ownerInfo;
      } catch (innerErr: any) {
        console.error("Spinoff falhou, fazendo rollback do tenant:", innerErr);
        await admin.from("tenants").delete().eq("id", finalTenantId);
        return json({ error: innerErr.message || "Falha na promoção" }, 500);
      }
    }

    // 6) Migração de dados (UMA transação para todas as empresas)
    const { data: rpcResult, error: rpcErr } = await admin.rpc(
      "superadmin_spinoff_execute_multi",
      {
        p_empresa_ids: empresaIds,
        p_novo_tenant_id: finalTenantId,
        p_owner_email: finalOwnerEmail,
        p_owner_user_id: finalOwnerUserId,
      },
    );
    if (rpcErr) return json({ error: `Erro na migração de dados: ${rpcErr.message}` }, 400);

    // 7) Vínculos do owner com TODAS as empresas migradas
    // Buscamos o uBaseId final
    const { data: uBaseFinal } = await admin
      .from("usuarios_base")
      .select("id")
      .eq("auth_user_id", finalOwnerUserId)
      .eq("tenant_id", finalTenantId)
      .limit(1)
      .maybeSingle();

    if (uBaseFinal) {
      const vinculosPayload = empresaIds.map((empId) => ({
        tenant_id: finalTenantId,
        usuario_id: uBaseFinal.id,
        empresa_id: empId,
        tipo_vinculo: "administrador",
        status: "ativo",
        data_inicio: new Date().toISOString().split("T")[0],
      }));
      await admin.from("usuario_vinculos").insert(vinculosPayload);
    }

    return json({
      ok: true,
      novoTenantId: finalTenantId,
      owner: ownerInfoResult,
      empresasMigradas: empresaIds.length,
      migracao: rpcResult,
    });
  } catch (e: any) {
    console.error("tenant-spinoff erro:", e);
    return json({ error: e.message || "Erro desconhecido" }, 500);
  }
});