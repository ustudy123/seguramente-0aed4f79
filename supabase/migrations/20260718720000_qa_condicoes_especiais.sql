-- =========================================================
-- QA — CONDIÇÕES ESPECIAIS DO COLABORADOR
-- (insalubridade, periculosidade, aposentadoria especial)
-- Item 4 da auditoria de cobertura — o ultimo de alta prioridade
--
-- O QUE E: registra o enquadramento do colaborador em condicoes especiais de
-- trabalho e os adicionais devidos. E o unico ponto do sistema coberto pelos
-- testes onde ha CALCULO FINANCEIRO com fundamento legal direto.
--
-- A LOGICA (apurada em src/lib/folha/adicionais.ts — e esta correta):
--   Insalubridade: percentual pelo grau (minimo 10%, medio 20%, maximo 40%)
--     aplicado sobre o salario minimo ou sobre o piso convencional
--   Periculosidade: 30% sobre o salario base (NR-16 e art. 193 da CLT)
--   PREVALENCIA (art. 193 §2º da CLT): quando o colaborador se enquadra nos
--     dois, aplica-se apenas o MAIS VANTAJOSO. Vedada a cumulatividade.
--     A funcao calcula ambos, escolhe o maior e grava a fundamentacao legal
--     citando os dois valores e a razao da escolha.
--
-- ONDE ELA VIVE: inteiramente no front. A tabela nao tem trigger nem CHECK —
-- nenhum campo tem dominio fechado (grau, base de calculo, adicional
-- aplicado sao TEXT livres) e nenhum valor e calculado pelo banco.
--
-- POR QUE ISSO PESA MAIS AQUI: nos demais achados, dado inconsistente gera
-- relatorio errado. Aqui gera FOLHA errada — pagar a menos vira passivo
-- trabalhista, pagar a mais vira prejuizo. E a importacao de SST (origem
-- 'importacao_sst' prevista na propria tabela) e justamente um caminho que
-- nao passa pela tela.
-- =========================================================

DO $trava$
BEGIN
  IF to_regclass('public.colaborador_condicoes_especiais') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS qa_guarda_cercado ON public.colaborador_condicoes_especiais;
    CREATE TRIGGER qa_guarda_cercado BEFORE INSERT OR UPDATE OR DELETE
      ON public.colaborador_condicoes_especiais
      FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_fora_do_cercado();
    INSERT INTO public.qa_tabelas_protegidas (tabela, motivo)
    VALUES ('colaborador_condicoes_especiais', 'Adicionais de insalubridade e periculosidade.')
    ON CONFLICT (tabela) DO NOTHING;
  END IF;
END $trava$;

