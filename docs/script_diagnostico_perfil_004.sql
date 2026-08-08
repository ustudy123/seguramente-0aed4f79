-- =====================================================================
-- YourEyes — Raio-X: por que a PERFIL-004 não acha usuário para simular?
--
-- SOMENTE LEITURA. Não altera nada. Devolve apenas CONTAGENS — nenhum
-- nome, CPF ou e-mail. Cole o arquivo inteiro no SQL Editor e execute.
--
-- O que ele responde:
--   · quantos usuários têm login (auth) e em que status estão;
--   · de que tipo são os usuários ativos com login;
--   · entre os que NÃO são administrador/gestor: quantos têm vínculo
--     de perfil, quantos não têm, e quantos dos sem-vínculo também
--     não têm papel de gestão (esses seriam os candidatos da rotina);
--   · a distribuição de papéis (user_roles) da base.
--
-- Com esse quadro a gente decide o próximo passo sem chute.
-- =====================================================================

WITH com_login AS MATERIALIZED (
  SELECT ub.id, ub.auth_user_id, ub.tenant_id,
         COALESCE(ub.status::text, 'ativo')       AS status,
         COALESCE(ub.tipo_usuario::text, '(nulo)') AS tipo,
         EXISTS (SELECT 1 FROM public.usuario_perfil_vinculos v
                 WHERE v.usuario_id = ub.id
                   AND COALESCE(v.ativo, true) = true) AS tem_vinculo
  FROM public.usuarios_base ub
  WHERE ub.auth_user_id IS NOT NULL
),
foco AS MATERIALIZED (
  -- ativos, com login, tipo fora de administrador/gestor
  SELECT * FROM com_login
  WHERE status = 'ativo' AND tipo NOT IN ('administrador', 'gestor')
)
SELECT * FROM (
  SELECT 1 AS ordem, 'visão geral' AS secao,
         'usuários com login (auth_user_id)' AS chave, count(*)::text AS valor
  FROM com_login
  UNION ALL
  SELECT 1, 'visão geral', 'sem login (auth_user_id vazio)', count(*)::text
  FROM public.usuarios_base WHERE auth_user_id IS NULL

  UNION ALL
  SELECT 2, 'com login, por status', status, count(*)::text
  FROM com_login GROUP BY status

  UNION ALL
  SELECT 3, 'com login e ativos, por tipo', tipo, count(*)::text
  FROM com_login WHERE status = 'ativo' GROUP BY tipo

  UNION ALL
  SELECT 4, 'foco: ativos, não administrador/gestor',
         'com vínculo de perfil ativo', count(*)::text
  FROM foco WHERE tem_vinculo
  UNION ALL
  SELECT 4, 'foco: ativos, não administrador/gestor',
         'sem vínculo de perfil', count(*)::text
  FROM foco WHERE NOT tem_vinculo
  UNION ALL
  SELECT 4, 'foco: ativos, não administrador/gestor',
         'sem vínculo E sem papel de gestão (candidatos da PERFIL-004)', count(*)::text
  FROM foco f
  WHERE NOT f.tem_vinculo
    AND NOT public.has_minimum_role(f.auth_user_id, 'manager'::public.app_role)
    AND NOT public.is_superadmin(f.auth_user_id)

  UNION ALL
  SELECT 5, 'papéis (user_roles) dos ativos sem vínculo', COALESCE(r.role::text, '(sem papel)'), count(*)::text
  FROM foco f
  LEFT JOIN public.user_roles r ON r.user_id = f.auth_user_id
  WHERE NOT f.tem_vinculo
  GROUP BY COALESCE(r.role::text, '(sem papel)')
) x
ORDER BY ordem, valor::int DESC NULLS LAST, chave;
