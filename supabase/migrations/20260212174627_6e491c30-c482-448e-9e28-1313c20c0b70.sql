
-- Enum types for marketplace
CREATE TYPE public.marketplace_profissional_status AS ENUM ('pendente', 'ativo', 'suspenso', 'bloqueado');
CREATE TYPE public.marketplace_servico_modalidade AS ENUM ('presencial', 'online', 'hibrido');
CREATE TYPE public.marketplace_contratacao_status AS ENUM ('solicitada', 'aceita', 'em_andamento', 'concluida', 'cancelada', 'recusada');
CREATE TYPE public.marketplace_plano_tipo AS ENUM ('base', 'profissional', 'parceiro');

-- 1. Categorias de serviço
CREATE TABLE public.marketplace_categorias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  icone TEXT,
  ordem INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.marketplace_categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active categories" ON public.marketplace_categorias FOR SELECT USING (ativo = true);

-- 2. Profissionais do marketplace
CREATE TABLE public.marketplace_profissionais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.tenants(id),
  nome_completo TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  cpf_cnpj TEXT,
  foto_url TEXT,
  bio TEXT,
  formacao_academica TEXT,
  registro_profissional TEXT NOT NULL,
  conselho TEXT NOT NULL,
  uf_registro TEXT,
  registro_validade DATE,
  certificacoes TEXT[],
  especialidades TEXT[],
  areas_atuacao TEXT[],
  modalidades_atendimento marketplace_servico_modalidade[] DEFAULT '{presencial}',
  cidade TEXT,
  estado TEXT,
  aceite_codigo_etica BOOLEAN DEFAULT false,
  aceite_codigo_etica_data TIMESTAMPTZ,
  status marketplace_profissional_status DEFAULT 'pendente',
  plano marketplace_plano_tipo DEFAULT 'base',
  selo_verificado BOOLEAN DEFAULT false,
  nota_media NUMERIC(3,2) DEFAULT 0,
  total_avaliacoes INTEGER DEFAULT 0,
  total_servicos_executados INTEGER DEFAULT 0,
  link_afiliado TEXT,
  codigo_afiliado TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.marketplace_profissionais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view active professionals" ON public.marketplace_profissionais FOR SELECT TO authenticated USING (status = 'ativo');
CREATE POLICY "Professionals manage own profile" ON public.marketplace_profissionais FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins manage all professionals" ON public.marketplace_profissionais FOR ALL TO authenticated USING (public.has_minimum_role(auth.uid(), 'admin'));

