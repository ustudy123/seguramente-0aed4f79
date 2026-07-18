-- =========================================================
-- QA — camada que a TELA consome
--
-- A tela precisa de três coisas do banco, e nenhuma pode rodar sem ser
-- superadmin (o robô é ferramenta interna):
--
--   1. disparar uma bateria e receber o id dela
--   2. listar as baterias passadas (para o histórico)
--   3. ler os resultados de uma bateria (para o relatório)
--
-- qa_rodar_bateria já existe e já liga o modo de teste sozinha (v3). Aqui
-- só embrulhamos com verificação de superadmin, porque a tela chama via
-- RPC como o usuário logado — e um usuário logado que não seja superadmin
-- NÃO pode disparar o robô.
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- 1) DISPARAR — a tela chama isto ao clicar em "Rodar bateria"
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_disparar_bateria(
  p_modulo text DEFAULT 'estrutura-organizacional/colaboradores'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_exec uuid;
BEGIN
  IF NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas superadmin pode disparar a bateria de testes.';
  END IF;

  -- qa_rodar_bateria liga o modo de teste, roda e desfaz. Registra quem disparou.
  v_exec := public.qa_rodar_bateria('manual', p_modulo);

  UPDATE public.qa_execucoes
  SET disparada_por = (SELECT id FROM public.usuarios_base WHERE auth_user_id = auth.uid() LIMIT 1)
  WHERE id = v_exec;

  RETURN v_exec;
END $$;

REVOKE EXECUTE ON FUNCTION public.qa_disparar_bateria(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.qa_disparar_bateria(text) TO authenticated;

COMMENT ON FUNCTION public.qa_disparar_bateria(text) IS
  'Ponto de entrada da tela. Verifica superadmin, roda a bateria (que ja se isola sozinha) e devolve o id para a tela buscar o relatorio.';

-- ─────────────────────────────────────────────────────────
-- 2) HISTÓRICO — lista das últimas baterias
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_listar_baterias(p_limite int DEFAULT 20)
RETURNS TABLE(
  id uuid, iniciada_em timestamptz, disparo text, modulo_path text,
  total int, passou int, falhou int, nao_implementado int, erro int,
  duracao_ms int, observacao text, disparada_por_nome text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.iniciada_em, e.disparo::text, e.modulo_path,
         e.total, e.passou, e.falhou, e.nao_implementado, e.erro,
         e.duracao_ms, e.observacao, u.nome_completo
  FROM public.qa_execucoes e
  LEFT JOIN public.usuarios_base u ON u.id = e.disparada_por
  WHERE public.is_superadmin(auth.uid())
  ORDER BY e.iniciada_em DESC
  LIMIT p_limite;
$$;

REVOKE EXECUTE ON FUNCTION public.qa_listar_baterias(int) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.qa_listar_baterias(int) TO authenticated;

-- ─────────────────────────────────────────────────────────
-- 3) RELATÓRIO — os resultados de uma bateria
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_resultados_da_bateria(p_execucao_id uuid)
RETURNS TABLE(
  codigo text, situacao text, passo_ordem int, passo_acao text,
  esperado text, obtido text, erro_tecnico text, duracao_ms int
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.codigo, r.situacao::text, r.passo_ordem, r.passo_acao,
         r.esperado, r.obtido, r.erro_tecnico, r.duracao_ms
  FROM public.qa_resultados r
  WHERE r.execucao_id = p_execucao_id
    AND public.is_superadmin(auth.uid())
  ORDER BY
    CASE r.situacao WHEN 'falhou' THEN 0 WHEN 'erro' THEN 1
                    WHEN 'passou' THEN 2 ELSE 3 END,
    r.codigo;
$$;

REVOKE EXECUTE ON FUNCTION public.qa_resultados_da_bateria(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.qa_resultados_da_bateria(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────
-- 4) MÓDULOS TESTÁVEIS — para o seletor da tela
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_modulos_testaveis()
RETURNS TABLE(modulo_path text, label text, casos_executaveis bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.path, m.label, count(*)
  FROM public.qa_casos_teste c
  JOIN public.qa_modulos m ON m.id = c.modulo_id
  JOIN public.qa_implementacoes i ON i.codigo = c.codigo AND i.ativo
  WHERE c.status = 'aprovado'
    AND public.is_superadmin(auth.uid())
  GROUP BY m.path, m.label
  ORDER BY m.path;
$$;

REVOKE EXECUTE ON FUNCTION public.qa_modulos_testaveis() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.qa_modulos_testaveis() TO authenticated;

-- ─────────────────────────────────────────────────────────
-- Conferência
-- ─────────────────────────────────────────────────────────
SELECT 'qa_disparar_bateria'     AS funcao, to_regprocedure('public.qa_disparar_bateria(text)')::text AS existe
UNION ALL SELECT 'qa_listar_baterias',      to_regprocedure('public.qa_listar_baterias(int)')::text
UNION ALL SELECT 'qa_resultados_da_bateria',to_regprocedure('public.qa_resultados_da_bateria(uuid)')::text
UNION ALL SELECT 'qa_modulos_testaveis',    to_regprocedure('public.qa_modulos_testaveis()')::text;
