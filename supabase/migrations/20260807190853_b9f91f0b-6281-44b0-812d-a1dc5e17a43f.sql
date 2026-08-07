-- ============ RN26: origem da marcação ============
ALTER TABLE public.ponto_marcacoes
  ADD COLUMN IF NOT EXISTS origem_marcacao text NOT NULL DEFAULT 'O';

DO $$ BEGIN
  ALTER TABLE public.ponto_marcacoes
    ADD CONSTRAINT ponto_marcacoes_origem_chk
    CHECK (origem_marcacao IN ('O','A','P','E','I'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.ponto_marcacoes.origem_marcacao IS
  'Portaria 671 RN26 — O=original do REP, A=ajuste/inclusao manual, P=pre-assinalada, E=excecao (acordo/judicial), I=importada de outro sistema';

UPDATE public.ponto_marcacoes
   SET origem_marcacao = 'A'
 WHERE marcacao_original IS FALSE AND origem_marcacao = 'O';

CREATE OR REPLACE FUNCTION public.ponto_marcacoes_origem_sync()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.origem_marcacao IS NULL THEN
    NEW.origem_marcacao := CASE WHEN COALESCE(NEW.marcacao_original, true) THEN 'O' ELSE 'A' END;
  END IF;
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.marcacao_original, true) IS TRUE
     AND COALESCE(NEW.marcacao_original, true) IS FALSE
     AND NEW.origem_marcacao = 'O' THEN
    NEW.origem_marcacao := 'A';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ponto_marcacoes_origem ON public.ponto_marcacoes;
CREATE TRIGGER trg_ponto_marcacoes_origem
BEFORE INSERT OR UPDATE ON public.ponto_marcacoes
FOR EACH ROW EXECUTE FUNCTION public.ponto_marcacoes_origem_sync();

-- ============ Imutabilidade do ponto_audit_log ============
CREATE OR REPLACE FUNCTION public.ponto_audit_log_imutavel()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  RAISE EXCEPTION 'Trilha de auditoria do ponto é imutável (Portaria MTP 671/2021): % não permitido', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_ponto_audit_log_no_update ON public.ponto_audit_log;
CREATE TRIGGER trg_ponto_audit_log_no_update
BEFORE UPDATE OR DELETE ON public.ponto_audit_log
FOR EACH ROW EXECUTE FUNCTION public.ponto_audit_log_imutavel();

REVOKE UPDATE, DELETE ON public.ponto_audit_log FROM authenticated, anon;

-- ============ Trilha estendida: ponto_diario e ponto_fechamentos ============
CREATE OR REPLACE FUNCTION public.audit_ponto_generico()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.ponto_audit_log (
    tenant_id, tabela_origem, registro_id, acao,
    dados_anteriores, dados_novos, usuario_id
  ) VALUES (
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_ponto_diario ON public.ponto_diario;
CREATE TRIGGER trg_audit_ponto_diario
AFTER UPDATE OR DELETE ON public.ponto_diario
FOR EACH ROW EXECUTE FUNCTION public.audit_ponto_generico();

DROP TRIGGER IF EXISTS trg_audit_ponto_fechamentos ON public.ponto_fechamentos;
CREATE TRIGGER trg_audit_ponto_fechamentos
AFTER INSERT OR UPDATE OR DELETE ON public.ponto_fechamentos
FOR EACH ROW EXECUTE FUNCTION public.audit_ponto_generico();

-- ============ Política de retenção / expurgo ============
CREATE TABLE IF NOT EXISTS public.ponto_retencao_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  empresa_id uuid,
  anos_retencao integer NOT NULL DEFAULT 5,
  expurgo_automatico boolean NOT NULL DEFAULT false,
  ultimo_expurgo_em timestamptz,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ponto_retencao_anos_chk CHECK (anos_retencao BETWEEN 5 AND 30)
);

CREATE UNIQUE INDEX IF NOT EXISTS ponto_retencao_config_uniq
  ON public.ponto_retencao_config (tenant_id, COALESCE(empresa_id, '00000000-0000-0000-0000-000000000000'::uuid));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ponto_retencao_config TO authenticated;
GRANT ALL ON public.ponto_retencao_config TO service_role;

ALTER TABLE public.ponto_retencao_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gerenciam retencao de ponto" ON public.ponto_retencao_config;
CREATE POLICY "Admins gerenciam retencao de ponto"
ON public.ponto_retencao_config FOR ALL TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND (public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'owner'::public.app_role)
       OR public.is_superadmin(auth.uid()))
)
WITH CHECK (
  tenant_id = public.current_user_tenant_id()
  AND (public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'owner'::public.app_role)
       OR public.is_superadmin(auth.uid()))
);

