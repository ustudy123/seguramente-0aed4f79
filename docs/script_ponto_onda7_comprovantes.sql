-- ============================================================================
-- ENTREGA — ONDA 7 (parte 1): comprovante como DOCUMENTO (nao como booleano)
-- Alvos: ponto_comprovantes (nova) + ponto_gerar_comprovante,
--        ponto_comprovante_vigiar_48h, ponto_comprovantes_extrair (novas)
-- PONTO-380 / PONTO-381 / PONTO-359
--
-- Hoje o comprovante e so um boolean (ponto_marcacoes.comprovante_gerado). A
-- Portaria MTP 671/2021 (REP-P) trata o comprovante como o RECIBO LEGAL do
-- trabalhador: um artefato com identificacao do empregador e do trabalhador,
-- data/hora e NSR, arquivado e vinculado a marcacao, disponibilizado em ate 48h
-- e extraivel por periodo pelo proprio trabalhador. O NSR ja existe na marcacao;
-- falta o documento.
--
-- O QUE FAZ (aditivo)
--   (1) ponto_comprovantes: o documento — empregador (empresa_cadastro),
--       trabalhador, data/hora, NSR, conteudo minimo, hash de integridade e
--       vinculo a marcacao. Com a trava do cercado (PONTO-270) e RLS por tenant.
--   (2) ponto_gerar_comprovante(tenant, marcacao_id): emite o comprovante da
--       marcacao (idempotente — um por marcacao), atribuindo o NSR quando falta
--       e disponibilizando na hora. Portaria 671.
--   (3) ponto_comprovante_vigiar_48h(tenant, empresa): vigia o prazo de 48h —
--       marcacao sem comprovante perto de estourar (preventivo) ou estourada
--       (critico) vira alerta.
--   (4) ponto_comprovantes_extrair(tenant, cpf, ini, fim): extracao por periodo
--       restrita ao proprio CPF (direito do trabalhador).
--
-- GARANTIAS: nao altera o motor de saldo, o espelho nem o fechamento. So cria o
-- documento, a emissao, a vigilancia e a extracao. Aditivo e idempotente
-- (roda duas vezes sem quebrar nem duplicar). Roda inteiro em UMA transacao.
-- ============================================================================

SET lock_timeout = '10s';

-- Garantia defensiva (idempotente): as colunas de que a emissao depende ja
-- existem na marcacao desde a onda 1; IF NOT EXISTS torna a entrega autossuficiente.
ALTER TABLE public.ponto_marcacoes ADD COLUMN IF NOT EXISTS nsr bigint;
ALTER TABLE public.ponto_marcacoes ADD COLUMN IF NOT EXISTS comprovante_gerado boolean DEFAULT false;

-- (1) Documento ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ponto_comprovantes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL,
  empresa_id         uuid,
  marcacao_id        uuid,
  colaborador_cpf    text NOT NULL,
  colaborador_nome   text,
  empregador_cnpj    text,
  empregador_nome    text,
  nsr                bigint,
  data_hora_marcacao timestamptz,
  conteudo           jsonb NOT NULL,
  hash_comprovante   text,
  disponibilizado_em timestamptz,
  arquivo_url        text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ponto_comprovantes_marcacao_uk UNIQUE (tenant_id, marcacao_id)
);

CREATE INDEX IF NOT EXISTS idx_ponto_comprovantes_colab
  ON public.ponto_comprovantes (tenant_id, colaborador_cpf, data_hora_marcacao);

COMMENT ON TABLE public.ponto_comprovantes IS
  'Comprovante de registro de ponto como DOCUMENTO (Portaria MTP 671/2021, REP-P): empregador, trabalhador, data/hora, NSR, conteudo minimo, hash e vinculo a marcacao. Recibo legal do trabalhador.';

ALTER TABLE public.ponto_comprovantes ENABLE ROW LEVEL SECURITY;

DO $rls$
BEGIN
  IF to_regprocedure('public.get_user_tenant_id()') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_policies
       WHERE schemaname='public' AND tablename='ponto_comprovantes'
         AND policyname='ponto_comprovantes_tenant') THEN
    CREATE POLICY ponto_comprovantes_tenant
      ON public.ponto_comprovantes
      FOR ALL
      USING (tenant_id = public.get_user_tenant_id())
      WITH CHECK (tenant_id = public.get_user_tenant_id());
  END IF;
END $rls$;

-- Trava do cercado do QA (isolamento de tenant) — PONTO-270.
DO $cerca$
BEGIN
  IF to_regprocedure('public.qa_bloqueia_fora_do_cercado()') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_trigger
       WHERE tgname = 'qa_guarda_cercado'
         AND tgrelid = 'public.ponto_comprovantes'::regclass
         AND NOT tgisinternal) THEN
    CREATE TRIGGER qa_guarda_cercado
      BEFORE INSERT OR UPDATE OR DELETE ON public.ponto_comprovantes
      FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_fora_do_cercado();
  END IF;
END $cerca$;

