
-- ============================================================
-- 1. Tabela de templates de checklist por tipo de processo
-- ============================================================
CREATE TABLE public.hub_checklist_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  item TEXT NOT NULL,
  descricao TEXT,
  obrigatorio BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.hub_checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_hub_checklist_templates"
  ON public.hub_checklist_templates FOR ALL
  USING (tenant_id IS NULL OR tenant_id = public.get_user_tenant_id());

CREATE POLICY "insert_hub_checklist_templates"
  ON public.hub_checklist_templates FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE INDEX idx_hub_checklist_templates_tipo ON public.hub_checklist_templates(tipo);
CREATE INDEX idx_hub_checklist_templates_tenant ON public.hub_checklist_templates(tenant_id);

-- ============================================================
-- 2. Templates padrão do sistema (tenant_id = NULL)
-- ============================================================
INSERT INTO public.hub_checklist_templates (tenant_id, tipo, item, descricao, obrigatorio, ordem) VALUES
  (NULL,'admissao','Documentos pessoais recebidos (RG, CPF)','Verificar autenticidade e validade dos documentos de identidade',true,1),
  (NULL,'admissao','Comprovante de residência atualizado','Data máxima de 3 meses',true,2),
  (NULL,'admissao','CTPS preenchida ou dados da CTPS digital','Verificar anotações anteriores e coletar dados para eSocial',true,3),
  (NULL,'admissao','ASO admissional emitido e arquivado','Exame médico admissional com resultado apto',true,4),
  (NULL,'admissao','Dados bancários coletados','Banco, agência, conta e tipo de conta para pagamento',true,5),
  (NULL,'admissao','Ficha de EPI assinada','Registro de entrega dos EPIs necessários para a função',false,6),
  (NULL,'admissao','Contrato de trabalho assinado','Contrato conforme modalidade (CLT, temporário, aprendiz, etc.)',true,7),
  (NULL,'admissao','Dependentes e documentos informados','Para fins de IR, salário-família e plano de saúde',false,8),
  (NULL,'admissao','Dados enviados para o eSocial','Evento S-2200 transmitido dentro do prazo',true,9),
  (NULL,'admissao','Registro na CTPS confirmado','Baixa na CTPS ou registro digital confirmado',true,10),
  (NULL,'demissao','Comunicado de desligamento assinado','Comunicado formal com motivo e data',true,1),
  (NULL,'demissao','Aviso prévio trabalhado ou indenizado definido','Calcular e confirmar modalidade do aviso prévio',true,2),
  (NULL,'demissao','Saldo de banco de horas apurado','Levantamento de horas extras e banco de horas',true,3),
  (NULL,'demissao','Saldo de férias vencidas e proporcionais calculado','Períodos aquisitivos abertos e saldo proporcional',true,4),
  (NULL,'demissao','Exame demissional realizado (ASO)','Resultado do exame médico demissional',true,5),
  (NULL,'demissao','EPIs devolvidos e baixa registrada','Devolução dos equipamentos e atualização do controle',false,6),
  (NULL,'demissao','TRCT calculado e enviado à contabilidade','Termo de Rescisão do Contrato de Trabalho',true,7),
  (NULL,'demissao','Guia de multa do FGTS (quando aplicável)','GRRF para desligamento sem justa causa',false,8),
  (NULL,'demissao','Seguro-desemprego verificado (elegibilidade)','Verificar requisitos para requerimento',false,9),
  (NULL,'demissao','TRCT assinado pelas partes','Assinatura do empregado, empresa e testemunhas',true,10),
  (NULL,'ferias','Período aquisitivo conferido','Verificar data de início e término do período',true,1),
  (NULL,'ferias','Aviso de férias enviado com 30 dias de antecedência','Notificação formal ao colaborador',true,2),
  (NULL,'ferias','Opção de abono pecuniário registrada','1/3 convertido em dinheiro se solicitado',false,3),
  (NULL,'ferias','Fracionamento autorizado (quando aplicável)','Divisão das férias em até 3 períodos',false,4),
  (NULL,'ferias','Pagamento efetuado até 2 dias antes','Conformidade com art. 145 CLT',true,5),
  (NULL,'ferias','Recibo de férias assinado','Assinatura ou ciência digital do colaborador',true,6),
  (NULL,'ferias','eSocial S-2230 transmitido','Evento de afastamento temporário enviado',true,7),
  (NULL,'advertencia','Fato apurado e documentado','Registro escrito com data, horário e testemunhas',true,1),
  (NULL,'advertencia','Oportunidade de defesa concedida ao colaborador','Garantia do contraditório antes da formalização',true,2),
  (NULL,'advertencia','Advertência redigida e revisada','Texto claro com referência ao fato e penalidade',true,3),
  (NULL,'advertencia','Documento enviado para ciência/assinatura','Envio físico ou por link de assinatura eletrônica',true,4),
  (NULL,'advertencia','Recusa de assinatura registrada (se aplicável)','Registrar testemunhas em caso de recusa',false,5),
  (NULL,'advertencia','Cópia arquivada no prontuário do colaborador','Manter histórico disciplinar organizado',true,6),
  (NULL,'atestado_afastamento','Atestado médico recebido e validado','Verificar autenticidade, CRM do médico e período',true,1),
  (NULL,'atestado_afastamento','CID informado (quando autorizado)','Registrar CID se consentido pelo colaborador',false,2),
  (NULL,'atestado_afastamento','Lançamento no sistema de ponto realizado','Justificativa de falta registrada no ponto',true,3),
  (NULL,'atestado_afastamento','Reflexo na folha comunicado à contabilidade','Informar impacto no cálculo do mês',true,4),
  (NULL,'atestado_afastamento','CAT emitida (acidente de trabalho)','Comunicação de Acidente de Trabalho quando aplicável',false,5),
  (NULL,'atestado_afastamento','Afastamento INSS iniciado (>= 15 dias)','Abertura de benefício previdenciário se aplicável',false,6),
  (NULL,'atestado_afastamento','ASO de retorno emitido (>= 30 dias)','Exame de retorno conforme NR-7',false,7),
  (NULL,'ponto_folha','Espelho de ponto fechado e conferido','Verificar inconsistências, faltas e horas extras',true,1),
  (NULL,'ponto_folha','Horas extras apuradas e autorizadas','Validação de HE 50% e 100%',true,2),
  (NULL,'ponto_folha','Banco de horas atualizado','Saldo por colaborador revisado',false,3),
  (NULL,'ponto_folha','Afastamentos e atestados lançados','Todos os afastamentos do período registrados',true,4),
  (NULL,'ponto_folha','Eventos variáveis informados','Comissões, adicionais, descontos e outros eventos',false,5),
  (NULL,'ponto_folha','Fechamento autorizado pelo responsável','Aprovação do gestor ou RH para envio',true,6),
  (NULL,'eventos_variaveis','Comissões calculadas e comprovadas','Relatório com memória de cálculo',true,1),
  (NULL,'eventos_variaveis','Adicionais conferidos (noturno, periculosidade, insalubridade)','Bases e percentuais conforme CCT',true,2),
  (NULL,'eventos_variaveis','Descontos autorizados documentados','Vale-transporte, plano de saúde, pensão, etc.',false,3),
  (NULL,'eventos_variaveis','PLR/PPR informado (quando aplicável)','Conforme acordo coletivo',false,4),
  (NULL,'eventos_variaveis','Planilha de variáveis enviada à contabilidade','Arquivo consolidado do período',true,5),
  (NULL,'solicitacao_geral','Descrição completa da solicitação informada','Detalhar o pedido com contexto suficiente',true,1),
  (NULL,'solicitacao_geral','Documentos de suporte anexados','Qualquer documento necessário para atender a solicitação',false,2),
  (NULL,'solicitacao_geral','Prazo desejado informado','Data limite para resposta ou entrega',false,3);

-- ============================================================
-- 3. Função de trigger: popular checklist ao criar processo
-- ============================================================
CREATE OR REPLACE FUNCTION public.popular_checklist_hub_processo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.hub_processo_checklist (
    tenant_id, processo_id, item, descricao, obrigatorio, ordem, preenchido_automaticamente
  )
  SELECT DISTINCT ON (t.item)
    NEW.tenant_id,
    NEW.id,
    t.item,
    t.descricao,
    t.obrigatorio,
    t.ordem,
    true
  FROM public.hub_checklist_templates t
  WHERE t.tipo = NEW.tipo
    AND t.ativo = true
    AND (t.tenant_id = NEW.tenant_id OR t.tenant_id IS NULL)
  ORDER BY t.item, t.tenant_id NULLS LAST;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 4. Trigger no hub_processos
-- ============================================================
CREATE TRIGGER trg_popular_checklist_hub_processo
  AFTER INSERT ON public.hub_processos
  FOR EACH ROW
  EXECUTE FUNCTION public.popular_checklist_hub_processo();
