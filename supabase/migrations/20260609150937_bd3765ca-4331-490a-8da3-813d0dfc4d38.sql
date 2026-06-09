SELECT p.proname, pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'validar_colaborador_ativo_ponto',
    'validar_periodo_aberto_ponto',
    'validar_sequencia_marcacao',
    'gerar_hash_marcacao',
    'audit_ponto_marcacoes',
    'tg_classificar_marcacao',
    'classificar_marcacao_clt',
    'consolidar_ponto_diario',
    'registrar_ponto_externo',
    'proximo_tipo_marcacao_externo'
  );