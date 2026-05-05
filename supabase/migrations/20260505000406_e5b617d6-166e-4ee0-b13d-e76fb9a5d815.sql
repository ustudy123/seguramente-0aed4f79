
CREATE OR REPLACE FUNCTION public.superadmin_global_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result JSONB;
BEGIN
  IF NOT public.is_superadmin(auth.uid()) THEN RAISE EXCEPTION 'Acesso negado'; END IF;

  SELECT jsonb_build_object(
    'tenants', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM tenants),
      'ativos', (SELECT COUNT(*) FROM tenants WHERE ativo = true),
      'novos_30d', (SELECT COUNT(*) FROM tenants WHERE created_at > now() - interval '30 days')
    ),
    'usuarios', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM profiles),
      'ativos_7d', (SELECT COUNT(DISTINCT user_id) FROM profiles WHERE updated_at > now() - interval '7 days')
    ),
    'colaboradores', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM admissoes WHERE status = 'concluido'),
      'novos_30d', (SELECT COUNT(*) FROM admissoes WHERE status = 'concluido' AND created_at > now() - interval '30 days')
    ),
    'leads', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM leads),
      'novos_7d', (SELECT COUNT(*) FROM leads WHERE created_at > now() - interval '7 days'),
      'convertidos', (SELECT COUNT(*) FROM leads WHERE status = 'convertido'),
      'em_negociacao', (SELECT COUNT(*) FROM leads WHERE status IN ('proposta','negociacao'))
    ),
    'landing_leads', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM landing_leads),
      'com_diagnostico', (SELECT COUNT(*) FROM landing_leads WHERE pontuacao_diagnostico IS NOT NULL),
      'convertidos', (SELECT COUNT(*) FROM landing_leads WHERE convertido = true)
    ),
    'campanhas_psicossociais', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM questionario_psicossocial_campanhas),
      'ativas', (SELECT COUNT(*) FROM questionario_psicossocial_campanhas WHERE status = 'ativa'),
      'finalizadas', (SELECT COUNT(*) FROM questionario_psicossocial_campanhas WHERE status = 'encerrada')
    )
  ) INTO result;
  RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION public.superadmin_tenants_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result JSONB;
BEGIN
  IF NOT public.is_superadmin(auth.uid()) THEN RAISE EXCEPTION 'Acesso negado'; END IF;

  SELECT jsonb_agg(row_to_json(x) ORDER BY x.criado_em DESC) INTO result
  FROM (
    SELECT
      t.id AS tenant_id,
      t.nome AS tenant_nome,
      t.plano,
      t.ativo,
      (SELECT COUNT(*) FROM profiles WHERE tenant_id = t.id) AS usuarios,
      (SELECT COUNT(*) FROM admissoes WHERE tenant_id = t.id AND status = 'concluido') AS colaboradores,
      (SELECT COUNT(*) FROM questionario_psicossocial_campanhas WHERE tenant_id = t.id) AS campanhas_total,
      (SELECT COUNT(*) FROM questionario_psicossocial_campanhas WHERE tenant_id = t.id AND status = 'ativa') AS campanhas_ativas,
      t.created_at AS criado_em,
      (SELECT MAX(updated_at) FROM profiles WHERE tenant_id = t.id) AS ultimo_acesso
    FROM tenants t
  ) x;

  RETURN COALESCE(result, '[]'::jsonb);
END; $$;
