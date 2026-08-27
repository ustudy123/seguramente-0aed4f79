-- ============================================================================
-- ENTREGA — link de marcacao com prazo OBRIGATORIO (PONTO-251)
--
-- ACHADO DA BANCADA (bateria do Ponto na homologacao, 27/08/2026):
--     "De 248 link(s): data_expiracao aceita NULO no schema"
--
-- O link de marcacao e uma credencial distribuida por mensagem: o colaborador
-- recebe a URL e bate ponto por ela. Sem prazo obrigatorio no schema, nada
-- impede que um link nasca sem validade — e ai ele vira acesso PERMANENTE ao
-- ponto daquela pessoa, inclusive depois do desligamento. A protecao nao pode
-- depender de a consulta lembrar de filtrar por data: tem que estar na
-- estrutura.
--
-- Na producao a coluna existe e os 248 links atuais estao todos preenchidos —
-- a auditoria nao encontrou nenhum ativo sem prazo, nenhum vencido ainda
-- ativo, nenhum token curto e nenhuma colisao de token. Falta so a trava.
--
-- O QUE FAZ
--   1. Preenche qualquer link sem prazo (defensivo: hoje sao zero) com o
--      padrao da casa, 180 dias.
--   2. Torna data_expiracao obrigatoria no schema (DEFAULT + NOT NULL).
--   3. Traz as tres rotinas de manutencao que so existiam no ambiente de
--      teste: desativar vencidos, revogar links de desligados e renovar.
--      Sem elas o vencimento e so um campo — ninguem age sobre ele.
--
-- NAO altera o motor de saldo, o espelho nem o fechamento. NAO revoga nem
-- desativa nenhum link existente: apenas fecha a porta para os proximos e
-- entrega as ferramentas de manutencao. Idempotente; UMA transacao.
-- ============================================================================

SET lock_timeout = '10s';

-- (1) Defensivo: nenhum link deve ficar para tras sem prazo. Um UPDATE so,
--     nao linha a linha — ha statement timeout.
UPDATE public.ponto_links
   SET data_expiracao = now() + interval '180 days'
 WHERE data_expiracao IS NULL;

-- (2) A trava entra na estrutura. Bloco proprio: se algo impedir, vira aviso
--     e a conferencia do fim mostra — em vez de abortar o arquivo inteiro.
DO $trava$
BEGIN
  ALTER TABLE public.ponto_links
    ALTER COLUMN data_expiracao SET DEFAULT (now() + '180 days'::interval);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'DEFAULT de data_expiracao nao pode ser ajustado: %', SQLERRM;
END $trava$;

DO $notnull$
BEGIN
  IF EXISTS (SELECT 1 FROM public.ponto_links WHERE data_expiracao IS NULL) THEN
    RAISE NOTICE 'Ainda ha link sem prazo — NOT NULL nao aplicado. Ver a conferencia.';
  ELSE
    ALTER TABLE public.ponto_links ALTER COLUMN data_expiracao SET NOT NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'NOT NULL de data_expiracao nao pode ser aplicado: %', SQLERRM;
END $notnull$;

-- (3) As rotinas de manutencao — estado atual do projeto.
CREATE OR REPLACE FUNCTION public.ponto_link_renovar(p_link_id uuid, p_dias integer DEFAULT 180)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_link public.ponto_links;
  v_nova timestamptz;
BEGIN
  IF p_dias IS NULL OR p_dias < 1 OR p_dias > 365 THEN
    RAISE EXCEPTION 'Prazo inválido: informe entre 1 e 365 dias.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_link FROM public.ponto_links WHERE id = p_link_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF v_link.tenant_id IS DISTINCT FROM public.current_user_tenant_id() THEN
    RAISE EXCEPTION 'Sem permissão para renovar este link.' USING ERRCODE = '42501';
  END IF;

  v_nova := now() + make_interval(days => p_dias);

  UPDATE public.ponto_links
  SET data_expiracao = v_nova,
      ativo = true,
      updated_at = now()
  WHERE id = p_link_id;

  RETURN v_nova;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ponto_links_desativar_vencidos()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_n int;
BEGIN
  UPDATE public.ponto_links
     SET ativo = false, updated_at = now()
   WHERE ativo = true
     AND data_expiracao <= now();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ponto_links_revogar_desligados()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_qtd integer := 0;
