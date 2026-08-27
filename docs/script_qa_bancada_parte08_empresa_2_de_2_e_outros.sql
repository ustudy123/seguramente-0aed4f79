-- ============================================================================
-- ENTREGA — BANCADA DE QA NA PRODUCAO — parte 8 de 15
-- Empresa (2 de 2), Estabelecimentos / Obras e Folha de Pagamento
--
-- POR QUE ESTA TRILHA EXISTE
-- A bancada de testes tem tres camadas: a ROTINA (uma funcao), o CASO
-- DOCUMENTADO (linha em qa_casos_teste) e a PONTE que liga uma a outra
-- (qa_implementacoes). Rotina e estrutura; caso e ponte sao dados. As tres
-- nasceram em migrations, que so alcancam o ambiente de teste — nunca a
-- producao. Resultado medido: a producao documenta 568 casos e executa 268,
-- enquanto o projeto documenta 822 e executa 565.
--
-- Esta trilha leva as tres camadas para a producao. A homologacao herda na
-- proxima copia (as tabelas do motor de QA sao copiadas de la na integra).
--
-- GARANTIAS
--   - Idempotente: rodar duas vezes nao duplica nem quebra.
--   - NAO altera nenhuma regra de negocio. So a bancada que as verifica.
--   - Modulo resolvido pelo CAMINHO, nao pelo identificador interno (os
--     identificadores diferem entre ambientes).
--   - A ponte so e criada quando a rotina existe de fato no destino.
--   - Cada rotina entra em bloco proprio: falha de uma vira NOTICE, nao
--     aborta o arquivo.
--   - O cercado (tenant isolado onde os testes rodam) JA existe na producao —
--     esta trilha nao mexe nele, nem em dado de cliente.
-- Roda inteiro em UMA transacao.
-- ============================================================================

SET lock_timeout = '10s';

