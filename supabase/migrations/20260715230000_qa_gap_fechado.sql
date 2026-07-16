-- =========================================================
-- QA — Colaboradores: o gap estrutural FECHOU (15/07/2026)
--
-- Os casos COLAB-025 e COLAB-027 descreviam um gap aberto ("nada impede a
-- duplicata"). Isso deixou de ser verdade. Aplicado na base em 15/07/2026:
--
--   1) 133 vínculos duplicados revogados (status = 'revogado', com
--      observação identificando a causa). Os 3 pares de papel duplo do
--      COLAB-029 foram preservados — a partição por tipo_vinculo funcionou.
--
--   2) CREATE UNIQUE INDEX usuario_vinculos_vigente_uidx
--        ON public.usuario_vinculos(empresa_id, usuario_id, tipo_vinculo)
--        WHERE status IN ('ativo','pendente','suspenso');
--
--      Verificado de fora da transação: to_regclass retorna o índice,
--      133 revogadas, 3 papéis duplos intactos.
--
-- Efeito colateral que vale registrar: o ON CONFLICT DO NOTHING da trigger
-- auto_vincular_admins_nova_empresa era no-op desde maio (não havia índice
-- para conflitar). A partir de agora ele funciona sozinho, como o autor
-- pretendia. Nenhuma linha de código mudou — o índice deu sentido a ela.
--
-- Esta migration não altera a base; só sincroniza a documentação com o que
-- a base virou. Documentação que descreve um gap fechado é a mesma classe
-- de erro que a hipótese do CPF: afirmação que sobrevive porque ninguém
-- mediu de novo.
-- =========================================================

DO $seed$
BEGIN
  IF to_regclass('public.qa_casos_teste') IS NULL THEN
    RAISE EXCEPTION 'qa_casos_teste não existe — rode as migrations do QA primeiro.';
  END IF;

  -- COLAB-025 / COLAB-027: de gap aberto para regra garantida.
  UPDATE public.qa_casos_teste
  SET observacoes = 'GAP FECHADO EM 15/07/2026. O índice usuario_vinculos_vigente_uidx (empresa_id, usuario_id, tipo_vinculo) WHERE status IN (ativo, pendente, suspenso) existe na base. Antes disso: 136 pares duplicados, 133 revogados na limpeza, 3 preservados por serem papel duplo legítimo (COLAB-029). Histórico da chave, porque o caminho importa: v1 propunha (empresa, pessoa) WHERE status = ativo — errada na chave E no predicado; v2 corrigiu o predicado para vigente depois que a regra de suspensão foi confirmada; v3 acrescentou tipo_vinculo depois que a varredura mostrou papel duplo real na base. Nenhuma das três foi descoberta lendo o caso — todas vieram de medir. Este caso agora TESTA uma regra garantida por índice, não denuncia um buraco.',
      tipo = 'negativo'
  WHERE codigo IN ('COLAB-025','COLAB-027');

  -- COLAB-037: o duplo clique mudou de sintoma, não sumiu.
  UPDATE public.qa_casos_teste
  SET observacoes = 'ATUALIZADO 15/07/2026 — o índice único mudou o sintoma, não resolveu o caso. Antes: duplo clique criava dois vínculos em silêncio. Agora: o segundo INSERT bate no índice e o usuário leva um erro de constraint na cara, em inglês, vindo do Postgres. Melhor que duplicar, longe de aceitável. O caso continua aberto e a correção continua sendo na tela: desabilitar o botão na primeira submissão E tratar a unique violation com mensagem em português. O índice é a rede de segurança, não a UX.',
      prioridade = 'alta'
  WHERE codigo = 'COLAB-037';

  -- COLAB-029: de achado da varredura para caso protegido.
  UPDATE public.qa_casos_teste
  SET observacoes = 'PROTEGIDO POR ÍNDICE desde 15/07/2026. Os 3 pares reais de papel duplo (administrador + colaborador na mesma empresa) sobreviveram à limpeza dos 133 e ao CREATE UNIQUE INDEX, verificado de fora da transação. Este caso é a razão de tipo_vinculo estar na chave: sem ele, a limpeza teria revogado 136 em vez de 133 e o dono da conta teria perdido o vínculo de colaborador — em silêncio, porque o ON CONFLICT DO NOTHING da trigger não levanta erro.'
  WHERE codigo = 'COLAB-029';

  RAISE NOTICE 'Documentação sincronizada: o gap do COLAB-025/027 está fechado.';
END $seed$;
