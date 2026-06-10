-- Ajustando políticas da tabela empresa_cadastro
DROP POLICY IF EXISTS "empresa_cadastro_insert_own" ON public.empresa_cadastro;
CREATE POLICY "empresa_cadastro_insert_manager" ON public.empresa_cadastro 
FOR INSERT TO authenticated 
WITH CHECK (
  tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid() AND ativo = true)
);

DROP POLICY IF EXISTS "empresa_cadastro_update_own" ON public.empresa_cadastro;
CREATE POLICY "empresa_cadastro_update_manager" ON public.empresa_cadastro 
FOR UPDATE TO authenticated 
USING (
  tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid() AND ativo = true)
);

-- Ajustando políticas da tabela cargos
DROP POLICY IF EXISTS "insert_cargos_vinculo" ON public.cargos;
CREATE POLICY "cargos_insert_policy" ON public.cargos 
FOR INSERT TO authenticated 
WITH CHECK (
  tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "update_cargos_vinculo" ON public.cargos;
CREATE POLICY "cargos_update_policy" ON public.cargos 
FOR UPDATE TO authenticated 
USING (
  tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
);

-- Ajustando políticas da tabela departamentos
DROP POLICY IF EXISTS "insert_departamentos_vinculo" ON public.departamentos;
CREATE POLICY "departamentos_insert_policy" ON public.departamentos 
FOR INSERT TO authenticated 
WITH CHECK (
  tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "update_departamentos_vinculo" ON public.departamentos;
CREATE POLICY "departamentos_update_policy" ON public.departamentos 
FOR UPDATE TO authenticated 
USING (
  tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
);

-- Ajustando políticas da tabela usuarios_base (Colaboradores)
DROP POLICY IF EXISTS "tenant_usuarios_insert" ON public.usuarios_base;
CREATE POLICY "usuarios_base_insert_policy" ON public.usuarios_base 
FOR INSERT TO authenticated 
WITH CHECK (
  tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "tenant_usuarios_update" ON public.usuarios_base;
CREATE POLICY "usuarios_base_update_policy" ON public.usuarios_base 
FOR UPDATE TO authenticated 
USING (
  tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
);
