-- ============================================================================
-- YourEyes · PRODUÇÃO · Diagnóstico de riscos psicossociais do site
-- ============================================================================
--
-- O QUE ESTE SCRIPT FAZ
--
-- O diagnóstico do site não criou tabela nova: ele grava os leads em
-- public.landing_leads, que já existia para a outra landing. Este script
-- GARANTE que essa estrutura está inteira na produção — tabela, colunas,
-- permissões, travas de abuso e o gatilho que copia o lead para o CRM.
--
-- Por que rodar, se "já existe": se qualquer peça estiver faltando, o
-- visitante responde as oito perguntas, vê o resultado e o lead NÃO é
-- gravado — a tela não quebra, e ninguém percebe a perda. Foi exatamente
-- assim que uma trava de e-mail apareceu no ambiente de teste. Conferir é
-- barato; descobrir depois de gastar em anúncio, não.
--
-- SEGURO DE RODAR DUAS VEZES. Nada é apagado, nenhum lead é tocado.
-- Onde a peça já existe, o script confirma e segue.
--
-- COMO RODAR: cole o arquivo inteiro no SQL Editor do projeto de PRODUÇÃO
-- e execute. O editor mostra apenas o ÚLTIMO resultado — é a conferência
-- final, com uma linha por item e a coluna `erro_tecnico` quando algo
-- não pôde ser aplicado.
-- ============================================================================

SET lock_timeout = '10s';

-- ----------------------------------------------------------------------------
-- 1) A tabela
--
-- CREATE TABLE IF NOT EXISTS não conserta tabela existente com formato
-- diferente: ele simplesmente não faz nada. Por isso vem o bloco de colunas
-- logo abaixo — é ele que garante o formato, exista a tabela ou não.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.landing_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.landing_leads
  ADD COLUMN IF NOT EXISTS telefone              TEXT,
  ADD COLUMN IF NOT EXISTS empresa               TEXT,
  ADD COLUMN IF NOT EXISTS cargo                 TEXT,
  ADD COLUMN IF NOT EXISTS setor                 TEXT,
  ADD COLUMN IF NOT EXISTS num_funcionarios      TEXT,
  ADD COLUMN IF NOT EXISTS urgencia              TEXT,
  ADD COLUMN IF NOT EXISTS landing_page_origem   TEXT,
  ADD COLUMN IF NOT EXISTS perfil_diagnostico    TEXT,
  ADD COLUMN IF NOT EXISTS pontuacao_diagnostico INTEGER,
  ADD COLUMN IF NOT EXISTS diagnostico_resultado JSONB,
  ADD COLUMN IF NOT EXISTS convertido            BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ip_address            TEXT,
  ADD COLUMN IF NOT EXISTS created_at            TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at            TIMESTAMPTZ DEFAULT now();

-- Consulta do painel: sempre "os mais recentes primeiro", às vezes filtrando
-- por origem para separar os funis.
CREATE INDEX IF NOT EXISTS landing_leads_created_at_idx
  ON public.landing_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS landing_leads_origem_idx
  ON public.landing_leads (landing_page_origem);

-- ----------------------------------------------------------------------------
-- 2) Quem pode o quê
--
-- Duas camadas, e as duas precisam existir: a permissão da tabela (GRANT) e
-- a política de linha (RLS). Só uma delas não basta — com RLS ligado e sem
-- GRANT, a gravação é recusada mesmo com a política certa.
--
-- Visitante anônimo GRAVA o próprio lead e não lê nenhum.
-- Superadmin lê, corrige e apaga. Ninguém mais enxerga nada.
-- ----------------------------------------------------------------------------
ALTER TABLE public.landing_leads ENABLE ROW LEVEL SECURITY;

GRANT INSERT                         ON public.landing_leads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.landing_leads TO authenticated;

DROP POLICY IF EXISTS "Anon can insert leads"     ON public.landing_leads;
DROP POLICY IF EXISTS "Anyone can insert leads"   ON public.landing_leads;
CREATE POLICY "Anyone can insert leads"
  ON public.landing_leads FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Superadmins can view leads" ON public.landing_leads;
