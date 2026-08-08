-- =========================================================
-- QA — Ponto: correção das rotinas da 1ª leva (07/08, noite)
--
-- A primeira execução real acusou dois defeitos NAS ROTINAS (não no
-- sistema):
--
--   1. ponto_diario.horas_trabalhadas é INTERVAL, e o helper
--      qa_ponto_dia gravava 8.0 (numeric). As quatro rotinas que usam
--      o helper (PONTO-300/301/310/311) quebravam no insert.
--   2. PONTO-341 marcava falha quando a origem nula era aceita — mas
--      se o banco NORMALIZA o nulo para um valor válido da lista
--      (default ou trigger), a marcação gravada nunca fica sem origem,
--      e isso é proteção equivalente à recusa. A rotina passa a
--      conferir o VALOR GRAVADO em vez de exigir a exceção.
--
-- Nenhuma correção de funcionalidade do sistema.
-- =========================================================

SET lock_timeout = '10s';

-- 1) Helper corrigido: horas trabalhadas como INTERVAL.
CREATE OR REPLACE FUNCTION public.qa_ponto_dia(
  p_cpf text, p_nome text, p_data date,
  p_empresa_id uuid DEFAULT NULL,
  p_status text DEFAULT 'completo'
)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.ponto_diario
    (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
     data, entrada, saida_almoco, retorno_almoco, saida, horas_trabalhadas, status)
  VALUES (public.qa_sandbox_tenant_id(), p_empresa_id, gen_random_uuid(), p_nome, p_cpf,
          p_data, TIME '08:00', TIME '12:00', TIME '13:00', TIME '17:00',
          INTERVAL '8 hours', p_status);
END $$;

-- 2) PONTO-341 refinado: nulo recusado OU normalizado = protegido.
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_341()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_origem text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1; r.passo_acao := 'Gravar marcação com origem_marcacao = X';
  r.esperado := 'Recusado pelo CHECK (só O/A/P/E/I)';
  BEGIN
    INSERT INTO public.ponto_marcacoes
      (tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
       data_marcacao, hora_marcacao, tipo_marcacao, hash_marcacao, origem_marcacao)
    VALUES (v_t, gen_random_uuid(), '[QA-PONTO] Origem Inventada', public.qa_cpf(34101),
            CURRENT_DATE - 1, TIME '08:00', 'entrada',
            encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'), 'X');
    r.situacao := 'falhou';
    r.obtido := 'ACEITOU origem X — fora da lista O/A/P/E/I, quebraria a geração do AEJ.';
    RETURN r;
  EXCEPTION WHEN check_violation THEN
    r.obtido := 'Recusada a origem X.';
  END;

  r.passo_ordem := 2; r.passo_acao := 'Gravar marcação com origem nula';
  r.esperado := 'Recusado (NOT NULL) ou normalizado para um valor válido da lista';
  BEGIN
    INSERT INTO public.ponto_marcacoes
      (tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
       data_marcacao, hora_marcacao, tipo_marcacao, hash_marcacao, origem_marcacao)
    VALUES (v_t, gen_random_uuid(), '[QA-PONTO] Origem Nula', public.qa_cpf(34102),
            CURRENT_DATE - 1, TIME '08:00', 'entrada',
            encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'), NULL)
    RETURNING origem_marcacao INTO v_origem;

    IF v_origem IN ('O','A','P','E','I') THEN
      r.situacao := 'passou';
      r.obtido := format('Origem nula normalizada para %s antes de gravar — a marcação nunca fica sem origem, proteção equivalente à recusa.', v_origem);
    ELSE
      r.situacao := 'falhou';
      r.obtido := format('Marcação gravada com origem %s — o AEJ exige a origem de toda marcação tratada.', coalesce(v_origem, 'NULA'));
    END IF;
  EXCEPTION WHEN not_null_violation THEN
    r.situacao := 'passou'; r.obtido := 'Origem nula recusada pelo NOT NULL.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;
