-- ============================================================================
-- ONDA 6 (parte 4) — Composição do pacote da folha, com naturezas corretas
-- PONTO-361
--
-- A exportação para a folha era um jsonb montado pela TELA, sem regra
-- verificável: nada garantia grandezas reais nem naturezas corretas. É onde o
-- ponto vira dinheiro — zero afirmativo aqui é dívida silenciosa. As naturezas
-- são distintas e não se misturam:
--   · VENCIMENTO   — hora extra 50%/100%, adicional noturno, reflexo do DSR;
--   · DESCONTO     — faltas e atrasos;
--   · INDENIZATÓRIA — supressão de intervalo (CLT art. 71, §4º) — que NÃO é hora
--     extra e não pode entrar como tal.
--
-- O QUE FAZ (aditivo): ponto_compor_pacote_folha monta o pacote a partir da
-- APURAÇÃO FECHADA (ponto_espelhos) + a supressão de intervalo do dia + o
-- reflexo do DSR, com memória da composição, e grava em ponto_exportacoes_folha.
-- Idempotente (refaz o pacote 'auto' da competência). Somente compõe — não
-- envia (a fila e o reenvio são a parte 5).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ponto_compor_pacote_folha(
  p_tenant_id   uuid,
  p_empresa_id  uuid,
  p_competencia text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ini date := to_date(p_competencia || '-01', 'YYYY-MM-DD');
  v_fim date := (to_date(p_competencia || '-01', 'YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date;
  e         RECORD;
  v_colabs  jsonb := '[]'::jsonb;
  v_eventos jsonb;
  v_total   int := 0;
  v_suprimido int;
  v_dsr_ref   int;
  v_dsr_perda boolean;
  v_id      uuid;
BEGIN
  FOR e IN
    SELECT * FROM public.ponto_espelhos esp
    WHERE esp.tenant_id = p_tenant_id
      AND esp.competencia = p_competencia
      AND (p_empresa_id IS NULL OR esp.empresa_id = p_empresa_id)
    ORDER BY esp.colaborador_nome
  LOOP
    -- Supressao de intervalo do periodo (natureza indenizatoria — art. 71 §4).
    SELECT COALESCE(SUM(COALESCE(d.he_intervalo_suprimido_minutos, 0))::int, 0) INTO v_suprimido
    FROM public.ponto_diario d
    WHERE d.tenant_id = p_tenant_id AND d.colaborador_cpf = e.colaborador_cpf
      AND d.data BETWEEN v_ini AND v_fim;

    -- Reflexo do DSR (natureza vencimento) e perda do DSR (desconto).
    v_dsr_ref := 0; v_dsr_perda := false;
    BEGIN
      SELECT COALESCE(SUM(reflexo_he_dsr_min), 0)::int, bool_or(dsr_perdido)
        INTO v_dsr_ref, v_dsr_perda
      FROM public.ponto_dsr_competencia(p_tenant_id, e.colaborador_cpf, p_competencia);
    EXCEPTION WHEN OTHERS THEN
      v_dsr_ref := 0; v_dsr_perda := false;
    END;

    v_eventos := '[]'::jsonb;

    IF COALESCE(e.total_horas_extras_50_minutos, 0) > 0 THEN
      v_eventos := v_eventos || jsonb_build_object('codigo','he_50','descricao','Hora extra 50%','natureza','vencimento','minutos', e.total_horas_extras_50_minutos);
    END IF;
    IF COALESCE(e.total_horas_extras_100_minutos, 0) > 0 THEN
      v_eventos := v_eventos || jsonb_build_object('codigo','he_100','descricao','Hora extra 100% (domingo/feriado)','natureza','vencimento','minutos', e.total_horas_extras_100_minutos);
    END IF;
    IF COALESCE(e.total_adicional_noturno_minutos, 0) > 0 THEN
      v_eventos := v_eventos || jsonb_build_object('codigo','adic_noturno','descricao','Adicional noturno','natureza','vencimento','minutos', e.total_adicional_noturno_minutos);
    END IF;
    IF v_dsr_ref > 0 THEN
      v_eventos := v_eventos || jsonb_build_object('codigo','dsr_reflexo','descricao','Reflexo das horas extras no DSR (Sumula 172)','natureza','vencimento','minutos', v_dsr_ref);
    END IF;
    IF v_suprimido > 0 THEN
      -- INDENIZATORIA — nao e hora extra (CLT art. 71, §4º): 50% sobre os minutos
      -- suprimidos, sem reflexos.
      v_eventos := v_eventos || jsonb_build_object('codigo','supr_intervalo','descricao','Supressao de intervalo (art. 71 §4) — indenizatoria, nao e hora extra','natureza','indenizatoria','minutos', v_suprimido,'percentual', 50);
    END IF;
    IF COALESCE(e.total_faltas, 0) > 0 THEN
      v_eventos := v_eventos || jsonb_build_object('codigo','faltas','descricao','Faltas','natureza','desconto','quantidade', e.total_faltas);
    END IF;
    IF COALESCE(e.total_atrasos_minutos, 0) > 0 THEN
      v_eventos := v_eventos || jsonb_build_object('codigo','atrasos','descricao','Atrasos','natureza','desconto','minutos', e.total_atrasos_minutos);
    END IF;
    IF v_dsr_perda THEN
      v_eventos := v_eventos || jsonb_build_object('codigo','dsr_perdido','descricao','Perda do DSR por falta injustificada (Lei 605/49 art. 6)','natureza','desconto','quantidade', 1);
    END IF;

    v_colabs := v_colabs || jsonb_build_object(
      'colaborador_cpf',  e.colaborador_cpf,
      'colaborador_nome', e.colaborador_nome,
      'espelho_status',   e.status,
      'eventos',          v_eventos
    );
    v_total := v_total + 1;
  END LOOP;

  -- Idempotente: refaz o pacote 'auto' desta competencia/empresa. O marcador do
  -- pacote automatico e sistema_destino='folha_auto' (formato tem CHECK proprio).
  DELETE FROM public.ponto_exportacoes_folha
  WHERE tenant_id = p_tenant_id
    AND competencia = p_competencia
    AND COALESCE(sistema_destino, '') = 'folha_auto'
    AND (p_empresa_id IS NULL OR empresa_id = p_empresa_id
         OR (p_empresa_id IS NULL AND empresa_id IS NULL));

  INSERT INTO public.ponto_exportacoes_folha
    (tenant_id, empresa_id, competencia, formato, sistema_destino, total_colaboradores, status, dados_exportados)
  VALUES (
    p_tenant_id, p_empresa_id, p_competencia, 'txt', 'folha_auto', v_total, 'gerado',
    jsonb_build_object(
      'competencia', p_competencia,
      'memoria', 'Composto da apuracao fechada (ponto_espelhos). Naturezas distintas: '
              || 'VENCIMENTO (HE 50/100, adicional noturno, reflexo DSR); DESCONTO (faltas, '
              || 'atrasos, perda de DSR); INDENIZATORIA (supressao de intervalo, art. 71 §4 — '
              || 'nao e hora extra). Grandezas em minutos.',
      'colaboradores', v_colabs
    )
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.ponto_compor_pacote_folha(uuid, uuid, text) IS
  'Compoe o pacote da folha a partir da apuracao fechada (ponto_espelhos) com naturezas corretas — vencimento, desconto e indenizatoria (supressao de intervalo NAO entra como hora extra) — e memoria, gravando em ponto_exportacoes_folha. Idempotente (pacote auto). PONTO-361.';
