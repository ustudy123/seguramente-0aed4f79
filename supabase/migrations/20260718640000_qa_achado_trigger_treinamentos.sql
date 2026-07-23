-- =========================================================
-- QA — ACHADO: trigger de treinamentos de terceiros quebra sem data de validade
--
-- COMO APARECEU: o caso TTRE-010 passou no ambiente de teste e deu ERRO no
-- banco real. A mensagem tecnica gravada — record "new" has no field
-- "arquivo_url" — levou a causa.
--
-- A CAUSA (apurada nas migrations):
--   A funcao atualizar_status_terceiro_doc() serve DUAS tabelas:
--     - terceiro_documentos   (tem a coluna arquivo_url)
--     - terceiro_treinamentos (tem certificado_url, NAO tem arquivo_url)
--
--   A versao original da funcao (migration de 14/02, 05:18) nao acessava
--   arquivo_url e funcionava nas duas. Uma versao posterior (mesma data,
--   05:24) passou a acessar NEW.arquivo_url — mas apenas dentro do ramo
--   "data_validade IS NULL":
--
--       IF NEW.data_validade IS NULL THEN
--         IF NEW.arquivo_url IS NOT NULL THEN   <-- quebra em treinamentos
--           NEW.status := 'valido';
--         ELSE
--           NEW.status := 'pendente';
--         END IF;
--       ELSIF ...
--
--   Como o acesso e condicional, o problema fica LATENTE: registrar um
--   treinamento COM data de validade funciona normalmente. So quebra quando
--   a data e omitida.
--
-- O IMPACTO REAL: e impossivel registrar um treinamento de terceiro sem
-- informar data de validade — o usuario recebe erro de banco. E ha
-- treinamentos que legitimamente nao tem prazo (integracao, ordem de
-- servico, orientacoes internas).
--
-- OUTRA DESCOBERTA no mesmo diff: a janela de alerta mudou de 30 para 60
-- dias nessa versao. A documentacao do caso TDOC-002 e corrigida abaixo.
--
-- ESTE ARQUIVO:
--   1. Corrige TTRE-010 para testar o que ele pretendia (trabalhador
--      obrigatorio), informando validade e assim contornando o bug.
--   2. Cria TTRE-011, que captura o bug especificamente.
--   3. Corrige a documentacao de TDOC-002 (janela de 60 dias).
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- 1. TTRE-010 — informar validade para testar o NOT NULL isoladamente
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_caso_ttre_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_ter uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar registrar treinamento sem trabalhador';
  r.esperado:='Recusado — treinamento e individual (trabalhador_id NOT NULL)';
  v_ter := public.qa_novo_terceiro('[QA] Prestadora Treino Sem Dono', '11333444000262');
  BEGIN
    -- data_validade informada de proposito: sem ela, a trigger quebra antes
    -- de o NOT NULL ser verificado (ver o achado no caso TTRE-011)
    INSERT INTO public.terceiro_treinamentos
      (tenant_id, terceiro_id, trabalhador_id, tipo, data_validade)
    VALUES (v_t, v_ter, NULL, 'NR-10', CURRENT_DATE + 90);
    r.situacao:='falhou'; r.obtido:='ACEITOU treinamento sem trabalhador — nao daria para saber quem esta apto.';
  EXCEPTION WHEN not_null_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: treinamento exige trabalhador, como deve ser (e individual).';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

