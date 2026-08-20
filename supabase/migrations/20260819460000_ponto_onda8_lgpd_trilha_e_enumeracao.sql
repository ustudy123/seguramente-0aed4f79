-- ============================================================================
-- ONDA 8 (parte 5) — LGPD: trilha de acesso a dado sensível + contenção de enumeração
-- PONTO-397 / PONTO-362
--
-- (397) A trilha de auditoria só capturava ESCRITA (INSERT/UPDATE/DELETE, por
--       gatilho). Visualizar a selfie ou a geolocalização de uma marcação e
--       exportar relatórios de ponto (AFD/AEJ) não deixavam rastro algum. A LGPD
--       (arts. 11 e 46) pede registro do tratamento de dado sensível — num
--       vazamento, seria impossível saber quem acessou o quê.
-- (362) O link compartilhado de marcação identifica o trabalhador por CPF.
--       Tentativas em sequência com CPFs diferentes no mesmo link (ENUMERAÇÃO,
--       para descobrir CPFs válidos e marcar por terceiros) passavam sem registro
--       nem contenção. A LGPD (arts. 46-49) pede segurança.
--
-- O QUE FAZ (aditivo)
--   (1) ponto_acesso_sensivel_log: log IMUTÁVEL de quem viu selfie/geolocalização
--       e quem exportou. Cercado + RLS.
--   (2) ponto_log_acesso_sensivel(...): registra a visualização de dado sensível
--       (selfie, geolocalização) no ponto de entrega, antes de servir.
--   (3) ponto_log_exportacao(...): registra a exportação (AFD/AEJ/relatório) com
--       escopo e destinatário.
--   (4) ponto_links ganha tentativas_frustradas e bloqueado_ate;
--       ponto_link_registrar_tentativa conta tentativas por link/token, bloqueia
--       temporariamente ao estourar o limite e registra o evento na trilha.
--
-- GARANTIAS: não altera o motor de saldo, o espelho, o fechamento nem as
-- marcações. Só registra acesso e contém enumeração. Aditivo e idempotente.
-- ============================================================================

-- (1) Log imutável de acesso a dado sensível ---------------------------------
CREATE TABLE IF NOT EXISTS public.ponto_acesso_sensivel_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  usuario_id      uuid,
  usuario_nome    text,
  acao            text NOT NULL,   -- visualizou_selfie | visualizou_geolocalizacao | exportou_afd | exportou_aej | exportou_relatorio | enumeracao_cpf_link
  recurso         text,
  recurso_id      uuid,
  colaborador_cpf text,
  escopo          jsonb,
  destinatario    text,
  ip              text,
  descricao       text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ponto_acesso_sensivel_log_ten
  ON public.ponto_acesso_sensivel_log (tenant_id, acao, created_at);

COMMENT ON TABLE public.ponto_acesso_sensivel_log IS
  'Trilha IMUTAVEL de acesso a dado sensivel do ponto (LGPD arts. 11 e 46): quem visualizou selfie/geolocalizacao e quem exportou AFD/AEJ/relatorios, com escopo e destinatario. Append-only.';

ALTER TABLE public.ponto_acesso_sensivel_log ENABLE ROW LEVEL SECURITY;

DO $rls$
BEGIN
  IF to_regprocedure('public.get_user_tenant_id()') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_policies
       WHERE schemaname='public' AND tablename='ponto_acesso_sensivel_log'
         AND policyname='ponto_acesso_sensivel_log_tenant') THEN
    CREATE POLICY ponto_acesso_sensivel_log_tenant
      ON public.ponto_acesso_sensivel_log
      FOR ALL
      USING (tenant_id = public.get_user_tenant_id())
      WITH CHECK (tenant_id = public.get_user_tenant_id());
  END IF;
END $rls$;

-- Append-only: bloqueia UPDATE e DELETE (log imutavel).
CREATE OR REPLACE FUNCTION public.ponto_acesso_log_imutavel()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Trilha de acesso a dado sensivel e imutavel: % nao permitido.', TG_OP
    USING ERRCODE = 'raise_exception';
