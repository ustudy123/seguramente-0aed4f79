-- =========================================================
-- QA — FASE 1: Diretório de documentação de testes
--
-- Base do projeto de agentes de QA. Antes de criar qualquer agente,
-- os casos de teste são documentados aqui (caminho feliz, alternativo,
-- negativo e exceção). O agente é criado A PARTIR desta documentação.
--
-- Estrutura:
--   qa_modulos      → árvore de pastas, espelhando o menu do sistema
--   qa_casos_teste  → os casos de teste, ancorados num módulo
--
-- Acesso: SUPERADMIN apenas (leitura e escrita). Não aparece para
-- nenhum usuário comum — nem por RLS, nem por rota.
--
-- Sem tenant_id: é infraestrutura global de QA do produto, não dado
-- de cliente.
-- =========================================================

-- ---------------------------------------------------------
-- 1) Árvore de módulos (espelho do menu)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qa_modulos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   uuid REFERENCES public.qa_modulos(id) ON DELETE CASCADE,
  label       text NOT NULL,
  path        text NOT NULL UNIQUE,          -- ex.: 'jornada-rotina/ponto'
  icone       text,
  ordem       int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_modulos_parent ON public.qa_modulos(parent_id);

COMMENT ON TABLE public.qa_modulos IS
  'Diretório de documentação de testes — espelha a estrutura de menu do sistema.';

-- ---------------------------------------------------------
-- 2) Casos de teste
-- ---------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.qa_caso_tipo AS ENUM ('feliz', 'alternativo', 'negativo', 'excecao');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.qa_caso_status AS ENUM ('rascunho', 'aprovado', 'obsoleto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.qa_prioridade AS ENUM ('critica', 'alta', 'media', 'baixa');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.qa_casos_teste (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo_id          uuid NOT NULL REFERENCES public.qa_modulos(id) ON DELETE CASCADE,
  codigo             text UNIQUE,                       -- ex.: 'PONTO-001'
  titulo             text NOT NULL,
  tipo               public.qa_caso_tipo      NOT NULL DEFAULT 'feliz',
  prioridade         public.qa_prioridade     NOT NULL DEFAULT 'media',
  status             public.qa_caso_status    NOT NULL DEFAULT 'rascunho',
  objetivo           text,
  pre_condicoes      text,
  -- passos: [{ "ordem": 1, "acao": "...", "resultado_esperado": "..." }]
  passos             jsonb NOT NULL DEFAULT '[]'::jsonb,
  resultado_esperado text,
  observacoes        text,
  -- nível de execução pretendido: 'api' (edge function) | 'e2e' (browser)
  nivel              text NOT NULL DEFAULT 'api',
  versao             int  NOT NULL DEFAULT 1,
  created_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qa_casos_teste_nivel_chk CHECK (nivel IN ('api', 'e2e'))
);

CREATE INDEX IF NOT EXISTS idx_qa_casos_modulo ON public.qa_casos_teste(modulo_id);
CREATE INDEX IF NOT EXISTS idx_qa_casos_status ON public.qa_casos_teste(status);

COMMENT ON TABLE public.qa_casos_teste IS
  'Casos de teste documentados. Fonte da verdade para a criação dos agentes de QA.';
COMMENT ON COLUMN public.qa_casos_teste.passos IS
  'Array de passos: [{ordem, acao, resultado_esperado}].';
COMMENT ON COLUMN public.qa_casos_teste.nivel IS
  'api = executável por edge function (dados/RLS/regras); e2e = exige browser (UI).';

-- updated_at automático (reusa o trigger padrão do projeto)
DROP TRIGGER IF EXISTS trg_qa_casos_updated_at ON public.qa_casos_teste;
CREATE TRIGGER trg_qa_casos_updated_at
  BEFORE UPDATE ON public.qa_casos_teste
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------
-- 3) RLS — superadmin e mais ninguém
-- ---------------------------------------------------------
ALTER TABLE public.qa_modulos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_casos_teste ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full access qa_modulos" ON public.qa_modulos;
CREATE POLICY "Superadmin full access qa_modulos"
  ON public.qa_modulos FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "Superadmin full access qa_casos" ON public.qa_casos_teste;
CREATE POLICY "Superadmin full access qa_casos"
  ON public.qa_casos_teste FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

-- ---------------------------------------------------------
-- 4) Seed da árvore, espelhando o menu (AppSidebar)
-- ---------------------------------------------------------
DO $seed$
DECLARE
  v_sec uuid;
  v_sub uuid;