-- ─────────────────────────────────────────────────────────
-- 2. TTRE-011 — o achado
-- ─────────────────────────────────────────────────────────
DO $seed$
DECLARE v_mod uuid;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos WHERE path='estrutura-organizacional/prestadores';

  INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, nivel, objetivo, pre_condicoes, passos, resultado_esperado, observacoes)
  VALUES
  (v_mod,'TTRE-011','Treinamento sem data de validade quebra o cadastro','excecao','critica','aprovado','api',
   'Verificar se e possivel registrar um treinamento de terceiro sem informar data de validade. '
   'Regra esperada: a data e opcional (o campo aceita nulo), e o status deveria ficar "pendente". '
   'Importa porque ha treinamentos que legitimamente nao tem prazo — integracao, ordem de servico, '
   'orientacoes internas. Este caso revela um erro de banco que impede o cadastro.',
   'Precisa existir um terceiro com um trabalhador cadastrado.',
   '[
     {"ordem":1,"acao":"Abrir os treinamentos de um trabalhador terceirizado","onde_na_tela":"Terceiros > abrir o terceiro > Trabalhadores > abrir o trabalhador > aba Treinamentos > Adicionar","dados":"-","resultado_esperado":"Formulario de treinamento aberto"},
     {"ordem":2,"acao":"Preencher o treinamento SEM informar data de validade","onde_na_tela":"Campos Tipo e Data de Validade","dados":"Tipo: Integracao | Data de validade: (deixar em branco) | Certificado: (nenhum)","resultado_esperado":"Deveria salvar normalmente, com status pendente"},
     {"ordem":3,"acao":"Tentar salvar","onde_na_tela":"Botao Salvar","dados":"-","resultado_esperado":"Deveria gravar. RESULTADO REAL: erro de banco, o treinamento nao e salvo"}
   ]'::jsonb,
   'O treinamento deveria ser salvo com status "pendente" (mesmo comportamento de um documento sem '
   'validade, caso TDOC-004). RESULTADO REAL: erro de banco — record "new" has no field '
   '"arquivo_url". O cadastro e impossivel.',
   'IMPACTO (falha hoje, e impede o uso): nao da para registrar nenhum treinamento sem data de '
   'validade. Treinamentos sem prazo (integracao, ordem de servico) nao podem ser cadastrados, e o '
   'usuario recebe um erro tecnico sem explicacao. '
   'CAUSA: a funcao atualizar_status_terceiro_doc() serve as duas tabelas de terceiros, mas acessa '
   'NEW.arquivo_url — coluna que existe em terceiro_documentos e NAO existe em '
   'terceiro_treinamentos (la o campo se chama certificado_url). O acesso so acontece no ramo '
   '"data_validade IS NULL", por isso o problema fica latente: treinamento COM validade funciona. '
   'CORRECAO SUGERIDA: separar em duas funcoes, ou tornar o acesso ao campo condicional. A opcao '
   'mais simples e criar uma funcao propria para treinamentos usando certificado_url no lugar de '
   'arquivo_url, e trocar a trigger auto_status_terceiro_treinamentos para usa-la.')
  ON CONFLICT (codigo) DO NOTHING;
END $seed$;

CREATE OR REPLACE FUNCTION public.qa_caso_ttre_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_ter uuid; v_trab uuid; v_tre uuid; v_st text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar terceiro e trabalhador';
  v_ter := public.qa_novo_terceiro('[QA] Prestadora Treino Sem Validade', '11333444000343');
  INSERT INTO public.terceiro_trabalhadores (tenant_id, terceiro_id, nome, cpf)
  VALUES (v_t, v_ter, '[QA] Trabalhador Integracao', '52998224725') RETURNING id INTO v_trab;

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

INSERT INTO public.qa_implementacoes (codigo, funcao_sql) VALUES
  ('TTRE-011','qa_caso_ttre_011')
ON CONFLICT (codigo) DO UPDATE SET funcao_sql=EXCLUDED.funcao_sql, ativo=true;

-- ─────────────────────────────────────────────────────────
-- 3. TDOC-002 — corrigir a janela de alerta: 60 dias, não 30
-- ─────────────────────────────────────────────────────────
UPDATE public.qa_casos_teste SET
  objetivo = 'Verificar que um documento com validade proxima recebe status "a_vencer" '
           || 'automaticamente. Regra: a faixa de alerta e de 60 dias antes do vencimento '
           || '(a versao inicial usava 30 dias; foi ampliada para 60). Importa porque e esse status '
           || 'que permite agir ANTES de o documento vencer — renovar a tempo, cobrar o prestador.',
  passos = '[
     {"ordem":1,"acao":"Anexar um documento com validade proxima","onde_na_tela":"Terceiro > Documentos > Adicionar","dados":"Tipo: ASO | Nome: ASO Joao | Data de validade: daqui a 15 dias","resultado_esperado":"Documento salvo"},
     {"ordem":2,"acao":"Conferir o status","onde_na_tela":"Lista de documentos","dados":"-","resultado_esperado":"Status: a_vencer — a janela de alerta e de 60 dias"}
   ]'::jsonb,
  resultado_esperado = 'O documento fica com status "a_vencer", porque a validade cai dentro da '
                     || 'janela de 60 dias.',
  observacoes = 'IMPACTO SE FALHAR: sem o aviso previo, os documentos so seriam percebidos depois de '
              || 'vencidos — o prestador ficaria irregular antes de alguem notar. A janela de 60 dias '
              || 'e o que da tempo de reagir (renovar exames, cobrar certidoes).'
WHERE codigo = 'TDOC-002';

-- ── Rodar ──
DO $roda$ BEGIN PERFORM public.qa_rodar_bateria('manual', 'estrutura-organizacional/prestadores'); END $roda$;

SELECT codigo, situacao::text, left(obtido, 70) AS resultado
FROM public.qa_resultados
WHERE execucao_id = (SELECT id FROM public.qa_execucoes ORDER BY iniciada_em DESC LIMIT 1)
  AND codigo LIKE 'TTRE-%'
ORDER BY codigo;
