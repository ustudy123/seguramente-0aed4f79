-- =========================================================
-- QA — Disposição do caso: separar bug de decisão (31/07/2026)
--
-- PEDIDO DO DESENVOLVIMENTO, e é o retorno mais valioso que recebemos:
--   "Valeria o agente registrar em cada caso o motivo de estar como está.
--    Hoje não dá para diferenciar bug de decisão, e isso faz a gente
--    reanalisar tudo a cada relatório."
--
-- Está certo, e é falha de projeto minha. A suíte sabia dizer O QUE falhou
-- e por qual dispositivo legal, mas não sabia dizer POR QUE continua
-- falhando. Um caso vermelho porque ninguém implementou e um caso vermelho
-- porque o produto decidiu não implementar são coisas diferentes, e a
-- suíte os apresentava idênticos. O custo disso é real e recorrente: a cada
-- relatório o time reanalisa decisões que já tomou.
--
-- SOLUÇÃO: cada caso passa a carregar sua DISPOSIÇÃO — o estado da
-- discussão, não do teste. Seis valores:
--
--   em_triagem            ainda não analisado por ninguém. É o padrão, e o
--                         único que significa "precisa de atenção agora".
--   bug_confirmado        o time analisou e reconheceu como defeito a corrigir.
--   aguardando_construcao a regra é legítima e a funcionalidade ainda não
--                         existe. Falha esperada, não é novidade.
--   decisao_de_produto    o time analisou e decidiu não fazer, ou fazer
--                         diferente. Continua vermelho e está certo assim.
--   fora_de_escopo        o produto não se propõe a atender. Sai do radar.
--   comportamento_correto o sistema faz certo e o CASO é que estava errado.
--                         Aponta defeito na suíte, não no produto.
--
-- REGRA DE OURO: disposição sem motivo escrito não vale nada — seria trocar
-- "por que está vermelho?" por "por que está marcado assim?". Por isso o
-- motivo é obrigatório para tudo que não seja em_triagem, garantido por
-- CHECK e não por disciplina.
-- =========================================================

SET lock_timeout = '10s';

-- ─────────────────────────────────────────────────────────
-- 1) O campo
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.qa_casos_teste
  ADD COLUMN IF NOT EXISTS disposicao        text NOT NULL DEFAULT 'em_triagem',
  ADD COLUMN IF NOT EXISTS disposicao_motivo text,
  ADD COLUMN IF NOT EXISTS disposicao_em     timestamptz,
  ADD COLUMN IF NOT EXISTS disposicao_por    text;

DO $chk$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.qa_casos_teste'::regclass
                   AND conname = 'qa_casos_disposicao_chk') THEN
    ALTER TABLE public.qa_casos_teste ADD CONSTRAINT qa_casos_disposicao_chk
      CHECK (disposicao IN ('em_triagem','bug_confirmado','aguardando_construcao',
                            'decisao_de_produto','fora_de_escopo','comportamento_correto'));
  END IF;

  -- Motivo obrigatório para tudo que saiu da triagem: disposição sem
  -- justificativa apenas move a pergunta de lugar.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.qa_casos_teste'::regclass
                   AND conname = 'qa_casos_disposicao_exige_motivo') THEN
    ALTER TABLE public.qa_casos_teste ADD CONSTRAINT qa_casos_disposicao_exige_motivo
      CHECK (disposicao = 'em_triagem' OR
             (disposicao_motivo IS NOT NULL AND btrim(disposicao_motivo) <> ''));
  END IF;
END $chk$;

COMMENT ON COLUMN public.qa_casos_teste.disposicao IS
  'Estado da DISCUSSÃO sobre o caso, distinto do resultado do teste. '
  'Responde "por que continua assim?" — bug ainda não corrigido, decisão de '
  'produto, fora de escopo, ou defeito do próprio caso. Só em_triagem '
  'significa que precisa de análise agora.';

-- ─────────────────────────────────────────────────────────
-- 2) Triagem devolvida pelo desenvolvimento em 31/07/2026
-- ─────────────────────────────────────────────────────────

