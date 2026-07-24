-- =========================================================
-- QA — correção do OBRG-013: a regra real é SET NULL, não bloqueio
--
-- COMO APARECEU: o caso passou no ambiente de teste e falhou no banco real —
-- a divergencia inverteu-se em relacao aos casos anteriores, e foi o banco
-- real que revelou a regra correta.
--
-- A CAUSA: li a definicao original de empresa_obrigacoes (fevereiro), onde
-- acao_gerada_id nao declarava ON DELETE — o que no Postgres significa
-- NO ACTION, ou seja, exclusao bloqueada. Mas a migration 20260511145457
-- (11/05) trocou a constraint deliberadamente:
--
--   ALTER TABLE public.empresa_obrigacoes
--     DROP CONSTRAINT empresa_obrigacoes_acao_gerada_id_fkey,
--     ADD CONSTRAINT empresa_obrigacoes_acao_gerada_id_fkey
--       FOREIGN KEY (acao_gerada_id) REFERENCES public.plano_acoes(id)
--       ON DELETE SET NULL;
--
-- A REGRA REAL, e ela faz sentido: apagar uma acao do plano NAO deve ser
-- bloqueado por causa de uma obrigacao que a referencia. A acao e apagada e
-- a obrigacao volta a nao ter acao vinculada. O contrario travaria a gestao
-- do plano de acao.
--
-- Terceira vez nesta sessao que a definicao original nao conta a historia
-- toda (IDE-020, a expansao de metas em marco, e agora esta).
--
-- O caso e reescrito para verificar o comportamento correto: a acao some, a
-- obrigacao sobrevive, o vinculo fica nulo.
-- =========================================================

UPDATE public.qa_casos_teste SET
  titulo = 'Apagar a acao desvincula a obrigacao, sem apaga-la',
  tipo = 'alternativo',
  objetivo = 'Verificar o que acontece com a obrigacao quando a acao que a resolveria e apagada. '
           || 'Regra: acao_gerada_id ON DELETE SET NULL — a acao pode ser apagada normalmente, e a '
           || 'obrigacao apenas perde o vinculo, voltando a ficar sem encaminhamento. Importa porque '
           || 'o contrario travaria a gestao do plano: nao daria para apagar uma acao enquanto '
           || 'houvesse uma obrigacao apontando para ela.',
  pre_condicoes = 'Precisa existir uma obrigacao vinculada a uma acao do plano.',
  passos = '[
     {"ordem":1,"acao":"Ter uma obrigacao nao conforme com acao gerada","onde_na_tela":"Empresa > Obrigacoes","dados":"Obrigacao vinculada a uma acao do plano","resultado_esperado":"Vinculo existe"},
     {"ordem":2,"acao":"Apagar a acao no plano de acao","onde_na_tela":"Plano de Acao > abrir a acao > Excluir","dados":"-","resultado_esperado":"A acao e apagada normalmente, sem bloqueio"},
     {"ordem":3,"acao":"Conferir a obrigacao","onde_na_tela":"Empresa > Obrigacoes","dados":"-","resultado_esperado":"A obrigacao AINDA EXISTE, agora sem acao vinculada — volta a aparecer como pendente de encaminhamento"}
   ]'::jsonb,
  resultado_esperado = 'A acao e apagada com sucesso. A obrigacao sobrevive, com o vinculo nulo. O '
                     || 'registro de conformidade nao se perde quando o encaminhamento e cancelado.',
  observacoes = 'COMPORTAMENTO CORRETO, verificado. A regra foi definida em 11/05/2026, quando a '
              || 'constraint passou de NO ACTION para ON DELETE SET NULL. '
              || 'PONTO DE ATENCAO OPERACIONAL (nao e defeito): com SET NULL, apagar uma acao faz a '
              || 'obrigacao voltar silenciosamente ao estado "sem acao". Se a obrigacao estava '
              || 'nao_conforme, ela continua nao_conforme, agora sem ninguem responsavel — e nada '
              || 'avisa. Vale avaliar no produto se esse retorno merece um alerta, ou se o painel de '
              || 'conformidade destaca obrigacoes nao conformes sem acao vinculada.'
WHERE codigo = 'OBRG-013';

CREATE OR REPLACE FUNCTION public.qa_caso_obrg_013()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_acao uuid; v_obr uuid;
        v_obr_existe boolean; v_vinculo uuid; v_acao_existe boolean;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar acao e obrigacao vinculada a ela';
  r.esperado:='Apagar a acao desvincula a obrigacao, sem apaga-la (SET NULL)';
  v_acao := public.qa_nova_acao('[QA] Acao Que Sera Apagada');
  v_obr := public.qa_nova_obrigacao('legal', '[QA] Obrigacao Sobrevivente', 'nao_conforme', 'alta', 'tac', v_acao);

  r.passo_ordem:=2; r.passo_acao:='Apagar a acao no plano';
  DELETE FROM public.plano_acoes WHERE id=v_acao;

  r.passo_ordem:=3; r.passo_acao:='Conferir que a obrigacao sobreviveu, sem o vinculo';
  SELECT EXISTS(SELECT 1 FROM public.plano_acoes WHERE id=v_acao) INTO v_acao_existe;
  SELECT EXISTS(SELECT 1 FROM public.empresa_obrigacoes WHERE id=v_obr) INTO v_obr_existe;
  SELECT acao_gerada_id INTO v_vinculo FROM public.empresa_obrigacoes WHERE id=v_obr;

  IF NOT v_acao_existe AND v_obr_existe AND v_vinculo IS NULL THEN
    r.situacao:='passou';
    r.obtido:='Acao apagada; a obrigacao sobreviveu e ficou sem acao vinculada (SET NULL). O registro de conformidade nao se perde.';
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('Esperava acao apagada, obrigacao viva e vinculo nulo. Obteve: acao_existe=%s, obrigacao_existe=%s, vinculo=%s.',
                     v_acao_existe, v_obr_existe, v_vinculo);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

-- ── Rodar ──
DO $roda$ BEGIN PERFORM public.qa_rodar_bateria('manual', 'estrutura-organizacional/empresa'); END $roda$;

SELECT codigo, situacao::text, left(obtido, 72) AS resultado
FROM public.qa_resultados
WHERE execucao_id = (SELECT id FROM public.qa_execucoes ORDER BY iniciada_em DESC LIMIT 1)
  AND codigo LIKE 'OBRG-%'
ORDER BY (situacao='falhou') DESC, codigo;
