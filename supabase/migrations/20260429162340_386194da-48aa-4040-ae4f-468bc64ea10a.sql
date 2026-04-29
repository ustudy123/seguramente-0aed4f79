-- ============================================================
-- ORDEM DE SERVIÇO (NR-1, item 1.4.1 alínea "b")
-- ============================================================

-- 1. Tabela principal de Ordens de Serviço
CREATE TABLE IF NOT EXISTS public.ordens_servico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  empresa_id UUID,
  colaborador_id UUID NOT NULL, -- referencia admissoes.id
  cargo_id UUID,
  cargo_nome TEXT,
  setor_nome TEXT,
  numero_sequencial INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  numero_formatado TEXT GENERATED ALWAYS AS ('OS ' || lpad(numero_sequencial::text, 4, '0') || '/' || ano::text) STORED,
  pgr_id UUID REFERENCES public.sst_documentos(id) ON DELETE SET NULL,
  conteudo_html TEXT,
  conteudo_json JSONB,
  data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vigencia DATE,
  status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','aguardando_assinatura','assinada','vencida','desatualizada','cancelada')),
  assinada_em TIMESTAMPTZ,
  assinatura_selfie_url TEXT,
  assinatura_geo JSONB,
  assinatura_ip TEXT,
  assinatura_hash TEXT,
  responsavel_emissao_id UUID,
  responsavel_emissao_nome TEXT,
  responsavel_tecnico_nome TEXT,
  responsavel_tecnico_registro TEXT,
  motivo_reemissao TEXT,
  pdf_url TEXT,
  versao INTEGER NOT NULL DEFAULT 1,
  os_anterior_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  criado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_os_tenant_empresa ON public.ordens_servico(tenant_id, empresa_id);