CREATE POLICY "Superadmins can view leads"
  ON public.landing_leads FOR SELECT TO authenticated
  USING (public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "Superadmins can update leads" ON public.landing_leads;
CREATE POLICY "Superadmins can update leads"
  ON public.landing_leads FOR UPDATE TO authenticated
  USING (public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "Superadmins can delete leads" ON public.landing_leads;
CREATE POLICY "Superadmins can delete leads"
  ON public.landing_leads FOR DELETE TO authenticated
  USING (public.is_superadmin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 3) Travas de conteúdo
--
-- Formulário aberto na internet recebe de tudo. Estas travas existem para o
-- lixo não entrar. Vão em bloco com tratamento de erro porque, se houver um
-- registro antigo que já violaria a regra, a trava não pode derrubar o
-- script inteiro — ela avisa e o resto segue.
--
-- A regra de e-mail é a MESMA que a tela usa. Precisa ser a mesma: quando a
-- tela é mais frouxa que o banco, o visitante recebe "não conseguimos
-- registrar" sem saber que faltou um ponto no endereço, e o lead vai embora.
-- ----------------------------------------------------------------------------
DO $travas$
DECLARE
  v_item text;
BEGIN
  FOREACH v_item IN ARRAY ARRAY[
    'landing_leads_nome_len      CHECK (nome IS NULL OR char_length(nome) <= 200)',
    'landing_leads_email_len     CHECK (email IS NULL OR char_length(email) <= 320)',
    'landing_leads_email_fmt     CHECK (email IS NULL OR email ~* ''^[^@\s]+@[^@\s]+\.[^@\s]+$'')',
    'landing_leads_telefone_len  CHECK (telefone IS NULL OR char_length(telefone) <= 30)',
    'landing_leads_empresa_len   CHECK (empresa IS NULL OR char_length(empresa) <= 300)',
    'landing_leads_cargo_len     CHECK (cargo IS NULL OR char_length(cargo) <= 200)',
    'landing_leads_setor_len     CHECK (setor IS NULL OR char_length(setor) <= 200)',
    'landing_leads_origem_len    CHECK (landing_page_origem IS NULL OR char_length(landing_page_origem) <= 300)',
    'landing_leads_diag_size     CHECK (diagnostico_resultado IS NULL OR pg_column_size(diagnostico_resultado) <= 16384)'
  ]
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.landing_leads DROP CONSTRAINT IF EXISTS %I',
                     split_part(v_item, ' ', 1));
      EXECUTE format('ALTER TABLE public.landing_leads ADD CONSTRAINT %s', v_item);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Trava % nao aplicada: %', split_part(v_item, ' ', 1), SQLERRM;
    END;
  END LOOP;
END
$travas$;

-- ----------------------------------------------------------------------------
-- 4) Trava de abuso: no máximo 5 envios por IP a cada 10 minutos
--
-- Formulário público sem esta trava é convite para robô encher a base — e,
-- pior, para o comercial perder tempo ligando para lead falso.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.landing_leads_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_ip text;
  v_count int;
BEGIN
  BEGIN
    v_ip := COALESCE(
      current_setting('request.headers', true)::json->>'x-forwarded-for',
      current_setting('request.headers', true)::json->>'cf-connecting-ip'
    );
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;

  IF v_ip IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM public.landing_leads
    WHERE created_at > now() - interval '10 minutes'
      AND ip_address = v_ip;

    IF v_count >= 5 THEN
      RAISE EXCEPTION 'Rate limit exceeded. Tente novamente em alguns minutos.'
        USING ERRCODE = 'check_violation';
    END IF;

    NEW.ip_address := v_ip;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_landing_leads_rate_limit ON public.landing_leads;
CREATE TRIGGER trg_landing_leads_rate_limit
  BEFORE INSERT ON public.landing_leads
  FOR EACH ROW EXECUTE FUNCTION public.landing_leads_rate_limit();

-- ----------------------------------------------------------------------------
-- 5) Cópia automática para o CRM
--
-- É o que faz o lead aparecer no quadro "Leads CRM" com status "novo",
-- já com o resumo do diagnóstico na nota.
--
-- Depende da tabela public.leads e dos tipos lead_origem/lead_status. Se
-- algum deles não existir nesta base, o gatilho NÃO é criado — sem isso o
-- diagnóstico continua funcionando e gravando em landing_leads; o que se
-- perde é só a cópia automática. Melhor do que derrubar a gravação do lead.
-- ----------------------------------------------------------------------------
DO $crm$
BEGIN
  IF to_regclass('public.leads') IS NULL THEN
    RAISE NOTICE 'CRM: tabela public.leads nao existe nesta base; gatilho de copia nao instalado.';
    RETURN;
  END IF;

  EXECUTE $sql$
    CREATE OR REPLACE FUNCTION public.sync_landing_lead_to_crm()
    RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $body$
    BEGIN
      INSERT INTO public.leads (nome, email, telefone, empresa, cargo, origem, status, landing_lead_id, notas)
      VALUES (
        NEW.nome, NEW.email, NEW.telefone, NEW.empresa, NEW.cargo,
        'landing_page'::lead_origem,
        'novo'::lead_status,
        NEW.id,
        CASE
          WHEN NEW.perfil_diagnostico IS NOT NULL
          THEN 'Diagnóstico: ' || NEW.perfil_diagnostico
               || ' (Score ' || COALESCE(NEW.pontuacao_diagnostico::text, '-') || ')'
               || ' · Setor: ' || COALESCE(NEW.setor, '-')
               || ' · Funcionários: ' || COALESCE(NEW.num_funcionarios, '-')
          ELSE 'Origem: ' || COALESCE(NEW.landing_page_origem, 'landing')
        END
      )
      ON CONFLICT DO NOTHING;
      RETURN NEW;
    END;
    $body$;
  $sql$;

  DROP TRIGGER IF EXISTS trg_sync_landing_lead_to_crm ON public.landing_leads;
  CREATE TRIGGER trg_sync_landing_lead_to_crm
    AFTER INSERT ON public.landing_leads
    FOR EACH ROW EXECUTE FUNCTION public.sync_landing_lead_to_crm();
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'CRM: copia automatica nao instalada: %', SQLERRM;
END
$crm$;

