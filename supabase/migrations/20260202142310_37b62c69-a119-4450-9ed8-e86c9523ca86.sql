-- Módulo Plano de Ação Estratégica

-- Enum para prioridade GUT
CREATE TYPE public.acao_gut_prioridade AS ENUM ('baixo', 'medio', 'urgente', 'imediato');

-- Enum para status de tarefas
CREATE TYPE public.tarefa_status AS ENUM ('nao_iniciada', 'em_andamento', 'bloqueada', 'concluida');

-- Tabela principal de Ações Estratégicas (5W2H)
CREATE TABLE public.plano_acoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- Código sequencial por tenant
    codigo TEXT NOT NULL,
    
    -- 5W2H
    titulo TEXT NOT NULL, -- What - O que será feito
    descricao TEXT, -- Detalhamento
    porque TEXT, -- Why - Justificativa
    onde TEXT, -- Where - Área/Setor
    prazo DATE, -- When - Prazo final
    responsavel_id UUID REFERENCES auth.users(id),
    responsavel_nome TEXT,
    como TEXT, -- How - Estratégia de execução
    custo_estimado NUMERIC(12,2), -- How Much - Custo estimado
    custo_real NUMERIC(12,2),
    
    -- Origem da ação
    origem_modulo TEXT NOT NULL DEFAULT 'manual', -- ergonomia, ouvidoria, epi, ponto, humor, manual
    origem_id UUID, -- ID do registro de origem (risco, manifestação, etc.)
    origem_descricao TEXT, -- Descrição da origem
    
    -- Prioridade GUT
    gravidade INTEGER CHECK (gravidade BETWEEN 1 AND 5),
    urgencia INTEGER CHECK (urgencia BETWEEN 1 AND 5),
    tendencia INTEGER CHECK (tendencia BETWEEN 1 AND 5),
    pontuacao_gut INTEGER GENERATED ALWAYS AS (COALESCE(gravidade, 1) * COALESCE(urgencia, 1) * COALESCE(tendencia, 1)) STORED,
    prioridade acao_gut_prioridade DEFAULT 'medio',
    
    -- Status (calculado automaticamente)
    status acao_status DEFAULT 'pendente',
    progresso INTEGER DEFAULT 0 CHECK (progresso BETWEEN 0 AND 100),
    
    -- Datas
    data_inicio DATE,
    data_conclusao DATE,
    
    -- Exigência de evidência
    exige_evidencia BOOLEAN DEFAULT false,
    
    -- Tipo
    tipo TEXT DEFAULT 'corretiva' CHECK (tipo IN ('corretiva', 'preventiva', 'melhoria')),
    
    -- Controle de tempo
    tempo_estimado_minutos INTEGER,
    tempo_gasto_minutos INTEGER DEFAULT 0,
    
    -- Metadados
    criado_por UUID REFERENCES auth.users(id),
    criado_por_nome TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para plano_acoes
CREATE INDEX idx_plano_acoes_tenant ON public.plano_acoes(tenant_id);
CREATE INDEX idx_plano_acoes_status ON public.plano_acoes(tenant_id, status);
CREATE INDEX idx_plano_acoes_responsavel ON public.plano_acoes(tenant_id, responsavel_id);
CREATE INDEX idx_plano_acoes_prazo ON public.plano_acoes(tenant_id, prazo);
CREATE INDEX idx_plano_acoes_origem ON public.plano_acoes(tenant_id, origem_modulo);
CREATE INDEX idx_plano_acoes_gut ON public.plano_acoes(tenant_id, pontuacao_gut DESC);

-- RLS para plano_acoes
ALTER TABLE public.plano_acoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver ações do seu tenant"
ON public.plano_acoes FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Managers+ podem criar ações"
ON public.plano_acoes FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'));

CREATE POLICY "Managers+ podem atualizar ações"
ON public.plano_acoes FOR UPDATE
USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'))
WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'));

CREATE POLICY "Admins+ podem deletar ações"
ON public.plano_acoes FOR DELETE
USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'admin'));

