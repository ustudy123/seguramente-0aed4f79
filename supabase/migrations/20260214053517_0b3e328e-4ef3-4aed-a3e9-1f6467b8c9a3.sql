
-- Enums for incident/accident module
CREATE TYPE public.evento_sst_tipo AS ENUM ('incidente', 'acidente');
CREATE TYPE public.evento_sst_status AS ENUM ('em_aberto', 'em_analise', 'acoes_andamento', 'concluido');
CREATE TYPE public.acidente_gravidade_lesao AS ENUM ('sem_lesao', 'leve', 'moderada', 'grave');
CREATE TYPE public.acidente_afastamento AS ENUM ('sem_afastamento', 'ate_15_dias', 'mais_15_dias');
CREATE TYPE public.acidente_atendimento AS ENUM ('nao_necessario', 'ambulatorial', 'hospitalar');
CREATE TYPE public.cat_tipo AS ENUM ('inicial', 'reabertura', 'comunicacao_obito');

-- Main events table
CREATE TABLE public.eventos_sst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  codigo TEXT,
  tipo evento_sst_tipo NOT NULL,
  status evento_sst_status NOT NULL DEFAULT 'em_aberto',
  data_evento DATE NOT NULL,
  hora_evento TIME,
  unidade TEXT,
  setor TEXT,
  local_especifico TEXT,
  turno TEXT,

  -- Involved
  colaborador_id TEXT,
  colaborador_nome TEXT,
  colaborador_funcao TEXT,
  colaborador_tempo_empresa TEXT,
  outros_envolvidos TEXT,

  -- Category/nature
  categoria_principal TEXT,
  origem_predominante TEXT,

  -- Description
  descricao TEXT,
  percepcao_causa TEXT,

  -- Accident-specific fields
  gravidade_lesao acidente_gravidade_lesao,
  afastamento acidente_afastamento,
  obito BOOLEAN DEFAULT false,
  atendimento acidente_atendimento,

  -- CAT fields
  cat_emitida BOOLEAN DEFAULT false,
  cat_numero TEXT,
  cat_data_emissao DATE,
  cat_tipo cat_tipo,
  cat_arquivo_url TEXT,
  cat_arquivo_nome TEXT,
  cat_observacoes TEXT,

  -- Ergonomic/psychosocial factors (stored as array)
  fatores_ergonomicos TEXT[] DEFAULT '{}',

  -- Metadata
  criado_por TEXT,
  criado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-generate code
CREATE OR REPLACE FUNCTION public.gerar_codigo_evento_sst()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(codigo FROM 'EVT-(\d+)') AS INTEGER)), 0) + 1
  INTO next_num FROM public.eventos_sst WHERE tenant_id = NEW.tenant_id;
  NEW.codigo := 'EVT-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_codigo_evento_sst
BEFORE INSERT ON public.eventos_sst
FOR EACH ROW EXECUTE FUNCTION public.gerar_codigo_evento_sst();

-- Updated_at trigger
CREATE TRIGGER update_eventos_sst_updated_at
BEFORE UPDATE ON public.eventos_sst
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Attachments table
CREATE TABLE public.evento_sst_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  evento_id UUID NOT NULL REFERENCES public.eventos_sst(id) ON DELETE CASCADE,
  arquivo_url TEXT NOT NULL,
  arquivo_nome TEXT NOT NULL,
  arquivo_tamanho BIGINT,
  tipo TEXT, -- 'foto', 'video', 'relatorio', 'cat', 'outro'
  criado_por TEXT,
  criado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Linked actions table (link to plano_acoes)
CREATE TABLE public.evento_sst_acoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  evento_id UUID NOT NULL REFERENCES public.eventos_sst(id) ON DELETE CASCADE,
  acao_id UUID NOT NULL REFERENCES public.plano_acoes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.eventos_sst ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evento_sst_anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evento_sst_acoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.eventos_sst
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant isolation" ON public.evento_sst_anexos
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant isolation" ON public.evento_sst_acoes
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- Storage bucket for SST event attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('eventos-sst', 'eventos-sst', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Auth users can upload evento sst files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'eventos-sst');

CREATE POLICY "Auth users can view evento sst files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'eventos-sst');

CREATE POLICY "Auth users can delete evento sst files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'eventos-sst');
