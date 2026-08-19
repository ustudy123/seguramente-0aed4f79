-- ============================================================================
-- ENTREGA — ONDA 2 (parte 1): cadeia de hash encadeado + verificação
-- Alvos: coluna hash_anterior, gerar_hash_marcacao (trigger), ponto_verificar_cadeia_hash,
--        ponto_cadeia_hash_monitorar
-- PONTO-191
--
-- O QUE FAZ
--   O hash de cada marcação nova passa a incorporar o hash da marcação anterior
--   da mesma sequência (por NSR/estabelecimento) — remover uma linha passa a
--   quebrar a cadeia. Uma rotina de verificação recomputa cada hash (detecta
--   alteração de conteúdo) e confere o encadeamento e a continuidade da NSR
--   (detecta remoção). Uma companheira agendável alerta o RH.
--
-- RETROCOMPATÍVEL: o append é de COALESCE(hash_anterior,''), que é vazio para as
--   marcações antigas — e append de '' não muda o sha256. As marcações já
--   gravadas continuam com o MESMO hash e verificam limpas; nada é reprocessado.
--
-- SEGURO E IDEMPOTENTE: ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE. A geração
--   do hash é defensiva: se a leitura do hash anterior falhar, a marcação é
--   gravada mesmo assim (sem encadear). Sem backfill.
-- ============================================================================

ALTER TABLE public.ponto_marcacoes
  ADD COLUMN IF NOT EXISTS hash_anterior text;

COMMENT ON COLUMN public.ponto_marcacoes.hash_anterior IS
  'Hash da marcacao anterior na mesma sequencia (NSR/estabelecimento). Encadeia a prova: remover uma linha quebra a cadeia. Nulo na primeira da cadeia e nas marcacoes anteriores ao encadeamento.';

-- ---------------------------------------------------------------------------
-- Geração do hash, agora ENCADEADA (BEFORE INSERT; roda depois da atribuição
-- do NSR, cuja trigger vem antes na ordem alfabética).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gerar_hash_marcacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sentinela uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
  -- Encadeia com o hash da marcação anterior (NSR imediatamente menor no mesmo
  -- balde tenant/estabelecimento). Nunca deixa a leitura derrubar o insert.
  IF NEW.nsr IS NOT NULL AND NEW.tenant_id IS NOT NULL THEN
    BEGIN
      SELECT m.hash_marcacao
        INTO NEW.hash_anterior
      FROM public.ponto_marcacoes m
      WHERE m.tenant_id = NEW.tenant_id
        AND COALESCE(m.empresa_id, v_sentinela) = COALESCE(NEW.empresa_id, v_sentinela)
        AND m.nsr = NEW.nsr - 1
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      NEW.hash_anterior := NULL;
    END;
  END IF;

  NEW.hash_marcacao := encode(
    sha256(
      (NEW.colaborador_cpf || NEW.data_marcacao::text || NEW.hora_marcacao::text
       || NEW.tipo_marcacao || NEW.created_at::text
       || COALESCE(NEW.hash_anterior, ''))::bytea
    ),
    'hex'
  );
  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- Verificação da cadeia (somente leitura): devolve as quebras encontradas.
