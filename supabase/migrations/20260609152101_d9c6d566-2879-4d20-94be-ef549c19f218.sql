ALTER TABLE public.feed_posts DROP CONSTRAINT IF EXISTS feed_posts_tipo_check;
ALTER TABLE public.feed_posts ADD CONSTRAINT feed_posts_tipo_check 
  CHECK (tipo = ANY (ARRAY['post'::text, 'anuncio'::text, 'aniversario'::text, 'tempo_casa'::text, 'aviso'::text]));