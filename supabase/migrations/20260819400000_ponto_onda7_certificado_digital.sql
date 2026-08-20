-- ============================================================================
-- ONDA 7 (parte 4) — Gestão do certificado digital (ICP-Brasil)
-- PONTO-360
--
-- Não existia gestão de certificado digital — nem cadastro, nem vigência, nem
-- alerta. Consequência dupla: (1) AFD/AEJ não têm COM QUE ser assinados (a
-- assinatura ICP-Brasil / .p7s exigida pela Portaria 671 depende de um
-- certificado); (2) quando a assinatura existir, um certificado VENCIDO paralisa
-- a emissão dos artefatos exatamente na hora da auditoria do Auditor-Fiscal.
--
-- O QUE FAZ (aditivo)
--   (1) ponto_certificados_digitais: cadastro do certificado por empresa —
--       tipo (A1/A3), titular, número de série, emissor (AC), vigência e a
--       antecedência do alerta. Com a trava do cercado (PONTO-270) e RLS.
--   (2) ponto_certificado_vigente(tenant, empresa): o certificado ICP-Brasil
--       vigente HOJE (o que assina o .p7s do AFD/AEJ) — vazio quando vencido.
--   (3) ponto_certificado_vigiar_vencimento(tenant, empresa): vigia o
--       vencimento — alerta preventivo com a antecedência parametrizada e
--       crítico quando já vencido (o que paralisaria a emissão assinada).
--
-- GARANTIAS: não altera o motor de saldo, o espelho, o fechamento nem a emissão
-- de AFD/AEJ. Só cadastra o certificado e vigia o vencimento. Aditivo e
-- idempotente. Sem chave privada no banco (só metadados de vigência).
-- ============================================================================

-- (1) Cadastro do certificado -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ponto_certificados_digitais (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL,
  empresa_id              uuid,
  certificado_digital_tipo text NOT NULL DEFAULT 'A1',   -- 'A1' | 'A3'
  icp_brasil              boolean NOT NULL DEFAULT true,  -- cadeia ICP-Brasil
  titular_nome            text,
  titular_documento       text,                           -- CPF/CNPJ do titular
  numero_serie            text,
  emissor                 text,                           -- Autoridade Certificadora
  fingerprint             text,
  valido_de               date,
  valido_ate              date,
  alerta_antecedencia_dias integer NOT NULL DEFAULT 30,
  arquivo_url             text,                           -- referencia ao .pfx/.cer (nao a chave privada)
  ativo                   boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ponto_certificados_digitais_tipo_chk
    CHECK (certificado_digital_tipo IN ('A1', 'A3'))
);

CREATE INDEX IF NOT EXISTS idx_ponto_certificados_digitais_vig
  ON public.ponto_certificados_digitais (tenant_id, empresa_id, valido_ate);

COMMENT ON TABLE public.ponto_certificados_digitais IS
  'Cadastro do certificado de assinatura digital (ICP-Brasil) por empresa: tipo (A1/A3), titular, numero de serie, emissor, vigencia e antecedencia do alerta. Metadados de vigencia — a chave privada NAO fica no banco. Assina o .p7s do AFD/AEJ (Portaria 671). PONTO-360.';

ALTER TABLE public.ponto_certificados_digitais ENABLE ROW LEVEL SECURITY;

DO $rls$
BEGIN
  IF to_regprocedure('public.get_user_tenant_id()') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_policies
       WHERE schemaname='public' AND tablename='ponto_certificados_digitais'
         AND policyname='ponto_certificados_digitais_tenant') THEN
    CREATE POLICY ponto_certificados_digitais_tenant
      ON public.ponto_certificados_digitais
      FOR ALL
      USING (tenant_id = public.get_user_tenant_id())
      WITH CHECK (tenant_id = public.get_user_tenant_id());
  END IF;
END $rls$;

DO $cerca$
BEGIN
  IF to_regprocedure('public.qa_bloqueia_fora_do_cercado()') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_trigger
       WHERE tgname = 'qa_guarda_cercado'
         AND tgrelid = 'public.ponto_certificados_digitais'::regclass
         AND NOT tgisinternal) THEN
    CREATE TRIGGER qa_guarda_cercado
      BEFORE INSERT OR UPDATE OR DELETE ON public.ponto_certificados_digitais
      FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_fora_do_cercado();
  END IF;
END $cerca$;

INSERT INTO public.qa_tabelas_protegidas (tabela, motivo)
SELECT 'ponto_certificados_digitais', 'Cerca generica: tabela tem tenant_id'
WHERE to_regclass('public.qa_tabelas_protegidas') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.qa_tabelas_protegidas x
                  WHERE x.tabela = 'ponto_certificados_digitais');

