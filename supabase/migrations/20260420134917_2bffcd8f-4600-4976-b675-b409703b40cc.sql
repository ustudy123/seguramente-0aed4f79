-- Fase 2: Modelo de dados expandido para escalas inteligentes

-- 1. Múltiplos blocos por dia da semana
CREATE TABLE IF NOT EXISTS public.ponto_escala_periodos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  escala_id UUID NOT NULL REFERENCES public.ponto_escalas(id) ON DELETE CASCADE,
  dia_semana TEXT NOT NULL CHECK (dia_semana IN ('segunda','terca','quarta','quinta','sexta','sabado','domingo')),
  ordem_bloco INTEGER NOT NULL DEFAULT 1,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ponto_escala_periodos_escala ON public.ponto_escala_periodos(escala_id);
CREATE INDEX IF NOT EXISTS idx_ponto_escala_periodos_tenant ON public.ponto_escala_periodos(tenant_id);

ALTER TABLE public.ponto_escala_periodos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view periodos"
  ON public.ponto_escala_periodos FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can insert periodos"
  ON public.ponto_escala_periodos FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can update periodos"
  ON public.ponto_escala_periodos FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can delete periodos"
  ON public.ponto_escala_periodos FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

-- 2. Recorrências mensais (ex: 2º sábado do mês)
CREATE TABLE IF NOT EXISTS public.ponto_escala_recorrencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  escala_id UUID NOT NULL REFERENCES public.ponto_escalas(id) ON DELETE CASCADE,
  descricao TEXT,
  ordinal_mes TEXT NOT NULL CHECK (ordinal_mes IN ('1','2','3','4','ultimo','todos')),
  dia_semana TEXT NOT NULL CHECK (dia_semana IN ('segunda','terca','quarta','quinta','sexta','sabado','domingo')),
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ponto_escala_recorrencias_escala ON public.ponto_escala_recorrencias(escala_id);
CREATE INDEX IF NOT EXISTS idx_ponto_escala_recorrencias_tenant ON public.ponto_escala_recorrencias(tenant_id);

ALTER TABLE public.ponto_escala_recorrencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view recorrencias"
  ON public.ponto_escala_recorrencias FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can insert recorrencias"
  ON public.ponto_escala_recorrencias FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can update recorrencias"
  ON public.ponto_escala_recorrencias FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can delete recorrencias"
  ON public.ponto_escala_recorrencias FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

-- 3. Histórico de interpretação IA (auditoria/rastreabilidade)
CREATE TABLE IF NOT EXISTS public.ponto_escala_historico_interpretacao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  escala_id UUID REFERENCES public.ponto_escalas(id) ON DELETE SET NULL,
  entrada_original TEXT NOT NULL,
  origem_input TEXT NOT NULL DEFAULT 'texto' CHECK (origem_input IN ('texto','audio')),
  transcricao_audio TEXT,
  saida_ia JSONB NOT NULL,
  ajuste_usuario JSONB,
  nivel_confianca TEXT,
  descricao_contratual TEXT,
  alertas JSONB,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ponto_escala_historico_escala ON public.ponto_escala_historico_interpretacao(escala_id);
CREATE INDEX IF NOT EXISTS idx_ponto_escala_historico_tenant ON public.ponto_escala_historico_interpretacao(tenant_id);

ALTER TABLE public.ponto_escala_historico_interpretacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view historico"
  ON public.ponto_escala_historico_interpretacao FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can insert historico"
  ON public.ponto_escala_historico_interpretacao FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

-- 4. Biblioteca de padrões reutilizáveis (escopo: tenant ou global se tenant_id IS NULL)
CREATE TABLE IF NOT EXISTS public.ponto_escala_padroes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT,
  estrutura JSONB NOT NULL,
  exemplo_descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ponto_escala_padroes_tenant ON public.ponto_escala_padroes(tenant_id);

ALTER TABLE public.ponto_escala_padroes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View padroes globais ou do tenant"
  ON public.ponto_escala_padroes FOR SELECT
  USING (tenant_id IS NULL OR tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can insert padroes"
  ON public.ponto_escala_padroes FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can update padroes"
  ON public.ponto_escala_padroes FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can delete padroes"
  ON public.ponto_escala_padroes FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

-- 5. Adicionar colunas auxiliares à tabela ponto_escalas para suportar o novo modelo
ALTER TABLE public.ponto_escalas
  ADD COLUMN IF NOT EXISTS descricao_original TEXT,
  ADD COLUMN IF NOT EXISTS descricao_contratual TEXT,
  ADD COLUMN IF NOT EXISTS nivel_confianca TEXT,
  ADD COLUMN IF NOT EXISTS origem_input TEXT DEFAULT 'manual';

-- 6. Padrões iniciais globais
INSERT INTO public.ponto_escala_padroes (tenant_id, nome, descricao, categoria, estrutura, exemplo_descricao) VALUES
  (NULL, 'Administrativo Seg-Sex 8h-18h', '5x2 com almoço de 1h', 'Administrativo',
   '{"tipo":"5x2","jornada_diaria_minutos":480,"jornada_semanal_minutos":2400,"intervalo_intrajornada_minutos":60,"hora_entrada_padrao":"08:00","hora_saida_padrao":"18:00","sabado_util":false,"domingo_util":false}'::jsonb,
   'Segunda a sexta, das 08:00 às 12:00 e das 13:00 às 18:00.'),
  (NULL, 'Comercial 6x1 8h-17h', '6x1 com sábado útil meio período', 'Comércio',
   '{"tipo":"6x1","jornada_diaria_minutos":480,"jornada_semanal_minutos":2640,"intervalo_intrajornada_minutos":60,"hora_entrada_padrao":"08:00","hora_saida_padrao":"17:00","sabado_util":true,"domingo_util":false}'::jsonb,
   'Segunda a sábado, das 08:00 às 12:00 e das 13:00 às 17:00.'),
  (NULL, '12x36 Diurno', 'Escala 12x36 horário diurno', 'Operacional',
   '{"tipo":"12x36","jornada_diaria_minutos":720,"jornada_semanal_minutos":2520,"intervalo_intrajornada_minutos":60,"hora_entrada_padrao":"07:00","hora_saida_padrao":"19:00","sabado_util":true,"domingo_util":true}'::jsonb,
   'Escala 12x36 das 07:00 às 19:00 com 1h de intervalo.'),
  (NULL, '12x36 Noturno', 'Escala 12x36 noturna com adicional', 'Operacional',
   '{"tipo":"12x36","jornada_diaria_minutos":720,"jornada_semanal_minutos":2520,"intervalo_intrajornada_minutos":60,"hora_entrada_padrao":"19:00","hora_saida_padrao":"07:00","sabado_util":true,"domingo_util":true,"usa_hora_ficta_noturna":true}'::jsonb,
   'Escala 12x36 noturna das 19:00 às 07:00 com adicional noturno.');