CREATE INDEX IF NOT EXISTS idx_os_colaborador ON public.ordens_servico(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_os_status ON public.ordens_servico(status);
CREATE INDEX IF NOT EXISTS idx_os_pgr ON public.ordens_servico(pgr_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_os_tenant_empresa_seq_ano
  ON public.ordens_servico(tenant_id, COALESCE(empresa_id, '00000000-0000-0000-0000-000000000000'::uuid), ano, numero_sequencial);

-- 2. Tabela de links públicos (token) para assinatura
CREATE TABLE IF NOT EXISTS public.ordem_servico_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ordem_servico_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  tenant_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  used_at TIMESTAMPTZ,
  enviado_via TEXT, -- 'email','whatsapp','presencial'
  enviado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_os_links_token ON public.ordem_servico_links(token);
CREATE INDEX IF NOT EXISTS idx_os_links_os ON public.ordem_servico_links(ordem_servico_id);

-- 3. Trigger updated_at
CREATE TRIGGER trg_os_updated_at
  BEFORE UPDATE ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Trigger para gerar número sequencial automaticamente (por empresa + ano)
CREATE OR REPLACE FUNCTION public.gerar_numero_os()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.numero_sequencial IS NULL OR NEW.numero_sequencial = 0 THEN
    SELECT COALESCE(MAX(numero_sequencial), 0) + 1
      INTO NEW.numero_sequencial
      FROM public.ordens_servico
     WHERE tenant_id = NEW.tenant_id
       AND COALESCE(empresa_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = COALESCE(NEW.empresa_id, '00000000-0000-0000-0000-000000000000'::uuid)
       AND ano = NEW.ano;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_os_numero_sequencial
  BEFORE INSERT ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.gerar_numero_os();

-- 5. Trigger: quando novo PGR é importado, marcar OS antigas como desatualizadas
CREATE OR REPLACE FUNCTION public.marcar_os_desatualizadas_apos_pgr()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo = 'PGR' AND NEW.status = 'vigente' THEN
    UPDATE public.ordens_servico
       SET status = 'desatualizada',
           updated_at = now()
     WHERE tenant_id = NEW.tenant_id
       AND COALESCE(empresa_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = COALESCE(NEW.empresa_id, '00000000-0000-0000-0000-000000000000'::uuid)
       AND status IN ('assinada','aguardando_assinatura')
       AND (pgr_id IS NULL OR pgr_id <> NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pgr_marca_os_desatualizadas
  AFTER INSERT ON public.sst_documentos
  FOR EACH ROW EXECUTE FUNCTION public.marcar_os_desatualizadas_apos_pgr();

-- 6. RLS
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordem_servico_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "OS visíveis no tenant"
  ON public.ordens_servico FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "OS inserção no tenant"
  ON public.ordens_servico FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "OS update no tenant"
  ON public.ordens_servico FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "OS delete no tenant"
  ON public.ordens_servico FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "OS links visíveis no tenant"
  ON public.ordem_servico_links FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "OS links inserção no tenant"
  ON public.ordem_servico_links FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "OS links update no tenant"
  ON public.ordem_servico_links FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

-- 7. RPC pública para visualizar OS via token (SECURITY DEFINER, sem PII desnecessária)
CREATE OR REPLACE FUNCTION public.obter_ordem_servico_publica(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link RECORD;
  v_os RECORD;
  v_result JSONB;
BEGIN
  SELECT * INTO v_link
    FROM public.ordem_servico_links
   WHERE token = p_token
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('erro','token_invalido');
  END IF;

  IF v_link.expires_at < now() THEN
    RETURN jsonb_build_object('erro','token_expirado');
  END IF;

  SELECT id, numero_formatado, conteudo_html, status, assinada_em,
         cargo_nome, setor_nome, data_emissao, data_vigencia
    INTO v_os
    FROM public.ordens_servico
   WHERE id = v_link.ordem_servico_id;

  RETURN jsonb_build_object(
    'id', v_os.id,
    'numero', v_os.numero_formatado,
    'conteudo_html', v_os.conteudo_html,
    'status', v_os.status,
    'assinada_em', v_os.assinada_em,
    'cargo', v_os.cargo_nome,
    'setor', v_os.setor_nome,
    'data_emissao', v_os.data_emissao,
    'data_vigencia', v_os.data_vigencia
  );
END;
$$;

-- 8. RPC pública para assinar OS via token
CREATE OR REPLACE FUNCTION public.assinar_ordem_servico_publica(
  p_token TEXT,
  p_selfie_url TEXT,
  p_geo JSONB,
  p_ip TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link RECORD;
  v_os_id UUID;
  v_hash TEXT;
BEGIN
  SELECT * INTO v_link
    FROM public.ordem_servico_links
   WHERE token = p_token
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso',false,'erro','token_invalido');
  END IF;

  IF v_link.expires_at < now() THEN
    RETURN jsonb_build_object('sucesso',false,'erro','token_expirado');
  END IF;

  IF v_link.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('sucesso',false,'erro','ja_assinada');
  END IF;

  v_os_id := v_link.ordem_servico_id;
  v_hash := encode(digest(v_os_id::text || COALESCE(p_selfie_url,'') || COALESCE(p_ip,'') || now()::text, 'sha256'), 'hex');

  UPDATE public.ordens_servico
     SET status = 'assinada',
         assinada_em = now(),
         assinatura_selfie_url = p_selfie_url,
         assinatura_geo = p_geo,
         assinatura_ip = p_ip,
         assinatura_hash = v_hash,
         updated_at = now()
   WHERE id = v_os_id;

  UPDATE public.ordem_servico_links
     SET used_at = now()
   WHERE id = v_link.id;

  RETURN jsonb_build_object('sucesso',true,'hash',v_hash);
END;
$$;

GRANT EXECUTE ON FUNCTION public.obter_ordem_servico_publica(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assinar_ordem_servico_publica(TEXT, TEXT, JSONB, TEXT) TO anon, authenticated;

-- 9. Adicionar mapeamento de pasta padrão "Ordens de Serviço"
-- (será criada dinamicamente pelo hook quando necessário)