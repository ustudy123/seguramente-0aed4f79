
-- =============================================
-- ONBOARDING GAMIFICADO - Schema
-- =============================================

-- 1) Adicionar tipo 'onboarding' ao enum trilha_tipo
ALTER TYPE trilha_tipo ADD VALUE IF NOT EXISTS 'onboarding';

-- 2) Tabela de templates de onboarding
CREATE TABLE public.onboarding_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  -- Critérios de aplicação (null = aplica a todos)
  funcoes TEXT[] DEFAULT NULL,
  unidades TEXT[] DEFAULT NULL,
  departamentos TEXT[] DEFAULT NULL,
  tipos_vinculo TEXT[] DEFAULT NULL,
  prazo_dias INTEGER DEFAULT 15,
  pontuacao_total INTEGER DEFAULT 100,
  emitir_certificado BOOLEAN DEFAULT true,
  conexao_pdi BOOLEAN DEFAULT true,
  criado_por TEXT,
  criado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) Enum para tipo de etapa de onboarding
CREATE TYPE onboarding_etapa_tipo AS ENUM (
  'apresentacao_institucional',
  'cultura_valores',
  'mural_boas_vindas',
  'checklist_integracao',
  'conteudo_livre',
  'quiz',
  'reflexao'
);

-- 4) Tabela de etapas do template
CREATE TABLE public.onboarding_etapas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  template_id UUID NOT NULL REFERENCES public.onboarding_templates(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo onboarding_etapa_tipo NOT NULL DEFAULT 'conteudo_livre',
  -- Conteúdo configurável
  conteudo_texto TEXT,
  conteudo_url TEXT,
  formato TEXT DEFAULT 'texto', -- texto, video, apresentacao, hibrido
  -- Configuração
  ordem INTEGER NOT NULL DEFAULT 0,
  pontuacao INTEGER DEFAULT 10,
  obrigatoria BOOLEAN DEFAULT true,
  tempo_estimado_min INTEGER DEFAULT 5,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5) Itens de checklist (sub-itens de etapas tipo 'checklist_integracao')
CREATE TABLE public.onboarding_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  etapa_id UUID NOT NULL REFERENCES public.onboarding_etapas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  obrigatorio BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6) Mensagens de boas-vindas (sub-itens de etapas tipo 'mural_boas_vindas')
CREATE TABLE public.onboarding_mensagens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  etapa_id UUID NOT NULL REFERENCES public.onboarding_etapas(id) ON DELETE CASCADE,
  autor_nome TEXT NOT NULL,
  autor_cargo TEXT,
  mensagem TEXT NOT NULL,
  tipo TEXT DEFAULT 'boas_vindas', -- boas_vindas, recado, orientacao
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7) Processos de onboarding ativos (vinculados a admissões)
CREATE TABLE public.onboarding_processos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  admissao_id UUID NOT NULL REFERENCES public.admissoes(id),
  template_id UUID REFERENCES public.onboarding_templates(id),
  trilha_id UUID REFERENCES public.trilhas(id),
  colaborador_nome TEXT NOT NULL,
  colaborador_cpf TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente, em_andamento, concluido, cancelado
  data_inicio TIMESTAMPTZ,
  data_conclusao TIMESTAMPTZ,
  progresso INTEGER DEFAULT 0,
  pontos_obtidos INTEGER DEFAULT 0,
  certificado_emitido BOOLEAN DEFAULT false,
  pdi_alimentado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8) Progresso do checklist (por item)
CREATE TABLE public.onboarding_checklist_progresso (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  processo_id UUID NOT NULL REFERENCES public.onboarding_processos(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES public.onboarding_checklist_items(id),
  concluido BOOLEAN DEFAULT false,
  data_conclusao TIMESTAMPTZ,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(processo_id, checklist_item_id)
);

-- 9) Respostas de reflexão/percepção (etapas de cultura_valores)
CREATE TABLE public.onboarding_respostas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  processo_id UUID NOT NULL REFERENCES public.onboarding_processos(id) ON DELETE CASCADE,
  etapa_id UUID NOT NULL REFERENCES public.onboarding_etapas(id),
  pergunta TEXT NOT NULL,
  resposta TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- RLS Policies
-- =============================================

ALTER TABLE public.onboarding_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_processos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_checklist_progresso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_respostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.onboarding_templates FOR ALL USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant isolation" ON public.onboarding_etapas FOR ALL USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant isolation" ON public.onboarding_checklist_items FOR ALL USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant isolation" ON public.onboarding_mensagens FOR ALL USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant isolation" ON public.onboarding_processos FOR ALL USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant isolation" ON public.onboarding_checklist_progresso FOR ALL USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant isolation" ON public.onboarding_respostas FOR ALL USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());

-- =============================================
-- Triggers updated_at
-- =============================================