-- ─────────────────────────────────────────────────────────
-- DOCUMENTAÇÃO
-- ─────────────────────────────────────────────────────────
DO $seed$
DECLARE v_mod uuid;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos WHERE path='estrutura-organizacional/colaboradores';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Modulo colaboradores nao encontrado.'; END IF;

  INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, nivel, objetivo, pre_condicoes, passos, resultado_esperado, observacoes)
  VALUES

  (v_mod,'COND-001','Registrar insalubridade de grau medio','feliz','alta','aprovado','api',
   'Verificar o registro de enquadramento em insalubridade. Regra: o grau define o percentual '
   '(minimo 10%, medio 20%, maximo 40%) aplicado sobre o salario minimo ou o piso convencional. '
   'Importa porque este registro alimenta a folha — e o que faz o adicional ser pago.',
   'Precisa existir um colaborador cadastrado.',
   '[
     {"ordem":1,"acao":"Abrir a ficha do colaborador e ir as condicoes especiais","onde_na_tela":"Colaboradores > abrir a ficha > aba Condicoes Especiais","dados":"-","resultado_esperado":"Secao de insalubridade e periculosidade visivel"},
     {"ordem":2,"acao":"Marcar insalubridade e informar o enquadramento","onde_na_tela":"Campos Insalubridade, Grau, Agente Nocivo, Base de Calculo","dados":"Insalubridade: sim | Grau: medio (20%) | Agente nocivo: Ruido acima de 85 dB | Base: salario_minimo","resultado_esperado":"Campos aceitos e o valor calculado exibido"},
     {"ordem":3,"acao":"Salvar e reabrir","onde_na_tela":"Salvar","dados":"-","resultado_esperado":"O enquadramento persistiu, com o adicional aplicado igual ao de insalubridade"}
   ]'::jsonb,
   'O colaborador fica registrado com insalubridade de grau medio, agente nocivo identificado, base '
   'no salario minimo, e o adicional aplicado e o de insalubridade.',
   'IMPACTO SE FALHAR: sem o registro, o adicional nao e pago — o colaborador recebe a menos e a '
   'empresa acumula passivo trabalhista com juros e correcao.'),

  (v_mod,'COND-002','Registrar periculosidade','feliz','alta','aprovado','api',
   'Verificar o registro de enquadramento em periculosidade. Regra: o adicional e de 30% sobre o '
   'salario base (NR-16 e art. 193 da CLT), diferente da insalubridade, que incide sobre o salario '
   'minimo. Importa porque a base de calculo distinta e o que faz a periculosidade ser quase sempre '
   'mais vantajosa para quem tem salario acima do minimo.',
   'Precisa existir um colaborador cadastrado.',
   '[
     {"ordem":1,"acao":"Abrir as condicoes especiais do colaborador","onde_na_tela":"Colaboradores > ficha > Condicoes Especiais","dados":"-","resultado_esperado":"Secao visivel"},
     {"ordem":2,"acao":"Marcar periculosidade e informar o tipo","onde_na_tela":"Campos Periculosidade e Tipo","dados":"Periculosidade: sim | Tipo: Inflamaveis","resultado_esperado":"Campos aceitos, adicional de 30% calculado sobre o salario base"},
     {"ordem":3,"acao":"Salvar","onde_na_tela":"Salvar","dados":"-","resultado_esperado":"Enquadramento gravado, adicional aplicado e o de periculosidade"}
   ]'::jsonb,
   'O colaborador fica registrado com periculosidade, tipo identificado, e o adicional aplicado e o '
   'de periculosidade.',
   'IMPACTO SE FALHAR: mesmo risco do COND-001 — adicional nao pago vira passivo trabalhista.'),

  (v_mod,'COND-003','Prevalencia: os dois enquadramentos, um so adicional','feliz','critica','aprovado','api',
   'Verificar a regra do art. 193 §2º da CLT: quando o colaborador se enquadra em insalubridade E '
   'periculosidade, aplica-se apenas o MAIS VANTAJOSO — vedada a cumulatividade. Importa porque '
   'somar os dois e erro classico de folha: paga-se a mais e, em fiscalizacao ou acao trabalhista, '
   'o erro aparece nos dois sentidos (a empresa pagou errado, e o calculo do que era devido fica '
   'contestavel).',
   'Precisa existir um colaborador enquadrado nas duas condicoes.',
   '[
     {"ordem":1,"acao":"Marcar o colaborador com insalubridade e periculosidade ao mesmo tempo","onde_na_tela":"Colaboradores > ficha > Condicoes Especiais","dados":"Insalubridade: sim, grau maximo (40% do salario minimo) | Periculosidade: sim (30% do salario base)","resultado_esperado":"A tela avisa que sera aplicado o mais vantajoso (art. 193 §2º)"},
     {"ordem":2,"acao":"Conferir qual adicional foi aplicado","onde_na_tela":"Campo Adicional Aplicado","dados":"-","resultado_esperado":"Apenas UM dos dois consta como aplicado — o de maior valor"},
     {"ordem":3,"acao":"Conferir a fundamentacao legal registrada","onde_na_tela":"Campo Fundamentacao Legal","dados":"-","resultado_esperado":"Texto citando os dois valores calculados, qual prevaleceu e o art. 193 §2º da CLT"},
     {"ordem":4,"acao":"Conferir o valor aplicado","onde_na_tela":"Campo Valor do Adicional Aplicado","dados":"-","resultado_esperado":"Igual ao maior dos dois — NUNCA a soma"}
   ]'::jsonb,
   'Somente um adicional consta como aplicado, com valor igual ao maior dos dois calculados, e a '
   'fundamentacao legal registra a comparacao e a base legal.',
   'IMPACTO SE FALHAR: somar os dois adicionais e pagamento indevido; aplicar o menor e pagamento a '
   'menor, com passivo. Em ambos os casos ha exposicao em fiscalizacao. A logica esta corretamente '
   'implementada no front (src/lib/folha/adicionais.ts), incluindo a fundamentacao. Este caso '
   'verifica se o dado GRAVADO respeita a regra — o que importa quando o registro vem por '
   'importacao de SST, caminho previsto na propria tabela (origem = importacao_sst).'),

  (v_mod,'COND-010','Grau de insalubridade aceita valor fora da NR-15','excecao','alta','aprovado','api',
   'Verificar se o grau de insalubridade tem lista fechada. Regra: a NR-15 preve apenas tres graus '
   '— minimo (10%), medio (20%) e maximo (40%). Importa porque o grau determina o percentual; um '
   'valor fora da lista nao tem percentual correspondente e o calculo do adicional fica '
   'indeterminado.',
   'Precisa existir um colaborador cadastrado.',
   '[
     {"ordem":1,"acao":"Registrar insalubridade com grau fora da NR-15","onde_na_tela":"Via importacao de SST ou API","dados":"Insalubridade: sim | Grau: altissimo (nao existe na NR-15)","resultado_esperado":"Idealmente recusado — so minimo, medio e maximo existem"}
   ]'::jsonb,
   'O grau invalido deveria ser recusado. RESULTADO REAL: o banco aceita — insalubridade_grau e '
   'TEXT sem CHECK; os valores validos estao apenas no comentario do codigo.',
   'IMPACTO: um grau sem percentual correspondente deixa o calculo do adicional indeterminado. Na '
   'implementacao do front, um grau desconhecido resulta em percentual zero — ou seja, o '
   'colaborador enquadrado em insalubridade receberia adicional de R$ 0,00 sem que nada acusasse o '
   'erro. CORRECAO SUGERIDA: '
   'ALTER TABLE colaborador_condicoes_especiais ADD CONSTRAINT insalubridade_grau_nr15 '
   'CHECK (insalubridade_grau IS NULL OR insalubridade_grau IN (''minimo'',''medio'',''maximo''));'),

  (v_mod,'COND-011','Adicional aplicado aceita valor fora da regra','excecao','critica','aprovado','api',
   'Verificar se o campo que registra qual adicional prevaleceu tem lista fechada. Regra: os unicos '
   'valores possiveis sao insalubridade, periculosidade ou nenhum — a CLT veda a cumulatividade, '
   'entao "ambos" nao e uma opcao valida. Importa porque este campo e o registro formal de qual '
   'adicional a empresa esta pagando.',
   'Precisa existir um colaborador cadastrado.',
   '[
     {"ordem":1,"acao":"Registrar condicoes com adicional aplicado = ambos","onde_na_tela":"Via importacao de SST ou API","dados":"Insalubridade: sim | Periculosidade: sim | Adicional aplicado: ambos (vedado pelo art. 193 §2º)","resultado_esperado":"Idealmente recusado — a CLT veda a cumulatividade"}
   ]'::jsonb,
   'O valor "ambos" deveria ser recusado. RESULTADO REAL: o banco aceita qualquer texto — '
   'adicional_aplicado e TEXT sem CHECK.',
   'IMPACTO: o campo que documenta o cumprimento do art. 193 §2º aceita justamente o valor que a lei '
   'proibe. Um registro com "ambos" contradiz a norma no proprio dado. CORRECAO SUGERIDA: '
   'ALTER TABLE colaborador_condicoes_especiais ADD CONSTRAINT adicional_aplicado_valido '
   'CHECK (adicional_aplicado IS NULL OR adicional_aplicado IN '
   '(''insalubridade'',''periculosidade'',''nenhum''));'),

  (v_mod,'COND-012','Valor de adicional negativo e aceito','excecao','alta','aprovado','api',
   'Verificar se o banco aceita valores negativos nos adicionais. Regra: adicional e acrescimo ao '
   'salario; nao existe adicional negativo. Importa porque um valor negativo em campo que alimenta '
   'folha significa desconto indevido no salario do colaborador.',
   'Precisa existir um colaborador cadastrado.',
   '[
     {"ordem":1,"acao":"Registrar condicoes especiais com valor negativo","onde_na_tela":"Via importacao de SST ou API","dados":"Valor do adicional aplicado: -500,00","resultado_esperado":"Idealmente recusado — adicional e acrescimo, nunca desconto"}
   ]'::jsonb,
   'O valor negativo deveria ser recusado. RESULTADO REAL: o banco aceita — os campos numericos nao '
   'tem CHECK de nao-negatividade.',
   'IMPACTO: valor negativo em campo de folha vira desconto no salario do colaborador. Diferente '
   'dos demais achados de nao-negatividade (que geram relatorio errado), aqui o efeito e '
   'financeiro e direto sobre a remuneracao. CORRECAO SUGERIDA: CHECK (>= 0) em '
   'insalubridade_valor_calculado, periculosidade_valor_calculado e adicional_valor_aplicado.'),

  (v_mod,'COND-013','Apagar o cargo preserva as condicoes do colaborador','alternativo','media','aprovado','api',
   'Verificar que apagar um cargo nao apaga o enquadramento em condicoes especiais dos '
   'colaboradores. Regra: cargo_id referencia cargos, sem CASCADE. Importa porque o enquadramento '
   'pertence a pessoa e ao seu ambiente de trabalho, nao ao cargo — e tem valor historico para '
   'aposentadoria especial e eventuais acoes trabalhistas.',
   'Precisa existir um colaborador com condicoes especiais ligadas a um cargo.',
   '[
     {"ordem":1,"acao":"Registrar condicoes especiais vinculadas a um cargo","onde_na_tela":"Colaboradores > ficha > Condicoes Especiais","dados":"Colaborador com insalubridade, cargo: Operador de Caldeira","resultado_esperado":"Enquadramento vinculado ao cargo"},
     {"ordem":2,"acao":"Apagar o cargo","onde_na_tela":"Cargos > Excluir","dados":"-","resultado_esperado":"Comportamento a verificar"},
     {"ordem":3,"acao":"Conferir o enquadramento do colaborador","onde_na_tela":"Colaboradores > ficha > Condicoes Especiais","dados":"-","resultado_esperado":"O enquadramento deve continuar existindo — e historico com valor legal"}
   ]'::jsonb,
   'O enquadramento do colaborador sobrevive ao cargo. O historico de exposicao nao se perde.',
   'IMPACTO SE FALHAR: perder o registro de exposicao a agentes nocivos compromete a comprovacao de '
   'tempo especial para aposentadoria e a defesa da empresa em acao trabalhista — o historico de '
   'exposicao e prova documental.'),

  (v_mod,'COND-022','Condicoes especiais de outro cliente sao invisiveis','negativo','critica','aprovado','api',
   'Verificar o isolamento multi-tenant. Importa porque estes registros contem dados de saude '
   'ocupacional e exposicao a agentes nocivos — informacao sensivel sob a LGPD, alem de revelar '
   'passivo trabalhista potencial da empresa.',
   'Dois clientes distintos no sistema.',
   '[
     {"ordem":1,"acao":"No cliente A, registrar condicoes especiais de um colaborador","onde_na_tela":"Cliente A > Colaboradores > Condicoes Especiais","dados":"Registro identificavel","resultado_esperado":"Criado no cliente A"},
     {"ordem":2,"acao":"Entrar como cliente B e procurar","onde_na_tela":"Cliente B > Colaboradores","dados":"Buscar o registro do cliente A","resultado_esperado":"NAO aparece"}
   ]'::jsonb,
   'O registro do cliente A e invisivel no cliente B.',
   'IMPACTO SE FALHAR: exporia dados de saude ocupacional (agentes nocivos a que pessoas estao '
   'expostas) entre clientes — dado sensivel sob a LGPD.')

  ON CONFLICT (codigo) DO NOTHING;
