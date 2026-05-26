
-- 1. Adiciona tipo_instrumento à campanha (questionario | entrevista_guiada)
ALTER TABLE public.questionario_psicossocial_campanhas
  ADD COLUMN IF NOT EXISTS tipo_instrumento text NOT NULL DEFAULT 'questionario';

-- Validação flexível via trigger (CHECK constraints podem ser restritivos demais ao evoluir)
CREATE OR REPLACE FUNCTION public.validate_tipo_instrumento_campanha()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.tipo_instrumento NOT IN ('questionario','entrevista_guiada') THEN
    RAISE EXCEPTION 'tipo_instrumento inválido: %', NEW.tipo_instrumento;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_tipo_instrumento ON public.questionario_psicossocial_campanhas;
CREATE TRIGGER trg_validate_tipo_instrumento
  BEFORE INSERT OR UPDATE ON public.questionario_psicossocial_campanhas
  FOR EACH ROW EXECUTE FUNCTION public.validate_tipo_instrumento_campanha();

-- 2. Tabela: sessão de entrevista
CREATE TABLE public.psicossocial_entrevistas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  empresa_id uuid,
  campanha_id uuid NOT NULL REFERENCES public.questionario_psicossocial_campanhas(id) ON DELETE CASCADE,
  colaborador_id uuid,
  colaborador_nome text,
  ghe_id_snapshot uuid,
  token text UNIQUE NOT NULL DEFAULT replace(gen_random_uuid()::text,'-',''),
  modalidade text NOT NULL DEFAULT 'texto',
  status text NOT NULL DEFAULT 'pendente',
  consentimento_lgpd_em timestamptz,
  iniciada_em timestamptz,
  concluida_em timestamptz,
  resumo_ia jsonb,
  fase_atual int NOT NULL DEFAULT 1,
  riscos_cobertos int NOT NULL DEFAULT 0,
  total_riscos int NOT NULL DEFAULT 13,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.psicossocial_entrevistas TO authenticated;
GRANT ALL ON public.psicossocial_entrevistas TO service_role;

ALTER TABLE public.psicossocial_entrevistas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant pode ver suas entrevistas"
  ON public.psicossocial_entrevistas FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant pode criar entrevistas"
  ON public.psicossocial_entrevistas FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant pode atualizar entrevistas"
  ON public.psicossocial_entrevistas FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant pode deletar entrevistas"
  ON public.psicossocial_entrevistas FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE INDEX idx_entrevistas_campanha ON public.psicossocial_entrevistas(campanha_id);
CREATE INDEX idx_entrevistas_tenant ON public.psicossocial_entrevistas(tenant_id);
CREATE INDEX idx_entrevistas_token ON public.psicossocial_entrevistas(token);

-- 3. Tabela: mensagens
CREATE TABLE public.psicossocial_entrevistas_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entrevista_id uuid NOT NULL REFERENCES public.psicossocial_entrevistas(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  origem text NOT NULL DEFAULT 'texto',
  fase int,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.psicossocial_entrevistas_mensagens TO authenticated;
GRANT ALL ON public.psicossocial_entrevistas_mensagens TO service_role;

ALTER TABLE public.psicossocial_entrevistas_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant pode ver mensagens da entrevista"
  ON public.psicossocial_entrevistas_mensagens FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.psicossocial_entrevistas e
    WHERE e.id = entrevista_id AND e.tenant_id = public.get_user_tenant_id()
  ));

CREATE INDEX idx_entrev_msg_entrevista ON public.psicossocial_entrevistas_mensagens(entrevista_id, created_at);

-- 4. Tabela: evidências extraídas
CREATE TABLE public.psicossocial_entrevistas_evidencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entrevista_id uuid NOT NULL REFERENCES public.psicossocial_entrevistas(id) ON DELETE CASCADE,
  campanha_id uuid NOT NULL REFERENCES public.questionario_psicossocial_campanhas(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  empresa_id uuid,
  risco_catalogo_id uuid REFERENCES public.psicossocial_riscos(id) ON DELETE SET NULL,
  risco_nome text NOT NULL,
  presente boolean NOT NULL DEFAULT true,
  probabilidade int CHECK (probabilidade BETWEEN 1 AND 5),
  severidade int CHECK (severidade BETWEEN 1 AND 5),
  nivel_risco text,
  justificativa text,
  trechos_anonimizados text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.psicossocial_entrevistas_evidencias TO authenticated;
GRANT ALL ON public.psicossocial_entrevistas_evidencias TO service_role;

ALTER TABLE public.psicossocial_entrevistas_evidencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant pode ver evidências"
  ON public.psicossocial_entrevistas_evidencias FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant pode editar evidências"
  ON public.psicossocial_entrevistas_evidencias FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant pode criar evidências"
  ON public.psicossocial_entrevistas_evidencias FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant pode deletar evidências"
  ON public.psicossocial_entrevistas_evidencias FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE INDEX idx_entrev_evid_campanha ON public.psicossocial_entrevistas_evidencias(campanha_id);
CREATE INDEX idx_entrev_evid_risco ON public.psicossocial_entrevistas_evidencias(risco_catalogo_id);

-- 5. Trigger updated_at
CREATE TRIGGER trg_entrevistas_updated_at
  BEFORE UPDATE ON public.psicossocial_entrevistas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. RPC pública: ler dados mínimos da entrevista via token
CREATE OR REPLACE FUNCTION public.get_entrevista_by_token(p_token text)
RETURNS TABLE (
  id uuid,
  campanha_id uuid,
  campanha_nome text,
  empresa_nome text,
  modalidade text,
  status text,
  fase_atual int,
  riscos_cobertos int,
  total_riscos int,
  consentimento_lgpd_em timestamptz,
  iniciada_em timestamptz,
  concluida_em timestamptz
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT e.id, e.campanha_id, c.nome, emp.razao_social,
         e.modalidade, e.status, e.fase_atual, e.riscos_cobertos, e.total_riscos,
         e.consentimento_lgpd_em, e.iniciada_em, e.concluida_em
  FROM public.psicossocial_entrevistas e
  JOIN public.questionario_psicossocial_campanhas c ON c.id = e.campanha_id
  LEFT JOIN public.empresa_cadastro emp ON emp.id = e.empresa_id
  WHERE e.token = p_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_entrevista_by_token(text) TO anon, authenticated;

-- 7. RPC pública: listar mensagens da entrevista (para retomar)
CREATE OR REPLACE FUNCTION public.list_entrevista_mensagens_by_token(p_token text)
RETURNS TABLE (id uuid, role text, content text, origem text, fase int, created_at timestamptz)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT m.id, m.role, m.content, m.origem, m.fase, m.created_at
  FROM public.psicossocial_entrevistas_mensagens m
  JOIN public.psicossocial_entrevistas e ON e.id = m.entrevista_id
  WHERE e.token = p_token
    AND m.role IN ('user','assistant')
  ORDER BY m.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.list_entrevista_mensagens_by_token(text) TO anon, authenticated;

-- 8. RPC pública: registrar consentimento e iniciar
CREATE OR REPLACE FUNCTION public.aceitar_consentimento_entrevista(p_token text, p_modalidade text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  UPDATE public.psicossocial_entrevistas
     SET consentimento_lgpd_em = COALESCE(consentimento_lgpd_em, now()),
         iniciada_em = COALESCE(iniciada_em, now()),
         status = CASE WHEN status = 'pendente' THEN 'em_andamento' ELSE status END,
         modalidade = COALESCE(p_modalidade, modalidade),
         updated_at = now()
   WHERE token = p_token
   RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.aceitar_consentimento_entrevista(text, text) TO anon, authenticated;
