
-- Fix overly permissive policy on bem_estar_config
DROP POLICY IF EXISTS "Admins can manage config" ON public.bem_estar_config;

CREATE POLICY "Users can insert config" ON public.bem_estar_config
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update config" ON public.bem_estar_config
  FOR UPDATE USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete config" ON public.bem_estar_config
  FOR DELETE USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
  );
