-- ============================================================================
-- Corrige processar_inteligencia_afastamento()
--
-- A funcao original (migration 20260605214833) foi escrita contra um schema
-- que nao e o que existe. Desde 05/06/2026 NENHUM afastamento pode ser criado:
-- todo INSERT aborta com 42703. Consequencia: todo atestado com periodo desde
-- entao gerou zero afastamentos, deixando absenteismo, regra 15/30, ASO de
-- retorno, S-2230, CAT e FAP/RAT sem base.
--
-- Defeitos corrigidos aqui:
--   1. NEW.dias_afastamento nao existe em `afastamentos` (a coluna e
--      `dias_totais`; `dias_afastamento` pertence a `atestados`). Havia uma
--      ATRIBUICAO a esse campo, entao o erro era imediato.
--   2. O trigger era BEFORE INSERT mas gravava em afastamentos_marcadores,
--      afastamentos_pendencias e afastamentos_fap usando NEW.id. As tres tem
--      FK para afastamentos(id) — a linha pai ainda nao existe num BEFORE.
--      Passa a ser AFTER INSERT OR UPDATE.
--   3. Lia `colaborador_nome, setor_id` com SELECT ... FROM afastamentos
--      WHERE id = NEW.id dentro de um BEFORE INSERT, o que sempre retornava
--      NULL. Agora le de NEW diretamente.
--   4. Carregava `cnpj` numa variavel chamada v_cnae e passava para
--      check_ntep_relationship(). CNPJ nao e CNAE; o NTEP nunca funcionou.
--      Passa a ler cnae_principal.
--
-- O calculo de dias_totais/alertas continua sendo responsabilidade exclusiva
-- de atualizar_afastamento_dias(), que ja existia e esta correta.
-- ============================================================================

-- ── 1. Parte BEFORE: apenas campos da propria linha ─────────────────────────
CREATE OR REPLACE FUNCTION public.afastamento_campos_before()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Prazo indeterminado nao tem data fim; o status reflete isso.
    IF COALESCE(NEW.prazo_indeterminado, FALSE) THEN
        IF NEW.status_geral_new IS NULL
           OR NEW.status_geral_new NOT IN ('prazo_indeterminado', 'em_beneficio') THEN
            NEW.status_geral_new := 'prazo_indeterminado';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_afastamento_campos_before ON public.afastamentos;
CREATE TRIGGER trg_afastamento_campos_before
BEFORE INSERT OR UPDATE ON public.afastamentos
FOR EACH ROW EXECUTE FUNCTION public.afastamento_campos_before();


-- ── 2. Parte AFTER: marcadores, pendencias e FAP ────────────────────────────
CREATE OR REPLACE FUNCTION public.processar_inteligencia_afastamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_dias              INTEGER := 0;
    v_cid               TEXT;
    v_cnae              TEXT;
    v_ntep_status       TEXT;
    v_acumulado_60_dias INTEGER := 0;
    v_setor_id          UUID;
    v_mental_setor_count INTEGER := 0;
    v_criticas          INTEGER := 0;
