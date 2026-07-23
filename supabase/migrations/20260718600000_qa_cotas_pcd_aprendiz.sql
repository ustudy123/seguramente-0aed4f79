-- =========================================================
-- QA — COTAS LEGAIS: PcD (Lei 8.213/91) e Aprendiz (Lei 10.097/2000)
-- Módulo Empresa · complemento a partir dos cenários de teste do Alexandre
--
-- CONTEXTO (apurado no código, não suposto):
--
--  1) A cota PcD É CALCULADA, e corretamente — mas no FRONT
--     (EmpresaObrigacoesInclusao.tsx). As faixas batem com a Lei 8.213/91:
--       100 a 200   -> 2%
--       201 a 500   -> 3%
--       501 a 1.000 -> 4%
--       acima 1.000 -> 5%
--     com Math.ceil (arredonda a fração para cima). Nada disso existe no banco.
--
--  2) A cota de APRENDIZ NÃO é calculada. O auto-cálculo (5% a 15%) está
--     comentado no código, com a nota: "Removido conforme solicitado pelo
--     usuário. A regra de Jovem Aprendiz é complexa e deve ser informada
--     manualmente." Decisão consciente — a base de cálculo do aprendiz exclui
--     funções que exigem formação técnica e cargos de confiança.
--
--  3) OS DOIS NÚMEROS DE ENTRADA SÃO DIGITADOS À MÃO:
--       - empresa_cadastro.total_colaboradores  (não conta os vínculos reais)
--       - empresa_cadastro.pcd_quantidade_atual (não conta os PcDs reais)
--     Não há trigger, função nem CHECK no banco para nada disso.
--
-- ESTE ARQUIVO TEM DUAS PARTES:
--
--  PARTE A — casos EXECUTÁVEIS: testam a integridade dos dados de cota no
--    banco. Como todo o cálculo vive no front, o risco real é o banco aceitar
--    combinações incoerentes vindas de importação, API ou edição manual.
--
--  PARTE B — casos de ESPECIFICAÇÃO (documentados, sem rotina): descrevem o
--    comportamento que os cenários 11 a 19 pedem e que o sistema NÃO tem hoje.
--    Ficam registrados como especificação do que falta construir. Aparecem na
--    bateria como "sem rotina" — de propósito, até que a funcionalidade exista.
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- PARTE A · DOCUMENTAÇÃO DOS CASOS EXECUTÁVEIS
-- ─────────────────────────────────────────────────────────
DO $seed$
DECLARE v_mod uuid;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos WHERE path='estrutura-organizacional/empresa';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Modulo empresa nao encontrado.'; END IF;

  INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, nivel, objetivo, pre_condicoes, passos, resultado_esperado, observacoes)
  VALUES

  (v_mod,'EMP-030','Gravar cota PcD coerente com a faixa legal','feliz','alta','aprovado','api',
   'Verificar que os dados de cota PcD sao gravados e recuperados corretamente. Regra (Lei 8.213/91 '
   'art. 93): empresa com 350 empregados esta na faixa de 201 a 500, logo 3%; 350 x 3% = 10,5, que '
   'arredonda para 11. Importa porque a cota e obrigacao legal fiscalizavel — os numeros gravados '
   'sao a base do que a empresa precisa cumprir.',
   'Precisa existir uma empresa cadastrada.',
   '[
     {"ordem":1,"acao":"Abrir a empresa e ir as obrigacoes de inclusao","onde_na_tela":"Empresas > abrir a empresa > aba Obrigacoes de Inclusao","dados":"-","resultado_esperado":"Secao de cota PcD visivel"},
     {"ordem":2,"acao":"Informar o total de empregados","onde_na_tela":"Campo Total de Colaboradores","dados":"Total: 350","resultado_esperado":"O sistema marca a cota como obrigatoria e calcula 3%"},
     {"ordem":3,"acao":"Conferir o calculo","onde_na_tela":"Campos Percentual Exigido e Quantidade Exigida","dados":"-","resultado_esperado":"Percentual: 3% | Quantidade exigida: 11 (350 x 3% = 10,5, arredondado para cima)"},
     {"ordem":4,"acao":"Informar quantos PcDs a empresa tem e salvar","onde_na_tela":"Campo Quantidade Atual + Salvar","dados":"PcDs atuais: 11","resultado_esperado":"Situacao regular, sem deficit"}
   ]'::jsonb,
   'A empresa fica gravada com total 350, percentual 3%, cota exigida 11 e 11 PcDs atuais — situacao '
   'regular. Os valores persistem ao reabrir.',
   'IMPACTO SE FALHAR: se os dados de cota nao gravarem corretamente, a empresa perde o controle de '
   'uma obrigacao legal fiscalizavel pelo Ministerio do Trabalho, com risco de multa.'),

  (v_mod,'EMP-031','Percentual incoerente com a faixa de empregados','excecao','alta','aprovado','api',
   'Verificar se o banco aceita um percentual que nao corresponde a faixa legal do total de '
   'empregados. Regra: 1.200 empregados exigem 5%; gravar 2% seria uma cota subdimensionada. Este '
   'caso revela se ha validacao no banco. Importa porque o calculo correto vive apenas no front — '
   'dados que entrem por importacao ou API nao passam por ele.',
   'Precisa existir uma empresa cadastrada.',
   '[
     {"ordem":1,"acao":"Gravar uma empresa com 1.200 empregados mas percentual de 2%","onde_na_tela":"Via importacao de planilha ou API (fora da tela, que calcularia certo)","dados":"Total: 1200 | Percentual exigido: 2 (deveria ser 5) | Cota exigida: 24 (deveria ser 60)","resultado_esperado":"Idealmente o banco DEVERIA recusar ou corrigir"}
   ]'::jsonb,
   'A combinacao incoerente deveria ser recusada. RESULTADO REAL: o banco aceita — nao ha validacao '
   'de coerencia entre total de empregados e percentual exigido. Uma empresa pode ficar com cota '
   'subdimensionada no sistema.',
   'IMPACTO: cota subdimensionada da falsa sensacao de conformidade. A empresa acredita precisar de '
   '24 PcDs quando a lei exige 60 — diferenca de 36 vagas, com exposicao a multa e acao civil '
   'publica. CORRECAO SUGERIDA: criar no banco uma funcao que calcule o percentual pela faixa '
   '(replicando a logica do front) e aplica-la como trigger BEFORE INSERT OR UPDATE, recalculando '
   'percentual e quantidade exigida a partir de total_colaboradores.'),

  (v_mod,'EMP-032','Quantidade exigida que nao bate com o calculo','excecao','alta','aprovado','api',
   'Verificar se o banco aceita uma quantidade exigida diferente do resultado do calculo. Regra: '
   '480 empregados x 3% = 14,4, que arredonda para 15. Gravar 10 seria errado. Este caso revela se '
   'ha conferencia no banco. Importa porque e a quantidade exigida que orienta a contratacao.',
   'Precisa existir uma empresa cadastrada.',
   '[
     {"ordem":1,"acao":"Gravar empresa com 480 empregados, 3%, mas cota exigida 10","onde_na_tela":"Via importacao ou API","dados":"Total: 480 | Percentual: 3 | Cota exigida: 10 (o correto seria 15)","resultado_esperado":"Idealmente recusado — a quantidade deveria derivar do calculo"}
   ]'::jsonb,
   'A quantidade incoerente deveria ser recusada ou recalculada. RESULTADO REAL: o banco aceita '
   'qualquer numero em pcd_quantidade_exigida, sem relacao com total_colaboradores e percentual.',
   'IMPACTO: a empresa se orienta por uma meta errada de contratacao. No exemplo, acredita precisar '
   'de 10 PcDs quando a lei exige 15 — deficit real de 5 vagas nao identificado. CORRECAO SUGERIDA: '
   'a mesma trigger do EMP-031 deve derivar a quantidade, tornando o campo calculado em vez de livre.'),

  (v_mod,'EMP-033','Percentual de cota fora dos valores legais','excecao','media','aprovado','api',
   'Verificar se o banco aceita um percentual que nao existe na lei. Regra: os unicos percentuais '
   'validos sao 0 (isento), 2, 3, 4 e 5. Um valor como 7% ou 1,5% nao tem respaldo legal. Importa '
   'porque um percentual invalido gera uma cota sem base juridica.',
   'Precisa existir uma empresa cadastrada.',
   '[
     {"ordem":1,"acao":"Gravar uma empresa com percentual de cota fora da lei","onde_na_tela":"Via importacao ou API","dados":"Percentual exigido: 7 (nao existe na Lei 8.213/91)","resultado_esperado":"Idealmente recusado pelo banco"}
   ]'::jsonb,
   'O percentual invalido deveria ser recusado. RESULTADO REAL: o banco aceita — o campo e '
   'NUMERIC(5,2) sem CHECK de dominio.',
   'IMPACTO: cota calculada sobre percentual sem base legal. CORRECAO SUGERIDA: '
   'ALTER TABLE empresa_cadastro ADD CONSTRAINT pcd_percentual_legal '
   'CHECK (pcd_percentual_exigido IN (0, 2, 3, 4, 5));'),

  (v_mod,'EMP-034','Numeros negativos em campos de cota','excecao','media','aprovado','api',
   'Verificar se o banco aceita quantidades negativas nos campos de cota. Regra: quantidade de '
   'pessoas nao pode ser negativa. Importa porque um valor negativo quebra os calculos de deficit '
   'e as barras de progresso da tela.',
   'Precisa existir uma empresa cadastrada.',
   '[
     {"ordem":1,"acao":"Gravar uma empresa com quantidade de PcD negativa","onde_na_tela":"Via importacao ou API","dados":"PcDs atuais: -5 | Total de colaboradores: -100","resultado_esperado":"Idealmente recusado — nao existe quantidade negativa de pessoas"}
   ]'::jsonb,
   'Os valores negativos deveriam ser recusados. RESULTADO REAL: o banco aceita — os campos sao '
   'INTEGER sem CHECK de nao-negatividade.',
   'IMPACTO: deficit calculado errado (cota 10 menos "-5 PcDs" resulta em deficit de 15) e barras de '
   'progresso quebradas. CORRECAO SUGERIDA: CHECK (>= 0) em total_colaboradores, '
   'pcd_quantidade_atual, pcd_quantidade_exigida e nos campos equivalentes de aprendiz.'),

  (v_mod,'EMP-035','Mudar o total de empregados nao recalcula a cota gravada','excecao','critica','aprovado','api',
   'Verificar o que acontece com a cota ja gravada quando o total de empregados muda. Regra '
   'esperada (cenarios 11 a 13 da especificacao): admissoes e demissoes devem recalcular a cota. '
   'Importa porque este e o coracao do controle: uma empresa que cresce de 199 para 201 empregados '
   'muda de faixa (2% para 3%) e passa a precisar de mais PcDs.',
   'Precisa existir uma empresa com cota ja calculada e gravada.',
   '[
     {"ordem":1,"acao":"Gravar uma empresa na faixa de 2%","onde_na_tela":"Empresa > Obrigacoes de Inclusao","dados":"Total: 199 | Percentual: 2% | Cota exigida: 4","resultado_esperado":"Cota gravada corretamente para a faixa"},
     {"ordem":2,"acao":"Alterar o total de empregados para 201 (mudanca de faixa)","onde_na_tela":"Via importacao, API ou edicao do campo","dados":"Total: 201 (agora faixa de 3%, cota deveria virar 7)","resultado_esperado":"Idealmente a cota DEVERIA recalcular sozinha"},
     {"ordem":3,"acao":"Conferir a cota gravada","onde_na_tela":"Consultar os campos de cota da empresa","dados":"-","resultado_esperado":"Percentual e quantidade exigida deveriam refletir a nova faixa"}
   ]'::jsonb,
   'A cota deveria ser recalculada. RESULTADO REAL: os campos de cota continuam com os valores '
   'antigos (2% e 4). Nao ha trigger de recalculo no banco. Na tela, o recalculo acontece — mas so '
   'quando alguem abre a empresa e edita o total ali; por importacao ou API, a cota fica congelada.',
   'IMPACTO: uma empresa que cruzou a faixa fica com cota desatualizada e nao sabe. No exemplo, '
   'acredita precisar de 4 PcDs quando ja precisa de 7 — irregular sem saber, exposta a autuacao. '
   'CORRECAO SUGERIDA: trigger BEFORE INSERT OR UPDATE OF total_colaboradores em empresa_cadastro '
   'que recalcule percentual e quantidade exigida pela faixa legal.'),

  -- ── APRENDIZ ──

  (v_mod,'EMP-040','Gravar cota de aprendiz','feliz','media','aprovado','api',
   'Verificar que os dados de cota de aprendiz sao gravados e recuperados. NOTA: ao contrario da '
   'cota PcD, o sistema NAO calcula a cota de aprendiz — o auto-calculo foi removido do codigo por '
   'decisao de produto, porque a base de calculo legal e complexa (exclui funcoes que exigem '
   'formacao tecnica e cargos de confianca, conforme o Decreto 9.579/2018). Os valores sao '
   'informados manualmente.',
   'Precisa existir uma empresa cadastrada.',
   '[
     {"ordem":1,"acao":"Abrir a empresa e ir as obrigacoes de inclusao","onde_na_tela":"Empresas > abrir > aba Obrigacoes de Inclusao > secao Jovem Aprendiz","dados":"-","resultado_esperado":"Secao de aprendiz visivel"},
     {"ordem":2,"acao":"Informar a faixa de aprendizes e quantos a empresa tem","onde_na_tela":"Campos Quantidade Minima, Maxima e Atual","dados":"Minimo: 5 | Maximo: 15 | Atual: 8","resultado_esperado":"Valores aceitos"},
     {"ordem":3,"acao":"Salvar e reabrir","onde_na_tela":"Salvar > reabrir a empresa","dados":"-","resultado_esperado":"Os tres valores persistiram"}
   ]'::jsonb,
   'A empresa fica gravada com faixa de aprendiz de 5 a 15 e 8 aprendizes atuais — dentro da faixa.',
   'IMPACTO SE FALHAR: a empresa perde o controle da cota de aprendiz, que e obrigacao legal '
   'fiscalizavel (Lei 10.097/2000) com multa por descumprimento.'),

  (v_mod,'EMP-041','Faixa de aprendiz invertida (minimo maior que maximo)','excecao','media','aprovado','api',
   'Verificar se o banco aceita uma faixa de aprendiz incoerente. Regra: o minimo legal (5%) e '
   'sempre menor que o maximo (15%), entao minimo nao pode ser maior que maximo. Importa porque uma '
   'faixa invertida torna impossivel saber se a empresa esta ou nao em conformidade.',
   'Precisa existir uma empresa cadastrada.',
   '[
     {"ordem":1,"acao":"Gravar uma empresa com a faixa de aprendiz invertida","onde_na_tela":"Via importacao, API ou edicao","dados":"Quantidade minima: 20 | Quantidade maxima: 5 (invertido)","resultado_esperado":"Idealmente recusado — minimo nao pode exceder o maximo"}
   ]'::jsonb,
   'A faixa invertida deveria ser recusada. RESULTADO REAL: o banco aceita — nao ha CHECK de '
   'coerencia entre aprendiz_quantidade_minima e aprendiz_quantidade_maxima.',
   'IMPACTO: impossivel avaliar conformidade — com minimo 20 e maximo 5, nenhum numero de '
   'aprendizes satisfaz a faixa. CORRECAO SUGERIDA: ALTER TABLE empresa_cadastro ADD CONSTRAINT '
   'aprendiz_faixa_coerente CHECK (aprendiz_quantidade_minima <= aprendiz_quantidade_maxima). '
   'MESMO PADRAO do achado CARGO-012 (faixa salarial invertida) — vale corrigir os dois juntos.')

  ON CONFLICT (codigo) DO NOTHING;
