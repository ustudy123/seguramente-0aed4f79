-- ============================================================================
-- CADASTRAR O REGIME DE BANCO DE HORAS DE UMA EMPRESA
--
-- CRIA COISA NOVA (um registro em ponto_banco_horas_config). Nao altera nem
-- apaga dado de colaborador, nao mexe em saldo. Por isso nao leva copia de
-- seguranca — nao ha o que desfazer alem de apagar a config criada.
--
-- DE ONDE VEIO
-- O espelho passou a respeitar o instrumento de compensacao (CLT art. 59,
-- §2º): sem regime de banco de horas vigente, o excedente vai para PAGAMENTO
-- e o deficit e atraso a descontar — o banco nao se move. Uma colaboradora da
-- Magalhaes Lopes (banco -16:02) estava nesse limbo: saldo de banco parado,
-- sem regime que o sustente. Na pratica a empresa USA banco de horas; so nao
-- havia o regime cadastrado.
--
-- O QUE ESTE ARQUIVO FAZ
-- Cadastra o regime para a empresa inteira (todas as escalas), do mesmo jeito
-- que a aba "Config BH" faria. Depois disso o "Apurar agora" passa a mover o
-- banco: excedente credita, deficit debita.
--
-- ATENCAO LEGAL — o acordo
-- Banco de horas exige acordo FORMAL: individual escrito (ate 6 meses) ou por
-- CCT/ACT (ate 12 meses), CLT art. 59, §§2º/5º. Este script cria o regime SEM
-- exigir o documento anexado (exige_acordo_individual = false), para o sistema
-- reconhece-lo de imediato — mas o certo e ter o acordo assinado. Quando ele
-- estiver digitalizado no sistema (aba de acordos), vincule-o na Config BH e
-- marque "exige acordo": o regime passa a so valer com o instrumento, como
-- manda a lei.
--
-- COMO USAR
-- Troque o CNPJ e, se quiser, os parametros do regime nas linhas AJUSTE AQUI.
-- Idempotente: se ja houver um regime ATIVO para a empresa (todas as escalas),
-- ele nao cria um segundo — so confirma.
-- ============================================================================

SET lock_timeout = '10s';

DO $regime$
DECLARE
  v_cnpj   text := '28.443.305/0001-97';   -- AJUSTE AQUI: CNPJ da empresa
  v_tipo   text := 'individual';           -- AJUSTE AQUI: 'individual' (6m) ou 'coletivo' (12m)
  v_prazo  int  := 180;                    -- AJUSTE AQUI: dias de compensacao (180=6m, 365=12m)
  v_limite numeric := 60;                  -- AJUSTE AQUI: teto de acumulo, em horas
  v_tenant uuid;
  v_empresa uuid;
  v_ja uuid;
BEGIN
  SELECT e.tenant_id, e.id INTO v_tenant, v_empresa
  FROM public.empresa_cadastro e
  WHERE regexp_replace(COALESCE(e.cnpj, ''), '[^0-9]', '', 'g')
      = regexp_replace(v_cnpj, '[^0-9]', '', 'g')
  ORDER BY COALESCE(e.usa_controle_ponto, false) DESC
  LIMIT 1;

  IF v_empresa IS NULL THEN
    RAISE NOTICE 'Empresa com CNPJ % nao encontrada — nada foi criado.', v_cnpj;
    RETURN;
  END IF;

  -- Ja existe regime ativo para a empresa inteira (escala nula)?
  SELECT id INTO v_ja
  FROM public.ponto_banco_horas_config
  WHERE tenant_id = v_tenant
    AND empresa_id = v_empresa
    AND escala_id IS NULL
    AND COALESCE(ativo, false) = true
  LIMIT 1;

  IF v_ja IS NOT NULL THEN
    RAISE NOTICE 'Ja existe regime ativo para esta empresa (todas as escalas) — nada a criar.';
    RETURN;
  END IF;

  INSERT INTO public.ponto_banco_horas_config
    (tenant_id, empresa_id, escala_id, tipo, prazo_compensacao_dias,
     permite_saldo_positivo, permite_saldo_negativo, limite_acumulo_horas,
     forma_compensacao, forma_pagamento_vencer,
     exige_acordo_individual, exige_cct_act, acordo_id, data_inicio, ativo)
  VALUES
    (v_tenant, v_empresa, NULL, v_tipo, v_prazo,
     true, true, v_limite,
     'folga', 'horas_extras',
     false, false, NULL, CURRENT_DATE, true);

  RAISE NOTICE 'Regime de banco de horas (%s) criado para a empresa.', v_tipo;
END $regime$;

-- ============================================================================
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Confirma que o regime existe E que ele cobre uma colaboradora conhecida.
-- ============================================================================
WITH alvo AS MATERIALIZED (
  SELECT e.tenant_id, e.id AS empresa_id
  FROM public.empresa_cadastro e
  WHERE regexp_replace(COALESCE(e.cnpj, ''), '[^0-9]', '', 'g')
      = regexp_replace('28.443.305/0001-97', '[^0-9]', '', 'g')   -- AJUSTE AQUI: mesmo CNPJ
  ORDER BY COALESCE(e.usa_controle_ponto, false) DESC
  LIMIT 1
),
conf AS MATERIALIZED (
  SELECT c.tipo, c.prazo_compensacao_dias, c.ativo,
         (c.exige_acordo_individual OR c.exige_cct_act) AS exige_acordo,
         c.acordo_id IS NOT NULL AS tem_acordo
  FROM public.ponto_banco_horas_config c, alvo a
  WHERE c.tenant_id = a.tenant_id AND c.empresa_id = a.empresa_id
    AND c.escala_id IS NULL AND COALESCE(c.ativo, false) = true
  ORDER BY c.data_inicio DESC NULLS LAST
  LIMIT 1
)
SELECT 1 AS ordem, 'regime cadastrado'::text AS o_que,
       COALESCE((SELECT tipo FROM conf), 'NENHUM') AS detalhe,
       CASE WHEN (SELECT tipo FROM conf) IS NOT NULL
            THEN 'prazo ' || (SELECT prazo_compensacao_dias FROM conf) || ' dias'
            ELSE '-' END AS valor,
       CASE WHEN (SELECT tipo FROM conf) IS NULL
              THEN 'PENDENTE: o regime nao foi criado — confira o CNPJ'
            WHEN (SELECT exige_acordo FROM conf) AND NOT (SELECT tem_acordo FROM conf)
              THEN 'ATENCAO: exige acordo mas nenhum vinculado — o regime NAO vale ate anexar'
            ELSE 'OK — regime ativo' END AS erro_tecnico
UNION ALL
SELECT 2, 'cobre a colaboradora Edina (CPF ...978)',
       CASE WHEN (SELECT (public.ponto_banco_regime_vigente(a.tenant_id, '03452132978', NULL, CURRENT_DATE)).id
                    IS NOT NULL FROM alvo a)
            THEN 'sim — tem_regime verdadeiro' ELSE 'nao' END,
       'depois disto, rode "Apurar agora" na competencia',
       CASE WHEN (SELECT (public.ponto_banco_regime_vigente(a.tenant_id, '03452132978', NULL, CURRENT_DATE)).id
                    IS NOT NULL FROM alvo a)
            THEN 'OK — o banco dela passa a se mover'
            ELSE 'CONFERIR: o vinculo da colaboradora nao resolve a empresa. Me envie este resultado.' END
ORDER BY ordem;
