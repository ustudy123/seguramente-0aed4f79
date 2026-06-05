-- 1. Função para calcular nexo epidemiológico simplificado (Base NTEP)
CREATE OR REPLACE FUNCTION public.check_ntep_relationship(p_cid TEXT, p_cnae TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Lógica preparada para consulta futura em tabela oficial
    -- Por enquanto, retorna 'suspeito' para demonstração se CID começar com certas letras 
    -- e houver CNAE (exemplo didático: CID M ou S com CNAE de indústria/construção)
    IF p_cid IS NULL OR p_cnae IS NULL THEN
        RETURN 'sem_ntep';
    END IF;

    -- Simulação de regra NTEP (ajustar conforme tabela oficial depois)
    IF (p_cid LIKE 'M%' OR p_cid LIKE 'S%' OR p_cid LIKE 'F%') AND (p_cnae LIKE '41%' OR p_cnae LIKE '42%' OR p_cnae LIKE '10%') THEN
        RETURN 'suspeito';
    END IF;

    RETURN 'sem_ntep';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Função Principal do Motor de Inteligência
CREATE OR REPLACE FUNCTION public.processar_inteligencia_afastamento()
RETURNS TRIGGER AS $$
DECLARE
    v_dias INTEGER;
    v_cid TEXT;
    v_cnae TEXT;
    v_ntep_status TEXT;
    v_acumulado_60_dias INTEGER := 0;
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

    -- Regra 3: Acumulação Previdenciária (60 dias)
    IF v_cid IS NOT NULL AND NEW.colaborador_id IS NOT NULL THEN
        SELECT COALESCE(SUM(dias_afastamento), 0) INTO v_acumulado_60_dias
        FROM public.afastamentos a
        JOIN public.afastamentos_saude s ON a.id = s.afastamento_id
        WHERE a.colaborador_id = NEW.colaborador_id 
        AND a.id != NEW.id
        AND s.cid_principal = v_cid -- Simplificado para CID igual por enquanto
        AND a.data_inicio >= (NEW.data_inicio - interval '60 days');

        IF (v_acumulado_60_dias + COALESCE(NEW.dias_afastamento, 0)) > 15 THEN
            INSERT INTO public.afastamentos_marcadores (afastamento_id, tenant_id, marcador) VALUES (NEW.id, NEW.tenant_id, 'acumulacao_previdenciaria_15_dias');
            INSERT INTO public.afastamentos_marcadores (afastamento_id, tenant_id, marcador) VALUES (NEW.id, NEW.tenant_id, 'afastamento_superior_15_dias');
            
            INSERT INTO public.afastamentos_pendencias (afastamento_id, tenant_id, tipo_pendencia, descricao, prioridade)
            VALUES (NEW.id, NEW.tenant_id, 'inss', 'Trabalhador atingiu 15+ dias acumulados (mesmo CID 60 dias). Avaliar INSS.', 'critica')
            ON CONFLICT DO NOTHING;
            
            INSERT INTO public.afastamentos_pendencias (afastamento_id, tenant_id, tipo_pendencia, descricao, prioridade)
            VALUES (NEW.id, NEW.tenant_id, 's2230', 'Enviar evento S-2230 por afastamento superior a 15 dias.', 'alta')
            ON CONFLICT DO NOTHING;
        END IF;
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

    -- Atualizar Status Geral se houver pendências críticas
    SELECT count(*) INTO v_mental_setor_count FROM public.afastamentos_pendencias WHERE afastamento_id = NEW.id AND status = 'pendente' AND prioridade = 'critica';
    IF v_mental_setor_count > 0 THEN
        NEW.status_geral_new := 'pendencia_critica';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Trigger
DROP TRIGGER IF EXISTS trg_processar_inteligencia_afastamento ON public.afastamentos;
CREATE TRIGGER trg_processar_inteligencia_afastamento
BEFORE INSERT OR UPDATE ON public.afastamentos
FOR EACH ROW EXECUTE FUNCTION public.processar_inteligencia_afastamento();

-- 4. Garantir que as pendências não dupliquem (Chave única para concorrência)
-- Adicionando índice único para evitar duplicidade de pendências pendentes do mesmo tipo no mesmo afastamento
CREATE UNIQUE INDEX IF NOT EXISTS idx_afastamentos_pendencias_unique_type 
ON public.afastamentos_pendencias (afastamento_id, tipo_pendencia) 
WHERE status = 'pendente';

-- Garantir índice único para FAP
CREATE UNIQUE INDEX IF NOT EXISTS idx_afastamentos_fap_unique 
ON public.afastamentos_fap (afastamento_id);
