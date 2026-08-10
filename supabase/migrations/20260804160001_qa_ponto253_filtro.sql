-- =========================================================
-- QA — PONTO-253: terceira tentativa, e mudança de método (31/07/2026)
--
-- HISTÓRICO DESTE CASO, que vale registrar porque o padrão se repetiu:
--   1ª versão — buscava '%retencao%' em TODO o schema public.
--                Casou com hub_catalogo_documentos.prazo_retencao_anos.
--                Verde por engano.
--   2ª versão — escopei às tabelas do módulo, MAS acrescentei '%prazo\_%'.
--                Casou com ponto_banco_horas.prazo_compensacao,
--                ponto_cct_config.banco_horas_prazo_compensacao_meses e
--                ponto_banco_horas_config.prazo_compensacao_dias — todos
--                prazos de COMPENSAÇÃO de banco de horas, sem relação
--                alguma com retenção de dado. Verde por engano de novo.
--
-- Consertei um filtro largo com outro filtro largo. É a quarta vez nesta
-- suíte que casamento por substring produz veredito errado (antes: '%cipa%'
-- casando com email_prinCIPAl, e comprimento de token confundido com
-- entropia).
--
-- MUDANÇA DE MÉTODO, não só de filtro:
--   a) O padrão fica restrito a três termos que só significam retenção:
--      retencao, expurgo, dias_guarda. 'prazo' foi removido — em sistema
--      trabalhista, 'prazo' aparece em dezenas de contextos legítimos.
--   b) Mais importante: a rotina passa a DEVOLVER NO RESULTADO quais
--      colunas considerou. Assim, se um falso positivo voltar a acontecer,
--      ele fica visível na própria saída em vez de virar um "passou" mudo.
--      Veredito sem evidência foi o que permitiu os dois erros anteriores
--      passarem despercebidos.
-- =========================================================

SET lock_timeout = '10s';

CREATE OR REPLACE FUNCTION public.qa_caso_ponto_253()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_onde text; v_com_geo int; v_geo_antiga int; v_total int;
  v_mais_antiga date; v_tem_hash boolean;
BEGIN
  IF to_regclass('public.ponto_marcacoes') IS NULL THEN
    r.situacao := 'nao_implementado';
    r.obtido   := 'Tabela ponto_marcacoes não existe nesta base.';
    RETURN r;
  END IF;

  r.passo_ordem := 1;
  r.passo_acao  := 'Procurar parâmetro de RETENÇÃO nas tabelas do módulo';
  r.esperado    := 'Prazo configurável para eliminar geolocalização e imagem';

  -- Somente termos que significam retenção. 'prazo' ficou de fora de
  -- propósito: em sistema trabalhista aparece em prazo de compensação,
  -- de pagamento, de aviso, de exame — nenhum deles é retenção de dado.
  SELECT string_agg(table_name || '.' || column_name, ', ' ORDER BY table_name, column_name)
    INTO v_onde
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (table_name LIKE 'ponto\_%' OR table_name LIKE 'jornada\_%')
    AND (column_name ILIKE '%retencao%'
      OR column_name ILIKE '%expurgo%'
      OR column_name ILIKE '%dias\_guarda%'
      OR column_name ILIKE '%anonimiza%');

  r.passo_ordem := 2;
  r.passo_acao  := 'AUDITORIA (somente leitura): há quanto tempo a geolocalização é guardada';

  SELECT count(*),
         count(*) FILTER (WHERE latitude IS NOT NULL OR longitude IS NOT NULL),
         count(*) FILTER (WHERE (latitude IS NOT NULL OR longitude IS NOT NULL)
                            AND data_marcacao < CURRENT_DATE - 365),
         min(data_marcacao)
    INTO v_total, v_com_geo, v_geo_antiga, v_mais_antiga
  FROM public.ponto_marcacoes;

  r.passo_ordem := 3;
  r.passo_acao  := 'Conferir se a marcação tem hash próprio';
  v_tem_hash := public.qa_coluna_existe('ponto_marcacoes','hash_marcacao');

  IF v_onde IS NOT NULL AND v_geo_antiga = 0 THEN
    r.situacao := 'passou';
    -- A evidência vai no resultado de propósito: veredito sem mostrar o que
    -- foi considerado foi o que deixou dois falsos positivos passarem.
    r.obtido   := format('Parâmetro de retenção encontrado no módulo: %s. Nenhuma '
               || 'geolocalização retida há mais de um ano (%s marcação(ões) com geo, de %s; '
               || 'mais antiga em %s). CONFIRA a coluna citada: se não for de retenção de '
               || 'dado acessório, este veredito está errado.',
               v_onde, v_com_geo, v_total, v_mais_antiga);
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('Parâmetro de retenção nas tabelas do módulo: %s. Marcações: %s no '
               || 'total, %s com geolocalização, %s guardadas há mais de um ano. Registro '
               || 'mais antigo: %s. A LGPD, art. 16, exige eliminação ao término do '
               || 'tratamento, e a finalidade da geolocalização se esgota bem antes do prazo '
               || 'de guarda da MARCAÇÃO, que tem base própria no art. 74 da CLT. São dois '
               || 'prazos distintos tratados como um só: guarda-se tudo indefinidamente. '
               || 'Correção: prazo configurável para o acessório e rotina de expurgo com '
               || 'registro do evento (LGPD art. 37). ANTES de implementar, verificar se o '
               || 'hash_marcacao (presente: %s) inclui latitude e longitude — se incluir, '
               || 'expurgá-las quebra a cadeia de integridade da batida.',
               COALESCE(v_onde, 'NENHUM'), v_total, v_com_geo, v_geo_antiga,
               COALESCE(v_mais_antiga::text, '(sem marcações)'), v_tem_hash);
    r.detalhe  := jsonb_build_object('parametro_no_modulo', v_onde,
                                     'total_marcacoes', v_total,
                                     'com_geolocalizacao', v_com_geo,
                                     'geo_com_mais_de_um_ano', v_geo_antiga,
                                     'marcacao_mais_antiga', v_mais_antiga);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

DO $roda$
BEGIN
  PERFORM public.qa_rodar_bateria('manual','jornada-rotina/ponto');
END $roda$;

SELECT * FROM public.qa_relatorio_falhas('jornada-rotina/ponto');