-- (1) ROTINAS — 32 funcoes de teste.

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_est_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Cadastrar estabelecimento "Unidade Centro"'; r.esperado:='Criado';
  INSERT INTO public.filiais (tenant_id, nome, tipo, cidade, estado)
  VALUES (v_t, '[QA] Unidade Centro', 'estabelecimento', 'Maringa', 'PR') RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN r.situacao:='passou'; r.obtido:='Estabelecimento criado.';
  ELSE r.situacao:='falhou'; r.obtido:='Nao criou.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_est_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_est_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_est_002()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_cno text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Cadastrar OBRA com CNO 12.345.67890/12'; r.esperado:='Obra criada com o CNO gravado';
  INSERT INTO public.filiais (tenant_id, nome, tipo, cno, cidade, estado)
  VALUES (v_t, '[QA] Obra Residencial', 'obra', '12.345.67890/12', 'Maringa', 'PR') RETURNING id INTO v_id;
  SELECT cno INTO v_cno FROM public.filiais WHERE id=v_id;
  IF v_cno = '12.345.67890/12' THEN r.situacao:='passou'; r.obtido:='Obra criada com CNO gravado.';
  ELSE r.situacao:='falhou'; r.obtido:='CNO nao persistiu: '||COALESCE(v_cno,'(nulo)'); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_est_002()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_est_002 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_est_003()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_cid text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar e depois mudar a cidade da filial'; r.esperado:='Cidade nova persiste';
  INSERT INTO public.filiais (tenant_id, nome, cidade) VALUES (v_t, '[QA] Filial Editavel', 'Maringa') RETURNING id INTO v_id;
  UPDATE public.filiais SET cidade='Londrina' WHERE id=v_id;
  SELECT cidade INTO v_cid FROM public.filiais WHERE id=v_id;
  IF v_cid='Londrina' THEN r.situacao:='passou'; r.obtido:='Edicao persistiu.';
  ELSE r.situacao:='falhou'; r.obtido:='Cidade='||v_cid; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_est_003()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_est_003 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_est_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar criar filial sem nome'; r.esperado:='Recusado (NOT NULL)';
  BEGIN
    INSERT INTO public.filiais (tenant_id, nome) VALUES (v_t, NULL);
    r.situacao:='falhou'; r.obtido:='ACEITOU sem nome.';
  EXCEPTION WHEN not_null_violation THEN r.situacao:='passou'; r.obtido:='Recusado com not_null_violation.'; END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_est_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_est_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_est_011()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t1 uuid := public.qa_sandbox_tenant_id(); v_t2 uuid := public.qa_sandbox2_tenant_id(); v_n int;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN r.situacao:='erro'; r.obtido:='2o cercado nao existe.'; RETURN r; END IF;
  r.passo_ordem:=1; r.passo_acao:='Criar "Matriz" no tenant 1 e no tenant 2'; r.esperado:='Aceito nos dois (UNIQUE por tenant)';
  INSERT INTO public.filiais (tenant_id, nome) VALUES (v_t1, '[QA] Matriz Comum');
  INSERT INTO public.filiais (tenant_id, nome) VALUES (v_t2, '[QA] Matriz Comum');
  SELECT count(*) INTO v_n FROM public.filiais WHERE nome='[QA] Matriz Comum' AND tenant_id IN (v_t1,v_t2);
  IF v_n=2 THEN r.situacao:='passou'; r.obtido:='Mesmo nome convive em clientes diferentes.';
  ELSE r.situacao:='falhou'; r.obtido:=format('Esperava 2, achou %s.', v_n); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_est_011()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_est_011 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_est_013()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_emp uuid; v_fil uuid; v_emp_da_fil uuid; v_existe boolean;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar empresa e uma filial ligada a ela'; r.esperado:='Apagar a empresa desassocia a filial, nao a apaga';
  v_emp := public.qa_nova_empresa('[QA] Empresa Com Filial', '55666777000188');
  INSERT INTO public.filiais (tenant_id, nome, empresa_id) VALUES (v_t, '[QA] Filial Orfa', v_emp) RETURNING id INTO v_fil;
  r.passo_ordem:=2; r.passo_acao:='Apagar a empresa';
  DELETE FROM public.empresa_cadastro WHERE id=v_emp;
  r.passo_ordem:=3; r.passo_acao:='Conferir que a filial sobreviveu, agora sem empresa';
  SELECT EXISTS(SELECT 1 FROM public.filiais WHERE id=v_fil) INTO v_existe;
  SELECT empresa_id INTO v_emp_da_fil FROM public.filiais WHERE id=v_fil;
  IF v_existe AND v_emp_da_fil IS NULL THEN
    r.situacao:='passou'; r.obtido:='Filial sobreviveu e ficou sem empresa (SET NULL), como esperado.';
  ELSE r.situacao:='falhou'; r.obtido:=format('Filial existe=%s, empresa=%s.', v_existe, v_emp_da_fil); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_est_013()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_est_013 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_est_020()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar filial e tentar outra com o mesmo nome'; r.esperado:='Segundo recusado (UNIQUE)';
  INSERT INTO public.filiais (tenant_id, nome) VALUES (v_t, '[QA] Filial Repetida');
  BEGIN
    INSERT INTO public.filiais (tenant_id, nome) VALUES (v_t, '[QA] Filial Repetida');
    r.situacao:='falhou'; r.obtido:='ACEITOU nome duplicado no mesmo cliente.';
  EXCEPTION WHEN unique_violation THEN r.situacao:='passou'; r.obtido:='Recusado: nome unico por cliente.'; END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_est_020()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_est_020 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_est_022()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t1 uuid := public.qa_sandbox_tenant_id(); v_t2 uuid := public.qa_sandbox2_tenant_id(); v_vis int;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN r.situacao:='erro'; r.obtido:='2o cercado nao existe.'; RETURN r; END IF;
  r.passo_ordem:=1; r.passo_acao:='Criar filial no tenant 1'; r.esperado:='Invisivel ao tenant 2';
  INSERT INTO public.filiais (tenant_id, nome) VALUES (v_t1, '[QA] Filial Secreta T1');
  r.passo_ordem:=2; r.passo_acao:='Contar, filtrando pelo tenant 2';
  SELECT count(*) INTO v_vis FROM public.filiais WHERE tenant_id=v_t2 AND nome='[QA] Filial Secreta T1';
  IF v_vis=0 THEN r.situacao:='passou'; r.obtido:='Filial do tenant 1 invisivel ao tenant 2.';
  ELSE r.situacao:='falhou'; r.obtido:=format('VAZAMENTO: %s filial(is) visiveis.', v_vis); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_est_022()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_est_022 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_folha_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_aceitou boolean := false; v_gate text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Criar rubrica SEM natureza do eSocial e sem nenhuma incidência definida';
  r.esperado := 'Aceita no máximo como rascunho — jamais utilizável em cálculo';
  BEGIN
    INSERT INTO public.folha_rubricas
      (tenant_id, codigo_interno, descricao, ativa)
    VALUES (v_t, 'QA-F001', 'QA Rubrica Sem Natureza', true);
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR raise_exception OR not_null_violation THEN
    v_aceitou := false; END;

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA: alguém bloqueia o cálculo quando há rubrica sem classificação?';
  r.esperado := 'Função/trava que impeça processar com classificacao_esocial vazia (CA-001)';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_gate
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%classificacao_esocial%';

  IF v_aceitou AND v_gate IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a rubrica nasceu ATIVA sem natureza do eSocial nem incidências — '
             || 'classificacao_esocial é NULLABLE, as incidências têm DEFAULT false (que é '
             || 'uma DEFINIÇÃO, não uma pendência) e nenhuma função confere a classificação '
             || 'antes do cálculo. Rubrica sem S-1010 que entra na folha produz base errada '
             || 'de INSS/FGTS/IRRF e evento rejeitado — ou aceito com tributo errado, que é '
             || 'pior. O CA-001 manda BLOQUEAR o cálculo até definir. Correção: estado '
             || '"incompleta" para rubrica sem classificação + trava no processamento e no '
             || 'lançamento (a tabela distingue default de decisão).';
  ELSIF NOT v_aceitou THEN
    r.situacao := 'passou';
    r.obtido := 'A rubrica sem classificação foi recusada na criação.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Classificação conferida por: %s.', v_gate);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_folha_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_folha_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_folha_002()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_vig text; v_hist text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a tabela de rubricas tem vigência/versionamento?';
  r.esperado := 'Alteração de incidência cria vigência nova; o passado preserva a definição da época';
  v_vig := coalesce(public.qa_col_existe('folha_rubricas', 'vigencia%'),
                    public.qa_col_existe('folha_rubricas', '%versao%'));
  SELECT string_agg(DISTINCT t.tgname, ', ') INTO v_hist
  FROM pg_trigger t
  WHERE t.tgrelid = 'public.folha_rubricas'::regclass AND NOT t.tgisinternal
    AND t.tgname NOT ILIKE '%updated_at%' AND t.tgname NOT ILIKE 'qa\_%';

  IF v_vig IS NULL AND v_hist IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: folha_rubricas não tem vigência nem trilha de versão — um UPDATE '
             || 'na incidência vale retroativamente para TODAS as épocas, e nenhum gatilho '
             || 'guarda a definição anterior. A folha de março foi calculada com a regra de '
             || 'março; mudada a rubrica em agosto, a reprodução do cálculo (RNF-007) passa '
             || 'a dar outro resultado e a auditoria não consegue explicar a diferença. O '
             || 'contraste é didático: folha_tabelas_inss/irrf JÁ SÃO versionadas por '
             || 'vigência — falta aplicar o mesmo desenho à tabela que dirige o cálculo '
             || 'inteiro (e que o S-1010 também versiona por período). Correção: vigência '
             || 'na rubrica (ou tabela de vigências filha) + resolução por competência.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Versionamento presente (vigência: %s; trilha: %s).',
                       coalesce(v_vig, '—'), coalesce(v_hist, '—'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_folha_002()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_folha_002 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_folha_030()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_per uuid; v_aceitou boolean := false; v_aut text;
BEGIN
  PERFORM public.qa_modo_ligar();

  INSERT INTO public.folha_periodos (tenant_id, competencia, status)
  VALUES (v_t, '2098-01', 'aberto')
  ON CONFLICT (tenant_id, competencia) DO UPDATE SET status = 'aberto'
  RETURNING id INTO v_per;

  r.passo_ordem := 1;
  r.passo_acao := 'Lançar desconto avulso sem amparo (sem rubrica, texto livre, valor alto)';
  r.esperado := 'Bloqueado — desconto só com amparo do art. 462 (lei, CCT ou adiantamento) e dentro do teto';
  BEGIN
    INSERT INTO public.folha_lancamentos
      (tenant_id, periodo_id, colaborador_id, colaborador_nome,
       rubrica_descricao, tipo, valor, origem)
    VALUES (v_t, v_per, 'qa-folha-030', 'QA Desconto Livre',
            'Desconto avulso sem amparo', 'DESCONTO', 950.00, 'manual');
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR raise_exception OR foreign_key_violation THEN
    v_aceitou := false; END;

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA: existe registro de autorização (desconto sindical) e teto de VT?';
  r.esperado := 'Autorização expressa para sindical; limite de 6% para VT; tipos parametrizados';
  v_aut := coalesce(public.qa_col_existe(NULL, '%autorizacao_desconto%'),
                    public.qa_col_existe(NULL, '%desconto_sindical%'),
                    public.qa_fns_com('%desconto%462%'));

  IF v_aceitou AND v_aut IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o desconto entrou SEM AMPARO — folha_lancamentos aceita DESCONTO '
             || 'com descrição em texto livre, sem rubrica, sem teto e sem vínculo a lei/'
             || 'CCT/adiantamento; não existe registro de autorização para desconto '
             || 'sindical (facultativo desde a Lei 13.467) nem trava de 6% para o VT. O '
             || 'art. 462 é taxativo: desconto fora das hipóteses é devolução em dobro na '
             || 'reclamatória. Correção: lançamento de desconto exige rubrica classificada '
             || '(amparo declarado), teto por tipo (VT 6% do salário-base) e autorização '
             || 'arquivada quando a lei a exigir.';
  ELSIF NOT v_aceitou THEN
    r.situacao := 'passou';
    r.obtido := 'O desconto sem amparo foi recusado no lançamento.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Aceito com estrutura de amparo disponível (%s) — conferir a '
                       || 'obrigatoriedade no fluxo.', v_aut);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_folha_030()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_folha_030 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_folha_040()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): alguém calcula o 5º dia útil de verdade?';
  r.esperado := 'Motor de dias úteis (sábado conta, domingo/feriado não) alimentando o prazo do art. 459';
  -- procura pelo prazo de PAGAMENTO em dias úteis — cuidado com os parentes
  -- falsos: "media_utilizada" contém "dia_util", e a equalização do Ponto
  -- conta dias úteis para outra finalidade (jornada, não prazo do art. 459)
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%quinto%'
         OR ((p.prosrc ILIKE '%dia_util%' OR p.prosrc ILIKE '%dias_uteis%')
             AND (p.prosrc ILIKE '%pagamento%' OR p.prosrc ILIKE '%folha_alertas%')))
    AND p.proname NOT ILIKE '%noturno%' AND p.proname NOT ILIKE '%equalizacao%';

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o 5º dia útil não é calculado em lugar nenhum — a tela de alertas '
             || 'semeia o prazo de pagamento como DIA 7 FIXO ("aprox 5º útil", literalmente '
             || 'no código), sem olhar sábados, domingos nem a tabela feriados. Nos meses em '
             || 'que o 5º dia útil cai no dia 5 ou 6, o alerta chega DEPOIS do prazo legal — '
             || 'um vigia que acorda atrasado. E não há registro de pagamento × limite para '
             || 'acusar o atraso (art. 459, §1º). Correção: função de dias úteis (sábado '
             || 'conta para este fim; domingo/feriado não) alimentando folha_alertas_prazo '
             || 'com a data real, alertas D-3/2/1 e atraso acusado com trilha. Terceiro '
             || 'módulo pedindo o mesmo motor de datas (DEC13-031, DESL-015).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Motor de dias úteis presente: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_folha_040()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_folha_040 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_folha_050()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_rat text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): os encargos patronais têm estrutura?';
  r.esperado := 'Patronal 20% + RAT×FAP + terceiros parametrizados por empresa, com vigência';
  -- os pedaços existem espalhados: empresa_cadastro.fap_atual/historico é o
  -- MONITORAMENTO do FAP (SST) e ferias_config.encargo_rat_fap/terceiros é o
  -- provisionamento de FÉRIAS — nada disso calcula a patronal da competência
  v_rat := coalesce(public.qa_col_existe('empresa_cadastro', 'fap_%'),
                    public.qa_col_existe('ferias_config', 'encargo_%'));
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%patronal%'
    AND (p.prosrc ILIKE '%folha_itens%' OR p.prosrc ILIKE '%folha_periodos%'
         OR p.prosrc ILIKE '%competencia%');

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO (peças espalhadas, motor ausente): os INSUMOS até existem — '
             || 'o FAP da empresa é monitorado pelo SST (empresa_cadastro.fap_atual, '
             || 'alimentado por afastamentos_fap) e as férias provisionam com '
             || 'encargo_rat_fap/terceiros parametrizados (ferias_config) — mas NENHUMA '
             || 'função calcula a contribuição patronal da COMPETÊNCIA: 20%% + RAT×FAP + '
             || 'terceiros/FPAS sobre a base da folha não são apurados em lugar nenhum '
             || '(só o INSS do empregado, no React). Sem os patronais, a DCTFWeb não tem o '
             || 'que consolidar e o custo real da folha (~26,8%%+ acima do bruto) não '
             || 'aparece em painel nenhum. Estrutura encontrada: %s. Correção: parâmetros '
             || 'patronais por empresa/estabelecimento com vigência + apuração na '
             || 'competência, reaproveitando o FAP que o SST já mantém.',
             coalesce(v_rat, 'nenhuma'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Cálculo patronal presente (funções: %s; parâmetros: %s).',
                       v_fns, coalesce(v_rat, '—'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_folha_050()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_folha_050 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_folha_051()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_reg text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o regime tributário da empresa existe e é consumido?';
  r.esperado := 'Regime (Real/Presumido/Simples/CPRB) por empresa, com vigência, decidindo os patronais';
  v_reg := coalesce(public.qa_col_existe(NULL, '%regime_tributario%'),
                    public.qa_col_existe('empresa_cadastro', '%regime%'),
                    public.qa_col_existe(NULL, '%desoneracao%'),
                    public.qa_col_existe(NULL, '%simples_nacional%'));
  v_fns := coalesce(public.qa_fns_com('%regime%tribut%'), public.qa_fns_com('%cprb%'));

  IF v_reg IS NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o regime tributário não existe no sistema — nenhuma coluna guarda '
             || 'o enquadramento (Lucro Real/Presumido, Simples Nacional, desoneração/CPRB) '
             || 'e nenhuma função o consulta. O regime decide o encargo patronal: empresa '
             || 'do Simples (maioria dos anexos) não recolhe a patronal sobre a folha; '
             || 'setor desonerado recolhe CPRB sobre a receita. Numa plataforma '
             || 'multiempresa, tratar todo mundo como Lucro Real erra o custo de quase '
             || 'todos os clientes pequenos. Encadeado ao FOLHA-050: primeiro a estrutura '
             || 'patronal, depois o regime que a module — ambos por empresa/estabelecimento '
             || 'com vigência ([RCE]/[VAL], seção 30).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Regime presente (campos: %s; funções: %s).',
                       coalesce(v_reg, '—'), coalesce(v_fns, '—'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_folha_051()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_folha_051 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_folha_060()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text; v_tipos text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o fechamento da competência gera os eventos periódicos?';
  r.esperado := 'S-1200 por vínculo, S-1210 dos pagamentos e S-1299 até o dia 15, com prazo vigiado';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%S-1299%' OR p.prosrc ILIKE '%S1299%'
         OR p.prosrc ILIKE '%S-1200%' OR p.prosrc ILIKE '%S1200%');
  SELECT pg_get_constraintdef(c.oid) INTO v_tipos
  FROM pg_constraint c
  WHERE c.conrelid = 'public.folha_alertas_prazo'::regclass
    AND c.contype = 'c' AND pg_get_constraintdef(c.oid) ILIKE '%s1200%';

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO (metade boa, metade ausente): o controle de prazos JÁ CONHECE '
             || 'os eventos (folha_alertas_prazo tem os tipos esocial_s1200/s1210 no CHECK'
             || '%s), mas a GERAÇÃO não existe: nenhuma função monta S-1200 por vínculo, '
             || 'S-1210 dos pagamentos ou o S-1299 que FECHA os periódicos — e é o '
             || 'fechamento que libera a DCTFWeb. O alerta, além disso, é semeado pela tela '
             || 'com dia 15 fixo só quando alguém abre a aba. Sem os eventos, a folha '
             || 'inteira não existe para o governo — mesmo vazio já achado no 13º '
             || '(DEC13-050) e no desligamento (DESL-091/093). Correção: geração dos três '
             || 'eventos no fechamento aprovado + fila com anti-duplicidade (série '
             || 'ADM-093/DESL-094) + dia 15 vigiado por rotina, não por visita à tela.',
             CASE WHEN v_tipos IS NOT NULL THEN '' ELSE ' — mas o CHECK não os lista mais' END);
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Geração dos periódicos presente: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_folha_060()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_folha_060 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_folha_061()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): as guias tributárias nascem conciliadas com a folha?';
  r.esperado := 'DARF consolidado pela DCTFWeb e guia do FGTS Digital, com bases batendo com a competência fechada';
  v_est := coalesce(public.qa_fns_com('%dctf%'), public.qa_fns_com('%darf%'),
                    public.qa_col_existe(NULL, '%dctf%'),
                    public.qa_fns_com('%fgts%'));

  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: DCTFWeb e FGTS Digital não existem no banco — nenhuma função ou '
             || 'coluna trata DARF, consolidação ou guia de FGTS mensal. O que há é o '
             || 'hub_guias do Hub Contábil: registro GENÉRICO digitado à mão (mesmo achado '
             || 'do DESL-057 na guia rescisória), que anota a guia mas não a GERA da folha '
             || 'fechada nem CONCILIA os valores — a diferença entre a guia paga e o '
             || 'encargo apurado fica para a fiscalização encontrar. Correção: após o '
             || 'fechamento (FOLHA-060), gerar as guias com as bases da competência, acusar '
             || 'divergência na conciliação e arquivar comprovantes vinculados. O '
             || 'CALENDÁRIO dos envios é da família HCAL — aqui é o CONTEÚDO da guia.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Estrutura de guias presente: %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_folha_061()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_folha_061 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_folha_070()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_col text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a folha complementar tem onde existir?';
  r.esperado := 'Competência complementar vinculada à original, com diferenças por vínculo e retificação do eSocial';
  v_col := coalesce(public.qa_col_existe('folha_periodos', '%complementar%'),
                    public.qa_col_existe('folha_periodos', '%tipo%'),
                    public.qa_col_existe('folha_periodos', '%origem%'));
  v_fns := coalesce(public.qa_fns_com('%complementar%'), public.qa_fns_com('%dissidio%'));

  IF v_col IS NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a folha complementar não tem onde viver — folha_periodos só tem a '
             || 'competência YYYY-MM com UNIQUE(tenant, competencia): não há tipo '
             || '(normal/complementar), não há vínculo a uma competência de origem e '
             || 'nenhuma função apura diferenças de dissídio. A unicidade, correta para a '
             || 'folha normal, IMPEDE a complementar por desenho: reajuste retroativo da '
             || 'CCT ou vira edição da competência fechada (trilha destruída) ou fica de '
             || 'fora (passivo). Terceiro módulo com o mesmo vazio (DEC13-033, DESL-105). '
             || 'Correção: tipo de período + referência à competência-mãe (a unicidade '
             || 'passa a valer por tenant+competência+tipo) + apuração das diferenças com '
             || 'S-1200 retificado/complementar.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Estrutura presente (campos: %s; funções: %s).',
                       coalesce(v_col, '—'), coalesce(v_fns, '—'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_folha_070()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_folha_070 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_folha_071()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_per uuid; v_lancou boolean := false; v_reabriu boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();

  INSERT INTO public.folha_periodos (tenant_id, competencia, status, data_fechamento)
  VALUES (v_t, '2098-02', 'fechado', CURRENT_DATE)
  ON CONFLICT (tenant_id, competencia) DO UPDATE SET status = 'fechado'
  RETURNING id INTO v_per;

  r.passo_ordem := 1;
  r.passo_acao := 'Lançar valor novo numa competência com status FECHADO';
  r.esperado := 'Bloqueado — fechado é imutável; correção só por reabertura com rito';
  BEGIN
    INSERT INTO public.folha_lancamentos
      (tenant_id, periodo_id, colaborador_id, colaborador_nome,
       rubrica_descricao, tipo, valor, origem)
    VALUES (v_t, v_per, 'qa-folha-071', 'QA Fechado Editado',
            'Lançamento pós-fechamento', 'PROVENTO', 1234.56, 'manual');
    v_lancou := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_lancou := false; END;

  r.passo_ordem := 2;
  r.passo_acao := 'Reabrir a competência com um UPDATE simples de status, sem motivo nem aprovação';
  r.esperado := 'Bloqueado — reabertura exige motivo, dupla aprovação e trilha';
  BEGIN
    UPDATE public.folha_periodos SET status = 'aberto', data_fechamento = NULL
    WHERE id = v_per;
    v_reabriu := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_reabriu := false; END;

  IF v_lancou OR v_reabriu THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: o fechamento é decorativo — lançamento novo em competência '
             || 'FECHADA foi %s e a reabertura por UPDATE simples (sem motivo, sem '
             || 'aprovação, sem trilha além do fechado_por original) foi %s. O status '
             || 'existe e o ciclo existe, mas nenhum gatilho os DEFENDE: holerite entregue, '
             || 'evento transmitido e banco podem contar três histórias. Correção: gatilho '
             || 'que rejeite INSERT/UPDATE/DELETE em lançamentos e itens de competência '
             || 'fechada + fluxo de reabertura com motivo e dupla aprovação registrados '
             || '(disciplina de FERIAS-054, DEC13-070 e DESL-106 — quarto módulo).',
             CASE WHEN v_lancou THEN 'ACEITO' ELSE 'recusado' END,
             CASE WHEN v_reabriu THEN 'ACEITA' ELSE 'recusada' END);
  ELSE
    r.situacao := 'passou';
    r.obtido := 'Competência fechada imutável e reabertura direta bloqueada.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_folha_071()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_folha_071 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_folha_080()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_ponte text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): os eventos dos módulos chegam conciliados à folha?';
  r.esperado := 'Importação com origem rastreável (Ponto, Férias, 13º, Afastamentos) e divergência acusada';
  v_ponte := CASE WHEN to_regclass('public.ponto_exportacoes_folha') IS NOT NULL
                  THEN 'ponto_exportacoes_folha' END;
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%ponto_exportacoes_folha%'
         OR (p.prosrc ILIKE '%folha_lancamentos%' AND p.prosrc ILIKE '%concilia%'));

  IF v_ponte IS NOT NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a ponte existe SÓ do lado do Ponto — ponto_exportacoes_folha '
             || 'guarda a apuração exportada, mas nenhuma função a importa para '
             || 'folha_lancamentos nem concilia o apurado com o lançado; Férias, 13º e '
             || 'Afastamentos nem ponte têm. Na prática o DP redigita na folha o que o '
             || 'Ponto apurou — e a hora extra que ficar de fora não é acusada por '
             || 'ninguém: o holerite sai menor e ninguém sabe. A origem "manual" domina '
             || 'folha_lancamentos. Correção: importação por competência com origem '
             || 'rastreável (modulo + referência) + conciliação apurado × lançado '
             || 'acusando diferença ANTES do fechamento (alerta da seção 14).';
  ELSIF v_ponte IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A tabela ponto_exportacoes_folha não existe mais nesta base.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Conciliação presente: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_folha_080()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_folha_080 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_folha_081()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_hist text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a competência é comparada com o histórico antes de fechar?';
  r.esperado := 'Variação atípica (custo, rubrica, vínculo) destacada na conferência do fechamento';
  v_hist := CASE WHEN to_regclass('public.folha_historico') IS NOT NULL
                 THEN 'folha_historico' END;
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%folha_historico%' OR p.prosrc ILIKE '%variacao%'
         OR p.prosrc ILIKE '%atipic%');

  IF v_hist IS NOT NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a matéria-prima existe (folha_historico guarda as competências) e '
             || 'ninguém a compara — nenhuma função confronta a competência atual com o '
             || 'histórico para destacar salto de custo, rubrica que dobrou ou líquido fora '
             || 'do padrão. É [BPR], não obrigação legal — mas é a diferença entre pegar o '
             || 'zero a mais NA CONFERÊNCIA e pegá-lo na reabertura com retificação de '
             || 'eSocial e complementar (a "folha sem surpresa" da seção 29). Correção: '
             || 'conferência de fechamento com comparativo por rubrica/vínculo e limiar '
             || 'parametrizável de variação.';
  ELSIF v_hist IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A tabela folha_historico não existe mais nesta base.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Comparativo presente: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_folha_081()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_folha_081 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_folha_090()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_leitura_aberta int; v_restr int;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): quem consegue LER os itens da folha?';
  r.esperado := 'Leitura restrita aos papéis da folha; colaborador só o próprio holerite; camada de perfil presente';
  SELECT count(*) INTO v_leitura_aberta
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'folha_itens'
    AND cmd IN ('SELECT','ALL') AND permissive = 'PERMISSIVE'
    AND qual NOT ILIKE '%has_minimum_role%' AND qual NOT ILIKE '%auth.uid%';
  SELECT count(*) INTO v_restr
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'folha_itens'
    AND permissive = 'RESTRICTIVE';

  IF v_leitura_aberta > 0 AND v_restr = 0 THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a ESCRITA da folha é bem defendida (manager+ para gerenciar — '
             || 'melhor que o 13º e a rescisão), mas a LEITURA está aberta: a política '
             || '"Usuários podem ver itens do tenant" entrega folha_itens INTEIRA — '
             || 'salário, descontos e líquido de todos — a QUALQUER usuário autenticado da '
             || 'empresa, colaborador comum incluído. É exatamente o cenário "colaborador '
             || 'tenta ver a folha da equipe" que a seção 25 manda bloquear, e a tabela '
             || 'está fora da camada perfil_restringe_leitura_*. Correção: leitura por '
             || 'papel (manager+) OU restrita ao próprio registro (colaborador vê só o '
             || 'seu item/holerite) + política RESTRICTIVE via perfil_permite_modulo — '
             || 'fechando a série DEC13-071/DESL-110 no módulo mais denso de remuneração.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Leitura defendida (políticas abertas: %s; restritivas: %s).',
                       v_leitura_aberta, v_restr);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_folha_090()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_folha_090 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_porte_005()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_emp uuid; v_outra uuid; v_conta int; v_nulo_permitido boolean;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Cadastrar duas empresas e povoar admissoes em varios estados';
  INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, ativo)
  VALUES (v_t, '[QA-PORTE-005] Empresa Alvo', '11555666000331', true) RETURNING id INTO v_emp;
  INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, ativo)
  VALUES (v_t, '[QA-PORTE-005] Outra Empresa', '11555666000332', true) RETURNING id INTO v_outra;

  INSERT INTO public.admissoes
    (tenant_id, empresa_id, nome_completo, cpf, email, cargo, status, inativo)
  VALUES
    (v_t, v_emp,   '[QA-PORTE-005] Conta 1',   public.qa_cpf(50001), 'p1@sandbox.invalid', 'Operador', 'concluido', false),
    (v_t, v_emp,   '[QA-PORTE-005] Conta 2',   public.qa_cpf(50002), 'p2@sandbox.invalid', 'Operador', 'concluido', false),
    (v_t, v_emp,   '[QA-PORTE-005] Inativa',   public.qa_cpf(50003), 'p3@sandbox.invalid', 'Operador', 'concluido', true),
    (v_t, v_emp,   '[QA-PORTE-005] Em Curso',  public.qa_cpf(50004), 'p4@sandbox.invalid', 'Operador', 'em_analise', false),
    (v_t, v_outra, '[QA-PORTE-005] Vizinha',   public.qa_cpf(50005), 'p5@sandbox.invalid', 'Operador', 'concluido', false);

  r.passo_ordem := 2;
  r.passo_acao  := 'Contar com o mesmo criterio do usePorteEmpresa';
  r.esperado    := 'Exatamente 2 — so concluidas, nao inativas, da propria empresa';
  SELECT count(*) INTO v_conta FROM public.admissoes
  WHERE tenant_id = v_t AND empresa_id = v_emp
    AND status = 'concluido'
    AND (inativo IS NULL OR inativo = false);

  IF v_conta <> 2 THEN
    r.situacao := 'falhou';
    r.obtido   := format('Esperava 2 e contei %s. Inativa, em andamento ou de outra '
               || 'empresa entrou na conta — o porte sai errado e o Plano de Acao do '
               || 'PGR dimensiona estrutura errada.', v_conta);
    RETURN r;
  END IF;

  r.passo_ordem := 3;
  r.passo_acao  := 'Conferir se inativo pode ser NULL no banco';
  r.esperado    := 'A coluna e NOT NULL — o ramo NULL do front e defensivo, nao real';
  SELECT NOT a.attnotnull INTO v_nulo_permitido
  FROM pg_attribute a
  WHERE a.attrelid = 'public.admissoes'::regclass AND a.attname = 'inativo';

  IF v_nulo_permitido THEN
    r.situacao := 'falhou';
    r.obtido   := 'A coluna admissoes.inativo ACEITA NULL. O filtro do front trata NULL '
               || 'como ativo, entao a contagem so esta correta por causa desse ramo — '
               || 'ele passou a ser carga estrutural. Quem simplificar para inativo = '
               || 'false exclui todo registro com NULL e derruba o porte da empresa uma '
               || 'categoria inteira, em silencio.';
  ELSE
    r.situacao := 'passou';
    r.obtido   := 'Contagem correta (2). ACHADO: admissoes.inativo e NOT NULL DEFAULT '
               || 'false, entao o ramo "inativo IS NULL" do usePorteEmpresa protege um '
               || 'estado que o banco ja impede. E codigo defensivo inofensivo hoje, '
               || 'mas o comentario no hook ("pode ser null em registros antigos") '
               || 'descreve uma realidade que nao existe — vale corrigir o comentario '
               || 'ou remover o ramo, para nao induzir a proxima leitura ao erro.';
    r.detalhe  := jsonb_build_object('contagem', v_conta, 'inativo_aceita_null', false);
  END IF;

  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_porte_005()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_porte_005 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_regra_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_emp uuid;
        v_exig int; v_atual int; v_deficit int; v_tem_obrig boolean;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Cadastrar empresa com 350 empregados e cota exigida de 11 PcDs';
  r.esperado:='Com deficit, deve existir a obrigacao "Plano de adequacao da cota PCD"';
  INSERT INTO public.empresa_cadastro
    (tenant_id, razao_social, cnpj, total_colaboradores,
     pcd_obrigatoria, pcd_percentual_exigido, pcd_quantidade_exigida, pcd_quantidade_atual)
  VALUES (v_t, '[QA] Empresa Em Deficit PcD', '11555666000181', 350, true, 3, 11, 4)
  RETURNING id INTO v_emp;

  r.passo_ordem:=2; r.passo_acao:='Conferir o deficit';
  SELECT pcd_quantidade_exigida, pcd_quantidade_atual INTO v_exig, v_atual
    FROM public.empresa_cadastro WHERE id=v_emp;
  v_deficit := v_exig - v_atual;

  r.passo_ordem:=3; r.passo_acao:='Verificar se a obrigacao de adequacao da cota foi registrada';
  v_tem_obrig := public.qa_obrigacao_existe(v_emp, 'pcd');

  IF v_tem_obrig THEN
    r.situacao:='passou';
    r.obtido:=format('Deficit de %s PcDs (exige %s, tem %s) e a obrigacao de adequacao esta registrada.',
                     v_deficit, v_exig, v_atual);
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('Empresa em deficit de %s PcDs (exige %s, tem %s) e NAO ha obrigacao de adequacao registrada. A regra existe em OBRIGACOES_TEMPLATES mas so vira registro quando alguem clica em "Gerar Obrigacoes" na aba. Sem o clique, a irregularidade nao entra no painel de conformidade.',
                     v_deficit, v_exig, v_atual);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_regra_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_regra_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_regra_002()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_emp uuid; v_tem boolean;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Cadastrar empresa com CIPA obrigatoria e nao constituida';
  r.esperado:='Deve existir a obrigacao "Constituir CIPA" (NR-05)';
  INSERT INTO public.empresa_cadastro
    (tenant_id, razao_social, cnpj, cipa_obrigatoria, cipa_situacao)
  VALUES (v_t, '[QA] Empresa Sem CIPA', '11555666000262', true, 'nao_constituida')
  RETURNING id INTO v_emp;

  r.passo_ordem:=2; r.passo_acao:='Verificar se a obrigacao de constituir CIPA foi registrada';
  v_tem := public.qa_obrigacao_existe(v_emp, 'cipa');

  IF v_tem THEN
    r.situacao:='passou'; r.obtido:='CIPA obrigatoria e nao constituida: obrigacao registrada.';
  ELSE
    r.situacao:='falhou';
    r.obtido:='Empresa obrigada a ter CIPA, situacao nao_constituida, e NAO ha obrigacao registrada. Infracao a NR-05 sem entrada no painel de conformidade — depende do clique em "Gerar Obrigacoes".';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_regra_002()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_regra_002 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_regra_003()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_emp uuid; v_tem boolean;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Cadastrar empresa com SESMT obrigatorio e inexistente';
  r.esperado:='Deve existir a obrigacao "Contratar/Adequar SESMT", criticidade critica';
  INSERT INTO public.empresa_cadastro
    (tenant_id, razao_social, cnpj, sesmt_obrigatorio, sesmt_situacao)
  VALUES (v_t, '[QA] Empresa Sem SESMT', '11555666000343', true, 'inexistente')
  RETURNING id INTO v_emp;

  r.passo_ordem:=2; r.passo_acao:='Verificar se a obrigacao de contratar SESMT foi registrada';
  v_tem := public.qa_obrigacao_existe(v_emp, 'sesmt');

  IF v_tem THEN
    r.situacao:='passou'; r.obtido:='SESMT obrigatorio e inexistente: obrigacao critica registrada.';
  ELSE
    r.situacao:='falhou';
    r.obtido:='Empresa obrigada a ter SESMT, situacao inexistente, e NAO ha obrigacao registrada. E a obrigacao de maior criticidade entre os templates — a pendencia mais grave do cadastro fica fora do painel.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_regra_003()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_regra_003 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_regra_004()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_emp uuid;
        v_fap numeric; v_tem boolean;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Cadastrar empresa com FAP 1,8000 (acima do limite de 1,5)';
  r.esperado:='Deve existir a obrigacao "Plano de reducao do FAP"';
  INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, fap_atual)
  VALUES (v_t, '[QA] Empresa FAP Alto', '11555666000424', 1.8000) RETURNING id INTO v_emp;
  SELECT fap_atual INTO v_fap FROM public.empresa_cadastro WHERE id=v_emp;

  r.passo_ordem:=2; r.passo_acao:='Verificar se a obrigacao de reducao do FAP foi registrada';
  v_tem := public.qa_obrigacao_existe(v_emp, 'fap');

  IF v_tem THEN
    r.situacao:='passou'; r.obtido:=format('FAP %s acima de 1,5: obrigacao de reducao registrada.', v_fap);
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('FAP em %s (acima de 1,5) e NAO ha obrigacao de reducao registrada. A empresa recolhe %s%% a mais de RAT sem plano de reversao.',
                     v_fap, round((v_fap - 1) * 100));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_regra_004()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_regra_004 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_regra_005()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_emp uuid; v_tem boolean;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Cadastrar empresa que declara possuir TAC';
  r.esperado:='Deve existir a obrigacao "Cumprir obrigacoes do TAC", criticidade critica';
  INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, tac_possui)
  VALUES (v_t, '[QA] Empresa Com TAC', '11555666000505', true) RETURNING id INTO v_emp;

  r.passo_ordem:=2; r.passo_acao:='Verificar se a obrigacao de cumprir o TAC foi registrada';
  v_tem := public.qa_obrigacao_existe(v_emp, 'tac');

  IF v_tem THEN
    r.situacao:='passou'; r.obtido:='TAC declarado: obrigacao de cumprimento registrada.';
  ELSE
    r.situacao:='falhou';
    r.obtido:='Empresa declarou possuir TAC e NAO ha obrigacao de cumprimento registrada. O TAC e compromisso com o MPT, com multa por clausula descumprida — o maior risco financeiro do painel fica sem acompanhamento.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_regra_005()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_regra_005 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_regra_006()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_emp uuid;
        v_grau int; v_tem boolean;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Cadastrar empresa com grau de risco 4 (o mais alto da NR-04)';
  r.esperado:='Deve existir a obrigacao "Avaliar impacto do grau de risco elevado"';
  INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, grau_risco)
  VALUES (v_t, '[QA] Empresa Grau 4', '11555666000686', 4) RETURNING id INTO v_emp;
  SELECT grau_risco INTO v_grau FROM public.empresa_cadastro WHERE id=v_emp;

  r.passo_ordem:=2; r.passo_acao:='Verificar se a obrigacao de avaliacao foi registrada';
  v_tem := public.qa_obrigacao_existe(v_emp, 'grau_risco');

  IF v_tem THEN
    r.situacao:='passou'; r.obtido:=format('Grau de risco %s: obrigacao de avaliacao registrada.', v_grau);
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('Grau de risco %s (elevado) e NAO ha obrigacao de avaliacao registrada. O grau elevado puxa exigencias adicionais que ficam sem acompanhamento.', v_grau);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_regra_006()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_regra_006 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_regra_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_emp uuid; v_tem boolean;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Cadastrar empresa que CUMPRE a cota (350 empregados, 11 exigidos, 11 atuais)';
  r.esperado:='NAO deve haver obrigacao de adequacao — a empresa esta em dia';
  INSERT INTO public.empresa_cadastro
    (tenant_id, razao_social, cnpj, total_colaboradores,
     pcd_obrigatoria, pcd_percentual_exigido, pcd_quantidade_exigida, pcd_quantidade_atual)
  VALUES (v_t, '[QA] Empresa Cota Cumprida', '11555666000767', 350, true, 3, 11, 11)
  RETURNING id INTO v_emp;

  r.passo_ordem:=2; r.passo_acao:='Verificar que NAO ha obrigacao de adequacao';
  v_tem := public.qa_obrigacao_existe(v_emp, 'pcd');

  IF NOT v_tem THEN
    r.situacao:='passou';
    r.obtido:='Empresa em dia (11 exigidos, 11 atuais) e nenhuma obrigacao de adequacao registrada, como deve ser.';
  ELSE
    r.situacao:='falhou';
    r.obtido:='Ha obrigacao de adequacao para empresa SEM deficit. A regra estaria imprecisa, poluindo o painel com pendencia falsa.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_regra_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_regra_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_regra_011()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_emp uuid; v_tem boolean;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Cadastrar empresa com CIPA obrigatoria e ATIVA';
  r.esperado:='NAO deve haver obrigacao de constituir CIPA';
  INSERT INTO public.empresa_cadastro
    (tenant_id, razao_social, cnpj, cipa_obrigatoria, cipa_situacao)
  VALUES (v_t, '[QA] Empresa CIPA Ativa', '11555666000848', true, 'ativa') RETURNING id INTO v_emp;

  r.passo_ordem:=2; r.passo_acao:='Verificar que NAO ha obrigacao de constituir';
  v_tem := public.qa_obrigacao_existe(v_emp, 'cipa');

  IF NOT v_tem THEN
    r.situacao:='passou';
    r.obtido:='CIPA ativa e nenhuma obrigacao de constituir registrada, como deve ser.';
  ELSE
    r.situacao:='falhou';
    r.obtido:='Ha obrigacao de constituir CIPA para empresa que ja a tem ativa — pendencia falsa no painel.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_regra_011()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_regra_011 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_tac_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_emp uuid; v_lido jsonb;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_emp := public.qa_nova_empresa('[QA-TAC] Empresa com TAC', '11222333007606');

  r.passo_ordem := 1;
  r.passo_acao := 'Gravar um TAC com órgão, número, vigência e condicionantes';
  r.esperado := 'Item gravado por inteiro em tac_detalhes';
  UPDATE public.empresa_cadastro
  SET tac_detalhes = jsonb_build_array(jsonb_build_object(
        'orgao', 'MPT',
        'numero', 'TAC-2026/001',
        'vigencia_inicio', '2026-01-01',
        'vigencia_fim', '2027-12-31',
        'condicionantes', 'Adequação ergonômica do setor de expedição',
        'arquivado', false))
  WHERE id = v_emp;

  r.passo_ordem := 2; r.passo_acao := 'Reler o cadastro';
  r.esperado := 'O TAC volta como foi gravado';
  SELECT tac_detalhes INTO v_lido FROM public.empresa_cadastro WHERE id = v_emp;
  IF jsonb_typeof(v_lido) = 'array'
     AND jsonb_array_length(v_lido) = 1
     AND v_lido->0->>'numero' = 'TAC-2026/001'
     AND v_lido->0->>'orgao' = 'MPT'
     AND v_lido->0->>'condicionantes' IS NOT NULL THEN
    r.situacao := 'passou'; r.obtido := 'TAC gravado e relido por inteiro.';
  ELSE
    r.situacao := 'falhou'; r.obtido := format('tac_detalhes voltou: %s', left(v_lido::text, 120));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_tac_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_tac_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_tac_003()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_emp uuid; v_lido jsonb;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_emp := public.qa_nova_empresa('[QA-TAC] Vigencia Invertida', '11222333007707');

  r.passo_ordem := 1;
  r.passo_acao := 'Gravar TAC com vigência fim (2026-01-01) anterior ao início (2026-12-31)';
  r.esperado := 'Idealmente recusado — vigência incoerente não é TAC válido';
  BEGIN
    UPDATE public.empresa_cadastro
    SET tac_detalhes = jsonb_build_array(jsonb_build_object(
          'orgao', 'MPT',
          'numero', 'TAC-2026/999',
          'vigencia_inicio', '2026-12-31',
          'vigencia_fim', '2026-01-01',
          'arquivado', false))
    WHERE id = v_emp;

    SELECT tac_detalhes INTO v_lido FROM public.empresa_cadastro WHERE id = v_emp;
    IF v_lido->0->>'vigencia_fim' < v_lido->0->>'vigencia_inicio' THEN
      r.situacao := 'falhou';
      r.obtido := 'O BANCO ACEITOU TAC com fim de vigência anterior ao início. '
        'tac_detalhes é JSONB livre, sem validação em nenhuma camada — mesma '
        'incoerência que ENQ-013 aponta no mandato da CIPA. Dado com regra própria '
        'merece estrutura, não JSON livre.';
    ELSE
      r.situacao := 'passou';
      r.obtido := 'Vigência invertida não persistiu.';
    END IF;
  EXCEPTION WHEN check_violation THEN
    r.situacao := 'passou'; r.obtido := 'Recusado: vigência do TAC precisa ser coerente.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_tac_003()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_tac_003 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;


