-- =====================================================================
-- Dia sem marcação não existe — e por isso a ausência não desconta
--
-- Caso relatado (Edina, CLINICA MEDICA AMBULATORIAL, 13/07/2026): a
-- colaboradora faltou numa segunda-feira. Na edição do Banco de Horas a
-- lista pula de 12/07 (domingo) para 14/07 (terça): o dia 13 não aparece,
-- e nada é descontado. No Espelho daquele dia, "Nenhum registro
-- encontrado" — para a empresa inteira.
--
-- Causa: a apuração percorre as linhas de ponto_diario da competência.
-- Quem cria a linha de um dia SEM marcação é consolidar_ponto_dia_todos,
-- descrita na própria migration que a criou como "materializa faltas".
-- Só que ela nunca é chamada sozinha: no produto inteiro, apenas dois
-- botões da tela de Feriados a acionam. Não há rotina diária.
--
-- Resultado: o dia sem batida simplesmente não passa a existir. Não é que
-- a falta seja calculada e ignorada — ela nunca chega a ser vista.
--
-- Os sábados e domingos aparecem na lista porque alguma reconsolidação
-- manual passou por eles em algum momento; foi por isso que o buraco ficou
-- difícil de notar.
--
-- Correção em duas partes:
--   1. rotina diária que materializa o dia anterior, para o problema
--      parar de crescer;
--   2. função de recuperação por período, para o passado — NÃO executada
--      automaticamente: materializar falta retroativa gera débito onde hoje
--      não há, e isso é decisão de quem opera a folha, não da migration.
-- =====================================================================

-- 1) MATERIALIZAÇÃO POR PERÍODO ---------------------------------------
-- Um dia por vez, por tenant. Datas futuras são ignoradas: não existe
-- falta em dia que ainda não aconteceu.
CREATE OR REPLACE FUNCTION public.ponto_materializar_faltas(
  p_ini date,
  p_fim date DEFAULT NULL,
  p_tenant_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_fim date := LEAST(COALESCE(p_fim, p_ini), CURRENT_DATE - 1);
  v_dia date;
  r RECORD;
  v_n int;
  v_total int := 0;
  v_dias int := 0;
BEGIN
  IF p_ini > v_fim THEN
    RETURN jsonb_build_object('success', true, 'dias', 0, 'consolidacoes', 0,
                              'observacao', 'período vazio ou no futuro');
  END IF;

  v_dia := p_ini;
  WHILE v_dia <= v_fim LOOP
    FOR r IN
      SELECT DISTINCT a.tenant_id
      FROM public.admissoes a
      WHERE a.tenant_id IS NOT NULL
        AND (p_tenant_id IS NULL OR a.tenant_id = p_tenant_id)
        AND COALESCE(a.inativo, false) = false
        AND COALESCE(a.bate_ponto, true) = true
        AND a.data_admissao <= v_dia
    LOOP
      BEGIN
        v_n := public.consolidar_ponto_dia_todos(r.tenant_id, v_dia);
        v_total := v_total + COALESCE(v_n, 0);
      EXCEPTION WHEN OTHERS THEN
        -- Um tenant com cadastro quebrado não pode impedir os demais.
        RAISE NOTICE 'falha em % / %: %', r.tenant_id, v_dia, SQLERRM;
      END;
    END LOOP;

    v_dias := v_dias + 1;
    v_dia := v_dia + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'dias', v_dias, 'consolidacoes', v_total);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ponto_materializar_faltas(date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ponto_materializar_faltas(date, date, uuid) TO authenticated, service_role;

-- 2) DIAGNÓSTICO — quais dias estão faltando -------------------------
-- Compara os dias úteis já vividos da competência com os que existem em
-- ponto_diario para cada colaborador. Mostra o tamanho do buraco ANTES de
-- decidir materializar.
CREATE OR REPLACE FUNCTION public.ponto_dias_nao_materializados(
  p_tenant_id uuid,
  p_competencia text
)
RETURNS TABLE(
  colaborador_cpf text,
  colaborador_nome text,
  dias_sem_linha integer,
  primeiro date,
  ultimo date
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH periodo AS (
    SELECT to_date(p_competencia || '-01', 'YYYY-MM-DD') AS ini,
           LEAST((to_date(p_competencia || '-01', 'YYYY-MM-DD')
                  + interval '1 month - 1 day')::date, CURRENT_DATE - 1) AS fim
  ),
  dias AS (
    SELECT g::date AS d FROM periodo p, generate_series(p.ini, p.fim, interval '1 day') g
    WHERE EXTRACT(ISODOW FROM g) BETWEEN 1 AND 5
  ),
  pessoas AS (
    SELECT DISTINCT regexp_replace(a.cpf, '[^0-9]', '', 'g') AS cpf,
           max(a.nome_completo) AS nome,
           min(a.data_admissao) AS admissao
    FROM public.admissoes a
    WHERE a.tenant_id = p_tenant_id
      AND COALESCE(a.inativo, false) = false
      AND COALESCE(a.bate_ponto, true) = true
      AND a.cpf IS NOT NULL
    GROUP BY 1
  )
  SELECT p.cpf, p.nome, count(*)::int, min(d.d), max(d.d)
  FROM pessoas p
  CROSS JOIN dias d
  WHERE d.d >= COALESCE(p.admissao, d.d)
    AND NOT EXISTS (
      SELECT 1 FROM public.ponto_diario pd
      WHERE pd.tenant_id = p_tenant_id
        AND regexp_replace(pd.colaborador_cpf, '[^0-9]', '', 'g') = p.cpf
        AND pd.data = d.d
    )
  GROUP BY p.cpf, p.nome
  HAVING count(*) > 0
  ORDER BY count(*) DESC, p.nome;
$$;

REVOKE EXECUTE ON FUNCTION public.ponto_dias_nao_materializados(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ponto_dias_nao_materializados(uuid, text) TO authenticated;

-- 3) ROTINA DIÁRIA -----------------------------------------------------
-- Materializa o dia anterior, para o buraco parar de crescer. Roda de
-- madrugada, depois de encerrado o expediente e das batidas atrasadas.
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('ponto-materializar-faltas')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ponto-materializar-faltas');
    PERFORM cron.schedule('ponto-materializar-faltas', '23 5 * * *',
      'SELECT public.ponto_materializar_faltas(CURRENT_DATE - 1);');
    RAISE NOTICE 'Rotina diária de materialização de faltas agendada (05:23 UTC).';
  ELSE
    RAISE NOTICE 'pg_cron ausente — chame ponto_materializar_faltas(CURRENT_DATE - 1) pela aplicação.';
  END IF;
END $cron$;

COMMENT ON FUNCTION public.ponto_materializar_faltas(date, date, uuid) IS
  'Cria a linha de ponto_diario dos dias sem marcação, para que a ausência seja vista pela apuração. Datas futuras são ignoradas.';
COMMENT ON FUNCTION public.ponto_dias_nao_materializados(uuid, text) IS
  'Dias úteis já vividos da competência que não têm linha em ponto_diario, por colaborador. Use antes de materializar o passado.';
