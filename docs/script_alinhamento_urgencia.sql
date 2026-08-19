-- ============================================================================
-- YourEyes · PRODUÇÃO · Alinhamento — leva de urgência
--
-- O QUE ESTE SCRIPT RESOLVE
--
-- A conferência de divergência (14/08) mostrou que a produção está atrás do
-- repositório em coisas que impedem trabalho HOJE. Este script entrega as
-- cinco mais urgentes:
--
--   1. Licença-adoção — hoje NÃO é possível lançar afastamento por adoção,
--      porque falta o valor no tipo. A tela oferece, o banco recusa.
--   2. Número da CAT — a CAT é emitida e não há onde guardar o número.
--   3. Estabilidade pós-acidente — a data de fim não existe e o alerta de
--      30 dias nunca roda. Quem tem estabilidade não é acompanhado.
--   4. Entrevistas psicossociais em grupo — faltam os três campos que
--      distinguem sessão coletiva de individual.
--   5. A trava de autoaprovação do ajuste de ponto — existe no código, no
--      ambiente de teste e no relatório de QA, e NÃO existe na produção.
--      Hoje um gestor ajusta o próprio ponto e aprova sozinho.
--
-- SEGURO DE RODAR DUAS VEZES. Nada é apagado. Cada item vai em bloco
-- próprio: se um falhar, avisa e o script segue, em vez de abortar tudo.
--
-- SOBRE O ITEM 5, PARA VOCÊ NÃO SER PEGO DE SURPRESA
-- Depois deste script, quem tentar aprovar o próprio ajuste de ponto recebe
-- a mensagem "Ninguém aprova o próprio ajuste de ponto — a aprovação precisa
-- de um segundo par de olhos". A trava vale só para aprovações NOVAS; o
-- histórico não é tocado. A conferência final mostra quantas aprovações
-- existentes teriam sido barradas, para você saber o tamanho do hábito.
--
-- NÃO PRECISA PUBLICAR NO LOVABLE. Nenhuma tela muda: o código já espera
-- tudo isto, é o banco que estava atrás.
--
-- COMO RODAR: cole o arquivo inteiro no SQL Editor do projeto de PRODUÇÃO.
-- O último resultado é a conferência.
-- ============================================================================

SET lock_timeout = '10s';

-- ─────────────────────────────────────────────────────────────────────
-- 1) Licença-adoção
--
-- Maternidade e paternidade já existiam nos dois tipos; adoção não. Sem
-- este valor, o RH não tem como registrar o afastamento de quem adotou.
-- ─────────────────────────────────────────────────────────────────────
DO $adocao$
BEGIN
  ALTER TYPE public.afastamento_tipo_principal ADD VALUE IF NOT EXISTS 'licenca_adocao';
  ALTER TYPE public.atestado_subtipo_assistencial ADD VALUE IF NOT EXISTS 'adocao';
  RAISE NOTICE 'Licença-adoção disponível nos dois tipos.';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ATENÇÃO: licença-adoção NAO aplicada: %', SQLERRM;
END $adocao$;

-- ─────────────────────────────────────────────────────────────────────
-- 2) Número da CAT
-- ─────────────────────────────────────────────────────────────────────
DO $cat$
BEGIN
  ALTER TABLE public.afastamentos_cat ADD COLUMN IF NOT EXISTS numero_cat text;
  COMMENT ON COLUMN public.afastamentos_cat.numero_cat IS
    'Número/registro da CAT emitida; se vazio, gera pendência de CAT no RH.';
  RAISE NOTICE 'Número da CAT disponível.';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ATENÇÃO: numero_cat NAO aplicado: %', SQLERRM;
END $cat$;

-- ─────────────────────────────────────────────────────────────────────
-- 3) Estabilidade pós-acidente: a data e o alerta de 30 dias
--
-- A rotina roda diariamente e cria alerta para quem tem estabilidade
-- vencendo em 30 dias — tanto por benefício B91 quanto por acidente ou
-- doença ocupacional. Sem a coluna, ela não tem o que ler.
-- ─────────────────────────────────────────────────────────────────────
DO $estab_col$
BEGIN
  ALTER TABLE public.afastamentos ADD COLUMN IF NOT EXISTS data_fim_estabilidade date;
  COMMENT ON COLUMN public.afastamentos.data_fim_estabilidade IS
    'Fim da estabilidade provisória (retorno + 12 meses) para acidente/doença ocupacional.';
  RAISE NOTICE 'Coluna data_fim_estabilidade disponível.';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ATENÇÃO: data_fim_estabilidade NAO aplicada: %', SQLERRM;
END $estab_col$;