--   · hash_adulterado : o hash gravado não confere com o recomputado do conteúdo
--   · cadeia_quebrada : o hash_anterior não bate com o hash da marcação anterior
--   · nsr_faltante    : há um salto na numeração sequencial (linha removida)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ponto_verificar_cadeia_hash(
  p_tenant_id uuid DEFAULT NULL,
  p_empresa_id uuid DEFAULT NULL
)
RETURNS TABLE(
  tenant_id uuid,
  empresa_id uuid,
  nsr bigint,
  marcacao_id uuid,
  tipo_quebra text,
  detalhe text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Verificacao da cadeia: recomputa cada hash_marcacao e confere o
  -- encadeamento pelo hash_anterior e a continuidade da NSR.
  WITH marcs AS (
    SELECT m.id, m.tenant_id, m.empresa_id, m.nsr,
           m.hash_marcacao, m.hash_anterior,
           m.colaborador_cpf, m.data_marcacao, m.hora_marcacao,
           m.tipo_marcacao, m.created_at,
           lag(m.hash_marcacao) OVER w AS prev_hash,
           lag(m.nsr)           OVER w AS prev_nsr
    FROM public.ponto_marcacoes m
    WHERE m.hash_marcacao IS NOT NULL
      AND m.nsr IS NOT NULL
      AND (p_tenant_id  IS NULL OR m.tenant_id  = p_tenant_id)
      AND (p_empresa_id IS NULL OR m.empresa_id = p_empresa_id)
    WINDOW w AS (
      PARTITION BY m.tenant_id, COALESCE(m.empresa_id, '00000000-0000-0000-0000-000000000000'::uuid)
      ORDER BY m.nsr
    )
  )
  SELECT tenant_id, empresa_id, nsr, id AS marcacao_id,
         CASE
           WHEN encode(sha256((colaborador_cpf || data_marcacao::text || hora_marcacao::text
                    || tipo_marcacao || created_at::text || COALESCE(hash_anterior,''))::bytea),'hex')
                <> hash_marcacao
             THEN 'hash_adulterado'
           WHEN hash_anterior IS NOT NULL AND prev_hash IS NOT NULL AND hash_anterior <> prev_hash
             THEN 'cadeia_quebrada'
           WHEN prev_nsr IS NOT NULL AND nsr <> prev_nsr + 1
             THEN 'nsr_faltante'
         END AS tipo_quebra,
         CASE
           WHEN encode(sha256((colaborador_cpf || data_marcacao::text || hora_marcacao::text
                    || tipo_marcacao || created_at::text || COALESCE(hash_anterior,''))::bytea),'hex')
                <> hash_marcacao
             THEN 'Hash gravado nao confere com o recomputado do conteudo (marcacao alterada).'
           WHEN hash_anterior IS NOT NULL AND prev_hash IS NOT NULL AND hash_anterior <> prev_hash
             THEN 'Encadeamento rompido: o hash_anterior nao bate com o hash da marcacao anterior.'
           WHEN prev_nsr IS NOT NULL AND nsr <> prev_nsr + 1
             THEN format('Salto de NSR (%s -> %s): pode haver marcacao removida.', prev_nsr, nsr)
         END AS detalhe
  FROM marcs
  WHERE encode(sha256((colaborador_cpf || data_marcacao::text || hora_marcacao::text
             || tipo_marcacao || created_at::text || COALESCE(hash_anterior,''))::bytea),'hex')
             <> hash_marcacao
     OR (hash_anterior IS NOT NULL AND prev_hash IS NOT NULL AND hash_anterior <> prev_hash)
     OR (prev_nsr IS NOT NULL AND nsr <> prev_nsr + 1)
  ORDER BY tenant_id, empresa_id NULLS FIRST, nsr;
$$;

COMMENT ON FUNCTION public.ponto_verificar_cadeia_hash(uuid, uuid) IS
  'Verificacao da cadeia de hash das marcacoes: recomputa cada hash_marcacao e confere o encadeamento (hash_anterior) e a continuidade da NSR. Devolve as quebras. Somente leitura.';

-- ---------------------------------------------------------------------------
-- Companheira agendável: roda a verificação e alerta o RH por tenant quando
-- houver quebra. Idempotente por dia (um alerta por tenant/dia).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ponto_cadeia_hash_monitorar()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_hoje date := CURRENT_DATE;
  v_total int := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT q.tenant_id, count(*) AS quebras
    FROM public.ponto_verificar_cadeia_hash() q
    GROUP BY q.tenant_id
  LOOP
    v_total := v_total + r.quebras;
    INSERT INTO public.ponto_alertas
      (tenant_id, tipo, severidade, titulo, descricao, data_referencia)
    SELECT r.tenant_id, 'cadeia_hash_quebrada', 'critica',
           'Cadeia de hash das marcacoes com quebra',
           format('Verificacao encontrou %s quebra(s) na cadeia de hash das marcacoes. '
               || 'Investigar remocao ou alteracao direta de marcacao.', r.quebras),
           v_hoje
    WHERE NOT EXISTS (
      SELECT 1 FROM public.ponto_alertas a
      WHERE a.tenant_id = r.tenant_id
        AND a.tipo = 'cadeia_hash_quebrada'
        AND a.data_referencia = v_hoje
    );
  END LOOP;
  RETURN v_total;
END;
$$;

COMMENT ON FUNCTION public.ponto_cadeia_hash_monitorar() IS
  'Roda ponto_verificar_cadeia_hash e emite alerta ao RH por tenant quando ha quebra na cadeia. Idempotente por dia. Para agendar via pg_cron.';

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA — o SQL Editor mostra apenas o último resultado.
-- Esperado: t | t | t | 0 | OK
--   coluna_criada    : t  (hash_anterior existe)
--   hash_encadeado   : t  (gerar_hash_marcacao incorpora o hash anterior)
--   verificacao_ok   : t  (rotina de verificação existe)
--   quebras_hoje     : 0  (a base atual verifica limpa — sem falso positivo)
-- ---------------------------------------------------------------------------
SELECT
  (EXISTS (SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='ponto_marcacoes' AND column_name='hash_anterior')) AS coluna_criada,
  (position('hash_anterior' in pg_get_functiondef('public.gerar_hash_marcacao()'::regprocedure)) > 0) AS hash_encadeado,
  (to_regprocedure('public.ponto_verificar_cadeia_hash(uuid,uuid)') IS NOT NULL) AS verificacao_ok,
  (SELECT count(*) FROM public.ponto_verificar_cadeia_hash()) AS quebras_hoje,
  CASE
    WHEN (EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_schema='public' AND table_name='ponto_marcacoes' AND column_name='hash_anterior'))
     AND position('hash_anterior' in pg_get_functiondef('public.gerar_hash_marcacao()'::regprocedure)) > 0
     AND to_regprocedure('public.ponto_verificar_cadeia_hash(uuid,uuid)') IS NOT NULL
     AND (SELECT count(*) FROM public.ponto_verificar_cadeia_hash()) = 0
      THEN 'OK'
    ELSE 'CONFERIR: se quebras_hoje > 0, ha marcacao adulterada/removida em producao (investigar); o resto deve ser t'
  END AS erro_tecnico;
