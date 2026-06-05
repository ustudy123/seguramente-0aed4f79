-- 1. Criar Enums se não existirem
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'afastamento_tipo_principal') THEN
        CREATE TYPE public.afastamento_tipo_principal AS ENUM (
            'doenca_comum', 'doenca_ocupacional', 'acidente_tipico', 'acidente_trajeto', 
            'atestado_odontologico', 'licenca_maternidade', 'licenca_paternidade', 
            'aborto_nao_criminoso', 'beneficio_b31', 'beneficio_b91', 'reabilitacao_b92', 
            'auxilio_acidente_b94', 'licenca_nao_remunerada', 'suspensao_disciplinar', 
            'falta_justificada_legal', 'mandato_sindical', 'determinacao_judicial_legal', 
            'outro_cct_act_politica_interna'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'afastamento_status_geral') THEN
        CREATE TYPE public.afastamento_status_geral AS ENUM (
            'rascunho', 'registrado', 'em_analise', 'aguardando_documento', 
            'aguardando_inss', 'em_beneficio', 'prazo_indeterminado', 
            'retorno_pendente', 'retorno_concluido', 'encerrado', 
            'pendencia_critica', 'contestado', 'cancelado'
        );
    END IF;
END $$;

-- 2. Ajustar tabela principal 'afastamentos'
-- Adicionar novas colunas se não existirem
ALTER TABLE public.afastamentos 
    ADD COLUMN IF NOT EXISTS unidade_id UUID,
    ADD COLUMN IF NOT EXISTS setor_id UUID,
    ADD COLUMN IF NOT EXISTS cargo_id UUID,
    ADD COLUMN IF NOT EXISTS gestor_id UUID,
    ADD COLUMN IF NOT EXISTS tipo_principal_new public.afastamento_tipo_principal,
    ADD COLUMN IF NOT EXISTS status_geral_new public.afastamento_status_geral DEFAULT 'registrado',
    ADD COLUMN IF NOT EXISTS data_atestado DATE,
    ADD COLUMN IF NOT EXISTS prazo_indeterminado BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS criado_por UUID,
    ADD COLUMN IF NOT EXISTS atualizado_por UUID;

-- Migrar dados antigos com mapeamento correto
UPDATE public.afastamentos SET status_geral_new = 'encerrado' WHERE status::text = 'encerrado';
UPDATE public.afastamentos SET status_geral_new = 'registrado' WHERE status::text = 'ativo' AND status_geral_new IS NULL;
UPDATE public.afastamentos SET status_geral_new = 'em_beneficio' WHERE status::text = 'beneficio_inss' AND status_geral_new IS NULL;

-- 3. Criar tabelas complementares

