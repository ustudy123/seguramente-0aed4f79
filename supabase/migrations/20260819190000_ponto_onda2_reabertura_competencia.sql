-- ============================================================================
-- ONDA 2 (parte 4) — Reabertura formal de competência + versão do espelho
-- PONTO-358
--
-- Hoje uma competência fechada aceita marcação de papéis de gestão sem rito
-- (a "válvula" do PONTO-193, que continua existindo). O que falta é a saída
-- FORMAL para o erro legítimo descoberto depois: reabrir com motivo, alçada e
-- trilha; recalcular; e o espelho ganhar uma NOVA VERSÃO — o documento que o
-- colaborador cientificou não pode ser regravado por cima.
--
-- O QUE FAZ (não invasivo — o frontend do fechamento não muda)
--   (1) Metadados de reabertura em ponto_fechamentos.
--   (2) ponto_espelhos_historico: guarda o snapshot do espelho ENTREGUE antes
--       que um novo fechamento o sobrescreva. Cada reabertura arquiva a versão
--       corrente; a anterior fica recuperável.
--   (3) ponto_reabrir_competencia: valida que a competência está fechada, exige
--       motivo, confere a alçada (papéis de gestão), arquiva os espelhos como
--       versão anterior, marca o fechamento como 'reaberto' e registra a trilha.
--
-- O re-fechamento seguinte grava o espelho normalmente (agora "versão N+1"); a
-- versão N fica preservada no histórico.
-- ============================================================================

-- (1) Metadados de reabertura -------------------------------------------------
ALTER TABLE public.ponto_fechamentos
  ADD COLUMN IF NOT EXISTS reaberto_em         timestamptz,
  ADD COLUMN IF NOT EXISTS reaberto_por        text,
  ADD COLUMN IF NOT EXISTS reaberto_por_nome   text,
  ADD COLUMN IF NOT EXISTS motivo_reabertura   text;

-- (2) Histórico de versões do espelho ----------------------------------------
CREATE TABLE IF NOT EXISTS public.ponto_espelhos_historico (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL,
  empresa_id         uuid,
  competencia        text NOT NULL,
  colaborador_cpf    text,
  colaborador_nome   text,
  versao             integer NOT NULL,
  espelho_snapshot   jsonb NOT NULL,
  motivo_reabertura  text,
  reaberto_por       text,
  reaberto_por_nome  text,
  arquivado_em       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ponto_espelhos_historico_lookup
  ON public.ponto_espelhos_historico (tenant_id, competencia, colaborador_cpf, versao);

COMMENT ON TABLE public.ponto_espelhos_historico IS
  'Versoes anteriores dos espelhos de ponto, arquivadas quando a competencia e reaberta. Preserva o documento que o colaborador cientificou — recuperavel por versao.';

ALTER TABLE public.ponto_espelhos_historico ENABLE ROW LEVEL SECURITY;

DO $rls$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
     WHERE schemaname='public' AND tablename='ponto_espelhos_historico'
       AND policyname='ponto_espelhos_historico_leitura') THEN
    CREATE POLICY ponto_espelhos_historico_leitura
      ON public.ponto_espelhos_historico FOR SELECT
      TO authenticated
      USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid OR auth.uid() IS NULL);
  END IF;
END $rls$;

-- Trava do cercado do QA (isolamento de tenant): toda tabela do módulo com
-- tenant_id precisa dela (a rotina PONTO-270 acusa quando falta).
DO $cerca$
BEGIN
  IF to_regprocedure('public.qa_bloqueia_fora_do_cercado()') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_trigger
       WHERE tgname = 'qa_guarda_cercado'
         AND tgrelid = 'public.ponto_espelhos_historico'::regclass
         AND NOT tgisinternal) THEN
    CREATE TRIGGER qa_guarda_cercado
      BEFORE INSERT OR UPDATE OR DELETE ON public.ponto_espelhos_historico
      FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_fora_do_cercado();
  END IF;
END $cerca$;

INSERT INTO public.qa_tabelas_protegidas (tabela, motivo)
SELECT 'ponto_espelhos_historico', 'Cerca generica: tabela tem tenant_id'
WHERE to_regclass('public.qa_tabelas_protegidas') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.qa_tabelas_protegidas x
                  WHERE x.tabela = 'ponto_espelhos_historico');

