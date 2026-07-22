-- =========================================================
-- PSICOSSOCIAL: respondentes por GHE (sem expor CPF)
--
-- CONTEXTO: o questionário é respondido anonimamente por link público único
-- da campanha. A resposta NÃO grava ghe_id_snapshot (fica nulo em 100% das
-- respostas), então o relatório não sabia de qual GHE cada resposta veio e
-- jogava cada uma em TODOS os GHE da campanha — o "responderam 32 de 32"
-- repetido em todos.
--
-- MAS a resposta grava cpf_hash = SHA-256(cpf_limpo || '::' || campanha_id)
-- (gerado no front em VerificacaoCPF.tsx). Como o CPF está ligado à admissão
-- (cargo + departamento), dá para reconstruir o GHE de cada resposta pelo
-- hash — sabendo quantos da função X responderam, sem saber QUEM.
--
-- Por que no servidor (LGPD): o cruzamento precisa dos CPFs das admissões.
-- Fazer isso no cliente traria CPFs em texto para o navegador, o oposto do
-- que o cpf_hash protege. Aqui os CPFs nunca saem do banco: a função calcula
-- os hashes internamente e devolve SÓ a contagem por GHE.
--
-- O hash inclui o campanha_id, então o mesmo CPF gera hashes diferentes por
-- campanha — não dá para rastrear a pessoa entre campanhas, e esta função só
-- casa dentro da mesma campanha.
-- =========================================================

CREATE OR REPLACE FUNCTION public.contar_respondentes_por_ghe(p_campanha_ids uuid[])
RETURNS TABLE (
  ghe_id           uuid,
  ghe_nome         text,
  respondentes     bigint,
  sem_ghe          bigint  -- respostas cujo CPF não casou nenhum GHE (diagnóstico)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid;
BEGIN
  IF p_campanha_ids IS NULL OR array_length(p_campanha_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Segurança: só o tenant dono das campanhas pode contar.
  SELECT DISTINCT c.tenant_id INTO v_tenant
  FROM public.questionario_psicossocial_campanhas c
  WHERE c.id = ANY(p_campanha_ids)
  LIMIT 1;

  IF v_tenant IS NULL OR v_tenant <> public.get_user_tenant_id() THEN
    RAISE EXCEPTION 'Sem permissão para estas campanhas.';
  END IF;

  RETURN QUERY
  WITH
  -- Empresas envolvidas nas campanhas do relatório
  camp AS (
    SELECT c.id AS campanha_id, c.empresa_id, c.tenant_id
    FROM public.questionario_psicossocial_campanhas c
    WHERE c.id = ANY(p_campanha_ids)
  ),
  -- Admissões ativas das empresas dessas campanhas, com o hash reproduzido
  -- por campanha: SHA-256(cpf_numérico || '::' || campanha_id)
  adm AS (
    SELECT
      cm.campanha_id,
      encode(
        digest(
          convert_to(regexp_replace(a.cpf, '[^0-9]', '', 'g') || '::' || cm.campanha_id::text, 'UTF8'),
          'sha256'
        ),
        'hex'
      ) AS cpf_hash,
      lower(trim(a.cargo))        AS cargo,
      lower(trim(a.departamento)) AS depto
    FROM public.admissoes a
    JOIN camp cm
      ON cm.tenant_id = a.tenant_id
     AND (cm.empresa_id IS NULL OR cm.empresa_id = a.empresa_id)
    WHERE a.cpf IS NOT NULL AND a.cpf <> ''
      AND (a.status IS NULL OR lower(a.status) NOT IN ('desligado','demitido','inativo'))
  ),
  -- Pares (cargo|depto) de cada GHE, por nome
  ghe_pares AS (
    SELECT
      gc.ghe_id,
      lower(trim(c.nome))                              AS cargo,
      COALESCE(lower(trim(d.nome)), '')                AS depto
    FROM public.psicossocial_ghe_cargos gc
    JOIN public.cargos c        ON c.id = gc.cargo_id
    LEFT JOIN public.departamentos d ON d.id = gc.departamento_id
  ),
  -- Cada resposta -> admissão (pelo hash) -> GHE (pelo cargo|depto)
  resp AS (
    SELECT r.id AS resposta_id, r.campanha_id, r.cpf_hash
    FROM public.questionario_psicossocial_respostas r
    WHERE r.campanha_id = ANY(p_campanha_ids)
      AND r.cpf_hash IS NOT NULL AND r.cpf_hash <> ''
  ),
  resp_ghe AS (
    SELECT
      r.resposta_id,
      gp.ghe_id
    FROM resp r
    JOIN adm a
      ON a.campanha_id = r.campanha_id
     AND a.cpf_hash    = r.cpf_hash
    LEFT JOIN ghe_pares gp
      ON gp.cargo = a.cargo
     AND (gp.depto = a.depto OR gp.depto = '')
  ),
  -- Uma resposta pode, em tese, casar mais de um GHE se a composição se
  -- sobrepõe; contamos a resposta uma vez por GHE distinto que ela casa.
  distintos AS (
    SELECT DISTINCT resposta_id, ghe_id FROM resp_ghe WHERE ghe_id IS NOT NULL
  )
  SELECT
    g.id,
    g.nome,
    (SELECT count(*) FROM distintos d WHERE d.ghe_id = g.id)                AS respondentes,
    (SELECT count(*) FROM resp_ghe rg WHERE rg.ghe_id IS NULL)             AS sem_ghe
  FROM public.psicossocial_ghe g
  WHERE g.id IN (SELECT ghe_id FROM ghe_pares)
  ORDER BY g.codigo NULLS LAST, g.nome;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.contar_respondentes_por_ghe(uuid[]) TO authenticated;

-- ---------------------------------------------------------
-- Verificação
-- ---------------------------------------------------------
DO $verifica$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'contar_respondentes_por_ghe'
  ) THEN
    RAISE EXCEPTION 'FALHOU: função não foi criada.';
  END IF;
  RAISE NOTICE 'OK: contar_respondentes_por_ghe criada. Respondentes por GHE via cpf_hash, sem expor CPF.';
END $verifica$;
