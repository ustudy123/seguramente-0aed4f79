-- =========================================================
-- QA — correção de descrição do achado COLAB-021 (CPF inválido)
--
-- MOTIVO: ao montar o relatorio da equipe e escrever o SQL de correcao,
-- descobri que a descricao do achado estava IMPRECISA. Eu havia escrito que
-- "a funcao validar_cpf existe mas nao esta aplicada como trigger".
--
-- Medindo o banco de verdade: NAO existe funcao validar_cpf. A unica funcao
-- com nome parecido e validar_cpf_colaborador_campanha(uuid,text,text), que
-- faz outra coisa (verifica se um CPF pertence a uma campanha psicossocial,
-- nao se o CPF e matematicamente valido).
--
-- A validacao de digitos verificadores existe SO NO FRONT, em TypeScript
-- (src/hooks/useImportacaoPlanilha.ts e
--  src/components/avaliacoes/psicossocial/VerificacaoCPF.tsx).
--
-- Isso MUDA a correcao: nao basta "aplicar" uma funcao existente — e preciso
-- CRIAR a validacao no banco primeiro. O relatorio da equipe ja traz o SQL
-- completo (funcao cpf_e_valido + trigger), testado.
--
-- O achado em si continua valido: o banco aceita CPF invalido. So a
-- explicacao do porque estava errada.
-- =========================================================

-- ── 1. Corrigir o texto do caso de teste ──
UPDATE public.qa_casos_teste SET
  resultado_esperado = 'O cadastro e RECUSADO. O colaborador com CPF "111.111.111-11" NAO deve existir no '
                     || 'banco. ACHADO ATUAL: o banco aceita — a validacao de digitos verificadores existe '
                     || 'APENAS no front-end, em TypeScript. Nao ha nenhuma funcao de validacao de CPF no '
                     || 'banco de dados. Por importacao de planilha, API ou script, um CPF invalido entra '
                     || 'sem qualquer barreira.',
  observacoes = 'IMPACTO SE FALHAR (e falha hoje): CPF invalido no banco quebra a integracao com o eSocial '
              || '(rejeicao pela Receita, com retrabalho e risco de multa por atraso), gera identificacao '
              || 'invalida em relatorios legais de SST e compromete o vinculo legal do trabalhador com todo '
              || 'o seu historico. CORRECAO SUGERIDA: criar no banco uma funcao de validacao de CPF '
              || '(replicando a logica que ja existe no front) e aplica-la como trigger BEFORE INSERT OR '
              || 'UPDATE em usuarios_base. O relatorio da equipe traz o SQL completo e testado. ATENCAO: '
              || 'conferir CPFs invalidos ja existentes na base antes de aplicar a trigger.'
WHERE codigo = 'COLAB-021';

-- ── 2. Corrigir a mensagem que a rotina exibe ao falhar ──
CREATE OR REPLACE FUNCTION public.qa_caso_colab_021()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1;
  r.passo_acao := 'Tentar cadastrar com CPF matematicamente invalido (111.111.111-11)';
  r.esperado := 'Recusado — digito verificador invalido';
  BEGIN
    INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
    VALUES (v_t, '[QA-021] CPF Ruim', 'qa.021.1@sandbox.invalid', '11111111111', 'colaborador', 'ativo')
    RETURNING id INTO v_id;
    r.situacao := 'falhou';
    r.obtido := 'O BANCO ACEITOU CPF invalido. A validacao de digitos verificadores existe apenas no '
             || 'front (TypeScript); nao ha funcao de validacao de CPF no banco. Falta defesa em profundidade.';
  EXCEPTION WHEN check_violation OR others THEN
    IF SQLERRM LIKE '%cpf%' OR SQLERRM LIKE '%valid%' THEN
      r.situacao := 'passou'; r.obtido := 'Recusado pelo banco, como deveria.';
    ELSE
      r.situacao := 'falhou';
      r.obtido := 'O banco aceitou CPF invalido (validacao existe so no front).';
    END IF;
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'Quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

SELECT codigo, left(resultado_esperado, 70) AS resultado_esperado_corrigido
FROM public.qa_casos_teste WHERE codigo = 'COLAB-021';