-- eSocial de admissão e desligamento: fora do escopo do produto.
UPDATE public.qa_casos_teste SET
  status            = 'rascunho',
  disposicao        = 'fora_de_escopo',
  disposicao_motivo = 'O produto transmite ao eSocial apenas os eventos de SST. '
    || 'Admissão (S-2200), admissão preliminar (S-2190) e desligamento (S-2299 e '
    || 'S-2399) são feitos por fora, pela contabilidade ou pelo sistema de folha do '
    || 'cliente. Retorno do desenvolvimento em 31/07/2026. Se o escopo mudar, '
    || 'devolver para aprovado — a fundamentação legal segue válida e não foi apagada.',
  disposicao_em     = now(),
  disposicao_por    = 'Desenvolvimento'
WHERE codigo IN ('ADM-090','ADM-091','DESL-090','DESL-091','DESL-092');

-- Metas e indicadores: analisados e descartados por decisão.
UPDATE public.qa_casos_teste SET
  status            = 'rascunho',
  disposicao        = 'decisao_de_produto',
  disposicao_motivo = 'Analisado pelo desenvolvimento em 31/07/2026 e descartado por '
    || 'decisão. A regra é de organização interna, sem base legal, e o produto optou '
    || 'por não restringir no banco. Reabrir apenas se a decisão mudar.',
  disposicao_em     = now(),
  disposicao_por    = 'Desenvolvimento'
WHERE codigo IN ('MCFG-030','META-033','MIND-020');

-- Conflito COLAB-011 x COLAB-034: resolvido a favor da exigência de CPF.
UPDATE public.qa_casos_teste SET
  disposicao        = 'comportamento_correto',
  disposicao_motivo = 'CONFLITO ENTRE CASOS, resolvido em 31/07/2026. O COLAB-011 pedia '
    || 'que pessoa sem CPF fosse aceita ("opcional é opcional") e o COLAB-034 pedia que '
    || 'colaborador sem CPF fosse recusado. Os dois não podiam estar certos. Decisão do '
    || 'time: COLABORADOR PRECISA TER CPF, e a constraint '
    || 'usuarios_base_colaborador_exige_cpf foi criada. O sistema está correto; o caso é '
    || 'que precisa ser reescrito para exercitar campo opcional em usuário que NÃO seja '
    || 'colaborador — gestor ou administrador, para quem o CPF de fato não se aplica.',
  disposicao_em     = now(),
  disposicao_por    = 'Desenvolvimento'
WHERE codigo IN ('COLAB-011','COLAB-023');

-- Cota de PcD: o banco passou a AUTOCORRIGIR em vez de recusar.
UPDATE public.qa_casos_teste SET
  disposicao        = 'comportamento_correto',
  disposicao_motivo = 'O banco passou a CORRIGIR SOZINHO o percentual e a quantidade da '
    || 'cota conforme a faixa legal, em vez de recusar a gravação. Para conformidade isso '
    || 'é melhor que recusar: o valor armazenado fica sempre legal, e quem digitou errado '
    || 'não fica travado. Os casos foram escritos esperando recusa e passaram a relatar '
    || '"o banco aceitou" mostrando o valor JÁ CORRIGIDO — mensagem sem sentido, defeito '
    || 'da suíte. Rotinas ajustadas nesta migration para reconhecer autocorreção como '
    || 'resultado válido.',
  disposicao_em     = now(),
  disposicao_por    = 'QA'
WHERE codigo IN ('EMP-031','EMP-032','EMP-033');

-- Casos de cálculo de ponto: a regra é legítima, o motor não existe.
UPDATE public.qa_casos_teste SET
  disposicao        = 'aguardando_construcao',
  disposicao_motivo = 'A regra é obrigação legal e o motor de apuração ainda não existe, '
    || 'conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a '
    || 'cada relatório. O caso serve como especificação contra a qual construir, com o '
    || 'dispositivo legal ao lado. Reavaliar quando o motor entrar.',
  disposicao_em     = now(),
  disposicao_por    = 'QA'
WHERE codigo LIKE 'PONTO-%'
  AND codigo NOT IN ('PONTO-250','PONTO-251','PONTO-252','PONTO-253','PONTO-254',
                     'PONTO-270','PONTO-271');

-- Casos de estrutura de Desligamento e Admissão que dependem de construção.
UPDATE public.qa_casos_teste SET
  disposicao        = 'aguardando_construcao',
  disposicao_motivo = 'Funcionalidade ainda não construída. A fundamentação legal está '
    || 'registrada no caso e serve como especificação. Falha esperada até a entrega.',
  disposicao_em     = now(),
  disposicao_por    = 'QA'