-- (2) CASOS DOCUMENTADOS — 54 casos.

-- Empresa (2 de 2) (27 casos)

INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
SELECT m.id, d.codigo::text, d.titulo::text, d.tipo::text::qa_caso_tipo, d.prioridade::text::qa_prioridade, d.status::text::qa_caso_status, d.objetivo::text, d.pre_condicoes::text, d.passos::text::jsonb, d.resultado_esperado::text, d.observacoes::text, d.nivel::text, d.base_legal::text, d.disposicao::text, d.disposicao_motivo::text
FROM (VALUES
    ('PORTE-001', 'Classificacao de porte em comercio e servicos', 'feliz', 'alta', 'aprovado', 'Cortes IBGE/SEBRAE por pessoal ocupado. Pequena e Media sao agrupadas na Categoria B, como fazem os modelos de referencia.', 'Empresa com CNAE de comercio ou servicos.', '[{"acao": "9 colaboradores", "ordem": 1, "resultado_esperado": "Categoria A — MEI e Microempresa"}, {"acao": "10 colaboradores", "ordem": 2, "resultado_esperado": "Categoria B — Pequeno e Medio Porte"}, {"acao": "99 colaboradores", "ordem": 3, "resultado_esperado": "Continua Categoria B"}, {"acao": "100 colaboradores", "ordem": 4, "resultado_esperado": "Categoria C — Grande Porte"}]', 'As tres categorias e suas fronteiras respeitam o criterio IBGE/SEBRAE.', 'Familia sem nenhum caso ate hoje, apesar de definir o dimensionamento do Plano de Acao do PGR. O porte decide se o plano pede comite multidisciplinar ou acao simples de baixo custo.', 'e2e', NULL, 'em_triagem', NULL),
    ('PORTE-002', 'Industria e construcao usam cortes proprios', 'alternativo', 'alta', 'aprovado', 'O mesmo headcount classifica diferente conforme o setor. Uma industria com 80 pessoas e Categoria B; um comercio com 80 tambem, mas por pouco — e com 100 os dois divergem.', 'Empresa com CNAE industrial ou de construcao.', '[{"acao": "19 colaboradores", "ordem": 1, "resultado_esperado": "Categoria A"}, {"acao": "20 colaboradores", "ordem": 2, "resultado_esperado": "Categoria B"}, {"acao": "499 colaboradores", "ordem": 3, "resultado_esperado": "Continua Categoria B"}, {"acao": "500 colaboradores", "ordem": 4, "resultado_esperado": "Categoria C"}, {"acao": "Mesmo headcount de 100 em ambos os setores", "ordem": 5, "resultado_esperado": "Comercio = Categoria C; industria = Categoria B"}]', 'Os cortes acompanham o setor, nao so o numero.', 'O passo 5 e o coracao do caso: prova que a classificacao nao pode ser feita so pelo headcount, erro provavel em qualquer reimplementacao.', 'e2e', NULL, 'em_triagem', NULL),
    ('PORTE-003', 'Setor derivado da divisao do CNAE', 'alternativo', 'media', 'aprovado', 'setorPorCnae le os dois primeiros digitos do CNAE 2.0. Divisoes 05-09 (extrativas), 10-33 (transformacao) e 41-43 (construcao) sao industria; o resto e comercio e servicos.', 'Nenhuma.', '[{"acao": "CNAE iniciado em 41 (construcao)", "ordem": 1, "resultado_esperado": "Industria e construcao"}, {"acao": "CNAE iniciado em 10 (alimentos)", "ordem": 2, "resultado_esperado": "Industria e construcao"}, {"acao": "CNAE iniciado em 47 (comercio varejista)", "ordem": 3, "resultado_esperado": "Comercio e servicos"}, {"acao": "CNAE iniciado em 34 (fora das faixas industriais)", "ordem": 4, "resultado_esperado": "Comercio e servicos"}, {"acao": "CNAE com pontuacao (41.20-4/00)", "ordem": 5, "resultado_esperado": "Mesma classificacao — a pontuacao e removida antes da leitura"}]', 'A divisao do CNAE determina o setor, com ou sem formatacao.', 'O passo 4 cobre a borda entre 33 e 41, faixa que NAO e industrial e passaria despercebida numa reimplementacao por intervalo unico.', 'e2e', NULL, 'em_triagem', NULL),
    ('PORTE-004', 'Sem CNAE, o sistema adota o corte mais conservador', 'excecao', 'media', 'aprovado', 'Empresa sem CNAE cai em comercio e servicos, que tem cortes mais baixos. O porte tende a subir, e um plano mais robusto que o necessario e erro menos grave que o contrario.', 'Empresa sem CNAE principal.', '[{"acao": "Classificar empresa sem CNAE, 50 colaboradores", "ordem": 1, "resultado_esperado": "Comercio e servicos — Categoria B"}, {"acao": "CNAE com menos de dois digitos", "ordem": 2, "resultado_esperado": "Mesmo tratamento do vazio"}, {"acao": "Comparar com a classificacao industrial do mesmo headcount", "ordem": 3, "resultado_esperado": "O default nunca produz porte MENOR que o setor real"}]', 'A ausencia de CNAE erra para o lado seguro, de forma deliberada.', 'Decisao de projeto documentada no codigo e agora tambem em caso: nao e fallback acidental. O passo 3 protege a intencao — quem trocar o default por industria inverte o sentido do erro.', 'e2e', NULL, 'em_triagem', NULL),
    ('PORTE-005', 'Contagem de porte usa admissoes concluidas e nao inativas', 'alternativo', 'critica', 'aprovado', 'O porte e o unico ponto do modulo que conta gente de verdade, em vez de ler o campo digitado. A regra de quem entra na conta precisa estar registrada.', 'Empresa com admissoes em varios status.', '[{"acao": "Admissao com status concluido e inativo = false", "ordem": 1, "resultado_esperado": "Conta"}, {"acao": "Admissao com status concluido e inativo = NULL", "ordem": 2, "resultado_esperado": "CONTA — registro antigo sem o campo e tratado como ativo"}, {"acao": "Admissao com status concluido e inativo = true", "ordem": 3, "resultado_esperado": "Nao conta"}, {"acao": "Admissao em andamento", "ordem": 4, "resultado_esperado": "Nao conta — so concluida entra"}, {"acao": "Admissao de outra empresa do mesmo tenant", "ordem": 5, "resultado_esperado": "Nao conta — a unidade e o CNPJ, nao o grupo"}]', 'A contagem e por CNPJ, so concluidas, e nulo em inativo conta como ativo.', 'CRITICO e sutil: o passo 2 e a regra mais facil de quebrar. Trocar o filtro por inativo = false silenciosamente exclui todo registro antigo e derruba o porte da empresa uma categoria inteira. O passo 5 registra que a unidade e o CNPJ, coerente com a emissao do plano.', 'api', NULL, 'em_triagem', NULL),
    ('RASC-001', 'Rascunho é restaurado ao voltar sem ter salvo', 'feliz', 'media', 'aprovado', 'O formulário guarda rascunho no localStorage (com flush no beforeunload) e o restaura na volta. É a defesa contra perder meia hora de preenchimento num F5 — o cadastro tem 8 abas e 64 colunas.', 'Usuário autenticado, formulário de empresa aberto.', '[{"acao": "Preencher campos em mais de uma aba sem salvar e recarregar a página", "ordem": 1, "resultado_esperado": "Ao reabrir, os valores digitados estão lá e o aviso de rascunho restaurado aparece"}, {"acao": "Salvar de fato", "ordem": 2, "resultado_esperado": "Rascunho é limpo; recarregar mostra o dado do banco, sem aviso"}]', 'Nada digitado se perde antes do salvamento; salvar encerra o rascunho.', NULL, 'e2e', NULL, 'em_triagem', NULL),
    ('RASC-002', 'Descartar rascunho volta ao que está no banco', 'alternativo', 'media', 'aprovado', 'O botão de descarte joga o rascunho fora e recarrega os dados salvos. Sem ele, um rascunho ruim ficaria assombrando o formulário para sempre — restaurado a cada visita.', 'Empresa salva no banco; rascunho local com alterações por cima.', '[{"acao": "Descartar o rascunho", "ordem": 1, "onde_na_tela": "Aviso de rascunho restaurado > descartar", "resultado_esperado": "Formulário volta exatamente ao que está no banco"}, {"acao": "Recarregar a página", "ordem": 2, "resultado_esperado": "O rascunho descartado não volta"}]', 'Descartar é definitivo e restaura o estado do banco.', NULL, 'e2e', NULL, 'em_triagem', NULL),
    ('RASC-003', 'Rascunho é isolado por usuário e por empresa', 'negativo', 'alta', 'aprovado', 'A chave do rascunho é usuario:empresa. Sem esse isolamento, o rascunho da empresa A contaminaria o formulário da empresa B — e, em máquina compartilhada, o rascunho de um usuário apareceria para outro, com dados que ele talvez nem pudesse ver.', 'Duas empresas cadastradas; rascunho pendente na empresa A.', '[{"acao": "Abrir a empresa B para edição", "ordem": 1, "resultado_esperado": "Formulário limpo, sem nenhum valor do rascunho da empresa A"}, {"acao": "Entrar com outro usuário na mesma máquina e abrir a empresa A", "ordem": 2, "resultado_esperado": "Sem rascunho — a chave é do usuário original"}]', 'Rascunho de uma empresa ou de um usuário nunca aparece em outro contexto.', NULL, 'e2e', NULL, 'em_triagem', NULL),
    ('RASC-004', 'Novo cadastro não herda rascunho de tentativa anterior', 'excecao', 'media', 'aprovado', 'O rascunho de nova empresa usa a chave especial new. Ao clicar Nova Empresa a tela limpa essa chave de propósito: sem isso, um cadastro abandonado semanas atrás ressuscitaria dentro do próximo, misturando dados de empresas diferentes.', 'Rascunho de um cadastro novo abandonado (preenchido e nunca salvo).', '[{"acao": "Clicar Nova Empresa", "ordem": 1, "onde_na_tela": "Lista de empresas > Nova Empresa", "resultado_esperado": "Formulário nasce vazio — o rascunho abandonado não é restaurado"}]', 'Cada novo cadastro começa do zero.', NULL, 'e2e', NULL, 'em_triagem', NULL),
    ('REGRA-001', 'Deficit de cota PcD gera obrigacao de adequacao', 'feliz', 'critica', 'aprovado', 'Verificar a REGRA, nao o campo: quando a empresa tem cota PcD obrigatoria e esta em deficit (tem menos PcDs do que a lei exige), o sistema deve registrar a obrigacao "Plano de adequacao da cota PCD". Regra em OBRIGACOES_TEMPLATES: pcd_obrigatoria E quantidade_atual menor que quantidade_exigida. Base legal: Lei 8.213/91 art. 93. Importa porque uma empresa em deficit esta irregular perante a lei — e a obrigacao registrada e o que transforma isso em plano de contratacao com prazo e responsavel.', 'Precisa existir uma empresa com cota PcD obrigatoria e deficit.', '[{"acao": "Cadastrar empresa com 350 empregados", "dados": "Total: 350 (faixa de 3%, cota exigida 11)", "ordem": 1, "onde_na_tela": "Empresas > Obrigacoes de Inclusao", "resultado_esperado": "Cota calculada: 11 PcDs exigidos"}, {"acao": "Informar que a empresa tem apenas 4 PcDs", "dados": "PcDs atuais: 4 (deficit de 7)", "ordem": 2, "onde_na_tela": "Campo Quantidade Atual de PcD", "resultado_esperado": "A tela sinaliza situacao irregular com deficit de 7"}, {"acao": "Conferir a aba de obrigacoes", "dados": "-", "ordem": 3, "onde_na_tela": "Empresas > aba Obrigacoes", "resultado_esperado": "Deveria haver a obrigacao \"Plano de adequacao da cota PCD\", categoria legal, subcategoria pcd, criticidade alta, base legal Lei 8.213/91 art. 93"}]', 'A obrigacao de adequacao da cota deveria estar registrada. RESULTADO REAL: nao existe. A regra e avaliada no front e a obrigacao so e criada quando alguem clica no botao "Gerar Obrigacoes" na aba. Sem esse clique, a empresa fica em deficit sem nenhum registro de conformidade.', 'IMPACTO: o deficit de PcD e a irregularidade mais fiscalizada da Lei de Cotas, com multa por vaga nao preenchida. Se a obrigacao nao e registrada, ela nao aparece no painel de conformidade, nao gera acao no plano e ninguem e responsabilizado por resolver — a empresa descobre em fiscalizacao. DECISAO DE PRODUTO: a geracao por clique da controle a quem cadastra, o que e legitimo. As opcoes sao (a) gerar automaticamente por trigger quando a condicao se torna verdadeira, (b) manter o clique mas destacar na tela quantas obrigacoes detectadas ainda nao foram registradas, ou (c) uma rotina periodica que sincronize. Hoje o botao existe e mostra a contagem, mas nada impede que ninguem clique.', 'api', NULL, 'em_triagem', NULL),
    ('REGRA-002', 'CIPA obrigatoria e nao constituida gera obrigacao', 'feliz', 'alta', 'aprovado', 'Verificar a REGRA: quando a empresa e obrigada a ter CIPA e a situacao e "nao constituida", o sistema deve registrar a obrigacao "Constituir CIPA". Regra em OBRIGACOES_TEMPLATES: cipa_obrigatoria E cipa_situacao = nao_constituida. Base legal: NR-05. Importa porque a ausencia de CIPA em empresa obrigada e infracao autuavel, e o registro da obrigacao e o que coloca isso na fila de resolucao.', 'Precisa existir uma empresa com CIPA obrigatoria e nao constituida.', '[{"acao": "Marcar a CIPA como obrigatoria para a empresa", "dados": "CIPA obrigatoria: sim", "ordem": 1, "onde_na_tela": "Empresas > Enquadramento Legal > CIPA", "resultado_esperado": "Marcado"}, {"acao": "Informar a situacao como nao constituida", "dados": "Situacao: nao_constituida", "ordem": 2, "onde_na_tela": "Campo Situacao CIPA", "resultado_esperado": "Situacao gravada"}, {"acao": "Conferir a aba de obrigacoes", "dados": "-", "ordem": 3, "onde_na_tela": "Empresas > aba Obrigacoes", "resultado_esperado": "Deveria haver a obrigacao \"Constituir CIPA\", categoria sst, subcategoria cipa, criticidade alta, base legal NR-05"}]', 'A obrigacao de constituir CIPA deveria estar registrada. RESULTADO REAL: nao existe sem o clique em "Gerar Obrigacoes".', 'IMPACTO: empresa obrigada a ter CIPA sem CIPA constituida e infracao a NR-05, autuavel em fiscalizacao. Sem a obrigacao registrada, nao ha prazo, responsavel nem acompanhamento — a pendencia existe no cadastro mas nao no painel de conformidade. Mesma decisao de produto do REGRA-001.', 'api', NULL, 'em_triagem', NULL),
    ('REGRA-003', 'SESMT obrigatorio e inexistente gera obrigacao critica', 'feliz', 'critica', 'aprovado', 'Verificar a REGRA: quando o SESMT e obrigatorio e a situacao e "inexistente", o sistema deve registrar a obrigacao "Contratar/Adequar SESMT" com criticidade CRITICA — a mais alta entre todos os templates. Regra: sesmt_obrigatorio E sesmt_situacao = inexistente. Base legal: NR-04. Importa porque o SESMT e o servico especializado que responde pela seguranca do trabalho; sua ausencia em empresa obrigada e das infracoes mais graves.', 'Precisa existir uma empresa com SESMT obrigatorio e inexistente.', '[{"acao": "Marcar o SESMT como obrigatorio", "dados": "SESMT obrigatorio: sim", "ordem": 1, "onde_na_tela": "Empresas > Enquadramento Legal > SESMT", "resultado_esperado": "Marcado"}, {"acao": "Informar a situacao como inexistente", "dados": "Situacao: inexistente", "ordem": 2, "onde_na_tela": "Campo Situacao SESMT", "resultado_esperado": "Situacao gravada"}, {"acao": "Conferir a aba de obrigacoes", "dados": "-", "ordem": 3, "onde_na_tela": "Empresas > aba Obrigacoes", "resultado_esperado": "Deveria haver \"Contratar/Adequar SESMT\", criticidade critica, base legal NR-04"}]', 'A obrigacao de contratar SESMT deveria estar registrada, com criticidade critica. RESULTADO REAL: nao existe sem o clique.', 'IMPACTO: esta e a obrigacao de maior criticidade entre os templates — o SESMT responde pela seguranca do trabalho na empresa. Sua ausencia nao registrada significa que a pendencia mais grave do cadastro nao aparece em nenhum painel. NOTA: o caso ENQ-012 ja verificava que essa combinacao e ACEITA no cadastro (e deve ser, pois a empresa pode estar irregular). Este caso verifica o passo seguinte: a irregularidade vira obrigacao registrada?', 'api', NULL, 'em_triagem', NULL),
    ('REGRA-004', 'FAP acima de 1,5 gera obrigacao de plano de reducao', 'feliz', 'media', 'aprovado', 'Verificar a REGRA: quando o FAP da empresa passa de 1,5, o sistema deve registrar a obrigacao "Plano de reducao do FAP". Regra: fap_atual maior que 1,5. Importa porque o FAP multiplica a aliquota RAT — um FAP de 1,5 significa recolher 50% a mais que a aliquota base, e ele sobe quando a empresa tem historico de acidentes. Reduzi-lo e ganho financeiro direto e sinal de melhoria em seguranca.', 'Precisa existir uma empresa com FAP acima de 1,5.', '[{"acao": "Informar o FAP da empresa", "dados": "FAP atual: 1,8000 (acima do limite de 1,5 que dispara a regra)", "ordem": 1, "onde_na_tela": "Empresas > Enquadramento Legal > FAP", "resultado_esperado": "FAP gravado"}, {"acao": "Conferir a aba de obrigacoes", "dados": "-", "ordem": 2, "onde_na_tela": "Empresas > aba Obrigacoes", "resultado_esperado": "Deveria haver \"Plano de reducao do FAP\", categoria financeira, criticidade media"}]', 'A obrigacao de reduzir o FAP deveria estar registrada. RESULTADO REAL: nao existe sem o clique.', 'IMPACTO: um FAP alto e dinheiro saindo todo mes e indicador de que a empresa tem historico acidentario acima da media do setor. Sem a obrigacao registrada, nao ha plano de reducao — a empresa continua pagando mais sem que ninguem seja responsavel por reverter.', 'api', NULL, 'em_triagem', NULL),
    ('REGRA-005', 'TAC assinado gera obrigacao de cumprimento', 'feliz', 'critica', 'aprovado', 'Verificar a REGRA: quando a empresa declara possuir TAC (Termo de Ajustamento de Conduta), o sistema deve registrar a obrigacao de cumpri-lo, com criticidade critica. Regra: tac_possui. Importa porque o TAC e um compromisso firmado com o Ministerio Publico do Trabalho — o descumprimento gera multa por clausula violada e pode virar acao civil publica.', 'Precisa existir uma empresa que declarou possuir TAC.', '[{"acao": "Marcar que a empresa possui TAC", "dados": "Possui TAC: sim", "ordem": 1, "onde_na_tela": "Empresas > Enquadramento Legal > TAC", "resultado_esperado": "Marcado"}, {"acao": "Conferir a aba de obrigacoes", "dados": "-", "ordem": 2, "onde_na_tela": "Empresas > aba Obrigacoes", "resultado_esperado": "Deveria haver \"Cumprir obrigacoes do TAC\", categoria legal, criticidade critica"}]', 'A obrigacao de cumprir o TAC deveria estar registrada. RESULTADO REAL: nao existe sem o clique.', 'IMPACTO: o TAC e compromisso judicial com o MPT. Cada clausula descumprida tem multa propria. Uma empresa que declarou ter TAC e nao tem nenhum acompanhamento registrado esta exposta ao risco mais caro do painel — e o cadastro sabe disso, mas o painel de conformidade nao.', 'api', NULL, 'em_triagem', NULL),
    ('REGRA-006', 'Grau de risco 3 ou 4 gera obrigacao de avaliacao', 'feliz', 'media', 'aprovado', 'Verificar a REGRA: empresas com grau de risco 3 ou 4 (NR-04) devem ter registrada a obrigacao "Avaliar impacto do grau de risco elevado", porque exigem medidas preventivas adicionais. Regra: grau_risco >= 3. Importa porque o grau de risco define o dimensionamento do SESMT, a periodicidade de exames e a exigencia de programas — grau elevado significa mais obrigacoes.', 'Precisa existir uma empresa com grau de risco 3 ou 4.', '[{"acao": "Informar grau de risco 4 para a empresa", "dados": "Grau de risco: 4", "ordem": 1, "onde_na_tela": "Empresas > Enquadramento Legal", "resultado_esperado": "Grau gravado"}, {"acao": "Conferir a aba de obrigacoes", "dados": "-", "ordem": 2, "onde_na_tela": "Empresas > aba Obrigacoes", "resultado_esperado": "Deveria haver \"Avaliar impacto do grau de risco elevado\", categoria sst, criticidade media"}]', 'A obrigacao de avaliar o grau elevado deveria estar registrada. RESULTADO REAL: nao existe sem o clique.', 'IMPACTO: grau 3 ou 4 puxa uma cadeia de exigencias (dimensionamento de SESMT, exames, programas). Sem a obrigacao registrada, a empresa pode nao ter avaliado o que o grau elevado implica para ela.', 'api', NULL, 'em_triagem', NULL),
    ('REGRA-007', 'CIPA em implantacao gera obrigacao de eleicao', 'feliz', 'media', 'aprovado', 'Regra: cipa_obrigatoria E cipa_situacao = em_implantacao gera "Realizar eleicao da CIPA". Base legal NR-05.', 'Empresa com CIPA obrigatoria e situacao em_implantacao.', '[{"acao": "Gerar as obrigacoes da empresa", "ordem": 1, "resultado_esperado": "Obrigacao de eleicao registrada, criticidade media"}, {"acao": "Mudar a situacao para ativa", "ordem": 2, "resultado_esperado": "A obrigacao de eleicao deixa de ser gerada"}]', 'Estado intermediario da CIPA tem obrigacao propria.', 'Terceiro estado do cipa_situacao, sem caso ate hoje: REGRA-002 cobre nao_constituida e REGRA-011 cobre ativa. em_implantacao ficou no vao. | RECLASSIFICADO 30/07/2026 (api -> e2e): a geracao de obrigacoes vive em OBRIGACOES_TEMPLATES (TypeScript) e depende do clique em "Gerar Obrigacoes". Nao ha funcao nem trigger que produza obrigacao no banco, entao nenhuma rotina SQL consegue disparar a regra — so constatar a ausencia. A cobertura pertence ao Cypress. Se um dia a geracao migrar para o banco (trigger ou funcao), estes casos voltam para api e ganham rotina.', 'e2e', NULL, 'em_triagem', NULL),
    ('REGRA-008', 'Mandato da CIPA perto do fim gera obrigacao de renovacao', 'feliz', 'alta', 'aprovado', 'Regra: falta menos de 90 dias para cipa_data_mandato_fim (ou ja venceu) gera "Renovar mandato da CIPA". Unica regra do modulo que depende da data corrente.', 'Empresa com CIPA ativa e mandato cadastrado.', '[{"acao": "Mandato terminando em 30 dias", "ordem": 1, "resultado_esperado": "Obrigacao de renovacao registrada, criticidade alta"}, {"acao": "Mandato ja vencido", "ordem": 2, "resultado_esperado": "Obrigacao tambem registrada — vencido e caso mais grave, nao menos"}, {"acao": "Mandato sem data de fim", "ordem": 3, "resultado_esperado": "Nenhuma obrigacao — a regra retorna falso sem data"}]', 'A renovacao entra na fila com antecedencia e continua depois de vencer.', 'Regra sensivel ao tempo: passa a valer sozinha com o calendario, sem ninguem editar nada. E a unica do modulo com esse comportamento, o que a torna a mais facil de quebrar sem perceber. | RECLASSIFICADO 30/07/2026 (api -> e2e): a geracao de obrigacoes vive em OBRIGACOES_TEMPLATES (TypeScript) e depende do clique em "Gerar Obrigacoes". Nao ha funcao nem trigger que produza obrigacao no banco, entao nenhuma rotina SQL consegue disparar a regra — so constatar a ausencia. A cobertura pertence ao Cypress. Se um dia a geracao migrar para o banco (trigger ou funcao), estes casos voltam para api e ganham rotina.', 'e2e', NULL, 'em_triagem', NULL),
    ('REGRA-009', 'Deficit de aprendiz gera obrigacao de contratacao', 'feliz', 'media', 'aprovado', 'Regra: aprendiz_obrigatorio E aprendiz_quantidade_atual menor que aprendiz_quantidade_minima gera "Contratar jovem aprendiz". Base legal CLT art. 429.', 'Empresa com cota de aprendiz obrigatoria e minimo informado.', '[{"acao": "Minimo 10, atual 4", "ordem": 1, "resultado_esperado": "Obrigacao registrada"}, {"acao": "Minimo 10, atual 10", "ordem": 2, "resultado_esperado": "Nenhuma obrigacao"}, {"acao": "Minimo 10, atual 12", "ordem": 3, "resultado_esperado": "Nenhuma obrigacao — acima do minimo continua regular"}]', 'Deficit de aprendiz vira pendencia; cota cumprida nao polui o painel.', 'Decimo quarto template e o unico do bloco de inclusao sem caso. Note a diferenca em relacao ao PcD: aqui a comparacao e contra o MINIMO da faixa, nao contra uma quantidade calculada. | RECLASSIFICADO 30/07/2026 (api -> e2e): a geracao de obrigacoes vive em OBRIGACOES_TEMPLATES (TypeScript) e depende do clique em "Gerar Obrigacoes". Nao ha funcao nem trigger que produza obrigacao no banco, entao nenhuma rotina SQL consegue disparar a regra — so constatar a ausencia. A cobertura pertence ao Cypress. Se um dia a geracao migrar para o banco (trigger ou funcao), estes casos voltam para api e ganham rotina.', 'e2e', NULL, 'em_triagem', NULL),
    ('REGRA-010', 'Empresa sem deficit NAO deve gerar obrigacao de PcD', 'negativo', 'alta', 'aprovado', 'Verificar a contraparte da regra: uma empresa que CUMPRE a cota de PcD nao deve ter a obrigacao de adequacao registrada. Regra: a condicao exige deficit (atual menor que exigida) — sem deficit, nao ha o que adequar. Importa para confirmar que a regra e precisa: gerar obrigacao para quem esta em dia poluiria o painel de conformidade com pendencias inexistentes.', 'Precisa existir uma empresa com cota PcD cumprida.', '[{"acao": "Cadastrar empresa com 350 empregados e 11 PcDs", "dados": "Total: 350 | Cota exigida: 11 | PcDs atuais: 11 (sem deficit)", "ordem": 1, "onde_na_tela": "Empresas > Obrigacoes de Inclusao", "resultado_esperado": "Situacao regular"}, {"acao": "Conferir a aba de obrigacoes", "dados": "-", "ordem": 2, "onde_na_tela": "Empresas > aba Obrigacoes", "resultado_esperado": "NAO deve haver obrigacao de adequacao da cota — a empresa esta em dia"}]', 'Nenhuma obrigacao de adequacao de cota e registrada para a empresa em dia. A regra distingue corretamente quem esta irregular de quem esta cumprindo.', 'IMPACTO SE FALHAR: gerar obrigacao para empresa em dia poluiria o painel com pendencias falsas — e o painel perderia credibilidade, que e o pior que pode acontecer com um controle de conformidade.', 'api', NULL, 'em_triagem', NULL),
    ('REGRA-011', 'CIPA ativa NAO deve gerar obrigacao de constituir', 'negativo', 'media', 'aprovado', 'Verificar a contraparte: empresa com CIPA ativa nao deve ter a obrigacao de constituir CIPA. Regra: a condicao exige situacao "nao_constituida". Importa pelo mesmo motivo do REGRA-010 — precisao do painel.', 'Precisa existir uma empresa com CIPA obrigatoria e ativa.', '[{"acao": "Marcar CIPA obrigatoria com situacao ativa", "dados": "CIPA obrigatoria: sim | Situacao: ativa", "ordem": 1, "onde_na_tela": "Empresas > Enquadramento Legal > CIPA", "resultado_esperado": "Gravado"}, {"acao": "Conferir a aba de obrigacoes", "dados": "-", "ordem": 2, "onde_na_tela": "Empresas > aba Obrigacoes", "resultado_esperado": "NAO deve haver obrigacao de constituir CIPA"}]', 'Nenhuma obrigacao de constituir CIPA para empresa que ja a tem ativa.', 'IMPACTO SE FALHAR: pendencias falsas no painel de conformidade.', 'api', NULL, 'em_triagem', NULL),
    ('REGRA-012', 'Cada condicao especial gera a obrigacao da sua norma', 'feliz', 'alta', 'aprovado', 'Cinco condicoes especiais, cada uma amarrada a uma NR. Sao cinco templates independentes que nunca tiveram caso.', 'Empresa cadastrada, condicoes especiais desmarcadas.', '[{"acao": "Marcar trabalho_altura", "ordem": 1, "resultado_esperado": "Obrigacao de treinamento NR-35, criticidade alta"}, {"acao": "Marcar espaco_confinado", "ordem": 2, "resultado_esperado": "Obrigacao de treinamento NR-33, criticidade alta"}, {"acao": "Marcar insalubridade", "ordem": 3, "resultado_esperado": "Obrigacao de revisar laudos NR-15, criticidade media"}, {"acao": "Marcar periculosidade", "ordem": 4, "resultado_esperado": "Obrigacao de revisar laudos NR-16, criticidade media"}, {"acao": "Marcar possui_terceiro_turno", "ordem": 5, "resultado_esperado": "Obrigacao de avaliar impacto, NR-17 e CLT art. 73, criticidade media"}, {"acao": "Desmarcar todas", "ordem": 6, "resultado_esperado": "Nenhuma das cinco obrigacoes e gerada"}]', 'Cada condicao marcada produz exatamente a obrigacao da sua norma.', 'Cinco templates em um caso porque a estrutura e identica — switch booleano direto para obrigacao. O passo 6 e a contraprova coletiva, no espirito de REGRA-010 e REGRA-011. | RECLASSIFICADO 30/07/2026 (api -> e2e): a geracao de obrigacoes vive em OBRIGACOES_TEMPLATES (TypeScript) e depende do clique em "Gerar Obrigacoes". Nao ha funcao nem trigger que produza obrigacao no banco, entao nenhuma rotina SQL consegue disparar a regra — so constatar a ausencia. A cobertura pertence ao Cypress. Se um dia a geracao migrar para o banco (trigger ou funcao), estes casos voltam para api e ganham rotina.', 'e2e', NULL, 'em_triagem', NULL),
    ('REGRA-013', 'Cota PcD obrigatoria com quantidade zerada gera obrigacao', 'alternativo', 'alta', 'aprovado', 'Ramo esquecido da regra do PcD: a condicao dispara tambem quando pcd_quantidade_exigida = 0, nao so quando ha deficit. Marcar a cota como obrigatoria e nao calcular nada nao pode passar batido.', 'Empresa com pcd_obrigatoria = true e pcd_quantidade_exigida = 0.', '[{"acao": "Gerar as obrigacoes", "ordem": 1, "resultado_esperado": "Obrigacao de adequacao registrada, mesmo sem deficit calculado"}, {"acao": "Calcular a cota corretamente e ficar em dia", "ordem": 2, "resultado_esperado": "A obrigacao deixa de ser gerada"}]', 'Cota obrigatoria em branco e tratada como pendencia, nao como conformidade.', 'Ramo proposital da condicao, facil de perder numa refatoracao: quem simplificar para "atual < exigida" quebra este caso em silencio, e empresa com cota zerada passa a aparecer como conforme. | RECLASSIFICADO 30/07/2026 (api -> e2e): a geracao de obrigacoes vive em OBRIGACOES_TEMPLATES (TypeScript) e depende do clique em "Gerar Obrigacoes". Nao ha funcao nem trigger que produza obrigacao no banco, entao nenhuma rotina SQL consegue disparar a regra — so constatar a ausencia. A cobertura pertence ao Cypress. Se um dia a geracao migrar para o banco (trigger ou funcao), estes casos voltam para api e ganham rotina.', 'e2e', NULL, 'em_triagem', NULL),
    ('REGRA-014', 'FAP exatamente em 1,5 nao gera obrigacao', 'negativo', 'media', 'aprovado', 'A condicao e ESTRITAMENTE maior que 1,5. A fronteira precisa de caso proprio porque um >= trocado por > passa despercebido em revisao.', 'Empresa cadastrada.', '[{"acao": "FAP = 1,5", "ordem": 1, "resultado_esperado": "Nenhuma obrigacao — o limite nao esta incluido"}, {"acao": "FAP = 1,5001", "ordem": 2, "resultado_esperado": "Obrigacao de plano de reducao registrada"}, {"acao": "FAP nulo", "ordem": 3, "resultado_esperado": "Nenhuma obrigacao — ausencia nao e valor alto"}]', 'A fronteira do FAP e exclusiva e a ausencia nao dispara nada.', 'fap_atual e NUMERIC(5,4): a quarta casa decimal existe e o passo 2 usa isso. Complementa REGRA-004, que testa o caso claramente acima do limite. | RECLASSIFICADO 30/07/2026 (api -> e2e): a geracao de obrigacoes vive em OBRIGACOES_TEMPLATES (TypeScript) e depende do clique em "Gerar Obrigacoes". Nao ha funcao nem trigger que produza obrigacao no banco, entao nenhuma rotina SQL consegue disparar a regra — so constatar a ausencia. A cobertura pertence ao Cypress. Se um dia a geracao migrar para o banco (trigger ou funcao), estes casos voltam para api e ganham rotina.', 'e2e', NULL, 'em_triagem', NULL),
    ('TAC-001', 'Registrar TAC com vigência e condicionantes', 'feliz', 'media', 'aprovado', 'A aba Indicadores mantém a lista de TACs (Termo de Ajustamento de Conduta) em empresa_cadastro.tac_detalhes: órgão, número, vigência, condicionantes, situação. ENQ-010 cobre o FAP; o TAC nunca teve caso. TAC descumprido vira multa e ação — o registro precisa gravar por inteiro.', 'Empresa cadastrada no cercado.', '[{"acao": "Incluir um TAC com órgão, número, início e fim de vigência e condicionantes", "ordem": 1, "onde_na_tela": "Empresas > abrir a empresa > aba Indicadores > seção TAC", "resultado_esperado": "Item gravado na lista tac_detalhes com todos os campos"}, {"acao": "Reabrir o cadastro", "ordem": 2, "resultado_esperado": "O TAC reaparece como foi gravado"}]', 'O TAC é gravado e relido por inteiro.', NULL, 'api', NULL, 'em_triagem', NULL),
    ('TAC-002', 'Arquivar TAC preserva o histórico', 'alternativo', 'baixa', 'aprovado', 'TAC encerrado não some: a tela o move para arquivados. Excluir é outra ação, separada. Histórico de conduta perante o órgão fiscalizador é exatamente o tipo de dado que não se apaga por engano.', 'Empresa com um TAC ativo registrado.', '[{"acao": "Arquivar o TAC", "ordem": 1, "onde_na_tela": "Aba Indicadores > item do TAC > arquivar", "resultado_esperado": "Item sai dos ativos e aparece nos arquivados, com os dados intactos"}, {"acao": "Excluir um item arquivado", "ordem": 2, "resultado_esperado": "Só então o item deixa de existir"}]', 'Arquivar preserva; excluir é ação distinta e explícita.', NULL, 'e2e', NULL, 'em_triagem', NULL),
    ('TAC-003', 'Vigência do TAC com fim antes do início', 'negativo', 'media', 'aprovado', 'Nem a tela nem o banco validam a coerência das datas do TAC — tac_detalhes é JSONB livre. Fim antes do início é a mesma incoerência que ENQ-013 documenta para o mandato da CIPA, e aqui não há nem CHECK possível sem estruturar o dado.', 'Empresa cadastrada no cercado.', '[{"acao": "Registrar TAC com vigência fim anterior à vigência início", "ordem": 1, "resultado_esperado": "Recusado — vigência incoerente não é TAC válido"}]', 'A vigência invertida não entra.', 'Provável ACHADO: hoje deve passar. O remédio de curto prazo é validar na tela; o estrutural é o mesmo já anotado nas observações de ENQ-013 — dado com regra própria merece coluna, não JSON livre.', 'api', NULL, 'em_triagem', NULL),
    ('TAC-004', 'tac_detalhes com estrutura inesperada não derruba a aba', 'excecao', 'baixa', 'aprovado', 'Por ser JSONB sem contrato, qualquer integração ou script pode gravar em tac_detalhes algo que não é a lista esperada (objeto, nulo, item sem campos). A aba Indicadores precisa degradar com elegância — lista vazia ou item ignorado — em vez de tela branca.', 'Empresa no cercado com tac_detalhes gravado fora do formato (ex.: objeto em vez de lista).', '[{"acao": "Abrir a aba Indicadores da empresa com o dado malformado", "ordem": 1, "resultado_esperado": "Aba renderiza; o dado inválido é ignorado ou sinalizado, sem quebrar"}, {"acao": "Incluir um TAC novo por cima", "ordem": 2, "resultado_esperado": "Gravação normaliza a estrutura sem perder o que for recuperável"}]', 'Dado fora do contrato não tira a aba do ar.', NULL, 'e2e', NULL, 'em_triagem', NULL)
) AS d(codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
CROSS JOIN public.qa_modulos m
WHERE m.path = 'estrutura-organizacional/empresa'
ON CONFLICT (codigo) DO UPDATE SET
      titulo = EXCLUDED.titulo,
      tipo = EXCLUDED.tipo,
      prioridade = EXCLUDED.prioridade,
      status = EXCLUDED.status,
      objetivo = EXCLUDED.objetivo,
      pre_condicoes = EXCLUDED.pre_condicoes,
      passos = EXCLUDED.passos,
      resultado_esperado = EXCLUDED.resultado_esperado,
      observacoes = EXCLUDED.observacoes,
      nivel = EXCLUDED.nivel,
      base_legal = EXCLUDED.base_legal,
      modulo_id = EXCLUDED.modulo_id,
      disposicao = CASE WHEN qa_casos_teste.disposicao = 'em_triagem' THEN EXCLUDED.disposicao ELSE qa_casos_teste.disposicao END,
      disposicao_motivo = CASE WHEN qa_casos_teste.disposicao = 'em_triagem' THEN EXCLUDED.disposicao_motivo ELSE qa_casos_teste.disposicao_motivo END,
      updated_at = now();

-- Estabelecimentos / Obras (8 casos)

INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
SELECT m.id, d.codigo::text, d.titulo::text, d.tipo::text::qa_caso_tipo, d.prioridade::text::qa_prioridade, d.status::text::qa_caso_status, d.objetivo::text, d.pre_condicoes::text, d.passos::text::jsonb, d.resultado_esperado::text, d.observacoes::text, d.nivel::text, d.base_legal::text, d.disposicao::text, d.disposicao_motivo::text
FROM (VALUES
    ('EST-001', 'Cadastrar estabelecimento', 'feliz', 'alta', 'aprovado', 'Verificar o cadastro basico de um estabelecimento ligado a uma empresa. Regra: um estabelecimento (filial, unidade, obra) pertence a uma empresa e tem nome. Importa porque estabelecimentos representam os locais fisicos da empresa — onde ha pessoas, riscos e obrigacoes de SST especificas por local.', 'Precisa existir uma empresa cadastrada para vincular o estabelecimento.', '[{"acao": "Abrir o cadastro de estabelecimento", "dados": "-", "ordem": 1, "onde_na_tela": "Menu > Estrutura Organizacional > Estabelecimentos > Novo", "resultado_esperado": "Formulario aberto"}, {"acao": "Preencher nome e vincular a empresa", "dados": "Nome: Filial Centro | Empresa: Empresa Teste Ltda", "ordem": 2, "onde_na_tela": "Campos Nome e Empresa", "resultado_esperado": "Campos aceitos"}, {"acao": "Salvar", "dados": "-", "ordem": 3, "onde_na_tela": "Botao Salvar", "resultado_esperado": "Estabelecimento criado, ligado a empresa"}]', 'O estabelecimento Filial Centro existe, vinculado a empresa, e aparece na lista.', 'IMPACTO SE FALHAR: sem estabelecimentos, nao ha como organizar pessoas e riscos por local fisico — obrigacoes de SST especificas de cada unidade ficam sem base.', 'api', NULL, 'em_triagem', NULL),
    ('EST-002', 'Cadastrar uma OBRA com CNO', 'feliz', 'alta', 'aprovado', 'Verificar que uma filial do tipo OBRA aceita o campo CNO (Cadastro Nacional de Obras). Regra: obras da construcao civil tem um CNO que as identifica legalmente. Importa porque o CNO e obrigatorio para obrigacoes trabalhistas e previdenciarias de obras — sem ele, a obra nao esta em conformidade.', 'Precisa existir uma empresa. O tipo do estabelecimento sera obra.', '[{"acao": "Abrir novo estabelecimento e escolher tipo Obra", "dados": "Tipo: obra", "ordem": 1, "onde_na_tela": "Novo Estabelecimento > campo Tipo", "resultado_esperado": "Ao escolher obra, o campo CNO aparece"}, {"acao": "Preencher nome e CNO", "dados": "Nome: Obra Residencial Alfa | CNO: 12.345.67890/12", "ordem": 2, "onde_na_tela": "Campos Nome e CNO", "resultado_esperado": "Campos aceitos"}, {"acao": "Salvar e reabrir", "dados": "-", "ordem": 3, "onde_na_tela": "Salvar > reabrir a obra", "resultado_esperado": "O CNO foi gravado e aparece ao reabrir"}]', 'A obra e criada com o CNO gravado. Ao reabrir, o CNO esta la.', 'IMPACTO SE FALHAR: sem gravar o CNO, a obra fica sem a identificacao legal exigida para obrigacoes trabalhistas e previdenciarias da construcao — risco de nao conformidade.', 'api', NULL, 'em_triagem', NULL),
    ('EST-003', 'Editar estabelecimento', 'feliz', 'media', 'aprovado', 'Verificar que dados de um estabelecimento podem ser editados e persistem. Regra: dados do estabelecimento sao editaveis. Importa porque locais mudam de nome, endereco e responsavel, e os documentos precisam refletir isso.', 'Precisa existir um estabelecimento cadastrado.', '[{"acao": "Abrir um estabelecimento para editar", "dados": "-", "ordem": 1, "onde_na_tela": "Estabelecimentos > clicar > Editar", "resultado_esperado": "Formulario com dados atuais"}, {"acao": "Alterar o nome", "dados": "Novo nome: Filial Centro Reformada", "ordem": 2, "onde_na_tela": "Campo Nome", "resultado_esperado": "Campo aceita"}, {"acao": "Salvar e conferir", "dados": "-", "ordem": 3, "onde_na_tela": "Salvar > reabrir", "resultado_esperado": "O nome novo esta gravado"}]', 'O nome do estabelecimento e atualizado e persiste ao reabrir.', 'IMPACTO SE FALHAR: dados desatualizados do local aparecem em documentos e relatorios.', 'api', NULL, 'em_triagem', NULL),
    ('EST-010', 'Nome vazio e recusado', 'excecao', 'media', 'aprovado', 'Verificar que um estabelecimento sem nome e recusado. Regra: nome e NOT NULL. Importa porque um estabelecimento sem nome aparece em branco e nao serve para localizar pessoas ou riscos.', 'Precisa existir uma empresa para tentar o vinculo.', '[{"acao": "Abrir novo estabelecimento", "dados": "-", "ordem": 1, "onde_na_tela": "Estabelecimentos > Novo", "resultado_esperado": "Formulario aberto"}, {"acao": "Deixar o nome vazio e tentar salvar", "dados": "Nome: (vazio)", "ordem": 2, "onde_na_tela": "Campo Nome (vazio) + Salvar", "resultado_esperado": "O sistema DEVE recusar"}]', 'O cadastro e recusado. Nenhum estabelecimento sem nome e criado.', 'IMPACTO SE FALHAR: estabelecimento em branco polui listas e filtros por local.', 'api', NULL, 'em_triagem', NULL),
    ('EST-011', 'Mesmo nome em clientes diferentes e permitido', 'alternativo', 'media', 'aprovado', 'Verificar que o mesmo nome de estabelecimento pode existir em clientes diferentes. Regra: o UNIQUE e por tenant. Importa para nao restringir demais — "Matriz" e um nome comum que varios clientes usam.', 'Dois clientes distintos no sistema.', '[{"acao": "No cliente A, criar estabelecimento Matriz", "dados": "Nome: Matriz", "ordem": 1, "onde_na_tela": "Cliente A > Novo Estabelecimento", "resultado_esperado": "Criado no cliente A"}, {"acao": "No cliente B, criar estabelecimento Matriz", "dados": "Nome: Matriz (mesmo nome, outro cliente)", "ordem": 2, "onde_na_tela": "Cliente B > Novo Estabelecimento", "resultado_esperado": "ACEITO — unicidade e por cliente"}]', 'Ambos os clientes tem uma Matriz. Nomes iguais em clientes distintos convivem.', 'IMPACTO SE FALHAR: unicidade global impediria clientes de usar nomes comuns de local — restricao absurda com risco de vazar informacao entre clientes.', 'api', NULL, 'em_triagem', NULL),
    ('EST-013', 'Apagar a empresa apenas desassocia a filial', 'alternativo', 'alta', 'aprovado', 'Verificar que apagar a empresa apenas DESASSOCIA a filial, sem apaga-la. Regra: empresa_id ON DELETE SET NULL — a filial sobrevive sem empresa. Importa porque apagar uma empresa nao deveria destruir os locais que existiam nela; eles podem ser realocados.', 'Precisa existir uma empresa com pelo menos uma filial vinculada.', '[{"acao": "Criar empresa e uma filial vinculada", "dados": "Empresa: Matriz SA | Filial: Unidade Norte, ligada a Matriz SA", "ordem": 1, "onde_na_tela": "Empresas e Estabelecimentos", "resultado_esperado": "Filial pertence a empresa"}, {"acao": "Apagar a empresa Matriz SA", "dados": "-", "ordem": 2, "onde_na_tela": "Empresas > Matriz SA > Excluir", "resultado_esperado": "Empresa apagada"}, {"acao": "Conferir a filial Unidade Norte", "dados": "-", "ordem": 3, "onde_na_tela": "Estabelecimentos > Unidade Norte", "resultado_esperado": "A filial ainda existe, agora sem empresa (desassociada)"}]', 'A empresa e apagada, mas a filial Unidade Norte continua existindo, sem empresa vinculada. Nada de filial apagada junto.', 'IMPACTO SE FALHAR: se apagar a empresa apagasse as filiais, perder-se-ia o cadastro de locais que so precisavam ser realocados. O SET NULL preserva as filiais. CONTRASTE: em Terceiros (TER-013) a regra e oposta — CASCADE — porque trabalhador de terceiro nao faz sentido sem o terceiro.', 'api', NULL, 'em_triagem', NULL),
    ('EST-020', 'Nome duplicado no mesmo cliente e recusado', 'negativo', 'alta', 'aprovado', 'Verificar que dois estabelecimentos com o mesmo nome no mesmo cliente sao recusados. Regra: UNIQUE(tenant_id, nome). Importa porque dois locais de nome igual confundem a qual unidade uma pessoa ou risco pertence.', 'Precisa existir um estabelecimento com um nome conhecido.', '[{"acao": "Criar um estabelecimento", "dados": "Nome: Deposito Central", "ordem": 1, "onde_na_tela": "Novo Estabelecimento", "resultado_esperado": "Criado"}, {"acao": "Tentar criar OUTRO com o mesmo nome", "dados": "Nome: Deposito Central (repetido)", "ordem": 2, "onde_na_tela": "Novo Estabelecimento", "resultado_esperado": "O sistema DEVE recusar"}]', 'O segundo Deposito Central e recusado. So um local com esse nome no cliente.', 'IMPACTO SE FALHAR: locais de nome repetido tornam ambiguo onde pessoas e riscos estao, quebrando relatorios por unidade.', 'api', NULL, 'em_triagem', NULL),
    ('EST-022', 'Estabelecimento de outro cliente e invisivel', 'negativo', 'critica', 'aprovado', 'Verificar que um estabelecimento de um cliente e invisivel para outro. Regra: isolamento multi-tenant. Importa porque a estrutura de locais de um cliente e informacao que nao pode vazar.', 'Dois clientes distintos no sistema.', '[{"acao": "No cliente A, criar um estabelecimento", "dados": "Nome: Unidade Secreta do A", "ordem": 1, "onde_na_tela": "Cliente A > Novo Estabelecimento", "resultado_esperado": "Criado no cliente A"}, {"acao": "Entrar como cliente B e procurar", "dados": "Buscar pelo nome do local do cliente A", "ordem": 2, "onde_na_tela": "Cliente B > Estabelecimentos > busca", "resultado_esperado": "NAO aparece para o cliente B"}]', 'O estabelecimento do cliente A e invisivel no cliente B. Zero vazamento.', 'IMPACTO SE FALHAR: exporia a estrutura de locais de um cliente a outro. Protecao RLS por tenant.', 'api', NULL, 'em_triagem', NULL)
) AS d(codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
CROSS JOIN public.qa_modulos m
WHERE m.path = 'estrutura-organizacional/estabelecimentos'
ON CONFLICT (codigo) DO UPDATE SET
      titulo = EXCLUDED.titulo,
      tipo = EXCLUDED.tipo,
      prioridade = EXCLUDED.prioridade,
      status = EXCLUDED.status,
      objetivo = EXCLUDED.objetivo,
      pre_condicoes = EXCLUDED.pre_condicoes,
      passos = EXCLUDED.passos,
      resultado_esperado = EXCLUDED.resultado_esperado,
      observacoes = EXCLUDED.observacoes,
      nivel = EXCLUDED.nivel,
      base_legal = EXCLUDED.base_legal,
      modulo_id = EXCLUDED.modulo_id,
      disposicao = CASE WHEN qa_casos_teste.disposicao = 'em_triagem' THEN EXCLUDED.disposicao ELSE qa_casos_teste.disposicao END,
      disposicao_motivo = CASE WHEN qa_casos_teste.disposicao = 'em_triagem' THEN EXCLUDED.disposicao_motivo ELSE qa_casos_teste.disposicao_motivo END,
      updated_at = now();

-- Folha de Pagamento (19 casos)

INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
SELECT m.id, d.codigo::text, d.titulo::text, d.tipo::text::qa_caso_tipo, d.prioridade::text::qa_prioridade, d.status::text::qa_caso_status, d.objetivo::text, d.pre_condicoes::text, d.passos::text::jsonb, d.resultado_esperado::text, d.observacoes::text, d.nivel::text, d.base_legal::text, d.disposicao::text, d.disposicao_motivo::text
FROM (VALUES
    ('FOLHA-001', 'Rubrica sem natureza/incidência do eSocial não entra no cálculo', 'negativo', 'critica', 'aprovado', 'A rubrica é a menor peça da folha, e cada uma precisa da natureza do eSocial (S-1010) e das incidências definidas ANTES de gerar valor: rubrica sem classificação que entra no cálculo produz base errada de INSS/FGTS/IRRF e evento rejeitado — ou pior, aceito com tributo errado. O documento é explícito (CA-001): sem incidência, o cálculo BLOQUEIA e pede a definição.', 'Rubrica nova criada sem classificacao_esocial e sem incidências marcadas.', '[{"acao": "Criar rubrica sem natureza do eSocial e sem incidências", "ordem": 1, "resultado_esperado": "Aceita como rascunho, mas sinalizada como incompleta"}, {"acao": "Lançar valor com essa rubrica e processar a folha", "ordem": 2, "resultado_esperado": "Cálculo bloqueado citando a rubrica pendente — não processa por cima"}, {"acao": "Definir natureza e incidências e reprocessar", "ordem": 3, "resultado_esperado": "Cálculo liberado, com as bases refletindo a definição"}]', 'Rubrica incompleta trava a folha — nunca tributa no chute.', 'Requisitos YE-DP-FOLHA-001: RN-001 / CA-001 / cenário "Dado ausente" (seção 25). DIVERGÊNCIA VISÍVEL: folha_rubricas.classificacao_esocial é NULLABLE e nada impede o cálculo. Deve falhar e encaminhar.', 'api', 'eSocial — S-1010 (tabela de rubricas: natureza e incidências de INSS/FGTS/IRRF)', 'em_triagem', NULL),
    ('FOLHA-002', 'Tabela de rubricas versionada: mudança cria vigência, não sobrescreve', 'alternativo', 'alta', 'aprovado', 'Mudar a incidência de uma rubrica não pode reescrever o passado: a folha de março foi calculada com a regra de março, e reproduzi-la (RNF-007) exige saber qual regra valia lá. A tabela de rubricas precisa de vigência — alteração encerra a versão anterior e abre a nova — e o S-1010 espelha exatamente esse desenho de períodos de validade.', 'Rubrica ativa usada em folhas passadas; alteração de incidência solicitada.', '[{"acao": "Alterar a incidência de INSS de uma rubrica usada em competências fechadas", "ordem": 1, "resultado_esperado": "Nova vigência criada; a definição antiga preservada com o período dela"}, {"acao": "Reproduzir o cálculo de uma competência antiga", "ordem": 2, "resultado_esperado": "Usa a versão vigente NAQUELA competência, não a atual"}]', 'Rubrica tem história; o recálculo de ontem usa a regra de ontem.', 'Requisitos YE-DP-FOLHA-001: RNF-002/RNF-007 / seção 23 (parametrização versionada). DIVERGÊNCIA VISÍVEL: folha_rubricas não tem vigência — UPDATE sobrescreve a definição para todas as épocas. As tabelas de INSS/IRRF já são versionadas; falta o mesmo desenho nas rubricas.', 'api', 'Documento YE-DP-FOLHA-001, RNF-002; eSocial S-1010 (vigências de rubrica)', 'em_triagem', NULL),
    ('FOLHA-010', 'INSS do empregado: tabela progressiva por faixas com teto', 'feliz', 'critica', 'aprovado', 'O INSS do empregado é PROGRESSIVO: cada faixa da tabela vigente tributa só a fatia do salário dentro dela (7,5% a 14%), e acima do teto do salário de contribuição não há mais desconto. Aplicar a alíquota da faixa sobre o salário inteiro — o erro clássico — desconta a mais; ignorar o teto desconta de quem já passou dele.', 'Vínculos fictícios com salários em faixas diferentes, inclusive acima do teto.', '[{"acao": "Calcular INSS de salário na 2ª faixa", "ordem": 1, "resultado_esperado": "Progressão: 7,5% na fatia da 1ª faixa + alíquota da 2ª só na fatia dela"}, {"acao": "Calcular INSS de salário acima do teto", "ordem": 2, "resultado_esperado": "Contribuição limitada ao teto (valor máximo da tabela vigente)"}, {"acao": "Conferir a fonte das faixas", "ordem": 3, "resultado_esperado": "folha_tabelas_inss vigente na competência — nunca valor fixo em código"}]', 'Faixa por faixa até o teto — e a tabela vem do banco, versionada.', 'Requisitos YE-DP-FOLHA-001: RN-007 / CA-002. calcularINSS existe no React com faixas; o caso confere progressão, teto e uso da tabela versionada. Valores 2026 são [VAL] (seção 30).', 'e2e', 'Lei 8.212/1991; tabela progressiva vigente (7,5% a 14%) e teto do salário de contribuição', 'em_triagem', NULL),
    ('FOLHA-011', 'IRRF: tabela vigente com redutor da Lei 15.270 e deduções', 'feliz', 'critica', 'aprovado', 'O IRRF parte da base depois das deduções — INSS do próprio mês, dependentes (valor por dependente da tabela), pensão judicial — e aplica a tabela progressiva vigente COM o redutor da Lei 15.270/2025 (faixa de isenção ampliada). Tabela desatualizada ou redutor esquecido retém imposto de quem a lei isentou — erro que aparece na malha do colaborador, não da empresa.', 'Vínculos fictícios com e sem dependentes, em faixas distintas, inclusive na faixa isenta ampliada.', '[{"acao": "Calcular IRRF de salário na faixa de isenção ampliada", "ordem": 1, "resultado_esperado": "Imposto zero pelo redutor da Lei 15.270 — não pela tabela antiga"}, {"acao": "Calcular com 2 dependentes", "ordem": 2, "resultado_esperado": "Dedução por dependente aplicada antes da tabela"}, {"acao": "Conferir a fonte", "ordem": 3, "resultado_esperado": "folha_tabelas_irrf vigente na competência, com o redutor parametrizado"}]', 'Deduz primeiro, tributa depois — pela tabela e pelo redutor vigentes.', 'Requisitos YE-DP-FOLHA-001: RN-008 / CA-003. calcularIRRF existe no React; o caso confere deduções, redutor e versionamento. Tabela/redutor são [VAL] (seção 30).', 'e2e', 'Tabela progressiva do IRRF; Lei 15.270/2025 (redutor/faixa de isenção ampliada); deduções legais (dependentes, INSS, pensão)', 'em_triagem', NULL),
    ('FOLHA-020', 'Adicional noturno urbano: 20% e hora reduzida de 52min30s', 'feliz', 'alta', 'aprovado', 'O noturno urbano tem DUAS vantagens cumulativas: o adicional de 20% e a hora ficta de 52min30s — 7 horas no relógio valem 8 para pagamento. A folha que aplica só o percentual paga a menos; o Ponto apura as horas noturnas (família PONTO cobre a apuração), e a folha precisa aplicar a redução E o adicional sobre elas, com prorrogação após as 5h quando a jornada é integralmente noturna.', 'Horas noturnas apuradas pelo Ponto para vínculo com jornada 22h-5h.', '[{"acao": "Calcular a folha do vínculo noturno", "ordem": 1, "resultado_esperado": "Horas convertidas pela hora reduzida (÷ 52,5min) E adicional de 20% sobre elas"}, {"acao": "Jornada integralmente noturna que avança após as 5h", "ordem": 2, "resultado_esperado": "Prorrogação também com adicional (Súmula 60, II do TST)"}, {"acao": "CCT com percentual maior parametrizado", "ordem": 3, "resultado_esperado": "Percentual da convenção aplicado no lugar dos 20%"}]', 'Hora menor no relógio, valor maior no bolso — os dois efeitos, sempre.', 'Requisitos YE-DP-FOLHA-001: RN-004 / CA-004. A APURAÇÃO das horas é da família PONTO; aqui se testa o REFLEXO na folha (calcularFolhaMensal já recebe adicionalNoturno com hora reduzida — conferir o efeito fim a fim).', 'e2e', 'CLT, art. 73 e §1º (adicional de 20%; hora noturna de 52min30s entre 22h e 5h)', 'em_triagem', NULL),
    ('FOLHA-021', 'Insalubridade por grau e periculosidade de 30%: laudo manda, prevalência decide', 'alternativo', 'alta', 'aprovado', 'Os adicionais de risco nascem do LAUDO (SST): insalubridade em 10%, 20% ou 40% conforme o grau — sobre base parametrizada, já que mínimo × salário × piso da CCT é controvérsia viva [VAL] — e periculosidade em 30% sobre o salário-base. Quem faz jus aos dois não acumula: opta pelo mais favorável (§2º do art. 193), e o sistema deve calcular os dois e aplicar a prevalência.', 'Vínculo com laudo de insalubridade grau médio e outro com periculosidade; um terceiro com direito aos dois.', '[{"acao": "Calcular a folha do insalubre grau médio", "ordem": 1, "resultado_esperado": "20% sobre a base parametrizada, citando o laudo de origem"}, {"acao": "Calcular a folha do periculoso", "ordem": 2, "resultado_esperado": "30% sobre o salário-base"}, {"acao": "Vínculo com os dois direitos", "ordem": 3, "resultado_esperado": "Prevalece o mais favorável — nunca a soma"}]', 'O laudo define o direito; a prevalência escolhe o maior; a base é parâmetro.', 'Requisitos YE-DP-FOLHA-001: RN-004/RN-005 / CA-005 / fluxo "Insalubridade/periculosidade" (seção 9). O motor existe em src/lib/folha/adicionais.ts (com prevalência) — o caso confere o fim a fim com laudo do SST. Base da insalubridade é [VAL]/[RCC] (seção 30). Requisitos YE-DP-SST-001: o lado SST (documentos, periodicidade, OS/ficha, eSocial SST) está na família SST-001..080.', 'e2e', 'CLT, arts. 192 (10/20/40% por grau) e 193, §2º (30% sobre o salário-base; opção pelo mais favorável)', 'em_triagem', NULL),
    ('FOLHA-022', 'DSR: variáveis refletem no repouso; falta injustificada o derruba', 'feliz', 'alta', 'aprovado', 'O repouso semanal remunerado tem dois movimentos que a folha precisa dominar: quem tem variáveis (HE, comissões, adicional noturno) recebe o REFLEXO delas no DSR — média dos dias úteis aplicada aos repousos —, e quem falta sem justificativa na semana PERDE a remuneração do repouso daquela semana. Só o primeiro sem o segundo paga a mais; só o segundo sem o primeiro paga a menos.', 'Vínculo com horas extras habituais no mês e uma falta injustificada em uma das semanas.', '[{"acao": "Calcular o DSR do mês com variáveis", "ordem": 1, "resultado_esperado": "Reflexo das HE/variáveis nos repousos (variáveis ÷ dias úteis × domingos/feriados)"}, {"acao": "Conferir a semana da falta injustificada", "ordem": 2, "resultado_esperado": "DSR daquela semana descontado — perda pela falta (Lei 605, art. 6º)"}, {"acao": "Falta justificada por atestado", "ordem": 3, "resultado_esperado": "DSR preservado — justificada não derruba o repouso"}]', 'Variável reflete, injustificada derruba, justificada preserva.', 'Requisitos YE-DP-FOLHA-001: RN-006 / cenário "Adicionais" (seção 25). As faltas vêm do Ponto (família PONTO); aqui se testa o efeito no DSR da folha. calcularFolhaMensal já recebe dsr — conferir os dois sentidos. | Requisitos YE-DP-ESC-001 (RN-007/CA-011): segue dono do reflexo das variáveis no DSR (Súmula 172).', 'e2e', 'Lei 605/1949, arts. 6º e 7º (remuneração do repouso; perda pela falta injustificada); Súmula 172 do TST (reflexo das HE)', 'em_triagem', NULL),
    ('FOLHA-030', 'Descontos só nos limites do art. 462: VT até 6%, sindical só autorizado', 'negativo', 'critica', 'aprovado', 'Desconto em folha é exceção, não regra: só o previsto em lei, em instrumento coletivo ou adiantamento — e cada um com seu teto. O VT desconta no máximo 6% do salário-base; a contribuição sindical, desde a reforma, SÓ com autorização expressa do empregado. Lançamento de desconto fora dessas hipóteses tem que ser barrado na entrada, não descoberto na reclamatória.', 'Vínculo com salário conhecido; lançamentos de desconto de VT acima de 6% e de sindical sem autorização.', '[{"acao": "Lançar desconto de VT de 8% do salário", "ordem": 1, "resultado_esperado": "Recusado ou limitado a 6% — o excedente é custo da empresa"}, {"acao": "Lançar desconto sindical sem autorização registrada", "ordem": 2, "resultado_esperado": "Bloqueado — exige a autorização expressa (Lei 13.467)"}, {"acao": "Lançar desconto sem amparo (nem lei, nem CCT, nem adiantamento)", "ordem": 3, "resultado_esperado": "Bloqueado citando o art. 462"}]', 'Todo desconto tem amparo e teto — ou não entra na folha.', 'Requisitos YE-DP-FOLHA-001: RN-003 / CA-009 / cenário "Desconto" (seção 25). folha_lancamentos aceita qualquer DESCONTO hoje (tipo + valor livres) — as travas devem falhar e encaminhar. Tipos/limites parametrizados [DAE]/[RCC]. | Requisitos YE-DP-BEN-001: o limite de desconto na folha (art. 462; VT 6%) segue aqui; o motor de cálculo do benefício (menor entre 6% e custo) é o BEN-011.', 'api', 'CLT, art. 462; Lei 7.418/1985 (VT até 6% do salário-base); Lei 13.467/2017 (contribuição sindical facultativa)', 'em_triagem', NULL),
    ('FOLHA-040', 'Pagamento até o 5º dia útil, com alerta antes e atraso acusado', 'feliz', 'critica', 'aprovado', 'O 5º dia útil é prazo de contagem própria (sábado conta como útil para este fim, domingo e feriado não) e o motor de datas precisa calculá-lo por competência, alertar na aproximação (D-3/2/1) e ACUSAR o pagamento registrado depois dele — atraso salarial habitual é infração e fundamento para rescisão indireta.', 'Competência fechada com data de pagamento programada; calendário de feriados carregado.', '[{"acao": "Abrir a competência", "ordem": 1, "resultado_esperado": "5º dia útil calculado pelo calendário (sábado conta, domingo/feriado não)"}, {"acao": "Aproximar-se do prazo sem pagamento", "ordem": 2, "resultado_esperado": "Alertas D-3/2/1 a DP e Financeiro, prioridade crítica"}, {"acao": "Registrar pagamento após o 5º dia útil", "ordem": 3, "resultado_esperado": "Atraso acusado com trilha — nunca aceitação silenciosa"}]', 'O prazo se calcula sozinho, avisa antes e denuncia depois.', 'Requisitos YE-DP-FOLHA-001: RN-002 / CA-008 / alerta "Pagamento a vencer" (seção 14). DIVERGÊNCIA VISÍVEL: folha_alertas_prazo é semeada pela TELA com datas aproximadas (dia 7 fixo ≠ 5º dia útil) e nenhuma função calcula o dia útil real. Deve falhar e encaminhar.', 'api', 'CLT, art. 459, §1º (pagamento até o 5º dia útil do mês subsequente)', 'em_triagem', NULL),
    ('FOLHA-041', 'Holerite discrimina cada parcela e chega só ao próprio colaborador', 'feliz', 'alta', 'aprovado', 'O holerite é o recibo legal do pagamento: discrimina TODAS as parcelas — proventos, descontos, bases e encargos — batendo com a memória de cálculo, fica arquivado na pasta do colaborador e acessível SÓ a ele no portal (e aos papéis da folha). Holerite genérico não prova quitação; holerite vazado é incidente de LGPD.', 'Folha calculada e aprovada para a competência.', '[{"acao": "Gerar os holerites da competência", "ordem": 1, "resultado_esperado": "Cada parcela discriminada (rubrica, referência, valor), batendo com a memória"}, {"acao": "Colaborador acessa o portal", "ordem": 2, "resultado_esperado": "Vê e baixa SÓ o próprio holerite"}, {"acao": "Conferir o arquivamento", "ordem": 3, "resultado_esperado": "Holerite na pasta Funcionário › Folha › Holerites, com metadados"}]', 'Tudo discriminado, arquivado, e cada um enxerga só o seu.', 'Requisitos YE-DP-FOLHA-001: RN-002 / CA-008 / seção 16 / cenário "Permissões insuficientes" (seção 25). folha_itens guarda o cálculo por vínculo — conferir a geração do recibo e o recorte de acesso (par do DEC13-071 e DESL-110).', 'e2e', 'CLT, art. 464 (pagamento contra recibo com discriminação das parcelas); LGPD (acesso ao próprio dado)', 'em_triagem', NULL),
    ('FOLHA-050', 'Encargos patronais: 20% + RAT×FAP + terceiros, parametrizados por empresa', 'feliz', 'alta', 'aprovado', 'A folha não termina no líquido do colaborador: a empresa deve a patronal de 20%, o RAT ajustado pelo FAP (que muda por empresa e por ano) e os terceiros conforme o FPAS da atividade. Esses percentuais são PARÂMETROS por empresa/estabelecimento com vigência — sem eles não há guia da DCTFWeb correta nem provisão de custo confiável.', 'Empresa fictícia com RAT, FAP e FPAS parametrizados.', '[{"acao": "Calcular os encargos patronais da competência", "ordem": 1, "resultado_esperado": "20% + RAT×FAP + terceiros sobre as bases corretas, com memória"}, {"acao": "Alterar o FAP da empresa (novo ano)", "ordem": 2, "resultado_esperado": "Nova vigência de parâmetro; competências antigas preservam o FAP da época"}, {"acao": "Conferir o custo total no painel", "ordem": 3, "resultado_esperado": "Custo empregador = salários + encargos patronais, por estabelecimento"}]', 'O custo real da folha inclui o que o colaborador nunca vê.', 'Requisitos YE-DP-FOLHA-001: RN-007 / RNF-002. DIVERGÊNCIA VISÍVEL: não existe estrutura de encargos patronais (RAT/FAP/terceiros) no banco — só o INSS do empregado. Deve falhar e encaminhar. Requisitos YE-DP-SST-001: o lado SST (documentos, periodicidade, OS/ficha, eSocial SST) está na família SST-001..080.', 'api', 'Lei 8.212/1991, art. 22 (patronal de 20%); RAT (1/2/3%) × FAP (0,5-2,0); terceiros/Sistema S por FPAS', 'em_triagem', NULL),
    ('FOLHA-051', 'Regime tributário muda os encargos: Simples e desoneração como exceção', 'alternativo', 'media', 'aprovado', 'O encargo patronal depende do ENQUADRAMENTO: empresa do Simples (na maioria dos anexos) não recolhe a patronal sobre a folha; setor desonerado recolhe CPRB sobre a receita em vez da patronal. O regime é parâmetro por empresa/estabelecimento com vigência — aplicá-lo errado gera ou encargo indevido (custo fantasma) ou guia a menor (autuação).', 'Empresas fictícias em regimes distintos (Lucro Real, Simples, desonerada).', '[{"acao": "Calcular a folha da empresa do Simples", "ordem": 1, "resultado_esperado": "Sem patronal de 20% sobre a folha (conforme o anexo parametrizado)"}, {"acao": "Calcular a folha da empresa desonerada", "ordem": 2, "resultado_esperado": "CPRB sinalizada no lugar da patronal; folha marca a exceção"}, {"acao": "Mudar o regime no meio do ano", "ordem": 3, "resultado_esperado": "Nova vigência; competências passadas mantêm o regime da época"}]', 'O regime da empresa decide o encargo — e fica registrado por vigência.', 'Requisitos YE-DP-FOLHA-001: RN-009 / RNF-010 / cenário "Regime" (seção 25). Enquadramento é [RCE]/[VAL] (seção 30). Depende do FOLHA-050 (estrutura de encargos patronais).', 'api', 'LC 123/2006 (Simples Nacional — anexos sem patronal sobre a folha); Lei 12.546/2011 (CPRB — desoneração)', 'em_triagem', NULL),
    ('FOLHA-060', 'Fechamento: S-1200 e S-1210 por vínculo e S-1299 até o dia 15', 'feliz', 'critica', 'aprovado', 'A competência aprovada vira eventos: S-1200 por vínculo (remuneração por rubrica), S-1210 dos pagamentos e o S-1299 que FECHA os periódicos — em regra até o dia 15 do mês seguinte — e libera a apuração na DCTFWeb. Sem o fechamento, as guias não nascem; fechamento fora do prazo é multa. O motor de prazos vigia o dia 15 com alertas D-5/3/1.', 'Competência aprovada no ambiente de teste.', '[{"acao": "Fechar a competência", "ordem": 1, "resultado_esperado": "S-1200 por vínculo e S-1210 gerados, conciliados com folha_itens"}, {"acao": "Transmitir o S-1299", "ordem": 2, "resultado_esperado": "Fechamento no prazo (até o dia 15), com recibo arquivado"}, {"acao": "Aproximar-se do dia 15 sem fechar", "ordem": 3, "resultado_esperado": "Alertas D-5/3/1 a DP e Contador, prioridade crítica"}]', 'Folha aprovada vira evento; evento fechado vira guia; o dia 15 é vigiado.', 'Requisitos YE-DP-FOLHA-001: RN-010 / CA-007 / alerta "Fechamento do eSocial" (seção 14). folha_alertas_prazo já tem os tipos esocial_s1200/s1210 (semeados pela tela); a GERAÇÃO dos eventos não existe. A anti-duplicidade da fila é a série ADM-093/DESL-094. Deve falhar e encaminhar.', 'api', 'eSocial — S-1200 (remuneração), S-1210 (pagamentos), S-1299 (fechamento dos periódicos, em regra até o dia 15 do mês seguinte)', 'em_triagem', NULL),
    ('FOLHA-061', 'Guias das obrigações: DARF pela DCTFWeb e FGTS pelo FGTS Digital', 'alternativo', 'alta', 'aprovado', 'Fechado o eSocial, as guias têm caminhos próprios: a DCTFWeb consolida INSS/IRRF e gera o DARF; o FGTS Digital gera a guia dos 8% sobre a remuneração. As bases precisam BATER com a folha fechada (conciliação), os vencimentos são vigiados e os comprovantes ficam no dossiê da competência — guia paga sem conciliação é conferência que sobrou para a fiscalização fazer.', 'Competência fechada com S-1299 aceito (simulado).', '[{"acao": "Gerar o DARF da competência", "ordem": 1, "resultado_esperado": "Valores conciliados com os encargos da folha fechada; divergência acusada"}, {"acao": "Gerar a guia do FGTS Digital", "ordem": 2, "resultado_esperado": "8% sobre a base de FGTS da folha, por vínculo/estabelecimento"}, {"acao": "Anexar os comprovantes", "ordem": 3, "resultado_esperado": "Arquivados em Processo › Folha, vinculados à competência"}]', 'Guia nasce da folha fechada e volta conciliada para o dossiê.', 'Requisitos YE-DP-FOLHA-001: RN-010 / CA-006/CA-007 / RF-008. O hub_guias registra guias digitadas à mão (achado do DESL-057) — a GERAÇÃO conciliada não existe. O calendário de envios do escritório é a família HCAL (Hub).', 'api', 'DCTFWeb (consolidação das contribuições a partir do eSocial; DARF); Lei 8.036/1990 e FGTS Digital (guia mensal de 8%)', 'em_triagem', NULL),
    ('FOLHA-070', 'Dissídio retroativo gera folha complementar com retificação do eSocial', 'alternativo', 'media', 'aprovado', 'Reajuste retroativo de convenção não reabre as folhas pagas: gera folha COMPLEMENTAR — competência própria com as diferenças por vínculo, encargos sobre as diferenças e S-1200 retificado/complementar —, mantendo as originais intactas. Sem a estrutura, o retroativo ou é ignorado (passivo) ou é editado por cima do fechado (trilha destruída).', 'Competências fechadas; reajuste retroativo de 5% publicado para a categoria.', '[{"acao": "Registrar o reajuste retroativo", "ordem": 1, "resultado_esperado": "Diferenças apuradas por vínculo/competência atingida, com memória própria"}, {"acao": "Processar a complementar", "ordem": 2, "resultado_esperado": "Folha complementar vinculada às originais — que permanecem intactas"}, {"acao": "Refletir no eSocial", "ordem": 3, "resultado_esperado": "S-1200 retificado/complementar por competência, sem duplicar eventos"}]', 'O retroativo ganha folha própria; as originais ficam na história.', 'Requisitos YE-DP-FOLHA-001: RF-010 / CA-010 / cenário "Complementar" (seção 25). Par do DESL-105 (rescisão complementar) e DEC13-033 (complemento do 13º). folha_periodos tem UNIQUE(tenant, competencia) — a complementar precisa de desenho próprio, não de burlar a unicidade.', 'api', 'CCT/ACT (reajuste retroativo); eSocial — S-1200 complementar/retificação', 'em_triagem', NULL),
    ('FOLHA-071', 'Competência fechada só reabre com dupla aprovação e recálculo rastreado', 'excecao', 'alta', 'aprovado', 'O fechamento é um marco: depois dele, lançamentos, itens e totais da competência ficam imutáveis. Corrigir exige REABRIR com motivo, dupla aprovação e trilha — recalculando, apurando diferenças e retificando o eSocial. Se um UPDATE direto em folha fechada passa, o holerite entregue, o evento transmitido e o banco contam três histórias diferentes.', 'Competência com status fechado e itens calculados no ambiente de teste.', '[{"acao": "Tentar lançar/alterar valores numa competência FECHADA", "ordem": 1, "resultado_esperado": "Bloqueado — fechado é imutável"}, {"acao": "Reabrir com motivo e dupla aprovação", "ordem": 2, "resultado_esperado": "Reabertura registrada (quem, quando, por quê); recálculo liberado"}, {"acao": "Fechar de novo após a correção", "ordem": 3, "resultado_esperado": "Diferenças apuradas e eSocial retificado; versões preservadas"}]', 'Fechado não se edita: reabre com rito ou permanece.', 'Requisitos YE-DP-FOLHA-001: RF-010 / fluxo "Reabertura" (seção 9). folha_periodos tem o status e o ciclo — falta a TRAVA (nada impede UPDATE em lançamentos/itens de competência fechada). Mesma disciplina de FERIAS-054, DEC13-070 e DESL-106.', 'api', 'Documento YE-DP-FOLHA-001, RF-010; RNF-004 (log imutável)', 'em_triagem', NULL),
    ('FOLHA-080', 'Abertura da competência concilia Ponto, Férias, 13º e Afastamentos', 'feliz', 'alta', 'aprovado', 'A folha é o destino dos outros módulos: horas e faltas do Ponto, férias do mês, parcela de 13º, afastamentos (15 primeiros dias de auxílio-doença pela empresa) e verbas de rescisão entram por IMPORTAÇÃO conciliada — cada evento com origem rastreável — e divergência entre o apurado lá e o lançado aqui é apontada ANTES do fechamento, não descoberta no holerite errado.', 'Competência aberta com eventos apurados nos módulos de origem (Ponto fechado, férias gozadas, afastamento no mês).', '[{"acao": "Importar os eventos da competência", "ordem": 1, "resultado_esperado": "Horas, faltas, férias, 13º e afastamentos entram com a origem identificada"}, {"acao": "Simular divergência (hora extra apurada no Ponto ausente da folha)", "ordem": 2, "resultado_esperado": "Conciliação aponta a diferença antes do fechamento"}, {"acao": "Afastamento por auxílio-doença no mês", "ordem": 3, "resultado_esperado": "15 primeiros dias pela empresa; restante sinalizado como INSS"}]', 'Tudo que os módulos apuraram chega conciliado — ou a diferença aparece.', 'Requisitos YE-DP-FOLHA-001: RF-002 / alerta "Divergência" (seção 14) / cenário "Afastamento" (seção 25). DIVERGÊNCIA VISÍVEL: ponto_exportacoes_folha existe para o Ponto, mas não há conciliação automática nem importação dos demais módulos — lançamento é manual. Deve falhar e encaminhar. Requisitos YE-DP-AFAST-001: o lado AFASTAMENTOS (registro, efeito e reflexo) está em AFAST-010..080.', 'api', 'Documento YE-DP-FOLHA-001, RF-002; CLT (fidelidade da remuneração ao trabalho prestado)', 'em_triagem', NULL),
    ('FOLHA-081', 'Variação atípica da folha é destacada antes do fechamento', 'alternativo', 'media', 'aprovado', 'Salto de custo entre competências — rubrica que dobrou, colaborador com líquido fora do padrão, encargo destoante — é quase sempre erro de lançamento, e a hora de pegá-lo é ANTES do fechamento, comparando a competência com o histórico. Fechou errado, o custo de corrigir multiplica: reabertura, retificação de eSocial, complementar.', 'Histórico de competências fechadas; competência atual com lançamento destoante proposital.', '[{"acao": "Processar a competência com o valor destoante", "ordem": 1, "resultado_esperado": "Variação destacada na conferência (rubrica/vínculo apontados, comparativo com o histórico)"}, {"acao": "Corrigir e reprocessar", "ordem": 2, "resultado_esperado": "Conferência limpa; fechamento liberado"}]', 'A surpresa aparece na conferência — nunca no holerite.', 'Requisitos YE-DP-FOLHA-001: RF-009 / alerta "Variação atípica" (seção 14) / ideia "Folha sem surpresa" (seção 29). [BPR] — sem base legal própria; é prevenção. folha_historico existe como matéria-prima do comparativo.', 'api', 'Documento YE-DP-FOLHA-001, seções 14, 18 e 29 ("folha sem surpresa") [BPR]', 'em_triagem', NULL),
    ('FOLHA-090', 'Dados da folha restritos por perfil e camada de módulo', 'negativo', 'alta', 'aprovado', 'A folha concentra a remuneração de toda a empresa. A matriz do documento restringe por papel (DP/RH/contador operam; financeiro vê; gestor só custos da equipe; colaborador NADA além do próprio holerite) e a camada de acesso por perfil (perfil_permite_modulo + políticas RESTRICTIVE) precisa cobrir as tabelas da folha — itens, lançamentos e memórias são tão sensíveis quanto as 20 tabelas já protegidas.', 'Usuários fictícios de perfis distintos no tenant de teste; folha calculada.', '[{"acao": "Colaborador comum tenta ler folha_itens de colegas", "ordem": 1, "resultado_esperado": "Bloqueado — só papéis da folha (a política atual exige manager+)"}, {"acao": "Perfil sem o módulo financeiro habilitado tenta ler a folha", "ordem": 2, "resultado_esperado": "Bloqueado pela camada RESTRICTIVE de perfil (ou exceção documentada na PERFIL-003)"}, {"acao": "Usuário de outro tenant", "ordem": 3, "resultado_esperado": "Bloqueado — segregação multitenant"}]', 'Papel certo, módulo certo, tenant certo — ou a folha não se abre.', 'Requisitos YE-DP-FOLHA-001: seções 6 e 22 / RNF-005. PONTO BOM: folha_periodos/itens/lancamentos já exigem manager+ (melhor que folha_13_calculo e folha_rescisoes — DEC13-071/DESL-110). O que se confere é a camada de PERFIL por módulo, além do papel.', 'api', 'LGPD (Lei 13.709/2018), arts. 6º, VII e 46; matriz de perfis do documento (seção 6)', 'em_triagem', NULL)
) AS d(codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
CROSS JOIN public.qa_modulos m
WHERE m.path = 'financeiro/folha-pagamento'
ON CONFLICT (codigo) DO UPDATE SET
      titulo = EXCLUDED.titulo,
      tipo = EXCLUDED.tipo,
      prioridade = EXCLUDED.prioridade,
      status = EXCLUDED.status,
      objetivo = EXCLUDED.objetivo,
      pre_condicoes = EXCLUDED.pre_condicoes,
      passos = EXCLUDED.passos,
      resultado_esperado = EXCLUDED.resultado_esperado,
      observacoes = EXCLUDED.observacoes,
      nivel = EXCLUDED.nivel,
      base_legal = EXCLUDED.base_legal,
      modulo_id = EXCLUDED.modulo_id,
      disposicao = CASE WHEN qa_casos_teste.disposicao = 'em_triagem' THEN EXCLUDED.disposicao ELSE qa_casos_teste.disposicao END,
      disposicao_motivo = CASE WHEN qa_casos_teste.disposicao = 'em_triagem' THEN EXCLUDED.disposicao_motivo ELSE qa_casos_teste.disposicao_motivo END,
      updated_at = now();


-- (3) PONTES — 32 ligacoes caso -> rotina.

INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo)
SELECT d.codigo::text, d.funcao_sql::text, d.ativo::boolean
FROM (VALUES
    ('PORTE-005', 'qa_caso_porte_005', true),
    ('REGRA-001', 'qa_caso_regra_001', true),
    ('REGRA-002', 'qa_caso_regra_002', true),
    ('REGRA-003', 'qa_caso_regra_003', true),
    ('REGRA-004', 'qa_caso_regra_004', true),
    ('REGRA-005', 'qa_caso_regra_005', true),
    ('REGRA-006', 'qa_caso_regra_006', true),
    ('REGRA-010', 'qa_caso_regra_010', true),
    ('REGRA-011', 'qa_caso_regra_011', true),
    ('TAC-001', 'qa_caso_tac_001', true),
    ('TAC-003', 'qa_caso_tac_003', true),
    ('EST-001', 'qa_caso_est_001', true),
    ('EST-002', 'qa_caso_est_002', true),
    ('EST-003', 'qa_caso_est_003', true),
    ('EST-010', 'qa_caso_est_010', true),
    ('EST-011', 'qa_caso_est_011', true),
    ('EST-013', 'qa_caso_est_013', true),
    ('EST-020', 'qa_caso_est_020', true),
    ('EST-022', 'qa_caso_est_022', true),
    ('FOLHA-001', 'qa_caso_folha_001', true),
    ('FOLHA-002', 'qa_caso_folha_002', true),
    ('FOLHA-030', 'qa_caso_folha_030', true),
    ('FOLHA-040', 'qa_caso_folha_040', true),
    ('FOLHA-050', 'qa_caso_folha_050', true),
    ('FOLHA-051', 'qa_caso_folha_051', true),
    ('FOLHA-060', 'qa_caso_folha_060', true),
    ('FOLHA-061', 'qa_caso_folha_061', true),
    ('FOLHA-070', 'qa_caso_folha_070', true),
    ('FOLHA-071', 'qa_caso_folha_071', true),
    ('FOLHA-080', 'qa_caso_folha_080', true),
    ('FOLHA-081', 'qa_caso_folha_081', true),
    ('FOLHA-090', 'qa_caso_folha_090', true)
) AS d(codigo, funcao_sql, ativo)
WHERE to_regprocedure('public.' || d.funcao_sql || '()') IS NOT NULL
ON CONFLICT (codigo) DO UPDATE SET
      funcao_sql = EXCLUDED.funcao_sql, ativo = EXCLUDED.ativo;


-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: esperados = casos_no_alvo = 54, ponte_orfa = 0, OK
--   (com_rotina pode ser menor: caso de tela (e2e) nao tem rotina no motor.)
-- ---------------------------------------------------------------------------
WITH alvo(codigo) AS (VALUES ('EST-001'), ('EST-002'), ('EST-003'), ('EST-010'), ('EST-011'), ('EST-013'), ('EST-020'), ('EST-022'), ('FOLHA-001'), ('FOLHA-002'), ('FOLHA-010'), ('FOLHA-011'), ('FOLHA-020'), ('FOLHA-021'), ('FOLHA-022'), ('FOLHA-030'), ('FOLHA-040'), ('FOLHA-041'), ('FOLHA-050'), ('FOLHA-051'), ('FOLHA-060'), ('FOLHA-061'), ('FOLHA-070'), ('FOLHA-071'), ('FOLHA-080'), ('FOLHA-081'), ('FOLHA-090'), ('PORTE-001'), ('PORTE-002'), ('PORTE-003'), ('PORTE-004'), ('PORTE-005'), ('RASC-001'), ('RASC-002'), ('RASC-003'), ('RASC-004'), ('REGRA-001'), ('REGRA-002'), ('REGRA-003'), ('REGRA-004'), ('REGRA-005'), ('REGRA-006'), ('REGRA-007'), ('REGRA-008'), ('REGRA-009'), ('REGRA-010'), ('REGRA-011'), ('REGRA-012'), ('REGRA-013'), ('REGRA-014'), ('TAC-001'), ('TAC-002'), ('TAC-003'), ('TAC-004')),
x AS MATERIALIZED (
  SELECT
    (SELECT count(*) FROM alvo) AS esperados,
    (SELECT count(*) FROM alvo a JOIN public.qa_casos_teste c ON c.codigo = a.codigo) AS casos_no_alvo,
    (SELECT count(*) FROM alvo a
       JOIN public.qa_casos_teste c ON c.codigo = a.codigo
       JOIN public.qa_implementacoes i ON i.codigo = c.codigo AND i.ativo
      WHERE to_regprocedure('public.' || i.funcao_sql || '()') IS NOT NULL) AS com_rotina,
    (SELECT count(*) FROM alvo a
       JOIN public.qa_implementacoes i ON i.codigo = a.codigo AND i.ativo
      WHERE to_regprocedure('public.' || i.funcao_sql || '()') IS NULL) AS ponte_orfa
)
SELECT esperados, casos_no_alvo, com_rotina, ponte_orfa,
       CASE WHEN casos_no_alvo = esperados AND ponte_orfa = 0
            THEN 'OK' ELSE 'CONFERIR' END AS erro_tecnico
FROM x;