END $seed$;

-- ─────────────────────────────────────────────────────────
-- PARTE A · ROTINAS
-- ─────────────────────────────────────────────────────────

-- helper: empresa no cercado com dados de cota
CREATE OR REPLACE FUNCTION public.qa_empresa_com_cota(
  p_nome text, p_cnpj text, p_total int DEFAULT NULL,
  p_pct numeric DEFAULT NULL, p_exigida int DEFAULT NULL, p_atual int DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.empresa_cadastro
    (tenant_id, razao_social, cnpj, total_colaboradores,
     pcd_obrigatoria, pcd_percentual_exigido, pcd_quantidade_exigida, pcd_quantidade_atual)
  VALUES (public.qa_sandbox_tenant_id(), p_nome, p_cnpj, COALESCE(p_total,0),
          COALESCE(p_total,0) >= 100, COALESCE(p_pct,0), COALESCE(p_exigida,0), COALESCE(p_atual,0))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_emp_030()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_id uuid; v_tot int; v_pct numeric; v_ex int; v_at int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Gravar empresa com 350 empregados, 3%, cota 11, 11 PcDs';
  r.esperado:='Dados de cota persistidos corretamente';
  v_id := public.qa_empresa_com_cota('[QA] Cota Coerente', '11222333000181', 350, 3, 11, 11);
  SELECT total_colaboradores, pcd_percentual_exigido, pcd_quantidade_exigida, pcd_quantidade_atual
    INTO v_tot, v_pct, v_ex, v_at FROM public.empresa_cadastro WHERE id=v_id;
  IF v_tot=350 AND v_pct=3 AND v_ex=11 AND v_at=11 THEN
    r.situacao:='passou';
    r.obtido:='Cota gravada: 350 empregados, 3%, exige 11, tem 11 — regular. (350 x 3% = 10,5 -> 11)';
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('Esperava 350/3/11/11, obteve %s/%s/%s/%s.', v_tot, v_pct, v_ex, v_at);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_emp_031()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_id uuid; v_pct numeric;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1;
  r.passo_acao:='Gravar 1.200 empregados com percentual de 2% (a lei exige 5%)';
  r.esperado:='Idealmente recusado — percentual nao corresponde a faixa';
  BEGIN
    v_id := public.qa_empresa_com_cota('[QA] Percentual Incoerente', '11444777000161', 1200, 2, 24, 0);
    SELECT pcd_percentual_exigido INTO v_pct FROM public.empresa_cadastro WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU %s%% para 1.200 empregados (a Lei 8.213/91 exige 5%%). Cota gravada: 24, quando a legal seria 60. Nao ha validacao de faixa no banco.', v_pct);
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: o banco valida o percentual contra a faixa legal.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_emp_032()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_id uuid; v_ex int; v_correto int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1;
  r.passo_acao:='Gravar 480 empregados, 3%, mas quantidade exigida 10 (o calculo daria 15)';
  r.esperado:='Idealmente recusado ou recalculado';
  v_correto := ceil(480 * 3 / 100.0);   -- 14,4 -> 15
  BEGIN
    v_id := public.qa_empresa_com_cota('[QA] Quantidade Incoerente', '11444777000242', 480, 3, 10, 0);
    SELECT pcd_quantidade_exigida INTO v_ex FROM public.empresa_cadastro WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU cota exigida = %s quando o calculo legal da %s (480 x 3%% = 14,4, arredonda para %s). O campo aceita qualquer numero.', v_ex, v_correto, v_correto);
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: o banco confere a quantidade contra o calculo.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_emp_033()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_id uuid; v_pct numeric;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Gravar percentual de cota = 7% (nao existe na Lei 8.213/91)';
  r.esperado:='Idealmente recusado — so 0, 2, 3, 4 e 5 sao validos';
  BEGIN
    v_id := public.qa_empresa_com_cota('[QA] Percentual Fora da Lei', '11444777000323', 300, 7, 21, 0);
    SELECT pcd_percentual_exigido INTO v_pct FROM public.empresa_cadastro WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU percentual = %s%%. A Lei 8.213/91 preve apenas 2, 3, 4 e 5%%. Campo NUMERIC sem CHECK de dominio.', v_pct);
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: percentual restrito aos valores legais.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_emp_034()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_id uuid; v_at int; v_tot int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Gravar quantidade de PcD = -5 e total de empregados = -100';
  r.esperado:='Idealmente recusado — nao existe quantidade negativa de pessoas';
  BEGIN
    v_id := public.qa_empresa_com_cota('[QA] Negativos', '11444777000404', -100, 2, 0, -5);
    SELECT pcd_quantidade_atual, total_colaboradores INTO v_at, v_tot
      FROM public.empresa_cadastro WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU %s PcDs e %s empregados (negativos). Campos INTEGER sem CHECK de nao-negatividade.', v_at, v_tot);
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: quantidades negativas sao barradas.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_emp_035()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_id uuid; v_pct numeric; v_ex int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Gravar empresa com 199 empregados (faixa 2%, cota 4)';
  r.esperado:='Ao mudar para 201, a cota deveria virar 3% e 7';
  v_id := public.qa_empresa_com_cota('[QA] Mudanca de Faixa', '11444777000595', 199, 2, 4, 4);

  r.passo_ordem:=2; r.passo_acao:='Alterar o total para 201 (cruza a faixa de 2% para 3%)';
  UPDATE public.empresa_cadastro SET total_colaboradores = 201 WHERE id = v_id;

  r.passo_ordem:=3; r.passo_acao:='Conferir se a cota gravada acompanhou a mudanca de faixa';
  SELECT pcd_percentual_exigido, pcd_quantidade_exigida INTO v_pct, v_ex
    FROM public.empresa_cadastro WHERE id=v_id;

  IF v_pct = 3 AND v_ex = 7 THEN
    r.situacao:='passou';
    r.obtido:='A cota recalculou sozinha ao mudar de faixa: 3% e 7 PcDs. Ha automacao no banco.';
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('A cota NAO recalculou. Empresa passou para 201 empregados (faixa de 3%%, exige 7) mas continua gravada com %s%% e %s PcDs. Sem trigger de recalculo no banco — so a tela recalcula, e apenas quando alguem edita por la.', v_pct, v_ex);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_emp_040()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
        v_min int; v_max int; v_at int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Gravar empresa com faixa de aprendiz de 5 a 15, com 8 atuais';
  r.esperado:='Os tres valores persistem';
  INSERT INTO public.empresa_cadastro
    (tenant_id, razao_social, cnpj, aprendiz_obrigatorio,
     aprendiz_quantidade_minima, aprendiz_quantidade_maxima, aprendiz_quantidade_atual)
  VALUES (v_t, '[QA] Cota Aprendiz', '11444777000676', true, 5, 15, 8) RETURNING id INTO v_id;
  SELECT aprendiz_quantidade_minima, aprendiz_quantidade_maxima, aprendiz_quantidade_atual
    INTO v_min, v_max, v_at FROM public.empresa_cadastro WHERE id=v_id;
  IF v_min=5 AND v_max=15 AND v_at=8 THEN
    r.situacao:='passou'; r.obtido:='Faixa de aprendiz gravada: 5 a 15, com 8 atuais (dentro da faixa).';
  ELSE
    r.situacao:='falhou'; r.obtido:=format('Esperava 5/15/8, obteve %s/%s/%s.', v_min, v_max, v_at);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_emp_041()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_min int; v_max int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Gravar faixa de aprendiz invertida: minimo 20, maximo 5';
  r.esperado:='Idealmente recusado — minimo nao pode exceder o maximo';
  BEGIN
    INSERT INTO public.empresa_cadastro
      (tenant_id, razao_social, cnpj, aprendiz_obrigatorio,
       aprendiz_quantidade_minima, aprendiz_quantidade_maxima)
    VALUES (v_t, '[QA] Faixa Aprendiz Invertida', '11444777000757', true, 20, 5)
    RETURNING id INTO v_id;
    SELECT aprendiz_quantidade_minima, aprendiz_quantidade_maxima INTO v_min, v_max
      FROM public.empresa_cadastro WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU minimo (%s) maior que o maximo (%s). Sem CHECK de coerencia — mesmo padrao do achado CARGO-012.', v_min, v_max);
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: minimo nao pode ser maior que o maximo.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

-- ── Registrar as rotinas ──
INSERT INTO public.qa_implementacoes (codigo, funcao_sql) VALUES
  ('EMP-030','qa_caso_emp_030'),('EMP-031','qa_caso_emp_031'),('EMP-032','qa_caso_emp_032'),
  ('EMP-033','qa_caso_emp_033'),('EMP-034','qa_caso_emp_034'),('EMP-035','qa_caso_emp_035'),
  ('EMP-040','qa_caso_emp_040'),('EMP-041','qa_caso_emp_041')
ON CONFLICT (codigo) DO UPDATE SET funcao_sql=EXCLUDED.funcao_sql, ativo=true;

-- ─────────────────────────────────────────────────────────
-- PARTE B · ESPECIFICAÇÃO DO QUE FALTA (casos SEM rotina)
--
-- Estes casos descrevem comportamento que o sistema NÃO tem hoje. Ficam
-- documentados como especificação: quando a funcionalidade for construída,
-- basta escrever a rotina e eles passam a rodar. Até lá aparecem na bateria
-- como "sem rotina" — de propósito, sinalizando trabalho pendente.
-- ─────────────────────────────────────────────────────────
DO $spec$
DECLARE v_mod uuid;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos WHERE path='estrutura-organizacional/empresa';

  INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, nivel, objetivo, pre_condicoes, passos, resultado_esperado, observacoes)
  VALUES

  (v_mod,'EMP-050','[A CONSTRUIR] Total de empregados vir da contagem real','feliz','alta','rascunho','api',
   'ESPECIFICACAO — nao implementado. O total de empregados da empresa deveria vir da contagem de '
   'vinculos ativos, nao de digitacao manual. Hoje empresa_cadastro.total_colaboradores e um campo '
   'preenchido a mao, sem ligacao com os colaboradores cadastrados.',
   'Depende de definir a regra: quais vinculos entram na contagem (ativos? por empresa? incluindo '
   'afastados?). A base de calculo da cota PcD tem definicao legal propria.',
   '[
     {"ordem":1,"acao":"Cadastrar colaboradores vinculados a empresa","onde_na_tela":"Colaboradores > Novo","dados":"Cadastrar 201 colaboradores ativos na empresa","resultado_esperado":"O total de empregados da empresa deveria passar a 201 automaticamente"},
     {"ordem":2,"acao":"Conferir o cadastro da empresa","onde_na_tela":"Empresas > Obrigacoes de Inclusao","dados":"-","resultado_esperado":"Total: 201, sem ninguem ter digitado"}
   ]'::jsonb,
   'ESPECIFICACAO: o total deveria refletir os vinculos reais. HOJE: e um numero digitado; se o RH '
   'admite 50 pessoas, o campo nao muda.',
   'ORIGEM: cenarios 11, 12, 13 e 15 da especificacao de cotas. PRE-REQUISITO para os casos EMP-051 '
   'a EMP-054 — sem o total automatico, nenhum recalculo por movimentacao e possivel. DECISAO DE '
   'PRODUTO NECESSARIA: definir a base de calculo (quais vinculos contam).'),

  (v_mod,'EMP-051','[A CONSTRUIR] Admissao e demissao recalculam a cota','feliz','alta','rascunho','api',
   'ESPECIFICACAO — nao implementado. Admitir ou demitir empregados deveria recalcular a cota PcD '
   'automaticamente, inclusive quando a movimentacao cruza uma faixa legal.',
   'Depende do EMP-050 (total vindo da contagem real).',
   '[
     {"ordem":1,"acao":"Partir de uma empresa com 199 empregados e 4 PcDs (regular na faixa de 2%)","onde_na_tela":"Empresa > Obrigacoes de Inclusao","dados":"Total: 199 | Cota: 4 | PcDs: 4","resultado_esperado":"Situacao regular"},
     {"ordem":2,"acao":"Admitir 2 empregados nao PcD","onde_na_tela":"Admissao > Novo","dados":"2 admissoes","resultado_esperado":"Total passa a 201, cruzando para a faixa de 3%"},
     {"ordem":3,"acao":"Conferir a cota","onde_na_tela":"Empresa > Obrigacoes de Inclusao","dados":"-","resultado_esperado":"Cota deveria virar 7 (201 x 3% = 6,03 -> 7) e a situacao passar a irregular, com deficit de 3"}
   ]'::jsonb,
   'ESPECIFICACAO: a cota acompanha a movimentacao de pessoal. HOJE: nao acontece — a cota so muda '
   'se alguem editar a empresa manualmente.',
   'ORIGEM: cenarios 11, 12 e 13. Inclui tambem o caso inverso (cenario 13): demitir empregados nao '
   'PcD pode fazer a empresa VOLTAR para uma faixa menor, gerando excedente em vez de deficit.'),

  (v_mod,'EMP-052','[A CONSTRUIR] Contar apenas PcDs com documentacao valida','feliz','alta','rascunho','api',
   'ESPECIFICACAO — nao implementado. So deveriam contar para a cota os PcDs com laudo valido e '
   'dentro do prazo. Hoje pcd_quantidade_atual e um numero digitado, sem ligacao com pessoas nem '
   'com documentos.',
   'Depende de: (a) marcar colaboradores como PcD no cadastro, (b) vincular o laudo ao colaborador, '
   '(c) controlar a validade desse laudo.',
   '[
     {"ordem":1,"acao":"Marcar 3 colaboradores como PcD","onde_na_tela":"Colaboradores > ficha > campo PcD","dados":"3 colaboradores marcados como PcD","resultado_esperado":"3 PcDs cadastrados"},
     {"ordem":2,"acao":"Anexar laudo valido a apenas 2 deles","onde_na_tela":"Colaborador > Documentos > laudo PcD","dados":"2 laudos validos, 1 sem laudo","resultado_esperado":"Documentacao registrada"},
     {"ordem":3,"acao":"Conferir a contagem para a cota","onde_na_tela":"Empresa > Obrigacoes de Inclusao","dados":"-","resultado_esperado":"Deveria contar 2 PcDs validos (nao 3) e alertar: PcD sem documentacao comprobatoria"}
   ]'::jsonb,
   'ESPECIFICACAO: a cota conta apenas PcDs comprovados. HOJE: nao existe — o sistema nao sabe quem '
   'sao os PcDs, apenas quantos alguem digitou.',
   'ORIGEM: cenarios 17 e 18. RISCO DE NEGOCIO: em fiscalizacao, o que vale e a documentacao. Uma '
   'empresa pode se considerar regular contando pessoas cuja condicao nao esta comprovada, e ser '
   'autuada mesmo assim. Inclui tambem laudo VENCIDO (cenario 18), o que exige controle de validade '
   'ligado ao colaborador.'),

  (v_mod,'EMP-053','[A CONSTRUIR] Reabilitados do INSS contam para a cota','feliz','media','rascunho','api',
   'ESPECIFICACAO — nao implementado. A Lei 8.213/91 admite na cota tanto pessoas com deficiencia '
   'quanto beneficiarios reabilitados do INSS. O sistema nao distingue as duas categorias.',
   'Depende do EMP-052 (identificar os PcDs individualmente).',
   '[
     {"ordem":1,"acao":"Cadastrar colaboradores em ambas as categorias","onde_na_tela":"Colaboradores > ficha","dados":"6 PcDs + 2 reabilitados do INSS","resultado_esperado":"As duas categorias sao registradas distintamente"},
     {"ordem":2,"acao":"Conferir a contagem para a cota","onde_na_tela":"Empresa > Obrigacoes de Inclusao","dados":"Empresa com 250 empregados, cota exigida 8","resultado_esperado":"Total valido para a cota: 8 (6 PcDs + 2 reabilitados) — situacao regular"}
   ]'::jsonb,
   'ESPECIFICACAO: as duas categorias somam para a cota, mas sao registradas separadamente. HOJE: '
   'nao ha distincao — existe apenas um contador unico digitado.',
   'ORIGEM: cenario 19. A distincao importa alem da soma: os documentos comprobatorios sao '
   'diferentes (laudo medico para PcD, certificado de reabilitacao para o beneficiario do INSS), e '
   'a fiscalizacao pode exigir a composicao detalhada.'),

  (v_mod,'EMP-054','[A CONSTRUIR] Cota considera o total da empresa, nao de cada filial','feliz','media','rascunho','api',
   'ESPECIFICACAO — nao implementado de forma garantida. A cota deve ser apurada sobre o total da '
   'empresa (todos os estabelecimentos somados), nao por filial isolada. Hoje, como o total e '
   'digitado, isso depende inteiramente de quem preenche fazer a soma certa.',
   'Depende do EMP-050 (contagem automatica), que precisaria somar os vinculos de todos os '
   'estabelecimentos da empresa.',
   '[
     {"ordem":1,"acao":"Cadastrar uma empresa com tres estabelecimentos","onde_na_tela":"Estabelecimentos","dados":"Matriz: 80 empregados | Filial 1: 50 | Filial 2: 40","resultado_esperado":"Tres estabelecimentos cadastrados"},
     {"ordem":2,"acao":"Conferir o total considerado para a cota","onde_na_tela":"Empresa > Obrigacoes de Inclusao","dados":"-","resultado_esperado":"Total: 170 (a soma) — cota exigida 4, e nao isencao por nenhuma filial ter menos de 100"}
   ]'::jsonb,
   'ESPECIFICACAO: a apuracao e por empresa, somando os estabelecimentos. HOJE: sem garantia '
   'sistemica — se quem preenche digitar o numero de uma filial so, a empresa aparece isenta ou com '
   'cota menor sem que nada acuse.',
   'ORIGEM: cenarios 15 e 16. RISCO: uma empresa com tres filiais de 80, 50 e 40 empregados poderia '
   'ser lancada como isenta (nenhuma filial atinge 100), quando na verdade tem 170 empregados e '
   'deve 4 PcDs.')

  ON CONFLICT (codigo) DO NOTHING;
END $spec$;

-- ── Rodar o módulo Empresa (inclui os casos novos) ──
DO $roda$ BEGIN PERFORM public.qa_rodar_bateria('manual', 'estrutura-organizacional/empresa'); END $roda$;

SELECT codigo, situacao::text, left(obtido, 72) AS resultado
FROM public.qa_resultados
WHERE execucao_id = (SELECT id FROM public.qa_execucoes ORDER BY iniciada_em DESC LIMIT 1)
  AND codigo LIKE 'EMP-0%'
ORDER BY (situacao='falhou') DESC, codigo;
