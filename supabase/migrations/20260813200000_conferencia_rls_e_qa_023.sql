-- =====================================================================
-- Duas correções que a bateria acusou depois da mudança de regime
--
-- ── 1) ponto_entrega_conferencia sem RLS — descuido meu, já em produção
-- Criei essa tabela dentro do script de entrega de 13/08 para guardar o
-- retrato antes/depois da apuração, e esqueci de protegê-la. A rotina
-- PONTO-250 acusou na varredura seguinte: "1 tabela SEM RLS ativa e 1 SEM
-- nenhuma política".
--
-- Ela guarda contagens agregadas por cliente — não tem dado pessoal —,
-- mas são números de negócio de um cliente visíveis para qualquer sessão
-- autenticada de outro. É vazamento, ainda que de agregado, e o script
-- já rodou na produção. Passa a ser exclusiva de superadmin, como as
-- demais ferramentas internas.
--
-- ── 2) PONTO-023 monta o cenário fora do regime de ponto
-- Mesma situação de 290/292/293: a rotina cria o colaborador sem empresa
-- e sem batida, perfil que a chave de controle por empresa passou a
-- excluir de propósito. O requisito continua o mesmo — dia útil sem
-- marcação vira FALTA, não dia neutro, porque a falta repercute no DSR —,
-- agora dentro de uma empresa que adota controle de jornada.
-- =====================================================================

SET lock_timeout = '10s';

-- ── 1) A tabela de conferência vira ferramenta interna ───────────────
CREATE TABLE IF NOT EXISTS public.ponto_entrega_conferencia (
  competencia                 text NOT NULL,
  momento                     text NOT NULL,
  tenant_id                   uuid,
  minutos_adicional_feriado   bigint,
  colaboradores_sem_linha     bigint,
  dias_sem_linha              bigint,
  linhas_de_ponto_sem_empresa bigint,
  observacao                  text,
  registrado_em               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ponto_entrega_conferencia ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ponto_entrega_conferencia FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ponto_entrega_conferencia TO service_role;

DROP POLICY IF EXISTS "Conferencia de entrega e ferramenta interna" ON public.ponto_entrega_conferencia;
CREATE POLICY "Conferencia de entrega e ferramenta interna"
  ON public.ponto_entrega_conferencia
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

COMMENT ON TABLE public.ponto_entrega_conferencia IS
  'Retrato antes/depois das entregas de correção do ponto. Ferramenta interna: só superadmin lê. Guarda agregados de vários clientes na mesma tabela.';

-- ── 2) PONTO-023 dentro do regime ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_023()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_emp uuid; v_cpf text;
        v_dia date := public.qa_dia_util_passado();
        v_status text;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_emp := public.qa_empresa_com_ponto('[QA-PONTO] Unidade Falta Real', '11222333050231');
  v_cpf := public.qa_ponto_admissao('QA Falta Real', 5023, v_emp);

  r.passo_ordem := 1;
  r.passo_acao := format('Materializar o dia útil %s sem nenhuma marcação, em empresa que adota controle', v_dia);
  r.esperado := 'O dia vira FALTA — não dia neutro (a falta repercute no DSR)';
  PERFORM public.ponto_materializar_faltas(v_dia, v_dia, public.qa_sandbox_tenant_id());
  SELECT status INTO v_status FROM public.ponto_diario
  WHERE tenant_id = public.qa_sandbox_tenant_id() AND colaborador_cpf = v_cpf AND data = v_dia;

  IF v_status = 'falta' THEN
    r.situacao := 'passou';
    r.obtido := 'Dia útil sem batida materializado como falta.';
  ELSIF v_status IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o dia útil sem marcação de um colaborador que NUNCA bateu ponto ficou '
             || 'INEXISTENTE, mesmo em empresa que adota controle de jornada. Quem nunca bateu '
             || '(admitido que não compareceu, colaborador sem onboarding do app) nunca vira '
             || 'falta: é o funcionário invisível.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('O dia sem marcação ficou como %s — ausência tratada como neutra esconde '
             || 'o efeito legal sobre o DSR.', v_status);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ── Conferência ──────────────────────────────────────────────────────
DO $verifica$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE n.nspname = 'public' AND c.relname = 'ponto_entrega_conferencia'
                    AND c.relrowsecurity) THEN
    RAISE EXCEPTION 'ponto_entrega_conferencia continua sem RLS.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname = 'public' AND tablename = 'ponto_entrega_conferencia') THEN
    RAISE EXCEPTION 'ponto_entrega_conferencia continua sem política.';
  END IF;
  RAISE NOTICE 'OK: conferência de entrega protegida e PONTO-023 no regime.';
END $verifica$;
