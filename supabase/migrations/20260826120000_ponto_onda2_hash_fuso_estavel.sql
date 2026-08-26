-- ============================================================================
-- PONTO Onda 2 (correção) — o hash da marcação deixa de depender do fuso
-- Achado no ensaio da homologação. Complementa 20260819160000 (cadeia de hash).
--
-- O PROBLEMA
--   `ponto_marcacoes.created_at` é `timestamptz`, e `created_at::text` é
--   renderizado no FUSO DA SESSÃO: o mesmo instante vira
--   '2026-08-01 12:00:00+00' sob UTC e '2026-08-01 09:00:00-03' sob
--   America/Sao_Paulo — dois textos diferentes, logo dois sha256 diferentes.
--   Como esse texto entra na composição do hash, tanto a GRAVAÇÃO quanto a
--   VERIFICAÇÃO herdavam essa dependência. Hoje tudo roda em UTC e por isso
--   funciona; bastaria o fuso do banco mudar para que TODAS as marcações
--   passassem a "não conferir" — e `ponto_cadeia_hash_monitorar` dispararia
--   alerta crítico de adulteração para todo tenant, todo dia. Alarme falso
--   justamente na ferramenta que existe para detectar adulteração real.
--
-- A CORREÇÃO
--   Fixa o rendering do instante em UTC: `(created_at AT TIME ZONE 'UTC')::text
--   || '+00'`. Sob TimeZone=UTC essa forma é BYTE-IDÊNTICA a `created_at::text`
--   (verificado inclusive com frações de segundo e zeros à direita), e sob
--   qualquer outro fuso continua produzindo o mesmo texto.
--
-- RETROCOMPATÍVEL — este é o ponto central: como os hashes já gravados foram
--   compostos sob UTC, a forma fixada os reproduz exatamente. Nenhum hash
--   existente é invalidado e NADA é reprocessado; a verificação apenas deixa
--   de depender de quem a executa.
--
-- Idempotente: CREATE OR REPLACE das duas funções.
-- ============================================================================

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

  -- Instante fixado em UTC: mesmo texto qualquer que seja o fuso da sessao.
  NEW.hash_marcacao := encode(
    sha256(
      (NEW.colaborador_cpf || NEW.data_marcacao::text || NEW.hora_marcacao::text
       || NEW.tipo_marcacao || ((NEW.created_at AT TIME ZONE 'UTC')::text || '+00')
       || COALESCE(NEW.hash_anterior, ''))::bytea
    ),
    'hex'
  );
  RETURN NEW;
END;
$function$;

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
  -- Verificacao da cadeia: recomputa cada hash_marcacao (com o instante fixado
  -- em UTC, para nao depender do fuso de quem executa) e confere o
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
  ),
  calc AS (
    SELECT c.*,
           encode(sha256((c.colaborador_cpf || c.data_marcacao::text || c.hora_marcacao::text
                  || c.tipo_marcacao || ((c.created_at AT TIME ZONE 'UTC')::text || '+00')
                  || COALESCE(c.hash_anterior,''))::bytea),'hex') AS hash_recomputado
    FROM marcs c
  )
  SELECT tenant_id, empresa_id, nsr, id AS marcacao_id,
         CASE
           WHEN hash_recomputado <> hash_marcacao
             THEN 'hash_adulterado'
           WHEN hash_anterior IS NOT NULL AND prev_hash IS NOT NULL AND hash_anterior <> prev_hash
             THEN 'cadeia_quebrada'
           WHEN prev_nsr IS NOT NULL AND nsr <> prev_nsr + 1
             THEN 'nsr_faltante'
         END AS tipo_quebra,
         CASE
           WHEN hash_recomputado <> hash_marcacao
             THEN 'Hash gravado nao confere com o recomputado do conteudo (marcacao alterada).'
           WHEN hash_anterior IS NOT NULL AND prev_hash IS NOT NULL AND hash_anterior <> prev_hash
             THEN 'Encadeamento rompido: o hash_anterior nao bate com o hash da marcacao anterior.'
           WHEN prev_nsr IS NOT NULL AND nsr <> prev_nsr + 1
             THEN format('Salto de NSR (%s -> %s): pode haver marcacao removida.', prev_nsr, nsr)
         END AS detalhe
  FROM calc
  WHERE hash_recomputado <> hash_marcacao
     OR (hash_anterior IS NOT NULL AND prev_hash IS NOT NULL AND hash_anterior <> prev_hash)
     OR (prev_nsr IS NOT NULL AND nsr <> prev_nsr + 1)
  ORDER BY tenant_id, empresa_id NULLS FIRST, nsr;
$$;

COMMENT ON FUNCTION public.ponto_verificar_cadeia_hash(uuid, uuid) IS
  'Verificacao da cadeia de hash das marcacoes: recomputa cada hash_marcacao (instante fixado em UTC, independente do fuso da sessao) e confere o encadeamento (hash_anterior) e a continuidade da NSR. Devolve as quebras. Somente leitura.';
