
CREATE TABLE public.system_manual (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.system_manual ENABLE ROW LEVEL SECURITY;

-- Allow anyone authenticated to read
CREATE POLICY "Anyone can read system manual"
  ON public.system_manual FOR SELECT
  TO authenticated
  USING (true);

-- Only superadmins can update
CREATE POLICY "Superadmins can update system manual"
  ON public.system_manual FOR UPDATE
  TO authenticated
  USING (public.is_superadmin(auth.uid()));

CREATE POLICY "Superadmins can insert system manual"
  ON public.system_manual FOR INSERT
  TO authenticated
  WITH CHECK (public.is_superadmin(auth.uid()));
