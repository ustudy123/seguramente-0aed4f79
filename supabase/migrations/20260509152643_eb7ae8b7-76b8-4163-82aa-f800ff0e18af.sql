-- Tabela de riscos psicossociais por tenant
CREATE TABLE IF NOT EXISTS public.psicossocial_riscos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  empresa_id UUID NULL,
  nome TEXT NOT NULL,
  descricao TEXT NULL,
  padrao BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL
);

CREATE INDEX IF NOT EXISTS idx_psicossocial_riscos_tenant ON public.psicossocial_riscos(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_psicossocial_riscos_tenant_nome
  ON public.psicossocial_riscos(tenant_id, lower(nome));

ALTER TABLE public.psicossocial_riscos ENABLE ROW LEVEL SECURITY;

-- RLS: usuários do tenant
DROP POLICY IF EXISTS "Tenant select psicossocial_riscos" ON public.psicossocial_riscos;
CREATE POLICY "Tenant select psicossocial_riscos"
  ON public.psicossocial_riscos FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant insert psicossocial_riscos" ON public.psicossocial_riscos;
CREATE POLICY "Tenant insert psicossocial_riscos"
  ON public.psicossocial_riscos FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant update psicossocial_riscos" ON public.psicossocial_riscos;
CREATE POLICY "Tenant update psicossocial_riscos"
  ON public.psicossocial_riscos FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant delete psicossocial_riscos" ON public.psicossocial_riscos;
CREATE POLICY "Tenant delete psicossocial_riscos"
  ON public.psicossocial_riscos FOR DELETE
  USING (tenant_id = public.get_user_tenant_id());

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_psicossocial_riscos()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_touch_psicossocial_riscos ON public.psicossocial_riscos;
CREATE TRIGGER trg_touch_psicossocial_riscos
BEFORE UPDATE ON public.psicossocial_riscos
FOR EACH ROW EXECUTE FUNCTION public.touch_psicossocial_riscos();

-- Função para semear os 13 riscos padrão para o tenant
CREATE OR REPLACE FUNCTION public.seed_psicossocial_riscos_padrao(_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_riscos TEXT[] := ARRAY[
    'Assédio de qualquer natureza',
    'Baixa clareza de papel/função',
    'Baixa demanda de trabalho (subcarga)',
    'Baixa justiça organizacional',
    'Baixas recompensas e reconhecimento',
    'Baixo controle no trabalho / Falta de autonomia',
    'Eventos violentos ou traumáticos',
    'Excesso de demandas (sobrecarga)',
    'Falta de suporte no trabalho',
    'Más relações no ambiente de trabalho',
    'Má gestão de mudanças organizacionais',
    'Trabalho em condições de difícil comunicação',
    'Trabalho remoto e isolado'
  ];
  v_nome TEXT;
BEGIN
  FOREACH v_nome IN ARRAY v_riscos LOOP
    INSERT INTO public.psicossocial_riscos (tenant_id, nome, padrao, ativo)
    VALUES (_tenant_id, v_nome, true, true)
    ON CONFLICT (tenant_id, lower(nome)) DO NOTHING;
  END LOOP;
END;
$$;