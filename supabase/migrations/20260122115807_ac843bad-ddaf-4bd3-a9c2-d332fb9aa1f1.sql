-- =====================================================
-- SISTEMA DE PONTO ELETRÔNICO - CONFORMIDADE TOTAL
-- =====================================================

-- Tabela principal de marcações de ponto
-- IMPORTANTE: Registros NÃO podem ser deletados (apenas soft delete via status)
CREATE TABLE public.ponto_marcacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  colaborador_id UUID NOT NULL, -- ID da admissão/colaborador
  colaborador_nome TEXT NOT NULL, -- Nome denormalizado para histórico
  colaborador_cpf TEXT NOT NULL, -- CPF denormalizado para rastreabilidade
  
  -- Dados da marcação
  data_marcacao DATE NOT NULL DEFAULT CURRENT_DATE,
  hora_marcacao TIME NOT NULL DEFAULT CURRENT_TIME,
  tipo_marcacao TEXT NOT NULL CHECK (tipo_marcacao IN ('entrada', 'saida_almoco', 'retorno_almoco', 'saida')),
  
  -- Metadados de segurança
  ip_origem TEXT,
  user_agent TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  dispositivo TEXT,
  
  -- Controle de integridade
  hash_marcacao TEXT NOT NULL, -- Hash SHA256 para garantir integridade
  marcacao_original BOOLEAN NOT NULL DEFAULT true, -- Se é marcação original ou ajuste
  
  -- Auditoria
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Índices compostos para consultas frequentes
  CONSTRAINT unique_marcacao UNIQUE (tenant_id, colaborador_cpf, data_marcacao, tipo_marcacao)
);

-- Tabela de consolidação diária (calculada a partir das marcações)
CREATE TABLE public.ponto_diario (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  colaborador_id UUID NOT NULL,
  colaborador_nome TEXT NOT NULL,
  colaborador_cpf TEXT NOT NULL,
  data DATE NOT NULL,
  
  -- Horários consolidados
  entrada TIME,
  saida_almoco TIME,
  retorno_almoco TIME,
  saida TIME,
  
  -- Cálculos
  horas_trabalhadas INTERVAL,
  horas_extras INTERVAL,
  horas_faltantes INTERVAL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'regular', 'atraso', 'falta', 'incompleto', 'ajuste_pendente', 'justificado')),
  observacao TEXT,
  
  -- Controle
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_ponto_diario UNIQUE (tenant_id, colaborador_cpf, data)
);

-- Tabela de solicitações de ajuste (não altera marcação original)
CREATE TABLE public.ponto_ajustes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ponto_diario_id UUID REFERENCES public.ponto_diario(id),
  colaborador_id UUID NOT NULL,
  colaborador_nome TEXT NOT NULL,
  colaborador_cpf TEXT NOT NULL,
  data_referencia DATE NOT NULL,
  
  -- Tipo de ajuste
  tipo_ajuste TEXT NOT NULL CHECK (tipo_ajuste IN ('inclusao', 'correcao', 'justificativa', 'abono')),
  tipo_marcacao TEXT CHECK (tipo_marcacao IN ('entrada', 'saida_almoco', 'retorno_almoco', 'saida')),
  
  -- Valores
  hora_original TIME,
  hora_solicitada TIME,
  motivo TEXT NOT NULL,
  
  -- Aprovação
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  aprovado_por UUID,
  aprovado_por_nome TEXT,
  data_aprovacao TIMESTAMP WITH TIME ZONE,
  observacao_aprovador TEXT,
  
  -- Auditoria
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  created_by_nome TEXT
);

-- Tabela de auditoria (log imutável de todas as ações)
CREATE TABLE public.ponto_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Referências
  tabela_origem TEXT NOT NULL,
  registro_id UUID NOT NULL,
  
  -- Ação
  acao TEXT NOT NULL CHECK (acao IN ('INSERT', 'UPDATE', 'AJUSTE', 'APROVACAO', 'REJEICAO', 'TENTATIVA_DELETE')),
  
  -- Dados
  dados_anteriores JSONB,
  dados_novos JSONB,
  
  -- Usuário
  usuario_id UUID,
  usuario_nome TEXT,
  usuario_email TEXT,
  
  -- Metadados
  ip_origem TEXT,
  user_agent TEXT,
  
  -- Timestamp imutável
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de configuração de jornada
CREATE TABLE public.ponto_configuracao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  
  -- Jornada padrão
  hora_entrada_padrao TIME NOT NULL DEFAULT '08:00',
  hora_saida_almoco_padrao TIME NOT NULL DEFAULT '12:00',
  hora_retorno_almoco_padrao TIME NOT NULL DEFAULT '13:00',
  hora_saida_padrao TIME NOT NULL DEFAULT '17:00',
  
  -- Tolerâncias (em minutos)
  tolerancia_atraso INTEGER NOT NULL DEFAULT 10,
  tolerancia_hora_extra INTEGER NOT NULL DEFAULT 10,
  
  -- Configurações
  permitir_registro_fora_horario BOOLEAN NOT NULL DEFAULT true,
  exigir_localizacao BOOLEAN NOT NULL DEFAULT false,
  bloquear_dispositivo_nao_autorizado BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================
