-- Primeiro, vamos garantir que as políticas existentes para ponto_ajustes sejam robustas
-- Já existem políticas, mas o erro "new row violates row-level security policy" em um UPDATE 
-- geralmente acontece quando a cláusula WITH CHECK falha.

-- Verificando se a política de INSERT permite o tenant_id correto
-- A política atual de INSERT é: ((tenant_id = get_user_tenant_id()) OR has_minimum_role(auth.uid(), 'manager'::app_role))
-- Se um manager estiver inserindo para outro tenant (ou se o get_user_tenant_id() falhar), pode dar erro.

-- No caso do UPDATE (aprovação), a política é:
-- Managers+ podem aprovar ajustes: ((tenant_id = get_user_tenant_id()) AND has_minimum_role(auth.uid(), 'manager'::app_role))
-- Se o ajuste que está sendo atualizado tiver um tenant_id diferente do tenant_id do usuário atual, o UPDATE falha.

-- Vamos ajustar as políticas para serem mais resilientes, especialmente para gestores.

-- 1. Ajustar política de SELECT para garantir que gestores vejam tudo do seu tenant
DROP POLICY IF EXISTS "Usuários podem ver ajustes do seu tenant" ON public.ponto_ajustes;
CREATE POLICY "Usuários podem ver ajustes do seu tenant" ON public.ponto_ajustes
FOR SELECT TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2. Ajustar política de INSERT para permitir que usuários e gestores criem ajustes no seu tenant
DROP POLICY IF EXISTS "Usuários podem solicitar ajustes" ON public.ponto_ajustes;
CREATE POLICY "Usuários podem solicitar ajustes" ON public.ponto_ajustes
FOR INSERT TO authenticated
WITH CHECK (tenant_id = get_user_tenant_id());

-- 3. Ajustar política de UPDATE para permitir que gestores aprovem ajustes do seu tenant
DROP POLICY IF EXISTS "Managers+ podem aprovar ajustes" ON public.ponto_ajustes;
CREATE POLICY "Managers+ podem aprovar ajustes" ON public.ponto_ajustes
FOR UPDATE TO authenticated
USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role))
WITH CHECK (tenant_id = get_user_tenant_id());

-- 4. Garantir que a tabela ponto_marcacoes também tenha políticas corretas para quando o ajuste é aprovado
-- O hook usePonto.ts insere em ponto_marcacoes quando aprova um ajuste.
DROP POLICY IF EXISTS "Usuários autenticados podem registrar ponto" ON public.ponto_marcacoes;
CREATE POLICY "Usuários autenticados podem registrar ponto" ON public.ponto_marcacoes
FOR INSERT TO authenticated
WITH CHECK (tenant_id = get_user_tenant_id());

-- Garantindo permissões básicas caso tenham sido perdidas
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ponto_ajustes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ponto_marcacoes TO authenticated;
GRANT ALL ON public.ponto_ajustes TO service_role;
GRANT ALL ON public.ponto_marcacoes TO service_role;
