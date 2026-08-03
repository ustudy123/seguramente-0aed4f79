-- =====================================================================
-- Auditoria de ajustes de ponto: motivo declarado × evidência × recorrência
--
-- Do chamado da Jaqueline Dalmolin (08/06/2026): os dois ajustes do dia
-- foram justificados como "Falha no equipamento / aplicativo". O motivo é
-- legítimo e comum, mas é também o mais fácil de usar para encobrir
-- marcação inexistente — e hoje nada no sistema mostra com que frequência
-- cada colaborador o declara, nem se veio anexo junto.
--
-- Este migration entrega o cruzamento pedido, em duas granularidades:
--
--   ponto_auditoria_ajustes_motivo    → colaborador × motivo (o grão do
--                                       chamado: quem declara o quê, com
--                                       que frequência, com ou sem prova)
--   ponto_auditoria_motivos_resumo    → motivo (visão do tenant/empresa,
--                                       para achar o motivo problemático
--                                       antes de olhar pessoa a pessoa)
--
-- "Evidência" é o anexo do próprio ajuste (ponto_ajustes.anexos). Quando o
-- motivo vem do catálogo de justificativas e ele exige anexo
-- (ponto_justificativas.requer_anexo), a ausência do anexo não é só um
-- dado: é descumprimento da própria regra configurada pelo RH — por isso
-- sai em coluna separada.
--
-- Somente leitura: nenhuma alteração de cálculo, saldo ou status.
-- =====================================================================

-- 1) COLABORADOR × MOTIVO ---------------------------------------------
CREATE OR REPLACE FUNCTION public.ponto_auditoria_ajustes_motivo(
  p_tenant_id uuid,
  p_empresa_id uuid,
  p_ini date,
  p_fim date
)
RETURNS TABLE(
  colaborador_cpf text,
  colaborador_nome text,
  motivo text,
  justificativa_nome text,
  requer_anexo boolean,
  qtd_ajustes integer,
  qtd_com_anexo integer,
  qtd_sem_anexo integer,
  qtd_sem_anexo_exigido integer,
  qtd_aprovados integer,
  qtd_pendentes integer,
  dias_distintos integer,
  meses_distintos integer,
  primeira_data date,
  ultima_data date,
  media_por_mes numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH base AS (
    SELECT
      a.colaborador_cpf,
      a.colaborador_nome,
      COALESCE(NULLIF(btrim(a.motivo), ''), 'Sem motivo declarado') AS motivo,
      j.nome AS justificativa_nome,
      COALESCE(j.requer_anexo, false) AS requer_anexo,
      a.data_referencia::date AS dia,
      a.status,
      -- anexos é jsonb/json com a lista de arquivos do ajuste
      (CASE
         WHEN a.anexos IS NULL THEN false
         WHEN jsonb_typeof(a.anexos::jsonb) = 'array' THEN jsonb_array_length(a.anexos::jsonb) > 0
         WHEN jsonb_typeof(a.anexos::jsonb) = 'object' THEN a.anexos::jsonb <> '{}'::jsonb
         ELSE false
       END) AS tem_anexo
    FROM public.ponto_ajustes a
    LEFT JOIN public.ponto_justificativas j ON j.id = a.justificativa_id
    WHERE a.tenant_id = p_tenant_id
      AND a.data_referencia::date BETWEEN p_ini AND p_fim
      AND (p_empresa_id IS NULL OR a.empresa_id = p_empresa_id)
  )
  SELECT
    b.colaborador_cpf,
    MAX(b.colaborador_nome),
    b.motivo,
    MAX(b.justificativa_nome),
    bool_or(b.requer_anexo),
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE b.tem_anexo)::int,
    COUNT(*) FILTER (WHERE NOT b.tem_anexo)::int,
    COUNT(*) FILTER (WHERE NOT b.tem_anexo AND b.requer_anexo)::int,
    COUNT(*) FILTER (WHERE b.status = 'aprovado')::int,
    COUNT(*) FILTER (WHERE b.status = 'pendente')::int,
    COUNT(DISTINCT b.dia)::int,
    COUNT(DISTINCT date_trunc('month', b.dia))::int,
    MIN(b.dia),
    MAX(b.dia),
    ROUND(COUNT(*)::numeric / GREATEST(COUNT(DISTINCT date_trunc('month', b.dia)), 1), 1)
  FROM base b
  GROUP BY b.colaborador_cpf, b.motivo
  ORDER BY COUNT(*) DESC, MAX(b.colaborador_nome);
$$;

-- 2) RESUMO POR MOTIVO -------------------------------------------------
CREATE OR REPLACE FUNCTION public.ponto_auditoria_motivos_resumo(
  p_tenant_id uuid,
  p_empresa_id uuid,
  p_ini date,
  p_fim date
)
RETURNS TABLE(
  motivo text,
  qtd_ajustes integer,
  qtd_colaboradores integer,
  qtd_com_anexo integer,
  qtd_sem_anexo integer,
  qtd_sem_anexo_exigido integer,
  pct_sem_anexo numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    m.motivo,
    SUM(m.qtd_ajustes)::int,
    COUNT(DISTINCT m.colaborador_cpf)::int,
    SUM(m.qtd_com_anexo)::int,
    SUM(m.qtd_sem_anexo)::int,
    SUM(m.qtd_sem_anexo_exigido)::int,
    ROUND(100.0 * SUM(m.qtd_sem_anexo) / GREATEST(SUM(m.qtd_ajustes), 1), 1)
  FROM public.ponto_auditoria_ajustes_motivo(p_tenant_id, p_empresa_id, p_ini, p_fim) m
  GROUP BY m.motivo
  ORDER BY SUM(m.qtd_ajustes) DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.ponto_auditoria_ajustes_motivo(uuid, uuid, date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ponto_auditoria_motivos_resumo(uuid, uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ponto_auditoria_ajustes_motivo(uuid, uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ponto_auditoria_motivos_resumo(uuid, uuid, date, date) TO authenticated;

COMMENT ON FUNCTION public.ponto_auditoria_ajustes_motivo(uuid, uuid, date, date) IS
  'Auditoria de ajustes de ponto por colaborador × motivo: recorrência (dias/meses/média mensal) cruzada com evidência anexada e com a exigência de anexo do catálogo de justificativas.';