END;
$$;

DO $imut$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_ponto_acesso_log_imutavel'
                 AND tgrelid='public.ponto_acesso_sensivel_log'::regclass AND NOT tgisinternal) THEN
    CREATE TRIGGER trg_ponto_acesso_log_imutavel
      BEFORE UPDATE OR DELETE ON public.ponto_acesso_sensivel_log
      FOR EACH ROW EXECUTE FUNCTION public.ponto_acesso_log_imutavel();
  END IF;
END $imut$;

-- Trava do cercado do QA (isolamento de tenant) — PONTO-270.
DO $cerca$
BEGIN
  IF to_regprocedure('public.qa_bloqueia_fora_do_cercado()') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='qa_guarda_cercado'
       AND tgrelid='public.ponto_acesso_sensivel_log'::regclass AND NOT tgisinternal) THEN
    CREATE TRIGGER qa_guarda_cercado
      BEFORE INSERT OR UPDATE OR DELETE ON public.ponto_acesso_sensivel_log
      FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_fora_do_cercado();
  END IF;
END $cerca$;

INSERT INTO public.qa_tabelas_protegidas (tabela, motivo)
SELECT 'ponto_acesso_sensivel_log', 'Cerca generica: tabela tem tenant_id'
WHERE to_regclass('public.qa_tabelas_protegidas') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.qa_tabelas_protegidas x
                  WHERE x.tabela = 'ponto_acesso_sensivel_log');

