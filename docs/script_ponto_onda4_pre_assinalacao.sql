-- ============================================================================
-- ENTREGA — ONDA 4 (parte 3): pré-assinalação formal do intervalo
-- Alvos: tabela ponto_pre_assinalacao; colunas ponto_diario.intervalo_origem /
--        intervalo_pre_assinalado_minutos; ponto_pre_assinalacao_do_dia();
--        gatilho ponto_diario_pre_assinalacao; ajuste no gatilho de supressão.
-- PONTO-064
--
-- O QUE FAZ (Súmula 338, III/TST; Portaria MTP 671/2021) — DESLIGADO por padrão
--   A jornada de duas batidas só é válida com intervalo EXPRESSAMENTE
--   pré-assinalado. Passa a existir a DECLARAÇÃO formal (por escala ou por
--   colaborador, com vigência e lastro), o espelho passa a exibir se o intervalo
--   do dia veio de batida real ou de pré-assinalação, e a supressão (parte 2)
--   deixa de acusar falsa "supressão total" num dia legitimamente pré-assinalado.
--
-- GARANTIAS
--   · Sem declaração cadastrada, nada muda: intervalo_origem fica 'marcado'
--     (dia com almoço batido) ou NULL, e a supressão fica idêntica à parte 2.
--   · NÃO altera ponto_marcacoes, horas_trabalhadas nem o motor de saldo — a
--     dedução do intervalo na apuração segue exatamente como já era.
--   · Batida real SEMPRE vence o declarado.
--
-- Depende das partes 1 e 2 (faixas e supressão, #16/#17). Aditivo, idempotente,
-- sem backfill. Um único gatilho de ponto_diario é (re)criado; a tabela nova
-- nasce vazia (sem contenção), então não há risco de deadlock entre tabelas.
-- ============================================================================
SET lock_timeout = '10s';

-- (2) Colunas de origem do intervalo no espelho ------------------------------
ALTER TABLE public.ponto_diario
  ADD COLUMN IF NOT EXISTS intervalo_origem text;
ALTER TABLE public.ponto_diario
  ADD COLUMN IF NOT EXISTS intervalo_pre_assinalado_minutos integer;

COMMENT ON COLUMN public.ponto_diario.intervalo_origem IS
  'Origem do intervalo intrajornada do dia: ''marcado'' (almoco batido) ou ''pre_assinalado'' (intervalo declarado, sem batida). NULL quando nao se aplica. Metadado de exibicao — o motor de saldo nao le.';
COMMENT ON COLUMN public.ponto_diario.intervalo_pre_assinalado_minutos IS
  'Minutos do intervalo pre-assinalado aplicado ao dia (quando intervalo_origem = ''pre_assinalado''). Metadado de exibicao.';

-- (1) Tabela da declaração formal --------------------------------------------
CREATE TABLE IF NOT EXISTS public.ponto_pre_assinalacao (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL,
  empresa_id        uuid,
  escala_id         uuid,              -- alvo por escala (amplo)
  colaborador_cpf   text,              -- alvo por colaborador (prevalece sobre a escala)
  intervalo_minutos integer NOT NULL,  -- minutos de intervalo pre-assinalados
  intervalo_inicio  time,              -- janela declarada (opcional)
  intervalo_fim     time,
  data_inicio       date NOT NULL,     -- vigencia
  data_fim          date,              -- NULL = vigente por prazo indeterminado
  lastro            text NOT NULL,     -- fundamento (CCT, acordo, politica interna)
  observacao        text,
  ativa             boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ponto_pre_assinalacao_alvo_chk
    CHECK (escala_id IS NOT NULL OR colaborador_cpf IS NOT NULL),
  CONSTRAINT ponto_pre_assinalacao_minutos_chk
    CHECK (intervalo_minutos >= 0),
  CONSTRAINT ponto_pre_assinalacao_vigencia_chk
    CHECK (data_fim IS NULL OR data_fim >= data_inicio),
  CONSTRAINT ponto_pre_assinalacao_janela_chk
    CHECK (intervalo_inicio IS NULL OR intervalo_fim IS NULL OR intervalo_fim > intervalo_inicio)
);

CREATE INDEX IF NOT EXISTS idx_ponto_pre_assinalacao_escala
  ON public.ponto_pre_assinalacao (tenant_id, escala_id, data_inicio);
CREATE INDEX IF NOT EXISTS idx_ponto_pre_assinalacao_cpf
  ON public.ponto_pre_assinalacao (tenant_id, colaborador_cpf, data_inicio);

COMMENT ON TABLE public.ponto_pre_assinalacao IS
  'Declaracao formal do intervalo intrajornada pre-assinalado (Sumula 338/TST; Portaria MTP 671/2021), por escala ou por colaborador, com vigencia e lastro. Base da validade da jornada de duas batidas.';

ALTER TABLE public.ponto_pre_assinalacao ENABLE ROW LEVEL SECURITY;

DO $rls$
BEGIN
  IF to_regprocedure('public.get_user_tenant_id()') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_policies
       WHERE schemaname='public' AND tablename='ponto_pre_assinalacao'
         AND policyname='ponto_pre_assinalacao_tenant') THEN
    CREATE POLICY ponto_pre_assinalacao_tenant
      ON public.ponto_pre_assinalacao
      FOR ALL
      USING (tenant_id = public.get_user_tenant_id())
      WITH CHECK (tenant_id = public.get_user_tenant_id());
  END IF;