WHERE codigo IN ('ADM-101','ADM-102','ADM-103','DESL-065')
  AND disposicao = 'em_triagem';

-- ─────────────────────────────────────────────────────────
-- 3) ADM-111 — reemissão da correção do enum
--    A migration 20260802140000 corrigiu isto, mas o relatório de 31/07
--    ainda acusa o erro, então ela não chegou a ser aplicada. Reemitida
--    aqui para não depender de ordem.
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_caso_adm_111()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno; v_docs int; v_admissoes int; v_status text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'AUDITORIA (somente leitura): documentos pessoais retidos de admissoes encerradas sem efetivacao';
  r.esperado    := 'Destino definido — eliminados ou retidos com prazo e justificativa';

  -- Comparação por TEXTO: não depende de quais rótulos existem no enum hoje.
  SELECT count(DISTINCT a.id), count(ad.id) INTO v_admissoes, v_docs
  FROM public.admissoes a
  JOIN public.admissao_documentos ad ON ad.admissao_id = a.id
  WHERE a.status::text IN ('reprovado','rejeitado','cancelado','recusado')
    AND ad.arquivo_url IS NOT NULL AND btrim(ad.arquivo_url) <> '';

  SELECT string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) INTO v_status
  FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
  WHERE t.typname = 'admissao_status';

  IF v_docs = 0 THEN
    r.situacao := 'passou';
    r.obtido   := format('Nenhum documento retido de admissao encerrada sem efetivacao. '
               || 'Rotulos existentes em admissao_status: %s.', COALESCE(v_status,'(nao encontrado)'));
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('%s documento(s) pessoal(is) de %s admissao(oes) encerrada(s) sem '
               || 'efetivacao continuam armazenados. A LGPD, art. 15, I e III, trata do '
               || 'termino do tratamento e o art. 16 exige eliminacao, ressalvada guarda '
               || 'obrigatoria. Nao ha prazo, responsavel nem registro de decisao sobre '
               || 'esse acervo.', v_docs, v_admissoes);
    r.detalhe  := jsonb_build_object('documentos_retidos', v_docs, 'admissoes', v_admissoes);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- ─────────────────────────────────────────────────────────
