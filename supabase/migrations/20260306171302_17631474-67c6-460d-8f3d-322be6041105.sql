-- All token columns are UUID type. Use uuid params.

-- 1. programa_validador_clientes
DROP POLICY IF EXISTS "public_read_by_activation_token" ON public.programa_validador_clientes;
CREATE POLICY "no_public_read_clientes" ON public.programa_validador_clientes FOR SELECT TO anon, authenticated USING (false);

CREATE OR REPLACE FUNCTION public.buscar_cliente_por_activation_token(p_token text)
RETURNS TABLE(id uuid, nome_empresa text, poc_nome text, poc_email text, cnpj text, onboarding_token uuid, conta_ativada boolean, activation_token_expires_at timestamptz, tenant_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, nome_empresa, poc_nome, poc_email, cnpj, onboarding_token, conta_ativada, activation_token_expires_at, tenant_id
  FROM public.programa_validador_clientes WHERE activation_token = p_token AND activation_token IS NOT NULL LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.buscar_cliente_por_onboarding_token(p_token uuid)
RETURNS TABLE(id uuid, nome_empresa text, poc_nome text, poc_email text, cnpj text, onboarding_token uuid, conta_ativada boolean, activation_token_expires_at timestamptz, tenant_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, nome_empresa, poc_nome, poc_email, cnpj, programa_validador_clientes.onboarding_token, conta_ativada, activation_token_expires_at, tenant_id
  FROM public.programa_validador_clientes WHERE programa_validador_clientes.onboarding_token = p_token AND programa_validador_clientes.onboarding_token IS NOT NULL LIMIT 1;
$$;

-- 2. programa_validador_contratos (token = uuid)
DROP POLICY IF EXISTS "Public token select contratos" ON public.programa_validador_contratos;
DROP POLICY IF EXISTS "Public token update contratos" ON public.programa_validador_contratos;

CREATE OR REPLACE FUNCTION public.buscar_contrato_por_token(p_token uuid)
RETURNS TABLE(id uuid, token uuid, status text, assinado_em timestamptz, html_assinado text, html_contrato text, cliente_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, programa_validador_contratos.token, status, assinado_em, html_assinado, html_contrato, cliente_id
  FROM public.programa_validador_contratos WHERE programa_validador_contratos.token = p_token LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.assinar_contrato_por_token(p_token uuid, p_html_assinado text, p_assinatura_imagem text, p_assinante_nome text, p_assinante_ip text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.programa_validador_contratos SET status = 'assinado', assinado_em = now(), html_assinado = p_html_assinado, assinatura_imagem = p_assinatura_imagem, assinante_nome = p_assinante_nome, assinante_ip = p_assinante_ip WHERE programa_validador_contratos.token = p_token AND status != 'assinado';
END; $$;

-- 3. programa_validador_documento_links (token = uuid)
DROP POLICY IF EXISTS "public_read_by_token" ON public.programa_validador_documento_links;
DROP POLICY IF EXISTS "public_update_by_token" ON public.programa_validador_documento_links;

CREATE OR REPLACE FUNCTION public.buscar_documento_link_por_token(p_token uuid)
RETURNS TABLE(id uuid, tipo text, token uuid, status text, aceito_em timestamptz, html_assinado text, html_documento text, cliente_id uuid, cliente_nome_empresa text, cliente_poc_nome text, cliente_poc_email text, cliente_onboarding_token uuid, cliente_tenant_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT dl.id, dl.tipo, dl.token, dl.status, dl.aceito_em, dl.html_assinado, dl.html_documento, dl.cliente_id, c.nome_empresa, c.poc_nome, c.poc_email, c.onboarding_token, c.tenant_id
  FROM public.programa_validador_documento_links dl JOIN public.programa_validador_clientes c ON c.id = dl.cliente_id WHERE dl.token = p_token LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.atualizar_documento_link_por_token(p_token uuid, p_status text, p_html_assinado text DEFAULT NULL, p_assinante_nome text DEFAULT NULL, p_assinante_ip text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.programa_validador_documento_links SET status = p_status, aceito_em = CASE WHEN p_status = 'aceito' THEN now() ELSE aceito_em END, html_assinado = COALESCE(p_html_assinado, html_assinado), assinante_nome = COALESCE(p_assinante_nome, assinante_nome), assinante_ip = COALESCE(p_assinante_ip, assinante_ip) WHERE programa_validador_documento_links.token = p_token;
END; $$;

-- 4. campanhas psicossociais
DROP POLICY IF EXISTS "Acesso público para ler campanhas via convite" ON public.questionario_psicossocial_campanhas;

-- 5. Corrigir USING(true) em escrita
DROP POLICY IF EXISTS "Acesso público via token para atualizar convite" ON public.questionario_psicossocial_convites;
DROP POLICY IF EXISTS "Acesso público para inserir respostas via token" ON public.questionario_psicossocial_respostas;

DROP POLICY IF EXISTS "Anyone can insert leads" ON public.landing_leads;
CREATE POLICY "Anon can insert leads" ON public.landing_leads FOR INSERT TO anon WITH CHECK (true);