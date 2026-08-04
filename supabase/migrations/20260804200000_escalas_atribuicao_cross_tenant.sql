-- =====================================================================
-- Atribuição de escala apontando para escala de OUTRO tenant
--
-- Levantado em 04/08/2026: 21 atribuições do tenant
-- 299779a8-1cd2-4ffe-9462-78181426cd1a apontam para 9 escalas do tenant
-- 83f1b040-c857-45a4-b71d-506e2a32d527 — que está vivo (5 pessoas, 1.195
-- dias de ponto). Não é resíduo de migração: são dois tenants reais
-- compartilhando escala sem querer.
--
-- Consequência prática, e é ela que fecha o caso dos sábados:
--   • ponto_jornada_do_dia NÃO confere o tenant da escala, então a jornada
--     prevista é aplicada normalmente — inclusive aos sábados;
--   • ponto_equalizacao_competencia CONFERE, não acha a escala e levanta
--     exceção, de modo que a equalização nunca é calculada para essas
--     pessoas.
-- Resultado: cobra-se a jornada de sábado e não se aplica a equalização
-- que existiria para compensá-la.
--
-- Correção de dado, não de regra. Duas escolhas deliberadas:
--
--   1. COPIAR, não mover. Mudar o tenant_id das escalas quebraria o outro
--      tenant, que também as usa. Cada tenant passa a ter a sua.
--   2. Não rodar sozinha. Isto altera a jornada prevista de gente real e
--      faz a equalização passar a valer onde hoje não vale. Quem decide o
--      momento é quem opera a folha — a migration só deixa a ferramenta
--      pronta, com relatório e caminho de volta.
-- =====================================================================

-- REGISTRO DA CORREÇÃO — é o que permite desfazer -----------------------
CREATE TABLE IF NOT EXISTS public.ponto_escala_copia_tenant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,            -- tenant que passou a ter a cópia
  escala_origem_id uuid NOT NULL,     -- escala do outro tenant
  escala_origem_tenant uuid NOT NULL,
  escala_copia_id uuid NOT NULL,
  atribuicoes_repontadas integer NOT NULL DEFAULT 0,
  executado_em timestamptz NOT NULL DEFAULT now(),
  executado_por uuid,
  UNIQUE (tenant_id, escala_origem_id)
);

GRANT SELECT ON public.ponto_escala_copia_tenant TO authenticated;
GRANT ALL ON public.ponto_escala_copia_tenant TO service_role;
ALTER TABLE public.ponto_escala_copia_tenant ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant le ponto_escala_copia_tenant" ON public.ponto_escala_copia_tenant;
CREATE POLICY "Tenant le ponto_escala_copia_tenant" ON public.ponto_escala_copia_tenant
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_user_tenant_id());

