-- Função para sincronizar afastamentos com o ponto diário
CREATE OR REPLACE FUNCTION public.afastamento_sincroniza_ponto() 
RETURNS TRIGGER AS $$
DECLARE
    v_data DATE;
    v_colaborador_id UUID;
    v_colaborador_nome TEXT;
    v_colaborador_cpf TEXT;
    v_tenant_id UUID;
    v_empresa_id UUID;
BEGIN
    v_colaborador_id := NEW.colaborador_id;
    v_colaborador_nome := NEW.colaborador_nome;
    v_colaborador_cpf := NEW.colaborador_cpf;
    v_tenant_id := NEW.tenant_id;
    v_empresa_id := NEW.empresa_id;

    -- Se for INSERT ou UPDATE de datas/status
    IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.data_inicio <> NEW.data_inicio OR OLD.data_fim IS DISTINCT FROM NEW.data_fim OR OLD.status <> NEW.status))) THEN
        
        -- Apenas se o status for ativo ou benefício INSS
        IF NEW.status IN ('ativo', 'beneficio_inss') THEN
            -- Loop do início ao fim (ou até hoje se data_fim for nula)
            v_data := NEW.data_inicio;
            WHILE v_data <= COALESCE(NEW.data_fim, CURRENT_DATE) LOOP
                
                -- Upsert no ponto_diario para marcar como justificado (abono)
                INSERT INTO public.ponto_diario (
                    tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf, 
                    data, status, observacao
                ) VALUES (
                    v_tenant_id, v_empresa_id, v_colaborador_id, v_colaborador_nome, v_colaborador_cpf,
                    v_data, 'justificado', 'Abonado: Afastamento (' || COALESCE(NEW.motivo_principal, 'Motivo não informado') || ')'
                )
                ON CONFLICT (tenant_id, colaborador_id, data) 
                DO UPDATE SET 
                    status = 'justificado',
                    observacao = 'Abonado: Afastamento (' || COALESCE(NEW.motivo_principal, 'Motivo não informado') || ')';
                
                v_data := v_data + INTERVAL '1 day';
                
                -- Limite de segurança para evitar loops infinitos
                IF v_data > NEW.data_inicio + INTERVAL '2 years' THEN EXIT; END IF;
            END LOOP;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para automatizar a sincronização
DROP TRIGGER IF EXISTS tr_afastamento_sincroniza_ponto ON public.afastamentos;
CREATE TRIGGER tr_afastamento_sincroniza_ponto
AFTER INSERT OR UPDATE ON public.afastamentos
FOR EACH ROW EXECUTE FUNCTION public.afastamento_sincroniza_ponto();

-- Adicionar constraint ou trigger de bloqueio de batida para afastados (se ainda não existir lógica robusta no hook)
-- Nota: usePonto.ts já faz o check, mas reforçamos no banco.
CREATE OR REPLACE FUNCTION public.validar_batida_afastamento() 
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.afastamentos 
        WHERE tenant_id = NEW.tenant_id 
        AND colaborador_id = NEW.colaborador_id
        AND status IN ('ativo', 'beneficio_inss')
        AND NEW.data_marcacao BETWEEN data_inicio AND COALESCE(data_fim, '9999-12-31')
    ) THEN
        RAISE EXCEPTION 'Colaborador afastado. Não é possível registrar ponto durante período de afastamento.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_validar_batida_afastamento ON public.ponto_marcacoes;
CREATE TRIGGER tr_validar_batida_afastamento
BEFORE INSERT ON public.ponto_marcacoes
FOR EACH ROW EXECUTE FUNCTION public.validar_batida_afastamento();
