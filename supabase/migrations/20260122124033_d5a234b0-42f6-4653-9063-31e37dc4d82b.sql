-- Criar tabela de posts do feed
CREATE TABLE public.feed_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  autor_id UUID NOT NULL,
  autor_nome TEXT NOT NULL,
  autor_avatar TEXT,
  tipo TEXT NOT NULL DEFAULT 'post' CHECK (tipo IN ('post', 'anuncio', 'aniversario', 'tempo_casa')),
  conteudo TEXT NOT NULL,
  imagem_url TEXT,
  fixado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de reações
CREATE TABLE public.feed_reacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('curtir', 'amei', 'parabens', 'apoio', 'inspirador')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Criar tabela de comentários
CREATE TABLE public.feed_comentarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL,
  autor_nome TEXT NOT NULL,
  autor_avatar TEXT,
  conteudo TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_reacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_comentarios ENABLE ROW LEVEL SECURITY;

-- Índices para performance
CREATE INDEX idx_feed_posts_tenant_created ON public.feed_posts(tenant_id, created_at DESC);
CREATE INDEX idx_feed_posts_fixado ON public.feed_posts(tenant_id, fixado) WHERE fixado = true;
CREATE INDEX idx_feed_reacoes_post ON public.feed_reacoes(post_id);
CREATE INDEX idx_feed_comentarios_post ON public.feed_comentarios(post_id, created_at);

-- Trigger para updated_at
CREATE TRIGGER update_feed_posts_updated_at
  BEFORE UPDATE ON public.feed_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies para feed_posts

-- Todos podem ver posts do seu tenant
CREATE POLICY "Usuários podem ver posts do seu tenant"
  ON public.feed_posts
  FOR SELECT
  USING (tenant_id = get_user_tenant_id());

-- Todos podem criar posts normais
CREATE POLICY "Usuários podem criar posts normais"
  ON public.feed_posts
  FOR INSERT
  WITH CHECK (
    tenant_id = get_user_tenant_id() 
    AND autor_id = auth.uid()
    AND tipo = 'post'
  );

-- Managers+ podem criar anúncios e posts especiais
CREATE POLICY "Managers podem criar anúncios"
  ON public.feed_posts
  FOR INSERT
  WITH CHECK (
    tenant_id = get_user_tenant_id() 
    AND autor_id = auth.uid()
    AND tipo IN ('anuncio', 'aniversario', 'tempo_casa')
    AND has_minimum_role(auth.uid(), 'manager'::app_role)
  );

-- Autor pode atualizar seu próprio post
CREATE POLICY "Autor pode atualizar próprio post"
  ON public.feed_posts
  FOR UPDATE
  USING (tenant_id = get_user_tenant_id() AND autor_id = auth.uid())
  WITH CHECK (tenant_id = get_user_tenant_id() AND autor_id = auth.uid());

-- Managers podem fixar/desfixar posts
CREATE POLICY "Managers podem gerenciar posts"
  ON public.feed_posts
  FOR UPDATE
  USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role));

-- Autor ou admin pode deletar post
CREATE POLICY "Autor ou admin pode deletar post"
  ON public.feed_posts
  FOR DELETE
  USING (
    tenant_id = get_user_tenant_id() 
    AND (autor_id = auth.uid() OR has_minimum_role(auth.uid(), 'admin'::app_role))
  );

-- RLS Policies para feed_reacoes

-- Todos podem ver reações do seu tenant
CREATE POLICY "Usuários podem ver reações do seu tenant"
  ON public.feed_reacoes
  FOR SELECT
  USING (tenant_id = get_user_tenant_id());

-- Todos podem reagir
CREATE POLICY "Usuários podem reagir"
  ON public.feed_reacoes
  FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id() AND user_id = auth.uid());

-- Usuário pode remover própria reação
CREATE POLICY "Usuário pode remover própria reação"
  ON public.feed_reacoes
  FOR DELETE
  USING (tenant_id = get_user_tenant_id() AND user_id = auth.uid());

-- RLS Policies para feed_comentarios

-- Todos podem ver comentários do seu tenant
CREATE POLICY "Usuários podem ver comentários do seu tenant"
  ON public.feed_comentarios
  FOR SELECT
  USING (tenant_id = get_user_tenant_id());

-- Todos podem comentar
CREATE POLICY "Usuários podem comentar"
  ON public.feed_comentarios
  FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id() AND autor_id = auth.uid());

-- Autor ou admin pode deletar comentário
CREATE POLICY "Autor ou admin pode deletar comentário"
  ON public.feed_comentarios
  FOR DELETE
  USING (
    tenant_id = get_user_tenant_id() 
    AND (autor_id = auth.uid() OR has_minimum_role(auth.uid(), 'admin'::app_role))
  );

-- Criar bucket para imagens do feed
INSERT INTO storage.buckets (id, name, public) 
VALUES ('feed-imagens', 'feed-imagens', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para feed-imagens
CREATE POLICY "Imagens do feed são públicas"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'feed-imagens');

CREATE POLICY "Usuários autenticados podem fazer upload de imagens"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'feed-imagens' 
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Usuários podem deletar próprias imagens"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'feed-imagens' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );