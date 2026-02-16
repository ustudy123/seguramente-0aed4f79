
-- ===========================================
-- Módulo: Cultura & Celebrações
-- ===========================================

-- 1. Datas configuráveis pela empresa
CREATE TABLE public.cultura_datas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'comemorativa', -- comemorativa, campanha, regional, interna
  recorrencia TEXT NOT NULL DEFAULT 'anual', -- anual, mensal, unica
  mes INTEGER, -- 1-12
  dia INTEGER, -- 1-31
  data_especifica DATE, -- para datas únicas
  ativo BOOLEAN NOT NULL DEFAULT true,
  filtro_unidade TEXT,
  filtro_setor TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Preferências do colaborador (como gosta de ser celebrado)
CREATE TABLE public.cultura_preferencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  colaborador_id TEXT NOT NULL,
  colaborador_nome TEXT NOT NULL,
  preferencia_aniversario TEXT DEFAULT 'indiferente', -- experiencia, presente, folga, indiferente
  tipo_reconhecimento TEXT DEFAULT 'tanto_faz', -- publico, reservado, tanto_faz
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, colaborador_id)
);

-- 3. Marcos de tempo de casa
CREATE TABLE public.cultura_marcos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  anos INTEGER NOT NULL, -- 1, 5, 10, 15, 20, 25, 30
  tipo_celebracao TEXT NOT NULL DEFAULT 'reconhecimento', -- reconhecimento, mimo, certificado, enfeite, publico
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Configuração geral do módulo
CREATE TABLE public.cultura_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) UNIQUE,
  aniversario_ativo BOOLEAN NOT NULL DEFAULT true,
  tempo_casa_ativo BOOLEAN NOT NULL DEFAULT true,
  dia_profissao_ativo BOOLEAN NOT NULL DEFAULT true,
  dias_antecedencia_acao INTEGER NOT NULL DEFAULT 7,
  presente_padrao BOOLEAN NOT NULL DEFAULT false,
  limite_valor_presente NUMERIC(10,2),
  folga_permitida BOOLEAN NOT NULL DEFAULT false,
  responsavel_padrao TEXT DEFAULT 'rh', -- rh, lider, cultura
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Ações culturais (celebrações planejadas/executadas)
CREATE TABLE public.cultura_acoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  tipo TEXT NOT NULL, -- aniversario, tempo_casa, dia_profissao, data_configurada, ritual
  titulo TEXT NOT NULL,
  descricao TEXT,
  colaborador_id TEXT,
  colaborador_nome TEXT,
  data_referencia DATE NOT NULL, -- data da celebração
  data_execucao DATE, -- data em que a ação deve ser executada
  responsavel TEXT,
  responsavel_nome TEXT,
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente, em_andamento, concluida, cancelada
  observacoes TEXT,
  cultura_data_id UUID REFERENCES public.cultura_datas(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Rituais culturais recorrentes
CREATE TABLE public.cultura_rituais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  nome TEXT NOT NULL,
  descricao TEXT,
  frequencia TEXT NOT NULL DEFAULT 'mensal', -- semanal, quinzenal, mensal, trimestral
  dia_semana INTEGER, -- 0-6 (domingo-sábado)
  dia_mes INTEGER, -- 1-31
  responsavel TEXT,
  responsavel_nome TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ultima_execucao DATE,
  proxima_execucao DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.cultura_datas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cultura_preferencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cultura_marcos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cultura_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cultura_acoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cultura_rituais ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tenant isolation" ON public.cultura_datas FOR ALL USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant isolation" ON public.cultura_preferencias FOR ALL USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant isolation" ON public.cultura_marcos FOR ALL USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant isolation" ON public.cultura_config FOR ALL USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant isolation" ON public.cultura_acoes FOR ALL USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant isolation" ON public.cultura_rituais FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- Triggers for updated_at
CREATE TRIGGER update_cultura_datas_updated_at BEFORE UPDATE ON public.cultura_datas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cultura_preferencias_updated_at BEFORE UPDATE ON public.cultura_preferencias FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cultura_marcos_updated_at BEFORE UPDATE ON public.cultura_marcos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cultura_config_updated_at BEFORE UPDATE ON public.cultura_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cultura_acoes_updated_at BEFORE UPDATE ON public.cultura_acoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cultura_rituais_updated_at BEFORE UPDATE ON public.cultura_rituais FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
