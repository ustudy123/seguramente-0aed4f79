
-- =============================================
-- GAMIFICAÇÃO: Medalhas, Certificados, Ranking
-- =============================================

-- 1. Medalhas (badge definitions)
CREATE TABLE public.trilha_medalhas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  icone TEXT NOT NULL DEFAULT 'trophy',
  cor TEXT NOT NULL DEFAULT '#F59E0B',
  tipo TEXT NOT NULL DEFAULT 'conclusao_trilha',
  criterio JSONB NOT NULL DEFAULT '{}',
  pontos_bonus INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trilha_medalhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation - select medalhas"
  ON public.trilha_medalhas FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant isolation - insert medalhas"
  ON public.trilha_medalhas FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant isolation - update medalhas"
  ON public.trilha_medalhas FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant isolation - delete medalhas"
  ON public.trilha_medalhas FOR DELETE
  USING (tenant_id = public.get_user_tenant_id());

-- 2. Medalhas conquistadas
CREATE TABLE public.trilha_medalhas_colaboradores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  medalha_id UUID NOT NULL REFERENCES public.trilha_medalhas(id) ON DELETE CASCADE,
  colaborador_id UUID NOT NULL,
  colaborador_nome TEXT NOT NULL,
  trilha_id UUID REFERENCES public.trilhas(id) ON DELETE SET NULL,
  data_conquista TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trilha_medalhas_colaboradores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation - select medalhas_colab"
  ON public.trilha_medalhas_colaboradores FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant isolation - insert medalhas_colab"
  ON public.trilha_medalhas_colaboradores FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- 3. Certificados
CREATE TABLE public.trilha_certificados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  trilha_id UUID NOT NULL REFERENCES public.trilhas(id) ON DELETE CASCADE,
  colaborador_id UUID NOT NULL,
  colaborador_nome TEXT NOT NULL,
  data_conclusao TIMESTAMPTZ NOT NULL DEFAULT now(),
  pontos_obtidos INT NOT NULL DEFAULT 0,
  codigo TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trilha_certificados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation - select certificados"
  ON public.trilha_certificados FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant isolation - insert certificados"
  ON public.trilha_certificados FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- 4. Trigger: auto-generate certificate when all modules completed
CREATE OR REPLACE FUNCTION public.verificar_conclusao_trilha()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_modulos INT;
  v_concluidos INT;
  v_trilha_nome TEXT;
  v_pontos INT;
  v_existe_cert BOOLEAN;
BEGIN
  IF NEW.status != 'concluido' THEN RETURN NEW; END IF;

  -- Count total active modules
  SELECT COUNT(*) INTO v_total_modulos
  FROM public.trilha_modulos
  WHERE trilha_id = NEW.trilha_id AND ativo = true;

  -- Count completed modules by this user
  SELECT COUNT(*) INTO v_concluidos
  FROM public.trilha_progresso
  WHERE trilha_id = NEW.trilha_id
    AND colaborador_id = NEW.colaborador_id
    AND tenant_id = NEW.tenant_id
    AND status = 'concluido';

  IF v_concluidos >= v_total_modulos AND v_total_modulos > 0 THEN
    -- Check if certificate already exists
    SELECT EXISTS(
      SELECT 1 FROM public.trilha_certificados
      WHERE trilha_id = NEW.trilha_id
        AND colaborador_id = NEW.colaborador_id
        AND tenant_id = NEW.tenant_id
    ) INTO v_existe_cert;

    IF NOT v_existe_cert THEN
      -- Get total points
      SELECT COALESCE(SUM(pontos_obtidos), 0) INTO v_pontos
      FROM public.trilha_progresso
      WHERE trilha_id = NEW.trilha_id
        AND colaborador_id = NEW.colaborador_id
        AND tenant_id = NEW.tenant_id;

      -- Create certificate
      INSERT INTO public.trilha_certificados (
        tenant_id, trilha_id, colaborador_id, colaborador_nome,
        pontos_obtidos, codigo
      ) VALUES (
        NEW.tenant_id, NEW.trilha_id, NEW.colaborador_id, NEW.colaborador_nome,
        v_pontos, 'CERT-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 8))
      );

      -- Award "conclusao_trilha" medals if configured
      INSERT INTO public.trilha_medalhas_colaboradores (
        tenant_id, medalha_id, colaborador_id, colaborador_nome, trilha_id
      )
      SELECT NEW.tenant_id, m.id, NEW.colaborador_id, NEW.colaborador_nome, NEW.trilha_id
      FROM public.trilha_medalhas m
      WHERE m.tenant_id = NEW.tenant_id
        AND m.tipo = 'conclusao_trilha'
        AND m.ativo = true
        AND NOT EXISTS (
          SELECT 1 FROM public.trilha_medalhas_colaboradores mc
          WHERE mc.medalha_id = m.id
            AND mc.colaborador_id = NEW.colaborador_id
            AND mc.trilha_id = NEW.trilha_id
        );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_verificar_conclusao_trilha
  AFTER INSERT OR UPDATE ON public.trilha_progresso
  FOR EACH ROW
  EXECUTE FUNCTION public.verificar_conclusao_trilha();

-- Indexes
CREATE INDEX idx_medalhas_colab_user ON public.trilha_medalhas_colaboradores(colaborador_id);
CREATE INDEX idx_certificados_user ON public.trilha_certificados(colaborador_id);
CREATE INDEX idx_certificados_trilha ON public.trilha_certificados(trilha_id);