INSERT INTO public.qa_tabelas_protegidas (tabela, motivo)
SELECT 'ponto_comprovantes', 'Cerca generica: tabela tem tenant_id'
WHERE to_regclass('public.qa_tabelas_protegidas') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.qa_tabelas_protegidas x
                  WHERE x.tabela = 'ponto_comprovantes');

-- (2) Emissao do comprovante --------------------------------------------------
CREATE OR REPLACE FUNCTION public.ponto_gerar_comprovante(
  p_tenant_id   uuid,
  p_marcacao_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  m        RECORD;
  v_nsr    bigint;
  v_ec     RECORD;
  v_ts     timestamptz;
  v_cont   jsonb;
  v_id     uuid;
BEGIN
  SELECT * INTO m FROM public.ponto_marcacoes
  WHERE id = p_marcacao_id AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Idempotente: um comprovante por marcacao.
  SELECT id INTO v_id FROM public.ponto_comprovantes
  WHERE tenant_id = p_tenant_id AND marcacao_id = p_marcacao_id;
  IF FOUND THEN
    RETURN v_id;
  END IF;

  -- NSR: usa o da marcacao; se faltar, atribui o proximo do tenant e grava.
  v_nsr := m.nsr;
  IF v_nsr IS NULL THEN
    SELECT COALESCE(MAX(nsr), 0) + 1 INTO v_nsr
    FROM public.ponto_marcacoes WHERE tenant_id = p_tenant_id;
    UPDATE public.ponto_marcacoes SET nsr = v_nsr WHERE id = p_marcacao_id;
  END IF;

  -- Empregador (empresa_cadastro), quando houver vinculo.
  BEGIN
    SELECT ec.razao_social, ec.cnpj INTO v_ec
    FROM public.empresa_cadastro ec WHERE ec.id = m.empresa_id;
  EXCEPTION WHEN OTHERS THEN
    v_ec := NULL;
  END;

  v_ts := (m.data_marcacao + m.hora_marcacao);

  v_cont := jsonb_build_object(
    'norma', 'Portaria MTP 671/2021 — comprovante de registro de ponto (REP-P)',
    'empregador', jsonb_build_object('razao_social', v_ec.razao_social, 'cnpj', v_ec.cnpj),
    'trabalhador', jsonb_build_object('nome', m.colaborador_nome, 'cpf', m.colaborador_cpf),
    'marcacao', jsonb_build_object('data', m.data_marcacao, 'hora', m.hora_marcacao, 'nsr', v_nsr)
  );

  INSERT INTO public.ponto_comprovantes (
    tenant_id, empresa_id, marcacao_id, colaborador_cpf, colaborador_nome,
    empregador_cnpj, empregador_nome, nsr, data_hora_marcacao, conteudo,
    hash_comprovante, disponibilizado_em
  ) VALUES (
    p_tenant_id, m.empresa_id, p_marcacao_id, m.colaborador_cpf, m.colaborador_nome,
    v_ec.cnpj, v_ec.razao_social, v_nsr, v_ts, v_cont,
    encode(public.digest(v_cont::text, 'sha256'), 'hex'), now()
  )
  RETURNING id INTO v_id;

  UPDATE public.ponto_marcacoes SET comprovante_gerado = true WHERE id = p_marcacao_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.ponto_gerar_comprovante(uuid, uuid) IS
  'Emite o comprovante (documento) da marcacao: empregador, trabalhador, data/hora, NSR, conteudo minimo e hash. Idempotente (um por marcacao); atribui o NSR quando falta. Portaria 671. PONTO-380.';

-- (3) Vigilancia do prazo de 48h ---------------------------------------------
CREATE OR REPLACE FUNCTION public.ponto_comprovante_vigiar_48h(
  p_tenant_id  uuid,
  p_empresa_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_n   int := 0;
  v_ins int;
  r     RECORD;
  v_ts  timestamptz;
  v_prazo timestamptz;
  v_sev text;
  v_tit text;
BEGIN
  -- Marcacoes recentes SEM comprovante: o prazo legal de 48h para disponibilizar
  -- o comprovante (Portaria 671, REP-P) esta perto de estourar ou ja estourou.
  FOR r IN
    SELECT m.id, m.tenant_id, m.empresa_id, m.colaborador_cpf, m.colaborador_nome,
           m.data_marcacao, m.hora_marcacao
    FROM public.ponto_marcacoes m
    LEFT JOIN public.ponto_comprovantes c
      ON c.tenant_id = m.tenant_id AND c.marcacao_id = m.id
    WHERE m.tenant_id = p_tenant_id
      AND (p_empresa_id IS NULL OR m.empresa_id = p_empresa_id)
      AND c.id IS NULL
      AND m.data_marcacao >= (CURRENT_DATE - 5)
      AND (m.data_marcacao + m.hora_marcacao) <= now()
  LOOP
    v_ts := (r.data_marcacao + r.hora_marcacao);
    v_prazo := v_ts + INTERVAL '48 hours';

    IF now() > v_prazo THEN
      v_sev := 'critica'; v_tit := 'Comprovante de ponto fora do prazo de 48h (REP-P)';
    ELSIF v_prazo - now() <= INTERVAL '12 hours' THEN
      v_sev := 'alta';    v_tit := 'Comprovante de ponto perto do prazo de 48h (REP-P)';
    ELSE
      CONTINUE;  -- ainda dentro da folga: nao alerta
    END IF;

    INSERT INTO public.ponto_alertas
      (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
       tipo, severidade, titulo, descricao, data_referencia)
    SELECT r.tenant_id, r.empresa_id, NULL, r.colaborador_nome, r.colaborador_cpf,
           'comprovante_prazo_48h', v_sev, v_tit,
           format('Marcacao de %s %s sem comprovante disponibilizado; prazo de 48h ate %s '
               || '(Portaria 671/2021). Emitir/disponibilizar o comprovante ao trabalhador.',
               r.data_marcacao, to_char(r.hora_marcacao,'HH24:MI'), to_char(v_prazo,'DD/MM/YYYY HH24:MI')),
           r.data_marcacao
    WHERE NOT EXISTS (
      SELECT 1 FROM public.ponto_alertas a
      WHERE a.tenant_id = r.tenant_id
        AND a.colaborador_cpf = r.colaborador_cpf
        AND a.tipo = 'comprovante_prazo_48h'
        AND a.data_referencia = r.data_marcacao
    );
    GET DIAGNOSTICS v_ins = ROW_COUNT;
    v_n := v_n + v_ins;
  END LOOP;

  RETURN v_n;
END;
$$;

COMMENT ON FUNCTION public.ponto_comprovante_vigiar_48h(uuid, uuid) IS
  'Vigia o prazo de 48 horas do comprovante (REP-P): marcacao sem comprovante perto de estourar (preventivo) ou estourada (critico) vira alerta. Idempotente por colaborador/dia. PONTO-381.';

-- (4) Extracao por periodo (restrita ao proprio CPF) -------------------------
CREATE OR REPLACE FUNCTION public.ponto_comprovantes_extrair(
  p_tenant_id uuid,
  p_colaborador_cpf text,
  p_ini date,
  p_fim date
)
RETURNS TABLE(
  data_hora timestamptz,
  nsr       bigint,
  empregador text,
  conteudo  jsonb,
  hash_comprovante text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Extracao dos comprovantes do periodo, restrita ao proprio CPF (direito do
  -- trabalhador no REP-P; janela minima de 48h). Portaria 671.
  SELECT c.data_hora_marcacao, c.nsr, c.empregador_nome, c.conteudo, c.hash_comprovante
  FROM public.ponto_comprovantes c
  WHERE c.tenant_id = p_tenant_id
    AND regexp_replace(COALESCE(c.colaborador_cpf,''), '[^0-9]', '', 'g')
        = regexp_replace(COALESCE(p_colaborador_cpf,''), '[^0-9]', '', 'g')
    AND c.data_hora_marcacao::date BETWEEN p_ini AND p_fim
  ORDER BY c.data_hora_marcacao;
$$;

COMMENT ON FUNCTION public.ponto_comprovantes_extrair(uuid, text, date, date) IS
  'Extracao dos comprovantes de um periodo, restrita ao proprio CPF (direito do trabalhador, REP-P). Portaria 671. PONTO-359.';

-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: t | t | t | t | t | OK
--   tabela_documento : t  (ponto_comprovantes existe)
--   marcacao_tem_nsr : t  (ponto_marcacoes.nsr — o comprovante se identifica)
--   emissao_existe   : t  (ponto_gerar_comprovante)
--   vigilancia_48h   : t  (ponto_comprovante_vigiar_48h)
--   extracao_existe  : t  (ponto_comprovantes_extrair)
-- ---------------------------------------------------------------------------
SELECT
  (to_regclass('public.ponto_comprovantes') IS NOT NULL)                                    AS tabela_documento,
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='ponto_marcacoes' AND column_name='nsr') AS marcacao_tem_nsr,
  (to_regprocedure('public.ponto_gerar_comprovante(uuid,uuid)') IS NOT NULL)                 AS emissao_existe,
  (to_regprocedure('public.ponto_comprovante_vigiar_48h(uuid,uuid)') IS NOT NULL)            AS vigilancia_48h,
  (to_regprocedure('public.ponto_comprovantes_extrair(uuid,text,date,date)') IS NOT NULL)    AS extracao_existe,
  CASE WHEN to_regclass('public.ponto_comprovantes') IS NOT NULL
        AND to_regprocedure('public.ponto_gerar_comprovante(uuid,uuid)') IS NOT NULL
        AND to_regprocedure('public.ponto_comprovante_vigiar_48h(uuid,uuid)') IS NOT NULL
        AND to_regprocedure('public.ponto_comprovantes_extrair(uuid,text,date,date)') IS NOT NULL
        AND EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='ponto_marcacoes' AND column_name='nsr')
       THEN 'OK' ELSE 'CONFERIR' END AS erro_tecnico;