-- (2) Registro da VISUALIZAÇÃO de dado sensível ------------------------------
CREATE OR REPLACE FUNCTION public.ponto_log_acesso_sensivel(
  p_tenant_id       uuid,
  p_acao            text,
  p_recurso         text    DEFAULT NULL,
  p_recurso_id      uuid    DEFAULT NULL,
  p_colaborador_cpf text    DEFAULT NULL,
  p_descricao       text    DEFAULT NULL,
  p_ip              text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid  uuid;
  v_nome text;
  v_id   uuid;
BEGIN
  -- Log de acesso a dado sensivel (selfie, geolocalizacao) do ponto: registra
  -- QUEM visualizou, antes de servir o dado. LGPD arts. 11 e 46.
  BEGIN v_uid := auth.uid(); EXCEPTION WHEN OTHERS THEN v_uid := NULL; END;
  BEGIN
    SELECT nome INTO v_nome FROM public.usuarios_base WHERE auth_user_id = v_uid LIMIT 1;
  EXCEPTION WHEN OTHERS THEN v_nome := NULL; END;

  INSERT INTO public.ponto_acesso_sensivel_log
    (tenant_id, usuario_id, usuario_nome, acao, recurso, recurso_id, colaborador_cpf, descricao, ip)
  VALUES
    (p_tenant_id, v_uid, v_nome, p_acao, p_recurso, p_recurso_id, p_colaborador_cpf, p_descricao, p_ip)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.ponto_log_acesso_sensivel(uuid, text, text, uuid, text, text, text) IS
  'Registra na trilha imutavel a visualizacao de dado sensivel do ponto (selfie, geolocalizacao): quem viu o que, antes de servir. LGPD arts. 11 e 46. PONTO-397.';

-- (3) Registro da EXPORTAÇÃO -------------------------------------------------
CREATE OR REPLACE FUNCTION public.ponto_log_exportacao(
  p_tenant_id    uuid,
  p_acao         text,               -- exportou_afd | exportou_aej | exportou_relatorio
  p_escopo       jsonb   DEFAULT NULL,
  p_destinatario text    DEFAULT NULL,
  p_descricao    text    DEFAULT NULL,
  p_ip           text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid  uuid;
  v_nome text;
  v_id   uuid;
BEGIN
  -- Log da exportacao de dados de ponto (AFD, AEJ, relatorios): quem exportou,
  -- com qual escopo e para qual destinatario. LGPD arts. 11 e 46.
  BEGIN v_uid := auth.uid(); EXCEPTION WHEN OTHERS THEN v_uid := NULL; END;
  BEGIN
    SELECT nome INTO v_nome FROM public.usuarios_base WHERE auth_user_id = v_uid LIMIT 1;
  EXCEPTION WHEN OTHERS THEN v_nome := NULL; END;

  INSERT INTO public.ponto_acesso_sensivel_log
    (tenant_id, usuario_id, usuario_nome, acao, escopo, destinatario, descricao, ip)
  VALUES
    (p_tenant_id, v_uid, v_nome, p_acao, p_escopo, p_destinatario, p_descricao, p_ip)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.ponto_log_exportacao(uuid, text, jsonb, text, text, text) IS
  'Registra na trilha imutavel a exportacao de dados de ponto (AFD/AEJ/relatorios) com escopo e destinatario. LGPD arts. 11 e 46. PONTO-397.';

-- (4) Contenção de enumeração de CPF no link compartilhado -------------------
ALTER TABLE public.ponto_links ADD COLUMN IF NOT EXISTS tentativas_frustradas integer NOT NULL DEFAULT 0;
ALTER TABLE public.ponto_links ADD COLUMN IF NOT EXISTS bloqueado_ate         timestamptz;

COMMENT ON COLUMN public.ponto_links.tentativas_frustradas IS
  'Tentativas frustradas seguidas no link (CPF que nao confere): base da contencao de enumeracao. PONTO-362.';
COMMENT ON COLUMN public.ponto_links.bloqueado_ate IS
  'Ate quando o link esta bloqueado por enumeracao (bloqueio temporario). PONTO-362.';

CREATE OR REPLACE FUNCTION public.ponto_link_registrar_tentativa(
  p_token       text,
  p_cpf_tentado text,
  p_sucesso     boolean,
  p_ip          text    DEFAULT NULL,
  p_limite      integer DEFAULT 5,
  p_bloqueio_min integer DEFAULT 15
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_link  RECORD;
  v_tent  int;
  v_bloq  timestamptz;
BEGIN
  SELECT * INTO v_link FROM public.ponto_links WHERE token = p_token LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('erro', 'link_inexistente');
  END IF;

  IF p_sucesso THEN
    -- Sucesso zera o contador e libera o link.
    UPDATE public.ponto_links
       SET tentativas_frustradas = 0, bloqueado_ate = NULL
     WHERE id = v_link.id;
    RETURN jsonb_build_object('bloqueado', false, 'tentativas', 0);
  END IF;

  -- Falha: incrementa o contador de tentativas frustradas no link/token.
  v_tent := COALESCE(v_link.tentativas_frustradas, 0) + 1;
  v_bloq := v_link.bloqueado_ate;

  IF v_tent >= p_limite THEN
    -- Estourou o limite: bloqueio temporario do link + evento na trilha.
    v_bloq := now() + make_interval(mins => p_bloqueio_min);
    BEGIN
      PERFORM public.ponto_log_acesso_sensivel(
        v_link.tenant_id, 'enumeracao_cpf_link', 'ponto_links', v_link.id, p_cpf_tentado,
        format('Enumeracao de CPF contida no link/token: %s tentativas frustradas; bloqueado ate %s.',
               v_tent, to_char(v_bloq, 'DD/MM/YYYY HH24:MI')), p_ip);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  UPDATE public.ponto_links
     SET tentativas_frustradas = v_tent, bloqueado_ate = v_bloq
   WHERE id = v_link.id;

  RETURN jsonb_build_object(
    'bloqueado', (v_bloq IS NOT NULL AND v_bloq > now()),
    'tentativas', v_tent,
    'bloqueado_ate', v_bloq);
END;
$$;

COMMENT ON FUNCTION public.ponto_link_registrar_tentativa(text, text, boolean, text, integer, integer) IS
  'Conta tentativas frustradas por link/token (CPF que nao confere), bloqueia o link temporariamente ao estourar o limite e registra o evento de enumeracao na trilha. Sucesso zera o contador. LGPD arts. 46-49. PONTO-362.';