-- Tabela de Tarefas Operacionais (Checklist)
CREATE TABLE public.plano_tarefas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    acao_id UUID NOT NULL REFERENCES public.plano_acoes(id) ON DELETE CASCADE,
    
    -- Dados da tarefa
    titulo TEXT NOT NULL,
    descricao TEXT,
    ordem INTEGER DEFAULT 0,
    
    -- Responsável (pode ser diferente da ação)
    responsavel_id UUID REFERENCES auth.users(id),
    responsavel_nome TEXT,
    
    -- Status e prazos
    status tarefa_status DEFAULT 'nao_iniciada',
    prazo DATE,
    data_conclusao TIMESTAMPTZ,
    
    -- Prioridade
    prioridade acao_gut_prioridade DEFAULT 'medio',
    
    -- Dependência
    depende_de UUID REFERENCES public.plano_tarefas(id),
    
    -- Controle de tempo
    tempo_estimado_minutos INTEGER,
    tempo_gasto_minutos INTEGER DEFAULT 0,
    
    -- Observações
    observacoes TEXT,
    
    -- Metadados
    concluida_por UUID REFERENCES auth.users(id),
    concluida_por_nome TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para plano_tarefas
CREATE INDEX idx_plano_tarefas_acao ON public.plano_tarefas(acao_id);
CREATE INDEX idx_plano_tarefas_tenant ON public.plano_tarefas(tenant_id);
CREATE INDEX idx_plano_tarefas_responsavel ON public.plano_tarefas(responsavel_id);
CREATE INDEX idx_plano_tarefas_status ON public.plano_tarefas(acao_id, status);

-- RLS para plano_tarefas
ALTER TABLE public.plano_tarefas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver tarefas do seu tenant"
ON public.plano_tarefas FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Managers+ podem gerenciar tarefas"
ON public.plano_tarefas FOR ALL
USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'))
WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'));

-- Tabela de Histórico/Timeline (Audit Trail)
CREATE TABLE public.plano_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    acao_id UUID REFERENCES public.plano_acoes(id) ON DELETE CASCADE,
    tarefa_id UUID REFERENCES public.plano_tarefas(id) ON DELETE CASCADE,
    
    -- Tipo de evento
    tipo_evento TEXT NOT NULL, -- criacao, edicao, status_alterado, tarefa_concluida, comentario, anexo, responsavel_alterado, encaminhamento
    
    -- Dados do evento
    descricao TEXT NOT NULL,
    dados_anteriores JSONB,
    dados_novos JSONB,
    
    -- Usuário
    usuario_id UUID REFERENCES auth.users(id),
    usuario_nome TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para plano_historico
CREATE INDEX idx_plano_historico_acao ON public.plano_historico(acao_id);
CREATE INDEX idx_plano_historico_tenant ON public.plano_historico(tenant_id);
CREATE INDEX idx_plano_historico_data ON public.plano_historico(created_at DESC);

-- RLS para plano_historico
ALTER TABLE public.plano_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver histórico do seu tenant"
ON public.plano_historico FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Sistema pode inserir histórico"
ON public.plano_historico FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id());

-- Tabela de Comentários
CREATE TABLE public.plano_comentarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    acao_id UUID NOT NULL REFERENCES public.plano_acoes(id) ON DELETE CASCADE,
    tarefa_id UUID REFERENCES public.plano_tarefas(id) ON DELETE CASCADE,
    
    -- Comentário
    conteudo TEXT NOT NULL,
    
    -- Menções
    mencoes UUID[] DEFAULT '{}',
    
    -- Autor
    autor_id UUID NOT NULL REFERENCES auth.users(id),
    autor_nome TEXT NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para plano_comentarios
CREATE INDEX idx_plano_comentarios_acao ON public.plano_comentarios(acao_id);
CREATE INDEX idx_plano_comentarios_tarefa ON public.plano_comentarios(tarefa_id);

-- RLS para plano_comentarios
ALTER TABLE public.plano_comentarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver comentários do seu tenant"
ON public.plano_comentarios FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Usuários podem comentar"
ON public.plano_comentarios FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id() AND autor_id = auth.uid());

CREATE POLICY "Autor pode editar próprio comentário"
ON public.plano_comentarios FOR UPDATE
USING (tenant_id = get_user_tenant_id() AND autor_id = auth.uid());

CREATE POLICY "Autor ou admin pode deletar comentário"
ON public.plano_comentarios FOR DELETE
USING (tenant_id = get_user_tenant_id() AND (autor_id = auth.uid() OR has_minimum_role(auth.uid(), 'admin')));