BEGIN
  UPDATE public.ponto_links l
  SET ativo = false, updated_at = now()
  WHERE l.tipo <> 'compartilhado'
    AND l.ativo = true
    AND length(regexp_replace(COALESCE(l.colaborador_cpf, ''), '\D', '', 'g')) = 11
    AND NOT EXISTS (
      SELECT 1 FROM public.admissoes a
      WHERE a.tenant_id = l.tenant_id
        AND regexp_replace(COALESCE(a.cpf, ''), '\D', '', 'g') = regexp_replace(COALESCE(l.colaborador_cpf, ''), '\D', '', 'g')
        AND a.status = 'concluido'
        AND COALESCE(a.inativo, false) = false
        AND COALESCE(a.bate_ponto, true) = true
    );
  GET DIAGNOSTICS v_qtd = ROW_COUNT;
  RETURN v_qtd;
END;
$function$
;


-- (4) O gatilho que ja preenche o prazo na gravacao — cinto alem da
--     suspensoria: mesmo um INSERT que esqueca a data nasce com prazo.
--     Tambem so existia em migration.
CREATE OR REPLACE FUNCTION public.ponto_links_validade_before()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.data_expiracao IS NULL THEN
      NEW.data_expiracao := now() + interval '180 days';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.token IS DISTINCT FROM OLD.token THEN
      NEW.data_expiracao := now() + interval '180 days';
    END IF;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$function$
;

DROP TRIGGER IF EXISTS trg_ponto_links_validade ON public.ponto_links;
CREATE TRIGGER trg_ponto_links_validade
  BEFORE INSERT OR UPDATE ON public.ponto_links
  FOR EACH ROW EXECUTE FUNCTION public.ponto_links_validade_before();

COMMENT ON COLUMN public.ponto_links.data_expiracao IS
  'Prazo do link de marcacao. Obrigatorio: link e credencial distribuida por mensagem e sem prazo vira acesso permanente ao ponto do colaborador. Padrao 180 dias. PONTO-251.';

-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: t | t | 0 | 0 | t | t | OK
--   prazo_obrigatorio : data_expiracao e NOT NULL no schema
--   tem_padrao        : a coluna tem DEFAULT (link novo ja nasce com prazo)
--   ativos_sem_prazo  : 0
--   vencidos_ativos   : quantos ativos ja passaram do prazo (informativo —
--                       nao reprova; e a fila de trabalho da rotina nova)
--   manutencao        : as 3 rotinas existem
--   gatilho           : trg_ponto_links_validade instalado
-- ---------------------------------------------------------------------------
WITH x AS MATERIALIZED (
  SELECT
    (SELECT a.attnotnull FROM pg_attribute a
      WHERE a.attrelid = 'public.ponto_links'::regclass
        AND a.attname = 'data_expiracao') AS prazo_obrigatorio,
    EXISTS (SELECT 1 FROM pg_attrdef d
             JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
            WHERE d.adrelid = 'public.ponto_links'::regclass
              AND a.attname = 'data_expiracao') AS tem_padrao,
    (SELECT count(*) FROM public.ponto_links
      WHERE ativo IS TRUE AND data_expiracao IS NULL) AS ativos_sem_prazo,
    (SELECT count(*) FROM public.ponto_links
      WHERE ativo IS TRUE AND data_expiracao IS NOT NULL
        AND data_expiracao < now()) AS vencidos_ativos,
    (SELECT count(DISTINCT p.proname) = 3 FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN ('ponto_links_desativar_vencidos',
                          'ponto_links_revogar_desligados',
                          'ponto_link_renovar')) AS manutencao,
    EXISTS (SELECT 1 FROM pg_trigger
             WHERE tgname = 'trg_ponto_links_validade'
               AND tgrelid = 'public.ponto_links'::regclass AND NOT tgisinternal) AS gatilho
)
SELECT prazo_obrigatorio, tem_padrao, ativos_sem_prazo, vencidos_ativos, manutencao, gatilho,
       CASE WHEN prazo_obrigatorio AND tem_padrao AND ativos_sem_prazo = 0 AND manutencao AND gatilho
            THEN 'OK' ELSE 'CONFERIR' END AS erro_tecnico
FROM x;