BEGIN
    -- O UPDATE de status no final redispara este trigger. Corta a recursao.
    IF pg_trigger_depth() > 1 THEN
        RETURN NULL;
    END IF;

    v_dias     := COALESCE(NEW.dias_totais, 0);
    v_setor_id := NEW.setor_id;

    SELECT cid_principal INTO v_cid
      FROM public.afastamentos_saude
     WHERE afastamento_id = NEW.id;

    -- CNAE principal da empresa (nao o CNPJ, como estava antes)
    SELECT cnae_principal INTO v_cnae
      FROM public.empresa_cadastro
     WHERE id = NEW.empresa_id;

    -- Reprocessa do zero os marcadores automaticos
    DELETE FROM public.afastamentos_marcadores
     WHERE afastamento_id = NEW.id AND origem = 'sistema';

    -- ── Regra 2: Saude Mental (CID F) ──────────────────────────────────────
    IF v_cid LIKE 'F%' THEN
        INSERT INTO public.afastamentos_marcadores (afastamento_id, tenant_id, marcador)
        VALUES (NEW.id, NEW.tenant_id, 'saude_mental'),
               (NEW.id, NEW.tenant_id, 'cid_f'),
               (NEW.id, NEW.tenant_id, 'poss_risco_psicossocial');

        INSERT INTO public.afastamentos_pendencias
            (afastamento_id, tenant_id, tipo_pendencia, descricao, prioridade)
        VALUES (NEW.id, NEW.tenant_id, 'entrevista_retorno',
                'Realizar entrevista de retorno obrigatoria por CID F', 'media')
        ON CONFLICT DO NOTHING;

        IF v_setor_id IS NOT NULL THEN
            SELECT count(*) INTO v_mental_setor_count
              FROM public.afastamentos a
              JOIN public.afastamentos_saude s ON a.id = s.afastamento_id
             WHERE a.setor_id = v_setor_id
               AND s.cid_principal LIKE 'F%'
               AND a.created_at >= (now() - interval '90 days');

            IF v_mental_setor_count >= 3 THEN
                INSERT INTO public.afastamentos_marcadores (afastamento_id, tenant_id, marcador)
                VALUES (NEW.id, NEW.tenant_id, 'padrao_coletivo_setor');

                INSERT INTO public.afastamentos_pendencias
                    (afastamento_id, tenant_id, tipo_pendencia, descricao, prioridade)
                VALUES (NEW.id, NEW.tenant_id, 'revisao_sst',
                        'Alerta: 3+ afastamentos CID F no setor em 90 dias. Revisar PGR/FPR.', 'alta')
                ON CONFLICT DO NOTHING;
            END IF;
        END IF;
    END IF;

    -- ── Regra 3: Acumulacao previdenciaria (mesmo CID em 60 dias) ──────────
    IF v_cid IS NOT NULL AND NEW.colaborador_id IS NOT NULL THEN
        SELECT COALESCE(SUM(a.dias_totais), 0) INTO v_acumulado_60_dias
          FROM public.afastamentos a
          JOIN public.afastamentos_saude s ON a.id = s.afastamento_id
         WHERE a.colaborador_id = NEW.colaborador_id
           AND a.id <> NEW.id
           AND s.cid_principal = v_cid
           AND a.data_inicio >= (NEW.data_inicio - interval '60 days');

        IF (v_acumulado_60_dias + v_dias) > 15 THEN
            INSERT INTO public.afastamentos_marcadores (afastamento_id, tenant_id, marcador)
            VALUES (NEW.id, NEW.tenant_id, 'acumulacao_previdenciaria_15_dias'),
                   (NEW.id, NEW.tenant_id, 'afastamento_superior_15_dias');

            INSERT INTO public.afastamentos_pendencias
                (afastamento_id, tenant_id, tipo_pendencia, descricao, prioridade)
            VALUES (NEW.id, NEW.tenant_id, 'inss',
                    'Trabalhador atingiu 15+ dias acumulados (mesmo CID em 60 dias). Avaliar INSS.', 'critica')
            ON CONFLICT DO NOTHING;

            INSERT INTO public.afastamentos_pendencias
                (afastamento_id, tenant_id, tipo_pendencia, descricao, prioridade)
            VALUES (NEW.id, NEW.tenant_id, 's2230',
                    'Enviar evento S-2230 por afastamento superior a 15 dias.', 'alta')
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    -- ── Regras 4 e 7: NTEP e FAP ───────────────────────────────────────────
    IF v_cid IS NOT NULL AND v_cnae IS NOT NULL THEN
        v_ntep_status := public.check_ntep_relationship(v_cid, v_cnae);

        IF v_ntep_status = 'suspeito' THEN
            INSERT INTO public.afastamentos_marcadores (afastamento_id, tenant_id, marcador)
            VALUES (NEW.id, NEW.tenant_id, 'ntep_suspeito'),
                   (NEW.id, NEW.tenant_id, 'risco_impacto_fap');

            INSERT INTO public.afastamentos_pendencias
                (afastamento_id, tenant_id, tipo_pendencia, descricao, prioridade)
            VALUES (NEW.id, NEW.tenant_id, 'ntep',
                    'Possivel NTEP identificado. Avaliar nexo ocupacional.', 'alta')
            ON CONFLICT DO NOTHING;

            INSERT INTO public.afastamentos_fap
                (afastamento_id, tenant_id, impacta_fap, nivel_risco, motivo_impacto)
            VALUES (NEW.id, NEW.tenant_id, FALSE, 'risco_alto', 'NTEP Suspeito (' || v_cid || ')')
            ON CONFLICT (afastamento_id)
            DO UPDATE SET nivel_risco    = 'risco_alto',
                          motivo_impacto = EXCLUDED.motivo_impacto;
        END IF;
    END IF;

    -- ── Regra 5: CAT obrigatoria ───────────────────────────────────────────
    IF NEW.tipo_principal_new IN ('acidente_tipico', 'acidente_trajeto', 'doenca_ocupacional') THEN
        INSERT INTO public.afastamentos_marcadores (afastamento_id, tenant_id, marcador)
        VALUES (NEW.id, NEW.tenant_id, 'cat_obrigatoria'),
               (NEW.id, NEW.tenant_id, 'cat_pendente');

        INSERT INTO public.afastamentos_pendencias
            (afastamento_id, tenant_id, tipo_pendencia, descricao, prioridade)
        VALUES (NEW.id, NEW.tenant_id, 'cat',
                'CAT obrigatoria para este tipo de afastamento.', 'critica')
        ON CONFLICT DO NOTHING;

        INSERT INTO public.afastamentos_pendencias
            (afastamento_id, tenant_id, tipo_pendencia, descricao, prioridade)
        VALUES (NEW.id, NEW.tenant_id, 's2210',
                'Enviar S-2210 referente a CAT obrigatoria.', 'critica')
        ON CONFLICT DO NOTHING;
    END IF;

    -- ── Regra 8: Retorno ao trabalho ───────────────────────────────────────
    IF v_dias >= 30
       OR NEW.tipo_principal_new IN ('beneficio_b31', 'beneficio_b91', 'licenca_maternidade') THEN
        INSERT INTO public.afastamentos_marcadores (afastamento_id, tenant_id, marcador)
        VALUES (NEW.id, NEW.tenant_id, 'retorno_obrigatorio');

        INSERT INTO public.afastamentos_pendencias
            (afastamento_id, tenant_id, tipo_pendencia, descricao, prioridade)
        VALUES (NEW.id, NEW.tenant_id, 'aso_retorno',
                'Exame de retorno ao trabalho obrigatorio (>30 dias ou beneficio)', 'alta')
        ON CONFLICT DO NOTHING;
    END IF;

    -- ── Regra 9: Estabilidade provisoria ───────────────────────────────────
    IF NEW.tipo_principal_new IN ('beneficio_b91', 'licenca_maternidade', 'mandato_sindical') THEN
        INSERT INTO public.afastamentos_marcadores (afastamento_id, tenant_id, marcador)
        VALUES (NEW.id, NEW.tenant_id, 'estabilidade_provisoria');
    END IF;

    -- ── Status geral quando ha pendencia critica ───────────────────────────
    SELECT count(*) INTO v_criticas
      FROM public.afastamentos_pendencias
     WHERE afastamento_id = NEW.id
       AND status = 'pendente'
       AND prioridade = 'critica';

    IF v_criticas > 0 AND NEW.status_geral_new IS DISTINCT FROM 'pendencia_critica' THEN
        UPDATE public.afastamentos
           SET status_geral_new = 'pendencia_critica'
         WHERE id = NEW.id;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_processar_inteligencia_afastamento ON public.afastamentos;
CREATE TRIGGER trg_processar_inteligencia_afastamento
AFTER INSERT OR UPDATE ON public.afastamentos
FOR EACH ROW EXECUTE FUNCTION public.processar_inteligencia_afastamento();
