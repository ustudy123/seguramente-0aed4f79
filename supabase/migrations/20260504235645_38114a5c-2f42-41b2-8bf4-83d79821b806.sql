
-- ============================================
-- SUPER ADMIN: Leads CRM + Estatísticas Globais
-- ============================================

-- Enum de status do funil
DO $$ BEGIN
  CREATE TYPE public.lead_status AS ENUM (
    'novo','contatado','qualificado','proposta','negociacao','convertido','perdido'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.lead_origem AS ENUM (
    'landing_page','indicacao','prospect_manual','linkedin','whatsapp','evento','outro'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Tabela CRM
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  empresa TEXT,
  cargo TEXT,
  origem public.lead_origem NOT NULL DEFAULT 'prospect_manual',
  status public.lead_status NOT NULL DEFAULT 'novo',
  valor_estimado NUMERIC(12,2),
  responsavel_id UUID,
  proxima_acao_data DATE,
  proxima_acao_descricao TEXT,
  notas TEXT,
  tags TEXT[] DEFAULT '{}',
  landing_lead_id UUID REFERENCES public.landing_leads(id) ON DELETE SET NULL,
  tenant_convertido_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  ultimo_contato_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_origem ON public.leads(origem);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_responsavel ON public.leads(responsavel_id);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Função helper de superadmin (se não existir)
CREATE OR REPLACE FUNCTION public.is_superadmin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.superadmins
    WHERE user_id = _user_id AND ativo = true
  );
$$;

-- Policies: somente superadmins
DROP POLICY IF EXISTS "Superadmins full access leads" ON public.leads;
CREATE POLICY "Superadmins full access leads"
ON public.leads
FOR ALL
TO authenticated
USING (public.is_superadmin(auth.uid()))
WITH CHECK (public.is_superadmin(auth.uid()));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS leads_set_updated_at ON public.leads;
CREATE TRIGGER leads_set_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================
-- HISTÓRICO DE INTERAÇÕES (timeline)
-- ============================================
CREATE TABLE IF NOT EXISTS public.lead_interacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('whatsapp','email','ligacao','reuniao','nota','status_change')),
  conteudo TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_interacoes_lead ON public.lead_interacoes(lead_id, created_at DESC);

ALTER TABLE public.lead_interacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Superadmins full access interacoes" ON public.lead_interacoes;
CREATE POLICY "Superadmins full access interacoes"
ON public.lead_interacoes FOR ALL TO authenticated
USING (public.is_superadmin(auth.uid()))
WITH CHECK (public.is_superadmin(auth.uid()));

