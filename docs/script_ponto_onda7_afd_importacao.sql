-- ============================================================================
-- ENTREGA — ONDA 7 (parte 3): importacao de AFD que CONFERE (Portaria 671)
-- Alvos: ponto_repc_importacoes (+colunas/constraint), ponto_marcacoes
--        (+nsr_origem/equipamento), ponto_afd_eventos_equipamento (nova),
--        ponto_afd_crc16 e ponto_afd_validar_importacao (novas)
-- PONTO-382 / PONTO-383 / PONTO-384 / PONTO-212
--
-- A importacao de AFD (Arquivo Fonte de Dados de REP de terceiro) so validava,
-- quando validava, na TELA. Importacao por API entrava sem conferencia: arquivo
-- corrompido, sequencia de NSR quebrada, reimportacao apos falha no meio, ou os
-- registros nao-marcacao (ajuste de relogio, evento sensivel) descartados.
--
-- Passa a existir a conferencia NO BANCO: CRC-16 por registro, cadeia SHA-256 do
-- trailer, verdito de assinatura e LACUNA de NSR (recusa o arquivo por inteiro),
-- com QUARENTENA do reprovado; a chave natural do registro de origem na marcacao
-- (nsr_origem + equipamento) para reimportacao idempotente; e a casa dos
-- registros nao-marcacao (tipo 4/6) na trilha do equipamento.
--
-- GARANTIAS: nao altera o motor de saldo, o espelho, o fechamento nem grava
-- marcacao. Aditivo e idempotente. Roda inteiro em UMA transacao.
-- ============================================================================

SET lock_timeout = '10s';
-- (383/382) Identidade e verdito do arquivo em ponto_repc_importacoes ---------
ALTER TABLE public.ponto_repc_importacoes ADD COLUMN IF NOT EXISTS arquivo_hash      text;
ALTER TABLE public.ponto_repc_importacoes ADD COLUMN IF NOT EXISTS crc_valido        boolean;
ALTER TABLE public.ponto_repc_importacoes ADD COLUMN IF NOT EXISTS assinatura_valida boolean;
ALTER TABLE public.ponto_repc_importacoes ADD COLUMN IF NOT EXISTS cadeia_valida     boolean;
ALTER TABLE public.ponto_repc_importacoes ADD COLUMN IF NOT EXISTS quarentena        boolean NOT NULL DEFAULT false;
ALTER TABLE public.ponto_repc_importacoes ADD COLUMN IF NOT EXISTS relatorio         jsonb;

-- Unicidade do arquivo (hash) por tenant — a mesma remessa não entra duas vezes.
-- NULLs são distintos: linhas antigas (hash nulo) não conflitam.
DO $uk$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid='public.ponto_repc_importacoes'::regclass
                   AND conname='ponto_repc_importacoes_arquivo_uk') THEN
    ALTER TABLE public.ponto_repc_importacoes
      ADD CONSTRAINT ponto_repc_importacoes_arquivo_uk UNIQUE (tenant_id, arquivo_hash);
  END IF;
END $uk$;

-- (383) Chave natural do registro de origem na marcação: o NSR que veio NO AFD
-- e o equipamento que o emitiu. Distinto do nsr próprio (gerado na gravação).
ALTER TABLE public.ponto_marcacoes ADD COLUMN IF NOT EXISTS nsr_origem  bigint;
ALTER TABLE public.ponto_marcacoes ADD COLUMN IF NOT EXISTS equipamento text;

-- Reimportação idempotente pela chave natural (quando ambos presentes).
CREATE UNIQUE INDEX IF NOT EXISTS ponto_marcacoes_origem_afd_uk
  ON public.ponto_marcacoes (tenant_id, equipamento, nsr_origem)
  WHERE equipamento IS NOT NULL AND nsr_origem IS NOT NULL;