BEGIN
  -- Estrutura Organizacional
  INSERT INTO public.qa_modulos (label, path, icone, ordem) VALUES ('Estrutura Organizacional','estrutura-organizacional','🏢',1)
    ON CONFLICT (path) DO UPDATE SET label = EXCLUDED.label RETURNING id INTO v_sec;
  INSERT INTO public.qa_modulos (parent_id,label,path,ordem) VALUES
    (v_sec,'Empresa','estrutura-organizacional/empresa',1),
    (v_sec,'Estabelecimentos / Obras','estrutura-organizacional/estabelecimentos',2),
    (v_sec,'Departamentos','estrutura-organizacional/departamentos',3),
    (v_sec,'Cargos','estrutura-organizacional/cargos',4),
    (v_sec,'Colaboradores','estrutura-organizacional/colaboradores',5),
    (v_sec,'Prestadores de Serviços','estrutura-organizacional/prestadores',6),
    (v_sec,'Organograma','estrutura-organizacional/organograma',7)
    ON CONFLICT (path) DO NOTHING;

  -- Planejamento & Gestão
  INSERT INTO public.qa_modulos (label, path, icone, ordem) VALUES ('Planejamento & Gestão','planejamento-gestao','📊',2)
    ON CONFLICT (path) DO UPDATE SET label = EXCLUDED.label RETURNING id INTO v_sec;
  INSERT INTO public.qa_modulos (parent_id,label,path,ordem) VALUES
    (v_sec,'Identidade Estratégica','planejamento-gestao/identidade-estrategica',1),
    (v_sec,'Planejamento Estratégico','planejamento-gestao/planejamento-estrategico',2),
    (v_sec,'Metas','planejamento-gestao/metas',3),
    (v_sec,'Plano de Ação','planejamento-gestao/plano-de-acao',4)
    ON CONFLICT (path) DO NOTHING;

  -- Pessoas & Cultura
  INSERT INTO public.qa_modulos (label, path, icone, ordem) VALUES ('Pessoas & Cultura','pessoas-cultura','👥',3)
    ON CONFLICT (path) DO UPDATE SET label = EXCLUDED.label RETURNING id INTO v_sec;
  INSERT INTO public.qa_modulos (parent_id,label,path,ordem) VALUES
    (v_sec,'Onboarding','pessoas-cultura/onboarding',1),
    (v_sec,'Contratos de Experiência','pessoas-cultura/contratos-experiencia',2),
    (v_sec,'Cultura & Celebrações','pessoas-cultura/cultura-celebracoes',3),
    (v_sec,'Mural Interno','pessoas-cultura/mural-interno',4),
    (v_sec,'Meu Bem-Estar','pessoas-cultura/bem-estar',5),
    (v_sec,'Feedback & Desenvolvimento','pessoas-cultura/feedback-desenvolvimento',6),
    (v_sec,'Ouvidoria','pessoas-cultura/ouvidoria',7)
    ON CONFLICT (path) DO NOTHING;

  -- Desenvolvimento & Performance
  INSERT INTO public.qa_modulos (label, path, icone, ordem) VALUES ('Desenvolvimento & Performance','desenvolvimento-performance','🎓',4)
    ON CONFLICT (path) DO UPDATE SET label = EXCLUDED.label RETURNING id INTO v_sec;
  INSERT INTO public.qa_modulos (parent_id,label,path,ordem) VALUES
    (v_sec,'Aprendizado & Competências','desenvolvimento-performance/aprendizado-competencias',1),
    (v_sec,'Trilhas','desenvolvimento-performance/trilhas',2),
    (v_sec,'Avaliações','desenvolvimento-performance/avaliacoes',3),
    (v_sec,'PDI','desenvolvimento-performance/pdi',4)
    ON CONFLICT (path) DO NOTHING;

  -- Jornada & Rotina
  INSERT INTO public.qa_modulos (label, path, icone, ordem) VALUES ('Jornada & Rotina','jornada-rotina','⏰',5)
    ON CONFLICT (path) DO UPDATE SET label = EXCLUDED.label RETURNING id INTO v_sec;
  INSERT INTO public.qa_modulos (parent_id,label,path,ordem) VALUES
    (v_sec,'Ponto','jornada-rotina/ponto',1),
    (v_sec,'Análise de Jornada','jornada-rotina/analise-jornada',2),
    (v_sec,'Férias','jornada-rotina/ferias',3),
    (v_sec,'Afastamentos','jornada-rotina/afastamentos',4),
    (v_sec,'Saúde Ocupacional (ASO)','jornada-rotina/saude-ocupacional',5),
    (v_sec,'Benefícios','jornada-rotina/beneficios',6)
    ON CONFLICT (path) DO NOTHING;

  -- Saúde & Segurança (tem subgrupo Psicossocial)
  INSERT INTO public.qa_modulos (label, path, icone, ordem) VALUES ('Saúde & Segurança','saude-seguranca','🛡️',6)
    ON CONFLICT (path) DO UPDATE SET label = EXCLUDED.label RETURNING id INTO v_sec;
  INSERT INTO public.qa_modulos (parent_id,label,path,ordem) VALUES
    (v_sec,'Compliance SST','saude-seguranca/compliance-sst',1),
    (v_sec,'Ergonomia','saude-seguranca/ergonomia',3),
    (v_sec,'EPIs','saude-seguranca/epis',4),
    (v_sec,'Incidentes & Acidentes','saude-seguranca/incidentes-acidentes',5)
    ON CONFLICT (path) DO NOTHING;

  INSERT INTO public.qa_modulos (parent_id,label,path,icone,ordem) VALUES (v_sec,'Psicossocial','saude-seguranca/psicossocial','🧠',2)
    ON CONFLICT (path) DO UPDATE SET label = EXCLUDED.label RETURNING id INTO v_sub;
  INSERT INTO public.qa_modulos (parent_id,label,path,ordem) VALUES
    (v_sub,'Visão Geral','saude-seguranca/psicossocial/visao-geral',1),
    (v_sub,'GHE','saude-seguranca/psicossocial/ghe',2),
    (v_sub,'Campanhas','saude-seguranca/psicossocial/campanhas',3),
    (v_sub,'Resultados','saude-seguranca/psicossocial/resultados',4),
    (v_sub,'Inventário PGR','saude-seguranca/psicossocial/inventario-pgr',5),
    (v_sub,'Metodologia','saude-seguranca/psicossocial/metodologia',6)
    ON CONFLICT (path) DO NOTHING;

  -- Documentos & Governança
  INSERT INTO public.qa_modulos (label, path, icone, ordem) VALUES ('Documentos & Governança','documentos-governanca','📁',7)
    ON CONFLICT (path) DO UPDATE SET label = EXCLUDED.label RETURNING id INTO v_sec;
  INSERT INTO public.qa_modulos (parent_id,label,path,ordem) VALUES
    (v_sec,'Documentos','documentos-governanca/documentos',1),
    (v_sec,'Hub Contábil','documentos-governanca/hub-contabil',2)
    ON CONFLICT (path) DO NOTHING;

  -- Financeiro / Rede de Parceiros / Academia / Sistema
  INSERT INTO public.qa_modulos (label, path, icone, ordem) VALUES ('Financeiro','financeiro','💰',8)
    ON CONFLICT (path) DO NOTHING;
  INSERT INTO public.qa_modulos (label, path, icone, ordem) VALUES ('Rede de Parceiros','rede-parceiros','🏪',9)
    ON CONFLICT (path) DO NOTHING;
  INSERT INTO public.qa_modulos (label, path, icone, ordem) VALUES ('Academia','academia','📚',10)
    ON CONFLICT (path) DO NOTHING;

  INSERT INTO public.qa_modulos (label, path, icone, ordem) VALUES ('Sistema','sistema','⚙️',11)
    ON CONFLICT (path) DO UPDATE SET label = EXCLUDED.label RETURNING id INTO v_sec;
  INSERT INTO public.qa_modulos (parent_id,label,path,ordem) VALUES
    (v_sec,'Suporte','sistema/suporte',1),
    (v_sec,'Configurações','sistema/configuracoes',2)
    ON CONFLICT (path) DO NOTHING;

  -- Infra & Auth: não está no menu, mas os agentes atuais testam isso
  INSERT INTO public.qa_modulos (label, path, icone, ordem) VALUES ('Infraestrutura & Auth','infraestrutura-auth','🔧',12)
    ON CONFLICT (path) DO UPDATE SET label = EXCLUDED.label RETURNING id INTO v_sec;
  INSERT INTO public.qa_modulos (parent_id,label,path,ordem) VALUES
    (v_sec,'Autenticação & Perfil','infraestrutura-auth/autenticacao',1),
    (v_sec,'Isolamento RLS','infraestrutura-auth/rls',2),
    (v_sec,'Edge Functions','infraestrutura-auth/edge-functions',3)
    ON CONFLICT (path) DO NOTHING;
END $seed$;