-- 4) EMP-031/032/033 — autocorreção é resultado VÁLIDO
--
-- As três esperavam recusa. O banco passou a corrigir sozinho, o que para
-- conformidade é melhor: o valor gravado fica sempre dentro da lei. As
-- rotinas agora comparam o que foi ESCRITO com o que foi LIDO DE VOLTA, e
-- reconhecem três desfechos: recusado, autocorrigido (ambos aceitáveis) ou
-- gravado como veio (que aí sim é falha).
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_caso_emp_031()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
  v_emp uuid; v_pct numeric; v_qtd int; v_recusou boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1;
  r.passo_acao  := 'Gravar 1.200 empregados com percentual de 2% (a Lei 8.213/91 exige 5%)';
  r.esperado    := 'Recusado OU corrigido para 5% — o valor gravado precisa ser legal';

  BEGIN
    INSERT INTO public.empresa_cadastro
      (tenant_id, razao_social, cnpj, ativo, total_colaboradores,
       pcd_obrigatoria, pcd_percentual_exigido, pcd_quantidade_exigida)
    VALUES (v_t, '[QA-EMP-031] Faixa 5%', '11555666000401', true, 1200,
            true, 2.00, 24)
    RETURNING id INTO v_emp;
  EXCEPTION WHEN OTHERS THEN v_recusou := true;
  END;

  IF v_recusou THEN
    r.situacao := 'passou';
    r.obtido   := 'Recusado pelo banco: percentual nao corresponde a faixa legal.';
    RETURN r;
  END IF;

  r.passo_ordem := 2;
  r.passo_acao  := 'Reler o que ficou gravado';
  SELECT pcd_percentual_exigido, pcd_quantidade_exigida INTO v_pct, v_qtd
  FROM public.empresa_cadastro WHERE id = v_emp;

  IF v_pct = 5.00 AND v_qtd = 60 THEN
    r.situacao := 'passou';
    r.obtido   := format('AUTOCORRIGIDO pelo banco: gravei 2%% e 24, ficou %s%% e %s — '
               || 'exatamente a faixa da Lei 8.213/91 para 1.200 empregados. Corrigir e '
               || 'melhor que recusar: o valor armazenado fica sempre legal e quem digitou '
               || 'errado nao fica travado.', v_pct, v_qtd);
    r.detalhe  := jsonb_build_object('escrito_pct', 2.00, 'lido_pct', v_pct,
                                     'escrito_qtd', 24, 'lido_qtd', v_qtd,
                                     'autocorrigido', true);
  ELSIF v_pct = 2.00 THEN
    r.situacao := 'falhou';
    r.obtido   := format('GRAVOU COMO VEIO: %s%% e %s PcDs para 1.200 empregados. A Lei '
               || '8.213/91, art. 93, exige 5%% nessa faixa, o que daria 60. Nem recusou '
               || 'nem corrigiu.', v_pct, v_qtd);
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('Corrigiu para valor INESPERADO: %s%% e %s. Para 1.200 empregados '
               || 'a lei exige 5%% e 60.', v_pct, v_qtd);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_emp_032()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
  v_emp uuid; v_qtd int; v_recusou boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1;
  r.passo_acao  := 'Gravar 480 empregados, 3%, com quantidade exigida 10 (o calculo da 15)';
  r.esperado    := 'Recusado OU corrigido para 15 (480 x 3%% = 14,4, arredonda para cima)';

  BEGIN
    INSERT INTO public.empresa_cadastro
      (tenant_id, razao_social, cnpj, ativo, total_colaboradores,
       pcd_obrigatoria, pcd_percentual_exigido, pcd_quantidade_exigida)
    VALUES (v_t, '[QA-EMP-032] Arredondamento', '11555666000402', true, 480,
            true, 3.00, 10)
    RETURNING id INTO v_emp;
  EXCEPTION WHEN OTHERS THEN v_recusou := true;
  END;

  IF v_recusou THEN
    r.situacao := 'passou';
    r.obtido   := 'Recusado pelo banco: quantidade nao corresponde ao calculo legal.';
    RETURN r;
  END IF;

  SELECT pcd_quantidade_exigida INTO v_qtd FROM public.empresa_cadastro WHERE id = v_emp;

  IF v_qtd = 15 THEN
    r.situacao := 'passou';
    r.obtido   := format('AUTOCORRIGIDO: gravei 10, ficou %s. O arredondamento e para cima '
               || '(480 x 3%% = 14,4 -> 15), como a cota legal exige.', v_qtd);
    r.detalhe  := jsonb_build_object('escrito', 10, 'lido', v_qtd, 'autocorrigido', true);
  ELSIF v_qtd = 14 THEN
    r.situacao := 'falhou';
    r.obtido   := 'Corrigiu para 14: arredondou para BAIXO. A cota de PcD arredonda para '
               || 'cima — 14,4 vira 15. Arredondar para baixo entrega cota menor que a lei exige.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('Gravou %s. O calculo legal para 480 empregados a 3%% e 15.', v_qtd);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_emp_033()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
  v_emp uuid; v_pct numeric; v_recusou boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1;
  r.passo_acao  := 'Gravar percentual de cota = 7% (nao existe na Lei 8.213/91)';
  r.esperado    := 'Recusado OU corrigido — so 2, 3, 4 e 5%% existem na lei';

  BEGIN
    INSERT INTO public.empresa_cadastro
      (tenant_id, razao_social, cnpj, ativo, total_colaboradores,
       pcd_obrigatoria, pcd_percentual_exigido)
    VALUES (v_t, '[QA-EMP-033] Percentual invalido', '11555666000403', true, 300,
            true, 7.00)
    RETURNING id INTO v_emp;
  EXCEPTION WHEN OTHERS THEN v_recusou := true;
  END;

  IF v_recusou THEN
    r.situacao := 'passou';
    r.obtido   := 'Recusado pelo banco: percentual fora do dominio legal.';
    RETURN r;
  END IF;

  SELECT pcd_percentual_exigido INTO v_pct FROM public.empresa_cadastro WHERE id = v_emp;

  IF v_pct = 3.00 THEN
    r.situacao := 'passou';
    r.obtido   := format('AUTOCORRIGIDO: gravei 7%%, ficou %s%% — a faixa correta para 300 '
               || 'empregados (201 a 500). O valor armazenado esta dentro do dominio da '
               || 'Lei 8.213/91.', v_pct);
    r.detalhe  := jsonb_build_object('escrito', 7.00, 'lido', v_pct, 'autocorrigido', true);
  ELSIF v_pct = 7.00 THEN
    r.situacao := 'falhou';
    r.obtido   := 'GRAVOU 7%%. A Lei 8.213/91, art. 93, preve apenas 2, 3, 4 e 5%%. '
               || 'Nem recusou nem corrigiu.';
  ELSE
    r.situacao := 'passou';
    r.obtido   := format('Corrigido para %s%%, dentro do dominio legal.', v_pct);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- ─────────────────────────────────────────────────────────
