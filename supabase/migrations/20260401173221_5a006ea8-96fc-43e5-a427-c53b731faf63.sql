
-- =============================================
-- FASE A: Políticas de INSERT/UPDATE/DELETE
-- para as 8 tabelas operacionais com validação
-- de vínculo empresa-usuário profissional
-- =============================================

-- === ADMISSÕES ===
DROP POLICY IF EXISTS "Usuários podem criar admissões no seu tenant" ON public.admissoes;
DROP POLICY IF EXISTS "Usuários podem atualizar admissões do seu tenant" ON public.admissoes;
DROP POLICY IF EXISTS "admissoes_insert" ON public.admissoes;
DROP POLICY IF EXISTS "admissoes_update" ON public.admissoes;
DROP POLICY IF EXISTS "admissoes_delete" ON public.admissoes;
DROP POLICY IF EXISTS "insert_admissoes_vinculo" ON public.admissoes;
DROP POLICY IF EXISTS "update_admissoes_vinculo" ON public.admissoes;
DROP POLICY IF EXISTS "delete_admissoes_vinculo" ON public.admissoes;

CREATE POLICY "insert_admissoes_vinculo"
ON public.admissoes FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND public.user_has_empresa_vinculo(empresa_id)
);

CREATE POLICY "update_admissoes_vinculo"
ON public.admissoes FOR UPDATE TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.user_has_empresa_vinculo(empresa_id)
);

CREATE POLICY "delete_admissoes_vinculo"
ON public.admissoes FOR DELETE TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.user_has_empresa_vinculo(empresa_id)
);

-- === ATESTADOS ===
DROP POLICY IF EXISTS "atestados_insert" ON public.atestados;
DROP POLICY IF EXISTS "atestados_update" ON public.atestados;
DROP POLICY IF EXISTS "atestados_delete" ON public.atestados;
DROP POLICY IF EXISTS "insert_atestados_vinculo" ON public.atestados;
DROP POLICY IF EXISTS "update_atestados_vinculo" ON public.atestados;
DROP POLICY IF EXISTS "delete_atestados_vinculo" ON public.atestados;

CREATE POLICY "insert_atestados_vinculo"
ON public.atestados FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND public.user_has_empresa_vinculo(empresa_id)
);

CREATE POLICY "update_atestados_vinculo"
ON public.atestados FOR UPDATE TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.user_has_empresa_vinculo(empresa_id)
);

CREATE POLICY "delete_atestados_vinculo"
ON public.atestados FOR DELETE TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.user_has_empresa_vinculo(empresa_id)
);

-- === AFASTAMENTOS ===
DROP POLICY IF EXISTS "afastamentos_insert" ON public.afastamentos;
DROP POLICY IF EXISTS "afastamentos_update" ON public.afastamentos;
DROP POLICY IF EXISTS "afastamentos_delete" ON public.afastamentos;
DROP POLICY IF EXISTS "insert_afastamentos_vinculo" ON public.afastamentos;
DROP POLICY IF EXISTS "update_afastamentos_vinculo" ON public.afastamentos;
DROP POLICY IF EXISTS "delete_afastamentos_vinculo" ON public.afastamentos;

CREATE POLICY "insert_afastamentos_vinculo"
ON public.afastamentos FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND public.user_has_empresa_vinculo(empresa_id)
);

CREATE POLICY "update_afastamentos_vinculo"
ON public.afastamentos FOR UPDATE TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.user_has_empresa_vinculo(empresa_id)
);

CREATE POLICY "delete_afastamentos_vinculo"
ON public.afastamentos FOR DELETE TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.user_has_empresa_vinculo(empresa_id)
);

-- === OCORRÊNCIAS ===
DROP POLICY IF EXISTS "ocorrencias_insert" ON public.ocorrencias;
DROP POLICY IF EXISTS "ocorrencias_update" ON public.ocorrencias;
DROP POLICY IF EXISTS "ocorrencias_delete" ON public.ocorrencias;
DROP POLICY IF EXISTS "insert_ocorrencias_vinculo" ON public.ocorrencias;
DROP POLICY IF EXISTS "update_ocorrencias_vinculo" ON public.ocorrencias;
DROP POLICY IF EXISTS "delete_ocorrencias_vinculo" ON public.ocorrencias;

CREATE POLICY "insert_ocorrencias_vinculo"
ON public.ocorrencias FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND public.user_has_empresa_vinculo(empresa_id)
);

CREATE POLICY "update_ocorrencias_vinculo"
ON public.ocorrencias FOR UPDATE TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.user_has_empresa_vinculo(empresa_id)
);

CREATE POLICY "delete_ocorrencias_vinculo"
ON public.ocorrencias FOR DELETE TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.user_has_empresa_vinculo(empresa_id)
);

