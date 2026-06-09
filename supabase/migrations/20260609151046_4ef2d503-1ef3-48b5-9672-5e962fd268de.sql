SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('ponto_ajustes','ponto_marcacoes','ponto_diario')
  AND column_name IN ('data_referencia','data_marcacao','data')
ORDER BY table_name, column_name;