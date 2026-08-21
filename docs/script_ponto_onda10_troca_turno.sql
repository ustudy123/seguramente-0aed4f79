-- ============================================================================
-- ENTREGA — ONDA 10 (parte 4): troca de turno com aprovação e recálculo (ESC-020)
-- Fecha a onda 10 (escalas).
--
-- Trocar o turno de dois colaboradores NÃO é editar duas linhas: precisa de
-- APROVAÇÃO (gestor), REGISTRO (quem trocou com quem, quando) e RECÁLCULO — a
-- interjornada de 11h (CLT art. 66) pode mudar para os dois. Cria a tabela
-- ponto_troca_turno (com trava do cercado e RLS por tenant) e o fluxo
-- solicitar → aprovar/recusar → efetivar, simulando a interjornada ANTES de
-- consumar e preservando o histórico de vigência das atribuições.
--
-- Não altera o motor de saldo, a apuração, o espelho nem o fechamento. Aditivo e
-- idempotente. Roda inteiro em UMA transação. SET lock_timeout na DDL.
-- ============================================================================

SET lock_timeout = '10s';

CREATE TABLE IF NOT EXISTS public.ponto_troca_turno (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL,
  empresa_id          uuid,
  atribuicao_a_id     uuid NOT NULL,
  colaborador_a_id    text,
  colaborador_a_nome  text,
  colaborador_a_cpf   text,
  atribuicao_b_id     uuid NOT NULL,
  colaborador_b_id    text,
  colaborador_b_nome  text,
  colaborador_b_cpf   text,
  data_troca          date NOT NULL,
  data_fim_troca      date,
  status              text NOT NULL DEFAULT 'solicitada'
                        CHECK (status IN ('solicitada','aprovada','efetivada','recusada','cancelada')),
  solicitante_id      uuid,
  solicitante_nome    text,
  motivo              text,
  aprovador_id        uuid,
  aprovador_nome      text,
  motivo_recusa       text,
  risco_interjornada  boolean NOT NULL DEFAULT false,
  risco_detalhe       text,
  solicitada_em       timestamptz NOT NULL DEFAULT now(),
  decidida_em         timestamptz,
  efetivada_em        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ponto_troca_turno IS
  'Troca de turno entre colaboradores: solicitacao, aprovacao (alcada) e efetivacao com recalculo. Simula interjornada (art. 66) antes de consumar. ESC-020.';

-- Trava do cercado do QA (isolamento de tenant) — PONTO-270.
DO $cerca$
BEGIN
  IF to_regprocedure('public.qa_bloqueia_fora_do_cercado()') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_trigger
       WHERE tgname = 'qa_guarda_cercado'
         AND tgrelid = 'public.ponto_troca_turno'::regclass
         AND NOT tgisinternal) THEN
    CREATE TRIGGER qa_guarda_cercado
      BEFORE INSERT OR UPDATE OR DELETE ON public.ponto_troca_turno
      FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_fora_do_cercado();
  END IF;
END $cerca$;

INSERT INTO public.qa_tabelas_protegidas (tabela, motivo)
SELECT 'ponto_troca_turno', 'Cerca generica: tabela tem tenant_id'
WHERE to_regclass('public.qa_tabelas_protegidas') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.qa_tabelas_protegidas x
                  WHERE x.tabela = 'ponto_troca_turno');

-- RLS por tenant (PONTO-250) — como toda tabela de ponto.
ALTER TABLE public.ponto_troca_turno ENABLE ROW LEVEL SECURITY;

DO $rls$
BEGIN
  IF to_regprocedure('public.get_user_tenant_id()') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_policies
       WHERE schemaname='public' AND tablename='ponto_troca_turno'
         AND policyname='ponto_troca_turno_tenant') THEN
    CREATE POLICY ponto_troca_turno_tenant
      ON public.ponto_troca_turno
      FOR ALL
      USING (tenant_id = public.get_user_tenant_id())
      WITH CHECK (tenant_id = public.get_user_tenant_id());
  END IF;
END $rls$;