-- (384) Casa dos registros não-marcação do AFD (tipo 4 e tipo 6) --------------
CREATE TABLE IF NOT EXISTS public.ponto_afd_eventos_equipamento (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL,
  empresa_id            uuid,
  importacao_id         uuid,
  equipamento           text,
  nsr_origem            bigint,
  tipo_registro         text,          -- '4' (ajuste do relogio) | '6' (evento sensivel)
  data_hora             timestamptz,
  ajuste_relogio_de     timestamptz,   -- tipo 4: relogio ANTES do ajuste
  ajuste_relogio_para   timestamptz,   -- tipo 4: relogio DEPOIS do ajuste
  evento_sensivel_tipo  text,          -- tipo 6: natureza do evento
  evento_sensivel_descricao text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ponto_afd_eventos_equip
  ON public.ponto_afd_eventos_equipamento (tenant_id, equipamento, data_hora);

COMMENT ON TABLE public.ponto_afd_eventos_equipamento IS
  'Registros nao-marcacao do AFD importado: ajuste do relogio do equipamento (tipo 4) e eventos sensiveis (tipo 6), visiveis na trilha de auditoria. Um relogio ajustado perto de uma marcacao suspeita e o que a fiscalizacao procura. PONTO-384.';

ALTER TABLE public.ponto_afd_eventos_equipamento ENABLE ROW LEVEL SECURITY;

DO $rls$
BEGIN
  IF to_regprocedure('public.get_user_tenant_id()') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_policies
       WHERE schemaname='public' AND tablename='ponto_afd_eventos_equipamento'
         AND policyname='ponto_afd_eventos_equipamento_tenant') THEN
    CREATE POLICY ponto_afd_eventos_equipamento_tenant
      ON public.ponto_afd_eventos_equipamento
      FOR ALL
      USING (tenant_id = public.get_user_tenant_id())
      WITH CHECK (tenant_id = public.get_user_tenant_id());
  END IF;
END $rls$;

DO $cerca$
BEGIN
  IF to_regprocedure('public.qa_bloqueia_fora_do_cercado()') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_trigger
       WHERE tgname = 'qa_guarda_cercado'
         AND tgrelid = 'public.ponto_afd_eventos_equipamento'::regclass
         AND NOT tgisinternal) THEN
    CREATE TRIGGER qa_guarda_cercado
      BEFORE INSERT OR UPDATE OR DELETE ON public.ponto_afd_eventos_equipamento
      FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_fora_do_cercado();
  END IF;
END $cerca$;

INSERT INTO public.qa_tabelas_protegidas (tabela, motivo)
SELECT 'ponto_afd_eventos_equipamento', 'Cerca generica: tabela tem tenant_id'
WHERE to_regclass('public.qa_tabelas_protegidas') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.qa_tabelas_protegidas x
                  WHERE x.tabela = 'ponto_afd_eventos_equipamento');

