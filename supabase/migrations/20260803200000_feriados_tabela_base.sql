-- =====================================================================
-- Tabela feriados — trazida para as migrations
--
-- Dívida de reprodutibilidade encontrada na prova do staging (10/08):
-- a tabela public.feriados existe em produção mas NÃO nasce de nenhuma
-- migration — foi criada direto no banco. As migrations de 03/08 e
-- 04/08 (equalização de feriados, RN-23) dependem dela e quebravam o
-- db push em banco novo.
--
-- Estrutura reconstruída do types.ts do repositório (espelho do banco
-- de produção). IF NOT EXISTS: em produção nada muda.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.feriados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  empresa_id uuid,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'nacional',
  abrangencia text NOT NULL DEFAULT 'nacional',
  data date,
  dia integer,
  mes integer,
  recorrente boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  uf text,
  municipio text,
  codigo_ibge text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feriados ENABLE ROW LEVEL SECURITY;

DO $pol$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname='public' AND tablename='feriados') THEN
    CREATE POLICY feriados_tenant ON public.feriados
      FOR ALL TO authenticated
      USING (tenant_id IS NULL OR tenant_id IN
             (SELECT ub.tenant_id FROM public.usuarios_base ub
              WHERE ub.auth_user_id = auth.uid()));
  END IF;
END $pol$;