-- ── Solicitar: registra a troca e simula a interjornada dos dois ──
CREATE OR REPLACE FUNCTION public.ponto_troca_turno_solicitar(
  p_tenant_id        uuid,
  p_atribuicao_a_id  uuid,
  p_atribuicao_b_id  uuid,
  p_data_troca       date,
  p_data_fim_troca   date DEFAULT NULL,
  p_solicitante_id   uuid DEFAULT NULL,
  p_solicitante_nome text DEFAULT NULL,
  p_motivo           text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  a        RECORD;
  b        RECORD;
  ea       RECORD;
  eb       RECORD;
  v_gap_a  numeric;
  v_gap_b  numeric;
  v_risco  boolean := false;
  v_det    text := '';
  v_id     uuid;
BEGIN
  SELECT * INTO a FROM public.ponto_escala_atribuicoes WHERE id = p_atribuicao_a_id AND tenant_id = p_tenant_id;
  SELECT * INTO b FROM public.ponto_escala_atribuicoes WHERE id = p_atribuicao_b_id AND tenant_id = p_tenant_id;
  IF a.id IS NULL OR b.id IS NULL THEN
    RAISE EXCEPTION 'Atribuicao de escala nao encontrada para a troca (A=%, B=%).', p_atribuicao_a_id, p_atribuicao_b_id
      USING ERRCODE = 'raise_exception';
  END IF;

  SELECT id, empresa_id, hora_entrada_padrao, hora_saida_padrao INTO ea FROM public.ponto_escalas WHERE id = a.escala_id;
  SELECT id, hora_entrada_padrao, hora_saida_padrao INTO eb FROM public.ponto_escalas WHERE id = b.escala_id;

  IF ea.hora_saida_padrao IS NOT NULL AND eb.hora_entrada_padrao IS NOT NULL THEN
    v_gap_a := (24 - (EXTRACT(hour FROM ea.hora_saida_padrao) + EXTRACT(minute FROM ea.hora_saida_padrao)/60.0))
             + (EXTRACT(hour FROM eb.hora_entrada_padrao) + EXTRACT(minute FROM eb.hora_entrada_padrao)/60.0);
    IF v_gap_a < 11 THEN
      v_risco := true;
      v_det := v_det || format('Colaborador A tem interjornada de %sh ao assumir o turno de B (min. 11h). ', round(v_gap_a,1));
    END IF;
  END IF;
  IF eb.hora_saida_padrao IS NOT NULL AND ea.hora_entrada_padrao IS NOT NULL THEN
    v_gap_b := (24 - (EXTRACT(hour FROM eb.hora_saida_padrao) + EXTRACT(minute FROM eb.hora_saida_padrao)/60.0))
             + (EXTRACT(hour FROM ea.hora_entrada_padrao) + EXTRACT(minute FROM ea.hora_entrada_padrao)/60.0);
    IF v_gap_b < 11 THEN
      v_risco := true;
      v_det := v_det || format('Colaborador B tem interjornada de %sh ao assumir o turno de A (min. 11h). ', round(v_gap_b,1));
    END IF;
  END IF;

  INSERT INTO public.ponto_troca_turno
    (tenant_id, empresa_id, atribuicao_a_id, colaborador_a_id, colaborador_a_nome, colaborador_a_cpf,
     atribuicao_b_id, colaborador_b_id, colaborador_b_nome, colaborador_b_cpf,
     data_troca, data_fim_troca, status, solicitante_id, solicitante_nome, motivo,
     risco_interjornada, risco_detalhe)
  VALUES
    (p_tenant_id, ea.empresa_id, a.id, a.colaborador_id, a.colaborador_nome, a.colaborador_cpf,
     b.id, b.colaborador_id, b.colaborador_nome, b.colaborador_cpf,
     p_data_troca, p_data_fim_troca, 'solicitada', p_solicitante_id, p_solicitante_nome, p_motivo,
     v_risco, NULLIF(btrim(v_det), ''))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

COMMENT ON FUNCTION public.ponto_troca_turno_solicitar(uuid,uuid,uuid,date,date,uuid,text,text) IS
  'Solicita troca de turno entre duas atribuicoes de ponto_escala_atribuicoes, simulando a interjornada de 11h (art. 66) antes de consumar. ESC-020.';

CREATE OR REPLACE FUNCTION public.ponto_troca_turno_aprovar(
  p_troca_id uuid, p_aprovador_id uuid DEFAULT NULL, p_aprovador_nome text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE v_status text;
BEGIN
  UPDATE public.ponto_troca_turno
     SET status = 'aprovada', aprovador_id = p_aprovador_id, aprovador_nome = p_aprovador_nome, decidida_em = now()
   WHERE id = p_troca_id AND status = 'solicitada'
   RETURNING status INTO v_status;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Troca % nao esta em situacao solicitada (nao pode ser aprovada).', p_troca_id USING ERRCODE = 'raise_exception';
  END IF;
  RETURN v_status;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ponto_troca_turno_recusar(
  p_troca_id uuid, p_aprovador_id uuid DEFAULT NULL, p_aprovador_nome text DEFAULT NULL, p_motivo_recusa text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE v_status text;
BEGIN
  UPDATE public.ponto_troca_turno
     SET status = 'recusada', aprovador_id = p_aprovador_id, aprovador_nome = p_aprovador_nome,
         motivo_recusa = p_motivo_recusa, decidida_em = now()
   WHERE id = p_troca_id AND status = 'solicitada'
   RETURNING status INTO v_status;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Troca % nao esta em situacao solicitada (nao pode ser recusada).', p_troca_id USING ERRCODE = 'raise_exception';
  END IF;
  RETURN v_status;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ponto_troca_turno_efetivar(p_troca_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  tr  RECORD;
  a   RECORD;
  b   RECORD;
  d0  date;
BEGIN
  SELECT * INTO tr FROM public.ponto_troca_turno WHERE id = p_troca_id;
  IF tr.id IS NULL THEN
    RAISE EXCEPTION 'Troca % nao encontrada.', p_troca_id USING ERRCODE = 'raise_exception';
  END IF;
  IF tr.status <> 'aprovada' THEN
    RAISE EXCEPTION 'Troca % precisa estar aprovada para ser efetivada (situacao atual: %).', p_troca_id, tr.status USING ERRCODE = 'raise_exception';
  END IF;

  SELECT * INTO a FROM public.ponto_escala_atribuicoes WHERE id = tr.atribuicao_a_id;
  SELECT * INTO b FROM public.ponto_escala_atribuicoes WHERE id = tr.atribuicao_b_id;
  IF a.id IS NULL OR b.id IS NULL THEN
    RAISE EXCEPTION 'Atribuicao original da troca nao existe mais.' USING ERRCODE = 'raise_exception';
  END IF;
  d0 := tr.data_troca;

  IF a.data_inicio < d0 THEN
    UPDATE public.ponto_escala_atribuicoes SET data_fim = d0 - 1 WHERE id = a.id;
  ELSE
    UPDATE public.ponto_escala_atribuicoes SET ativa = false WHERE id = a.id;
  END IF;
  IF b.data_inicio < d0 THEN
    UPDATE public.ponto_escala_atribuicoes SET data_fim = d0 - 1 WHERE id = b.id;
  ELSE
    UPDATE public.ponto_escala_atribuicoes SET ativa = false WHERE id = b.id;
  END IF;

  INSERT INTO public.ponto_escala_atribuicoes
    (tenant_id, escala_id, colaborador_id, colaborador_nome, colaborador_cpf, data_inicio, data_fim, ativa)
  VALUES
    (tr.tenant_id, b.escala_id, a.colaborador_id, a.colaborador_nome, a.colaborador_cpf, d0, tr.data_fim_troca, true),
    (tr.tenant_id, a.escala_id, b.colaborador_id, b.colaborador_nome, b.colaborador_cpf, d0, tr.data_fim_troca, true);

  IF tr.data_fim_troca IS NOT NULL THEN
    INSERT INTO public.ponto_escala_atribuicoes
      (tenant_id, escala_id, colaborador_id, colaborador_nome, colaborador_cpf, data_inicio, data_fim, ativa)
    VALUES
      (tr.tenant_id, a.escala_id, a.colaborador_id, a.colaborador_nome, a.colaborador_cpf, tr.data_fim_troca + 1, NULL, true),
      (tr.tenant_id, b.escala_id, b.colaborador_id, b.colaborador_nome, b.colaborador_cpf, tr.data_fim_troca + 1, NULL, true);
  END IF;

  UPDATE public.ponto_troca_turno SET status = 'efetivada', efetivada_em = now() WHERE id = p_troca_id;
  RETURN 'efetivada';
END;
$function$;

COMMENT ON FUNCTION public.ponto_troca_turno_efetivar(uuid) IS
  'Efetiva a troca de turno em ponto_escala_atribuicoes de forma transacional, preservando o historico de vigencia (encerra as antigas, cria as cruzadas, restaura apos o periodo). ESC-020.';

-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: t | t | t | 4 | OK
--   tabela_ok  : a tabela existe
--   rls_ok     : RLS ativa (PONTO-250)
--   policy_ok  : tem politica por tenant
--   n_funcoes  : as 4 funcoes do fluxo existem
-- ---------------------------------------------------------------------------
SELECT
  (to_regclass('public.ponto_troca_turno') IS NOT NULL) AS tabela_ok,
  (SELECT relrowsecurity FROM pg_class WHERE relname='ponto_troca_turno') AS rls_ok,
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ponto_troca_turno') AS policy_ok,
  (to_regprocedure('public.ponto_troca_turno_solicitar(uuid,uuid,uuid,date,date,uuid,text,text)') IS NOT NULL)::int
  + (to_regprocedure('public.ponto_troca_turno_aprovar(uuid,uuid,text)') IS NOT NULL)::int
  + (to_regprocedure('public.ponto_troca_turno_recusar(uuid,uuid,text,text)') IS NOT NULL)::int
  + (to_regprocedure('public.ponto_troca_turno_efetivar(uuid)') IS NOT NULL)::int AS n_funcoes,
  CASE WHEN to_regclass('public.ponto_troca_turno') IS NOT NULL
        AND (SELECT relrowsecurity FROM pg_class WHERE relname='ponto_troca_turno')
        AND EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ponto_troca_turno')
       THEN 'OK' ELSE 'CONFERIR' END AS erro_tecnico;