-- Tabela de Evidências/Anexos
CREATE TABLE public.plano_evidencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    acao_id UUID NOT NULL REFERENCES public.plano_acoes(id) ON DELETE CASCADE,
    tarefa_id UUID REFERENCES public.plano_tarefas(id) ON DELETE CASCADE,
    
    -- Dados do arquivo
    titulo TEXT NOT NULL,
    descricao TEXT,
    arquivo_url TEXT,
    arquivo_nome TEXT,
    arquivo_tamanho INTEGER,
    arquivo_tipo TEXT,
    
    -- Tipo de evidência
    tipo TEXT DEFAULT 'anexo', -- anexo, foto, documento, comprovante
    
    -- Autor
    enviado_por UUID REFERENCES auth.users(id),
    enviado_por_nome TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para plano_evidencias
CREATE INDEX idx_plano_evidencias_acao ON public.plano_evidencias(acao_id);
CREATE INDEX idx_plano_evidencias_tarefa ON public.plano_evidencias(tarefa_id);

-- RLS para plano_evidencias
ALTER TABLE public.plano_evidencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver evidências do seu tenant"
ON public.plano_evidencias FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Managers+ podem gerenciar evidências"
ON public.plano_evidencias FOR ALL
USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'))
WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'));

-- Tabela de Co-responsáveis e Encaminhamentos
CREATE TABLE public.plano_participantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    acao_id UUID NOT NULL REFERENCES public.plano_acoes(id) ON DELETE CASCADE,
    
    -- Usuário
    usuario_id UUID NOT NULL REFERENCES auth.users(id),
    usuario_nome TEXT NOT NULL,
    
    -- Tipo de participação
    tipo TEXT NOT NULL DEFAULT 'co_responsavel', -- co_responsavel, consulta, validacao, apoio
    
    -- Status
    aceito BOOLEAN,
    data_aceite TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(acao_id, usuario_id)
);

-- Índices para plano_participantes
CREATE INDEX idx_plano_participantes_acao ON public.plano_participantes(acao_id);
CREATE INDEX idx_plano_participantes_usuario ON public.plano_participantes(usuario_id);

-- RLS para plano_participantes
ALTER TABLE public.plano_participantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver participantes do seu tenant"
ON public.plano_participantes FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Managers+ podem gerenciar participantes"
ON public.plano_participantes FOR ALL
USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'))
WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'));

-- Tabela de Controle de Tempo (Timer)
CREATE TABLE public.plano_tempo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    acao_id UUID REFERENCES public.plano_acoes(id) ON DELETE CASCADE,
    tarefa_id UUID REFERENCES public.plano_tarefas(id) ON DELETE CASCADE,
    
    -- Usuário
    usuario_id UUID NOT NULL REFERENCES auth.users(id),
    usuario_nome TEXT NOT NULL,
    
    -- Tempo
    inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
    fim TIMESTAMPTZ,
    duracao_minutos INTEGER,
    
    -- Descrição do trabalho
    descricao TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para plano_tempo
CREATE INDEX idx_plano_tempo_acao ON public.plano_tempo(acao_id);
CREATE INDEX idx_plano_tempo_tarefa ON public.plano_tempo(tarefa_id);
CREATE INDEX idx_plano_tempo_usuario ON public.plano_tempo(usuario_id);

-- RLS para plano_tempo
ALTER TABLE public.plano_tempo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver tempo do seu tenant"
ON public.plano_tempo FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Usuários podem registrar próprio tempo"
ON public.plano_tempo FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id() AND usuario_id = auth.uid());

CREATE POLICY "Usuários podem atualizar próprio tempo"
ON public.plano_tempo FOR UPDATE
USING (tenant_id = get_user_tenant_id() AND usuario_id = auth.uid());

-- Tabela de Templates de Ações
CREATE TABLE public.plano_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- Dados do template
    nome TEXT NOT NULL,
    descricao TEXT,
    categoria TEXT,
    
    -- Template de ação
    acao_template JSONB NOT NULL,
    
    -- Template de tarefas
    tarefas_template JSONB DEFAULT '[]',
    
    -- Controle
    ativo BOOLEAN DEFAULT true,
    uso_count INTEGER DEFAULT 0,
    
    criado_por UUID REFERENCES auth.users(id),
    criado_por_nome TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS para plano_templates
