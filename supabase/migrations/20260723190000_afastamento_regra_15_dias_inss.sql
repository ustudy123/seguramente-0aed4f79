-- =====================================================================
-- Tarefa 2: Regra dos 15 dias automática -> status "aguardando_inss"
-- =====================================================================
-- Ajustes em processar_inteligencia_afastamento():
--  1) A regra dos 15 dias passa a disparar também para afastamento ÚNICO
--     com mais de 15 dias (antes exigia CID em afastamentos_saude, que o
--     formulário de atestado não preenche — então nunca disparava por ali).
--     A acumulação por mesmo CID em 60 dias é mantida quando há CID.
--  2) Ao cruzar 15 dias, o MESMO registro muda status_geral_new para
--     'aguardando_inss' (precedência sobre 'pendencia_critica'), sem exigir
--     um segundo lançamento. A UI habilita o bloco de benefício INSS quando
--     o afastamento está nesse status / com mais de 15 dias.
--
-- Demais regras (saúde mental, NTEP/FAP, CAT, retorno, estabilidade) ficam
-- idênticas à versão viva.
-- =====================================================================

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

        -- Pendência: Entrevista de Retorno
        INSERT INTO public.afastamentos_pendencias (afastamento_id, tenant_id, tipo_pendencia, descricao, prioridade)
        VALUES (NEW.id, NEW.tenant_id, 'entrevista_retorno', 'Realizar entrevista de retorno obrigatória por CID F', 'media')
        ON CONFLICT DO NOTHING;

        -- Verificar setor (Últimos 90 dias)
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
        AND s.cid_principal = v_cid -- Simplificado para CID igual por enquanto
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

        -- Atualizar Tabela FAP
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

    -- Regra 9: Estabilidade
    IF NEW.tipo_principal_new IN ('beneficio_b91', 'licenca_maternidade', 'mandato_sindical') THEN
        INSERT INTO public.afastamentos_marcadores (afastamento_id, tenant_id, marcador) VALUES (NEW.id, NEW.tenant_id, 'estabilidade_provisoria');
    END IF;

    -- Status Geral:
    --  * Regra dos 15 dias tem precedência -> 'aguardando_inss' (sem 2º lançamento).
    --  * Caso contrário, pendência crítica -> 'pendencia_critica'.
    -- Não rebaixa status já avançados (em_beneficio/encerrado/cancelado).
    SELECT count(*) INTO v_mental_setor_count FROM public.afastamentos_pendencias WHERE afastamento_id = NEW.id AND status = 'pendente' AND prioridade = 'critica';
    IF v_inss_15 AND NEW.status_geral_new NOT IN ('em_beneficio', 'encerrado', 'cancelado', 'prazo_indeterminado') THEN
        NEW.status_geral_new := 'aguardando_inss';
    ELSIF v_mental_setor_count > 0 AND NEW.status_geral_new NOT IN ('em_beneficio', 'encerrado', 'cancelado') THEN
        NEW.status_geral_new := 'pendencia_critica';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
