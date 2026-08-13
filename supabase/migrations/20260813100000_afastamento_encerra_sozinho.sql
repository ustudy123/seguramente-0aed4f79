-- =====================================================================
-- Afastamento passa a ter fim
--
-- Relato do RH (13/08): "os últimos atestados que lancei estão abrindo
-- AFASTAMENTO e estou tendo que entrar e excluir esse afastamento para o
-- colaborador poder bater o ponto".
--
-- A investigação encontrou três defeitos que se somam:
--
--  1. NADA no sistema encerra um afastamento. A coluna `status` nasce
--     'ativo' por padrão e não existe, em lugar nenhum do código, uma
--     linha que a mude para 'encerrado'. O registro fica ativo para
--     sempre; apagar virou a única saída do RH.
--
--  2. Afastamento sem data de término bloqueia o ponto para sempre.
--     validar_batida_afastamento compara a data da batida com
--     `data_inicio .. COALESCE(data_fim, '9999-12-31')`. Sem data de fim,
--     a trava não é "sem fim conhecido": é fim no ano 9999.
--
--  3. A data de término some no formulário do atestado. Ela só é
--     calculada quando a unidade é 'dias' E a quantidade é maior que
--     zero. Atestado em horas (comparecimento) ou com zero dias produz
--     afastamento eterno. Confirmado na produção: dos 9 afastamentos
--     abertos, 3 estavam sem data de término e 5 tinham o período
--     vencido — 8 de 9 errados.
--
-- O QUE ESTA MIGRATION FAZ
--
--  A) afastamento_encerrar_vencidos(): encerra quem já passou da data de
--     término. Roda sozinha todo dia pelo pg_cron e pode ser chamada à
--     mão. Não toca em prazo indeterminado nem em benefício do INSS.
--  B) Gatilho que encerra na hora: preencher a data de término (ou
--     qualquer edição de um registro já vencido) encerra o afastamento
--     imediatamente, sem esperar a rotina diária. É o que devolve ao RH
--     um caminho de saída que não seja apagar.
--  C) Guarda de criação: afastamento novo sem data de término só passa
--     quando for legitimamente sem prazo — prazo indeterminado marcado,
--     benefício do INSS ou tipo previdenciário. Fora disso, recusa com
--     mensagem que diz o que fazer. Registros JÁ existentes continuam
--     editáveis (a guarda de UPDATE só reage a quem tenta apagar uma
--     data de fim que existia).
--  D) Mensagem da trava do ponto passa a dizer o período do afastamento,
--     em vez de só "colaborador afastado".
--
-- O QUE ELA NÃO FAZ
--  Não altera nenhuma marcação de ponto, nenhum espelho e nenhum
--  afastamento existente. A conferência na produção mostrou espelho
--  limpo: zero dias abonados indevidamente, zero dias contando como
--  falta. O reparo dos registros atuais vai em script de entrega
--  separado, com nome e data conferidos um a um.
-- =====================================================================

SET lock_timeout = '10s';

-- ─────────────────────────────────────────────────────────────────────
-- Quem pode, legitimamente, ficar sem data de término
-- Benefício do INSS e prazo indeterminado não têm fim conhecido — e
-- nesses casos bloquear o ponto indefinidamente é o comportamento certo.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.afastamento_sem_prazo_e_legitimo(
  p_prazo_indeterminado boolean,
  p_status              text,
  p_status_geral        text,
  p_tipo_principal      text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(p_prazo_indeterminado, false)
      OR COALESCE(p_status, '')       = 'beneficio_inss'
      OR COALESCE(p_status_geral, '') IN ('prazo_indeterminado', 'em_beneficio')
      OR COALESCE(p_tipo_principal, '') IN ('beneficio_b31', 'beneficio_b91', 'licenca_maternidade');
$$;

COMMENT ON FUNCTION public.afastamento_sem_prazo_e_legitimo(boolean, text, text, text) IS
  'Um afastamento só pode existir sem data de término quando é benefício do INSS, prazo indeterminado ou licença-maternidade. Qualquer outro sem data de fim é defeito de lançamento.';

-- ─────────────────────────────────────────────────────────────────────
-- A) Encerramento de quem já venceu
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.afastamento_encerrar_vencidos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_encerrados integer := 0;
BEGIN
  WITH fim AS (
    UPDATE public.afastamentos a
       SET status = 'encerrado'
     WHERE a.status::text = 'ativo'
       AND a.data_fim IS NOT NULL
       AND a.data_fim < CURRENT_DATE
       AND NOT public.afastamento_sem_prazo_e_legitimo(
             a.prazo_indeterminado, a.status::text,
             a.status_geral_new::text, a.tipo_principal_new::text)
    RETURNING a.id
  )
  SELECT count(*) INTO v_encerrados FROM fim;

  RETURN v_encerrados;
END;
$$;