ALTER TABLE public.plano_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver templates do seu tenant"
ON public.plano_templates FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Managers+ podem gerenciar templates"
ON public.plano_templates FOR ALL
USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'))
WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_plano_acoes_updated_at
    BEFORE UPDATE ON public.plano_acoes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_plano_tarefas_updated_at
    BEFORE UPDATE ON public.plano_tarefas
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_plano_comentarios_updated_at
    BEFORE UPDATE ON public.plano_comentarios
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_plano_templates_updated_at
    BEFORE UPDATE ON public.plano_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Função para gerar código sequencial de ação
CREATE OR REPLACE FUNCTION public.gerar_codigo_acao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    next_num INTEGER;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(codigo FROM 'ACO-(\d+)') AS INTEGER)), 0) + 1
    INTO next_num
    FROM public.plano_acoes
    WHERE tenant_id = NEW.tenant_id;
    
    NEW.codigo := 'ACO-' || LPAD(next_num::TEXT, 5, '0');
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_gerar_codigo_acao
    BEFORE INSERT ON public.plano_acoes
    FOR EACH ROW
    WHEN (NEW.codigo IS NULL OR NEW.codigo = '')
    EXECUTE FUNCTION public.gerar_codigo_acao();

-- Função para atualizar progresso da ação baseado nas tarefas
CREATE OR REPLACE FUNCTION public.atualizar_progresso_acao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    total_tarefas INTEGER;
    tarefas_concluidas INTEGER;
    novo_progresso INTEGER;
    novo_status acao_status;
    tem_bloqueada BOOLEAN;
    tem_atrasada BOOLEAN;
BEGIN
    -- Contar tarefas
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'concluida'),
        EXISTS(SELECT 1 FROM public.plano_tarefas WHERE acao_id = COALESCE(NEW.acao_id, OLD.acao_id) AND status = 'bloqueada'),
        EXISTS(SELECT 1 FROM public.plano_tarefas WHERE acao_id = COALESCE(NEW.acao_id, OLD.acao_id) AND prazo < CURRENT_DATE AND status != 'concluida')
    INTO total_tarefas, tarefas_concluidas, tem_bloqueada, tem_atrasada
    FROM public.plano_tarefas
    WHERE acao_id = COALESCE(NEW.acao_id, OLD.acao_id);
    
    -- Calcular progresso
    IF total_tarefas > 0 THEN
        novo_progresso := (tarefas_concluidas * 100) / total_tarefas;
    ELSE
        novo_progresso := 0;
    END IF;
    
    -- Determinar status
    IF tarefas_concluidas = total_tarefas AND total_tarefas > 0 THEN
        novo_status := 'concluida';
    ELSIF tem_atrasada THEN
        novo_status := 'atrasada';
    ELSIF tem_bloqueada THEN
        novo_status := 'pausada';
    ELSIF tarefas_concluidas > 0 THEN
        novo_status := 'em_andamento';
    ELSE
        novo_status := 'pendente';
    END IF;
    
    -- Atualizar ação
    UPDATE public.plano_acoes
    SET 
        progresso = novo_progresso,
        status = novo_status,
        data_conclusao = CASE WHEN novo_status = 'concluida' THEN CURRENT_DATE ELSE NULL END
    WHERE id = COALESCE(NEW.acao_id, OLD.acao_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_atualizar_progresso_acao
    AFTER INSERT OR UPDATE OR DELETE ON public.plano_tarefas
    FOR EACH ROW
    EXECUTE FUNCTION public.atualizar_progresso_acao();

-- Criar bucket para evidências do plano de ação
INSERT INTO storage.buckets (id, name, public) 
VALUES ('plano-evidencias', 'plano-evidencias', false)
ON CONFLICT (id) DO NOTHING;

-- Policies para o bucket
CREATE POLICY "Usuários autenticados podem ver evidências do tenant"
ON storage.objects FOR SELECT
USING (bucket_id = 'plano-evidencias' AND auth.role() = 'authenticated');

CREATE POLICY "Managers+ podem fazer upload de evidências"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'plano-evidencias' AND auth.role() = 'authenticated');

CREATE POLICY "Managers+ podem deletar evidências"
ON storage.objects FOR DELETE
USING (bucket_id = 'plano-evidencias' AND auth.role() = 'authenticated');