-- (2) Certificado vigente hoje (assina o .p7s do AFD/AEJ) --------------------
CREATE OR REPLACE FUNCTION public.ponto_certificado_vigente(
  p_tenant_id  uuid,
  p_empresa_id uuid DEFAULT NULL
)
RETURNS public.ponto_certificados_digitais
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- O certificado ICP-Brasil vigente HOJE que assina o .p7s do AFD/AEJ. Um
  -- certificado vencido nao volta aqui — a emissao assinada nao usa vencido.
  SELECT c.*
  FROM public.ponto_certificados_digitais c
  WHERE c.tenant_id = p_tenant_id
    AND (p_empresa_id IS NULL OR c.empresa_id = p_empresa_id
         OR (p_empresa_id IS NULL AND c.empresa_id IS NULL))
    AND c.ativo = true
    AND (c.valido_de  IS NULL OR c.valido_de  <= CURRENT_DATE)
    AND (c.valido_ate IS NULL OR c.valido_ate >= CURRENT_DATE)
  ORDER BY c.valido_ate DESC NULLS LAST
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.ponto_certificado_vigente(uuid, uuid) IS
  'Devolve o certificado ICP-Brasil vigente hoje (o que assina o .p7s do AFD/AEJ). Certificado vencido nao e devolvido. PONTO-360.';

-- (3) Vigilância do vencimento -----------------------------------------------
CREATE OR REPLACE FUNCTION public.ponto_certificado_vigiar_vencimento(
  p_tenant_id  uuid,
  p_empresa_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_n int := 0;
  v_ins int;
  r RECORD;
  v_sev text;
  v_tit text;
BEGIN
  -- Certificados ICP-Brasil ativos perto de vencer (antecedencia parametrizada)
  -- ou ja vencidos. Certificado vencido paralisa a emissao assinada (.p7s) do
  -- AFD/AEJ exatamente na hora da auditoria do Auditor-Fiscal.
  FOR r IN
    SELECT c.id, c.tenant_id, c.empresa_id, c.titular_nome, c.numero_serie,
           c.valido_ate, c.alerta_antecedencia_dias
    FROM public.ponto_certificados_digitais c
    WHERE c.tenant_id = p_tenant_id
      AND (p_empresa_id IS NULL OR c.empresa_id = p_empresa_id)
      AND c.ativo = true
      AND c.valido_ate IS NOT NULL
      AND c.valido_ate <= (CURRENT_DATE + COALESCE(c.alerta_antecedencia_dias, 30))
  LOOP
    IF r.valido_ate < CURRENT_DATE THEN
      v_sev := 'critica';
      v_tit := 'Certificado digital VENCIDO (assinatura ICP-Brasil paralisada)';
    ELSE
      v_sev := 'alta';
      v_tit := 'Certificado digital perto de vencer (assinatura ICP-Brasil)';
    END IF;

    INSERT INTO public.ponto_alertas
      (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
       tipo, severidade, titulo, descricao, data_referencia)
    SELECT r.tenant_id, r.empresa_id, NULL, NULL, NULL,
           'certificado_digital_vencimento', v_sev, v_tit,
           format('Certificado %s (titular %s) vence em %s. Renovar antes do vencimento — '
               || 'certificado vencido impede assinar o .p7s do AFD/AEJ (Portaria 671).',
               COALESCE(r.numero_serie,'-'), COALESCE(r.titular_nome,'-'),
               to_char(r.valido_ate, 'DD/MM/YYYY')),
           r.valido_ate
    WHERE NOT EXISTS (
      SELECT 1 FROM public.ponto_alertas a
      WHERE a.tenant_id = r.tenant_id
        AND a.tipo = 'certificado_digital_vencimento'
        AND a.data_referencia = r.valido_ate
        AND COALESCE(a.empresa_id::text,'') = COALESCE(r.empresa_id::text,'')
        AND a.titulo = v_tit
    );
    GET DIAGNOSTICS v_ins = ROW_COUNT;
    v_n := v_n + v_ins;
  END LOOP;

  RETURN v_n;
END;
$$;

COMMENT ON FUNCTION public.ponto_certificado_vigiar_vencimento(uuid, uuid) IS
  'Vigia o vencimento do certificado digital (ICP-Brasil): alerta preventivo com a antecedencia parametrizada e critico quando ja vencido (paralisa a emissao assinada do .p7s do AFD/AEJ). Idempotente por certificado/vencimento. PONTO-360.';