COMMENT ON FUNCTION public.afastamento_encerrar_vencidos() IS
  'Encerra afastamentos cujo período de término já passou. Antes desta rotina nada no sistema encerrava um afastamento — ele ficava ativo para sempre e o RH só saía disso apagando o registro.';

-- Todo dia às 03:10 (horário do servidor). Sem competir com a virada.
DO $cron$
BEGIN
  PERFORM cron.unschedule('afastamento-encerrar-vencidos');
EXCEPTION WHEN OTHERS THEN
  NULL;  -- não existia ainda; seguir
END $cron$;

DO $cron$
BEGIN
  PERFORM cron.schedule(
    'afastamento-encerrar-vencidos',
    '10 3 * * *',
    $job$SELECT public.afastamento_encerrar_vencidos()$job$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Agendamento diário não pôde ser criado (%). A rotina continua chamável à mão.', SQLERRM;
END $cron$;

-- ─────────────────────────────────────────────────────────────────────
-- B) Encerra na hora + C) guarda de criação
-- Um gatilho BEFORE só, para não multiplicar gatilhos nesta tabela.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.afastamento_valida_e_encerra()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_legitimo boolean := public.afastamento_sem_prazo_e_legitimo(
    NEW.prazo_indeterminado, NEW.status::text,
    NEW.status_geral_new::text, NEW.tipo_principal_new::text);
BEGIN
  -- ── Guarda: não deixa nascer afastamento eterno por descuido ────────
  -- No UPDATE, só reage a quem tenta APAGAR uma data de fim que existia.
  -- Registros antigos sem data de fim continuam editáveis, senão o RH
  -- não conseguiria justamente consertá-los.
  IF NEW.data_fim IS NULL AND NOT v_legitimo THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION
        'Afastamento sem data de término. Informe a data de fim, ou marque como prazo indeterminado / benefício do INSS quando não houver previsão de retorno. Sem isso o colaborador fica impedido de bater ponto por tempo indefinido.'
        USING ERRCODE = '23514';
    ELSIF TG_OP = 'UPDATE' AND OLD.data_fim IS NOT NULL THEN
      RAISE EXCEPTION
        'Não é possível remover a data de término de um afastamento. Corrija a data, ou marque como prazo indeterminado / benefício do INSS.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- ── Encerramento imediato de período já vencido ─────────────────────
  -- É o que faz "preencher a data de término" encerrar o registro na
  -- hora, sem esperar a rotina da madrugada.
  IF NEW.data_fim IS NOT NULL
     AND NEW.data_fim < CURRENT_DATE
     AND NEW.status::text = 'ativo'
     AND NOT v_legitimo THEN
    NEW.status := 'encerrado';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_afastamento_valida_e_encerra ON public.afastamentos;
CREATE TRIGGER trg_afastamento_valida_e_encerra
BEFORE INSERT OR UPDATE ON public.afastamentos
FOR EACH ROW EXECUTE FUNCTION public.afastamento_valida_e_encerra();

-- ─────────────────────────────────────────────────────────────────────
-- D) A trava do ponto passa a explicar o motivo
-- A regra não muda: continua bloqueando batida dentro do período de um
-- afastamento ativo. Muda só a mensagem, que hoje não diz nem de quando
-- até quando — o gestor não tem como saber se é engano ou não.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validar_batida_afastamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_af RECORD;
BEGIN
  SELECT data_inicio, data_fim INTO v_af
    FROM public.afastamentos
   WHERE tenant_id = NEW.tenant_id
     AND colaborador_id = NEW.colaborador_id
     AND status::text IN ('ativo', 'beneficio_inss')
     AND NEW.data_marcacao BETWEEN data_inicio AND COALESCE(data_fim, DATE '9999-12-31')
   ORDER BY data_inicio DESC
   LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'Colaborador afastado desde % %. Não é possível registrar ponto durante o afastamento.',
      to_char(v_af.data_inicio, 'DD/MM/YYYY'),
      CASE WHEN v_af.data_fim IS NULL
           THEN '(sem data de término registrada)'
           ELSE 'até ' || to_char(v_af.data_fim, 'DD/MM/YYYY') END;
  END IF;

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- Conferência da própria migration
-- ─────────────────────────────────────────────────────────────────────
DO $verifica$
DECLARE
  v_faltando text := '';
BEGIN
  IF to_regprocedure('public.afastamento_encerrar_vencidos()') IS NULL THEN
    v_faltando := v_faltando || ' afastamento_encerrar_vencidos';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                  WHERE tgname = 'trg_afastamento_valida_e_encerra' AND NOT tgisinternal) THEN
    v_faltando := v_faltando || ' trg_afastamento_valida_e_encerra';
  END IF;
  IF v_faltando <> '' THEN
    RAISE EXCEPTION 'Instalação incompleta:%', v_faltando;
  END IF;
  RAISE NOTICE 'OK: afastamento passa a ter encerramento automático e guarda de data de término.';
END $verifica$;
