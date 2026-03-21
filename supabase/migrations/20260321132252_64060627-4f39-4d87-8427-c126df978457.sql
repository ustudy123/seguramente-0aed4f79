
CREATE TABLE public.desvios_seguranca (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  codigo TEXT,
  tipo_desvio TEXT NOT NULL CHECK (tipo_desvio IN ('condicao_insegura', 'ato_inseguro', 'desvio_processo')),
  categoria TEXT,
  potencial_risco TEXT NOT NULL DEFAULT 'medio' CHECK (potencial_risco IN ('baixo', 'medio', 'alto', 'critico')),
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_tratamento', 'resolvido', 'convertido_incidente', 'cancelado')),
  unidade TEXT,
  setor TEXT,
  local_especifico TEXT,
  turno TEXT,
  data_desvio DATE NOT NULL,
  hora_desvio TIME,
  reportante_id TEXT,
  reportante_nome TEXT,
  reportante_anonimo BOOLEAN DEFAULT FALSE,
  descricao TEXT NOT NULL,
  causa_provavel TEXT,
  acao_imediata TEXT,
  acao_imediata_responsavel TEXT,
  acao_imediata_prazo DATE,
  foto_url TEXT,
  foto_nome TEXT,
  convertido_em_incidente_id TEXT,
  convertido_em TIMESTAMPTZ,
  gro_risco_id UUID,
  plano_acao_id UUID,
  criado_por TEXT,
  criado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.gerar_codigo_desvio()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(codigo FROM 'DVS-(\d+)') AS INTEGER)), 0) + 1
  INTO next_num FROM public.desvios_seguranca WHERE tenant_id = NEW.tenant_id;
  NEW.codigo := 'DVS-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER gerar_codigo_desvio_trigger
  BEFORE INSERT ON public.desvios_seguranca
  FOR EACH ROW EXECUTE FUNCTION public.gerar_codigo_desvio();

CREATE TRIGGER update_desvios_seguranca_updated_at
  BEFORE UPDATE ON public.desvios_seguranca
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.desvios_seguranca ENABLE ROW LEVEL SECURITY;

CREATE POLICY "desvios_select" ON public.desvios_seguranca
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "desvios_insert" ON public.desvios_seguranca
  FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "desvios_update" ON public.desvios_seguranca
  FOR UPDATE USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "desvios_delete" ON public.desvios_seguranca
  FOR DELETE USING (tenant_id = public.get_user_tenant_id());

CREATE INDEX idx_desvios_tenant ON public.desvios_seguranca (tenant_id);
CREATE INDEX idx_desvios_status ON public.desvios_seguranca (tenant_id, status);
CREATE INDEX idx_desvios_data ON public.desvios_seguranca (tenant_id, data_desvio);
