-- ============================================================================
-- ENTREGA — BANCADA DE QA NA PRODUCAO — parte 5 de 15
-- Desligamento e Documentos
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

-- (1) ROTINAS — 35 funcoes de teste.

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_desl_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_adm uuid; v_status text; v_data date; v_motivo text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Cadastrar admissao concluida e ativa';
  INSERT INTO public.admissoes
    (tenant_id, nome_completo, cpf, email, cargo, status, data_admissao)
  VALUES (v_t, '[QA-DESL-001] Colaborador', public.qa_cpf(100001),
          'qa.desl001@sandbox.invalid', 'Operador', 'concluido', CURRENT_DATE - 800)
  RETURNING id INTO v_adm;

  r.passo_ordem := 2;
  r.passo_acao  := 'Registrar desligamento com dados validos';
  r.esperado    := 'Persistido, com status desligado';
  UPDATE public.admissoes SET
    status = 'desligado',
    data_desligamento = CURRENT_DATE,
    motivo_desligamento = 'sem_justa_causa',
    dias_aviso_previo = 36,
    tipo_aviso_previo = 'indenizado',
    multa_fgts = true,
    seguro_desemprego_elegivel = true
  WHERE id = v_adm;

  r.passo_ordem := 3;
  r.passo_acao  := 'Reler o registro';
  SELECT status::text, data_desligamento, motivo_desligamento
    INTO v_status, v_data, v_motivo
  FROM public.admissoes WHERE id = v_adm;

  IF v_status = 'desligado' AND v_data = CURRENT_DATE AND v_motivo = 'sem_justa_causa' THEN
    r.situacao := 'passou';
    r.obtido   := 'Desligamento gravado e status atualizado corretamente.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('Releitura divergente: status=%s, data=%s, motivo=%s.',
                          v_status, v_data, v_motivo);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_desl_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_desl_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_desl_002()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_adm uuid; v_aceitou boolean := false;
  v_motivo_final text; v_data_final date;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Cadastrar admissao e registrar o primeiro desligamento';
  INSERT INTO public.admissoes
    (tenant_id, nome_completo, cpf, email, cargo, status, data_admissao)
  VALUES (v_t, '[QA-DESL-002] Colaborador', public.qa_cpf(100002),
          'qa.desl002@sandbox.invalid', 'Operador', 'concluido', CURRENT_DATE - 900)
  RETURNING id INTO v_adm;

  UPDATE public.admissoes SET
    status = 'desligado', data_desligamento = CURRENT_DATE - 30,
    motivo_desligamento = 'pedido_demissao'
  WHERE id = v_adm;

  r.passo_ordem := 2;
  r.passo_acao  := 'Tentar registrar um SEGUNDO desligamento, com outro motivo e outra data';
  r.esperado    := 'Recusado — o contrato ja esta extinto';
  BEGIN
    UPDATE public.admissoes SET
      data_desligamento = CURRENT_DATE,
      motivo_desligamento = 'sem_justa_causa'
    WHERE id = v_adm;
    v_aceitou := true;
  EXCEPTION WHEN OTHERS THEN v_aceitou := false;
  END;

  r.passo_ordem := 3;
  r.passo_acao  := 'Conferir se o desligamento original sobreviveu';
  SELECT motivo_desligamento, data_desligamento INTO v_motivo_final, v_data_final
  FROM public.admissoes WHERE id = v_adm;

  IF NOT v_aceitou THEN
    r.situacao := 'passou';
    r.obtido   := 'Segundo desligamento recusado pelo banco.';
  ELSIF v_motivo_final = 'pedido_demissao' THEN
    r.situacao := 'falhou';
    r.obtido   := 'A segunda gravacao foi aceita, ainda que o motivo original tenha '
               || 'permanecido. Nao ha trava de duplicidade no banco.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('ACEITOU E SOBRESCREVEU. O desligamento original (pedido_demissao '
               || 'em %s) foi substituido por %s em %s, sem trilha. Como o desligamento e '
               || 'um UPDATE na propria linha de admissoes e nao um evento, a segunda '
               || 'gravacao APAGA a primeira: motivo, data, verbas e ASO do desligamento '
               || 'original deixam de existir. Nao ha como auditar o que foi alterado, '
               || 'nem por quem. Correcao sugerida: indice unico parcial impedindo '
               || 'reescrita de admissao ja desligada, e tabela de eventos de '
               || 'desligamento com historico, em vez de colunas na admissao.',
               (CURRENT_DATE - 30), v_motivo_final, v_data_final);
    r.detalhe  := jsonb_build_object('motivo_original','pedido_demissao',
                                     'motivo_apos_segunda_gravacao', v_motivo_final,
                                     'historico_preservado', false);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_desl_002()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_desl_002 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_desl_003()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_adm uuid; v_cpf text := public.qa_cpf(100003); v_aceitou boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Cadastrar colaborador com afastamento ATIVO e sem data de retorno';
  INSERT INTO public.admissoes
    (tenant_id, nome_completo, cpf, email, cargo, status, data_admissao)
  VALUES (v_t, '[QA-DESL-003] Colaborador', v_cpf,
          'qa.desl003@sandbox.invalid', 'Operador', 'concluido', CURRENT_DATE - 1000)
  RETURNING id INTO v_adm;

  INSERT INTO public.afastamentos
    (tenant_id, colaborador_nome, colaborador_cpf, data_inicio, data_fim, status)
  VALUES (v_t, '[QA-DESL-003] Colaborador', v_cpf, CURRENT_DATE - 60, NULL, 'ativo');

  r.passo_ordem := 2;
  r.passo_acao  := 'Tentar dispensa sem justa causa com o contrato suspenso';
  r.esperado    := 'Recusado — CLT art. 476: durante o auxilio-doenca o contrato esta suspenso';
  BEGIN
    UPDATE public.admissoes SET
      status = 'desligado', data_desligamento = CURRENT_DATE,
      motivo_desligamento = 'sem_justa_causa'
    WHERE id = v_adm;
    v_aceitou := true;
  EXCEPTION WHEN OTHERS THEN v_aceitou := false;
  END;

  IF v_aceitou THEN
    r.situacao := 'falhou';
    r.obtido   := 'ACEITOU dispensa imotivada com afastamento ativo e sem retorno formal. '
               || 'O contrato suspenso (CLT art. 476) nao admite dispensa imotivada — o '
               || 'ato e ineficaz e a discussao vira reintegracao. A tela consulta '
               || 'afastamentos, mas o banco nao impede a gravacao por nenhuma outra rota. '
               || 'Correcao sugerida: trigger que recuse desligamento imotivado havendo '
               || 'afastamento ativo, liberando falecimento e termino de contrato a termo.';
  ELSE
    r.situacao := 'passou';
    r.obtido   := 'Recusado pelo banco. A suspensao do contrato e respeitada na escrita.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_desl_003()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_desl_003 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_desl_004()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_adm uuid; v_aceitou boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Cadastrar admissao com inicio no futuro';
  INSERT INTO public.admissoes
    (tenant_id, nome_completo, cpf, email, cargo, status, data_admissao)
  VALUES (v_t, '[QA-DESL-004] Colaborador', public.qa_cpf(100004),
          'qa.desl004@sandbox.invalid', 'Operador', 'concluido', CURRENT_DATE + 30)
  RETURNING id INTO v_adm;

  r.passo_ordem := 2;
  r.passo_acao  := 'Tentar desligar hoje, antes do inicio do contrato';
  r.esperado    := 'Recusado — sem prestacao iniciada nao ha contrato em curso';
  BEGIN
    UPDATE public.admissoes SET
      status = 'desligado', data_desligamento = CURRENT_DATE,
      motivo_desligamento = 'sem_justa_causa'
    WHERE id = v_adm;
    v_aceitou := true;
  EXCEPTION WHEN OTHERS THEN v_aceitou := false;
  END;

  IF v_aceitou THEN
    r.situacao := 'falhou';
    r.obtido   := 'ACEITOU desligamento com data anterior a propria admissao — contrato '
               || 'com duracao negativa. Nada no banco impede. A validacao existe apenas '
               || 'na tela (RNDES02). Correcao sugerida: CHECK garantindo '
               || 'data_desligamento >= data_admissao. Para desistencia antes do inicio o '
               || 'evento correto e cancelamento de admissao, nao desligamento — sao '
               || 'eventos distintos no eSocial.';
  ELSE
    r.situacao := 'passou';
    r.obtido   := 'Recusado pelo banco.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_desl_004()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_desl_004 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_desl_006()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_adm uuid; v_alheio uuid; v_gravou boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Localizar um usuario de OUTRO tenant';
  SELECT id INTO v_alheio FROM public.usuarios_base
  WHERE tenant_id IS DISTINCT FROM v_t LIMIT 1;

  IF v_alheio IS NULL THEN
    r.situacao := 'nao_implementado';
    r.obtido   := 'Nao existe usuario fora do cercado nesta base — o isolamento entre '
               || 'clientes nao pode ser exercitado aqui.';
    RETURN r;
  END IF;

  r.passo_ordem := 2;
  r.passo_acao  := 'Cadastrar admissao no cercado e desliga-la atribuindo a autoria ao usuario alheio';
  r.esperado    := 'Recusado — a autoria do desligamento nao atravessa a fronteira do cliente';
  INSERT INTO public.admissoes
    (tenant_id, nome_completo, cpf, email, cargo, status, data_admissao)
  VALUES (v_t, '[QA-DESL-006] Colaborador', public.qa_cpf(100006),
          'qa.desl006@sandbox.invalid', 'Operador', 'concluido', CURRENT_DATE - 500)
  RETURNING id INTO v_adm;

  BEGIN
    UPDATE public.admissoes SET
      status = 'desligado', data_desligamento = CURRENT_DATE,
      motivo_desligamento = 'sem_justa_causa', desligado_por = v_alheio
    WHERE id = v_adm;
    v_gravou := EXISTS (SELECT 1 FROM public.admissoes
                        WHERE id = v_adm AND desligado_por = v_alheio);
  EXCEPTION WHEN OTHERS THEN v_gravou := false;
  END;

  IF v_gravou THEN
    r.situacao := 'falhou';
    r.obtido   := 'ACEITOU registrar como autor do desligamento um usuario de OUTRO '
               || 'cliente. desligado_por nao valida tenant. A RLS protege a leitura, mas '
               || 'a escrita cruza a fronteira — mesma classe do gap HIER-006 no modulo '
               || 'Empresa. Desligamento e dado pessoal e a autoria compoe a trilha de '
               || 'auditoria: autoria errada compromete a prova. Correcao sugerida: '
               || 'trigger validando que desligado_por pertence ao mesmo tenant da admissao.';
    r.detalhe  := jsonb_build_object('admissao_no_cercado', v_adm, 'autor_de_outro_tenant', v_alheio);
  ELSE
    r.situacao := 'passou';
    r.obtido   := 'Recusado. A autoria respeita a fronteira entre clientes.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_desl_006()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_desl_006 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_desl_013()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_tem_estado boolean; v_col text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe o estado "desligamento programado" (data futura)?';
  r.esperado := 'Aviso prévio trabalhado projeta o término para o futuro — registro ≠ efetivação';
  SELECT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'admissao_status' AND e.enumlabel ILIKE '%program%'
  ) INTO v_tem_estado;
  v_col := public.qa_col_existe('admissoes', '%data_deslig%');

  IF NOT v_tem_estado THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: não existe o estado intermediário "desligamento programado" — o '
             || 'vínculo vai direto de ativo para desligado%s. No aviso prévio trabalhado, o '
             || 'contrato segue vivo por até 30 dias após o registro: o colaborador ainda '
             || 'marca ponto, acumula férias e só na DATA é efetivado. Sem o estado, ou se '
             || 'desliga antecipado (corta acesso de quem ainda trabalha) ou se registra '
             || 'depois (perde o aviso). Correção: estado programado com data futura e '
             || 'efetivação automática na data.',
             CASE WHEN v_col IS NULL THEN ' e nem data de desligamento futura há onde guardar' ELSE '' END);
  ELSE
    r.situacao := 'passou';
    r.obtido := 'O estado de desligamento programado existe.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_desl_013()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_desl_013 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_desl_015()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_pgto text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o pagamento das verbas é registrado e conferido contra o prazo?';
  r.esperado := 'Data de pagamento gravada; atraso além do 10º dia acusa a multa do §8º; dia não útil antecipa a data-alvo';
  v_pgto := coalesce(public.qa_col_existe('folha_rescisoes', '%data_pagamento%'),
                     public.qa_col_existe('folha_rescisoes', '%pago_em%'),
                     public.qa_col_existe('admissoes', '%pagamento_rescis%'));
  -- só conta função que fale do PRAZO/MULTA da rescisão em si — "desligamento
  -- + prazo" solto pega o prazo do EXAME demissional (exame_demissional_pendencias)
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.proname NOT ILIKE '%exame%' AND p.proname NOT ILIKE '%demissional%'
    AND (p.prosrc ILIKE '%477%'
         OR (p.prosrc ILIKE '%rescis%' AND p.prosrc ILIKE '%multa%')
         OR (p.prosrc ILIKE '%data_pagamento%' AND p.prosrc ILIKE '%desligamento%'));

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO (metade boa, metade ausente): folha_rescisoes registra a data '
             || 'de pagamento (%s) — a matéria-prima existe —, mas NINGUÉM a confere contra '
             || 'o limite do art. 477: nenhuma função compara pagamento × (término + 10 '
             || 'dias), acusa o atraso ou projeta a multa do §8º (um salário ao empregado). '
             || 'O DESL-014 já provou que a data-limite aparece na tela (regra RNDES24, no '
             || 'React); do lado do banco, pagamento no 11º dia entra igual ao do 5º e o '
             || 'painel "rescisão no prazo" (seção 29) segue sem fonte. Também não há motor '
             || 'de antecipação por dia não útil (mesmo vazio do DEC13-031). Correção: '
             || 'conferência pagamento × limite (com antecipação via tabela feriados) + '
             || 'multa projetada e alerta no atraso.',
             coalesce(v_pgto, 'campo de data de pagamento AUSENTE'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Controle presente (campo: %s; funções: %s).',
                       coalesce(v_pgto, '—'), v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_desl_015()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_desl_015 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_desl_025()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_adm uuid; v_aceitou boolean := false; v_col text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Desligar por JUSTA CAUSA direto no banco, sem validação jurídica nenhuma';
  r.esperado := 'Retido — o enquadramento do art. 482 exige aprovação de perfil competente com evidências';
  INSERT INTO public.admissoes
    (tenant_id, nome_completo, cpf, email, cargo, status, data_admissao)
  VALUES (v_t, '[QA-DESL-025] Colaborador', public.qa_cpf(8025),
          'qa.desl025@sandbox.invalid', 'Operador', 'concluido', CURRENT_DATE - 700)
  RETURNING id INTO v_adm;
  BEGIN
    UPDATE public.admissoes SET
      status = 'desligado', data_desligamento = CURRENT_DATE,
      motivo_desligamento = 'com_justa_causa'
    WHERE id = v_adm;
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_aceitou := false; END;

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA: existe onde registrar a validação (quem aprovou o enquadramento)?';
  r.esperado := 'Campo/fluxo de aprovação jurídica com evidências e trilha';
  v_col := coalesce(public.qa_col_existe('admissoes', '%validacao%'),
                    public.qa_col_existe('admissoes', '%aprovad%'),
                    public.qa_col_existe('admissoes', '%juridic%'));

  IF v_aceitou AND v_col IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a justa causa entrou SEM RITO — o banco aceitou o desligamento pelo '
             || 'art. 482 sem validação de ninguém, e não existe campo para registrar quem '
             || 'aprovou o enquadramento nem as evidências que o sustentam. Justa causa é a '
             || 'modalidade que mais reverte em juízo: revertida, vira dispensa sem justa '
             || 'causa com todas as verbas (aviso, multa de 40%, seguro-desemprego) devidas '
             || 'de uma vez. A matriz do documento (seção 6) reserva a validação ao jurídico. '
             || 'Correção: transição para justa causa/indireta condicionada a registro de '
             || 'validação (validador + data + evidências), no mesmo desenho da dupla '
             || 'aprovação já pedida para reabertura.';
  ELSIF NOT v_aceitou THEN
    r.situacao := 'passou';
    r.obtido := 'A justa causa sem validação foi retida na gravação.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Aceita com campo de validação disponível (%s) — conferir a '
                       || 'obrigatoriedade no fluxo.', v_col);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_desl_025()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_desl_025 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_desl_057()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_tab text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a guia rescisória do FGTS Digital tem estrutura?';
  r.esperado := 'Guia com base, percentual da modalidade e prazo; fila de reprocessamento na indisponibilidade';
  -- estrutura ESPECÍFICA de FGTS: hub_guias (Hub Contábil) é guia genérica
  -- digitada à mão (tipo texto livre) — não é geração de guia rescisória
  SELECT string_agg(table_name, ', ') INTO v_tab
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name ILIKE '%fgts%';
  v_fns := public.qa_fns_com('%fgts%');

  IF v_tab IS NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o FGTS Digital não existe no banco — nenhuma tabela ou função '
             || 'específica de FGTS. A multa (40%/20%) é calculada no React '
             || '(calcularRescisao) e gravada como número em folha_rescisoes; o que existe '
             || 'de "guia" é o hub_guias do Hub Contábil, registro GENÉRICO digitado à mão '
             || '(tipo em texto livre, valor e vencimento manuais) — serve para anotar que '
             || 'a guia existe, não para GERÁ-LA com base, percentual da modalidade e prazo '
             || 'do FGTS rescisório. E não há fila de contingência para indisponibilidade '
             || 'do serviço (RNF-008): da apuração ao recolhimento, o caminho vive no '
             || 'navegador do DP. Correção: estrutura própria da guia rescisória (base, '
             || 'percentual, prazo, status, comprovante) alimentada pela rescisão + fila de '
             || 'reprocessamento, no desenho da transmissão do eSocial. Fluxo vigente do '
             || 'FGTS Digital é [VAL] (seção 30).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Estrutura específica de FGTS presente (tabelas: %s; funções: %s).',
                       coalesce(v_tab, '—'), coalesce(v_fns, '—'));
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_desl_057()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_desl_057 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_desl_065()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_desligados int; v_sem_exame int; v_fora_prazo int; v_dispensados int;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'AUDITORIA (somente leitura): cumprimento do prazo de 10 dias da NR-07';
  r.esperado    := 'Todo desligamento tem exame no prazo OU dispensa registrada com motivo';

  SELECT count(*) INTO v_desligados FROM public.admissoes
  WHERE status = 'desligado' AND data_desligamento IS NOT NULL;

  IF v_desligados = 0 THEN
    r.situacao := 'nao_implementado';
    r.obtido   := 'Nenhum desligamento nesta base — nada a auditar.';
    RETURN r;
  END IF;

  SELECT count(*) INTO v_dispensados FROM public.admissoes
  WHERE status = 'desligado' AND data_desligamento IS NOT NULL
    AND COALESCE(exame_demissional_dispensado, false) = true;

  SELECT count(*) INTO v_sem_exame FROM public.admissoes
  WHERE status = 'desligado' AND data_desligamento IS NOT NULL
    AND data_exame_demissional IS NULL
    AND COALESCE(exame_demissional_dispensado, false) = false;

  SELECT count(*) INTO v_fora_prazo FROM public.admissoes
  WHERE status = 'desligado' AND data_desligamento IS NOT NULL
    AND data_exame_demissional IS NOT NULL
    AND data_exame_demissional > data_desligamento + 10;

  IF v_sem_exame = 0 AND v_fora_prazo = 0 THEN
    r.situacao := 'passou';
    r.obtido   := format('%s desligamento(s): todos com exame no prazo ou com dispensa '
                      || 'registrada (%s dispensa(s)). Prazo controlado por '
                      || 'exame_demissional_pendencias().', v_desligados, v_dispensados);
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('De %s desligamento(s): %s SEM exame e SEM dispensa registrada, %s com '
               || 'exame alem dos 10 dias do termino (NR-07, 7.5.11). O controle de prazo ja '
               || 'existe em exame_demissional_pendencias(p_tenant_id) — estes casos estao '
               || 'listados la como "vencido" ou "realizado_fora_do_prazo" e dependem de '
               || 'providencia do RH: lancar a data do exame ou registrar a dispensa com '
               || 'motivo. Dispensas ja registradas: %s.',
               v_desligados, v_sem_exame, v_fora_prazo, v_dispensados);
    r.detalhe  := jsonb_build_object('desligamentos', v_desligados,
                                     'sem_exame_sem_dispensa', v_sem_exame,
                                     'fora_do_prazo', v_fora_prazo,
                                     'dispensados', v_dispensados);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_desl_065()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_desl_065 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_desl_072()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_achou text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Procurar no schema qualquer campo que registre mandato ou candidatura sindical';
  r.esperado    := 'Existe onde registrar a condicao de dirigente sindical';

  SELECT string_agg(table_name || '.' || column_name, ', ')
    INTO v_achou
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (column_name ~* '(^|_)sindical(_|$)' OR column_name ~* '(^|_)dirigente(_|$)'
         OR column_name ~* 'mandato_sindic')
    AND column_name NOT ILIKE '%sindicato\_homolog%';

  IF v_achou IS NULL THEN
    r.situacao := 'falhou';
    r.obtido   := 'NAO EXISTE nenhum campo no banco para registrar que um colaborador e '
               || 'dirigente sindical ou candidato. Sem o dado, a estabilidade do art. 543, '
               || '§3o da CLT e do art. 8o, VIII da CF nao tem como ser verificada, e o '
               || 'sistema permite a dispensa. AGRAVANTE: a tela libera qualquer '
               || 'estabilidade quando o motivo e justa causa — para dirigente sindical '
               || 'isso e incorreto, porque o §3o exige falta grave APURADA EM INQUERITO '
               || 'JUDICIAL (arts. 494 e 853). Correcao: campo de mandato sindical com '
               || 'inicio e fim, verificacao ate 1 ano apos o termino, e exigencia de '
               || 'referencia ao inquerito para dispensa por falta grave. '
               || '(O campo sindicato_homologacao foi excluido da busca: e do bloco de '
               || 'homologacao, nao de estabilidade.)';
  ELSE
    r.situacao := 'passou';
    r.obtido   := 'Existe onde registrar: ' || v_achou;
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_desl_072()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_desl_072 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_desl_073()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_composicao text; v_mandato boolean;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Conferir se a empresa ja controla mandato da CIPA';
  v_mandato := public.qa_coluna_existe('empresa_cadastro','cipa_data_mandato_fim');

  r.passo_ordem := 2;
  r.passo_acao  := 'Procurar a composicao NOMINAL da CIPA ligada ao colaborador';
  r.esperado    := 'Existe onde registrar quem sao os membros, titulares e suplentes';

  SELECT string_agg(table_name || '.' || column_name, ', ')
    INTO v_composicao
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (table_name ~* '(^|_)cipa(_|$)'
         OR (column_name ~* '(^|_)cipa(_|$)' AND column_name NOT ILIKE 'cipa\_%'));

  IF v_composicao IS NULL THEN
    r.situacao := 'falhou';
    r.obtido   := format('NAO EXISTE composicao nominal da CIPA no banco. A empresa %s '
               || 'controla o mandato (datas), mas nao ha vinculo entre a comissao e os '
               || 'colaboradores que a compoem. Sem isso, a estabilidade do ADCT art. 10, '
               || 'II, "a" nao pode ser verificada no desligamento. ATENCAO a Sumula 339, '
               || 'I do TST: a garantia alcanca tambem o SUPLENTE — a estrutura precisa '
               || 'distinguir titular de suplente sem excluir nenhum dos dois da protecao. '
               || 'Este e o gap de estabilidade mais barato de fechar, porque metade do '
               || 'caminho ja existe.',
               CASE WHEN v_mandato THEN 'JA' ELSE 'NAO' END);
    r.detalhe  := jsonb_build_object('mandato_controlado', v_mandato, 'composicao_nominal', false);
  ELSE
    r.situacao := 'passou';
    r.obtido   := 'Composicao encontrada: ' || v_composicao;
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_desl_073()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_desl_073 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_desl_074()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cct boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): as estabilidades conhecem cláusulas de CCT?';
  r.esperado := 'Estabilidade pré-aposentadoria vem da CCT (período/condições variam por categoria)';
  SELECT bool_or(p.prosrc ILIKE '%cct%' OR p.prosrc ILIKE '%convencao%' OR p.prosrc ILIKE '%coletiv%')
    INTO v_cct
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'estabilidades_vigentes';
  IF NOT coalesce(v_cct, false) THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a verificação de estabilidades (estabilidades_vigentes) só conhece as '
             || 'hipóteses LEGAIS — não existe cadastro de cláusulas de CCT no domínio de '
             || 'desligamento (a única tabela de CCT do sistema, ponto_cct_config, guarda só '
             || 'parâmetros de jornada). A estabilidade pré-aposentadoria é tipicamente '
             || 'convencional: sem a cláusula cadastrada, o sistema não avisa e a demissão de '
             || 'um estável convencional vira reintegração. Correção: cadastro de cláusulas '
             || 'de estabilidade por CCT/categoria com vigência, somado às legais.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'As estabilidades consultam cláusulas convencionais.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_desl_074()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_desl_074 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_desl_081()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a exigência de homologação sindical tem onde ser registrada?';
  r.esperado := 'Pós-reforma, homologação só é exigível por CCT — o sistema precisa saber de qual categoria';
  v_est := public.qa_col_existe('admissoes', '%homolog%');
  IF v_est IS NOT NULL AND public.qa_fns_com('%homolog%') IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO PARCIAL: os campos de registro existem (%s) — dá para ANOTAR a '
             || 'homologação feita —, mas nada torna a homologação EXIGÍVEL: nenhuma função '
             || 'verifica se a categoria do colaborador tem cláusula de CCT exigindo o rito '
             || '(mesma raiz do DESL-074: não há cadastro de cláusulas coletivas). O '
             || 'desligamento de categoria com homologação obrigatória conclui sem aviso. '
             || 'Correção: flag de exigência na cláusula da CCT/categoria, travando ou '
             || 'alertando o checklist de desligamento.', v_est);
  ELSIF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: homologação não existe no sistema — nem campo, nem verificação. '
             || 'Correção: registro + exigência por cláusula de CCT/categoria.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Homologação registrável e verificada: %s.', v_est);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_desl_081()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_desl_081 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_desl_083()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_adm uuid; v_aceitou boolean := false; v_col text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Desligar colaborador de 17 anos sem nenhum dado de assistente legal';
  r.esperado := 'Retido — a quitação final do menor exige assistência do responsável (art. 439)';
  INSERT INTO public.admissoes
    (tenant_id, nome_completo, cpf, email, cargo, status, data_admissao, data_nascimento)
  VALUES (v_t, '[QA-DESL-083] Menor', public.qa_cpf(8083),
          'qa.desl083@sandbox.invalid', 'Aprendiz', 'concluido',
          CURRENT_DATE - 300, CURRENT_DATE - interval '17 years')
  RETURNING id INTO v_adm;
  BEGIN
    UPDATE public.admissoes SET
      status = 'desligado', data_desligamento = CURRENT_DATE,
      motivo_desligamento = 'pedido_demissao'
    WHERE id = v_adm;
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_aceitou := false; END;

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA: existe onde registrar o assistente do menor na quitação?';
  r.esperado := 'Campo de responsável/assistente exigido quando a idade no término é < 18';
  v_col := coalesce(public.qa_col_existe(NULL, '%assistente%'),
                    public.qa_col_existe(NULL, '%responsavel_legal%'));

  IF v_aceitou AND v_col IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o menor de 18 foi desligado sem assistência — o banco não olhou a '
             || 'data de nascimento e não existe campo de assistente/responsável legal em '
             || 'lugar nenhum do sistema. O art. 439 permite ao menor assinar recibos do '
             || 'dia a dia, mas a QUITAÇÃO FINAL sem o responsável é nula: todas as verbas '
             || 'podem ser rediscutidas como se nunca quitadas. A idade já está no cadastro '
             || '(mesma fonte do ADM-030). Correção: quando idade no término < 18, exigir '
             || 'registro do assistente (nome/CPF/parentesco) e a assinatura dele junto à '
             || 'do menor no termo de quitação.';
  ELSIF NOT v_aceitou THEN
    r.situacao := 'passou';
    r.obtido := 'O desligamento do menor sem assistente foi retido.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Aceito com estrutura de assistente disponível (%s) — conferir a '
                       || 'exigência no fluxo de quitação.', v_col);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_desl_083()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_desl_083 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_desl_091()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_desligados int; v_com_log int; v_fila_existe boolean; v_na_fila int := 0;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'AUDITORIA (somente leitura): contar desligamentos e eventos correspondentes';
  r.esperado    := 'Todo desligamento celetista tem S-2299 na fila de transmissao';

  SELECT count(*) INTO v_desligados FROM public.admissoes
  WHERE status = 'desligado' AND data_desligamento IS NOT NULL;

  SELECT count(*) INTO v_com_log FROM public.audit_logs
  WHERE action = 'esocial_s2299_gerado';

  v_fila_existe := to_regclass('public.esocial_transmissoes') IS NOT NULL;
  IF v_fila_existe THEN
    EXECUTE 'SELECT count(*) FROM public.esocial_transmissoes WHERE tipo_evento ILIKE ''%2299%'''
      INTO v_na_fila;
  END IF;

  IF v_desligados = 0 THEN
    r.situacao := 'nao_implementado';
    r.obtido   := 'Nao ha desligamento registrado nesta base — nada a auditar. '
               || 'Rode novamente quando houver movimento.';
    RETURN r;
  END IF;

  IF v_na_fila >= v_desligados THEN
    r.situacao := 'passou';
    r.obtido   := format('%s desligamento(s) e %s evento(s) S-2299 na fila.', v_desligados, v_na_fila);
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('%s desligamento(s) registrado(s); %s linha(s) de audit_log dizendo '
               || '"esocial_s2299_gerado"; %s evento(s) S-2299 na fila de transmissao. '
               || 'gerarEventoS2299 e funcao pura: monta o objeto e devolve, sem gravar. '
               || 'O componente registra o audit_log e manda o objeto para console.log. '
               || 'A fila esocial_transmissoes e alimentada por outra tela e por edge '
               || 'function propria — o evento gerado no desligamento nunca chega la. '
               || 'Somado a isso, a geracao esta dentro de try marcado como nao bloqueante: '
               || 'o desligamento persiste e o usuario ve sucesso mesmo se falhar. '
               || 'PERGUNTA PARA O TIME antes de corrigir: a tela de transmissao reconstroi '
               || 'o S-2299 a partir da admissao desligada? Se sim, o audit_log e ruido que '
               || 'induz a erro. Se nao, a obrigacao acessoria do Decreto 8.373/2014 nao e '
               || 'cumprida por este caminho.',
               v_desligados, v_com_log, v_na_fila);
    r.detalhe  := jsonb_build_object('desligamentos', v_desligados,
                                     'audit_logs_dizendo_gerado', v_com_log,
                                     'eventos_na_fila', v_na_fila,
                                     'fila_existe', v_fila_existe);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_desl_091()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_desl_091 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_desl_093()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_col text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a transmissão do S-2299 tem prazo projetado e vigiado?';
  r.esperado := 'Data-limite = mín(pagamento, término + 10 dias); aproximação alerta; atraso é acusado';
  IF to_regclass('public.esocial_transmissoes') IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A tabela de transmissões do eSocial não existe nesta base.';
    RETURN r;
  END IF;
  v_col := coalesce(public.qa_col_existe('esocial_transmissoes', '%prazo%'),
                    public.qa_col_existe('esocial_transmissoes', '%data_limite%'),
                    public.qa_col_existe('esocial_transmissoes', '%vencimento%'));
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%2299%' AND p.prosrc ILIKE '%prazo%');

  IF v_col IS NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o S-2299 não tem relógio — esocial_transmissoes não guarda prazo '
             || 'nem data-limite (só status e retorno), e nenhuma função projeta o '
             || 'vencimento do evento de desligamento. O prazo tem regra dupla: até 10 dias '
             || 'do desligamento, ANTECIPADO se o pagamento das verbas vier antes — dois '
             || 'relógios, vence o primeiro. Sem a projeção, a transmissão tardia entra '
             || 'como se regular fosse e a multa por atraso de obrigação acessória chega '
             || 'sem aviso. Somado ao DESL-091 (o evento do desligamento nem chega à fila), '
             || 'o quadro é: sem evento E sem prazo. Correção: data-limite calculada na '
             || 'criação do evento + alertas de aproximação + marcação explícita de FORA '
             || 'DO PRAZO na transmissão tardia.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Prazo controlado (campo: %s; funções: %s).',
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_desl_093()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_desl_093 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_desl_094()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_unq text; v_trad text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a fila do eSocial tem anti-duplicidade e tradução de rejeição?';
  r.esperado := 'Reenvio corrigido retifica (nunca segundo S-2299 do mesmo vínculo) e a rejeição vira instrução';
  IF to_regclass('public.esocial_transmissoes') IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A tabela de transmissões do eSocial não existe nesta base.';
    RETURN r;
  END IF;
  SELECT string_agg(conname, ', ') INTO v_unq
  FROM pg_constraint WHERE conrelid = 'public.esocial_transmissoes'::regclass AND contype = 'u';
  v_trad := coalesce(public.qa_fns_com('%rejeic%esocial%'), public.qa_fns_com('%esocial%rejei%'));

  IF v_unq IS NULL AND v_trad IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (quarto da série ADM-093 / FERIAS-081 / DEC13-050, agora no evento '
             || 'que ENCERRA o vínculo): esocial_transmissoes segue sem unicidade — o mesmo '
             || 'S-2299 pode ser gravado e enviado duas vezes — e nenhuma função traduz '
             || 'rejeições: o retorno técnico chega cru e o reenvio fica por conta do '
             || 'operador. Desligamento duplicado no governo é o pior da série: trava os '
             || 'eventos futuros do CPF (readmissão inclusive) até alguém excluir o evento '
             || 'errado no portal. Correção: chave natural (vínculo + tipo + competência) '
             || 'na fila + rotina que interpreta a rejeição e conduz retificação — uma vez, '
             || 'para as quatro famílias que dependem dela.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Proteções presentes (unicidade: %s; tradução: %s).',
                       coalesce(v_unq, '—'), coalesce(v_trad, '—'));
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_desl_094()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_desl_094 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_desl_101()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_coluna text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Procurar a coluna que guarda o protocolo do desligamento';
  r.esperado    := 'Existe campo proprio, consultavel e unico';

  SELECT string_agg(table_name || '.' || column_name, ', ')
    INTO v_coluna
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND column_name ILIKE '%protocolo%'
    AND table_name IN ('admissoes','folha_rescisoes');

  IF v_coluna IS NULL THEN
    r.situacao := 'falhou';
    r.obtido   := 'O PROTOCOLO NAO E GRAVADO. Ele e montado no componente no formato '
               || 'DESL-{aaaammdd}-{8 primeiros caracteres do id da admissao}, exibido em '
               || 'toast e embutido no texto livre da descricao enviada ao Hub Contabil. '
               || 'Nenhuma coluna de admissoes ou folha_rescisoes o guarda. Consequencia: '
               || 'o numero e prometido ao usuario como rastreio e nao pode ser consultado '
               || '— localizar um desligamento por ele exigiria busca textual na descricao '
               || 'de outro modulo. Alem disso, sendo deterministico por admissao e dia, '
               || 'nao distingue tentativas. Correcao: coluna propria com restricao de '
               || 'unicidade, gerada no banco.';
  ELSE
    r.situacao := 'passou';
    r.obtido   := 'Protocolo persistido em: ' || v_coluna;
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_desl_101()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_desl_101 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_desl_104()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_orfaos int;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'AUDITORIA (somente leitura): dados medicos gravados sem desligamento concluido';
  r.esperado    := 'Nenhum — dado de saude so se justifica com a finalidade que o originou';

  SELECT count(*) INTO v_orfaos FROM public.admissoes
  WHERE status <> 'desligado'
    AND (data_exame_demissional IS NOT NULL
         OR resultado_exame_demissional IS NOT NULL
         OR medico_exame_demissional IS NOT NULL);

  IF v_orfaos = 0 THEN
    r.situacao := 'passou';
    r.obtido   := 'Nenhum dado de exame demissional em admissao nao desligada.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('%s admissao(oes) com dados de exame demissional preenchidos mas '
               || 'SEM desligamento concluido. O ASO sobe e os campos sao gravados antes da '
               || 'confirmacao; se a transacao nao se completa, o dado medico permanece sem '
               || 'a finalidade que o justificava. Resultado de exame ocupacional e dado '
               || 'pessoal SENSIVEL (LGPD, art. 5o, II), e os arts. 15 e 16 exigem '
               || 'eliminacao ao termino do tratamento. Sem desligamento nao ha tratamento '
               || 'em curso, e nao ha prazo nem responsavel definidos para esse residuo. '
               || 'Mesma classe do vazamento de pastas fechado em 30/07/2026, com '
               || 'sensibilidade maior.', v_orfaos);
    r.detalhe  := jsonb_build_object('admissoes_com_dado_medico_orfao', v_orfaos);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_desl_104()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_desl_104 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_desl_105()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_col text; v_fns text; v_unq text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a rescisão complementar tem onde existir?';
  r.esperado := 'Diferença apurada como registro próprio, vinculado à rescisão original, com reflexo no eSocial';
  v_col := coalesce(public.qa_col_existe('folha_rescisoes', '%complementar%'),
                    public.qa_col_existe('folha_rescisoes', '%origem%'),
                    public.qa_col_existe('folha_rescisoes', '%rescisao_pai%'));
  v_fns := public.qa_fns_com('%complementar%');
  SELECT string_agg(conname, ', ') INTO v_unq
  FROM pg_constraint WHERE conrelid = 'public.folha_rescisoes'::regclass AND contype = 'u';

  IF v_col IS NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: a rescisão complementar não tem onde viver — folha_rescisoes '
             || 'não tem marcação de complementar nem vínculo a uma rescisão de origem, e '
             || 'nenhuma função apura diferenças. O agravante: a tabela também não tem '
             || 'unicidade (%s), então uma segunda rescisão do mesmo colaborador entra '
             || 'como linha solta — indistinguível de duplicata, de erro ou de '
             || 'complementar de verdade. Dissídio retroativo é rotina anual em categoria '
             || 'organizada: sem a estrutura, cada reajuste vira ou passivo ignorado ou '
             || 'edição da rescisão quitada (fraude de trilha). Correção: tipo '
             || '(original/complementar) + referência à rescisão-mãe + apuração da '
             || 'diferença com memória própria e S-2299 complementar.',
             coalesce('constraints: ' || v_unq, 'nenhuma constraint de unicidade'));
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_desl_105()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_desl_105 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_desl_106()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_adm uuid; v_reativou boolean := false; v_status text; v_data date;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Desligar um colaborador e depois "reativá-lo" com UPDATE direto, sem rito nenhum';
  r.esperado := 'Bloqueado — reversão exige fluxo próprio: motivo, dupla aprovação, estorno e tratamento do eSocial';
  INSERT INTO public.admissoes
    (tenant_id, nome_completo, cpf, email, cargo, status, data_admissao)
  VALUES (v_t, '[QA-DESL-106] Colaborador', public.qa_cpf(8106),
          'qa.desl106@sandbox.invalid', 'Operador', 'concluido', CURRENT_DATE - 600)
  RETURNING id INTO v_adm;
  UPDATE public.admissoes SET
    status = 'desligado', data_desligamento = CURRENT_DATE - 20,
    motivo_desligamento = 'sem_justa_causa'
  WHERE id = v_adm;

  BEGIN
    UPDATE public.admissoes SET
      status = 'concluido', data_desligamento = NULL, motivo_desligamento = NULL
    WHERE id = v_adm;
    v_reativou := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_reativou := false; END;

  r.passo_ordem := 2;
  r.passo_acao := 'Conferir o que sobrou do desligamento revertido';
  SELECT status::text, data_desligamento INTO v_status, v_data
  FROM public.admissoes WHERE id = v_adm;

  IF v_reativou AND v_status = 'concluido' AND v_data IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a reversão foi um UPDATE qualquer — o colaborador desligado voltou '
             || 'a "concluído" com data e motivo APAGADOS, sem aprovação, sem motivo de '
             || 'reversão, sem estorno das verbas e sem tratar o S-2299 (se transmitido, o '
             || 'governo continua com um desligamento que a empresa diz não existir). É a '
             || 'outra face do DESL-002: como o desligamento é colunas na admissão e não '
             || 'evento, desfazê-lo é apagar história. Correção: fluxo de reversão com '
             || 'motivo + dupla aprovação, evento de desligamento preservado como '
             || 'histórico, estorno rastreado das verbas e exclusão/retificação formal do '
             || 'evento no eSocial (mesma disciplina do FERIAS-054 e DEC13-070).';
  ELSIF NOT v_reativou THEN
    r.situacao := 'passou';
    r.obtido := 'A reativação direta foi bloqueada — reversão só por fluxo próprio.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Reativação controlada (status: %s; histórico preservado: %s).',
                       v_status, coalesce(v_data::text, 'apagado'));
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_desl_106()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_desl_106 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_desl_110()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_restr int; v_proprio int; v_perfil text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): as políticas de folha_rescisoes separam papel, equipe e o próprio?';
  r.esperado := 'Camada RESTRICTIVE por perfil; colaborador só o próprio dossiê; gestor só a equipe';
  SELECT count(*) INTO v_restr
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'folha_rescisoes'
    AND permissive = 'RESTRICTIVE';
  SELECT count(*) INTO v_proprio
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'folha_rescisoes'
    AND (qual ILIKE '%auth.uid%' OR qual ILIKE '%colaborador%uid%' OR qual ILIKE '%departamento%');
  SELECT string_agg(DISTINCT p.polname, ', ') INTO v_perfil
  FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
  WHERE c.relname = 'folha_rescisoes' AND p.polname ILIKE 'perfil_restringe%';

  IF v_restr = 0 AND v_proprio = 0 THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (par do DEC13-071, agora no dado mais sensível do ciclo): '
             || 'folha_rescisoes tem só a política de tenant — qualquer usuário autenticado '
             || 'da empresa lê TODAS as rescisões: verbas, motivo do desligamento (justa '
             || 'causa inclusive) e, por tabela irmã, o rastro de saúde da estabilidade. A '
             || 'matriz do documento (seção 6) é explícita: colaborador só o próprio '
             || 'dossiê, gestor só a equipe, jurídico/DP/financeiro por papel. A tabela '
             || 'está fora da camada perfil_restringe_leitura_* que já protege as tabelas '
             || 'sensíveis do sistema (a rotina PERFIL-003 cobra exatamente isso de tabela '
             || 'nova). Correção: política RESTRICTIVE via perfil_permite_modulo + regra '
             || 'de próprio registro/equipe, no padrão das 20 tabelas já cobertas.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Camadas presentes (restritivas: %s; próprio/equipe: %s; perfil: %s).',
                       v_restr, v_proprio, coalesce(v_perfil, '—'));
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_desl_110()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_desl_110 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_doc_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar pasta "Documentos Admissionais"'; r.esperado:='Pasta criada';
  v_id := public.qa_nova_pasta('[QA] Documentos Admissionais');
  IF v_id IS NOT NULL THEN r.situacao:='passou'; r.obtido:='Pasta criada.';
  ELSE r.situacao:='falhou'; r.obtido:='Nao criou.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_doc_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_doc_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_doc_002()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_pasta uuid; v_doc uuid; v_pasta_do_doc uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar pasta e guardar um documento dentro dela'; r.esperado:='O documento aponta para a pasta';
  v_pasta := public.qa_nova_pasta('[QA] Pasta Com Doc');
  v_doc := public.qa_novo_documento('[QA] contrato.pdf', v_pasta);
  SELECT pasta_id INTO v_pasta_do_doc FROM public.documentos WHERE id=v_doc;
  IF v_pasta_do_doc = v_pasta THEN r.situacao:='passou'; r.obtido:='Documento guardado na pasta (premissa cumprida).';
  ELSE r.situacao:='falhou'; r.obtido:='Documento nao ficou na pasta.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_doc_002()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_doc_002 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_doc_003()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_mae uuid; v_sub uuid; v_pai_da_sub uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar pasta "2026" e dentro dela "Janeiro"'; r.esperado:='Janeiro tem 2026 como pasta-mae';
  v_mae := public.qa_nova_pasta('[QA] 2026');
  v_sub := public.qa_nova_pasta('[QA] Janeiro', v_mae);
  SELECT pasta_pai_id INTO v_pai_da_sub FROM public.documento_pastas WHERE id=v_sub;
  IF v_pai_da_sub = v_mae THEN r.situacao:='passou'; r.obtido:='Hierarquia de pastas montada (subpasta aponta para a mae).';
  ELSE r.situacao:='falhou'; r.obtido:='pasta_pai_id da subpasta nao aponta para a mae.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_doc_003()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_doc_003 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_doc_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar criar pasta sem nome'; r.esperado:='Recusado (NOT NULL)';
  BEGIN
    INSERT INTO public.documento_pastas (tenant_id, nome) VALUES (v_t, NULL);
    r.situacao:='falhou'; r.obtido:='ACEITOU pasta sem nome.';
  EXCEPTION WHEN not_null_violation THEN r.situacao:='passou'; r.obtido:='Recusado com not_null_violation.'; END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_doc_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_doc_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_doc_011()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar guardar documento sem storage_path'; r.esperado:='Recusado (NOT NULL) — documento precisa apontar para um arquivo';
  BEGIN
    INSERT INTO public.documentos (tenant_id, colaborador_nome, nome_arquivo, nome_original, tipo, tamanho, mime_type, storage_path)
    VALUES (v_t, '[QA]', 'x.pdf', 'x.pdf', 'pdf', 100, 'application/pdf', NULL);
    r.situacao:='falhou'; r.obtido:='ACEITOU documento sem storage_path.';
  EXCEPTION WHEN not_null_violation THEN r.situacao:='passou'; r.obtido:='Recusado: documento precisa apontar para um arquivo.'; END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_doc_011()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_doc_011 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_doc_013()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_mae uuid; v_sub uuid; v_sobrou int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar pasta-mae com uma subpasta'; r.esperado:='Apagar a mae apaga a subpasta (CASCADE)';
  v_mae := public.qa_nova_pasta('[QA] Mae Que Sera Apagada');
  v_sub := public.qa_nova_pasta('[QA] Sub Some Junto', v_mae);
  r.passo_ordem:=2; r.passo_acao:='Apagar a pasta-mae';
  DELETE FROM public.documento_pastas WHERE id=v_mae;
  r.passo_ordem:=3; r.passo_acao:='Conferir que a subpasta foi apagada junto';
  SELECT count(*) INTO v_sobrou FROM public.documento_pastas WHERE id=v_sub;
  IF v_sobrou=0 THEN r.situacao:='passou'; r.obtido:='Subpasta apagada junto com a mae (CASCADE), como esperado.';
  ELSE r.situacao:='falhou'; r.obtido:=format('Subpasta NAO foi apagada (%s ainda existe).', v_sobrou); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_doc_013()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_doc_013 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_doc_014()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_pasta uuid; v_doc uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar pasta com um documento dentro'; r.esperado:='Apagar a pasta e recusado (protege o documento)';
  v_pasta := public.qa_nova_pasta('[QA] Pasta Protegida');
  v_doc := public.qa_novo_documento('[QA] importante.pdf', v_pasta);
  r.passo_ordem:=2; r.passo_acao:='Tentar apagar a pasta que ainda tem documento';
  BEGIN
    DELETE FROM public.documento_pastas WHERE id=v_pasta;
    r.situacao:='falhou'; r.obtido:='APAGOU a pasta com documento dentro — o documento ficou orfao ou sumiu.';
  EXCEPTION WHEN foreign_key_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: o banco protege o documento, nao deixa apagar a pasta que o contem.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_doc_014()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_doc_014 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_doc_022()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t1 uuid := public.qa_sandbox_tenant_id(); v_t2 uuid := public.qa_sandbox2_tenant_id(); v_vis int;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN r.situacao:='erro'; r.obtido:='2o cercado nao existe.'; RETURN r; END IF;
  r.passo_ordem:=1; r.passo_acao:='Guardar documento no tenant 1'; r.esperado:='Invisivel ao tenant 2';
  INSERT INTO public.documentos (tenant_id, colaborador_nome, nome_arquivo, nome_original, tipo, tamanho, mime_type, storage_path)
  VALUES (v_t1, '[QA]', '[QA] secreto_t1.pdf', 'secreto.pdf', 'pdf', 100, 'application/pdf', 'qa/secreto_t1.pdf');
  r.passo_ordem:=2; r.passo_acao:='Contar, filtrando pelo tenant 2';
  SELECT count(*) INTO v_vis FROM public.documentos WHERE tenant_id=v_t2 AND nome_arquivo='[QA] secreto_t1.pdf';
  IF v_vis=0 THEN r.situacao:='passou'; r.obtido:='Documento do tenant 1 invisivel ao tenant 2.';
  ELSE r.situacao:='falhou'; r.obtido:=format('VAZAMENTO: %s documento(s) visiveis.', v_vis); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_doc_022()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_doc_022 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_doc_030()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_doc uuid; v_qtd int; v_v1 int; v_v2 int; v_path_v1 text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Guardar um documento — a v1 nasce com ele';
  r.esperado    := 'Revisar cria a versao 2 preservando a versao 1 (a premissa da assinatura)';
  v_doc := public.qa_novo_documento('[QA] termo.pdf');

  SELECT storage_path INTO v_path_v1
  FROM public.documento_versoes WHERE documento_id = v_doc AND versao = 1;

  r.passo_ordem := 2;
  r.passo_acao  := 'Documento assinado chega: gravar o novo arquivo (revisao)';
  INSERT INTO public.documento_versoes
    (tenant_id, documento_id, versao, nome_original, storage_path, tamanho, mime_type, motivo_revisao)
  VALUES (v_t, v_doc, 2, '[QA] termo_assinado.pdf', 'qa/termo_v2_assinado.pdf', 2048,
          'application/pdf', 'Versao assinada');

  r.passo_ordem := 3;
  r.passo_acao  := 'Tentar forcar uma SEGUNDA versao 1 (o defeito do DOC-030)';
  INSERT INTO public.documento_versoes
    (tenant_id, documento_id, versao, nome_original, storage_path, tamanho, mime_type)
  VALUES (v_t, v_doc, 1, '[QA] termo_falso.pdf', 'qa/termo_v1_falso.pdf', 512, 'application/pdf');

  r.passo_ordem := 4;
  r.passo_acao  := 'Conferir: v1 unica e preservada, v2 assinada';
  SELECT count(*) INTO v_qtd FROM public.documento_versoes WHERE documento_id = v_doc;
  SELECT count(*) INTO v_v1  FROM public.documento_versoes WHERE documento_id = v_doc AND versao = 1;
  SELECT count(*) INTO v_v2  FROM public.documento_versoes WHERE documento_id = v_doc AND versao = 2;

  IF v_v1 = 1 AND v_v2 = 1
     AND (SELECT storage_path FROM public.documento_versoes
           WHERE documento_id = v_doc AND versao = 1) IS NOT DISTINCT FROM v_path_v1 THEN
    r.situacao := 'passou';
    r.obtido   := format('v1 unica e intacta, v2 assinada. A tentativa de sobrescrever a v1 virou '
                      || 'versao %s em vez de duplicar. Total de versoes: %s.', v_qtd, v_qtd);
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('Esperava v1 unica e preservada. Total=%s, v1=%s, v2=%s.', v_qtd, v_v1, v_v2);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_doc_030()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_doc_030 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_doc_040()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_val date;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Guardar documento com validade em 31/12/2026'; r.esperado:='Data de validade persistida';
  INSERT INTO public.documentos (tenant_id, colaborador_nome, nome_arquivo, nome_original, tipo, tamanho, mime_type, storage_path, data_validade)
  VALUES (v_t, '[QA]', '[QA] aso.pdf', 'aso.pdf', 'pdf', 1024, 'application/pdf', 'qa/aso.pdf', DATE '2026-12-31')
  RETURNING id INTO v_id;
  SELECT data_validade INTO v_val FROM public.documentos WHERE id=v_id;
  IF v_val = DATE '2026-12-31' THEN r.situacao:='passou'; r.obtido:='Data de validade guardada (31/12/2026).';
  ELSE r.situacao:='falhou'; r.obtido:='Validade nao persistiu: '||COALESCE(v_val::text,'(nulo)'); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_doc_040()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_doc_040 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_doc_041()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_status text; v_val date;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Guardar documento com validade JA vencida (ano passado)';
  r.esperado:='Idealmente o status viraria "vencido"; revela se ha automacao';
  INSERT INTO public.documentos (tenant_id, colaborador_nome, nome_arquivo, nome_original, tipo, tamanho, mime_type, storage_path, data_validade)
  VALUES (v_t, '[QA]', '[QA] vencido.pdf', 'vencido.pdf', 'pdf', 1024, 'application/pdf', 'qa/vencido.pdf', CURRENT_DATE - 365)
  RETURNING id INTO v_id;
  SELECT status, data_validade INTO v_status, v_val FROM public.documentos WHERE id=v_id;
  -- o documento esta vencido ha 1 ano. o status deveria refletir?
  IF v_status = 'vencido' THEN
    r.situacao:='passou'; r.obtido:='O status virou "vencido" automaticamente. Ha automacao de validade.';
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('Documento vencido ha 1 ano mas status = "%s" (nao recalculou). No modulo geral a validade e so um dado — sem trigger/cron que marque vencidos. terceiro_documentos TEM essa automacao; aqui nao.', v_status);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_doc_041()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_doc_041 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_doc_042()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_status text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar guardar documento com status = "abacaxi" (valor sem sentido)';
  r.esperado:='Idealmente recusado por enum; revela se status tem lista fechada';
  BEGIN
    INSERT INTO public.documentos (tenant_id, colaborador_nome, nome_arquivo, nome_original, tipo, tamanho, mime_type, storage_path, status)
    VALUES (v_t, '[QA]', '[QA] x.pdf', 'x.pdf', 'pdf', 100, 'application/pdf', 'qa/x.pdf', 'abacaxi')
    RETURNING id INTO v_id;
    SELECT status INTO v_status FROM public.documentos WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU status = "%s". documentos.status e TEXT livre, sem enum/check. Um status invalido entra.', v_status);
  EXCEPTION WHEN invalid_text_representation OR check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: status tem lista fechada de valores.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_doc_042()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_doc_042 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;


