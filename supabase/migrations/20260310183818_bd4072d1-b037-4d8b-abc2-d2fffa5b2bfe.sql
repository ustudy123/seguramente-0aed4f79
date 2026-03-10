CREATE POLICY "Usuários podem ver próprio profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());