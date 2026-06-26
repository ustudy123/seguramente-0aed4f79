-- =====================================================================
-- Tarefa 5: Estabilidade pós-acidente + alerta 30 dias antes do vencimento
-- =====================================================================
-- 1) Coluna afastamentos.data_fim_estabilidade (acidente/doença ocupacional).
-- 2) processar_inteligencia_afastamento (Regra 9): além do marcador, calcula
--    a estabilidade de 12 meses a partir do RETORNO (data_fim) para acidente
--    típico/trajeto e doença ocupacional (art. 118 CLT). B91 segue calculado
--    em beneficios_inss (trigger calcular_estabilidade_b91). Demais regras
--    idênticas à versão da Tarefa 2.
-- 3) Função + job pg_cron diário que gera alerta em alertas_saude 30 dias
--    antes do fim da estabilidade (B91 e acidente/doença ocupacional), com
--    dedup por referência.
-- =====================================================================

ALTER TABLE public.afastamentos ADD COLUMN IF NOT EXISTS data_fim_estabilidade date;
COMMENT ON COLUMN public.afastamentos.data_fim_estabilidade IS 'Fim da estabilidade provisória (retorno + 12 meses) para acidente/doença ocupacional.';

-- ---------------------------------------------------------------------
-- Motor: recria com a Regra 9 estendida (data de estabilidade)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.processar_inteligencia_afastamento()
RETURNS TRIGGER AS $$
DECLARE
    v_dias INTEGER;
    v_cid TEXT;
    v_cnae TEXT;
    v_ntep_status TEXT;
    v_acumulado_60_dias INTEGER := 0;
    v_episodio_dias INTEGER := 0;
    v_inss_15 BOOLEAN := FALSE;
    v_setor_id UUID;
    v_mental_setor_count INTEGER := 0;
    v_colaborador_nome TEXT;
    v_msg TEXT;
    v_prioridade TEXT;