-- (382) CRC-16/CCITT-FALSE de um registro -------------------------------------
CREATE OR REPLACE FUNCTION public.ponto_afd_crc16(p_texto text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_bytes bytea := convert_to(COALESCE(p_texto, ''), 'LATIN1');
  v_crc   int := 65535;   -- 0xFFFF (init CCITT-FALSE)
  i int; j int; b int;
BEGIN
  FOR i IN 0 .. octet_length(v_bytes) - 1 LOOP
    b := get_byte(v_bytes, i);
    v_crc := (v_crc # (b << 8)) & 65535;
    FOR j IN 1..8 LOOP
      IF (v_crc & 32768) <> 0 THEN            -- 0x8000
        v_crc := ((v_crc << 1) # 4129) & 65535;  -- poly 0x1021
      ELSE
        v_crc := (v_crc << 1) & 65535;
      END IF;
    END LOOP;
  END LOOP;
  RETURN v_crc;
END;
$$;

COMMENT ON FUNCTION public.ponto_afd_crc16(text) IS
  'CRC-16/CCITT-FALSE (init 0xFFFF, poly 0x1021) de um registro do AFD, para conferir a integridade byte a byte na importacao. PONTO-382.';

-- (382/212) Conferência da importação: CRC, cadeia, LACUNA de NSR e quarentena -
CREATE OR REPLACE FUNCTION public.ponto_afd_validar_importacao(
  p_tenant_id       uuid,
  p_empresa_id      uuid,
  p_importacao_id   uuid,
  p_arquivo_hash    text,
  p_registros       jsonb,
  p_assinatura_valida boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec       jsonb;
  v_tipo    text;
  v_linha   text;
  v_crc_dec int;
  v_crc_ok  boolean := true;
  v_cadeia_ok boolean := true;
  v_lacuna  boolean := false;
  v_dupe    boolean := false;
  v_nsrs    bigint[] := ARRAY[]::bigint[];
  v_nsr     bigint;
  v_min bigint; v_max bigint; v_cnt int; v_distintos int;
  v_erros   jsonb := '[]'::jsonb;
  v_quarentena boolean;
  v_rejeitados int := 0;
  v_sha_calc text; v_sha_dec text;
  v_status  text;
  v_ja      int;
BEGIN
  -- Reimportação: se ESTE mesmo arquivo (hash) já entrou validado por outra
  -- importação do tenant, recusa como duplicado (nao reprocessa).
  SELECT count(*) INTO v_ja FROM public.ponto_repc_importacoes
  WHERE tenant_id = p_tenant_id AND arquivo_hash = p_arquivo_hash
    AND id <> p_importacao_id AND COALESCE(quarentena,false) = false
    AND COALESCE(status,'') = 'concluido';
  IF v_ja > 0 THEN
    v_dupe := true;
    v_erros := v_erros || jsonb_build_object('erro','arquivo_duplicado',
      'detalhe','Arquivo com o mesmo hash ja foi importado neste tenant.');
  END IF;

  -- Varre os registros: CRC por linha, coleta NSR de marcacao, cadeia do trailer.
  FOR rec IN SELECT * FROM jsonb_array_elements(COALESCE(p_registros, '[]'::jsonb))
  LOOP
    v_tipo := rec->>'tipo';
    v_linha := rec->>'linha';

    -- CRC-16 por registro (quando o arquivo declara o CRC da linha).
    IF (rec ? 'crc') AND v_linha IS NOT NULL THEN
      v_crc_dec := NULLIF(rec->>'crc','')::int;
      IF v_crc_dec IS DISTINCT FROM public.ponto_afd_crc16(v_linha) THEN
        v_crc_ok := false; v_rejeitados := v_rejeitados + 1;
        v_erros := v_erros || jsonb_build_object('erro','crc_invalido',
          'tipo', v_tipo, 'nsr', rec->>'nsr');
      END IF;
    END IF;

    IF v_tipo = '3' THEN                    -- marcacao: entra na sequencia de NSR
      v_nsr := NULLIF(rec->>'nsr','')::bigint;
      IF v_nsr IS NOT NULL THEN v_nsrs := array_append(v_nsrs, v_nsr); END IF;
    ELSIF v_tipo = '7' THEN                 -- trailer: cadeia SHA-256 do conteudo
      IF (rec ? 'sha256') AND (rec ? 'conteudo') THEN
        v_sha_calc := encode(public.digest(rec->>'conteudo', 'sha256'), 'hex');
        v_sha_dec  := lower(rec->>'sha256');
        IF v_sha_dec IS DISTINCT FROM v_sha_calc THEN
          v_cadeia_ok := false;
          v_erros := v_erros || jsonb_build_object('erro','cadeia_sha256_invalida');
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- LACUNA de NSR: a sequencia dos registros de marcacao tem que ser inteira,
  -- sem buraco e sem repeticao. Buraco = registro removido -> recusa o arquivo
  -- POR INTEIRO (Portaria 671). A sequencia de NSR e sequencial por definicao.
  v_cnt := COALESCE(array_length(v_nsrs, 1), 0);
  IF v_cnt > 0 THEN
    SELECT min(x), max(x), count(*), count(DISTINCT x)
      INTO v_min, v_max, v_cnt, v_distintos
    FROM unnest(v_nsrs) AS x;
    IF v_distintos <> v_cnt OR (v_max - v_min + 1) <> v_cnt THEN
      v_lacuna := true;
      v_erros := v_erros || jsonb_build_object('erro','lacuna_nsr',
        'detalhe', format('Sequencia de NSR quebrada: %s registros entre %s e %s (esperado %s).',
                          v_cnt, v_min, v_max, (v_max - v_min + 1)));
    END IF;
  END IF;

  -- Verdito: qualquer prova que falha manda o arquivo INTEIRO para a quarentena.
  -- O status segue o dominio existente (concluido/erro); o flag quarentena marca
  -- que o 'erro' e reprovacao de integridade probatoria (nao falha operacional).
  v_quarentena := v_dupe OR v_lacuna OR NOT v_crc_ok OR NOT v_cadeia_ok
               OR NOT COALESCE(p_assinatura_valida, true);
  v_status := CASE WHEN v_quarentena THEN 'erro' ELSE 'concluido' END;

  UPDATE public.ponto_repc_importacoes SET
    arquivo_hash      = p_arquivo_hash,
    crc_valido        = v_crc_ok,
    cadeia_valida     = v_cadeia_ok,
    assinatura_valida = COALESCE(p_assinatura_valida, true),
    quarentena        = v_quarentena,
    status            = v_status,
    registros_rejeitados = v_rejeitados,
    erros             = v_erros,
    relatorio         = jsonb_build_object(
                          'crc_valido', v_crc_ok, 'cadeia_valida', v_cadeia_ok,
                          'assinatura_valida', COALESCE(p_assinatura_valida, true),
                          'lacuna_nsr', v_lacuna, 'duplicado', v_dupe,
                          'quarentena', v_quarentena, 'erros', v_erros),
    updated_at        = now()
  WHERE id = p_importacao_id AND tenant_id = p_tenant_id;

  -- Arquivo aprovado: guarda os registros nao-marcacao (tipo 4/6) na trilha do
  -- equipamento. Arquivo em quarentena NAO deixa nada entrar.
  IF NOT v_quarentena THEN
    FOR rec IN SELECT * FROM jsonb_array_elements(COALESCE(p_registros, '[]'::jsonb))
    LOOP
      v_tipo := rec->>'tipo';
      IF v_tipo IN ('4', '6') THEN
        INSERT INTO public.ponto_afd_eventos_equipamento (
          tenant_id, empresa_id, importacao_id, equipamento, nsr_origem,
          tipo_registro, data_hora, ajuste_relogio_de, ajuste_relogio_para,
          evento_sensivel_tipo, evento_sensivel_descricao
        ) VALUES (
          p_tenant_id, p_empresa_id, p_importacao_id, rec->>'equipamento',
          NULLIF(rec->>'nsr','')::bigint, v_tipo,
          NULLIF(rec->>'data_hora','')::timestamptz,
          NULLIF(rec->>'ajuste_de','')::timestamptz,
          NULLIF(rec->>'ajuste_para','')::timestamptz,
          rec->>'evento', rec->>'evento_desc'
        );
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'status', v_status, 'quarentena', v_quarentena,
    'crc_valido', v_crc_ok, 'cadeia_valida', v_cadeia_ok,
    'lacuna_nsr', v_lacuna, 'duplicado', v_dupe,
    'registros_rejeitados', v_rejeitados, 'erros', v_erros);
END;
$$;

COMMENT ON FUNCTION public.ponto_afd_validar_importacao(uuid, uuid, uuid, text, jsonb, boolean) IS
  'Confere a integridade de um AFD importado NO BANCO: CRC-16 por registro, cadeia SHA-256 do trailer, verdito de assinatura e LACUNA na sequencia de NSR (recusa o arquivo por inteiro). Poe o arquivo reprovado em quarentena e so guarda os eventos do equipamento (tipo 4/6) quando aprovado. Idempotente pelo hash do arquivo. PONTO-382/212/384.';

-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: t | t | t | t | t | OK
--   marcacao_origem : t (ponto_marcacoes.nsr_origem/equipamento)
--   arquivo_unico   : t (constraint de unicidade do arquivo)
--   eventos_equip   : t (tabela dos registros nao-marcacao tipo 4/6)
--   validador       : t (ponto_afd_validar_importacao)
--   crc16           : t (ponto_afd_crc16 confere: 123456789 -> 10673)
-- ---------------------------------------------------------------------------
SELECT
  (public.qa_col_existe('ponto_marcacoes','%nsr_origem%') IS NOT NULL
     AND public.qa_col_existe('ponto_marcacoes','%equipamento%') IS NOT NULL)      AS marcacao_origem,
  EXISTS (SELECT 1 FROM pg_constraint
          WHERE conrelid='public.ponto_repc_importacoes'::regclass AND contype='u') AS arquivo_unico,
  (to_regclass('public.ponto_afd_eventos_equipamento') IS NOT NULL)                AS eventos_equip,
  (to_regprocedure('public.ponto_afd_validar_importacao(uuid,uuid,uuid,text,jsonb,boolean)') IS NOT NULL) AS validador,
  (public.ponto_afd_crc16('123456789') = 10673)                                    AS crc16,
  CASE WHEN public.qa_col_existe('ponto_marcacoes','%nsr_origem%') IS NOT NULL
        AND public.qa_col_existe('ponto_marcacoes','%equipamento%') IS NOT NULL
        AND EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid='public.ponto_repc_importacoes'::regclass AND contype='u')
        AND to_regclass('public.ponto_afd_eventos_equipamento') IS NOT NULL
        AND to_regprocedure('public.ponto_afd_validar_importacao(uuid,uuid,uuid,text,jsonb,boolean)') IS NOT NULL
        AND public.ponto_afd_crc16('123456789') = 10673
       THEN 'OK' ELSE 'CONFERIR' END AS erro_tecnico;