CREATE OR REPLACE FUNCTION public.gerar_alertas_estabilidade()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- B91 (beneficios_inss)
    INSERT INTO public.alertas_saude (tenant_id, tipo, referencia_tipo, referencia_id, colaborador_id, colaborador_nome, titulo, descricao, prioridade)
    SELECT b.tenant_id, 'estabilidade_30_dias', 'beneficio_inss', b.id, b.colaborador_id, b.colaborador_nome,
           'Estabilidade vence em 30 dias',
           'A estabilidade de ' || b.colaborador_nome || ' (B91) termina em ' || to_char(b.data_fim_estabilidade, 'DD/MM/YYYY') || '.',
           'alta'
    FROM public.beneficios_inss b
    WHERE b.gera_estabilidade = true
      AND b.data_fim_estabilidade = (CURRENT_DATE + INTERVAL '30 days')::date
      AND NOT EXISTS (
          SELECT 1 FROM public.alertas_saude a
          WHERE a.referencia_id = b.id AND a.tipo = 'estabilidade_30_dias' AND a.resolvido = false
      );

    -- Acidente / doença ocupacional (afastamentos)
    INSERT INTO public.alertas_saude (tenant_id, tipo, referencia_tipo, referencia_id, colaborador_id, colaborador_nome, titulo, descricao, prioridade)
    SELECT af.tenant_id, 'estabilidade_30_dias', 'afastamento', af.id, af.colaborador_id, af.colaborador_nome,
           'Estabilidade vence em 30 dias',
           'A estabilidade de ' || af.colaborador_nome || ' (acidente/doença ocupacional) termina em ' || to_char(af.data_fim_estabilidade, 'DD/MM/YYYY') || '.',
           'alta'
    FROM public.afastamentos af
    WHERE af.data_fim_estabilidade = (CURRENT_DATE + INTERVAL '30 days')::date
      AND NOT EXISTS (
          SELECT 1 FROM public.alertas_saude a
          WHERE a.referencia_id = af.id AND a.tipo = 'estabilidade_30_dias' AND a.resolvido = false
      );
END;
$function$;

-- A rotina precisa de quem a chame todo dia. Se o agendador não estiver
-- disponível, o aviso sai e o resto segue: a função fica pronta para ser
-- agendada depois.
DO $estab_cron$
BEGIN
  PERFORM cron.unschedule('gerar-alertas-estabilidade-30-dias');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $estab_cron$;

DO $estab_sched$
BEGIN
  PERFORM cron.schedule('gerar-alertas-estabilidade-30-dias', '0 4 * * *',
                        $cron$SELECT public.gerar_alertas_estabilidade()$cron$);
  RAISE NOTICE 'Alerta de estabilidade agendado para as 4h.';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ATENÇÃO: agendamento do alerta de estabilidade NAO feito: %', SQLERRM;
END $estab_sched$;

-- ─────────────────────────────────────────────────────────────────────
-- 4) Entrevistas psicossociais em grupo
--
-- Sem estes três campos não há como distinguir uma sessão coletiva de uma
-- individual, nem registrar o nome do grupo e quantos são esperados.
-- ─────────────────────────────────────────────────────────────────────
DO $entrev$
BEGIN
  ALTER TABLE public.psicossocial_entrevistas
    ADD COLUMN IF NOT EXISTS tipo_sessao text NOT NULL DEFAULT 'individual',
    ADD COLUMN IF NOT EXISTS grupo_nome text,
    ADD COLUMN IF NOT EXISTS participantes_previstos int;
  RAISE NOTICE 'Entrevistas em grupo habilitadas.';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ATENÇÃO: campos de entrevista em grupo NAO aplicados: %', SQLERRM;
END $entrev$;

