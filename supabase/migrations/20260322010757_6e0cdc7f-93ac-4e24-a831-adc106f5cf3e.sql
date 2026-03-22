-- =============================================
-- HUB CONTÁBIL V2 — Schema Completo
-- Hub de Comunicação Contábil e Documental
-- =============================================

CREATE TYPE public.hub_processo_tipo AS ENUM (
  'admissao', 'demissao', 'ferias', 'advertencia', 'atestado_afastamento',
  'ponto_folha', 'eventos_variaveis', 'solicitacao_geral', 'alteracao_contratual',
  'mudanca_salarial', 'cat', 'ppp_ltcat', 'pro_labore'
);

CREATE TYPE public.hub_processo_status AS ENUM (
  'rascunho', 'aguardando_documentos', 'pronto_para_envio', 'enviado_contabilidade',
  'recebido_contabilidade', 'em_analise', 'pendente_complementacao', 'processado',
  'documentos_devolvidos', 'aguardando_assinatura', 'assinado_parcialmente',
  'concluido', 'cancelado', 'erro_integracao'
);

CREATE TYPE public.hub_doc_tipo AS ENUM (
  'ficha_registro', 'contrato', 'aditivo', 'aviso_ferias', 'recibo_ferias',
  'advertencia', 'aviso_previo', 'trct', 'rescisao', 'espelho_ponto',
  'relatorio_folha', 'holerite', 'guia', 'comprovante', 'aso', 'documento_pessoal',
  'certidao', 'procuracao', 'declaracao', 'laudo', 'outros'
);

CREATE TYPE public.hub_doc_origem AS ENUM (
  'sistema_automatico', 'upload_rh', 'devolutiva_contabilidade', 'assinatura_concluida'
);

CREATE TYPE public.hub_assinatura_status AS ENUM (
  'pendente', 'enviado', 'assinado', 'recusado', 'expirado'
);

CREATE TYPE public.hub_prioridade AS ENUM (
  'baixa', 'normal', 'alta', 'urgente'
);

-- Contabilidades parceiras
CREATE TABLE public.hub_contabilidades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cnpj TEXT,
  email_principal TEXT,
  email_notificacoes TEXT,
  telefone TEXT,
  responsavel_nome TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hub_contabilidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_hub_contabilidades" ON public.hub_contabilidades
  USING (tenant_id = public.get_user_tenant_id());

-- Dossiê central de cada processo
CREATE TABLE public.hub_processos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresa_cadastro(id),
  contabilidade_id UUID REFERENCES public.hub_contabilidades(id),
  codigo TEXT NOT NULL DEFAULT '',
  tipo public.hub_processo_tipo NOT NULL,
  status public.hub_processo_status NOT NULL DEFAULT 'rascunho',
  prioridade public.hub_prioridade NOT NULL DEFAULT 'normal',
  titulo TEXT NOT NULL,
  descricao TEXT,
  colaborador_id TEXT,
  colaborador_nome TEXT,
  colaborador_cpf TEXT,
  colaborador_matricula TEXT,
  competencia TEXT,
  data_referencia DATE,
  data_limite DATE,
  origem_modulo TEXT,
  origem_registro_id TEXT,
  origem_descricao TEXT,
  gerado_automaticamente BOOLEAN NOT NULL DEFAULT false,
  enviado_em TIMESTAMPTZ,
  enviado_por TEXT,
  recebido_em TIMESTAMPTZ,
  processado_em TIMESTAMPTZ,
  concluido_em TIMESTAMPTZ,
  cancelado_em TIMESTAMPTZ,
  cancelado_por TEXT,
  motivo_cancelamento TEXT,
  sla_horas INTEGER,
  sla_vencimento TIMESTAMPTZ,
  sla_status TEXT DEFAULT 'ok',
  observacoes_internas TEXT,
  protocolo_externo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hub_processos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_hub_processos" ON public.hub_processos
  USING (tenant_id = public.get_user_tenant_id());

CREATE INDEX idx_hub_processos_tenant ON public.hub_processos(tenant_id);
CREATE INDEX idx_hub_processos_tipo ON public.hub_processos(tipo);
CREATE INDEX idx_hub_processos_status ON public.hub_processos(status);
CREATE INDEX idx_hub_processos_colaborador ON public.hub_processos(colaborador_cpf);
CREATE INDEX idx_hub_processos_competencia ON public.hub_processos(competencia);

