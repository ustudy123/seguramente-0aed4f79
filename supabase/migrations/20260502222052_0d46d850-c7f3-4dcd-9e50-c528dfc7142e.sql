-- Create blog_posts table
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  author_id UUID REFERENCES auth.users(id),
  featured_image TEXT,
  status TEXT DEFAULT 'draft', -- 'draft', 'published'
  category TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Policies
-- Everyone authenticated can view published posts
CREATE POLICY "Anyone authenticated can view published posts"
  ON public.blog_posts
  FOR SELECT
  TO authenticated
  USING (status = 'published' OR EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid()));

-- Only superadmins can insert/update/delete
CREATE POLICY "Only superadmins can manage blog posts"
  ON public.blog_posts
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid()));

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_blog_posts_updated_at
BEFORE UPDATE ON public.blog_posts
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();