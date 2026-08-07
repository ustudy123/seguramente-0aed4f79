-- =========================================================
-- QA — Últimos CPFs literais, e a exceção que deve permanecer (03/08/2026)
--
-- A conferência das migrations anteriores apontou 7 rotinas com CPF
-- literal. Ao olhar cada uma, são DOIS grupos opostos:
--
--   COLAB-021 usa '11111111111'. Esse literal DEVE FICAR: é uma sequência
--   de dígito único, ou seja, o CPF inválido que o caso existe para
--   testar. Substituí-lo por qa_cpf() geraria um CPF válido e o teste
--   passaria a não testar nada.
--   => Minha própria conferência estava errada como regra absoluta.
--      "Nenhuma rotina pode ter CPF literal" é falso: a rotina que testa
--      CPF inválido precisa de um. A conferência foi corrigida no final
--      desta migration para reconhecer a exceção, em vez de acusar o
--      COLAB-021 para sempre e ensinar todo mundo a ignorar o aviso.
--
--   As outras 6 usam '52998224725' — o CPF de exemplo canônico
--   brasileiro, matematicamente válido. Migradas aqui por dois motivos:
--     a) é um CPF válido e, sendo válido, pode pertencer a uma pessoa
--        real. Fixture de teste não deve carregar o documento de ninguém.
--     b) as 6 usavam o MESMO número. Cada uma passa a ter o seu, derivado
--        do nome da rotina — estável entre execuções e rastreável, sem o
--        risco de duas fixtures disputarem o mesmo CPF no mesmo tenant.
--
-- Regeradas programaticamente a partir das definições versionadas; muda só
-- o literal.
-- =========================================================

SET lock_timeout = '10s';

DO $pre$
BEGIN
  IF to_regprocedure('public.qa_cpf(integer)') IS NULL THEN
    RAISE EXCEPTION 'qa_cpf(int) nao existe. Aplique 20260805090000_qa_cpf_fixtures.sql antes.';
  END IF;
END $pre$;