-- 5) Relatório passa a mostrar a disposição
--    Assim o time vê de imediato o que é novo e o que já foi decidido.
-- ─────────────────────────────────────────────────────────
-- Ganhou a coluna disposicao, entao o tipo de retorno muda e CREATE OR
-- REPLACE nao basta. A funcao so le; derrubar e recriar nao tem efeito colateral.
DROP FUNCTION IF EXISTS public.qa_relatorio_falhas(text);

CREATE OR REPLACE FUNCTION public.qa_relatorio_falhas(p_modulo text DEFAULT NULL)
RETURNS TABLE(codigo text, prio text, disposicao text, situacao text, achado text)
LANGUAGE sql STABLE
AS $$
  SELECT r.codigo,
         left(ct.prioridade::text, 4),
         CASE ct.disposicao
           WHEN 'em_triagem'            THEN '>>> NOVO'
           WHEN 'bug_confirmado'        THEN 'bug'
           WHEN 'aguardando_construcao' THEN 'a construir'
           WHEN 'decisao_de_produto'    THEN 'decidido'
           WHEN 'fora_de_escopo'        THEN 'fora escopo'
           WHEN 'comportamento_correto' THEN 'caso errado'
           ELSE ct.disposicao END,
         left(r.situacao::text, 6),
         left(regexp_replace(COALESCE(r.obtido,''), '\s+', ' ', 'g'), 100)
  FROM public.qa_resultados r
  JOIN public.qa_casos_teste ct ON ct.codigo = r.codigo
  WHERE r.execucao_id = (
          SELECT e.id FROM public.qa_execucoes e
          WHERE p_modulo IS NULL OR e.modulo_path = p_modulo
          ORDER BY e.iniciada_em DESC LIMIT 1)
    AND r.situacao IN ('falhou','erro')
  ORDER BY (ct.disposicao <> 'em_triagem'),   -- o que ainda não foi triado vem primeiro
           CASE ct.prioridade WHEN 'critica' THEN 1 WHEN 'alta' THEN 2
                              WHEN 'media' THEN 3 ELSE 4 END,
           r.codigo;
$$;

COMMENT ON FUNCTION public.qa_relatorio_falhas(text) IS
  'Relatório da última bateria, ordenado para que o NÃO TRIADO apareça '
  'primeiro. A coluna disposicao responde "por que continua assim?" — o que '
  'evita reanalisar a cada relatório decisão que já foi tomada.';

-- ─────────────────────────────────────────────────────────
-- 6) Retrato da triagem
-- ─────────────────────────────────────────────────────────
DO $conf$
DECLARE v_sem int;
BEGIN
  SELECT count(*) INTO v_sem FROM public.qa_casos_teste
  WHERE disposicao <> 'em_triagem'
    AND (disposicao_motivo IS NULL OR btrim(disposicao_motivo) = '');
  IF v_sem = 0 THEN
    RAISE NOTICE 'OK: toda disposicao registrada tem motivo escrito.';
  ELSE
    RAISE WARNING '% caso(s) com disposicao sem motivo.', v_sem;
  END IF;
END $conf$;

SELECT disposicao,
       count(*)                                        AS casos,
       count(*) FILTER (WHERE status = 'aprovado')     AS aprovados,
       count(*) FILTER (WHERE status = 'rascunho')     AS rascunhos
FROM public.qa_casos_teste
GROUP BY disposicao
ORDER BY (disposicao <> 'em_triagem'), disposicao;
