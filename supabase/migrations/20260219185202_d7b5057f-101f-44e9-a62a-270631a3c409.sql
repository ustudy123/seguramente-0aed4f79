
-- Função para abertura automática de competência mensal
CREATE OR REPLACE FUNCTION public.auto_abrir_competencia_mensal()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant RECORD;
  v_competencia TEXT;
  v_exists BOOLEAN;
BEGIN
  -- Competência é o mês atual
  v_competencia := to_char(CURRENT_DATE, 'YYYY-MM');
  
  -- Para cada tenant ativo
  FOR v_tenant IN SELECT DISTINCT t.id as tenant_id FROM tenants t WHERE t.ativo = true
  LOOP
    -- Verificar se já existe competência para este mês
    SELECT EXISTS(
      SELECT 1 FROM hub_competencias 
      WHERE tenant_id = v_tenant.tenant_id 
      AND competencia = v_competencia
    ) INTO v_exists;
    
    IF NOT v_exists THEN
      -- Criar competência automaticamente
      INSERT INTO hub_competencias (tenant_id, competencia, status, checklist)
      VALUES (
        v_tenant.tenant_id,
        v_competencia,
        'em_preparacao',
        '{"ponto_fechado": false, "eventos_confirmados": false, "rescisoes_revisadas": false, "ferias_calculadas": false, "beneficios_atualizados": false}'::jsonb
      );
      
      -- Registrar no histórico
      INSERT INTO hub_historico (tenant_id, competencia, acao, usuario_nome, perfil, descricao)
      VALUES (
        v_tenant.tenant_id,
        v_competencia,
        'criado',
        'Sistema (automático)',
        'sistema',
        'Competência ' || v_competencia || ' aberta automaticamente'
      );
    END IF;
  END LOOP;
END;
$$;

-- Criar job cron para rodar todo dia 1 às 00:05
SELECT cron.schedule(
  'auto-abrir-competencia-mensal',
  '5 0 1 * *',
  $$SELECT public.auto_abrir_competencia_mensal()$$
);