-- ─────────────────────────────────────────────────────────────────────
-- 5) A trava de autoaprovação do ajuste de ponto
--
-- É a trava que o motor de QA cita como precedente ("a trava que o ajuste
-- de ponto já tem") — e que não existia aqui. Vale só para aprovações
-- novas: o gatilho dispara em INSERT e em UPDATE de aprovado_por/status,
-- e não revisita o histórico.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ponto_ajuste_bloqueia_autoaprovacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cpf_aprovador text;
  v_id_aprovador uuid;
BEGIN
  IF NEW.aprovado_por IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.aprovado_por IS NOT DISTINCT FROM OLD.aprovado_por THEN
    RETURN NEW;
  END IF;

  SELECT ub.id, regexp_replace(COALESCE(ub.cpf, ''), '[^0-9]', '', 'g')
    INTO v_id_aprovador, v_cpf_aprovador
  FROM public.usuarios_base ub
  WHERE ub.auth_user_id = NEW.aprovado_por
    AND ub.tenant_id = NEW.tenant_id
  LIMIT 1;

  IF v_id_aprovador IS NOT NULL
     AND v_id_aprovador::text = NEW.colaborador_id::text THEN
    RAISE EXCEPTION 'Ninguém aprova o próprio ajuste de ponto — a aprovação precisa de um segundo par de olhos.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF COALESCE(v_cpf_aprovador, '') <> ''
     AND v_cpf_aprovador = regexp_replace(COALESCE(NEW.colaborador_cpf, ''), '[^0-9]', '', 'g') THEN
    RAISE EXCEPTION 'Ninguém aprova o próprio ajuste de ponto — a aprovação precisa de um segundo par de olhos.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

DO $trava_trg$
BEGIN
  DROP TRIGGER IF EXISTS trg_ponto_ajuste_autoaprovacao ON public.ponto_ajustes;
  CREATE TRIGGER trg_ponto_ajuste_autoaprovacao
    BEFORE INSERT OR UPDATE OF aprovado_por, status ON public.ponto_ajustes
    FOR EACH ROW EXECUTE FUNCTION public.ponto_ajuste_bloqueia_autoaprovacao();
  RAISE NOTICE 'Trava de autoaprovação do ajuste de ponto instalada.';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ATENÇÃO: trava de autoaprovação NAO instalada: %', SQLERRM;
END $trava_trg$;

-- ============================================================================
-- CONFERÊNCIA — é o único resultado que o editor mostra
-- ============================================================================
SELECT 1 AS ordem, 'Licença-adoção (afastamento)' AS item,
       CASE WHEN EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                         WHERE t.typname = 'afastamento_tipo_principal'
                           AND e.enumlabel = 'licenca_adocao') THEN 'ok' ELSE 'FALTA' END AS situacao,
       'sem isto, afastamento por adoção não pode ser lançado' AS observacao

UNION ALL
SELECT 2, 'Licença-adoção (atestado)',
       CASE WHEN EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                         WHERE t.typname = 'atestado_subtipo_assistencial'
                           AND e.enumlabel = 'adocao') THEN 'ok' ELSE 'FALTA' END,
       'subtipo do atestado'

UNION ALL
SELECT 3, 'Número da CAT',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema='public' AND table_name='afastamentos_cat'
                           AND column_name='numero_cat') THEN 'ok' ELSE 'FALTA' END,
       'CAT emitida passa a ter onde guardar o número'

UNION ALL
SELECT 4, 'Estabilidade: data de fim',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema='public' AND table_name='afastamentos'
                           AND column_name='data_fim_estabilidade') THEN 'ok' ELSE 'FALTA' END,
       'campo que o alerta de 30 dias lê'

UNION ALL
SELECT 5, 'Estabilidade: rotina de alerta',
       CASE WHEN to_regprocedure('public.gerar_alertas_estabilidade()') IS NOT NULL
            THEN 'ok' ELSE 'FALTA' END,
       'cria alerta para estabilidade vencendo em 30 dias'

UNION ALL
SELECT 6, 'Entrevistas em grupo (3 campos)',
       CASE WHEN (SELECT count(*) FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='psicossocial_entrevistas'
                    AND column_name IN ('tipo_sessao','grupo_nome','participantes_previstos')) = 3
            THEN 'ok' ELSE 'FALTA' END,
       'sessão coletiva deixa de ser confundida com individual'

UNION ALL
SELECT 7, 'Trava de autoaprovação do ponto',
       CASE WHEN EXISTS (SELECT 1 FROM pg_trigger
                         WHERE tgrelid = 'public.ponto_ajustes'::regclass
                           AND tgname = 'trg_ponto_ajuste_autoaprovacao'
                           AND NOT tgisinternal) THEN 'ok' ELSE 'FALTA' END,
       'ninguém aprova o próprio ajuste de ponto, a partir de agora'

UNION ALL
SELECT 8, 'Aprovações do histórico que teriam sido barradas',
       (SELECT count(*)::text FROM public.ponto_ajustes a
         WHERE a.aprovado_por IS NOT NULL
           AND EXISTS (SELECT 1 FROM public.usuarios_base ub
                        WHERE ub.auth_user_id = a.aprovado_por
                          AND ub.tenant_id = a.tenant_id
                          AND (ub.id::text = a.colaborador_id::text
                            OR regexp_replace(COALESCE(ub.cpf,''),'[^0-9]','','g')
                             = regexp_replace(COALESCE(a.colaborador_cpf,''),'[^0-9]','','g')))),
       'histórico NAO foi alterado; é só a medida do hábito que a trava passa a impedir'

ORDER BY ordem;