-- Documentos vinculados ao dossiê
CREATE TABLE public.hub_processo_documentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  processo_id UUID NOT NULL REFERENCES public.hub_processos(id) ON DELETE CASCADE,
  tipo public.hub_doc_tipo NOT NULL DEFAULT 'outros',
  nome TEXT NOT NULL,
  descricao TEXT,
  origem public.hub_doc_origem NOT NULL DEFAULT 'upload_rh',
  arquivo_url TEXT,
  arquivo_nome TEXT,
  arquivo_tamanho INTEGER,
  arquivo_mime TEXT,
  versao INTEGER NOT NULL DEFAULT 1,
  versao_anterior_id UUID REFERENCES public.hub_processo_documentos(id),
  eh_versao_final BOOLEAN NOT NULL DEFAULT false,
  eh_obrigatorio BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pendente',
  requer_assinatura BOOLEAN NOT NULL DEFAULT false,
  assinatura_status public.hub_assinatura_status,
  enviado_por TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hub_processo_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_hub_processo_documentos" ON public.hub_processo_documentos
  USING (tenant_id = public.get_user_tenant_id());

CREATE INDEX idx_hub_doc_processo ON public.hub_processo_documentos(processo_id);

-- Checklist dinâmico por processo
CREATE TABLE public.hub_processo_checklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  processo_id UUID NOT NULL REFERENCES public.hub_processos(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  descricao TEXT,
  obrigatorio BOOLEAN NOT NULL DEFAULT true,
  concluido BOOLEAN NOT NULL DEFAULT false,
  concluido_em TIMESTAMPTZ,
  concluido_por TEXT,
  preenchido_automaticamente BOOLEAN NOT NULL DEFAULT false,
  justificativa_excecao TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hub_processo_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_hub_processo_checklist" ON public.hub_processo_checklist
  USING (tenant_id = public.get_user_tenant_id());

-- Assinaturas por documento
CREATE TABLE public.hub_processo_assinaturas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  processo_id UUID NOT NULL REFERENCES public.hub_processos(id) ON DELETE CASCADE,
  documento_id UUID REFERENCES public.hub_processo_documentos(id),
  signatario_nome TEXT NOT NULL,
  signatario_email TEXT,
  signatario_cpf TEXT,
  signatario_papel TEXT NOT NULL DEFAULT 'colaborador',
  ordem INTEGER NOT NULL DEFAULT 1,
  token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  link_assinatura TEXT,
  expira_em TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days'),
  status public.hub_assinatura_status NOT NULL DEFAULT 'pendente',
  assinado_em TIMESTAMPTZ,
  recusado_em TIMESTAMPTZ,
  motivo_recusa TEXT,
  ip_assinatura TEXT,
  hash_documento TEXT,
  imagem_assinatura_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hub_processo_assinaturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_hub_processo_assinaturas" ON public.hub_processo_assinaturas
  USING (tenant_id = public.get_user_tenant_id());

-- Comentários e comunicação contextual
CREATE TABLE public.hub_processo_comentarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  processo_id UUID NOT NULL REFERENCES public.hub_processos(id) ON DELETE CASCADE,
  autor_nome TEXT NOT NULL,
  autor_perfil TEXT NOT NULL DEFAULT 'rh',
  conteudo TEXT NOT NULL,
  eh_interno BOOLEAN NOT NULL DEFAULT true,
  eh_pendencia BOOLEAN NOT NULL DEFAULT false,
  pendencia_resolvida BOOLEAN NOT NULL DEFAULT false,
  pendencia_resolvida_em TIMESTAMPTZ,
  arquivo_url TEXT,
  arquivo_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hub_processo_comentarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_hub_processo_comentarios" ON public.hub_processo_comentarios
  USING (tenant_id = public.get_user_tenant_id());

-- Trilha de auditoria completa
CREATE TABLE public.hub_processo_historico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  processo_id UUID NOT NULL REFERENCES public.hub_processos(id) ON DELETE CASCADE,
  acao TEXT NOT NULL,
  status_anterior public.hub_processo_status,
  status_novo public.hub_processo_status,
  usuario_id TEXT,
  usuario_nome TEXT,
  perfil TEXT,
  descricao TEXT,
  dados_extras JSONB,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hub_processo_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_hub_processo_historico" ON public.hub_processo_historico
  USING (tenant_id = public.get_user_tenant_id());

CREATE INDEX idx_hub_historico_processo ON public.hub_processo_historico(processo_id);

-- Configurações por empresa/tenant
CREATE TABLE public.hub_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresa_cadastro(id),
  modulo_ativo BOOLEAN NOT NULL DEFAULT true,
  contabilidade_id UUID REFERENCES public.hub_contabilidades(id),
  sla_admissao INTEGER DEFAULT 48,
  sla_demissao INTEGER DEFAULT 72,
  sla_ferias INTEGER DEFAULT 24,
  sla_advertencia INTEGER DEFAULT 24,
  sla_folha INTEGER DEFAULT 48,
  sla_geral INTEGER DEFAULT 72,
  auto_gerar_admissao BOOLEAN NOT NULL DEFAULT true,
  auto_gerar_demissao BOOLEAN NOT NULL DEFAULT true,
  auto_gerar_ferias BOOLEAN NOT NULL DEFAULT true,
  auto_gerar_advertencia BOOLEAN NOT NULL DEFAULT true,
  auto_gerar_atestado BOOLEAN NOT NULL DEFAULT false,
  auto_gerar_folha BOOLEAN NOT NULL DEFAULT false,
  notificar_email BOOLEAN NOT NULL DEFAULT true,
  notificar_sistema BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, empresa_id)
);

