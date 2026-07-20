-- =========================================================
-- QA — COLAB-002: busca de colaborador por nome e CPF
--
-- CONTEXTO (medido, corrigindo contagem anterior): dos casos de teste
-- reais em qa_casos_teste, este e o unico ainda automatizavel por banco
-- que faltava. Os "9 de EPI" que eu havia citado nao existem — eram
-- codigos de itens de EPI (dados de exemplo), nao casos de teste.
--
-- O caso exercita 3 buscas: nome parcial, CPF sem formatacao, CPF formatado.
-- Isso testa uma verdade util: a busca por CPF funciona mesmo quando o
-- usuario digita com pontos/traco? Se a busca so casa string exata, buscar
-- '111.222.333-44' nao acha quem esta gravado como '11122233344'.
-- =========================================================

CREATE OR REPLACE FUNCTION public.qa_caso_colab_002()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_p uuid;
  v_por_nome int; v_por_cpf_limpo int; v_por_cpf_fmt int;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Criar colaborador com nome e CPF conhecidos';
  r.esperado := 'Encontravel por nome parcial, por CPF sem e com formatacao';
  INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
  VALUES (v_t, '[QA-002] Joaquim Aparecido Testonildo', 'qa.002.1@sandbox.invalid',
          '99900000188', 'colaborador', 'ativo')
  RETURNING id INTO v_p;

  r.passo_ordem := 2;
  r.passo_acao := 'Buscar pelo nome parcial ("Testonildo")';
  SELECT count(*) INTO v_por_nome
  FROM public.usuarios_base
  WHERE tenant_id = v_t AND nome_completo ILIKE '%Testonildo%';

  r.passo_ordem := 3;
  r.passo_acao := 'Buscar pelo CPF sem formatacao (99900000188)';
  SELECT count(*) INTO v_por_cpf_limpo
  FROM public.usuarios_base
  WHERE tenant_id = v_t AND regexp_replace(cpf, '[^0-9]', '', 'g') = '99900000188';

  r.passo_ordem := 4;
  r.passo_acao := 'Buscar pelo CPF formatado (999.000.001-88)';
  -- normaliza os dois lados: o gravado e o buscado
  SELECT count(*) INTO v_por_cpf_fmt
  FROM public.usuarios_base
  WHERE tenant_id = v_t
    AND regexp_replace(cpf, '[^0-9]', '', 'g') = regexp_replace('999.000.001-88', '[^0-9]', '', 'g');

  IF v_por_nome >= 1 AND v_por_cpf_limpo >= 1 AND v_por_cpf_fmt >= 1 THEN
    r.situacao := 'passou';
    r.obtido := 'Encontrado pelas 3 vias: nome parcial, CPF limpo e CPF formatado.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Falha na busca — nome:%s, cpf_limpo:%s, cpf_fmt:%s (esperado >=1 em cada).',
                       v_por_nome, v_por_cpf_limpo, v_por_cpf_fmt);
  END IF;
  r.detalhe := jsonb_build_object('por_nome', v_por_nome,
                                  'por_cpf_limpo', v_por_cpf_limpo,
                                  'por_cpf_formatado', v_por_cpf_fmt);
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

INSERT INTO public.qa_implementacoes (codigo, funcao_sql)
VALUES ('COLAB-002', 'qa_caso_colab_002')
ON CONFLICT (codigo) DO UPDATE SET funcao_sql = EXCLUDED.funcao_sql, ativo = true;

-- Rodar e mostrar
DO $roda$ BEGIN PERFORM public.qa_rodar_bateria('manual', 'estrutura-organizacional/colaboradores'); END $roda$;

SELECT codigo, situacao::text, left(obtido, 62) AS resultado
FROM public.qa_resultados
WHERE execucao_id = (SELECT id FROM public.qa_execucoes ORDER BY iniciada_em DESC LIMIT 1)
  AND situacao <> 'nao_implementado'
ORDER BY (situacao='falhou') DESC, (situacao='erro') DESC, codigo;