CREATE TRIGGER update_onboarding_templates_updated_at BEFORE UPDATE ON public.onboarding_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_onboarding_etapas_updated_at BEFORE UPDATE ON public.onboarding_etapas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_onboarding_processos_updated_at BEFORE UPDATE ON public.onboarding_processos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Trigger: auto-criar onboarding ao concluir admissão
-- =============================================

CREATE OR REPLACE FUNCTION public.auto_criar_onboarding_admissao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_template_id UUID;
  v_template RECORD;
  v_trilha_id UUID;
  v_processo_id UUID;
  v_etapa RECORD;
  v_modulo_ordem INT := 0;
  v_modulo_tipo TEXT;
BEGIN
  -- Só dispara quando status muda para 'concluido' (admitido)
  IF NEW.status != 'concluido' OR OLD.status = 'concluido' THEN
    RETURN NEW;
  END IF;

  -- Verificar se já existe processo de onboarding para esta admissão
  IF EXISTS (SELECT 1 FROM onboarding_processos WHERE admissao_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Buscar template mais adequado (por função > departamento > genérico)
  SELECT id INTO v_template_id
  FROM onboarding_templates
  WHERE tenant_id = NEW.tenant_id
    AND ativo = true
    AND (funcoes IS NULL OR NEW.cargo = ANY(funcoes))
    AND (departamentos IS NULL OR NEW.departamento = ANY(departamentos))
    AND (tipos_vinculo IS NULL OR NEW.tipo_contrato = ANY(tipos_vinculo))
  ORDER BY
    -- Prioridade: mais específico primeiro
    (CASE WHEN funcoes IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN departamentos IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN tipos_vinculo IS NOT NULL THEN 1 ELSE 0 END) DESC
  LIMIT 1;

  -- Se não há template, não criar onboarding
  IF v_template_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_template FROM onboarding_templates WHERE id = v_template_id;

  -- Criar trilha de onboarding
  INSERT INTO trilhas (
    tenant_id, nome, descricao, tipo, prioridade, visibilidade, status,
    pontuacao_minima, prazo_dias, conexao_pdi, criado_por_nome
  ) VALUES (
    NEW.tenant_id,
    'Onboarding — ' || NEW.nome_completo,
    v_template.descricao,
    'onboarding',
    'obrigatoria',
    'restrita',
    'ativa',
    0,
    v_template.prazo_dias,
    v_template.conexao_pdi,
    'Sistema (automático)'
  ) RETURNING id INTO v_trilha_id;

  -- Criar módulos na trilha baseados nas etapas do template
  FOR v_etapa IN
    SELECT * FROM onboarding_etapas
    WHERE template_id = v_template_id AND ativo = true
    ORDER BY ordem
  LOOP
    v_modulo_ordem := v_modulo_ordem + 1;

    -- Mapear tipo de etapa para tipo de módulo da trilha
    v_modulo_tipo := CASE v_etapa.tipo
      WHEN 'apresentacao_institucional' THEN 'conteudo_interno'
      WHEN 'cultura_valores' THEN 'reflexao'
      WHEN 'mural_boas_vindas' THEN 'conteudo_interno'
      WHEN 'checklist_integracao' THEN 'checklist'
      WHEN 'quiz' THEN 'quiz'
      WHEN 'reflexao' THEN 'reflexao'
      ELSE 'conteudo_interno'
    END;

    INSERT INTO trilha_modulos (
      tenant_id, trilha_id, titulo, descricao, tipo, conteudo_texto, conteudo_url,
      tempo_estimado_min, pontuacao, ordem, evidencia_obrigatoria, ativo
    ) VALUES (
      NEW.tenant_id, v_trilha_id, v_etapa.titulo, v_etapa.descricao,
      v_modulo_tipo::trilha_modulo_tipo, v_etapa.conteudo_texto, v_etapa.conteudo_url,
      v_etapa.tempo_estimado_min, v_etapa.pontuacao, v_modulo_ordem,
      false, true
    );
  END LOOP;

  -- Criar processo de onboarding
  INSERT INTO onboarding_processos (
    tenant_id, admissao_id, template_id, trilha_id,
    colaborador_nome, colaborador_cpf, status
  ) VALUES (
    NEW.tenant_id, NEW.id, v_template_id, v_trilha_id,
    NEW.nome_completo, NEW.cpf, 'pendente'
  ) RETURNING id INTO v_processo_id;

  -- Atribuir trilha ao colaborador
  INSERT INTO trilha_atribuicoes (
    tenant_id, trilha_id, colaborador_id, colaborador_nome, tipo, valor_referencia
  ) VALUES (
    NEW.tenant_id, v_trilha_id, NEW.cpf, NEW.nome_completo, 'individual', 'onboarding'
  );

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_auto_onboarding_admissao
AFTER UPDATE ON public.admissoes
FOR EACH ROW
EXECUTE FUNCTION auto_criar_onboarding_admissao();
