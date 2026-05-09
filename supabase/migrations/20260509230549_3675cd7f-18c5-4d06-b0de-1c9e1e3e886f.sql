DROP POLICY IF EXISTS "Anon can insert leads" ON public.landing_leads;
CREATE POLICY "Anyone can insert leads"
ON public.landing_leads FOR INSERT
TO anon, authenticated
WITH CHECK (true);