CREATE INDEX idx_ponto_marcacoes_tenant_data ON public.ponto_marcacoes(tenant_id, data_marcacao);
CREATE INDEX idx_ponto_marcacoes_colaborador ON public.ponto_marcacoes(colaborador_cpf, data_marcacao);
CREATE INDEX idx_ponto_diario_tenant_data ON public.ponto_diario(tenant_id, data);
CREATE INDEX idx_ponto_ajustes_status ON public.ponto_ajustes(tenant_id, status);
CREATE INDEX idx_ponto_audit_log_registro ON public.ponto_audit_log(tabela_origem, registro_id);

-- =====================================================
-- HABILITAR RLS
-- =====================================================
ALTER TABLE public.ponto_marcacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ponto_diario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ponto_ajustes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ponto_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ponto_configuracao ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS RLS - MARCAÇÕES (SEM DELETE!)
-- =====================================================
CREATE POLICY "Usuários podem ver marcações do seu tenant"
ON public.ponto_marcacoes FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Usuários autenticados podem registrar ponto"
ON public.ponto_marcacoes FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id());

-- SEM POLÍTICA DE UPDATE PARA MARCAÇÕES (imutáveis)
-- SEM POLÍTICA DE DELETE PARA MARCAÇÕES (imutáveis)

-- =====================================================
-- POLÍTICAS RLS - PONTO DIÁRIO
-- =====================================================
CREATE POLICY "Usuários podem ver ponto diário do seu tenant"
ON public.ponto_diario FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Sistema pode inserir ponto diário"
ON public.ponto_diario FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Managers+ podem atualizar ponto diário"
ON public.ponto_diario FOR UPDATE
USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role));

-- SEM DELETE

-- =====================================================
-- POLÍTICAS RLS - AJUSTES
-- =====================================================
CREATE POLICY "Usuários podem ver ajustes do seu tenant"
ON public.ponto_ajustes FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Usuários podem solicitar ajustes"
ON public.ponto_ajustes FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Managers+ podem aprovar ajustes"
ON public.ponto_ajustes FOR UPDATE
USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role));

-- SEM DELETE

-- =====================================================
-- POLÍTICAS RLS - AUDIT LOG (SOMENTE LEITURA)
-- =====================================================
CREATE POLICY "Admins+ podem ver audit log"
ON public.ponto_audit_log FOR SELECT
USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sistema pode inserir audit log"
ON public.ponto_audit_log FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id());

-- SEM UPDATE OU DELETE NO AUDIT LOG

-- =====================================================
-- POLÍTICAS RLS - CONFIGURAÇÃO
-- =====================================================
CREATE POLICY "Usuários podem ver configuração do seu tenant"
ON public.ponto_configuracao FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins+ podem gerenciar configuração"
ON public.ponto_configuracao FOR ALL
USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'admin'::app_role))
WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- TRIGGERS PARA AUDITORIA E INTEGRIDADE
-- =====================================================