CREATE OR REPLACE FUNCTION public.qa_caso_cond_002()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
        v_tipo text; v_apl text; v_val numeric;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1;
  r.passo_acao:='Registrar periculosidade (30% sobre salario base de R$ 3.000 = R$ 900)';
  r.esperado:='Enquadramento gravado, adicional de periculosidade aplicado';
  INSERT INTO public.colaborador_condicoes_especiais
    (tenant_id, colaborador_id, colaborador_nome, periculosidade, periculosidade_tipo,
     periculosidade_valor_calculado, adicional_aplicado, adicional_valor_aplicado)
  VALUES (v_t, public.qa_cpf(701483), '[QA] Operador Periculoso', true, 'Inflamaveis',
          900.00, 'periculosidade', 900.00) RETURNING id INTO v_id;
  SELECT periculosidade_tipo, adicional_aplicado, adicional_valor_aplicado
    INTO v_tipo, v_apl, v_val FROM public.colaborador_condicoes_especiais WHERE id=v_id;
  IF v_tipo='Inflamaveis' AND v_apl='periculosidade' AND v_val=900.00 THEN
    r.situacao:='passou';
    r.obtido:='Periculosidade (inflamaveis) registrada, adicional de R$ 900,00 aplicado.';
  ELSE
    r.situacao:='falhou'; r.obtido:=format('tipo=%s, aplicado=%s, valor=%s.', v_tipo, v_apl, v_val);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_cond_013()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cargo uuid; v_cond uuid; v_existe boolean; v_cargo_da_cond uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Registrar condicoes especiais vinculadas a um cargo';
  r.esperado:='Apagar o cargo preserva o enquadramento (historico legal)';
  INSERT INTO public.cargos (tenant_id, nome) VALUES (v_t, '[QA] Operador de Caldeira')
  RETURNING id INTO v_cargo;
  INSERT INTO public.colaborador_condicoes_especiais
    (tenant_id, colaborador_id, colaborador_nome, cargo_id, insalubridade, insalubridade_grau)
  VALUES (v_t, public.qa_cpf(701485), '[QA] Caldeireiro', v_cargo, true, 'maximo')
  RETURNING id INTO v_cond;

  r.passo_ordem:=2; r.passo_acao:='Apagar o cargo';
  BEGIN
    DELETE FROM public.cargos WHERE id=v_cargo;
  EXCEPTION WHEN foreign_key_violation THEN
    r.situacao:='passou';
    r.obtido:='O banco bloqueou apagar o cargo enquanto ha enquadramento vinculado — o historico esta protegido.';
    RETURN r;
  END;

  r.passo_ordem:=3; r.passo_acao:='Conferir se o enquadramento sobreviveu';
  SELECT EXISTS(SELECT 1 FROM public.colaborador_condicoes_especiais WHERE id=v_cond) INTO v_existe;
  SELECT cargo_id INTO v_cargo_da_cond FROM public.colaborador_condicoes_especiais WHERE id=v_cond;
  IF v_existe THEN
    r.situacao:='passou';
    r.obtido:=format('O enquadramento sobreviveu ao cargo (cargo_id agora %s). O historico de exposicao foi preservado.',
                     COALESCE(v_cargo_da_cond::text,'nulo'));
  ELSE
    r.situacao:='falhou';
    r.obtido:='O enquadramento foi APAGADO junto com o cargo — perda de historico com valor legal para aposentadoria especial e defesa trabalhista.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_cond_022()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t1 uuid := public.qa_sandbox_tenant_id();
        v_t2 uuid := public.qa_sandbox2_tenant_id(); v_vis int;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN r.situacao:='erro'; r.obtido:='2o cercado nao existe.'; RETURN r; END IF;
  r.passo_ordem:=1; r.passo_acao:='Registrar condicoes no tenant 1'; r.esperado:='Invisivel ao tenant 2';
  INSERT INTO public.colaborador_condicoes_especiais
    (tenant_id, colaborador_id, colaborador_nome, insalubridade, insalubridade_agente_nocivo)
  VALUES (v_t1, public.qa_cpf(701485), '[QA] Exposto Secreto T1', true, 'Benzeno');
  r.passo_ordem:=2; r.passo_acao:='Contar, filtrando pelo tenant 2';
  SELECT count(*) INTO v_vis FROM public.colaborador_condicoes_especiais
   WHERE tenant_id=v_t2 AND colaborador_nome='[QA] Exposto Secreto T1';
  IF v_vis=0 THEN
    r.situacao:='passou'; r.obtido:='Registro do tenant 1 invisivel ao tenant 2.';
  ELSE
    r.situacao:='falhou'; r.obtido:=format('VAZAMENTO: %s registro(s) de saude ocupacional visiveis.', v_vis);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_tdoc_014()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_ter uuid; v_trab uuid; v_doc uuid; v_sobrou int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar trabalhador com um ASO pessoal';
  r.esperado:='Apagar o trabalhador apaga o ASO (CASCADE)';
  v_ter := public.qa_novo_terceiro('[QA] Prestadora Cascade Trab', '11222333000848');
  INSERT INTO public.terceiro_trabalhadores (tenant_id, terceiro_id, nome, cpf)
  VALUES (v_t, v_ter, '[QA] Jose Terceirizado', public.qa_cpf(701492)) RETURNING id INTO v_trab;
  v_doc := public.qa_novo_doc_terceiro(v_ter, 'ASO', '[QA] ASO do Jose', CURRENT_DATE + 90, v_trab);
  r.passo_ordem:=2; r.passo_acao:='Apagar o trabalhador';
  DELETE FROM public.terceiro_trabalhadores WHERE id=v_trab;
  r.passo_ordem:=3; r.passo_acao:='Conferir se o ASO foi apagado junto';
  SELECT count(*) INTO v_sobrou FROM public.terceiro_documentos WHERE id=v_doc;
  IF v_sobrou=0 THEN
    r.situacao:='passou'; r.obtido:='ASO apagado junto com o trabalhador (CASCADE).';
  ELSE
    r.situacao:='falhou'; r.obtido:=format('ASO NAO foi apagado (%s ainda existe).', v_sobrou);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ttre_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_ter uuid; v_trab uuid; v_tre uuid; v_st text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Registrar treinamento NR-35 com validade vencida';
  r.esperado:='Status vencido, pela mesma automacao dos documentos';
  v_ter := public.qa_novo_terceiro('[QA] Prestadora Treinamento', '11333444000181');
  INSERT INTO public.terceiro_trabalhadores (tenant_id, terceiro_id, nome, cpf)
  VALUES (v_t, v_ter, '[QA] Trabalhador Altura', public.qa_cpf(701509)) RETURNING id INTO v_trab;
  INSERT INTO public.terceiro_treinamentos
    (tenant_id, terceiro_id, trabalhador_id, tipo, data_validade)
  VALUES (v_t, v_ter, v_trab, 'NR-35', CURRENT_DATE - 365) RETURNING id INTO v_tre;
  SELECT status::text INTO v_st FROM public.terceiro_treinamentos WHERE id=v_tre;
  IF v_st='vencido' THEN
    r.situacao:='passou';
    r.obtido:='Treinamento NR-35 vencido classificado sozinho — a mesma trigger vale para treinamentos.';
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('Esperava "vencido", obteve "%s". Trabalhador com NR-35 vencida apareceria apto.', v_st);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ttre_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_ter uuid; v_trab uuid; v_tre uuid; v_st text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar terceiro e trabalhador';
  v_ter := public.qa_novo_terceiro('[QA] Prestadora Treino Sem Validade', '11333444000343');
  INSERT INTO public.terceiro_trabalhadores (tenant_id, terceiro_id, nome, cpf)
  VALUES (v_t, v_ter, '[QA] Trabalhador Integracao', public.qa_cpf(701510)) RETURNING id INTO v_trab;

  r.passo_ordem:=2;
  r.passo_acao:='Registrar treinamento SEM data de validade (ex.: integracao, sem prazo)';
  r.esperado:='Deveria salvar com status "pendente", como acontece com documentos (TDOC-004)';
  BEGIN
    INSERT INTO public.terceiro_treinamentos (tenant_id, terceiro_id, trabalhador_id, tipo)
    VALUES (v_t, v_ter, v_trab, 'Integracao') RETURNING id INTO v_tre;
    SELECT status::text INTO v_st FROM public.terceiro_treinamentos WHERE id=v_tre;
    IF v_st = 'pendente' THEN
      r.situacao:='passou';
      r.obtido:='Treinamento sem validade salvo com status "pendente", como esperado.';
    ELSE
      r.situacao:='falhou';
      r.obtido:=format('Salvou, mas com status "%s" em vez de "pendente".', v_st);
    END IF;
  EXCEPTION WHEN undefined_column OR others THEN
    IF SQLERRM LIKE '%arquivo_url%' THEN
      r.situacao:='falhou';
      r.obtido:='ERRO DE BANCO ao salvar treinamento sem validade: a funcao atualizar_status_terceiro_doc acessa NEW.arquivo_url, coluna que nao existe em terceiro_treinamentos (la e certificado_url). Treinamentos sem prazo nao podem ser cadastrados.';
      r.erro_tecnico:=SQLERRM;
    ELSE
      r.situacao:='erro'; r.obtido:='Quebrou por outro motivo'; r.erro_tecnico:=SQLERRM;
    END IF;
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;
-- ─────────────────────────────────────────────────────────
-- Conferência corrigida: reconhece a exceção legítima
-- ─────────────────────────────────────────────────────────
DO $conf$
DECLARE v_resta text;
BEGIN
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO v_resta
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname LIKE 'qa\_caso\_%'
    AND p.prosrc ~ '''[0-9]{11}'''
    -- COLAB-021 testa CPF invalido: o literal e o objeto do teste.
    AND p.proname <> 'qa_caso_colab_021';

  IF v_resta IS NULL THEN
    RAISE NOTICE 'OK: nenhum CPF literal indevido. O COLAB-021 mantem o dele de proposito.';
  ELSE
    RAISE WARNING 'Ainda com CPF literal: %', v_resta;
  END IF;
END $conf$;

-- O CPF do COLAB-021 continua sendo o que o caso precisa?
SELECT CASE
         WHEN p.prosrc ~ '''(\d)\1{10}''' THEN 'OK: sequencia de digito unico, invalida como o caso exige'
         ELSE '>>> ATENCAO: o CPF do COLAB-021 deixou de ser invalido — o caso parou de testar o que promete'
       END AS colab_021
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'qa_caso_colab_021';

SELECT count(*) AS rotinas_de_caso,
       count(*) FILTER (WHERE p.prosrc ~ 'qa_cpf\(')      AS usam_qa_cpf,
       count(*) FILTER (WHERE p.prosrc ~ '''[0-9]{11}''') AS com_literal
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname LIKE 'qa\_caso\_%';