END $rls$;

-- Trava do cercado do QA (isolamento de tenant): toda tabela do modulo com
-- tenant_id precisa dela (a rotina PONTO-270 acusa quando falta).
DO $cerca$
BEGIN
  IF to_regprocedure('public.qa_bloqueia_fora_do_cercado()') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_trigger
       WHERE tgname = 'qa_guarda_cercado'
         AND tgrelid = 'public.ponto_pre_assinalacao'::regclass
         AND NOT tgisinternal) THEN
    CREATE TRIGGER qa_guarda_cercado
      BEFORE INSERT OR UPDATE OR DELETE ON public.ponto_pre_assinalacao
      FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_fora_do_cercado();
  END IF;
END $cerca$;

INSERT INTO public.qa_tabelas_protegidas (tabela, motivo)
SELECT 'ponto_pre_assinalacao', 'Cerca generica: tabela tem tenant_id'
WHERE to_regclass('public.qa_tabelas_protegidas') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.qa_tabelas_protegidas x
                  WHERE x.tabela = 'ponto_pre_assinalacao');

-- (3) Resolução da declaração vigente no dia ---------------------------------
CREATE OR REPLACE FUNCTION public.ponto_pre_assinalacao_do_dia(
  p_tenant_id       uuid,
  p_cpf             text,
  p_colaborador_id  text,
  p_data            date
)
RETURNS TABLE(
  aplica            boolean,
  intervalo_minutos integer,
  intervalo_inicio  time,
  intervalo_fim     time,
  lastro            text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cpf       text := regexp_replace(COALESCE(p_cpf, ''), '[^0-9]', '', 'g');
  v_escala_id uuid;
  r           RECORD;
BEGIN
  -- Escala vigente do colaborador no dia (mesma logica das demais rotinas).
  SELECT a.escala_id INTO v_escala_id
  FROM public.ponto_escala_atribuicoes a
  WHERE a.tenant_id = p_tenant_id
    AND (regexp_replace(COALESCE(a.colaborador_cpf,''), '[^0-9]', '', 'g') = v_cpf
         OR a.colaborador_id::text = p_colaborador_id)
    AND COALESCE(a.ativa, true) = true
    AND a.data_inicio <= p_data
    AND (a.data_fim IS NULL OR a.data_fim >= p_data)
  ORDER BY a.data_inicio DESC
  LIMIT 1;

  -- Declaracao vigente: a especifica do colaborador prevalece sobre a da escala.
  SELECT pa.intervalo_minutos, pa.intervalo_inicio, pa.intervalo_fim, pa.lastro
    INTO r
  FROM public.ponto_pre_assinalacao pa
  WHERE pa.tenant_id = p_tenant_id
    AND COALESCE(pa.ativa, true) = true
    AND pa.data_inicio <= p_data
    AND (pa.data_fim IS NULL OR pa.data_fim >= p_data)
    AND (
      (pa.colaborador_cpf IS NOT NULL
        AND regexp_replace(pa.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf)
      OR (pa.colaborador_cpf IS NULL AND pa.escala_id IS NOT NULL
        AND pa.escala_id = v_escala_id)
    )
  ORDER BY (pa.colaborador_cpf IS NOT NULL) DESC,  -- especifica primeiro
           pa.data_inicio DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;  -- sem declaracao: nenhuma linha (o chamador trata como "nao aplica")
  END IF;

  aplica            := true;
  intervalo_minutos := r.intervalo_minutos;
  intervalo_inicio  := r.intervalo_inicio;
  intervalo_fim     := r.intervalo_fim;
  lastro            := r.lastro;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.ponto_pre_assinalacao_do_dia(uuid, text, text, date) IS
  'Resolve a pre-assinalacao vigente no dia (colaborador-especifica prevalece sobre a da escala). Retorna sem linha quando nao ha declaracao. Sumula 338/TST.';

-- (4) Consolidação: marca a origem do intervalo (real vence o declarado) ------
CREATE OR REPLACE FUNCTION public.ponto_diario_pre_assinalacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_aplica boolean;
  v_min    integer;
BEGIN
  -- Recalculado a cada consolidacao -> idempotente e sem acumular.
  NEW.intervalo_pre_assinalado_minutos := NULL;

  IF NEW.saida_almoco IS NOT NULL AND NEW.retorno_almoco IS NOT NULL THEN
    -- Batida real do almoco: real SEMPRE vence o declarado.
    NEW.intervalo_origem := 'marcado';
  ELSE
    v_aplica := false;
    SELECT p.aplica, p.intervalo_minutos INTO v_aplica, v_min
    FROM public.ponto_pre_assinalacao_do_dia(
           NEW.tenant_id, NEW.colaborador_cpf, NEW.colaborador_id::text, NEW.data) p;

    IF COALESCE(v_aplica, false) THEN
      NEW.intervalo_origem := 'pre_assinalado';
      NEW.intervalo_pre_assinalado_minutos := v_min;
    ELSE
      NEW.intervalo_origem := NULL;  -- desligado: nada declarado
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ponto_diario_pre_assinalacao ON public.ponto_diario;
CREATE TRIGGER trg_ponto_diario_pre_assinalacao
  BEFORE INSERT OR UPDATE ON public.ponto_diario
  FOR EACH ROW EXECUTE FUNCTION public.ponto_diario_pre_assinalacao();

COMMENT ON FUNCTION public.ponto_diario_pre_assinalacao() IS
  'Na consolidacao: marca ponto_diario.intervalo_origem (''marcado'' quando ha almoco batido; ''pre_assinalado'' quando nao ha e existe declaracao vigente). Roda ANTES do gatilho de supressao. Nao altera horas_trabalhadas nem o saldo. Sumula 338/TST.';

-- (5) Supressão ciente da pré-assinalação (parte 2 ajustada) -----------------
CREATE OR REPLACE FUNCTION public.ponto_diario_supressao_intervalo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_jornada   int;
  v_gozado    int;
  v_suprimido int;
BEGIN
  v_jornada := COALESCE(floor(EXTRACT(EPOCH FROM NEW.horas_trabalhadas)/60)::int, 0);

  IF NEW.saida_almoco IS NOT NULL AND NEW.retorno_almoco IS NOT NULL THEN
    v_gozado := GREATEST(0, floor(EXTRACT(EPOCH FROM (NEW.retorno_almoco - NEW.saida_almoco))/60)::int);
  ELSE
    v_gozado := 0;
  END IF;

  -- Intervalo pre-assinalado vigente conta como gozado (Sumula 338/TST): o
  -- gatilho de pre-assinalacao roda antes e ja preencheu estes campos.
  IF v_gozado = 0 AND NEW.intervalo_origem = 'pre_assinalado' THEN
    v_gozado := COALESCE(NEW.intervalo_pre_assinalado_minutos, 0);
  END IF;

  v_suprimido := (public.ponto_supressao_intervalo(v_jornada, v_gozado)->>'minutos_suprimidos')::int;
  NEW.he_intervalo_suprimido_minutos := v_suprimido;

  -- Sinaliza a supressao (parcial ou total). Idempotente por colaborador/dia.
  IF v_suprimido > 0 AND NEW.tenant_id IS NOT NULL THEN
    INSERT INTO public.ponto_alertas
      (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
       tipo, severidade, titulo, descricao, data_referencia)
    SELECT NEW.tenant_id, NEW.empresa_id, NEW.colaborador_id::text,
           NEW.colaborador_nome, NEW.colaborador_cpf,
           'intervalo_suprimido', 'alta',
           CASE WHEN v_gozado = 0 THEN 'Intervalo intrajornada nao usufruido (supressao total)'
                ELSE 'Intervalo intrajornada suprimido (parcial)' END,
           format('Jornada de %s min com %s min de pausa: %s min de intervalo suprimidos '
               || '(art. 71). Indenizacao de 50%% sobre os minutos suprimidos, natureza '
               || 'indenizatoria. Regularizar antes do fechamento.',
               v_jornada, v_gozado, v_suprimido),
           NEW.data
    WHERE NOT EXISTS (
      SELECT 1 FROM public.ponto_alertas a
      WHERE a.tenant_id = NEW.tenant_id
        AND a.colaborador_cpf = NEW.colaborador_cpf
        AND a.tipo = 'intervalo_suprimido'
        AND a.data_referencia = NEW.data
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.ponto_diario_supressao_intervalo() IS
  'Na consolidacao do dia: grava he_intervalo_suprimido_minutos e alerta o RH quando ha supressao de intervalo (parcial ou total). Intervalo validamente pre-assinalado conta como gozado. Idempotente por colaborador/dia. CLT art. 71; Sumula 338/TST.';

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA — o SQL Editor mostra apenas o último resultado.
-- Esperado: t | t | t | t | t | t | OK
--   tabela_existe    : t   (ponto_pre_assinalacao)
--   colunas_espelho  : t   (intervalo_origem + intervalo_pre_assinalado_minutos)
--   funcao_resolve   : t   (ponto_pre_assinalacao_do_dia)
--   gatilho_pre      : t   (trg_ponto_diario_pre_assinalacao na ponto_diario)
--   pre_antes_supr   : t   (o gatilho de pre roda ANTES do de supressao)
--   cerca_e_supr     : t   (cerca do QA na tabela nova + supressao ciente da pre)
-- ---------------------------------------------------------------------------
WITH chk AS MATERIALIZED (
  SELECT
    (to_regclass('public.ponto_pre_assinalacao') IS NOT NULL) AS tabela_existe,
    (EXISTS (SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='ponto_diario'
         AND column_name='intervalo_origem')
     AND EXISTS (SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='ponto_diario'
         AND column_name='intervalo_pre_assinalado_minutos')) AS colunas_espelho,
    (to_regprocedure('public.ponto_pre_assinalacao_do_dia(uuid,text,text,date)') IS NOT NULL) AS funcao_resolve,
    (EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_ponto_diario_pre_assinalacao'
       AND tgrelid='public.ponto_diario'::regclass AND NOT tgisinternal)) AS gatilho_pre,
    ('trg_ponto_diario_pre_assinalacao' < 'trg_ponto_diario_supressao_intervalo') AS pre_antes_supr,
    (EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='qa_guarda_cercado'
       AND tgrelid='public.ponto_pre_assinalacao'::regclass AND NOT tgisinternal)
     AND EXISTS (SELECT 1 FROM pg_proc WHERE proname='ponto_diario_supressao_intervalo'
       AND prosrc ILIKE '%pre_assinalado%')) AS cerca_e_supr
)
SELECT tabela_existe, colunas_espelho, funcao_resolve, gatilho_pre, pre_antes_supr, cerca_e_supr,
  CASE WHEN tabela_existe AND colunas_espelho AND funcao_resolve AND gatilho_pre
        AND pre_antes_supr AND cerca_e_supr
       THEN 'OK' ELSE 'CONFERIR' END AS erro_tecnico
FROM chk;
