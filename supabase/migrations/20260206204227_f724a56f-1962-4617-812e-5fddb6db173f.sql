-- Enums para o questionário psicossocial
CREATE TYPE public.campanha_psicossocial_status AS ENUM ('rascunho', 'ativa', 'encerrada');
CREATE TYPE public.convite_psicossocial_status AS ENUM ('pendente', 'iniciado', 'concluido', 'expirado');
CREATE TYPE public.convite_enviado_via AS ENUM ('link', 'qrcode', 'whatsapp', 'email');

-- Tabela de campanhas do questionário psicossocial
CREATE TABLE public.questionario_psicossocial_campanhas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  status public.campanha_psicossocial_status NOT NULL DEFAULT 'rascunho',
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  anonimo BOOLEAN NOT NULL DEFAULT true,
  departamentos_ids UUID[] DEFAULT NULL,
  cargos_ids UUID[] DEFAULT NULL,
  blocos_dinamicos JSONB DEFAULT '[]'::jsonb,
  criado_por UUID,
  criado_por_nome TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de convites para o questionário
CREATE TABLE public.questionario_psicossocial_convites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campanha_id UUID NOT NULL REFERENCES public.questionario_psicossocial_campanhas(id) ON DELETE CASCADE,
  colaborador_id UUID,
  colaborador_nome TEXT NOT NULL,
  colaborador_cpf TEXT,
  colaborador_cargo TEXT,
  colaborador_departamento TEXT,
  token TEXT NOT NULL UNIQUE,
  status public.convite_psicossocial_status NOT NULL DEFAULT 'pendente',
  enviado_via public.convite_enviado_via DEFAULT 'link',
  enviado_em TIMESTAMP WITH TIME ZONE,
  iniciado_em TIMESTAMP WITH TIME ZONE,
  concluido_em TIMESTAMP WITH TIME ZONE,
  lembrete_enviado BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de respostas do questionário
CREATE TABLE public.questionario_psicossocial_respostas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campanha_id UUID NOT NULL REFERENCES public.questionario_psicossocial_campanhas(id) ON DELETE CASCADE,
  convite_id UUID NOT NULL REFERENCES public.questionario_psicossocial_convites(id) ON DELETE CASCADE,
  colaborador_id UUID,
  respostas JSONB NOT NULL DEFAULT '{}'::jsonb,
  indicadores JSONB DEFAULT NULL,
  tempo_resposta_segundos INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  concluido_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_psicossocial_campanhas_tenant ON public.questionario_psicossocial_campanhas(tenant_id);
CREATE INDEX idx_psicossocial_campanhas_status ON public.questionario_psicossocial_campanhas(status);
CREATE INDEX idx_psicossocial_convites_tenant ON public.questionario_psicossocial_convites(tenant_id);
CREATE INDEX idx_psicossocial_convites_campanha ON public.questionario_psicossocial_convites(campanha_id);
CREATE INDEX idx_psicossocial_convites_token ON public.questionario_psicossocial_convites(token);
CREATE INDEX idx_psicossocial_respostas_tenant ON public.questionario_psicossocial_respostas(tenant_id);
CREATE INDEX idx_psicossocial_respostas_campanha ON public.questionario_psicossocial_respostas(campanha_id);

-- Habilitar RLS
ALTER TABLE public.questionario_psicossocial_campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionario_psicossocial_convites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionario_psicossocial_respostas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para campanhas
CREATE POLICY "Usuários podem ver campanhas do seu tenant"
  ON public.questionario_psicossocial_campanhas
  FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Managers+ podem gerenciar campanhas"
  ON public.questionario_psicossocial_campanhas
  FOR ALL
  USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role));

-- Políticas RLS para convites
CREATE POLICY "Usuários podem ver convites do seu tenant"
  ON public.questionario_psicossocial_convites
  FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Managers+ podem gerenciar convites"
  ON public.questionario_psicossocial_convites
  FOR ALL
  USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role));

-- Política especial para acesso público via token (para responder questionário)
CREATE POLICY "Acesso público via token para atualizar convite"
  ON public.questionario_psicossocial_convites
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Políticas RLS para respostas
CREATE POLICY "Usuários podem ver respostas do seu tenant"
  ON public.questionario_psicossocial_respostas
  FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Managers+ podem gerenciar respostas"
  ON public.questionario_psicossocial_respostas
  FOR ALL
  USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role));

-- Política especial para inserção pública de respostas (via token)
CREATE POLICY "Acesso público para inserir respostas via token"
  ON public.questionario_psicossocial_respostas
  FOR INSERT
  WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_psicossocial_campanhas_updated_at
  BEFORE UPDATE ON public.questionario_psicossocial_campanhas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_psicossocial_convites_updated_at
  BEFORE UPDATE ON public.questionario_psicossocial_convites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();