DROP TRIGGER IF EXISTS trg_ponto_retencao_updated ON public.ponto_retencao_config;
CREATE TRIGGER trg_ponto_retencao_updated
BEFORE UPDATE ON public.ponto_retencao_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.ponto_expurgar_registros(
  p_tenant_id uuid,
  p_empresa_id uuid DEFAULT NULL,
  p_simular boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_anos integer;
  v_limite date;
  v_marc bigint := 0;
  v_diario bigint := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT (public.has_role(v_uid, 'admin'::public.app_role)
          OR public.has_role(v_uid, 'owner'::public.app_role)
          OR public.is_superadmin(v_uid)) THEN
    RAISE EXCEPTION 'Apenas administradores podem executar o expurgo';
  END IF;

  SELECT anos_retencao INTO v_anos
    FROM public.ponto_retencao_config
   WHERE tenant_id = p_tenant_id
     AND (empresa_id IS NOT DISTINCT FROM p_empresa_id OR empresa_id IS NULL)
   ORDER BY empresa_id NULLS LAST
   LIMIT 1;

  v_anos := COALESCE(v_anos, 5);
  v_limite := (CURRENT_DATE - make_interval(years => v_anos))::date;

  SELECT count(*) INTO v_marc
    FROM public.ponto_marcacoes m
   WHERE m.tenant_id = p_tenant_id
     AND (p_empresa_id IS NULL OR m.empresa_id = p_empresa_id)
     AND m.data_marcacao < v_limite
     AND EXISTS (
       SELECT 1 FROM public.ponto_fechamentos f
        WHERE f.tenant_id = m.tenant_id
          AND f.competencia = to_char(m.data_marcacao, 'MM/YYYY')
          AND f.status = 'fechado'
     );

  SELECT count(*) INTO v_diario
    FROM public.ponto_diario d
   WHERE d.tenant_id = p_tenant_id
     AND (p_empresa_id IS NULL OR d.empresa_id = p_empresa_id)
     AND d.data < v_limite;

  IF NOT p_simular THEN
    DELETE FROM public.ponto_diario d
     WHERE d.tenant_id = p_tenant_id
       AND (p_empresa_id IS NULL OR d.empresa_id = p_empresa_id)
       AND d.data < v_limite;

    DELETE FROM public.ponto_marcacoes m
     WHERE m.tenant_id = p_tenant_id
       AND (p_empresa_id IS NULL OR m.empresa_id = p_empresa_id)
       AND m.data_marcacao < v_limite
       AND EXISTS (
         SELECT 1 FROM public.ponto_fechamentos f
          WHERE f.tenant_id = m.tenant_id
            AND f.competencia = to_char(m.data_marcacao, 'MM/YYYY')
            AND f.status = 'fechado'
       );

    INSERT INTO public.ponto_audit_log (
      tenant_id, tabela_origem, registro_id, acao, dados_novos, usuario_id
    ) VALUES (
      p_tenant_id, 'ponto_retencao', gen_random_uuid(), 'EXPURGO',
      jsonb_build_object('limite', v_limite, 'anos', v_anos,
                         'marcacoes', v_marc, 'diarios', v_diario,
                         'empresa_id', p_empresa_id),
      v_uid
    );

    UPDATE public.ponto_retencao_config
       SET ultimo_expurgo_em = now()
     WHERE tenant_id = p_tenant_id
       AND empresa_id IS NOT DISTINCT FROM p_empresa_id;
  END IF;

  RETURN jsonb_build_object(
    'simulacao', p_simular,
    'anos_retencao', v_anos,
    'data_limite', v_limite,
    'marcacoes', v_marc,
    'diarios', v_diario
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ponto_expurgar_registros(uuid, uuid, boolean) TO authenticated;