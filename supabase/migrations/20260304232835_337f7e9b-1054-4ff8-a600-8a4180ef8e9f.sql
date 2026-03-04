-- Tabela principal: clientes no programa validador
CREATE TABLE public.programa_validador_clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  nome_empresa TEXT NOT NULL,
  cnpj TEXT,
  poc_nome TEXT,
  poc_email TEXT,
  poc_telefone TEXT,
  poc_cargo TEXT,
  fase TEXT NOT NULL DEFAULT 'prospeccao' CHECK (fase IN ('prospeccao','qualificacao','kickoff','ativo','suspenso','encerrado')),
  data_inicio_piloto DATE,
  data_fim_piloto DATE,
  segmento TEXT,
  tamanho_empresa TEXT CHECK (tamanho_empresa IN ('micro','pequena','media','grande')),
  quantidade_colaboradores INTEGER,
  aceita_beta BOOLEAN DEFAULT FALSE,
  observacoes TEXT,
  responsavel_seguramente TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.programa_validador_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmins_full_access_validador_clientes"
  ON public.programa_validador_clientes
  FOR ALL
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE TRIGGER update_programa_validador_clientes_updated_at
  BEFORE UPDATE ON public.programa_validador_clientes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Checklist de documentos por cliente
CREATE TABLE public.programa_validador_documentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.programa_validador_clientes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('contrato_piloto','dpa_lgpd','anexo_operacional','faq_seguranca','resumo_beta','politica_privacidade','termos_uso','ata_kickoff')),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','enviado','aceito','recusado')),
  enviado_em TIMESTAMPTZ,
  aceito_em TIMESTAMPTZ,
  versao TEXT,
  arquivo_url TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.programa_validador_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmins_full_access_validador_docs"
  ON public.programa_validador_documentos
  FOR ALL
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE TRIGGER update_programa_validador_documentos_updated_at
  BEFORE UPDATE ON public.programa_validador_documentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Histórico de atividades por cliente
CREATE TABLE public.programa_validador_historico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.programa_validador_clientes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('nota','fase_alterada','documento','reuniao','alerta','feedback')),
  titulo TEXT NOT NULL,
  descricao TEXT,
  autor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.programa_validador_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmins_full_access_validador_historico"
  ON public.programa_validador_historico
  FOR ALL
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));