-- (3) Reabertura formal da competência ---------------------------------------
CREATE OR REPLACE FUNCTION public.ponto_reabrir_competencia(
  p_tenant_id   uuid,
  p_empresa_id  uuid,
  p_competencia text,
  p_motivo      text,
  p_por         text DEFAULT NULL,
  p_por_nome    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_fech   RECORD;
  v_uid    uuid := auth.uid();
  v_alcada boolean := false;
  v_versao int;
  v_qtd    int := 0;
BEGIN
  -- Motivo é obrigatório (reabertura é ato formal).
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'motivo_obrigatorio');
  END IF;

  -- A competência precisa existir e estar FECHADA.
  SELECT * INTO v_fech
  FROM public.ponto_fechamentos f
  WHERE f.tenant_id = p_tenant_id
    AND f.competencia = p_competencia
    AND (p_empresa_id IS NULL OR f.empresa_id IS NOT DISTINCT FROM p_empresa_id)
  ORDER BY f.data_fechamento DESC NULLS LAST
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'competencia_sem_fechamento');
  END IF;
  IF COALESCE(v_fech.status, '') <> 'fechado' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'competencia_nao_esta_fechada', 'status_atual', v_fech.status);
  END IF;

  -- Alçada: só papéis de gestão reabrem. No SQL Editor (auth.uid() nulo), o
  -- administrador executa direto e o responsavel fica registrado por p_por.
  IF v_uid IS NULL THEN
    v_alcada := true;
  ELSE
    SELECT public.has_role(v_uid, 'manager'::public.app_role)
        OR public.has_role(v_uid, 'admin'::public.app_role)
        OR public.has_role(v_uid, 'owner'::public.app_role)
        OR public.has_role(v_uid, 'superadmin'::public.app_role)
      INTO v_alcada;
  END IF;
  IF NOT COALESCE(v_alcada, false) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'sem_alcada_para_reabrir');
  END IF;

  -- Arquiva a versão corrente dos espelhos (a que o colaborador recebeu).
  SELECT COALESCE(max(h.versao), 0) + 1 INTO v_versao
  FROM public.ponto_espelhos_historico h
  WHERE h.tenant_id = p_tenant_id AND h.competencia = p_competencia
    AND h.empresa_id IS NOT DISTINCT FROM p_empresa_id;

  INSERT INTO public.ponto_espelhos_historico
    (tenant_id, empresa_id, competencia, colaborador_cpf, colaborador_nome,
     versao, espelho_snapshot, motivo_reabertura, reaberto_por, reaberto_por_nome)
  SELECT e.tenant_id, e.empresa_id, e.competencia, e.colaborador_cpf, e.colaborador_nome,
         v_versao, to_jsonb(e.*), p_motivo, p_por, p_por_nome
  FROM public.ponto_espelhos e
  WHERE e.tenant_id = p_tenant_id AND e.competencia = p_competencia
    AND (p_empresa_id IS NULL OR e.empresa_id IS NOT DISTINCT FROM p_empresa_id);
  GET DIAGNOSTICS v_qtd = ROW_COUNT;

  -- Marca o fechamento como reaberto (libera novas marcações/edição no periodo).
  UPDATE public.ponto_fechamentos
     SET status = 'reaberto',
         reaberto_em = now(),
         reaberto_por = p_por,
         reaberto_por_nome = p_por_nome,
         motivo_reabertura = p_motivo,
         updated_at = now()
   WHERE id = v_fech.id;

  -- Trilha.
  BEGIN
    INSERT INTO public.ponto_audit_log
      (tenant_id, tabela_origem, registro_id, acao, dados_anteriores, dados_novos, usuario_id)
    VALUES (p_tenant_id, 'ponto_fechamentos', v_fech.id, 'REABERTURA',
            jsonb_build_object('status', 'fechado', 'competencia', p_competencia),
            jsonb_build_object('status', 'reaberto', 'competencia', p_competencia,
                               'motivo', p_motivo, 'por', p_por, 'por_nome', p_por_nome,
                               'espelhos_arquivados', v_qtd, 'versao_arquivada', v_versao),
            v_uid);
  EXCEPTION WHEN OTHERS THEN
    NULL;  -- trilha é acessória; nunca derruba a reabertura
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'competencia', p_competencia,
    'espelhos_arquivados', v_qtd,
    'versao_arquivada', v_versao,
    'status', 'reaberto'
  );
END;
$$;

COMMENT ON FUNCTION public.ponto_reabrir_competencia(uuid, uuid, text, text, text, text) IS
  'Reabertura formal de competencia fechada: exige motivo, confere alcada (papeis de gestao), arquiva a versao corrente dos espelhos no historico (recuperavel), marca o fechamento como reaberto e registra a trilha. O re-fechamento seguinte gera a proxima versao do espelho.';