-- ============================================================================
-- CONFERÊNCIA — é o único resultado que o editor mostra
--
-- Leia a coluna `situacao`. Tudo "ok" significa que a produção está pronta
-- para receber os leads do diagnóstico. Qualquer "FALTA" traz o detalhe em
-- `erro_tecnico`.
-- ============================================================================
WITH itens AS MATERIALIZED (
  SELECT 'Tabela landing_leads' AS item,
         (to_regclass('public.landing_leads') IS NOT NULL) AS ok,
         'a tabela onde o lead do diagnóstico é gravado' AS erro_tecnico
  UNION ALL
  SELECT 'Colunas do diagnóstico',
         NOT EXISTS (
           SELECT 1 FROM unnest(ARRAY['nome','email','telefone','empresa','cargo','setor',
                                      'num_funcionarios','landing_page_origem',
                                      'perfil_diagnostico','pontuacao_diagnostico',
                                      'diagnostico_resultado','ip_address']) c
           WHERE NOT EXISTS (
             SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='landing_leads' AND column_name=c
           )
         ),
         coalesce((
           SELECT 'faltando: ' || string_agg(c, ', ')
           FROM unnest(ARRAY['nome','email','telefone','empresa','cargo','setor',
                             'num_funcionarios','landing_page_origem',
                             'perfil_diagnostico','pontuacao_diagnostico',
                             'diagnostico_resultado','ip_address']) c
           WHERE NOT EXISTS (
             SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='landing_leads' AND column_name=c
           )
         ), 'todas presentes')
  UNION ALL
  SELECT 'Proteção de linha (RLS) ligada',
         coalesce((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.landing_leads')), false),
         'sem RLS qualquer visitante leria os leads dos outros'
  UNION ALL
  SELECT 'Visitante pode gravar o próprio lead',
         EXISTS (SELECT 1 FROM pg_policy
                 WHERE polrelid = to_regclass('public.landing_leads')
                   AND polcmd = 'a' AND 'anon'::regrole = ANY(polroles))
         AND has_table_privilege('anon', 'public.landing_leads', 'INSERT'),
         'se faltar, o diagnóstico mostra o resultado e perde o lead em silêncio'
  UNION ALL
  SELECT 'Visitante NÃO consegue ler leads',
         NOT has_table_privilege('anon', 'public.landing_leads', 'SELECT')
         OR NOT EXISTS (SELECT 1 FROM pg_policy
                        WHERE polrelid = to_regclass('public.landing_leads')
                          AND polcmd = 'r' AND 'anon'::regrole = ANY(polroles)),
         'dados de contato de lead não podem ficar abertos'
  UNION ALL
  SELECT 'Só superadmin lê os leads',
         EXISTS (SELECT 1 FROM pg_policy
                 WHERE polrelid = to_regclass('public.landing_leads')
                   AND polcmd = 'r'
                   AND pg_get_expr(polqual, polrelid) ILIKE '%is_superadmin%'),
         'é o que mantém o lead invisível para cliente e para usuário comum'
  UNION ALL
  SELECT 'Trava de e-mail igual à da tela',
         EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = to_regclass('public.landing_leads')
                   AND conname = 'landing_leads_email_fmt'),
         'mantém e-mail inválido fora da base'
  UNION ALL
  SELECT 'Trava antispam (5 envios por IP / 10 min)',
         EXISTS (SELECT 1 FROM pg_trigger
                 WHERE tgrelid = to_regclass('public.landing_leads')
                   AND tgname = 'trg_landing_leads_rate_limit' AND NOT tgisinternal),
         'sem ela, robô enche a base de lead falso'
  UNION ALL
  SELECT 'Cópia automática para o CRM',
         EXISTS (SELECT 1 FROM pg_trigger
                 WHERE tgrelid = to_regclass('public.landing_leads')
                   AND tgname = 'trg_sync_landing_lead_to_crm' AND NOT tgisinternal),
         'sem ela o lead fica só na aba Landing e não aparece no quadro do CRM'
)
SELECT
  item,
  CASE WHEN ok THEN 'ok' ELSE 'FALTA' END AS situacao,
  CASE WHEN ok THEN '' ELSE erro_tecnico END AS erro_tecnico
FROM itens

UNION ALL

SELECT
  'Leads do diagnóstico já recebidos',
  coalesce((SELECT count(*)::text FROM public.landing_leads
            WHERE landing_page_origem = 'site-diagnostico-psicossocial'), '0'),
  'depois de publicar, este número é o que deve crescer'
ORDER BY 1;