BEGIN
    -- Regra 1: Cálculo de Dias
    IF NEW.prazo_indeterminado THEN
        NEW.dias_afastamento := NULL;
        IF NEW.status_geral_new NOT IN ('prazo_indeterminado', 'em_beneficio') THEN
            NEW.status_geral_new := 'prazo_indeterminado';
        END IF;
    ELSIF NEW.data_inicio IS NOT NULL AND NEW.data_fim IS NOT NULL THEN
        v_dias := (NEW.data_fim - NEW.data_inicio) + 1;
        NEW.dias_afastamento := v_dias;
    END IF;

    -- Obter dados auxiliares
    SELECT colaborador_nome, setor_id INTO v_colaborador_nome, v_setor_id FROM public.afastamentos WHERE id = NEW.id;
    SELECT cid_principal INTO v_cid FROM public.afastamentos_saude WHERE afastamento_id = NEW.id;
    SELECT cnpj INTO v_cnae FROM public.empresa_cadastro WHERE id = NEW.empresa_id;

    -- Limpar marcadores automáticos anteriores para reprocessar
    DELETE FROM public.afastamentos_marcadores WHERE afastamento_id = NEW.id AND origem = 'sistema';

    -- Regra 2: Saúde Mental (CID F)
    IF v_cid LIKE 'F%' THEN
        INSERT INTO public.afastamentos_marcadores (afastamento_id, tenant_id, marcador) VALUES (NEW.id, NEW.tenant_id, 'saude_mental');
        INSERT INTO public.afastamentos_marcadores (afastamento_id, tenant_id, marcador) VALUES (NEW.id, NEW.tenant_id, 'cid_f');
        INSERT INTO public.afastamentos_marcadores (afastamento_id, tenant_id, marcador) VALUES (NEW.id, NEW.tenant_id, 'poss_risco_psicossocial');

        INSERT INTO public.afastamentos_pendencias (afastamento_id, tenant_id, tipo_pendencia, descricao, prioridade)
        VALUES (NEW.id, NEW.tenant_id, 'entrevista_retorno', 'Realizar entrevista de retorno obrigatória por CID F', 'media')
        ON CONFLICT DO NOTHING;

        IF v_setor_id IS NOT NULL THEN
            SELECT count(*) INTO v_mental_setor_count
            FROM public.afastamentos a
            JOIN public.afastamentos_saude s ON a.id = s.afastamento_id
            WHERE a.setor_id = v_setor_id
            AND s.cid_principal LIKE 'F%'
            AND a.created_at >= (now() - interval '90 days');

            IF v_mental_setor_count >= 3 THEN
                INSERT INTO public.afastamentos_marcadores (afastamento_id, tenant_id, marcador) VALUES (NEW.id, NEW.tenant_id, 'padrao_coletivo_setor');
                INSERT INTO public.afastamentos_pendencias (afastamento_id, tenant_id, tipo_pendencia, descricao, prioridade)
                VALUES (NEW.id, NEW.tenant_id, 'revisao_sst', 'Alerta: 3+ afastamentos CID F no setor em 90 dias. Revisar PGR/FPR.', 'alta')
                ON CONFLICT DO NOTHING;
            END IF;
        END IF;
    END IF;

    -- Regra 3: Regra dos 15 dias (único OU acumulado mesmo CID em 60 dias) -> INSS
    v_episodio_dias := COALESCE(NEW.dias_afastamento, 0);
    IF v_cid IS NOT NULL AND NEW.colaborador_id IS NOT NULL THEN
        SELECT COALESCE(SUM(dias_afastamento), 0) INTO v_acumulado_60_dias
        FROM public.afastamentos a
        JOIN public.afastamentos_saude s ON a.id = s.afastamento_id
        WHERE a.colaborador_id = NEW.colaborador_id
        AND a.id != NEW.id
        AND s.cid_principal = v_cid
        AND a.data_inicio >= (NEW.data_inicio - interval '60 days');
        v_episodio_dias := v_episodio_dias + v_acumulado_60_dias;
    END IF;

    IF v_episodio_dias > 15 THEN
        INSERT INTO public.afastamentos_marcadores (afastamento_id, tenant_id, marcador) VALUES (NEW.id, NEW.tenant_id, 'acumulacao_previdenciaria_15_dias');
        INSERT INTO public.afastamentos_marcadores (afastamento_id, tenant_id, marcador) VALUES (NEW.id, NEW.tenant_id, 'afastamento_superior_15_dias');

        INSERT INTO public.afastamentos_pendencias (afastamento_id, tenant_id, tipo_pendencia, descricao, prioridade)
        VALUES (NEW.id, NEW.tenant_id, 'inss', 'Trabalhador atingiu 15+ dias no episódio. Avaliar encaminhamento ao INSS e preencher o benefício.', 'critica')
        ON CONFLICT DO NOTHING;

        INSERT INTO public.afastamentos_pendencias (afastamento_id, tenant_id, tipo_pendencia, descricao, prioridade)
        VALUES (NEW.id, NEW.tenant_id, 's2230', 'Enviar evento S-2230 por afastamento superior a 15 dias.', 'alta')
        ON CONFLICT DO NOTHING;

        v_inss_15 := TRUE;
    END IF;

    -- Regra 4 & 7: NTEP e FAP
    v_ntep_status := public.check_ntep_relationship(v_cid, v_cnae);
    IF v_ntep_status = 'suspeito' THEN
        INSERT INTO public.afastamentos_marcadores (afastamento_id, tenant_id, marcador) VALUES (NEW.id, NEW.tenant_id, 'ntep_suspeito');
        INSERT INTO public.afastamentos_marcadores (afastamento_id, tenant_id, marcador) VALUES (NEW.id, NEW.tenant_id, 'risco_impacto_fap');

        INSERT INTO public.afastamentos_pendencias (afastamento_id, tenant_id, tipo_pendencia, descricao, prioridade)
        VALUES (NEW.id, NEW.tenant_id, 'ntep', 'Possível NTEP identificado. Avaliar nexo ocupacional.', 'alta')
        ON CONFLICT DO NOTHING;

        INSERT INTO public.afastamentos_fap (afastamento_id, tenant_id, impacta_fap, nivel_risco, motivo_impacto)
        VALUES (NEW.id, NEW.tenant_id, FALSE, 'risco_alto', 'NTEP Suspeito (' || v_cid || ')')
        ON CONFLICT (afastamento_id) DO UPDATE SET nivel_risco = 'risco_alto', motivo_impacto = EXCLUDED.motivo_impacto;
    END IF;

    -- Regra 5: CAT
    IF NEW.tipo_principal_new IN ('acidente_tipico', 'acidente_trajeto', 'doenca_ocupacional') THEN
        INSERT INTO public.afastamentos_marcadores (afastamento_id, tenant_id, marcador) VALUES (NEW.id, NEW.tenant_id, 'cat_obrigatoria');
        INSERT INTO public.afastamentos_marcadores (afastamento_id, tenant_id, marcador) VALUES (NEW.id, NEW.tenant_id, 'cat_pendente');

        INSERT INTO public.afastamentos_pendencias (afastamento_id, tenant_id, tipo_pendencia, descricao, prioridade)
        VALUES (NEW.id, NEW.tenant_id, 'cat', 'CAT obrigatória para este tipo de afastamento.', 'critica')
        ON CONFLICT DO NOTHING;

        INSERT INTO public.afastamentos_pendencias (afastamento_id, tenant_id, tipo_pendencia, descricao, prioridade)
        VALUES (NEW.id, NEW.tenant_id, 's2210', 'Enviar S-2210 referente à CAT obrigatória.', 'critica')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Regra 8: Retorno ao Trabalho
    IF NEW.dias_afastamento >= 30 OR NEW.tipo_principal_new IN ('beneficio_b31', 'beneficio_b91', 'licenca_maternidade') THEN
        INSERT INTO public.afastamentos_marcadores (afastamento_id, tenant_id, marcador) VALUES (NEW.id, NEW.tenant_id, 'retorno_obrigatorio');
        INSERT INTO public.afastamentos_pendencias (afastamento_id, tenant_id, tipo_pendencia, descricao, prioridade)
        VALUES (NEW.id, NEW.tenant_id, 'aso_retorno', 'Exame de retorno ao trabalho obrigatório (>30 dias ou benefício)', 'alta')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Regra 9: Estabilidade (marcador + data para acidente/doença ocupacional)
    IF NEW.tipo_principal_new IN ('beneficio_b91', 'licenca_maternidade', 'mandato_sindical', 'doenca_ocupacional', 'acidente_tipico', 'acidente_trajeto') THEN
        INSERT INTO public.afastamentos_marcadores (afastamento_id, tenant_id, marcador) VALUES (NEW.id, NEW.tenant_id, 'estabilidade_provisoria');
        -- Art. 118 CLT: 12 meses de estabilidade a partir do RETORNO (data_fim)
        -- para acidente de trabalho / doença ocupacional. B91 é calculado em
        -- beneficios_inss (a partir da data_alta).
        IF NEW.tipo_principal_new IN ('doenca_ocupacional', 'acidente_tipico', 'acidente_trajeto')
           AND NEW.data_fim IS NOT NULL THEN
            NEW.data_fim_estabilidade := (NEW.data_fim + INTERVAL '12 months')::date;
        END IF;
    ELSE
        NEW.data_fim_estabilidade := NULL;
    END IF;

    -- Status Geral
    SELECT count(*) INTO v_mental_setor_count FROM public.afastamentos_pendencias WHERE afastamento_id = NEW.id AND status = 'pendente' AND prioridade = 'critica';
    IF v_inss_15 AND NEW.status_geral_new NOT IN ('em_beneficio', 'encerrado', 'cancelado', 'prazo_indeterminado') THEN
        NEW.status_geral_new := 'aguardando_inss';
    ELSIF v_mental_setor_count > 0 AND NEW.status_geral_new NOT IN ('em_beneficio', 'encerrado', 'cancelado') THEN
        NEW.status_geral_new := 'pendencia_critica';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---------------------------------------------------------------------