-- (2) CASOS DOCUMENTADOS — 80 casos.

-- Desligamento (68 casos)

INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
SELECT m.id, d.codigo::text, d.titulo::text, d.tipo::text::qa_caso_tipo, d.prioridade::text::qa_prioridade, d.status::text::qa_caso_status, d.objetivo::text, d.pre_condicoes::text, d.passos::text::jsonb, d.resultado_esperado::text, d.observacoes::text, d.nivel::text, d.base_legal::text, d.disposicao::text, d.disposicao_motivo::text
FROM (VALUES
    ('DESL-001', 'Colaborador com contrato ativo pode ser desligado', 'feliz', 'alta', 'aprovado', 'Caminho normal: contrato vigente, admissao concluida, sem desligamento anterior.', 'Colaborador com admissao concluida e status ativo.', '[{"acao": "Registrar desligamento com data, motivo e demais campos validos", "ordem": 1, "resultado_esperado": "Aceito"}, {"acao": "Conferir o registro gravado", "ordem": 2, "resultado_esperado": "Desligamento persistido e vinculado ao colaborador"}, {"acao": "Conferir o status do colaborador", "ordem": 3, "resultado_esperado": "Atualizado para desligado"}]', 'O desligamento e registrado e o colaborador deixa de constar como ativo.', 'Caso base do modulo. Se ele falhar, os demais nao tem significado.', 'api', 'CLT, art. 477 (extincao do contrato e obrigacao de quitacao das verbas)', 'em_triagem', NULL),
    ('DESL-002', 'Colaborador ja desligado nao pode ser desligado de novo', 'negativo', 'critica', 'aprovado', 'Impedir segundo evento rescisorio sobre um contrato ja extinto.', 'Colaborador com desligamento ja registrado.', '[{"acao": "Tentar registrar novo desligamento pela tela", "ordem": 1, "resultado_esperado": "Bloqueado com mensagem de que ja existe desligamento"}, {"acao": "Tentar gravar o mesmo desligamento direto pela API", "ordem": 2, "resultado_esperado": "Recusado pelo banco"}, {"acao": "Conferir o historico", "ordem": 3, "resultado_esperado": "Somente o desligamento original permanece"}]', 'A duplicidade e impedida nas duas rotas de entrada, nao so na tela.', 'GAP CONHECIDO: hoje a checagem existe apenas no item de menu da tela de Colaboradores, e esta DUPLICADA em dois lugares do mesmo arquivo. Nao ha constraint no banco. O passo 2 deve falhar. Correcao sugerida: indice unico parcial sobre o vinculo com desligamento ativo.', 'api', 'CLT, art. 477 c/c art. 442 — extinto o contrato, nao ha vinculo a extinguir. Duplicidade produziria dois eventos S-2299 para o mesmo vinculo.', 'em_triagem', NULL),
    ('DESL-003', 'Contrato suspenso por beneficio previdenciario impede dispensa imotivada', 'negativo', 'critica', 'aprovado', 'Durante a suspensao o contrato existe mas suas obrigacoes estao paralisadas. Dispensa imotivada nesse periodo nao produz efeito.', 'Colaborador com afastamento previdenciario ativo, sem retorno formal registrado.', '[{"acao": "Tentar registrar dispensa sem justa causa", "ordem": 1, "resultado_esperado": "Bloqueado, com indicacao da suspensao"}, {"acao": "Registrar o retorno formal ao trabalho", "ordem": 2, "resultado_esperado": "Aceito"}, {"acao": "Repetir o desligamento", "ordem": 3, "resultado_esperado": "Agora permitido"}]', 'A dispensa so e possivel apos o retorno formal.', 'Ha excecoes: falecimento e o termino de contrato por prazo determinado nao dependem de retorno. Justa causa durante suspensao e materia controversa — vale decisao juridica antes de liberar.', 'api', 'CLT, art. 476 (licenca por auxilio-doenca conta como suspensao do contrato); CLT, art. 471; Sumula 371 do TST (efeitos do auxilio-doenca no aviso previo)', 'em_triagem', NULL),
    ('DESL-004', 'Contrato com inicio futuro nao pode ser desligado', 'negativo', 'alta', 'aprovado', 'Impedir evento rescisorio sobre contrato que ainda nao comecou.', 'Colaborador com data de admissao futura.', '[{"acao": "Tentar registrar desligamento", "ordem": 1, "resultado_esperado": "Bloqueado, informando que o contrato nao iniciou"}, {"acao": "Conferir persistencia", "ordem": 2, "resultado_esperado": "Nada foi gravado e nenhuma integracao disparada"}]', 'Contrato nao iniciado nao gera rescisao.', 'Cenario real em admissao programada. O correto para desistencia antes do inicio e cancelamento da admissao, nao desligamento — sao eventos diferentes no eSocial.', 'api', 'CLT, art. 442 e art. 443 — sem inicio da prestacao nao ha contrato de trabalho em curso.', 'em_triagem', NULL),
    ('DESL-006', 'Desligamento nao atravessa a fronteira entre clientes', 'negativo', 'critica', 'aprovado', 'Nenhum usuario pode registrar desligamento de colaborador de outro tenant.', 'Dois tenants, cada um com colaborador ativo.', '[{"acao": "Autenticado no tenant A, tentar desligar colaborador do tenant B", "ordem": 1, "resultado_esperado": "Recusado"}, {"acao": "Repetir a operacao direto pela API", "ordem": 2, "resultado_esperado": "Continua recusado — a protecao nao pode depender da tela"}, {"acao": "Conferir se o desligamento gravou tenant_id coerente com o colaborador", "ordem": 3, "resultado_esperado": "Coerente, sem cruzamento"}]', 'O evento rescisorio respeita a fronteira do cliente na escrita.', 'Escrito com base no gap identico encontrado em HIER-006, onde matriz_id atravessava tenant por ser FK sem validacao. Vale conferir se a gravacao do desligamento tem o mesmo problema. Dado de desligamento e dado pessoal sensivel — vazamento aqui e incidente de LGPD.', 'api', 'LGPD, Lei 13.709/2018, art. 46 e art. 47 (seguranca e prevencao de acesso indevido); regra de isolamento multi-tenant do produto.', 'em_triagem', NULL),
    ('DESL-010', 'Data de desligamento e obrigatoria', 'negativo', 'alta', 'aprovado', 'Sem data nao ha como apurar prazo legal, verbas nem evento do eSocial.', 'Colaborador elegivel.', '[{"acao": "Deixar a data em branco e tentar confirmar", "ordem": 1, "resultado_esperado": "Bloqueado, campo validado como obrigatorio"}]', 'A confirmacao exige data.', 'Implementado: o botao fica desabilitado sem data.', 'e2e', 'CLT, art. 477, §6o — o prazo de pagamento conta do TERMINO DO CONTRATO, que so existe se houver data.', 'em_triagem', NULL),
    ('DESL-011', 'Data de desligamento nao pode ser anterior a admissao', 'negativo', 'alta', 'aprovado', 'Impedir contrato com duracao negativa, que corromperia todo o calculo rescisorio.', 'Colaborador com data de admissao conhecida.', '[{"acao": "Informar data anterior a admissao", "ordem": 1, "resultado_esperado": "Bloqueado com mensagem de inconsistencia"}, {"acao": "Conferir se algum calculo foi disparado", "ordem": 2, "resultado_esperado": "Nenhum calculo nem integracao"}]', 'Data incoerente e barrada antes de qualquer calculo.', 'Implementado em RNDES02.', 'e2e', 'CLT, art. 442 — nao ha extincao anterior a constituicao do vinculo.', 'em_triagem', NULL),
    ('DESL-012', 'Data futura e bloqueada fora do contexto de desligamento programado', 'negativo', 'media', 'aprovado', 'Evitar rescisao registrada como concluida antes de existir.', 'Colaborador elegivel.', '[{"acao": "Informar data posterior a hoje", "ordem": 1, "resultado_esperado": "Bloqueado"}, {"acao": "Informar a data de hoje", "ordem": 2, "resultado_esperado": "Aceito"}]', 'Somente data ate hoje e aceita no fluxo comum.', 'A mensagem atual diz "salvo desligamento programado", mas esse contexto nao existe no sistema — ver DESL-013.', 'e2e', 'CLT, art. 477, §6o — o prazo de 10 dias corre do termino; data futura sem controle de efetivacao tornaria o prazo indeterminado.', 'em_triagem', NULL),
    ('DESL-013', '[A CONSTRUIR] Desligamento programado com data futura', 'alternativo', 'media', 'rascunho', 'ESPECIFICACAO. O aviso previo trabalhado projeta legitimamente o termino do contrato para data futura. Falta definir o fluxo entre o registro e a efetivacao.', 'Depende de decisao de produto sobre o ciclo de vida do registro programado.', '[{"acao": "Registrar desligamento com data futura em contexto de aviso trabalhado", "ordem": 1, "resultado_esperado": "Aceito, com status distinto de efetivado"}, {"acao": "Alcancada a data, verificar efetivacao", "ordem": 2, "resultado_esperado": "Status muda e as integracoes disparam"}, {"acao": "Antes da data, tentar novo desligamento do mesmo colaborador", "ordem": 3, "resultado_esperado": "Bloqueado — ja existe programado"}]', 'Data futura e valida quando ha projecao de aviso, com efetivacao controlada.', 'PERGUNTAS EM ABERTO para o time: o registro programado ja gera S-2299 ou espera a data? O colaborador aparece como ativo ou em aviso? Cancelar programado exige trilha de auditoria? Sem essas respostas o caso nao vira rotina.', 'api', 'CLT, art. 487 (aviso previo trabalhado projeta o termino); Sumula 371 do TST (projecao do aviso previo)', 'em_triagem', NULL),
    ('DESL-014', 'Prazo legal de pagamento das verbas e de 10 dias', 'alternativo', 'alta', 'aprovado', 'O sistema precisa informar o prazo e a consequencia do descumprimento.', 'Desligamento confirmado.', '[{"acao": "Confirmar desligamento", "ordem": 1, "resultado_esperado": "Alerta informando o prazo de 10 dias corridos a partir do termino"}, {"acao": "Conferir a data limite exibida", "ordem": 2, "resultado_esperado": "Data do desligamento mais 10 dias corridos"}]', 'O responsavel enxerga a data limite e a multa do §8o.', 'Implementado como RNDES24. O passo 2 verifica se o calculo e em dias CORRIDOS, nao uteis — o §6o nao distingue, e a contagem corrida e a interpretacao consolidada. Requisitos YE-DP-RESC-001: RN-004/CA-005 — o pós-prazo (multa do §8º e antecipação por dia não útil) ganhou caso próprio (DESL-015).', 'e2e', 'CLT, art. 477, §6o (redacao da Lei 13.467/2017) — pagamento em ate 10 dias contados do termino do contrato; §8o — multa em favor do empregado equivalente ao seu salario em caso de atraso', 'em_triagem', NULL),
    ('DESL-015', 'Pagamento no 11º dia sinaliza a multa do §8º; dia não útil antecipa', 'excecao', 'critica', 'aprovado', 'O DESL-014 garante que a data-limite (término + 10 dias corridos) é exibida; este caso cobra o DEPOIS: registrado o pagamento no 11º dia, o sistema sinaliza a multa do §8º (um salário ao empregado) em vez de aceitar em silêncio — e quando o 10º dia cai em fim de semana ou feriado, a data-alvo anda para TRÁS, para o dia útil anterior, nos alertas D-5/3/1.', 'Desligamento confirmado com data-limite conhecida; tabela de feriados carregada.', '[{"acao": "Registrar pagamento das verbas no 11º dia após o término", "ordem": 1, "resultado_esperado": "Atraso acusado com a multa do §8º calculada (um salário), nunca aceitação silenciosa"}, {"acao": "Simular término cujo 10º dia cai no sábado", "ordem": 2, "resultado_esperado": "Data-alvo antecipada para a sexta-feira; alertas contados sobre a data antecipada"}, {"acao": "Conferir o painel de prazos", "ordem": 3, "resultado_esperado": "Rescisões com prazo em risco visíveis com a multa evitável projetada"}]', 'Prazo estourado tem nome e valor; dia não útil nunca empurra para depois.', 'Requisitos YE-DP-RESC-001: RN-004 / CA-005 / cenário "Prazo vencido" (seção 25) / RNF-002. A contagem (corridos × úteis) é [VAL] (seção 30) — o caso segue a interpretação consolidada de dias corridos já adotada no DESL-014.', 'api', 'CLT, art. 477, §§6º e 8º', 'em_triagem', NULL),
    ('DESL-020', 'Motivo do desligamento e obrigatorio', 'negativo', 'critica', 'aprovado', 'O motivo determina aviso, FGTS, seguro-desemprego e o codigo enviado ao eSocial.', 'Colaborador elegivel.', '[{"acao": "Tentar confirmar sem motivo", "ordem": 1, "resultado_esperado": "Bloqueado"}]', 'Sem motivo nao ha rescisao.', 'Implementado.', 'e2e', 'eSocial, evento S-2299, campo mtvDeslig (Tabela 19 do leiaute) — obrigatorio', 'em_triagem', NULL),
    ('DESL-021', 'Motivos disponiveis cobrem as hipoteses legais de extincao', 'alternativo', 'alta', 'aprovado', 'Cada hipotese legal precisa existir na lista, sob pena de o usuario escolher motivo aproximado e distorcer o calculo e o evento enviado.', 'Nenhuma.', '[{"acao": "Abrir a lista de motivos", "ordem": 1, "resultado_esperado": "Contem dispensa sem justa causa, dispensa com justa causa (art. 482), pedido de demissao, acordo mutuo (art. 484-A), termino de contrato, aposentadoria, falecimento, rescisao indireta (art. 483) e culpa reciproca (art. 484)"}, {"acao": "Conferir o mapeamento de cada motivo para o codigo da Tabela 19 do eSocial", "ordem": 2, "resultado_esperado": "Cada motivo corresponde ao codigo correto"}]', 'A lista cobre as hipoteses legais e mapeia corretamente para o eSocial.', 'Os nove motivos ja existem. O passo 2 nunca foi verificado e e o que importa: motivo certo na tela com codigo errado no evento produz inconsistencia que so aparece no retorno do eSocial.', 'e2e', 'CLT, arts. 477, 482 (justa causa), 483 (rescisao indireta), 484 (culpa reciproca), 484-A (acordo mutuo), 479/480 (contrato a termo); Tabela 19 do eSocial', 'em_triagem', NULL),
    ('DESL-022', 'Culpa reciproca depende de reconhecimento judicial', 'excecao', 'alta', 'aprovado', 'A culpa reciproca nao e declaravel pelo empregador. Ambos os dispositivos atribuem o reconhecimento a Justica do Trabalho.', 'Colaborador elegivel.', '[{"acao": "Selecionar culpa reciproca", "ordem": 1, "resultado_esperado": "O sistema exige referencia ao processo ou decisao que reconheceu a culpa reciproca"}, {"acao": "Confirmar sem essa referencia", "ordem": 2, "resultado_esperado": "Bloqueado ou, no minimo, alertado de forma destacada"}]', 'A escolha do motivo exige lastro na decisao judicial que o autoriza.', 'GAP: hoje culpa reciproca e selecionavel como qualquer outro motivo, sem nenhuma exigencia de lastro. Como o reconhecimento e judicial e posterior, vale discutir com o juridico se o motivo deve estar na tela de desligamento comum ou apenas em retificacao pos-sentenca.', 'e2e', 'CLT, art. 484 — "havendo culpa reciproca... O TRIBUNAL DO TRABALHO reduzira a indenizacao"; Lei 8.036/1990, art. 18, §2o — "reconhecida pela Justica do Trabalho"', 'em_triagem', NULL),
    ('DESL-023', 'Falecimento do empregado: verbas aos dependentes, sem aviso nem multa', 'excecao', 'media', 'aprovado', 'O falecimento extingue o contrato sem aviso prévio e sem multa de FGTS: as verbas devidas (saldo, férias + 1/3, 13º proporcional) são pagas aos dependentes habilitados ou sucessores, mediante documentação própria — e o fluxo não pode exigir assinatura do "colaborador" nem gerar seguro-desemprego. O eSocial usa motivo específico de desligamento por óbito.', 'Desligamento com motivo falecimento no ambiente de teste.', '[{"acao": "Processar o desligamento por falecimento", "ordem": 1, "resultado_esperado": "Sem aviso prévio e sem multa de FGTS; verbas devidas calculadas normalmente"}, {"acao": "Conferir o destinatário do pagamento", "ordem": 2, "resultado_esperado": "Dependentes/sucessores com documentação exigida (Lei 6.858), não o CPF do falecido"}, {"acao": "Conferir assinatura e seguro-desemprego", "ordem": 3, "resultado_esperado": "Fluxo de assinatura do colaborador dispensado; seguro-desemprego não ofertado"}]', 'Óbito encerra sem aviso nem multa; quem recebe é o dependente habilitado.', 'Requisitos YE-DP-RESC-001: fluxo "Falecimento" (seção 9). O motivo já existe na lista (DESL-021) e dispensa o retorno de suspensão (DESL-003); faltava o caso das VERBAS e do destinatário.', 'e2e', 'Lei 6.858/1980 (pagamento aos dependentes habilitados); CLT (extinção pelo falecimento)', 'em_triagem', NULL),
    ('DESL-024', 'Contrato a termo rescindido antes do prazo: indenizações dos arts. 479 e 480', 'alternativo', 'alta', 'aprovado', 'Contrato por prazo determinado rescindido ANTES do termo tem regra própria, e ela muda de lado: o empregador que dispensa sem justa causa paga metade da remuneração do período restante (art. 479); o empregado que pede demissão indeniza o empregador pelos prejuízos, no teto do art. 479 (art. 480). Sem cláusula assecuratória recíproca (art. 481), não há aviso prévio — há indenização.', 'Contratos a termo fictícios (experiência/determinado) com término futuro conhecido.', '[{"acao": "Empregador rescinde a termo faltando 60 dias", "ordem": 1, "resultado_esperado": "Indenização do art. 479: metade da remuneração dos 60 dias restantes, na memória de cálculo"}, {"acao": "Empregado pede demissão faltando 60 dias", "ordem": 2, "resultado_esperado": "Indenização do art. 480 a favor do empregador, limitada ao valor do art. 479"}, {"acao": "Contrato com cláusula assecuratória (art. 481)", "ordem": 3, "resultado_esperado": "Tratado como prazo indeterminado: aviso prévio em vez das indenizações"}]', 'Antecipou o fim do termo: indenização certa, do lado certo, com o teto certo.', 'Requisitos YE-DP-RESC-001: fluxo "Contrato por prazo determinado" (seção 9) / base legal arts. 479/480. O DESL-033 trata o AVISO no termo final e só cita a antecipação; este caso cobra o cálculo das indenizações.', 'e2e', 'CLT, arts. 479 (empregador indeniza metade do período restante) e 480 (empregado indeniza os prejuízos, limitado ao art. 479)', 'em_triagem', NULL),
    ('DESL-025', 'Justa causa e rescisão indireta exigem validação de perfil competente', 'negativo', 'alta', 'aprovado', 'Justa causa mal enquadrada é a modalidade que mais vira reversão judicial com verbas dobradas de volta. O documento exige que o enquadramento (art. 482) e a rescisão indireta (art. 483) passem por validação de perfil competente (jurídico), com as evidências anexadas — o DP sozinho não conclui, e a trilha registra quem validou o quê.', 'Desligamento aberto com motivo justa causa por usuário de DP, sem validação jurídica.', '[{"acao": "Tentar concluir a justa causa sem a validação competente", "ordem": 1, "resultado_esperado": "Retido — exige aprovação do perfil jurídico (ou papel configurado)"}, {"acao": "Anexar evidências e validar com o perfil competente", "ordem": 2, "resultado_esperado": "Conclusão liberada; trilha registra validador, data e evidências"}, {"acao": "Repetir com rescisão indireta (art. 483)", "ordem": 3, "resultado_esperado": "Mesmo rito de validação, no sentido inverso (falta grave do empregador)"}]', 'Modalidade grave só conclui com o crivo de quem responde por ela.', 'Requisitos YE-DP-RESC-001: RF-001 / cenário "Permissões insuficientes" (seção 25) / alerta "Modalidade a validar" (seção 14). O enquadramento em si é [VAL] jurídico — o caso testa o RITO, não o mérito.', 'api', 'CLT, arts. 482 e 483; matriz de perfis do documento (seção 6) — jurídico valida o enquadramento', 'em_triagem', NULL),
    ('DESL-030', 'Aviso previo proporcional: 30 dias mais 3 por ano, teto de 90', 'feliz', 'critica', 'aprovado', 'Calculo central da rescisao. Erro aqui contamina verba, prazo e evento.', 'Dispensa sem justa causa.', '[{"acao": "Colaborador com menos de 1 ano completo", "ordem": 1, "resultado_esperado": "30 dias"}, {"acao": "Colaborador com 5 anos completos", "ordem": 2, "resultado_esperado": "45 dias (30 + 15)"}, {"acao": "Colaborador com 10 anos completos", "ordem": 3, "resultado_esperado": "60 dias"}]', 'O calculo segue exatamente a formula da Lei 12.506/2011.', 'Implementado: min(30 + anos*3, 90). Requisitos YE-DP-RESC-001: RN-003/CA-003 (aviso proporcional da Lei 12.506/2011 e redução do art. 488).', 'e2e', 'CLT, art. 487, I e II; Lei 12.506/2011, art. 1o e paragrafo unico — 30 dias acrescidos de 3 dias por ano de servico na mesma empresa, ate o maximo de 60 dias adicionais, totalizando 90 dias', 'em_triagem', NULL),
    ('DESL-031', 'Fronteiras exatas do aviso previo proporcional', 'alternativo', 'critica', 'aprovado', 'O erro de aviso previo mora na borda, nao no meio: um ano incompleto contado como completo gera 3 dias a mais de verba, e o teto mal aplicado gera muito mais.', 'Dispensa sem justa causa.', '[{"acao": "364 dias de casa", "ordem": 1, "resultado_esperado": "30 dias — o ano nao se completou"}, {"acao": "Exatamente 1 ano", "ordem": 2, "resultado_esperado": "33 dias"}, {"acao": "Exatamente 20 anos", "ordem": 3, "resultado_esperado": "90 dias — o teto e alcancado exatamente aqui (30 + 60)"}, {"acao": "25 anos", "ordem": 4, "resultado_esperado": "90 dias — permanece no teto"}]', 'Cada virada acontece no ponto exato previsto em lei.', 'Quatro fronteiras, nenhuma testada no documento original. O passo 3 e o mais relevante: 20 anos e o ponto onde os 60 dias adicionais se esgotam, e e o unico lugar onde formula e teto coincidem. Requisitos YE-DP-RESC-001: RN-003/CA-003 (aviso proporcional da Lei 12.506/2011 e redução do art. 488).', 'e2e', 'Lei 12.506/2011, art. 1o, paragrafo unico — a proporcionalidade conta ANOS COMPLETOS de servico; o teto e de 60 dias adicionais', 'em_triagem', NULL),
    ('DESL-032', 'Justa causa nao gera aviso previo', 'negativo', 'critica', 'aprovado', 'Havendo justo motivo, nao ha dever de pre-aviso.', 'Motivo: dispensa com justa causa.', '[{"acao": "Selecionar dispensa com justa causa", "ordem": 1, "resultado_esperado": "Aviso marcado como nao aplicavel, 0 dias"}, {"acao": "Conferir as verbas", "ordem": 2, "resultado_esperado": "Nenhuma verba de aviso e gerada"}]', 'Justa causa afasta o aviso previo integralmente.', 'Implementado.', 'e2e', 'CLT, art. 487, caput — o aviso e devido quando NAO houver prazo estipulado e a parte quiser rescindir SEM JUSTO MOTIVO; CLT, art. 482 (hipoteses de justa causa)', 'em_triagem', NULL),
    ('DESL-033', 'Contrato por prazo determinado nao gera aviso previo no termo final', 'negativo', 'alta', 'aprovado', 'Chegando ao termo, o contrato se extingue por decurso, sem pre-aviso.', 'Motivo: termino de contrato.', '[{"acao": "Selecionar termino de contrato no termo final", "ordem": 1, "resultado_esperado": "Aviso nao aplicavel"}, {"acao": "Cenario de rescisao ANTECIPADA de contrato a termo", "ordem": 2, "resultado_esperado": "Regra distinta — arts. 479 e 480, indenizacao de metade da remuneracao do periodo restante"}]', 'O termo final nao gera aviso; a antecipacao segue os arts. 479 e 480.', 'O passo 2 aponta uma lacuna: o sistema tem um unico motivo "termino de contrato", que nao distingue termo final de rescisao antecipada. Sao regimes juridicos diferentes e verbas diferentes. Vale avaliar com o time se merece motivo proprio.', 'e2e', 'CLT, art. 487, caput (aviso aplica-se a contrato SEM prazo estipulado); CLT, art. 481 (clausula assecuratoria de direito reciproco de rescisao antecipada)', 'em_triagem', NULL),
    ('DESL-034', 'Acordo mutuo: aviso previo indenizado pela metade', 'alternativo', 'alta', 'aprovado', 'O acordo do art. 484-A tem regime proprio, com verbas reduzidas.', 'Motivo: acordo mutuo.', '[{"acao": "Colaborador com 5 anos, acordo mutuo", "ordem": 1, "resultado_esperado": "Metade de 45, ou seja 23 dias (arredondamento para cima)"}, {"acao": "Colaborador com menos de 1 ano", "ordem": 2, "resultado_esperado": "15 dias"}, {"acao": "Conferir se a reducao vale para aviso INDENIZADO", "ordem": 3, "resultado_esperado": "A reducao do inciso I, a, refere-se ao aviso indenizado"}]', 'O aviso e reduzido a metade conforme o art. 484-A, I, "a".', 'O passo 1 fixa a regra de arredondamento: 45/2 = 22,5 e o sistema usa Math.ceil, resultando 23. A lei nao trata da fracao; adotar arredondamento a favor do empregado e a escolha conservadora e deve ficar registrada como decisao, nao como acidente. Requisitos YE-DP-RESC-001: cenário "Acordo 484-A" (seção 25) — aviso pela metade, FGTS 20%, sem seguro-desemprego.', 'e2e', 'CLT, art. 484-A, I, "a" (incluido pela Lei 13.467/2017) — sao devidos pela metade o aviso previo, se indenizado', 'em_triagem', NULL),
    ('DESL-035', 'Culpa reciproca: aviso previo devido pela metade', 'excecao', 'critica', 'aprovado', 'A culpa reciproca reduz as verbas pela metade, mas NAO as elimina.', 'Motivo: culpa reciproca, com reconhecimento judicial.', '[{"acao": "Colaborador com 5 anos, culpa reciproca", "ordem": 1, "resultado_esperado": "Aviso devido pela metade — 23 dias, nao zero"}, {"acao": "Conferir 13o proporcional", "ordem": 2, "resultado_esperado": "50% do valor"}, {"acao": "Conferir ferias proporcionais", "ordem": 3, "resultado_esperado": "50% do valor"}]', 'As tres verbas da Sumula 14 sao pagas pela metade.', 'DIVERGENCIA CONFIRMADA: o sistema inclui culpa_reciproca na lista de motivos SEM aviso previo, gerando 0 dias. A Sumula 14 determina 50%. Este caso deve falhar e ser encaminhado para correcao. Observar que a Sumula alcanca tambem 13o e ferias proporcionais, que o sistema pode estar tratando de forma integral ou zerada — ambos errados. Requisitos YE-DP-13-001: a conciliação do 13º na rescisão (adiantamento pago, rodada anual) ganhou caso próprio (DEC13-060).', 'e2e', 'Sumula 14 do TST — reconhecida a culpa reciproca (art. 484 da CLT), o empregado tem direito a 50% do valor do aviso previo, do decimo terceiro salario e das ferias proporcionais', 'em_triagem', NULL),
    ('DESL-036', 'Aviso indenizado gera verba; aviso cumprido nao', 'alternativo', 'alta', 'aprovado', 'A verba indenizatoria substitui o periodo nao trabalhado. Cumprido o aviso, nao ha o que indenizar.', 'Motivo com aviso aplicavel.', '[{"acao": "Marcar aviso como trabalhado e cumprido", "ordem": 1, "resultado_esperado": "Nenhuma verba indenizatoria de aviso"}, {"acao": "Marcar aviso como indenizado", "ordem": 2, "resultado_esperado": "Verba correspondente aos dias calculados"}, {"acao": "Pedido de demissao sem cumprimento do aviso pelo empregado", "ordem": 3, "resultado_esperado": "Desconto correspondente, conforme §2o"}]', 'A verba acompanha o cumprimento, nos dois sentidos.', 'O passo 3 e o menos coberto: o §2o autoriza DESCONTO quando quem falta com o aviso e o empregado. Vale conferir se o sistema trata esse sinal invertido.', 'e2e', 'CLT, art. 487, §1o (falta de aviso pelo empregador da ao empregado direito aos salarios do periodo) e §2o (falta de aviso pelo empregado autoriza desconto)', 'em_triagem', NULL),
    ('DESL-037', 'Aviso trabalhado assegura reducao de jornada', 'alternativo', 'media', 'aprovado', 'A reducao e direito indisponivel no aviso trabalhado e afeta a apuracao do ponto.', 'Aviso previo do tipo trabalhado.', '[{"acao": "Registrar aviso trabalhado", "ordem": 1, "resultado_esperado": "O sistema sinaliza a reducao do art. 488 para o periodo"}, {"acao": "Conferir reflexo na apuracao do ponto no periodo do aviso", "ordem": 2, "resultado_esperado": "As 2 horas diarias nao sao tratadas como falta ou atraso"}]', 'O periodo de aviso trabalhado reflete a reducao legal na jornada.', 'GAP PROVAVEL e de alto impacto: o modulo de ponto nao sabe que o colaborador esta em aviso previo trabalhado. Sem isso, a reducao do art. 488 vira atraso e pode gerar desconto indevido no ultimo mes. Vale investigar a integracao entre desligamento e apuracao. Requisitos YE-DP-RESC-001: RN-003/CA-003 (aviso proporcional da Lei 12.506/2011 e redução do art. 488).', 'e2e', 'CLT, art. 488 — durante o aviso trabalhado, a jornada e reduzida em 2 horas diarias, sem prejuizo do salario; paragrafo unico — facultado ao empregado optar por faltar 7 dias corridos', 'em_triagem', NULL),
    ('DESL-040', 'Indenizacao de 40% do FGTS na dispensa sem justa causa', 'feliz', 'critica', 'aprovado', 'Verba de maior valor da rescisao sem justa causa.', 'Motivo: dispensa sem justa causa.', '[{"acao": "Selecionar dispensa sem justa causa", "ordem": 1, "resultado_esperado": "Percentual 40% aplicado"}, {"acao": "Conferir a base de calculo", "ordem": 2, "resultado_esperado": "Incide sobre o MONTANTE DOS DEPOSITOS atualizados, nao sobre o salario"}]', 'A indenizacao de 40% e aplicada sobre a base correta.', 'ATENCAO NO PASSO 2: o codigo calcula multaFgtsValor como salarioBase * percentual. O §1o define a base como o montante dos depositos do FGTS atualizado monetariamente, nao o salario. Se a implementacao usa salario, o valor esta errado em qualquer contrato com mais de um mes. Precisa confirmacao do time — pode ser simplificacao consciente para estimativa em tela, mas nao pode ir para a folha assim. Requisitos YE-DP-RESC-001: RN-005/CA-004/CA-006 (FGTS 40%/20% por modalidade) — a guia do FGTS Digital ganhou caso próprio (DESL-057).', 'e2e', 'Lei 8.036/1990, art. 18, §1o — na despedida sem justa causa, deposito de importancia igual a 40% do montante dos depositos do FGTS, atualizados', 'em_triagem', NULL),
    ('DESL-041', 'Indenizacao de 20% do FGTS no acordo mutuo', 'alternativo', 'alta', 'aprovado', 'O acordo reduz a indenizacao a metade dos 40%.', 'Motivo: acordo mutuo.', '[{"acao": "Selecionar acordo mutuo", "ordem": 1, "resultado_esperado": "Percentual 20%"}]', 'Metade da indenizacao do art. 18, §1o.', 'Implementado. Requisitos YE-DP-RESC-001: RN-005/CA-004/CA-006 (FGTS 40%/20% por modalidade) — a guia do FGTS Digital ganhou caso próprio (DESL-057).', 'e2e', 'CLT, art. 484-A, I, "b" — devida pela metade a indenizacao sobre o saldo do FGTS prevista no §1o do art. 18 da Lei 8.036/1990', 'em_triagem', NULL),
    ('DESL-042', 'Indenizacao de 20% do FGTS na culpa reciproca', 'excecao', 'critica', 'aprovado', 'A culpa reciproca reduz a indenizacao pela metade, nao a elimina.', 'Motivo: culpa reciproca reconhecida judicialmente.', '[{"acao": "Selecionar culpa reciproca", "ordem": 1, "resultado_esperado": "Percentual 20%"}, {"acao": "Conferir se ha exigencia de referencia ao reconhecimento judicial", "ordem": 2, "resultado_esperado": "O §2o condiciona os 20% ao reconhecimento pela Justica do Trabalho"}]', 'Culpa reciproca gera 20%, condicionada ao reconhecimento judicial.', 'DIVERGENCIA CONFIRMADA: o sistema retorna 0% para culpa reciproca. O art. 18, §2o determina 20%. Deve falhar e ir para correcao, junto com DESL-035. O par culpa reciproca (aviso zerado + FGTS zerado) sugere que o motivo foi adicionado a lista sem que as regras dele fossem implementadas. Requisitos YE-DP-RESC-001: RN-005/CA-004/CA-006 (FGTS 40%/20% por modalidade) — a guia do FGTS Digital ganhou caso próprio (DESL-057).', 'e2e', 'Lei 8.036/1990, art. 18, §2o — ocorrendo despedida por culpa reciproca ou forca maior, RECONHECIDA PELA JUSTICA DO TRABALHO, o percentual sera de 20%', 'em_triagem', NULL),
    ('DESL-043', 'Pedido de demissao e justa causa nao geram indenizacao de FGTS', 'negativo', 'alta', 'aprovado', 'Evitar verba indevida.', 'Nenhuma.', '[{"acao": "Pedido de demissao", "ordem": 1, "resultado_esperado": "0%"}, {"acao": "Dispensa com justa causa", "ordem": 2, "resultado_esperado": "0%"}]', 'Nenhuma indenizacao nessas hipoteses.', 'Implementado. Requisitos YE-DP-RESC-001: RN-005/CA-004/CA-006 (FGTS 40%/20% por modalidade) — a guia do FGTS Digital ganhou caso próprio (DESL-057).', 'e2e', 'Lei 8.036/1990, art. 18, §1o — a indenizacao e devida na despedida SEM JUSTA CAUSA; nao alcanca pedido de demissao nem dispensa por justa causa', 'em_triagem', NULL),
    ('DESL-044', 'Rescisao indireta equipara-se a dispensa sem justa causa', 'alternativo', 'alta', 'aprovado', 'A rescisao indireta produz os mesmos efeitos economicos da dispensa sem justa causa.', 'Motivo: rescisao indireta.', '[{"acao": "Selecionar rescisao indireta", "ordem": 1, "resultado_esperado": "Indenizacao de FGTS em 40%"}, {"acao": "Conferir aviso previo", "ordem": 2, "resultado_esperado": "Devido, com proporcionalidade da Lei 12.506/2011"}, {"acao": "Conferir seguro-desemprego", "ordem": 3, "resultado_esperado": "Elegivel"}]', 'Todos os efeitos economicos da dispensa imotivada.', 'Implementado corretamente no sistema (40% e seguro elegivel). Caso de protecao: uma simplificacao futura que trate apenas "sem_justa_causa" quebraria a rescisao indireta em silencio.', 'e2e', 'CLT, art. 483 — o empregado podera considerar rescindido o contrato e pleitear a devida indenizacao nas hipoteses das alineas "a" a "g"; equiparacao aos efeitos da dispensa imotivada', 'em_triagem', NULL),
    ('DESL-045', 'Verbas indenizatórias sem INSS/IRRF; saldo de salário com', 'feliz', 'alta', 'aprovado', 'A rescisão mistura naturezas: saldo de salário e 13º proporcional sofrem INSS/IRRF; aviso prévio INDENIZADO e férias INDENIZADAS + 1/3 são verbas indenizatórias — fora da base de INSS/IRRF conforme a jurisprudência consolidada. Tributar tudo igual desconta a mais do desligado; isentar tudo deixa encargo patronal para trás. A memória de cálculo precisa mostrar verba a verba a incidência aplicada.', 'Rescisão sem justa causa com aviso indenizado, férias vencidas + proporcionais e 13º proporcional.', '[{"acao": "Calcular a rescisão e abrir a memória", "ordem": 1, "resultado_esperado": "Cada verba com a natureza (remuneratória/indenizatória) e as incidências marcadas"}, {"acao": "Conferir INSS/IRRF do aviso indenizado e das férias indenizadas", "ordem": 2, "resultado_esperado": "Fora da base — sem retenção sobre as indenizatórias"}, {"acao": "Conferir saldo de salário e 13º proporcional", "ordem": 3, "resultado_esperado": "Na base — INSS (com 13º em cálculo separado) e IRRF conforme tabelas vigentes"}]', 'Cada verba com sua natureza; a memória prova o enquadramento.', 'Requisitos YE-DP-RESC-001: RN-007 / seção 30 (tratamento tributário é [VAL] com a contabilidade). Regras por verba parametrizadas (RNF-003). O 13º na rescisão concilia com DEC13-060.', 'e2e', 'Lei 8.212/1991, art. 28, §9º; IN RFB; jurisprudência consolidada (aviso indenizado e férias indenizadas + 1/3 não integram o salário de contribuição)', 'em_triagem', NULL),
    ('DESL-046', 'Base das verbas rescisórias inclui as médias das variáveis', 'feliz', 'alta', 'aprovado', 'Quem tem horas extras habituais, comissões ou adicionais não pode ter rescisão calculada só sobre o fixo: aviso indenizado, férias + 1/3 e 13º proporcional levam a MÉDIA das variáveis na base. Rescisão pelo fixo, para quem tem variável habitual, é a diferença mais comum em reclamatória — e a mais fácil de provar contra a empresa.', 'Vínculo com salário fixo e variáveis habituais lançadas na folha; rescisão sem justa causa.', '[{"acao": "Calcular a rescisão do vínculo com variáveis", "ordem": 1, "resultado_esperado": "Base das verbas = fixo + média das variáveis, com a composição na memória"}, {"acao": "Conferir rubricas que integraram a média", "ordem": 2, "resultado_esperado": "Somente rubricas parametrizadas (incide_rescisao) e do período correto"}, {"acao": "Calcular com médias incompletas (competência sem lançamento)", "ordem": 3, "resultado_esperado": "Alerta de base incompleta ANTES de fechar as verbas"}]', 'Variável habitual entra na rescisão pela média — e avisada quando faltar.', 'Requisitos YE-DP-RESC-001: RF-004 / cenário "Dado ausente" (seção 25) / dado "Médias de variáveis" (seção 12). folha_rubricas.incide_rescisao existe — o caso testa se alguém a consome (par do DEC13-020 no 13º). Requisitos YE-DP-FOLHA-001: o lado FOLHA (reflexo do apurado no cálculo e no DSR) está em FOLHA-020/022.', 'e2e', 'CLT, arts. 457/458 (remuneração); art. 487, §3º (aviso com base na remuneração); Súmula 347 do TST (média de horas extras nas verbas)', 'em_triagem', NULL),
    ('DESL-050', 'Dispensa sem justa causa habilita o seguro-desemprego', 'feliz', 'alta', 'aprovado', 'A elegibilidade orienta o encaminhamento do trabalhador.', 'Motivo: dispensa sem justa causa.', '[{"acao": "Selecionar o motivo", "ordem": 1, "resultado_esperado": "Marcado como elegivel"}]', 'Elegibilidade sinalizada.', 'Implementado. O sistema sinaliza elegibilidade ao PROGRAMA; o deferimento depende de requisitos de carencia do art. 3o que o sistema nao afere.', 'e2e', 'Lei 7.998/1990, art. 2o, I e art. 3o — assistencia financeira temporaria ao trabalhador dispensado SEM JUSTA CAUSA', 'em_triagem', NULL),
    ('DESL-051', 'Acordo mutuo NAO habilita o seguro-desemprego', 'negativo', 'critica', 'aprovado', 'Vedacao expressa em lei. Sinalizar elegibilidade induziria o trabalhador a erro.', 'Motivo: acordo mutuo.', '[{"acao": "Selecionar acordo mutuo", "ordem": 1, "resultado_esperado": "NAO elegivel"}, {"acao": "Conferir se ha aviso ao usuario sobre a vedacao", "ordem": 2, "resultado_esperado": "Idealmente informado, citando o §2o"}]', 'Nao elegivel, por vedacao expressa.', 'Implementado. O passo 2 e melhoria: o acordo do art. 484-A e frequentemente proposto ao trabalhador sem que ele saiba que perde o seguro. Informar isso na tela e boa pratica de conformidade. Requisitos YE-DP-RESC-001: cenário "Acordo 484-A" (seção 25) — aviso pela metade, FGTS 20%, sem seguro-desemprego.', 'e2e', 'CLT, art. 484-A, §2o — a extincao por acordo NAO AUTORIZA o ingresso no Programa de Seguro-Desemprego', 'em_triagem', NULL),
    ('DESL-052', 'Pedido de demissao e justa causa nao habilitam o seguro', 'negativo', 'alta', 'aprovado', 'Evitar indicacao indevida de beneficio.', 'Nenhuma.', '[{"acao": "Pedido de demissao", "ordem": 1, "resultado_esperado": "Nao elegivel"}, {"acao": "Justa causa", "ordem": 2, "resultado_esperado": "Nao elegivel"}]', 'Nao elegivel em ambas.', 'Implementado.', 'e2e', 'Lei 7.998/1990, art. 2o, I — o beneficio destina-se ao dispensado sem justa causa', 'em_triagem', NULL),
    ('DESL-055', 'Saque do FGTS conforme a hipotese legal do motivo', 'alternativo', 'alta', 'aprovado', 'A chave de conectividade so faz sentido quando ha hipotese de saque.', 'Nenhuma.', '[{"acao": "Dispensa sem justa causa", "ordem": 1, "resultado_esperado": "Saque integral permitido; chave exigida"}, {"acao": "Acordo mutuo", "ordem": 2, "resultado_esperado": "Movimentacao limitada a 80% do saldo, conforme art. 484-A, §1o"}, {"acao": "Pedido de demissao", "ordem": 3, "resultado_esperado": "Sem hipotese de saque; chave nao exigida"}]', 'A exigencia da chave acompanha a hipotese legal de movimentacao.', 'O passo 2 e o mais provavel de estar faltando: o limite de 80% do §1o e especifico do acordo e raramente implementado. Vale conferir se o sistema apenas permite o saque ou tambem informa o limite.', 'e2e', 'Lei 8.036/1990, art. 20, I (despedida sem justa causa), I-A (extincao por acordo do art. 484-A, movimentacao limitada a 80%), IX (extincao normal do contrato a termo); CLT, art. 484-A, §1o', 'em_triagem', NULL),
    ('DESL-057', 'Guia rescisória no FGTS Digital com o percentual da modalidade e contingência', 'alternativo', 'alta', 'aprovado', 'Apurada a multa (40% sem justa causa; 20% no acordo; zero em pedido/justa causa — DESL-040..043), o recolhimento acontece no FGTS DIGITAL: a guia rescisória é gerada com base e percentual da modalidade e prazo próprio. Indisponibilidade do serviço não pode perder o prazo: a guia entra em fila de reprocessamento com alerta, e o comprovante final é arquivado no dossiê.', 'Rescisão sem justa causa apurada, com base de FGTS conhecida.', '[{"acao": "Gerar a guia rescisória", "ordem": 1, "resultado_esperado": "Guia do FGTS Digital com base, percentual da modalidade (40%) e prazo"}, {"acao": "Simular indisponibilidade do FGTS Digital", "ordem": 2, "resultado_esperado": "Fila de reprocessamento + alerta; a guia não se perde nem o prazo passa em silêncio"}, {"acao": "Recolher e anexar o comprovante", "ordem": 3, "resultado_esperado": "Comprovante arquivado em Documentos, vinculado ao desligamento"}]', 'Multa certa, guia gerada, contingência sem perder o prazo.', 'Requisitos YE-DP-RESC-001: RN-005 / CA-006 / fluxo "FGTS Digital indisponível" (seção 9) / RNF-008. O fluxo vigente do FGTS Digital é [VAL] (seção 30). Percentuais já testados em DESL-040..043 — aqui se testa a GUIA e a contingência.', 'api', 'Lei 8.036/1990; FGTS Digital (guia rescisória); CLT, art. 484-A (20% no acordo)', 'em_triagem', NULL),
    ('DESL-060', 'Sem exame ocupacional anterior, o demissional e obrigatorio', 'feliz', 'critica', 'aprovado', 'Sem exame anterior nao ha o que dispensar.', 'Colaborador sem nenhum ASO ocupacional registrado.', '[{"acao": "Abrir o desligamento", "ordem": 1, "resultado_esperado": "Alerta informando ausencia de ASO e obrigatoriedade do demissional"}, {"acao": "Tentar confirmar sem o exame", "ordem": 2, "resultado_esperado": "Bloqueado"}]', 'O exame demissional e exigido e a confirmacao fica bloqueada.', 'Implementado como RNDES16. Requisitos YE-DP-SST-001: o lado SST (documentos, periodicidade, OS/ficha, eSocial SST) está na família SST-001..080.', 'e2e', 'NR-07, item 7.5.11 (redacao da Portaria SEPRT 6.734/2020, vigente desde 03/01/2022) — a dispensa do exame demissional pressupoe exame ocupacional recente; inexistindo, nao ha dispensa. CLT, art. 168, II', 'em_triagem', NULL),
    ('DESL-061', 'Grau de risco 1 ou 2: exame ha menos de 135 dias dispensa o demissional', 'alternativo', 'alta', 'aprovado', 'Evitar exame desnecessario dentro do prazo de validade da norma.', 'Empresa de grau 1 ou 2, colaborador com ASO ha 100 dias.', '[{"acao": "Abrir o desligamento", "ordem": 1, "resultado_esperado": "Exame demissional dispensado"}, {"acao": "Confirmar sem novo exame", "ordem": 2, "resultado_esperado": "Permitido"}]', 'A dispensa e reconhecida dentro do prazo.', 'Implementado: o sistema le o grau de risco da empresa e o ultimo atestado.', 'e2e', 'NR-07, item 7.5.11 — dispensa quando o exame clinico ocupacional mais recente foi realizado HA MENOS DE 135 dias, para organizacoes de graus de risco 1 e 2; grau conforme Quadro I da NR-04', 'em_triagem', NULL),
    ('DESL-062', 'Grau 1 ou 2: exatamente 135 dias NAO dispensa o demissional', 'excecao', 'critica', 'aprovado', 'Fronteira exata da norma. E onde o erro de comparacao mora.', 'Empresa de grau 1 ou 2, colaborador com ultimo ASO ha exatamente 135 dias.', '[{"acao": "Abrir o desligamento", "ordem": 1, "resultado_esperado": "Exame demissional OBRIGATORIO"}, {"acao": "Tentar confirmar sem novo exame", "ordem": 2, "resultado_esperado": "Bloqueado"}, {"acao": "Testar 134 dias", "ordem": 3, "resultado_esperado": "Dispensado — aqui sim esta dentro do prazo"}]', 'A dispensa vale ate 134 dias; em 135 o exame volta a ser exigido.', 'DIVERGENCIA CONFIRMADA: o sistema usa a comparacao dias <= limite, o que dispensa o exame em 135 dias exatos. A norma exige "ha menos de", ou seja, dias < limite. Deve falhar. Correcao: trocar <= por <. Erro de um dia, mas com consequencia de autuacao e de nulidade da dispensa do exame.', 'e2e', 'NR-07, item 7.5.11 — a dispensa exige exame realizado "HA MENOS DE 135 dias". 135 dias nao e menos de 135 dias: no limite exato, o exame e devido', 'em_triagem', NULL),
    ('DESL-063', 'Grau de risco 3 ou 4: exame ha menos de 90 dias dispensa o demissional', 'alternativo', 'alta', 'aprovado', 'Atividades de maior risco tem prazo de validade menor.', 'Empresa de grau 3 ou 4, colaborador com ASO ha 60 dias.', '[{"acao": "Abrir o desligamento", "ordem": 1, "resultado_esperado": "Dispensado"}, {"acao": "Conferir se o prazo aplicado foi 90 e nao 135", "ordem": 2, "resultado_esperado": "90 dias, conforme o grau"}]', 'O prazo menor e corretamente aplicado ao grau mais alto.', 'O passo 2 protege contra a inversao dos prazos, erro que passaria despercebido em empresas de grau 1 e 2.', 'e2e', 'NR-07, item 7.5.11 — dispensa quando o exame mais recente foi realizado HA MENOS DE 90 dias, para organizacoes de graus de risco 3 e 4; Quadro I da NR-04', 'em_triagem', NULL),
    ('DESL-064', 'Grau 3 ou 4: exatamente 90 dias NAO dispensa o demissional', 'excecao', 'critica', 'aprovado', 'Mesma fronteira do DESL-062, no prazo mais curto e no risco mais alto.', 'Empresa de grau 3 ou 4, ultimo ASO ha exatamente 90 dias.', '[{"acao": "Abrir o desligamento", "ordem": 1, "resultado_esperado": "Exame OBRIGATORIO"}, {"acao": "Testar 89 dias", "ordem": 2, "resultado_esperado": "Dispensado"}]', 'A dispensa vale ate 89 dias; em 90 o exame e devido.', 'DIVERGENCIA CONFIRMADA, mesma causa do DESL-062. Aqui e mais grave: grau 3 e 4 abrangem atividades de risco elevado, onde o exame demissional tem maior valor probatorio em eventual discussao de doenca ocupacional.', 'e2e', 'NR-07, item 7.5.11 — dispensa apenas se realizado "HA MENOS DE 90 dias"', 'em_triagem', NULL),
    ('DESL-065', 'Exame demissional deve ocorrer em ate 10 dias do termino do contrato', 'alternativo', 'alta', 'aprovado', 'A norma impoe prazo proprio ao exame, distinto do prazo de pagamento do art. 477.', 'Desligamento com exame demissional obrigatorio.', '[{"acao": "Confirmar desligamento com exame obrigatorio", "ordem": 1, "resultado_esperado": "O sistema registra a data limite para o exame — termino mais 10 dias"}, {"acao": "Consultar desligamentos com exame pendente alem do prazo", "ordem": 2, "resultado_esperado": "Aparecem como pendencia de conformidade"}]', 'O prazo de 10 dias do item 7.5.11 e controlado e cobravel.', 'GAP: o sistema nao controla esse prazo em lugar nenhum. Ele coincide numericamente com os 10 dias do art. 477, §6o da CLT, mas sao prazos DIFERENTES, de normas diferentes, com consequencias diferentes — um gera multa trabalhista ao empregado, o outro autuacao por descumprimento de NR. Tratar como o mesmo prazo seria erro conceitual.', 'api', 'NR-07, item 7.5.11 — no exame demissional, o exame clinico DEVE SER REALIZADO EM ATE 10 DIAS contados do termino do contrato', 'aguardando_construcao', 'Funcionalidade ainda não construída. A fundamentação legal está registrada no caso e serve como especificação. Falha esperada até a entrega.'),
    ('DESL-066', 'ASO exige identificacao completa do medico e do resultado', 'excecao', 'critica', 'aprovado', 'ASO sem medico identificado, sem CRM e sem resultado nao e ASO — e um campo de data preenchido.', 'Cenario com exame demissional obrigatorio.', '[{"acao": "Preencher apenas a data do exame e confirmar", "ordem": 1, "resultado_esperado": "BLOQUEADO — faltam resultado, medico e inscricao no conselho"}, {"acao": "Anexar somente o arquivo, sem os demais campos", "ordem": 2, "resultado_esperado": "BLOQUEADO — o anexo nao substitui os dados estruturados"}, {"acao": "Preencher data, resultado, medico, inscricao e anexo", "ordem": 3, "resultado_esperado": "Permitido"}]', 'Somente o ASO completo libera a confirmacao.', 'DIVERGENCIA CONFIRMADA: o sistema libera com "arquivo anexado OU data preenchida". E possivel confirmar desligamento informando apenas uma data, sem resultado, sem medico e sem CRM. Os passos 1 e 2 devem falhar. Este e o gap de maior risco de autuacao do modulo, porque produz aparencia de conformidade sem lastro. CONFIRMAR com o time a numeracao exata dos itens 7.5.19 e 7.5.20 contra o texto vigente da NR-07 antes de fechar a fundamentacao. | FUNDAMENTACAO CONFIRMADA 31/07/2026: a citacao anterior ("itens 7.5.19 e 7.5.20") estava marcada para conferir. O item correto do conteudo do ASO e 7.5.19.1. O achado do caso nao muda — apenas passa a ter a citacao exata.', 'e2e', 'NR-07, item 7.5.19.1 (Portaria SEPRT 6.734/2020) — o ASO deve conter razao social e CNPJ ou CAEPF da organizacao, nome e CPF do trabalhador, os riscos ocupacionais, a conclusao quanto a aptidao, e nome, CRM e assinatura do medico responsavel; CLT, art. 168, §5o', 'em_triagem', NULL),
    ('DESL-067', 'Resultado do ASO limitado as conclusoes previstas na norma', 'alternativo', 'media', 'aprovado', 'Conclusao livre em texto impede tratamento automatizado e comparacao historica.', 'Cenario com ASO obrigatorio.', '[{"acao": "Abrir a lista de resultados", "ordem": 1, "resultado_esperado": "Apenas apto, inapto e apto com restricoes"}, {"acao": "Selecionar inapto e confirmar", "ordem": 2, "resultado_esperado": "Permitido, porem com alerta destacado"}]', 'Apenas as tres conclusoes sao aceitas.', 'PERGUNTA EM ABERTO do documento original, que mantenho: ASO demissional com resultado INAPTO pode indicar doenca ocupacional nao diagnosticada e, com ela, estabilidade do art. 118 da Lei 8.213/1991 (ver Sumula 378, II, do TST, que alcanca doenca profissional constatada apos a despedida). Hoje o sistema aceita inapto sem qualquer alerta. Decisao juridica necessaria: bloquear, alertar ou apenas registrar.', 'e2e', 'NR-07 — o ASO registra a conclusao quanto a aptidao para a funcao: apto, inapto ou apto com restricoes', 'em_triagem', NULL),
    ('DESL-070', 'Estabilidade da gestante bloqueia dispensa imotivada', 'negativo', 'critica', 'aprovado', 'Garantia constitucional de emprego.', 'Colaboradora com gravidez confirmada ou dentro de 5 meses do parto.', '[{"acao": "Tentar dispensa sem justa causa", "ordem": 1, "resultado_esperado": "Bloqueado, com indicacao da estabilidade e do dispositivo"}, {"acao": "Conferir contrato por prazo determinado", "ordem": 2, "resultado_esperado": "Tambem protegido, conforme Sumula 244, III"}]', 'A dispensa imotivada e impedida durante toda a estabilidade.', 'PARCIALMENTE implementado, e por HEURISTICA: o sistema deduz a gravidez pela presenca de CID obstetrico em atestado. Isso erra nos dois sentidos — gestante sem atestado no sistema passa direto, e CID obstetrico de outra natureza gera falso positivo. Ver DESL-077. Requisitos YE-DP-RESC-001: RN-002/CA-002 (estabilidades bloqueiam antes de concluir; jurídico acionado).', 'e2e', 'ADCT, art. 10, II, "b" — vedada a dispensa arbitraria ou sem justa causa da empregada gestante, desde a confirmacao da gravidez ate 5 meses apos o parto; Sumula 244 do TST (III — aplica-se tambem ao contrato por prazo determinado)', 'em_triagem', NULL),
    ('DESL-071', 'Estabilidade acidentaria de 12 meses bloqueia dispensa imotivada', 'negativo', 'critica', 'aprovado', 'Garantia legal de emprego pos-acidente.', 'Colaborador com afastamento acidentario encerrado ha menos de 12 meses.', '[{"acao": "Tentar dispensa sem justa causa", "ordem": 1, "resultado_esperado": "Bloqueado, citando o art. 118"}, {"acao": "Conferir a contagem", "ordem": 2, "resultado_esperado": "12 meses contados da CESSACAO do auxilio-doenca acidentario, nao do acidente"}, {"acao": "Colaborador com afastamento comum, sem nexo", "ordem": 3, "resultado_esperado": "Sem estabilidade do art. 118"}]', 'A estabilidade e reconhecida e contada a partir do marco correto.', 'Implementado, com dependencia do campo nexo_trabalho estar preenchido. O passo 3 e a contraprova: afastamento comum nao gera estabilidade, e tratar todo afastamento como acidentario travaria dispensas legitimas. Requisitos YE-DP-RESC-001: RN-002/CA-002 (estabilidades bloqueiam antes de concluir; jurídico acionado). Requisitos YE-DP-AFAST-001: o lado AFASTAMENTOS (registro, efeito e reflexo) está em AFAST-010..080.', 'e2e', 'Lei 8.213/1991, art. 118 — o segurado que sofreu acidente do trabalho tem garantida a manutencao do contrato por no minimo 12 meses apos a cessacao do auxilio-doenca acidentario; Sumula 378 do TST (II — requisitos; alcanca doenca profissional constatada apos a despedida)', 'em_triagem', NULL),
    ('DESL-072', 'Estabilidade de dirigente sindical bloqueia dispensa', 'negativo', 'critica', 'aprovado', 'Garantia constitucional que o sistema nao verifica.', 'Colaborador registrado como dirigente sindical ou candidato.', '[{"acao": "Registrar a condicao de dirigente sindical no cadastro", "ordem": 1, "resultado_esperado": "O sistema precisa ter onde registrar isso"}, {"acao": "Tentar dispensa sem justa causa", "ordem": 2, "resultado_esperado": "Bloqueado"}, {"acao": "Tentar dispensa por justa causa", "ordem": 3, "resultado_esperado": "Bloqueado tambem — o art. 543, §3o exige inquerito judicial previo, nao basta a justa causa"}]', 'O dirigente sindical so pode ser dispensado apos inquerito judicial.', 'GAP TOTAL: nao existe campo para registrar a condicao de dirigente sindical, nem verificacao. O passo 1 sozinho ja demanda trabalho de cadastro. ATENCAO ao passo 3: o sistema hoje libera qualquer estabilidade quando o motivo e justa causa. Para dirigente sindical isso esta ERRADO — a CLT exige inquerito judicial previo. E a excecao da excecao. Requisitos YE-DP-RESC-001: RN-002/CA-002 (estabilidades bloqueiam antes de concluir; jurídico acionado).', 'api', 'CF/1988, art. 8o, VIII; CLT, art. 543, §3o — vedada a dispensa desde o registro da candidatura ate 1 ano apos o final do mandato, salvo falta grave APURADA EM INQUERITO JUDICIAL (CLT, arts. 494 e 853); Sumula 369 do TST', 'em_triagem', NULL),
    ('DESL-073', 'Estabilidade de membro da CIPA bloqueia dispensa arbitraria', 'negativo', 'critica', 'aprovado', 'Garantia constitucional que o sistema nao verifica, apesar de o proprio produto gerenciar mandato da CIPA no modulo de Empresa.', 'Colaborador eleito titular ou suplente da CIPA, dentro do periodo protegido.', '[{"acao": "Tentar dispensa sem justa causa de membro TITULAR", "ordem": 1, "resultado_esperado": "Bloqueado"}, {"acao": "Repetir com membro SUPLENTE", "ordem": 2, "resultado_esperado": "Bloqueado tambem, conforme Sumula 339, I"}, {"acao": "Colaborador cujo mandato terminou ha mais de 1 ano", "ordem": 3, "resultado_esperado": "Sem estabilidade"}]', 'Titulares e suplentes sao protegidos ate 1 ano apos o mandato.', 'GAP TOTAL, e o mais facil de fechar: o modulo de Empresa JA controla mandato da CIPA (cipa_data_mandato_inicio e cipa_data_mandato_fim) e ja tem caso de renovacao. Falta apenas ligar a composicao nominal da comissao ao cadastro do colaborador. O passo 2 e o mais esquecido — a Sumula 339 estende a garantia ao suplente, e sistemas costumam proteger so o titular. Requisitos YE-DP-RESC-001: RN-002/CA-002 (estabilidades bloqueiam antes de concluir; jurídico acionado).', 'api', 'ADCT, art. 10, II, "a" — vedada a dispensa arbitraria ou sem justa causa do empregado eleito para cargo de direcao de comissoes internas de prevencao de acidentes, desde o registro da candidatura ate 1 ano apos o final do mandato; Sumula 339 do TST (I — a garantia alcanca o SUPLENTE)', 'em_triagem', NULL),
    ('DESL-074', '[A CONSTRUIR] Estabilidade pre-aposentadoria prevista em CCT', 'negativo', 'alta', 'rascunho', 'ESPECIFICACAO. Diferente das demais estabilidades, esta nao vem da lei: cada CCT define periodo e condicoes. Sem cadastro de CCT nao ha como verificar.', 'Depende de o produto passar a cadastrar clausulas de CCT por empresa.', '[{"acao": "Cadastrar CCT com clausula de estabilidade pre-aposentadoria", "ordem": 1, "resultado_esperado": "O sistema precisa ter onde registrar a clausula"}, {"acao": "Colaborador dentro do periodo previsto na clausula", "ordem": 2, "resultado_esperado": "Dispensa bloqueada"}, {"acao": "Empresa sem clausula equivalente", "ordem": 3, "resultado_esperado": "Sem bloqueio"}]', 'A estabilidade e aplicada conforme a clausula vigente para aquela empresa.', 'NAO E POSSIVEL FUNDAMENTAR EM LEI porque a regra e convencional. O caso fica em rascunho ate existir cadastro de CCT — o mesmo bloqueio que impede DESL-081. Vale avaliar se cadastro de CCT vira epico proprio: ele destrava estabilidade pre-aposentadoria, homologacao obrigatoria e possivelmente jornada.', 'api', 'CLT, art. 611-A e art. 611-B (limites da negociacao coletiva) — a estabilidade pre-aposentadoria NAO tem previsao legal geral e decorre exclusivamente de convencao ou acordo coletivo', 'em_triagem', NULL),
    ('DESL-076', '[A CONSTRUIR] Justificativa especial para dispensa em estabilidade', 'excecao', 'alta', 'rascunho', 'ESPECIFICACAO. As garantias nao sao absolutas: ha hipoteses legitimas de extincao durante a estabilidade. Falta o campo e a trilha de auditoria.', 'Depende de definicao de quem pode preencher e o que e exigido como lastro.', '[{"acao": "Colaborador com estabilidade e motivo legitimo de extincao", "ordem": 1, "resultado_esperado": "O sistema oferece campo de justificativa com fundamentacao"}, {"acao": "Confirmar sem justificativa", "ordem": 2, "resultado_esperado": "Bloqueado"}, {"acao": "Confirmar com justificativa", "ordem": 3, "resultado_esperado": "Permitido, com registro de autor, data e fundamento"}]', 'Existe caminho auditavel de excecao, e ele exige lastro.', 'Hoje o bloqueio por estabilidade e ABSOLUTO, com duas saidas fixas em codigo: justa causa e falecimento. Falecimento esta correto (nao e dispensa). Justa causa generica esta ERRADA para dirigente sindical, que exige inquerito judicial — ver DESL-072. PERGUNTAS: quem pode preencher a justificativa? Exige anexo? Gera notificacao a quem?', 'e2e', 'ADCT, art. 10, II (a vedacao alcanca dispensa ARBITRARIA OU SEM JUSTA CAUSA — nao toda e qualquer extincao); CLT, art. 543, §3o (falta grave apurada em inquerito); CLT, art. 482', 'em_triagem', NULL),
    ('DESL-077', 'Estabilidade nao detectada por dado ausente e falso negativo grave', 'excecao', 'critica', 'aprovado', 'Verificacao que depende de dado opcional produz falsa sensacao de seguranca: a tela diz "sem estabilidade" quando o correto seria "nao foi possivel verificar".', 'Colaboradores com dados incompletos.', '[{"acao": "Gestante sem atestado com CID obstetrico no sistema", "ordem": 1, "resultado_esperado": "O sistema NAO pode afirmar ausencia de estabilidade — deve indicar verificacao inconclusiva"}, {"acao": "Afastamento acidentario com nexo_trabalho em branco", "ordem": 2, "resultado_esperado": "Mesma indicacao de inconclusivo"}, {"acao": "Conferir a mensagem exibida", "ordem": 3, "resultado_esperado": "Distingue estabilidade AUSENTE de estabilidade NAO VERIFICAVEL"}]', 'O sistema distingue ausencia de estabilidade de impossibilidade de verificar.', 'Este e o caso conceitualmente mais importante do bloco. Hoje a tela mostra "Possivel estabilidade gestante" quando encontra CID, e silencio quando nao encontra — e silencio e lido como liberacao. Num modulo onde o erro custa reintegracao judicial, silencio nao pode significar autorizacao. Requisitos YE-DP-RESC-001: RN-002/CA-002 (estabilidades bloqueiam antes de concluir; jurídico acionado).', 'e2e', 'ADCT, art. 10, II; Lei 8.213/1991, art. 118 — a garantia decorre da CONDICAO do trabalhador, nao do registro dela no sistema. A ausencia de dado nao afasta a estabilidade nem a responsabilidade do empregador', 'em_triagem', NULL),
    ('DESL-080', 'Homologacao sindical nao e mais exigencia legal geral', 'alternativo', 'media', 'aprovado', 'Impedir que o sistema imponha exigencia revogada.', 'Colaborador com mais de 1 ano de casa, empresa sem CCT que exija homologacao.', '[{"acao": "Confirmar desligamento sem dados de homologacao", "ordem": 1, "resultado_esperado": "Permitido — nao ha exigencia legal geral"}, {"acao": "Conferir se algum alerta sugere obrigatoriedade", "ordem": 2, "resultado_esperado": "Se houver alerta, deve deixar claro que decorre de CCT, nao de lei"}]', 'A ausencia de homologacao nao bloqueia quando nao ha clausula coletiva.', 'O sistema exibe hoje "Homologacao pode ser necessaria conforme convencao coletiva" quando o colaborador tem mais de 1 ano. O gatilho de 1 ano e HERANCA do §1o revogado — o criterio deixou de existir em 2017. O alerta nao bloqueia, entao nao ha dano, mas o criterio nao tem mais fundamento e induz a erro.', 'e2e', 'Lei 13.467/2017 revogou o §1o do art. 477 da CLT, que exigia assistencia sindical na rescisao de contrato com mais de 1 ano', 'em_triagem', NULL),
    ('DESL-081', '[A CONSTRUIR] Homologacao obrigatoria por clausula coletiva', 'alternativo', 'media', 'rascunho', 'ESPECIFICACAO. A exigencia hoje so pode vir de CCT, e o sistema nao cadastra CCT.', 'Depende do mesmo cadastro de CCT do DESL-074.', '[{"acao": "Empresa com CCT que exige homologacao", "ordem": 1, "resultado_esperado": "Campos de homologacao tornam-se obrigatorios"}, {"acao": "Tentar confirmar sem data de homologacao", "ordem": 2, "resultado_esperado": "Bloqueado"}, {"acao": "Empresa sem a clausula", "ordem": 3, "resultado_esperado": "Campos permanecem opcionais"}]', 'A obrigatoriedade acompanha a clausula vigente, nao um prazo fixo.', 'Bloqueado pela mesma dependencia do DESL-074: sem cadastro de CCT, a regra nao tem como ser avaliada.', 'api', 'CLT, art. 611-A — a convencao e o acordo coletivo tem prevalencia sobre a lei nas materias que especifica, podendo instituir a exigencia de homologacao', 'em_triagem', NULL),
    ('DESL-082', 'TRCT discrimina as verbas e a quitação assinada é arquivada', 'feliz', 'alta', 'aprovado', 'O TRCT precisa DISCRIMINAR verba a verba — natureza e valor de cada parcela (§2º) — e a quitação vale pelo que está escrito e assinado. O fluxo completo: TRCT gerado da memória de cálculo (mesmos números), assinatura das partes com trilha, e a versão ASSINADA arquivada automaticamente na pasta do colaborador. TRCT genérico ou divergente da memória não quita nada.', 'Rescisão apurada com verbas calculadas e memória disponível.', '[{"acao": "Gerar o TRCT", "ordem": 1, "resultado_esperado": "Parcelas discriminadas uma a uma, batendo com a memória de cálculo"}, {"acao": "Colher as assinaturas (colaborador e empresa)", "ordem": 2, "resultado_esperado": "Trilha com signatário, data/hora e integridade do documento"}, {"acao": "Concluir e conferir Documentos", "ordem": 3, "resultado_esperado": "TRCT e termo de quitação ASSINADOS arquivados na pasta Funcionário › Rescisão"}]', 'O que se paga é o que está discriminado; o que se arquiva é o que foi assinado.', 'Requisitos YE-DP-RESC-001: RF-005 / CA-008 / seção 16 (pastas). Espelha o ADM-070 (assinatura trava a conclusão) no fim do ciclo do vínculo. | Requisitos YE-DP-EPI-001: o padrão de assinatura eletrônica com trilha vale também para o recibo de EPI (EPI-042). | Requisitos YE-DP-BEN-001: na rescisão, além das verbas, o plano de saúde tem a manutenção dos arts. 30/31 da Lei 9.656/98 — caso BEN-040 (prazo de opção de 30 dias, custo integral).', 'e2e', 'CLT, art. 477, caput e §2º (instrumento de rescisão com especificação das parcelas e valores)', 'em_triagem', NULL),
    ('DESL-083', 'Quitação de menor de 18 anos exige assistência do responsável', 'negativo', 'media', 'aprovado', 'Menor de 18 pode assinar recibos de pagamento no curso do contrato, mas a QUITAÇÃO FINAL da rescisão só vale com a assistência do responsável legal (art. 439). O sistema deve detectar a idade na data do término e exigir o assistente no fluxo de assinatura — quitação de menor sem assistência é nula e reabre a discussão de todas as verbas.', 'Colaborador fictício com 17 anos na data do desligamento.', '[{"acao": "Concluir a rescisão do menor sem dados do assistente", "ordem": 1, "resultado_esperado": "Retido — assistência do responsável obrigatória na quitação"}, {"acao": "Registrar o responsável e colher as duas assinaturas", "ordem": 2, "resultado_esperado": "Quitação válida; trilha registra menor + assistente"}, {"acao": "Repetir com colaborador de 18+", "ordem": 3, "resultado_esperado": "Fluxo normal, sem exigência de assistente"}]', 'Menor assina acompanhado — ou a quitação não fica de pé.', 'Requisitos YE-DP-RESC-001: RN-009 / CA-008 / cenário "Menor de 18" (seção 25). Depende da data de nascimento no cadastro (mesma fonte do ADM-030/031).', 'api', 'CLT, art. 439 — é lícito ao menor firmar recibo; quitação final só com assistência dos responsáveis legais', 'em_triagem', NULL),
    ('DESL-090', 'Desligamento de vinculo celetista gera evento S-2299', 'feliz', 'critica', 'rascunho', 'O evento e a obrigacao acessoria que formaliza a rescisao perante o Fisco, a Previdencia e o FGTS.', 'Desligamento de colaborador com vinculo CLT.', '[{"acao": "Confirmar desligamento", "ordem": 1, "resultado_esperado": "Evento S-2299 gerado"}, {"acao": "Conferir o motivo enviado", "ordem": 2, "resultado_esperado": "mtvDeslig coerente com o motivo escolhido, conforme Tabela 19"}, {"acao": "Conferir as verbas enviadas", "ordem": 3, "resultado_esperado": "Coerentes com o calculado em tela"}]', 'O evento e gerado com dados coerentes com o desligamento.', 'Implementado como RNDES23. | RECLASSIFICADO 31/07/2026 (api -> e2e): verifica orquestracao disparada pelo formulario React. Nenhuma rotina SQL consegue invocar o fluxo; so consegue constatar que ele nao rodou, o que seria falha do metodo e nao do sistema. Cobertura pertence ao Cypress. Requisitos YE-DP-RESC-001: RN-006/CA-007 — o PRAZO do S-2299 (10 dias/antes do pagamento) ganhou caso próprio (DESL-093) e a rejeição/anti-duplicidade também (DESL-094).', 'e2e', 'Manual de Orientacao do eSocial (MOS), evento S-2299 — Desligamento; Decreto 8.373/2014 (institui o eSocial)', 'fora_de_escopo', 'O produto transmite ao eSocial apenas os eventos de SST. Admissão (S-2200), admissão preliminar (S-2190) e desligamento (S-2299 e S-2399) são feitos por fora, pela contabilidade ou pelo sistema de folha do cliente. Retorno do desenvolvimento em 31/07/2026. Se o escopo mudar, devolver para aprovado — a fundamentação legal segue válida e não foi apagada.'),
    ('DESL-091', 'Desligamento nao pode persistir sem o evento correspondente', 'excecao', 'critica', 'rascunho', 'Desligamento registrado sem evento gera obrigacao acessoria omitida, e a omissao e invisivel se a falha for silenciosa.', 'Ambiente onde a geracao do evento possa falhar.', '[{"acao": "Forcar falha na geracao do S-2299 e confirmar o desligamento", "ordem": 1, "resultado_esperado": "Ou a transacao inteira e revertida, ou o desligamento fica com status explicito de pendencia de eSocial"}, {"acao": "Consultar desligamentos sem evento correspondente", "ordem": 2, "resultado_esperado": "Existe consulta ou painel que os revela"}, {"acao": "Conferir se o usuario foi avisado", "ordem": 3, "resultado_esperado": "Aviso visivel, nao apenas log de console"}]', 'Nenhum desligamento fica sem evento sem que alguem saiba.', 'DIVERGENCIA CONFIRMADA E DE ALTO RISCO: a geracao do S-2299 esta dentro de um try com log de console marcado como "nao bloqueante". O desligamento persiste, o usuario ve mensagem de sucesso, e a obrigacao acessoria simplesmente nao acontece. Correcao sugerida: status de pendencia no registro mais rotina de reconciliacao, no espirito da reconciliar_pastas_todas_empresas() que ja existe no produto. | APROFUNDADO 31/07/2026: o evento nao chega a public.esocial_transmissoes. gerarEventoS2299 e funcao pura, sem escrita. O componente grava em audit_logs a acao esocial_s2299_gerado e manda o objeto para console.log. A fila de transmissao e alimentada por outra tela e por edge function propria. PERGUNTA PARA O TIME: a tela de transmissao reconstroi o S-2299 a partir da admissao desligada? Se sim, o audit_log do desligamento e ruido e induz a erro. Se nao, a obrigacao acessoria nao e cumprida por este caminho. Requisitos YE-DP-RESC-001: RN-006/CA-007 — o PRAZO do S-2299 (10 dias/antes do pagamento) ganhou caso próprio (DESL-093) e a rejeição/anti-duplicidade também (DESL-094).', 'api', 'Decreto 8.373/2014 e MOS — a prestacao da informacao e obrigatoria; a omissao sujeita o empregador as penalidades da legislacao previdenciaria e trabalhista (CLT, art. 630, §4o e legislacao especifica)', 'fora_de_escopo', 'O produto transmite ao eSocial apenas os eventos de SST. Admissão (S-2200), admissão preliminar (S-2190) e desligamento (S-2299 e S-2399) são feitos por fora, pela contabilidade ou pelo sistema de folha do cliente. Retorno do desenvolvimento em 31/07/2026. Se o escopo mudar, devolver para aprovado — a fundamentação legal segue válida e não foi apagada.'),
    ('DESL-092', 'Trabalhador sem vinculo empregaticio gera evento S-2399', 'alternativo', 'alta', 'rascunho', 'Enviar S-2299 para quem nao e celetista, ou nao enviar nada, sao dois erros distintos na mesma obrigacao.', 'Colaborador de categoria TSVE.', '[{"acao": "Encerrar vinculo de trabalhador TSVE", "ordem": 1, "resultado_esperado": "Evento S-2399 gerado"}, {"acao": "Conferir que NAO foi gerado S-2299", "ordem": 2, "resultado_esperado": "O evento celetista nao se aplica"}, {"acao": "Conferir a decisao de qual evento usar", "ordem": 3, "resultado_esperado": "Baseada na categoria do trabalhador, nao no motivo do desligamento"}]', 'A categoria do trabalhador determina o evento.', 'GAP TOTAL: S-2399 nao aparece em nenhum arquivo do repositorio. Antes de implementar, confirmar com o time se o produto atende categorias TSVE — se atender apenas CLT, o caso vira rascunho; se atender estagiarios ou autonomos, e lacuna de conformidade ativa. | RECLASSIFICADO 31/07/2026 (api -> e2e): verifica orquestracao disparada pelo formulario React. Nenhuma rotina SQL consegue invocar o fluxo; so consegue constatar que ele nao rodou, o que seria falha do metodo e nao do sistema. Cobertura pertence ao Cypress.', 'e2e', 'MOS, evento S-2399 — Trabalhador Sem Vinculo de Emprego/Estatutario (TSVE), Termino; aplicavel a diretor nao empregado, cooperado, estagiario, autonomo e demais categorias sem vinculo celetista', 'fora_de_escopo', 'O produto transmite ao eSocial apenas os eventos de SST. Admissão (S-2200), admissão preliminar (S-2190) e desligamento (S-2299 e S-2399) são feitos por fora, pela contabilidade ou pelo sistema de folha do cliente. Retorno do desenvolvimento em 31/07/2026. Se o escopo mudar, devolver para aprovado — a fundamentação legal segue válida e não foi apagada.'),
    ('DESL-093', 'S-2299 transmitido em até 10 dias do desligamento — ou antes do pagamento', 'excecao', 'alta', 'aprovado', 'Gerar o S-2299 (DESL-090/091) não basta: ele tem PRAZO — até 10 dias do desligamento, e ANTES disso se o pagamento das verbas acontecer primeiro. O sistema projeta a data-limite pelo que ocorrer primeiro (pagamento × 10º dia), alerta a aproximação e acusa a transmissão tardia como fora do prazo, sem fingir regularidade.', 'Desligamento confirmado com data conhecida; pagamento agendado.', '[{"acao": "Confirmar o desligamento", "ordem": 1, "resultado_esperado": "Data-limite do S-2299 projetada (mín entre pagamento e 10º dia), com alertas"}, {"acao": "Registrar pagamento no 5º dia com S-2299 pendente", "ordem": 2, "resultado_esperado": "Prazo reprojetado para antes do pagamento; pendência acusada como crítica"}, {"acao": "Transmitir no 12º dia", "ordem": 3, "resultado_esperado": "Marcado FORA DO PRAZO, com alerta e ação no Plano de Ação — nunca silêncio"}]', 'O S-2299 corre contra dois relógios — vence o que chegar primeiro.', 'Requisitos YE-DP-RESC-001: RN-006 / CA-007 / alerta "S-2299 a transmitir" (seção 14). Prazo/leiaute vigentes são [VAL] (seção 30). Complementa DESL-090/091 (existência do evento) — par do ADM-071 no fim do vínculo.', 'api', 'eSocial — prazo do S-2299: até 10 dias contados do desligamento, antecipado se o pagamento das verbas ocorrer antes', 'em_triagem', NULL),
    ('DESL-094', 'Rejeição do S-2299 é traduzida e o reenvio retifica, nunca duplica', 'excecao', 'alta', 'aprovado', 'Rejeição do S-2299 chega em código técnico; o DP precisa da tradução (o que houve, onde corrigir, ação sugerida) e de reenvio SEGURO: corrigido o dado, o reenvio retifica o evento — nunca cria segundo desligamento do mesmo vínculo no ambiente do governo. Desligamento duplicado no eSocial trava o vínculo para eventos futuros e vira passivo criado pela própria correção.', 'Evento S-2299 rejeitado por inconsistência simulada no ambiente de teste.', '[{"acao": "Receber a rejeição", "ordem": 1, "resultado_esperado": "Explicação em linguagem simples + ação sugerida (Plano de Ação)"}, {"acao": "Corrigir e reenviar", "ordem": 2, "resultado_esperado": "Evento aceito como retificação; nenhum S-2299 duplicado do vínculo"}, {"acao": "Conferir a trilha", "ordem": 3, "resultado_esperado": "Rejeição, correção e recibo final encadeados no dossiê"}]', 'Rejeição vira instrução; reenvio vira retificação, nunca clone.', 'Requisitos YE-DP-RESC-001: cenário "Com erro" (seção 25) / RNF-008. Quarto da série ADM-093 / FERIAS-081 / DEC13-050 — a mesma disciplina de anti-duplicidade, agora no evento que encerra o vínculo.', 'api', 'eSocial — regras de retificação do S-2299; boa prática de integração', 'em_triagem', NULL),
    ('DESL-100', 'Confirmacao completa persiste, integra e atualiza o status', 'feliz', 'critica', 'aprovado', 'Caminho feliz completo, com todos os efeitos.', 'Colaborador elegivel, dados validos.', '[{"acao": "Confirmar desligamento valido", "ordem": 1, "resultado_esperado": "Registro persistido"}, {"acao": "Conferir protocolo", "ordem": 2, "resultado_esperado": "Gerado e apresentado"}, {"acao": "Conferir status do colaborador", "ordem": 3, "resultado_esperado": "Desligado"}, {"acao": "Conferir integracoes", "ordem": 4, "resultado_esperado": "Folha rescisoria e S-2299 disparados"}]', 'Todos os efeitos ocorrem de forma consistente.', 'Caso guarda-chuva. Falhando ele, investigar os especificos antes de concluir. | RECLASSIFICADO 31/07/2026 (api -> e2e): verifica orquestracao disparada pelo formulario React. Nenhuma rotina SQL consegue invocar o fluxo; so consegue constatar que ele nao rodou, o que seria falha do metodo e nao do sistema. Cobertura pertence ao Cypress.', 'e2e', 'CLT, art. 477 (quitacao) c/c Decreto 8.373/2014 (eSocial)', 'em_triagem', NULL),
    ('DESL-101', 'Protocolo de desligamento e persistido e rastreavel', 'excecao', 'alta', 'aprovado', 'Protocolo repetido impede rastrear qual tentativa gerou qual efeito.', 'Colaborador elegivel.', '[{"acao": "Gerar dois desligamentos no mesmo dia para colaboradores diferentes", "ordem": 1, "resultado_esperado": "Protocolos distintos"}, {"acao": "Tentar duas confirmacoes para o MESMO colaborador no mesmo dia", "ordem": 2, "resultado_esperado": "Protocolos distintos, ou a segunda barrada pelo DESL-002"}, {"acao": "Conferir unicidade no banco", "ordem": 3, "resultado_esperado": "Existe restricao que impede repeticao"}]', 'Cada evento rescisorio tem identificador proprio.', 'GAP: o protocolo e DESL-{aaaammdd}-{8 primeiros caracteres do id da admissao}. E deterministico: mesma admissao no mesmo dia produz sempre o mesmo protocolo, e nao ha restricao de unicidade no banco. Note que este caso NAO tem base legal — a lei exige comprovacao, nao um formato. Registrado como regra de produto, para nao misturar as duas coisas. | CORRIGIDO 31/07/2026 apos leitura do codigo: o achado e maior que o documentado. O protocolo nao e apenas nao-unico — ele NAO E GRAVADO. Nao existe coluna para ele em admissoes. O valor e montado no componente, exibido em toast e embutido no texto livre da descricao enviada ao Hub Contabil. Nao ha campo consultavel: para localizar um desligamento pelo protocolo seria preciso busca textual na descricao de outro modulo. Rastreabilidade prometida ao usuario e nao entregue.', 'api', 'Regra de produto (sem base legal) — rastreabilidade do evento rescisorio. Apoia a comprovacao exigida pelo art. 477 da CLT, mas o formato e escolha interna.', 'em_triagem', NULL),
    ('DESL-102', 'Clique duplo nao gera desligamento duplicado', 'negativo', 'alta', 'aprovado', 'Duplicidade transacional produz dois eventos para um unico fato.', 'Colaborador elegivel, dados validos.', '[{"acao": "Clicar duas vezes rapidamente em confirmar", "ordem": 1, "resultado_esperado": "Uma unica transacao processada"}, {"acao": "Repetir com rede lenta", "ordem": 2, "resultado_esperado": "Mesmo comportamento"}, {"acao": "Conferir eventos gerados", "ordem": 3, "resultado_esperado": "Um desligamento, um protocolo, um S-2299"}]', 'Um clique duplo produz um unico efeito.', 'Parcialmente protegido: o botao e desabilitado enquanto submitting e verdadeiro. O passo 2 e o que realmente testa — sob latencia, a protecao de estado do React pode nao bastar. A garantia definitiva e a restricao de unicidade do DESL-002 no banco.', 'e2e', 'CLT, art. 477 c/c MOS — evento duplicado no eSocial gera inconsistencia que exige retificacao ou exclusao formal', 'em_triagem', NULL),
    ('DESL-104', 'Falha na confirmacao nao deixa anexo orfao no armazenamento', 'excecao', 'media', 'aprovado', 'O anexo do ASO sobe antes da confirmacao. Se a transacao falhar, o arquivo permanece sem registro que o justifique.', 'Cenario com ASO obrigatorio e anexo.', '[{"acao": "Anexar o ASO e forcar falha na confirmacao", "ordem": 1, "resultado_esperado": "O arquivo e removido, ou fica rastreavel como pendente"}, {"acao": "Consultar anexos sem desligamento correspondente", "ordem": 2, "resultado_esperado": "Nenhum, ou todos identificados"}]', 'Nao restam documentos medicos sem vinculo no armazenamento.', 'Mesma classe do vazamento de pastas fechado em 30/07/2026. Aqui e mais sensivel: ASO e documento medico, dado pessoal sensivel pela LGPD, e arquivo orfao nao tem quem responda por ele nem prazo de eliminacao definido.', 'api', 'LGPD, Lei 13.709/2018, art. 15 e art. 16 — termino do tratamento e eliminacao dos dados pessoais quando nao houver mais finalidade; documento medico e dado pessoal sensivel (art. 5o, II)', 'em_triagem', NULL),
    ('DESL-105', 'Diferença após o desligamento gera rescisão complementar com S-2299 próprio', 'alternativo', 'media', 'aprovado', 'Dissídio com reajuste retroativo, variável lançada tarde ou erro de cálculo descoberto depois geram DIFERENÇA a favor do desligado: a rescisão complementar apura só a diferença, vinculada à rescisão original, com pagamento e reflexo no eSocial — sem reabrir nem sobrescrever o TRCT já quitado. Ignorar a diferença é passivo; editar a rescisão paga é fraude de trilha.', 'Rescisão concluída e paga; reajuste retroativo de CCT publicado depois.', '[{"acao": "Registrar o reajuste retroativo da categoria", "ordem": 1, "resultado_esperado": "Diferença detectada nas rescisões do período, com alerta a DP/Contador"}, {"acao": "Apurar a complementar", "ordem": 2, "resultado_esperado": "Só a diferença, com memória própria e vínculo à rescisão original intacta"}, {"acao": "Transmitir e pagar", "ordem": 3, "resultado_esperado": "S-2299 complementar/retificação no eSocial e pagamento rastreado"}]', 'A diferença ganha rescisão própria; a original fica intocada na história.', 'Requisitos YE-DP-RESC-001: RF-010 / CA-009 / cenário "Complementar" (seção 25) / alerta "Diferença/rescisão complementar" (seção 14). Par do DEC13-033 (complemento no 13º).', 'api', 'CLT, art. 477 (quitação das parcelas); eSocial — S-2299 complementar/retificação; prática consolidada de rescisão complementar (dissídio retroativo)', 'em_triagem', NULL),
    ('DESL-106', 'Reversão do desligamento só com dupla aprovação, motivo e estorno rastreado', 'excecao', 'alta', 'aprovado', 'Desligamento revertido (decisão judicial, acordo, erro operacional) não é DELETE: é reabertura controlada com motivo, dupla aprovação e trilha — estornando verbas pagas, revertendo o evento no eSocial pelas regras próprias e reativando o vínculo com os efeitos em cadeia (ponto, benefícios, férias) documentados. Reversão silenciosa deixa o governo com um desligamento que a empresa diz não existir.', 'Desligamento concluído (com verbas e S-2299) no ambiente de teste.', '[{"acao": "Tentar excluir/editar diretamente o desligamento concluído", "ordem": 1, "resultado_esperado": "Bloqueado — só via fluxo de reversão"}, {"acao": "Abrir a reversão com motivo e duas aprovações", "ordem": 2, "resultado_esperado": "Vínculo reativado; verbas estornadas com trilha; evento do eSocial tratado (exclusão/retificação)"}, {"acao": "Conferir a cadeia reativada", "ordem": 3, "resultado_esperado": "Ponto, benefícios e contadores de férias/13º voltam a correr da data certa"}]', 'Reverter é um fluxo com rito e estorno — nunca um apagar.', 'Requisitos YE-DP-RESC-001: fluxo "Reversão do desligamento" (seção 9) / RF-010. Mesma disciplina de reabertura do FERIAS-054 e DEC13-070, com o agravante do evento já transmitido.', 'api', 'Documento YE-DP-RESC-001, RF-010; RNF-004 (log imutável); eSocial — exclusão/retificação de eventos', 'em_triagem', NULL),
    ('DESL-110', 'Dossiê rescisório restrito por perfil: gestor vê a equipe, colaborador só o seu', 'negativo', 'alta', 'aprovado', 'A rescisão concentra o que o sistema tem de mais sensível: remuneração (verbas), saúde (estabilidade acidentária, ASO) e motivo do desligamento. A matriz do documento é explícita: gestor solicitante enxerga SÓ a própria equipe; colaborador desligado, só o próprio dossiê; jurídico/DP/financeiro conforme o papel — sempre dentro do tenant e com a camada RESTRICTIVE de perfil cobrindo as tabelas da rescisão.', 'Usuários fictícios de perfis distintos no tenant de teste; rescisões de mais de um departamento.', '[{"acao": "Colaborador consulta o próprio dossiê", "ordem": 1, "resultado_esperado": "Permitido — TRCT, termos e comprovantes próprios"}, {"acao": "Colaborador tenta ler a rescisão de um colega", "ordem": 2, "resultado_esperado": "Bloqueado pela política de acesso"}, {"acao": "Gestor consulta rescisão de OUTRO departamento", "ordem": 3, "resultado_esperado": "Bloqueado — gestor só a própria equipe"}, {"acao": "Conferir a camada de perfil das tabelas da rescisão", "ordem": 4, "resultado_esperado": "Política RESTRICTIVE presente (padrão perfil_restringe_leitura_*) ou exceção documentada"}]', 'O fim do vínculo é o dado mais sensível dele — e o acesso mais estreito.', 'Requisitos YE-DP-RESC-001: seções 6 e 22 / RNF-005. folha_rescisoes está fora da camada perfil_restringe_leitura_* (mesmo achado do DEC13-071 na folha de 13º) — a rotina PERFIL-003 cobra tabela sensível nova.', 'api', 'LGPD (Lei 13.709/2018), arts. 6º, VII, 11 e 46; matriz de perfis do documento (seção 6)', 'em_triagem', NULL)
) AS d(codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
CROSS JOIN public.qa_modulos m
WHERE m.path = 'estrutura-organizacional/colaboradores/desligamento'
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

-- Documentos (12 casos)

INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
SELECT m.id, d.codigo::text, d.titulo::text, d.tipo::text::qa_caso_tipo, d.prioridade::text::qa_prioridade, d.status::text::qa_caso_status, d.objetivo::text, d.pre_condicoes::text, d.passos::text::jsonb, d.resultado_esperado::text, d.observacoes::text, d.nivel::text, d.base_legal::text, d.disposicao::text, d.disposicao_motivo::text
FROM (VALUES
    ('DOC-001', 'Criar uma pasta', 'feliz', 'alta', 'aprovado', 'Verificar a criacao de uma pasta no modulo de documentos. Regra: pastas organizam os arquivos e precisam de nome. Importa porque a estrutura de pastas e o que torna os documentos localizaveis — sem ela, os arquivos viram uma pilha desorganizada.', 'Usuario com permissao de gerenciar documentos.', '[{"acao": "Abrir o modulo de documentos", "dados": "-", "ordem": 1, "onde_na_tela": "Menu > Documentos e Governanca > Documentos", "resultado_esperado": "Arvore de pastas exibida"}, {"acao": "Criar uma nova pasta", "dados": "Nome: Documentos Admissionais", "ordem": 2, "onde_na_tela": "Botao Nova Pasta", "resultado_esperado": "Campo nome aceito"}, {"acao": "Salvar", "dados": "-", "ordem": 3, "onde_na_tela": "Confirmar/Salvar", "resultado_esperado": "A pasta aparece na arvore de pastas"}]', 'A pasta Documentos Admissionais existe e aparece na estrutura de pastas.', 'IMPACTO SE FALHAR: sem pastas, os documentos ficam sem organizacao — impossivel localizar o arquivo certo quando ele for necessario (auditoria, fiscalizacao).', 'api', NULL, 'em_triagem', NULL),
    ('DOC-002', 'Guardar um documento em uma pasta', 'feliz', 'critica', 'aprovado', 'Verificar que um documento fica guardado dentro de uma pasta. Regra e PREMISSA DO SISTEMA: todo arquivo enviado ou gerado deve ir para a pasta correspondente no modulo de documentos. Importa porque essa e a garantia de que nada se perde — qualquer upload feito em qualquer tela do sistema tem um lugar definido para ser encontrado depois.', 'Precisa existir uma pasta para receber o documento.', '[{"acao": "Criar (ou abrir) uma pasta", "dados": "Pasta: Contratos", "ordem": 1, "onde_na_tela": "Documentos > Nova Pasta ou selecionar uma existente", "resultado_esperado": "Pasta disponivel"}, {"acao": "Enviar um documento para dentro dessa pasta", "dados": "Arquivo: contrato.pdf | Pasta destino: Contratos", "ordem": 2, "onde_na_tela": "Pasta aberta > botao Enviar/Upload de documento", "resultado_esperado": "O documento e enviado"}, {"acao": "Conferir onde o documento ficou", "dados": "-", "ordem": 3, "onde_na_tela": "Abrir a pasta Contratos", "resultado_esperado": "O contrato.pdf aparece DENTRO da pasta Contratos"}]', 'O documento contrato.pdf esta guardado na pasta Contratos — o vinculo documento-pasta existe e funciona. A premissa do sistema e cumprida no banco.', 'IMPACTO SE FALHAR: se o documento nao ficasse ligado a uma pasta, arquivos enviados sumiriam na base sem lugar definido — inviabilizaria encontrar documentos em auditoria ou fiscalizacao. NOTA: este caso prova que o BANCO sustenta a premissa. Se cada tela do sistema (admissao, ferias, atestado) realmente chama essa gravacao ao fazer upload e comportamento de aplicacao — verificavel por teste de tela (Cypress), nao por banco.', 'api', NULL, 'em_triagem', NULL),
    ('DOC-003', 'Montar hierarquia de pastas (pasta dentro de pasta)', 'feliz', 'alta', 'aprovado', 'Verificar que pastas podem conter outras pastas, formando uma hierarquia. Regra: pasta_pai_id permite aninhar pastas (ex.: 2026 > Janeiro). Importa porque a organizacao documental real e hierarquica — por ano, por mes, por colaborador, por categoria.', 'Nenhuma alem de acesso ao modulo de documentos.', '[{"acao": "Criar uma pasta-mae", "dados": "Nome: 2026", "ordem": 1, "onde_na_tela": "Documentos > Nova Pasta", "resultado_esperado": "Pasta 2026 criada"}, {"acao": "Criar uma subpasta dentro dela", "dados": "Nome: Janeiro | Pasta-mae: 2026", "ordem": 2, "onde_na_tela": "Abrir a pasta 2026 > Nova Pasta (dentro)", "resultado_esperado": "Janeiro e criada dentro de 2026"}, {"acao": "Conferir a hierarquia", "dados": "-", "ordem": 3, "onde_na_tela": "Arvore de pastas", "resultado_esperado": "Janeiro aparece aninhada sob 2026"}]', 'A pasta Janeiro esta dentro de 2026, formando a hierarquia. A arvore de pastas reflete o aninhamento.', 'IMPACTO SE FALHAR: sem hierarquia, todas as pastas ficariam no mesmo nivel — inviabiliza a organizacao por ano/mes/colaborador que a gestao documental exige.', 'api', NULL, 'em_triagem', NULL),
    ('DOC-010', 'Pasta sem nome e recusada', 'excecao', 'media', 'aprovado', 'Verificar que uma pasta sem nome e recusada. Regra: nome e NOT NULL. Importa porque uma pasta sem nome aparece em branco na arvore e ninguem sabe o que guardar nela.', 'Nenhuma.', '[{"acao": "Iniciar a criacao de uma pasta", "dados": "-", "ordem": 1, "onde_na_tela": "Documentos > Nova Pasta", "resultado_esperado": "Formulario aberto"}, {"acao": "Deixar o nome vazio e tentar salvar", "dados": "Nome: (vazio)", "ordem": 2, "onde_na_tela": "Campo Nome (vazio) + Salvar", "resultado_esperado": "O sistema DEVE recusar"}]', 'A pasta sem nome e recusada. Nenhuma pasta em branco entra na arvore.', 'IMPACTO SE FALHAR: pastas em branco poluem a arvore documental e confundem quem procura onde guardar ou encontrar um arquivo.', 'api', NULL, 'em_triagem', NULL),
    ('DOC-011', 'Documento sem storage_path e recusado', 'excecao', 'alta', 'aprovado', 'Verificar que um documento sem caminho de arquivo (storage_path) e recusado. Regra: storage_path e NOT NULL — todo registro de documento precisa apontar para um arquivo real no armazenamento. Importa porque um registro sem arquivo e uma promessa vazia: aparece na lista mas nao abre nada quando alguem clica.', 'Nenhuma.', '[{"acao": "Tentar registrar um documento sem o arquivo correspondente", "dados": "Nome: x.pdf | Arquivo/storage: (nenhum)", "ordem": 1, "onde_na_tela": "Documentos > Enviar documento (via API ou importacao sem arquivo)", "resultado_esperado": "O sistema DEVE recusar — documento precisa apontar para um arquivo"}]', 'O documento sem storage_path e recusado. Nenhum registro de documento sem arquivo real entra na base.', 'IMPACTO SE FALHAR: registros de documento sem arquivo apareceriam nas listas mas nao abririam — o usuario acharia que o documento existe quando na verdade nao ha nada armazenado. Grave em auditoria.', 'api', NULL, 'em_triagem', NULL),
    ('DOC-013', 'Apagar pasta-mae apaga as subpastas (CASCADE)', 'alternativo', 'alta', 'aprovado', 'Verificar que apagar uma pasta-mae apaga as subpastas junto (CASCADE). Regra: pasta_pai_id ON DELETE CASCADE — a hierarquia cai junto. Importa porque uma subpasta sem a pasta-mae ficaria orfa na arvore, sem caminho valido.', 'Precisa existir uma pasta-mae com pelo menos uma subpasta.', '[{"acao": "Criar uma pasta com uma subpasta dentro", "dados": "Pasta-mae: Arquivo Morto | Subpasta: 2020, dentro dela", "ordem": 1, "onde_na_tela": "Documentos", "resultado_esperado": "Hierarquia montada"}, {"acao": "Apagar a pasta-mae", "dados": "-", "ordem": 2, "onde_na_tela": "Documentos > Arquivo Morto > Excluir", "resultado_esperado": "Pasta-mae apagada"}, {"acao": "Conferir a subpasta", "dados": "-", "ordem": 3, "onde_na_tela": "Arvore de pastas", "resultado_esperado": "A subpasta 2020 foi apagada JUNTO (nao sobra orfa na arvore)"}]', 'A pasta-mae e apagada e suas subpastas somem junto (CASCADE). Nenhuma subpasta orfa sobra na arvore.', 'IMPACTO SE FALHAR: subpastas orfas ficariam na base sem caminho valido na arvore — inacessiveis pela interface mas ocupando espaco. NOTA: isso vale para pastas VAZIAS; pastas COM documentos sao protegidas (veja DOC-014).', 'api', NULL, 'em_triagem', NULL),
    ('DOC-014', 'Nao da para apagar pasta com documento dentro', 'negativo', 'alta', 'aprovado', 'Verificar que o banco NAO deixa apagar uma pasta que ainda tem documento dentro. Regra: o vinculo documento-pasta e NO ACTION — a exclusao da pasta e bloqueada enquanto houver documento nela. Importa porque e a protecao que impede alguem apagar uma pasta e levar junto documentos que podem ter valor legal.', 'Precisa existir uma pasta com pelo menos um documento guardado dentro.', '[{"acao": "Criar uma pasta e guardar um documento nela", "dados": "Pasta: Documentos Importantes | Documento: importante.pdf dentro dela", "ordem": 1, "onde_na_tela": "Documentos", "resultado_esperado": "Documento esta na pasta"}, {"acao": "Tentar apagar a pasta que ainda tem o documento", "dados": "-", "ordem": 2, "onde_na_tela": "Documentos > Documentos Importantes > Excluir", "resultado_esperado": "O sistema DEVE recusar a exclusao — ha documento dentro"}, {"acao": "Conferir que o documento continua la", "dados": "-", "ordem": 3, "onde_na_tela": "Abrir a pasta", "resultado_esperado": "A pasta e o documento continuam intactos"}]', 'A exclusao da pasta e RECUSADA enquanto houver documento dentro. O documento esta protegido — nao ha como perde-lo por apagar a pasta sem querer.', 'IMPACTO SE FALHAR: se a pasta pudesse ser apagada com documentos dentro, um clique errado destruiria (ou orfanaria) arquivos com valor legal — contratos, ASOs, comprovantes. Esta protecao e uma das mais valiosas do modulo e sustenta a premissa de que o sistema guarda os documentos com seguranca.', 'api', NULL, 'em_triagem', NULL),
    ('DOC-022', 'Documento de outro cliente e invisivel', 'negativo', 'critica', 'aprovado', 'Verificar que um documento de um cliente e invisivel para outro. Regra: isolamento multi-tenant. Importa porque documentos contem dados pessoais e sensiveis (contratos, exames, comprovantes) — vazamento aqui seria um incidente grave de LGPD.', 'Dois clientes distintos no sistema.', '[{"acao": "No cliente A, guardar um documento", "dados": "Arquivo: secreto_t1.pdf", "ordem": 1, "onde_na_tela": "Cliente A > Documentos > Enviar", "resultado_esperado": "Documento guardado no cliente A"}, {"acao": "Entrar como cliente B e procurar o documento", "dados": "Buscar pelo nome do documento do cliente A", "ordem": 2, "onde_na_tela": "Cliente B > Documentos > busca", "resultado_esperado": "NAO aparece para o cliente B"}]', 'O documento do cliente A e invisivel no cliente B. Zero vazamento.', 'IMPACTO SE FALHAR: seria vazamento de documentos com dados pessoais e sensiveis entre clientes — incidente grave de LGPD, com risco legal e de reputacao. Protecao RLS por tenant, verificada a cada bateria.', 'api', NULL, 'em_triagem', NULL),
    ('DOC-030', 'Documento revisado ganha uma nova versao (a assinada)', 'feliz', 'critica', 'aprovado', 'Verificar que revisar um documento cria uma NOVA VERSAO, preservando a anterior. Regra e PREMISSA DO SISTEMA: quando um documento e assinado, a versao assinada e guardada como nova versao — sem sobrescrever o original. Importa porque em SST o historico de versoes tem valor legal: e preciso poder provar qual documento foi assinado e quando.', 'Precisa existir um documento ja guardado (a versao 1).', '[{"acao": "Guardar um documento (versao 1)", "dados": "Arquivo: termo.pdf (versao 1, sem assinatura)", "ordem": 1, "onde_na_tela": "Documentos > Enviar", "resultado_esperado": "Documento guardado como versao 1"}, {"acao": "O documento e assinado e volta ao sistema", "dados": "Arquivo: termo_assinado.pdf | Motivo: Versao assinada", "ordem": 2, "onde_na_tela": "Documento > Nova versao / Substituir com nova versao", "resultado_esperado": "E criada a versao 2"}, {"acao": "Conferir o historico de versoes", "dados": "-", "ordem": 3, "onde_na_tela": "Documento > aba Versoes / Historico", "resultado_esperado": "Existem 2 versoes: a v1 (original) PRESERVADA e a v2 (assinada)"}]', 'O documento tem 2 versoes: a original (v1) continua acessivel e a assinada (v2) foi adicionada. A assinatura nao apagou o original. A premissa e cumprida.', 'IMPACTO SE FALHAR: se a versao assinada sobrescrevesse a original, perder-se-ia a rastreabilidade — em uma auditoria ou processo, nao daria para demonstrar o que foi assinado nem comparar com a versao anterior. O versionamento e o que da valor legal ao acervo documental.', 'api', NULL, 'em_triagem', NULL),
    ('DOC-040', 'Guardar documento com data de validade', 'feliz', 'alta', 'aprovado', 'Verificar que a data de validade de um documento e guardada. Regra: documentos de SST (ASO, certificados, licencas) tem prazo de validade e o sistema precisa registra-lo. Importa porque a validade e o que permite saber se um documento ainda vale — base de qualquer controle de vencimento.', 'Acesso ao envio de documentos com o campo de validade.', '[{"acao": "Enviar um documento informando a validade", "dados": "Arquivo: aso.pdf | Data de validade: 31/12/2026", "ordem": 1, "onde_na_tela": "Documentos > Enviar > campo Data de Validade", "resultado_esperado": "O campo aceita a data"}, {"acao": "Reabrir o documento e conferir", "dados": "-", "ordem": 2, "onde_na_tela": "Abrir o documento > propriedades", "resultado_esperado": "A data de validade 31/12/2026 esta gravada"}]', 'O documento e guardado com a data de validade 31/12/2026, que persiste ao reabrir.', 'IMPACTO SE FALHAR: sem guardar a validade, nao ha como controlar vencimento de ASOs, certificados e licencas — perde-se a base de qualquer alerta ou relatorio de documentos vencendo.', 'api', NULL, 'em_triagem', NULL),
    ('DOC-041', 'Documento com validade vencida (status nao recalcula)', 'excecao', 'alta', 'aprovado', 'Verificar o que acontece com um documento cuja validade JA passou: o status muda sozinho para vencido? Regra esperada: um documento vencido deveria refletir isso no status. Este caso revela se ha automacao de validade no modulo geral de documentos. Importa porque, se ninguem marcar, um documento vencido continua parecendo valido nas telas e relatorios — risco real em fiscalizacao.', 'Acesso ao envio de documentos com data de validade.', '[{"acao": "Guardar um documento com validade JA vencida", "dados": "Arquivo: vencido.pdf | Data de validade: uma data do ano passado (ja vencida)", "ordem": 1, "onde_na_tela": "Documentos > Enviar > Data de Validade", "resultado_esperado": "O documento e aceito"}, {"acao": "Conferir o status do documento", "dados": "-", "ordem": 2, "onde_na_tela": "Abrir o documento > campo Status", "resultado_esperado": "Idealmente o status DEVERIA indicar vencido"}]', 'O status deveria refletir que o documento esta vencido. ACHADO ATUAL: o status continua "valido" — nao ha trigger nem rotina que recalcule a validade no modulo geral de documentos. A validade fica sendo apenas um dado guardado.', 'IMPACTO SE FALHAR (e falha hoje): documentos vencidos continuam aparecendo como validos no banco. Se alguma tela, relatorio ou integracao confiar no campo status, vai tratar um ASO vencido como valido — risco direto em fiscalizacao. CORRECAO SUGERIDA: aplicar em documentos a mesma automacao que JA EXISTE em terceiro_documentos (enum fechado + trigger que calcula valido/a_vencer/vencido pela data), ou criar uma rotina diaria que atualize os vencidos. NOTA: a boa pratica ja esta implementada em outro modulo do sistema — falta replicar aqui. Alem disso, nao existe hoje rotina agendada que AVISE sobre documentos vencendo; se ha aviso, e calculado na tela ao abrir.', 'api', NULL, 'em_triagem', NULL),
    ('DOC-042', 'Status de documento aceita texto livre (sem enum)', 'excecao', 'media', 'aprovado', 'Verificar se o campo status de um documento aceita qualquer texto ou tem uma lista fechada de valores. Regra esperada: status deveria ser uma lista controlada (valido, vencido, pendente...). Importa porque um status livre permite valores sem sentido entrarem por importacao ou API, quebrando filtros e relatorios que dependem dele.', 'Acesso ao registro de documentos (via importacao ou API, onde o status pode ser informado diretamente).', '[{"acao": "Tentar registrar um documento com um status sem sentido", "dados": "Arquivo: x.pdf | Status: abacaxi (valor sem sentido, so para testar)", "ordem": 1, "onde_na_tela": "Documentos > registro via importacao/API com o campo status", "resultado_esperado": "Idealmente o sistema DEVERIA recusar um status fora da lista"}]', 'O status invalido deveria ser RECUSADO. ACHADO ATUAL: o banco ACEITA qualquer texto — o campo status e TEXT livre, sem enum nem CHECK.', 'IMPACTO SE FALHAR (e falha hoje): um status invalido entra pela importacao ou API e quebra filtros e relatorios que agrupam por status — o documento some das listas filtradas ou aparece numa categoria inexistente. CORRECAO SUGERIDA: transformar status em enum (ou adicionar CHECK com a lista de valores validos), como ja e feito em terceiro_documentos e em varias outras tabelas do sistema.', 'api', NULL, 'em_triagem', NULL)
) AS d(codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
CROSS JOIN public.qa_modulos m
WHERE m.path = 'documentos-governanca/documentos'
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


-- (3) PONTES — 35 ligacoes caso -> rotina.

INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo)
SELECT d.codigo::text, d.funcao_sql::text, d.ativo::boolean
FROM (VALUES
    ('DESL-001', 'qa_caso_desl_001', true),
    ('DESL-002', 'qa_caso_desl_002', true),
    ('DESL-003', 'qa_caso_desl_003', true),
    ('DESL-004', 'qa_caso_desl_004', true),
    ('DESL-006', 'qa_caso_desl_006', true),
    ('DESL-013', 'qa_caso_desl_013', true),
    ('DESL-015', 'qa_caso_desl_015', true),
    ('DESL-025', 'qa_caso_desl_025', true),
    ('DESL-057', 'qa_caso_desl_057', true),
    ('DESL-065', 'qa_caso_desl_065', true),
    ('DESL-072', 'qa_caso_desl_072', true),
    ('DESL-073', 'qa_caso_desl_073', true),
    ('DESL-074', 'qa_caso_desl_074', true),
    ('DESL-081', 'qa_caso_desl_081', true),
    ('DESL-083', 'qa_caso_desl_083', true),
    ('DESL-091', 'qa_caso_desl_091', true),
    ('DESL-093', 'qa_caso_desl_093', true),
    ('DESL-094', 'qa_caso_desl_094', true),
    ('DESL-101', 'qa_caso_desl_101', true),
    ('DESL-104', 'qa_caso_desl_104', true),
    ('DESL-105', 'qa_caso_desl_105', true),
    ('DESL-106', 'qa_caso_desl_106', true),
    ('DESL-110', 'qa_caso_desl_110', true),
    ('DOC-001', 'qa_caso_doc_001', true),
    ('DOC-002', 'qa_caso_doc_002', true),
    ('DOC-003', 'qa_caso_doc_003', true),
    ('DOC-010', 'qa_caso_doc_010', true),
    ('DOC-011', 'qa_caso_doc_011', true),
    ('DOC-013', 'qa_caso_doc_013', true),
    ('DOC-014', 'qa_caso_doc_014', true),
    ('DOC-022', 'qa_caso_doc_022', true),
    ('DOC-030', 'qa_caso_doc_030', true),
    ('DOC-040', 'qa_caso_doc_040', true),
    ('DOC-041', 'qa_caso_doc_041', true),
    ('DOC-042', 'qa_caso_doc_042', true)
) AS d(codigo, funcao_sql, ativo)
WHERE to_regprocedure('public.' || d.funcao_sql || '()') IS NOT NULL
ON CONFLICT (codigo) DO UPDATE SET
      funcao_sql = EXCLUDED.funcao_sql, ativo = EXCLUDED.ativo;


-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: esperados = casos_no_alvo = 80, ponte_orfa = 0, OK
--   (com_rotina pode ser menor: caso de tela (e2e) nao tem rotina no motor.)
-- ---------------------------------------------------------------------------
WITH alvo(codigo) AS (VALUES ('DESL-001'), ('DESL-002'), ('DESL-003'), ('DESL-004'), ('DESL-006'), ('DESL-010'), ('DESL-011'), ('DESL-012'), ('DESL-013'), ('DESL-014'), ('DESL-015'), ('DESL-020'), ('DESL-021'), ('DESL-022'), ('DESL-023'), ('DESL-024'), ('DESL-025'), ('DESL-030'), ('DESL-031'), ('DESL-032'), ('DESL-033'), ('DESL-034'), ('DESL-035'), ('DESL-036'), ('DESL-037'), ('DESL-040'), ('DESL-041'), ('DESL-042'), ('DESL-043'), ('DESL-044'), ('DESL-045'), ('DESL-046'), ('DESL-050'), ('DESL-051'), ('DESL-052'), ('DESL-055'), ('DESL-057'), ('DESL-060'), ('DESL-061'), ('DESL-062'), ('DESL-063'), ('DESL-064'), ('DESL-065'), ('DESL-066'), ('DESL-067'), ('DESL-070'), ('DESL-071'), ('DESL-072'), ('DESL-073'), ('DESL-074'), ('DESL-076'), ('DESL-077'), ('DESL-080'), ('DESL-081'), ('DESL-082'), ('DESL-083'), ('DESL-090'), ('DESL-091'), ('DESL-092'), ('DESL-093'), ('DESL-094'), ('DESL-100'), ('DESL-101'), ('DESL-102'), ('DESL-104'), ('DESL-105'), ('DESL-106'), ('DESL-110'), ('DOC-001'), ('DOC-002'), ('DOC-003'), ('DOC-010'), ('DOC-011'), ('DOC-013'), ('DOC-014'), ('DOC-022'), ('DOC-030'), ('DOC-040'), ('DOC-041'), ('DOC-042')),
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
