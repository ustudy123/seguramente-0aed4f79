-- Criar enum para status do EPI
CREATE TYPE epi_status AS ENUM ('disponivel', 'em_uso', 'danificado', 'vencido', 'descartado');

-- Criar enum para status da entrega
CREATE TYPE entrega_status AS ENUM ('ativa', 'devolvido', 'extraviado', 'vencido');

-- Tabela de tipos/categorias de EPI
CREATE TABLE public.epi_tipos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  validade_meses INTEGER, -- tempo de validade em meses, null se não tem validade
  obrigatorio_para_funcoes TEXT[], -- lista de funções que obrigam esse EPI
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de EPIs (itens individuais no estoque)
CREATE TABLE public.epis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tipo_id UUID NOT NULL REFERENCES public.epi_tipos(id) ON DELETE CASCADE,
  codigo TEXT, -- código/número de série do EPI
  ca TEXT, -- Certificado de Aprovação
  marca TEXT,
  modelo TEXT,
  tamanho TEXT,
  data_fabricacao DATE,
  data_validade DATE,
  quantidade_estoque INTEGER NOT NULL DEFAULT 0,
  quantidade_minima INTEGER NOT NULL DEFAULT 5, -- alerta de estoque baixo
  custo_unitario NUMERIC(10,2),
  localizacao TEXT, -- onde está armazenado
  observacoes TEXT,
  status epi_status NOT NULL DEFAULT 'disponivel',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de entregas de EPIs
CREATE TABLE public.epi_entregas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  epi_id UUID NOT NULL REFERENCES public.epis(id) ON DELETE CASCADE,
  colaborador_nome TEXT NOT NULL, -- nome do colaborador que recebeu
  colaborador_cpf TEXT, -- CPF para identificação
  colaborador_cargo TEXT,
  colaborador_departamento TEXT,
  quantidade INTEGER NOT NULL DEFAULT 1,
  data_entrega TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_devolucao_prevista DATE, -- quando deve devolver
  data_devolucao_efetiva TIMESTAMP WITH TIME ZONE, -- quando realmente devolveu
  motivo_entrega TEXT, -- motivo da entrega (admissão, reposição, etc)
  entregue_por UUID, -- quem fez a entrega
  entregue_por_nome TEXT,
  recebido_por_assinatura TEXT, -- pode ser base64 de assinatura digital
  observacoes TEXT,
  status entrega_status NOT NULL DEFAULT 'ativa',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de movimentações de estoque
CREATE TABLE public.epi_movimentacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  epi_id UUID NOT NULL REFERENCES public.epis(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- 'entrada', 'saida', 'ajuste', 'descarte'
  quantidade INTEGER NOT NULL,
  quantidade_anterior INTEGER NOT NULL,
  quantidade_atual INTEGER NOT NULL,
  motivo TEXT,
  documento_referencia TEXT, -- NF, ordem de compra, etc
  realizado_por UUID,
  realizado_por_nome TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.epi_tipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epi_entregas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epi_movimentacoes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para epi_tipos
CREATE POLICY "Usuários podem ver tipos de EPI do seu tenant"
  ON public.epi_tipos FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Managers+ podem gerenciar tipos de EPI"
  ON public.epi_tipos FOR ALL
  USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'))
  WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'));

-- Políticas RLS para epis
CREATE POLICY "Usuários podem ver EPIs do seu tenant"
  ON public.epis FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Managers+ podem gerenciar EPIs"
  ON public.epis FOR ALL
  USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'))
  WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'));

-- Políticas RLS para epi_entregas
CREATE POLICY "Usuários podem ver entregas de EPI do seu tenant"
  ON public.epi_entregas FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Managers+ podem gerenciar entregas de EPI"
  ON public.epi_entregas FOR ALL
  USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'))
  WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'));

-- Políticas RLS para epi_movimentacoes
CREATE POLICY "Usuários podem ver movimentações de EPI do seu tenant"
  ON public.epi_movimentacoes FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Managers+ podem inserir movimentações de EPI"
  ON public.epi_movimentacoes FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'));

-- Triggers para updated_at
CREATE TRIGGER update_epi_tipos_updated_at
  BEFORE UPDATE ON public.epi_tipos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_epis_updated_at
  BEFORE UPDATE ON public.epis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_epi_entregas_updated_at
  BEFORE UPDATE ON public.epi_entregas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função para atualizar estoque automaticamente ao registrar entrega
CREATE OR REPLACE FUNCTION public.atualizar_estoque_epi()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Reduzir estoque na entrega
    UPDATE public.epis 
    SET quantidade_estoque = quantidade_estoque - NEW.quantidade
    WHERE id = NEW.epi_id;
    
    -- Registrar movimentação
    INSERT INTO public.epi_movimentacoes (
      tenant_id, epi_id, tipo, quantidade, 
      quantidade_anterior, quantidade_atual, 
      motivo, realizado_por, realizado_por_nome
    )
    SELECT 
      NEW.tenant_id, NEW.epi_id, 'saida', NEW.quantidade,
      quantidade_estoque + NEW.quantidade, quantidade_estoque,
      'Entrega para ' || NEW.colaborador_nome, NEW.entregue_por, NEW.entregue_por_nome
    FROM public.epis WHERE id = NEW.epi_id;
    
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'devolvido' AND OLD.status = 'ativa' THEN
    -- Aumentar estoque na devolução
    UPDATE public.epis 
    SET quantidade_estoque = quantidade_estoque + NEW.quantidade
    WHERE id = NEW.epi_id;
    
    -- Registrar movimentação
    INSERT INTO public.epi_movimentacoes (
      tenant_id, epi_id, tipo, quantidade, 
      quantidade_anterior, quantidade_atual, 
      motivo
    )
    SELECT 
      NEW.tenant_id, NEW.epi_id, 'entrada', NEW.quantidade,
      quantidade_estoque - NEW.quantidade, quantidade_estoque,
      'Devolução de ' || NEW.colaborador_nome
    FROM public.epis WHERE id = NEW.epi_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_atualizar_estoque_epi
  AFTER INSERT OR UPDATE ON public.epi_entregas
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_estoque_epi();