ALTER TABLE public.hub_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_hub_config" ON public.hub_config
  USING (tenant_id = public.get_user_tenant_id());

-- Catálogo de tipos documentais
CREATE TABLE public.hub_catalogo_documentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  codigo TEXT,
  processo_tipo public.hub_processo_tipo,
  obrigatoriedade TEXT NOT NULL DEFAULT 'obrigatorio',
  requer_assinatura BOOLEAN NOT NULL DEFAULT false,
  prazo_retencao_anos INTEGER,
  visibilidade_perfis TEXT[] DEFAULT ARRAY['rh', 'admin'],
  template_url TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hub_catalogo_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_hub_catalogo_documentos" ON public.hub_catalogo_documentos
  USING (tenant_id = public.get_user_tenant_id());

-- Função para gerar código sequencial
CREATE OR REPLACE FUNCTION public.gerar_codigo_hub_processo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefixo TEXT;
  next_num INTEGER;
BEGIN
  IF NEW.codigo IS NOT NULL AND NEW.codigo != '' THEN
    RETURN NEW;
  END IF;
  prefixo := CASE NEW.tipo
    WHEN 'admissao' THEN 'ADM'
    WHEN 'demissao' THEN 'DEM'
    WHEN 'ferias' THEN 'FER'
    WHEN 'advertencia' THEN 'ADV'
    WHEN 'atestado_afastamento' THEN 'AFA'
    WHEN 'ponto_folha' THEN 'FOL'
    WHEN 'eventos_variaveis' THEN 'EVV'
    WHEN 'solicitacao_geral' THEN 'SOL'
    ELSE 'HUB'
  END;
  SELECT COALESCE(MAX(CAST(SUBSTRING(codigo FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.hub_processos
  WHERE tenant_id = NEW.tenant_id AND tipo = NEW.tipo;
  NEW.codigo := prefixo || '-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_gerar_codigo_hub_processo
  BEFORE INSERT ON public.hub_processos
  FOR EACH ROW
  EXECUTE FUNCTION public.gerar_codigo_hub_processo();

-- Função para registrar histórico ao mudar status
CREATE OR REPLACE FUNCTION public.registrar_historico_hub_processo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.hub_processo_historico (
      tenant_id, processo_id, acao,
      status_anterior, status_novo, descricao
    ) VALUES (
      NEW.tenant_id, NEW.id, 'status_alterado',
      OLD.status, NEW.status,
      'Status alterado de ' || OLD.status::TEXT || ' para ' || NEW.status::TEXT
    );
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_historico_hub_processo
  BEFORE UPDATE ON public.hub_processos
  FOR EACH ROW
  EXECUTE FUNCTION public.registrar_historico_hub_processo();

-- Triggers de updated_at
CREATE TRIGGER upd_hub_contabilidades BEFORE UPDATE ON public.hub_contabilidades FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER upd_hub_config BEFORE UPDATE ON public.hub_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER upd_hub_processo_documentos BEFORE UPDATE ON public.hub_processo_documentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER upd_hub_processo_assinaturas BEFORE UPDATE ON public.hub_processo_assinaturas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();