-- 3. Serviços ofertados
CREATE TABLE public.marketplace_servicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profissional_id UUID NOT NULL REFERENCES public.marketplace_profissionais(id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES public.marketplace_categorias(id),
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL,
  base_legal TEXT,
  modalidade marketplace_servico_modalidade NOT NULL DEFAULT 'presencial',
  publico_alvo TEXT,
  evidencia_minima TEXT,
  vinculo_tipo_acao TEXT,
  preco_referencia NUMERIC(10,2),
  duracao_estimada_minutos INTEGER,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.marketplace_servicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view active services" ON public.marketplace_servicos FOR SELECT TO authenticated USING (ativo = true);
CREATE POLICY "Professionals manage own services" ON public.marketplace_servicos FOR ALL TO authenticated USING (profissional_id IN (SELECT id FROM public.marketplace_profissionais WHERE user_id = auth.uid())) WITH CHECK (profissional_id IN (SELECT id FROM public.marketplace_profissionais WHERE user_id = auth.uid()));

-- 4. Contratações
CREATE TABLE public.marketplace_contratacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  servico_id UUID NOT NULL REFERENCES public.marketplace_servicos(id),
  profissional_id UUID NOT NULL REFERENCES public.marketplace_profissionais(id),
  solicitante_id UUID REFERENCES auth.users(id),
  solicitante_nome TEXT,
  acao_vinculada_id UUID REFERENCES public.plano_acoes(id),
  modalidade marketplace_servico_modalidade NOT NULL,
  data_agendamento DATE,
  hora_agendamento TIME,
  duracao_minutos INTEGER,
  status marketplace_contratacao_status DEFAULT 'solicitada',
  observacoes TEXT,
  valor NUMERIC(10,2),
  profissional_confirmou BOOLEAN DEFAULT false,
  data_conclusao TIMESTAMPTZ,
  termo_aceito BOOLEAN DEFAULT false,
  termo_aceito_data TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.marketplace_contratacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can view their contracts" ON public.marketplace_contratacoes FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant members can create contracts" ON public.marketplace_contratacoes FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant admins can update contracts" ON public.marketplace_contratacoes FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Professionals can view their contracts" ON public.marketplace_contratacoes FOR SELECT TO authenticated USING (profissional_id IN (SELECT id FROM public.marketplace_profissionais WHERE user_id = auth.uid()));
CREATE POLICY "Professionals can update their contracts" ON public.marketplace_contratacoes FOR UPDATE TO authenticated USING (profissional_id IN (SELECT id FROM public.marketplace_profissionais WHERE user_id = auth.uid()));

-- 5. Avaliações
CREATE TABLE public.marketplace_avaliacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contratacao_id UUID NOT NULL REFERENCES public.marketplace_contratacoes(id) ON DELETE CASCADE,
  profissional_id UUID NOT NULL REFERENCES public.marketplace_profissionais(id),
  servico_id UUID NOT NULL REFERENCES public.marketplace_servicos(id),
  avaliador_id UUID REFERENCES auth.users(id),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  pontualidade INTEGER CHECK (pontualidade BETWEEN 1 AND 5),
  clareza INTEGER CHECK (clareza BETWEEN 1 AND 5),
  aderencia_escopo INTEGER CHECK (aderencia_escopo BETWEEN 1 AND 5),
  profissionalismo INTEGER CHECK (profissionalismo BETWEEN 1 AND 5),
  nota_geral NUMERIC(3,2),
  comentario TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.marketplace_avaliacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can view reviews" ON public.marketplace_avaliacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Tenant members can create reviews" ON public.marketplace_avaliacoes FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id());

-- 6. Programa de afiliados
CREATE TABLE public.marketplace_afiliados_comissoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profissional_id UUID NOT NULL REFERENCES public.marketplace_profissionais(id),
  tenant_indicado_id UUID REFERENCES public.tenants(id),
  tipo TEXT DEFAULT 'indicacao',
  valor NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.marketplace_afiliados_comissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Professionals view own commissions" ON public.marketplace_afiliados_comissoes FOR SELECT TO authenticated USING (profissional_id IN (SELECT id FROM public.marketplace_profissionais WHERE user_id = auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_marketplace_profissionais_updated_at BEFORE UPDATE ON public.marketplace_profissionais FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_marketplace_servicos_updated_at BEFORE UPDATE ON public.marketplace_servicos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_marketplace_contratacoes_updated_at BEFORE UPDATE ON public.marketplace_contratacoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default categories
INSERT INTO public.marketplace_categorias (nome, descricao, icone, ordem) VALUES
  ('Segurança do Trabalho', 'Serviços de SST, laudos técnicos, PPRA, PCMSO', 'Shield', 1),
  ('Ergonomia', 'Análises ergonômicas, AEP, AET, laudos ergonômicos', 'Activity', 2),
  ('Saúde Ocupacional', 'Exames ocupacionais, ASO, medicina do trabalho', 'Stethoscope', 3),
  ('Saúde Mental', 'Psicologia organizacional, apoio psicossocial', 'Brain', 4),
  ('Fisioterapia', 'Ginástica laboral, reabilitação, fisioterapia preventiva', 'HeartPulse', 5),
  ('Treinamentos', 'NRs, capacitações obrigatórias, workshops', 'GraduationCap', 6),
  ('Jurídico Trabalhista', 'Consultoria jurídica, compliance trabalhista', 'Scale', 7),
  ('RH Estratégico', 'Consultoria em gestão de pessoas, clima organizacional', 'Users', 8);