-- DIAGNÓSTICO — o que está fora do lugar --------------------------------
CREATE OR REPLACE FUNCTION public.ponto_escalas_cross_tenant()
RETURNS TABLE(
  tenant_da_atribuicao uuid,
  escala_id uuid,
  tenant_da_escala uuid,
  escala_nome text,
  colaboradores integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.tenant_id, a.escala_id, e.tenant_id, e.nome, count(DISTINCT a.colaborador_cpf)::int
  FROM public.ponto_escala_atribuicoes a
  JOIN public.ponto_escalas e ON e.id = a.escala_id
  WHERE COALESCE(a.ativa, true)
    AND e.tenant_id IS DISTINCT FROM a.tenant_id
  GROUP BY 1, 2, 3, 4
  ORDER BY 1, 4;
$$;

GRANT EXECUTE ON FUNCTION public.ponto_escalas_cross_tenant() TO authenticated;

-- CORREÇÃO — copia a escala para o tenant que a usa e repõe o vínculo ---
CREATE OR REPLACE FUNCTION public.ponto_escalas_corrigir_tenant(
  p_tenant_id uuid DEFAULT NULL,
  p_aplicar boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  v_nova uuid;
  v_emp uuid;
  v_n_escalas int := 0;
  v_n_atrib int := 0;
  v_detalhe jsonb := '[]'::jsonb;
BEGIN
  FOR r IN
    SELECT * FROM public.ponto_escalas_cross_tenant()
    WHERE p_tenant_id IS NULL OR tenant_da_atribuicao = p_tenant_id
  LOOP
    v_detalhe := v_detalhe || jsonb_build_object(
      'tenant', r.tenant_da_atribuicao,
      'escala_origem', r.escala_id,
      'escala_nome', r.escala_nome,
      'colaboradores', r.colaboradores);

    v_n_escalas := v_n_escalas + 1;
    v_n_atrib := v_n_atrib + r.colaboradores;

    CONTINUE WHEN NOT p_aplicar;

    -- Já copiada numa execução anterior: reaproveita.
    SELECT escala_copia_id INTO v_nova
    FROM public.ponto_escala_copia_tenant
    WHERE tenant_id = r.tenant_da_atribuicao AND escala_origem_id = r.escala_id;

    IF v_nova IS NULL THEN
      -- empresa da escala só vem junto se existir no tenant de destino;
      -- caso contrário a cópia herdaria outra referência cruzada.
      SELECT ec.id INTO v_emp
      FROM public.ponto_escalas e
      JOIN public.empresa_cadastro ec
        ON ec.id = e.empresa_id AND ec.tenant_id = r.tenant_da_atribuicao
      WHERE e.id = r.escala_id;

      INSERT INTO public.ponto_escalas (
        tenant_id, empresa_id, nome, tipo, descricao_contratual, descricao_original,
        dias_config, dias_semana, compensacoes_mensais, regras_extras, observacoes,
        jornada_diaria_minutos, jornada_semanal_minutos, jornada_mensal_minutos,
        carga_semanal_contratada_min, intervalo_intrajornada_minutos,
        tolerancia_minutos, tolerancia_diaria_minutos,
        hora_entrada_padrao, hora_saida_padrao, janela_flexivel,
        adicional_noturno_inicio, adicional_noturno_fim, percentual_adicional_noturno,
        usa_hora_ficta_noturna, percentual_hora_extra_50, percentual_hora_extra_100,
        sabado_util, domingo_util, comportamento_feriado, equalizacao_mensal_ativa,
        ciclo_horas_trabalho, ciclo_horas_descanso, ciclo_inicio_data, ciclo_inicio_hora,
        modalidade, origem_input, nivel_confianca, ativa
      )
      SELECT
        r.tenant_da_atribuicao, v_emp, e.nome, e.tipo, e.descricao_contratual, e.descricao_original,
        e.dias_config, e.dias_semana, e.compensacoes_mensais, e.regras_extras, e.observacoes,
        e.jornada_diaria_minutos, e.jornada_semanal_minutos, e.jornada_mensal_minutos,
        e.carga_semanal_contratada_min, e.intervalo_intrajornada_minutos,
        e.tolerancia_minutos, e.tolerancia_diaria_minutos,
        e.hora_entrada_padrao, e.hora_saida_padrao, e.janela_flexivel,
        e.adicional_noturno_inicio, e.adicional_noturno_fim, e.percentual_adicional_noturno,
        e.usa_hora_ficta_noturna, e.percentual_hora_extra_50, e.percentual_hora_extra_100,
        e.sabado_util, e.domingo_util, e.comportamento_feriado, e.equalizacao_mensal_ativa,
        e.ciclo_horas_trabalho, e.ciclo_horas_descanso, e.ciclo_inicio_data, e.ciclo_inicio_hora,
        e.modalidade, e.origem_input, e.nivel_confianca, e.ativa
      FROM public.ponto_escalas e
      WHERE e.id = r.escala_id
      RETURNING id INTO v_nova;

      -- Blocos de horário e recorrências acompanham a escala: sem eles a
      -- cópia teria jornada mas não teria horário.
      INSERT INTO public.ponto_escala_periodos (tenant_id, escala_id, dia_semana, hora_inicio, hora_fim, ordem_bloco)
      SELECT r.tenant_da_atribuicao, v_nova, p.dia_semana, p.hora_inicio, p.hora_fim, p.ordem_bloco
      FROM public.ponto_escala_periodos p WHERE p.escala_id = r.escala_id;

      INSERT INTO public.ponto_escala_recorrencias (tenant_id, escala_id, dia_semana, ordinal_mes, hora_inicio, hora_fim, descricao, observacao)
      SELECT r.tenant_da_atribuicao, v_nova, c.dia_semana, c.ordinal_mes, c.hora_inicio, c.hora_fim, c.descricao, c.observacao
      FROM public.ponto_escala_recorrencias c WHERE c.escala_id = r.escala_id;

      INSERT INTO public.ponto_escala_copia_tenant (
        tenant_id, escala_origem_id, escala_origem_tenant, escala_copia_id, executado_por)
      VALUES (r.tenant_da_atribuicao, r.escala_id, r.tenant_da_escala, v_nova, auth.uid());
    END IF;

    UPDATE public.ponto_escala_atribuicoes
       SET escala_id = v_nova
     WHERE tenant_id = r.tenant_da_atribuicao
       AND escala_id = r.escala_id;

    UPDATE public.ponto_escala_copia_tenant
       SET atribuicoes_repontadas = r.colaboradores
     WHERE tenant_id = r.tenant_da_atribuicao AND escala_origem_id = r.escala_id;

    v_nova := NULL;
  END LOOP;

  RETURN jsonb_build_object(
    'aplicado', p_aplicar,
    'escalas', v_n_escalas,
    'colaboradores', v_n_atrib,
    'detalhe', v_detalhe
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ponto_escalas_corrigir_tenant(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ponto_escalas_corrigir_tenant(uuid, boolean) TO authenticated;

COMMENT ON FUNCTION public.ponto_escalas_corrigir_tenant(uuid, boolean) IS
  'Copia para o tenant que a usa cada escala vinculada a partir de outro tenant e repõe as atribuições. p_aplicar=false apenas relata. O tenant de origem não é alterado.';
