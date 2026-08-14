-- ============================================================================
-- landing_leads: garantias para o diagnóstico psicossocial do site
-- ============================================================================
--
-- O diagnóstico do site grava em public.landing_leads, que já existia para a
-- outra landing. Esta migration não inventa estrutura nova: ela fecha as
-- lacunas que só apareceriam em produção, e mantém repositório e ambientes
-- dizendo a mesma coisa.
--
-- O que fecha:
--
--  1. GRANT explícito. RLS e permissão de tabela são camadas DIFERENTES, e
--     as duas precisam existir. Em base onde as permissões padrão do Supabase
--     não pegaram, a política de INSERT está lá, correta, e a gravação é
--     recusada assim mesmo. O sintoma é o pior possível para um funil pago: o
--     visitante responde tudo, vê o resultado, e o lead não é gravado. Ninguém
--     percebe a perda.
--
--  2. Índices de consulta do painel. A aba Landing lista "mais recentes
--     primeiro" e filtra por origem para separar os funis (`lp` e
--     `site-diagnostico-psicossocial`).
--
-- Tudo idempotente. O script de entrega de produção
-- (docs/script_diagnostico_psicossocial_site.sql) faz o mesmo e ainda
-- confere item a item.
-- ============================================================================

SET lock_timeout = '10s';

-- Camada de permissão da tabela — a que costuma faltar sem ninguém notar.
-- Visitante anônimo grava o próprio lead e não lê nenhum; a leitura fica com
-- o superadmin, pela política que já existe.
GRANT INSERT                         ON public.landing_leads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.landing_leads TO authenticated;

CREATE INDEX IF NOT EXISTS landing_leads_created_at_idx
  ON public.landing_leads (created_at DESC);

CREATE INDEX IF NOT EXISTS landing_leads_origem_idx
  ON public.landing_leads (landing_page_origem);