-- afastamentos_saude
CREATE TABLE IF NOT EXISTS public.afastamentos_saude (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    afastamento_id UUID NOT NULL REFERENCES public.afastamentos(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    cid_principal TEXT,
    cid_descricao TEXT,
    cid_grupo TEXT,
    cid_capitulo TEXT,
    cid_complementar TEXT,
    profissional_nome TEXT,
    profissional_conselho TEXT,
    profissional_numero TEXT,
    profissional_uf TEXT,
    especialidade TEXT,
    arquivo_atestado_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- afastamentos_previdenciario
CREATE TABLE IF NOT EXISTS public.afastamentos_previdenciario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    afastamento_id UUID NOT NULL REFERENCES public.afastamentos(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    encaminhado_inss BOOLEAN DEFAULT FALSE,
    especie_beneficio TEXT CHECK (especie_beneficio IN ('B31', 'B91', 'B92', 'B94', 'B32', 'outro')),
    numero_beneficio TEXT,
    data_inicio_beneficio DATE,
    data_cessacao_prevista DATE,
    data_alta DATE,
    houve_prorrogacao BOOLEAN DEFAULT FALSE,
    status_previdenciario TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- afastamentos_cat
CREATE TABLE IF NOT EXISTS public.afastamentos_cat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    afastamento_id UUID NOT NULL REFERENCES public.afastamentos(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    cat_aplicavel BOOLEAN DEFAULT FALSE,
    status_cat TEXT,
    tipo_cat TEXT,
    data_acidente DATE,
    hora_acidente TIME,
    local_acidente TEXT,
    parte_corpo TEXT,
    agente_causador TEXT,
    descricao_acidente TEXT,
    testemunhas JSONB,
    protocolo_esocial TEXT,
    justificativa_nao_aplicavel TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- afastamentos_esocial
CREATE TABLE IF NOT EXISTS public.afastamentos_esocial (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    afastamento_id UUID NOT NULL REFERENCES public.afastamentos(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    evento TEXT NOT NULL CHECK (evento IN ('S2210', 'S2230_inicio', 'S2230_prorrogacao', 'S2230_retorno')),
    aplicavel BOOLEAN DEFAULT TRUE,
    status TEXT DEFAULT 'pendente' CHECK (status IN ('nao_aplicavel', 'pendente', 'enviado', 'rejeitado', 'protocolo_recebido')),
    prazo DATE,
    data_envio TIMESTAMP WITH TIME ZONE,
    protocolo TEXT,
    motivo_rejeicao TEXT,
    responsavel_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- afastamentos_fap
CREATE TABLE IF NOT EXISTS public.afastamentos_fap (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    afastamento_id UUID NOT NULL REFERENCES public.afastamentos(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    impacta_fap BOOLEAN DEFAULT FALSE,
    nivel_risco TEXT DEFAULT 'nao_impacta' CHECK (nivel_risco IN ('nao_impacta', 'risco_baixo', 'risco_medio', 'risco_alto', 'impacto_confirmado')),
    motivo_impacto TEXT,
    status_analise TEXT,
    observacao_previdenciaria TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- afastamentos_ntep
CREATE TABLE IF NOT EXISTS public.afastamentos_ntep (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    afastamento_id UUID NOT NULL REFERENCES public.afastamentos(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    cid TEXT,
    cnae TEXT,
    status_ntep TEXT DEFAULT 'sem_ntep' CHECK (status_ntep IN ('sem_ntep', 'suspeito', 'confirmado', 'contestado', 'descartado')),
    fundamento TEXT,
    decisao TEXT,
    justificativa TEXT,
    responsavel_id UUID,
    data_decisao DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- afastamentos_retorno
CREATE TABLE IF NOT EXISTS public.afastamentos_retorno (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    afastamento_id UUID NOT NULL REFERENCES public.afastamentos(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    alta_registrada BOOLEAN DEFAULT FALSE,
    data_alta DATE,
    data_prevista_retorno DATE,
    exame_retorno_obrigatorio BOOLEAN DEFAULT FALSE,
    status_aso_retorno TEXT,
    entrevista_obrigatoria BOOLEAN DEFAULT FALSE,
    status_entrevista TEXT,
    resultado_retorno TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- restricoes_laborais
CREATE TABLE IF NOT EXISTS public.restricoes_laborais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    afastamento_id UUID REFERENCES public.afastamentos(id) ON DELETE CASCADE,
    trabalhador_id UUID,
    tenant_id UUID NOT NULL,
    descricao TEXT NOT NULL,
    origem TEXT,
    temporaria BOOLEAN DEFAULT TRUE,
    permanente BOOLEAN DEFAULT FALSE,
    data_inicio DATE,
    data_fim DATE,
    atividades_vedadas TEXT,
    adaptacoes_necessarias TEXT,
    responsavel_tecnico TEXT,
    anexo_url TEXT,
    status TEXT DEFAULT 'ativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- afastamentos_marcadores
CREATE TABLE IF NOT EXISTS public.afastamentos_marcadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    afastamento_id UUID NOT NULL REFERENCES public.afastamentos(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    marcador TEXT NOT NULL,
    origem TEXT DEFAULT 'sistema',
    criado_automaticamente BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- afastamentos_pendencias
CREATE TABLE IF NOT EXISTS public.afastamentos_pendencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    afastamento_id UUID NOT NULL REFERENCES public.afastamentos(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    tipo_pendencia TEXT NOT NULL,
    descricao TEXT,
    responsavel_id UUID,
    prazo DATE,
    prioridade TEXT DEFAULT 'media',
    status TEXT DEFAULT 'pendente',
    resolvido_em TIMESTAMP WITH TIME ZONE,
    resolvido_por UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Habilitar RLS e criar políticas básicas
ALTER TABLE public.afastamentos_saude ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afastamentos_previdenciario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afastamentos_cat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afastamentos_esocial ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afastamentos_fap ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afastamentos_ntep ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afastamentos_retorno ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restricoes_laborais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afastamentos_marcadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afastamentos_pendencias ENABLE ROW LEVEL SECURITY;

-- Políticas de Tenant (Acesso por tenant_id)
CREATE POLICY "Tenant access health" ON public.afastamentos_saude FOR ALL USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Tenant access prev" ON public.afastamentos_previdenciario FOR ALL USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Tenant access cat" ON public.afastamentos_cat FOR ALL USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Tenant access esocial" ON public.afastamentos_esocial FOR ALL USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Tenant access fap" ON public.afastamentos_fap FOR ALL USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Tenant access ntep" ON public.afastamentos_ntep FOR ALL USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Tenant access ret" ON public.afastamentos_retorno FOR ALL USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Tenant access restr" ON public.restricoes_laborais FOR ALL USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Tenant access marc" ON public.afastamentos_marcadores FOR ALL USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Tenant access pend" ON public.afastamentos_pendencias FOR ALL USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

-- 5. Grants
GRANT ALL ON public.afastamentos_saude TO authenticated, service_role;
GRANT ALL ON public.afastamentos_previdenciario TO authenticated, service_role;
GRANT ALL ON public.afastamentos_cat TO authenticated, service_role;
GRANT ALL ON public.afastamentos_esocial TO authenticated, service_role;
GRANT ALL ON public.afastamentos_fap TO authenticated, service_role;
GRANT ALL ON public.afastamentos_ntep TO authenticated, service_role;
GRANT ALL ON public.afastamentos_retorno TO authenticated, service_role;
GRANT ALL ON public.restricoes_laborais TO authenticated, service_role;
GRANT ALL ON public.afastamentos_marcadores TO authenticated, service_role;
GRANT ALL ON public.afastamentos_pendencias TO authenticated, service_role;
