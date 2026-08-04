-- =====================================================================
-- Fechamento por empresa: conferência
-- Parte 4 de 4 — rode UMA parte por vez, na ordem.
--
-- Por que em partes: o editor do Supabase roda o arquivo inteiro numa
-- transação só e tem tempo limite. Se uma parte estourar, tudo o que
-- veio antes é descartado. Em quatro execuções curtas, cada uma se
-- garante sozinha.
-- =====================================================================
-- =====================================================================
-- CONFERÊNCIA
-- Todas as colunas devem vir "true". Nada aqui altera dados.
-- =====================================================================
SELECT
  to_regprocedure('public.ponto_empresa_do_cpf(uuid,text)') IS NOT NULL
    AS ferramenta_empresa_ok,
  position('ponto_empresa_do_cpf' in
    COALESCE(pg_get_functiondef(to_regprocedure('public.apurar_banco_horas(uuid,text,uuid)')), '')) > 0
    AS apuracao_por_empresa_ok,
  position('ponto_empresa_do_cpf' in
    COALESCE(pg_get_functiondef(to_regprocedure('public.reapurar_banco_horas_competencias(uuid,uuid,text,text)')), '')) > 0
    AS reapuracao_por_empresa_ok,
  position('IF v_empresa_id IS NULL THEN' in
    COALESCE(pg_get_functiondef(to_regprocedure('public.apurar_banco_horas_colaborador(uuid,text,text,uuid)')), '')) > 0
    AS preserva_empresa_ok,
  position('ponto_empresa_do_cpf' in
    COALESCE(pg_get_functiondef(to_regprocedure('public.ponto_espelho_resumo_empresa(uuid,uuid,text)')), '')) > 0
    AS espelho_por_empresa_ok;

-- Quanto ainda está sem empresa depois do preenchimento. Zero é o ideal;
-- o que sobrar é cadastro sem empresa na admissão.
SELECT
  (SELECT count(*) FROM public.ponto_diario      WHERE empresa_id IS NULL) AS dias_sem_empresa,
  (SELECT count(*) FROM public.ponto_banco_horas WHERE empresa_id IS NULL) AS bancos_sem_empresa,
  (SELECT count(*) FROM public.ponto_espelhos    WHERE empresa_id IS NULL) AS espelhos_sem_empresa;

-- Quem tem ponto e não pertence a empresa nenhuma (troque a competência).
-- Essas pessoas só aparecem na visão "todas as empresas".
-- SELECT * FROM public.ponto_colaboradores_sem_empresa(
--   (SELECT tenant_id FROM public.usuarios_base WHERE auth_user_id = auth.uid() LIMIT 1),
--   '2026-07');

-- Mesmo CPF em duas empresas do mesmo tenant. Se voltar alguma linha,
-- avise: o espelho e o banco de horas têm chave única por CPF e
-- competência, sem a empresa, e as duas empresas disputariam a mesma
-- linha ao fechar.
-- SELECT * FROM public.ponto_cpfs_em_mais_de_uma_empresa(
--   (SELECT tenant_id FROM public.usuarios_base WHERE auth_user_id = auth.uid() LIMIT 1));

-- O que ainda está atribuído a uma empresa em que o colaborador não tem
-- admissão. Depois do reparo acima deve vir vazio; o que sobrar é CPF sem
-- admissão nenhuma cadastrada.
-- SELECT * FROM public.ponto_empresa_atribuida_errada(
--   (SELECT tenant_id FROM public.usuarios_base WHERE auth_user_id = auth.uid() LIMIT 1));
