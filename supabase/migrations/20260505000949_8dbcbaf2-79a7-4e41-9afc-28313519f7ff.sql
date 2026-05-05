
CREATE OR REPLACE FUNCTION public.superadmin_psicossocial_overview()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result JSONB;
BEGIN
  IF NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT jsonb_build_object(
    'global', jsonb_build_object(
      'total_campanhas', (SELECT COUNT(*) FROM questionario_psicossocial_campanhas),
      'rascunho', (SELECT COUNT(*) FROM questionario_psicossocial_campanhas WHERE status = 'rascunho'),
      'ativa', (SELECT COUNT(*) FROM questionario_psicossocial_campanhas WHERE status = 'ativa'),
      'encerrada', (SELECT COUNT(*) FROM questionario_psicossocial_campanhas WHERE status = 'encerrada'),
      'total_respostas', (SELECT COALESCE(SUM(total_respostas),0) FROM questionario_psicossocial_campanhas),
      'ips_medio', (SELECT ROUND(AVG(ips_score)::numeric, 1) FROM questionario_psicossocial_campanhas WHERE ips_score IS NOT NULL),
      'campanhas_sem_minimo', (SELECT COUNT(*) FROM questionario_psicossocial_campanhas WHERE COALESCE(total_respostas,0) < 5 AND status = 'ativa')
    ),
    'distribuicao_classificacao', (
      SELECT jsonb_object_agg(COALESCE(ips_classificacao,'sem_classificacao'), qtd)
      FROM (
        SELECT ips_classificacao, COUNT(*)::int AS qtd
        FROM questionario_psicossocial_campanhas
        WHERE ips_score IS NOT NULL
        GROUP BY ips_classificacao
      ) c
    ),
    'por_tenant', (
      SELECT jsonb_agg(row_to_json(x) ORDER BY x.tenant_nome) FROM (
        SELECT
          t.id AS tenant_id,
          t.nome AS tenant_nome,
          t.plano,
          t.ativo AS tenant_ativo,
          (SELECT COUNT(*) FROM questionario_psicossocial_campanhas c WHERE c.tenant_id = t.id) AS total_campanhas,
          (SELECT COUNT(*) FROM questionario_psicossocial_campanhas c WHERE c.tenant_id = t.id AND c.status = 'ativa') AS ativas,
          (SELECT COUNT(*) FROM questionario_psicossocial_campanhas c WHERE c.tenant_id = t.id AND c.status = 'encerrada') AS encerradas,
          (SELECT COUNT(*) FROM questionario_psicossocial_campanhas c WHERE c.tenant_id = t.id AND c.status = 'rascunho') AS rascunhos,
          (SELECT COALESCE(SUM(total_respostas),0) FROM questionario_psicossocial_campanhas c WHERE c.tenant_id = t.id) AS total_respostas,
          (SELECT ROUND(AVG(ips_score)::numeric,1) FROM questionario_psicossocial_campanhas c WHERE c.tenant_id = t.id AND ips_score IS NOT NULL) AS ips_medio,
          (SELECT MAX(updated_at) FROM questionario_psicossocial_campanhas c WHERE c.tenant_id = t.id) AS ultima_atividade,
          (SELECT COUNT(*) FROM psicossocial_alertas a WHERE a.tenant_id = t.id) AS alertas,
          (SELECT COUNT(*) FROM admissoes WHERE tenant_id = t.id AND status = 'concluido') AS colaboradores_ativos,
          (SELECT COUNT(*) FROM questionario_psicossocial_campanhas c
              WHERE c.tenant_id = t.id AND c.status='ativa' AND COALESCE(c.total_respostas,0) < 5) AS ativas_sem_minimo
        FROM tenants t
      ) x
    ),
    'campanhas', (
      SELECT jsonb_agg(row_to_json(c) ORDER BY c.created_at DESC) FROM (
        SELECT
          c.id, c.nome, c.status, c.tipo, c.instrumento,
          c.data_inicio, c.data_fim, c.created_at,
          c.total_respostas, c.ips_score, c.ips_classificacao,
          c.tenant_id, t.nome AS tenant_nome
        FROM questionario_psicossocial_campanhas c
        LEFT JOIN tenants t ON t.id = c.tenant_id
        ORDER BY c.created_at DESC
        LIMIT 500
      ) c
    )
  ) INTO result;

  RETURN result;
END; $$;

REVOKE EXECUTE ON FUNCTION public.superadmin_psicossocial_overview() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.superadmin_psicossocial_overview() TO authenticated;