-- === METAS ===
DROP POLICY IF EXISTS "Usuários podem criar metas no seu tenant" ON public.metas;
DROP POLICY IF EXISTS "Usuários podem atualizar metas do seu tenant" ON public.metas;
DROP POLICY IF EXISTS "Usuários podem deletar metas do seu tenant" ON public.metas;
DROP POLICY IF EXISTS "metas_insert" ON public.metas;
DROP POLICY IF EXISTS "metas_update" ON public.metas;
DROP POLICY IF EXISTS "metas_delete" ON public.metas;
DROP POLICY IF EXISTS "insert_metas_vinculo" ON public.metas;
DROP POLICY IF EXISTS "update_metas_vinculo" ON public.metas;
DROP POLICY IF EXISTS "delete_metas_vinculo" ON public.metas;

CREATE POLICY "insert_metas_vinculo"
ON public.metas FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND public.user_has_empresa_vinculo(empresa_id)
);

CREATE POLICY "update_metas_vinculo"
ON public.metas FOR UPDATE TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.user_has_empresa_vinculo(empresa_id)
);

CREATE POLICY "delete_metas_vinculo"
ON public.metas FOR DELETE TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.user_has_empresa_vinculo(empresa_id)
);

-- === FÉRIAS SOLICITAÇÕES ===
DROP POLICY IF EXISTS "ferias_sol_tenant_insert" ON public.ferias_solicitacoes;
DROP POLICY IF EXISTS "ferias_sol_tenant_update" ON public.ferias_solicitacoes;
DROP POLICY IF EXISTS "ferias_sol_tenant_delete" ON public.ferias_solicitacoes;
DROP POLICY IF EXISTS "insert_ferias_vinculo" ON public.ferias_solicitacoes;
DROP POLICY IF EXISTS "update_ferias_vinculo" ON public.ferias_solicitacoes;
DROP POLICY IF EXISTS "delete_ferias_vinculo" ON public.ferias_solicitacoes;

CREATE POLICY "insert_ferias_vinculo"
ON public.ferias_solicitacoes FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND public.user_has_empresa_vinculo(empresa_id)
);

CREATE POLICY "update_ferias_vinculo"
ON public.ferias_solicitacoes FOR UPDATE TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.user_has_empresa_vinculo(empresa_id)
);

CREATE POLICY "delete_ferias_vinculo"
ON public.ferias_solicitacoes FOR DELETE TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.user_has_empresa_vinculo(empresa_id)
);

-- === DESVIOS SEGURANÇA ===
DROP POLICY IF EXISTS "desvios_insert" ON public.desvios_seguranca;
DROP POLICY IF EXISTS "desvios_update" ON public.desvios_seguranca;
DROP POLICY IF EXISTS "desvios_delete" ON public.desvios_seguranca;
DROP POLICY IF EXISTS "insert_desvios_vinculo" ON public.desvios_seguranca;
DROP POLICY IF EXISTS "update_desvios_vinculo" ON public.desvios_seguranca;
DROP POLICY IF EXISTS "delete_desvios_vinculo" ON public.desvios_seguranca;

CREATE POLICY "insert_desvios_vinculo"
ON public.desvios_seguranca FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND public.user_has_empresa_vinculo(empresa_id)
);

CREATE POLICY "update_desvios_vinculo"
ON public.desvios_seguranca FOR UPDATE TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.user_has_empresa_vinculo(empresa_id)
);

CREATE POLICY "delete_desvios_vinculo"
ON public.desvios_seguranca FOR DELETE TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.user_has_empresa_vinculo(empresa_id)
);

-- === EPIS ===
DROP POLICY IF EXISTS "Usuários podem criar EPIs no seu tenant" ON public.epis;
DROP POLICY IF EXISTS "Usuários podem atualizar EPIs do seu tenant" ON public.epis;
DROP POLICY IF EXISTS "Usuários podem deletar EPIs do seu tenant" ON public.epis;
DROP POLICY IF EXISTS "epis_insert" ON public.epis;
DROP POLICY IF EXISTS "epis_update" ON public.epis;
DROP POLICY IF EXISTS "epis_delete" ON public.epis;
DROP POLICY IF EXISTS "insert_epis_vinculo" ON public.epis;
DROP POLICY IF EXISTS "update_epis_vinculo" ON public.epis;
DROP POLICY IF EXISTS "delete_epis_vinculo" ON public.epis;

CREATE POLICY "insert_epis_vinculo"
ON public.epis FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND public.user_has_empresa_vinculo(empresa_id)
);

CREATE POLICY "update_epis_vinculo"
ON public.epis FOR UPDATE TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.user_has_empresa_vinculo(empresa_id)
);

CREATE POLICY "delete_epis_vinculo"
ON public.epis FOR DELETE TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.user_has_empresa_vinculo(empresa_id)
);