-- Geração diária dos alertas de "estabilidade vence em 30 dias"
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gerar_alertas_estabilidade()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- B91 (beneficios_inss)
    INSERT INTO public.alertas_saude (tenant_id, tipo, referencia_tipo, referencia_id, colaborador_id, colaborador_nome, titulo, descricao, prioridade)
    SELECT b.tenant_id, 'estabilidade_30_dias', 'beneficio_inss', b.id, b.colaborador_id, b.colaborador_nome,
           'Estabilidade vence em 30 dias',
           'A estabilidade de ' || b.colaborador_nome || ' (B91) termina em ' || to_char(b.data_fim_estabilidade, 'DD/MM/YYYY') || '.',
           'alta'
    FROM public.beneficios_inss b
    WHERE b.gera_estabilidade = true
      AND b.data_fim_estabilidade = (CURRENT_DATE + INTERVAL '30 days')::date
      AND NOT EXISTS (
          SELECT 1 FROM public.alertas_saude a
          WHERE a.referencia_id = b.id AND a.tipo = 'estabilidade_30_dias' AND a.resolvido = false
      );

    -- Acidente / doença ocupacional (afastamentos)
    INSERT INTO public.alertas_saude (tenant_id, tipo, referencia_tipo, referencia_id, colaborador_id, colaborador_nome, titulo, descricao, prioridade)
    SELECT af.tenant_id, 'estabilidade_30_dias', 'afastamento', af.id, af.colaborador_id, af.colaborador_nome,
           'Estabilidade vence em 30 dias',
           'A estabilidade de ' || af.colaborador_nome || ' (acidente/doença ocupacional) termina em ' || to_char(af.data_fim_estabilidade, 'DD/MM/YYYY') || '.',
           'alta'
    FROM public.afastamentos af
    WHERE af.data_fim_estabilidade = (CURRENT_DATE + INTERVAL '30 days')::date
      AND NOT EXISTS (
          SELECT 1 FROM public.alertas_saude a
          WHERE a.referencia_id = af.id AND a.tipo = 'estabilidade_30_dias' AND a.resolvido = false
      );
END;
$$;

-- Agenda diária (04:00 UTC). Idempotente: remove o job anterior se existir.
DO $$
BEGIN
    PERFORM cron.unschedule('gerar-alertas-estabilidade-30-dias');
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

SELECT cron.schedule(
    'gerar-alertas-estabilidade-30-dias',
    '0 4 * * *',
    $$SELECT public.gerar_alertas_estabilidade()$$
);
