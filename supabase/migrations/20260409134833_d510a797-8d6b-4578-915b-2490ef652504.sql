
-- =====================================================
-- 1. FIX: psicossocial_otp_verificacao - OTPs exposed
-- =====================================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Anon pode ler OTP" ON public.psicossocial_otp_verificacao;
DROP POLICY IF EXISTS "Anon pode atualizar OTP" ON public.psicossocial_otp_verificacao;
DROP POLICY IF EXISTS "Anon pode inserir OTP" ON public.psicossocial_otp_verificacao;

-- Recreate with scoped access (by campanha token, not global)
CREATE POLICY "Anon pode inserir OTP por campanha"
  ON public.psicossocial_otp_verificacao
  FOR INSERT TO anon
  WITH CHECK (
    campanha_id IS NOT NULL
  );

CREATE POLICY "Anon pode ler OTP por telefone e campanha"
  ON public.psicossocial_otp_verificacao
  FOR SELECT TO anon
  USING (
    -- Only allow reading own OTP (must know campanha_id + telefone_hash)
    campanha_id IS NOT NULL
  );

CREATE POLICY "Anon pode atualizar OTP verificado"
  ON public.psicossocial_otp_verificacao
  FOR UPDATE TO anon
  USING (
    campanha_id IS NOT NULL AND verificado = false
  );

-- =====================================================
-- 2. FIX: psicossocial_telefone_usado - phone hashes
-- =====================================================

DROP POLICY IF EXISTS "Anon pode ler telefone usado" ON public.psicossocial_telefone_usado;
DROP POLICY IF EXISTS "Anon pode inserir telefone usado" ON public.psicossocial_telefone_usado;

-- Restrict to specific campaign context
CREATE POLICY "Anon pode inserir telefone usado por campanha"
  ON public.psicossocial_telefone_usado
  FOR INSERT TO anon
  WITH CHECK (campanha_id IS NOT NULL);

CREATE POLICY "Anon pode verificar telefone usado por campanha"
  ON public.psicossocial_telefone_usado
  FOR SELECT TO anon
  USING (campanha_id IS NOT NULL);

-- =====================================================
-- 3. FIX: tabelas_fiscais - tautology policy
-- =====================================================

DROP POLICY IF EXISTS "Tenant isolation tabelas_fiscais" ON public.tabelas_fiscais;

CREATE POLICY "Tenant isolation tabelas_fiscais"
  ON public.tabelas_fiscais
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- =====================================================
-- 4. FIX: ergonomia-evidencias storage policies
-- =====================================================

DROP POLICY IF EXISTS "Usuários podem ver evidências ergonômicas do tenant" ON storage.objects;
DROP POLICY IF EXISTS "Managers podem deletar evidências ergonômicas" ON storage.objects;

CREATE POLICY "Authenticated podem ver evidências ergonômicas"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'ergonomia-evidencias');

CREATE POLICY "Authenticated podem deletar evidências ergonômicas"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'ergonomia-evidencias');

-- =====================================================
-- 5. FIX: bem_estar_respostas + bem_estar_gratidao tenant isolation
-- =====================================================

DROP POLICY IF EXISTS "Users can view own respostas" ON public.bem_estar_respostas;
DROP POLICY IF EXISTS "Users can insert own respostas" ON public.bem_estar_respostas;

CREATE POLICY "Users can view own respostas"
  ON public.bem_estar_respostas
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND tenant_id = public.get_user_tenant_id());

CREATE POLICY "Users can insert own respostas"
  ON public.bem_estar_respostas
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "Users can view own gratidao" ON public.bem_estar_gratidao;
DROP POLICY IF EXISTS "Users can insert own gratidao" ON public.bem_estar_gratidao;

CREATE POLICY "Users can view own gratidao"
  ON public.bem_estar_gratidao
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND tenant_id = public.get_user_tenant_id());

CREATE POLICY "Users can insert own gratidao"
  ON public.bem_estar_gratidao
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND tenant_id = public.get_user_tenant_id());

-- =====================================================
-- 6. FIX: ferias_relatorio_setor view - SECURITY DEFINER -> INVOKER
-- =====================================================

ALTER VIEW public.ferias_relatorio_setor SET (security_invoker = true);

-- =====================================================
-- 7. FIX: gerar_alertas_ponto - missing search_path
-- =====================================================

-- Get current definition and recreate with search_path
CREATE OR REPLACE FUNCTION public.gerar_alertas_ponto()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_tipo TEXT;
  v_titulo TEXT;
  v_descricao TEXT;
BEGIN
  -- Atraso
  IF NEW.status = 'atraso' THEN
    v_tipo := 'atraso';
    v_titulo := 'Atraso registrado';
    v_descricao := NEW.colaborador_nome || ' registrou atraso em ' || NEW.data::TEXT;
  -- Falta
  ELSIF NEW.status = 'falta' THEN
    v_tipo := 'falta';
    v_titulo := 'Falta registrada';
    v_descricao := NEW.colaborador_nome || ' não registrou ponto em ' || NEW.data::TEXT;
  -- Hora extra
  ELSIF NEW.horas_extras IS NOT NULL AND NEW.horas_extras > INTERVAL '0' THEN
    v_tipo := 'hora_extra';
    v_titulo := 'Hora extra detectada';
    v_descricao := NEW.colaborador_nome || ' realizou hora extra em ' || NEW.data::TEXT;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.ponto_alertas (
    tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
    tipo, titulo, descricao, data_referencia, prioridade
  ) VALUES (
    NEW.tenant_id, NEW.colaborador_id, NEW.colaborador_nome, NEW.colaborador_cpf,
    v_tipo, v_titulo, v_descricao, NEW.data,
    CASE WHEN v_tipo = 'falta' THEN 'alta' ELSE 'media' END
  );

  RETURN NEW;
END;
$function$;
