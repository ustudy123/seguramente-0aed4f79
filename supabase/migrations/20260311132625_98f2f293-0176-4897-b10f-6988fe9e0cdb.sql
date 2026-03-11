
-- Academia: Categories
CREATE TABLE public.academia_categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  slug TEXT NOT NULL,
  descricao TEXT,
  icone TEXT DEFAULT 'BookOpen',
  ordem INT DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, slug)
);

-- Academia: Trainings
CREATE TABLE public.academia_treinamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES public.academia_categorias(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  subtitulo TEXT,
  descricao_curta TEXT,
  descricao_completa TEXT,
  imagem_capa TEXT,
  banner TEXT,
  slug TEXT NOT NULL,
  nivel TEXT DEFAULT 'iniciante' CHECK (nivel IN ('iniciante','intermediario','avancado')),
  instrutor TEXT,
  duracao_estimada TEXT,
  tags TEXT[],
  status TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho','publicado')),
  destaque BOOLEAN DEFAULT false,
  ordem INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, slug)
);

-- Academia: Modules (sections inside a training)
CREATE TABLE public.academia_modulos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  treinamento_id UUID NOT NULL REFERENCES public.academia_treinamentos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  ordem INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Academia: Lessons
CREATE TABLE public.academia_aulas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  modulo_id UUID NOT NULL REFERENCES public.academia_modulos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT DEFAULT 'video' CHECK (tipo IN ('video','texto','link')),
  video_url TEXT,
  thumbnail TEXT,
  conteudo_texto TEXT,
  link_externo TEXT,
  duracao TEXT,
  material_complementar JSONB DEFAULT '[]',
  ordem INT DEFAULT 0,
  obrigatoria BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Academia: User progress
CREATE TABLE public.academia_progresso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aula_id UUID NOT NULL REFERENCES public.academia_aulas(id) ON DELETE CASCADE,
  treinamento_id UUID NOT NULL REFERENCES public.academia_treinamentos(id) ON DELETE CASCADE,
  concluida BOOLEAN DEFAULT false,
  concluida_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, aula_id)
);

-- Academia: Favorites
CREATE TABLE public.academia_favoritos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  treinamento_id UUID NOT NULL REFERENCES public.academia_treinamentos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, treinamento_id)
);

-- Academia: Gamification (XP + badges)
CREATE TABLE public.academia_xp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pontos INT DEFAULT 0,
  tipo TEXT NOT NULL,
  referencia_id UUID,
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.academia_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  icone TEXT DEFAULT '🏆',
  treinamento_id UUID REFERENCES public.academia_treinamentos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, nome, treinamento_id)
);

-- RLS
ALTER TABLE public.academia_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academia_treinamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academia_modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academia_aulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academia_progresso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academia_favoritos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academia_xp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academia_badges ENABLE ROW LEVEL SECURITY;

-- RLS Policies: tenant-based read for authenticated users
CREATE POLICY "Users can read categories" ON public.academia_categorias FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id() OR public.is_superadmin(auth.uid()));
CREATE POLICY "Admins manage categories" ON public.academia_categorias FOR ALL TO authenticated USING (tenant_id = public.get_user_tenant_id() AND public.has_minimum_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid())) WITH CHECK (tenant_id = public.get_user_tenant_id() AND public.has_minimum_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

CREATE POLICY "Users can read trainings" ON public.academia_treinamentos FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id() OR public.is_superadmin(auth.uid()));
CREATE POLICY "Admins manage trainings" ON public.academia_treinamentos FOR ALL TO authenticated USING (tenant_id = public.get_user_tenant_id() AND public.has_minimum_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid())) WITH CHECK (tenant_id = public.get_user_tenant_id() AND public.has_minimum_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

CREATE POLICY "Users can read modules" ON public.academia_modulos FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id() OR public.is_superadmin(auth.uid()));
CREATE POLICY "Admins manage modules" ON public.academia_modulos FOR ALL TO authenticated USING (tenant_id = public.get_user_tenant_id() AND public.has_minimum_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid())) WITH CHECK (tenant_id = public.get_user_tenant_id() AND public.has_minimum_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

CREATE POLICY "Users can read lessons" ON public.academia_aulas FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id() OR public.is_superadmin(auth.uid()));
CREATE POLICY "Admins manage lessons" ON public.academia_aulas FOR ALL TO authenticated USING (tenant_id = public.get_user_tenant_id() AND public.has_minimum_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid())) WITH CHECK (tenant_id = public.get_user_tenant_id() AND public.has_minimum_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

CREATE POLICY "Users manage own progress" ON public.academia_progresso FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins read all progress" ON public.academia_progresso FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id() AND public.has_minimum_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

CREATE POLICY "Users manage own favorites" ON public.academia_favoritos FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users manage own xp" ON public.academia_xp FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins read all xp" ON public.academia_xp FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id() AND public.has_minimum_role(auth.uid(), 'admin'));

CREATE POLICY "Users manage own badges" ON public.academia_badges FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins read all badges" ON public.academia_badges FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id() AND public.has_minimum_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER update_academia_categorias_updated_at BEFORE UPDATE ON public.academia_categorias FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_academia_treinamentos_updated_at BEFORE UPDATE ON public.academia_treinamentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_academia_modulos_updated_at BEFORE UPDATE ON public.academia_modulos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_academia_aulas_updated_at BEFORE UPDATE ON public.academia_aulas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