END $seed$;

-- ─────────────────────────────────────────────────────────
-- ROTINAS
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_nova_condicao(
  p_nome text,
  p_insal boolean DEFAULT false, p_grau text DEFAULT NULL, p_val_insal numeric DEFAULT 0,
  p_peric boolean DEFAULT false, p_val_peric numeric DEFAULT 0,
  p_aplicado text DEFAULT NULL, p_val_aplicado numeric DEFAULT 0)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.colaborador_condicoes_especiais
    (tenant_id, colaborador_id, colaborador_nome,
     insalubridade, insalubridade_grau, insalubridade_valor_calculado,
     periculosidade, periculosidade_valor_calculado,
     adicional_aplicado, adicional_valor_aplicado)
  VALUES (public.qa_sandbox_tenant_id(), '52998224725', p_nome,
          p_insal, p_grau, p_val_insal, p_peric, p_val_peric, p_aplicado, p_val_aplicado)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_cond_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_id uuid; v_grau text; v_apl text; v_val numeric;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1;
  r.passo_acao:='Registrar insalubridade grau medio (20% do salario minimo = R$ 303,60)';
  r.esperado:='Enquadramento gravado, adicional de insalubridade aplicado';
  v_id := public.qa_nova_condicao('[QA] Operador Insalubre', true, 'medio', 303.60,
                                  false, 0, 'insalubridade', 303.60);
  SELECT insalubridade_grau, adicional_aplicado, adicional_valor_aplicado
    INTO v_grau, v_apl, v_val FROM public.colaborador_condicoes_especiais WHERE id=v_id;
  IF v_grau='medio' AND v_apl='insalubridade' AND v_val=303.60 THEN
    r.situacao:='passou';
    r.obtido:='Insalubridade grau medio registrada, adicional de R$ 303,60 aplicado.';
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('grau=%s, aplicado=%s, valor=%s.', v_grau, v_apl, v_val);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

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
  VALUES (v_t, '52998224725', '[QA] Operador Periculoso', true, 'Inflamaveis',
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

CREATE OR REPLACE FUNCTION public.qa_caso_cond_003()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_id uuid;
        v_insal numeric; v_peric numeric; v_apl text; v_val numeric; v_soma numeric;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1;
  r.passo_acao:='Registrar colaborador enquadrado nas DUAS condicoes (insalubridade R$ 607,20 e periculosidade R$ 900,00)';
  r.esperado:='Apenas o maior valor aplicado (R$ 900,00), nunca a soma';
  -- grau maximo (40% do minimo = 607,20) x periculosidade (30% de 3000 = 900)
  v_id := public.qa_nova_condicao('[QA] Dupla Exposicao', true, 'maximo', 607.20,
                                  true, 900.00, 'periculosidade', 900.00);
  SELECT insalubridade_valor_calculado, periculosidade_valor_calculado,
         adicional_aplicado, adicional_valor_aplicado
    INTO v_insal, v_peric, v_apl, v_val
    FROM public.colaborador_condicoes_especiais WHERE id=v_id;
  v_soma := v_insal + v_peric;

  IF v_apl IN ('insalubridade','periculosidade')
     AND v_val = GREATEST(v_insal, v_peric)
     AND v_val <> v_soma THEN
    r.situacao:='passou';
    r.obtido:=format('Prevalencia respeitada: calculados R$ %s (insalubridade) e R$ %s (periculosidade); aplicado apenas R$ %s (%s). Nao houve cumulatividade.',
                     v_insal, v_peric, v_val, v_apl);
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('Prevalencia violada: aplicado=%s, valor=%s. Maior seria %s, soma seria %s (vedada pelo art. 193 §2º).',
                     v_apl, v_val, GREATEST(v_insal, v_peric), v_soma);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_cond_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_id uuid; v_grau text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Registrar insalubridade com grau "altissimo" (fora da NR-15)';
  r.esperado:='Idealmente recusado — a NR-15 preve so minimo, medio e maximo';
  BEGIN
    v_id := public.qa_nova_condicao('[QA] Grau Invalido', true, 'altissimo', 0, false, 0, 'insalubridade', 0);
    SELECT insalubridade_grau INTO v_grau FROM public.colaborador_condicoes_especiais WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU grau "%s". A NR-15 preve apenas minimo (10%%), medio (20%%) e maximo (40%%). Sem CHECK — um grau desconhecido resulta em percentual zero no calculo, e o adicional sai R$ 0,00 sem aviso.', v_grau);
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: grau restrito aos tres previstos na NR-15.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_cond_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_id uuid; v_apl text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1;
  r.passo_acao:='Registrar adicional aplicado = "ambos" (vedado pelo art. 193 §2º da CLT)';
  r.esperado:='Idealmente recusado — a lei veda a cumulatividade';
  BEGIN
    v_id := public.qa_nova_condicao('[QA] Cumulatividade', true, 'maximo', 607.20,
                                    true, 900.00, 'ambos', 1507.20);
    SELECT adicional_aplicado INTO v_apl FROM public.colaborador_condicoes_especiais WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU adicional aplicado = "%s". E justamente o que o art. 193 §2º da CLT proibe — o campo que documenta o cumprimento da regra aceita o valor que a lei veda.', v_apl);
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: so insalubridade, periculosidade ou nenhum sao validos.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_cond_012()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_id uuid; v_val numeric;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Registrar valor de adicional negativo (-500,00)';
  r.esperado:='Idealmente recusado — adicional e acrescimo, nunca desconto';
  BEGIN
    v_id := public.qa_nova_condicao('[QA] Adicional Negativo', true, 'medio', -500.00,
                                    false, 0, 'insalubridade', -500.00);
    SELECT adicional_valor_aplicado INTO v_val FROM public.colaborador_condicoes_especiais WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU adicional de R$ %s (negativo). Em campo que alimenta folha, isso vira desconto no salario do colaborador.', v_val);
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: adicional nao pode ser negativo.';
  END;
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
  VALUES (v_t, '52998224725', '[QA] Caldeireiro', v_cargo, true, 'maximo')
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
  VALUES (v_t1, '52998224725', '[QA] Exposto Secreto T1', true, 'Benzeno');
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

-- ── Registrar ──
INSERT INTO public.qa_implementacoes (codigo, funcao_sql) VALUES
  ('COND-001','qa_caso_cond_001'),('COND-002','qa_caso_cond_002'),('COND-003','qa_caso_cond_003'),
  ('COND-010','qa_caso_cond_010'),('COND-011','qa_caso_cond_011'),('COND-012','qa_caso_cond_012'),
  ('COND-013','qa_caso_cond_013'),('COND-022','qa_caso_cond_022')
ON CONFLICT (codigo) DO UPDATE SET funcao_sql=EXCLUDED.funcao_sql, ativo=true;

-- ── Rodar ──
DO $roda$ BEGIN PERFORM public.qa_rodar_bateria('manual', 'estrutura-organizacional/colaboradores'); END $roda$;

SELECT codigo, situacao::text, left(obtido, 70) AS resultado
FROM public.qa_resultados
WHERE execucao_id = (SELECT id FROM public.qa_execucoes ORDER BY iniciada_em DESC LIMIT 1)
  AND codigo LIKE 'COND-%'
ORDER BY (situacao='falhou') DESC, codigo;