-- ============================================
-- RPC: Estatísticas globais para Super Admin
-- ============================================
CREATE OR REPLACE FUNCTION public.superadmin_global_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT jsonb_build_object(
    'tenants', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM tenants),
      'ativos', (SELECT COUNT(*) FROM tenants WHERE ativo = true),
      'novos_30d', (SELECT COUNT(*) FROM tenants WHERE created_at > now() - interval '30 days')
    ),
    'usuarios', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM profiles),
      'ativos_7d', (SELECT COUNT(DISTINCT user_id) FROM profiles WHERE updated_at > now() - interval '7 days')
    ),
    'colaboradores', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM admissoes WHERE status = 'concluido'),
      'novos_30d', (SELECT COUNT(*) FROM admissoes WHERE status = 'concluido' AND created_at > now() - interval '30 days')
    ),
    'leads', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM leads),
      'novos_7d', (SELECT COUNT(*) FROM leads WHERE created_at > now() - interval '7 days'),
      'convertidos', (SELECT COUNT(*) FROM leads WHERE status = 'convertido'),
      'em_negociacao', (SELECT COUNT(*) FROM leads WHERE status IN ('proposta','negociacao'))
    ),
    'landing_leads', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM landing_leads),
      'com_diagnostico', (SELECT COUNT(*) FROM landing_leads WHERE pontuacao_diagnostico IS NOT NULL),
      'convertidos', (SELECT COUNT(*) FROM landing_leads WHERE convertido = true)
    ),
    'campanhas_psicossociais', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM questionario_psicossocial_campanhas),
      'ativas', (SELECT COUNT(*) FROM questionario_psicossocial_campanhas WHERE status = 'em_andamento'),
      'finalizadas', (SELECT COUNT(*) FROM questionario_psicossocial_campanhas WHERE status = 'finalizada')
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================
-- RPC: Crescimento (séries temporais)
-- ============================================
CREATE OR REPLACE FUNCTION public.superadmin_growth_series(_dias INT DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  WITH dias AS (
    SELECT generate_series(
      (now() - (_dias || ' days')::interval)::date,
      now()::date,
      '1 day'::interval
    )::date AS dia
  ),
  tenants_dia AS (
    SELECT created_at::date AS dia, COUNT(*)::int AS qtd
    FROM tenants WHERE created_at > now() - (_dias || ' days')::interval
    GROUP BY 1
  ),
  leads_dia AS (
    SELECT created_at::date AS dia, COUNT(*)::int AS qtd
    FROM leads WHERE created_at > now() - (_dias || ' days')::interval
    GROUP BY 1
  ),
  usuarios_dia AS (
    SELECT created_at::date AS dia, COUNT(*)::int AS qtd
    FROM profiles WHERE created_at > now() - (_dias || ' days')::interval
    GROUP BY 1
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'dia', to_char(d.dia, 'DD/MM'),
      'tenants', COALESCE(t.qtd, 0),
      'leads', COALESCE(l.qtd, 0),
      'usuarios', COALESCE(u.qtd, 0)
    ) ORDER BY d.dia
  ) INTO result
  FROM dias d
  LEFT JOIN tenants_dia t ON t.dia = d.dia
  LEFT JOIN leads_dia l ON l.dia = d.dia
  LEFT JOIN usuarios_dia u ON u.dia = d.dia;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- ============================================
-- RPC: Status por Tenant (campanhas + módulos)
-- ============================================
CREATE OR REPLACE FUNCTION public.superadmin_tenants_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'tenant_id', t.id,
      'tenant_nome', t.nome,
      'plano', t.plano,
      'ativo', t.ativo,
      'usuarios', (SELECT COUNT(*) FROM profiles WHERE tenant_id = t.id),
      'colaboradores', (SELECT COUNT(*) FROM admissoes WHERE tenant_id = t.id AND status = 'concluido'),
      'campanhas_total', (SELECT COUNT(*) FROM questionario_psicossocial_campanhas WHERE tenant_id = t.id),
      'campanhas_ativas', (SELECT COUNT(*) FROM questionario_psicossocial_campanhas WHERE tenant_id = t.id AND status = 'em_andamento'),
      'criado_em', t.created_at,
      'ultimo_acesso', (SELECT MAX(updated_at) FROM profiles WHERE tenant_id = t.id)
    )
  ) INTO result
  FROM tenants t
  ORDER BY t.created_at DESC;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- ============================================
-- RPC: Lista global de usuários (cross-tenant)
-- ============================================
CREATE OR REPLACE FUNCTION public.superadmin_usuarios_global(_search TEXT DEFAULT NULL, _limite INT DEFAULT 100)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT jsonb_agg(row_to_json(p))
  FROM (
    SELECT
      pr.id, pr.user_id, pr.nome_completo, pr.tenant_id,
      pr.tipo_usuario, pr.created_at, pr.updated_at,
      t.nome AS tenant_nome,
      (SELECT email FROM auth.users WHERE id = pr.user_id) AS email
    FROM profiles pr
    LEFT JOIN tenants t ON t.id = pr.tenant_id
    WHERE _search IS NULL
       OR pr.nome_completo ILIKE '%'||_search||'%'
       OR t.nome ILIKE '%'||_search||'%'
    ORDER BY pr.created_at DESC
    LIMIT _limite
  ) p;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;