-- Trigger de updated_at para ponto_diario
CREATE TRIGGER update_ponto_diario_updated_at
BEFORE UPDATE ON public.ponto_diario
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger de updated_at para ponto_configuracao
CREATE TRIGGER update_ponto_configuracao_updated_at
BEFORE UPDATE ON public.ponto_configuracao
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para gerar hash de integridade da marcação
CREATE OR REPLACE FUNCTION public.gerar_hash_marcacao()
RETURNS TRIGGER AS $$
BEGIN
  NEW.hash_marcacao := encode(
    sha256(
      (NEW.colaborador_cpf || NEW.data_marcacao::text || NEW.hora_marcacao::text || NEW.tipo_marcacao || NEW.created_at::text)::bytea
    ),
    'hex'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_gerar_hash_marcacao
BEFORE INSERT ON public.ponto_marcacoes
FOR EACH ROW
EXECUTE FUNCTION public.gerar_hash_marcacao();

-- Função para registrar tentativas de delete (bloqueadas)
CREATE OR REPLACE FUNCTION public.bloquear_delete_ponto()
RETURNS TRIGGER AS $$
BEGIN
  -- Registrar tentativa no audit log
  INSERT INTO public.ponto_audit_log (
    tenant_id, tabela_origem, registro_id, acao, 
    dados_anteriores, usuario_id
  ) VALUES (
    OLD.tenant_id, TG_TABLE_NAME, OLD.id, 'TENTATIVA_DELETE',
    to_jsonb(OLD), auth.uid()
  );
  
  -- Bloquear a operação
  RAISE EXCEPTION 'Operação de exclusão não permitida para registros de ponto. Tentativa registrada.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_bloquear_delete_marcacoes
BEFORE DELETE ON public.ponto_marcacoes
FOR EACH ROW
EXECUTE FUNCTION public.bloquear_delete_ponto();

CREATE TRIGGER trigger_bloquear_delete_ponto_diario
BEFORE DELETE ON public.ponto_diario
FOR EACH ROW
EXECUTE FUNCTION public.bloquear_delete_ponto();

CREATE TRIGGER trigger_bloquear_delete_ajustes
BEFORE DELETE ON public.ponto_ajustes
FOR EACH ROW
EXECUTE FUNCTION public.bloquear_delete_ponto();

-- Função para registrar auditoria em marcações
CREATE OR REPLACE FUNCTION public.audit_ponto_marcacoes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.ponto_audit_log (
    tenant_id, tabela_origem, registro_id, acao,
    dados_anteriores, dados_novos, usuario_id
  ) VALUES (
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    'ponto_marcacoes',
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    auth.uid()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_audit_marcacoes
AFTER INSERT ON public.ponto_marcacoes
FOR EACH ROW
EXECUTE FUNCTION public.audit_ponto_marcacoes();

-- Função para consolidar ponto diário após marcação
CREATE OR REPLACE FUNCTION public.consolidar_ponto_diario()
RETURNS TRIGGER AS $$
DECLARE
  v_entrada TIME;
  v_saida_almoco TIME;
  v_retorno_almoco TIME;
  v_saida TIME;
  v_horas_trabalhadas INTERVAL;
  v_status TEXT;
BEGIN
  -- Buscar todas as marcações do dia
  SELECT 
    MAX(CASE WHEN tipo_marcacao = 'entrada' THEN hora_marcacao END),
    MAX(CASE WHEN tipo_marcacao = 'saida_almoco' THEN hora_marcacao END),
    MAX(CASE WHEN tipo_marcacao = 'retorno_almoco' THEN hora_marcacao END),
    MAX(CASE WHEN tipo_marcacao = 'saida' THEN hora_marcacao END)
  INTO v_entrada, v_saida_almoco, v_retorno_almoco, v_saida
  FROM public.ponto_marcacoes
  WHERE tenant_id = NEW.tenant_id
    AND colaborador_cpf = NEW.colaborador_cpf
    AND data_marcacao = NEW.data_marcacao;

  -- Calcular horas trabalhadas
  IF v_entrada IS NOT NULL AND v_saida IS NOT NULL THEN
    v_horas_trabalhadas := (v_saida - v_entrada);
    IF v_saida_almoco IS NOT NULL AND v_retorno_almoco IS NOT NULL THEN
      v_horas_trabalhadas := v_horas_trabalhadas - (v_retorno_almoco - v_saida_almoco);
    END IF;
  ELSE
    v_horas_trabalhadas := INTERVAL '0';
  END IF;

  -- Determinar status
  IF v_entrada IS NULL THEN
    v_status := 'falta';
  ELSIF v_saida IS NULL THEN
    v_status := 'incompleto';
  ELSIF v_entrada > '08:10'::TIME THEN
    v_status := 'atraso';
  ELSE
    v_status := 'regular';
  END IF;

  -- Upsert no ponto diário
  INSERT INTO public.ponto_diario (
    tenant_id, colaborador_id, colaborador_nome, colaborador_cpf, data,
    entrada, saida_almoco, retorno_almoco, saida,
    horas_trabalhadas, status
  ) VALUES (
    NEW.tenant_id, NEW.colaborador_id, NEW.colaborador_nome, NEW.colaborador_cpf, NEW.data_marcacao,
    v_entrada, v_saida_almoco, v_retorno_almoco, v_saida,
    v_horas_trabalhadas, v_status
  )
  ON CONFLICT (tenant_id, colaborador_cpf, data)
  DO UPDATE SET
    entrada = v_entrada,
    saida_almoco = v_saida_almoco,
    retorno_almoco = v_retorno_almoco,
    saida = v_saida,
    horas_trabalhadas = v_horas_trabalhadas,
    status = CASE 
      WHEN public.ponto_diario.status = 'justificado' THEN 'justificado'
      ELSE v_status 
    END,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_consolidar_ponto
AFTER INSERT ON public.ponto_marcacoes
FOR EACH ROW
EXECUTE FUNCTION public.consolidar_ponto_diario();