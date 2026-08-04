-- =====================================================================
-- QA DESL-065 — prazo do exame demissional (NR-07, item 7.5.11)
--
-- A NR-07 exige o exame clínico demissional em até 10 dias contados do
-- término do contrato, salvo dispensa quando o exame ocupacional mais
-- recente estiver dentro do prazo de validade previsto na norma.
--
-- O sistema tem o campo data_exame_demissional, mas nada além disso: sem
-- alerta, sem painel, sem pendência. E não registra a dispensa — então
-- "sem exame porque foi dispensado" e "sem exame porque ninguém fez" ficam
-- indistinguíveis na base, que foi exatamente o que a auditoria encontrou.
--
-- Este prazo é da NR-07 e NÃO se confunde com os 10 dias do art. 477, §6º
-- da CLT (pagamento das verbas): coincidem no número, são normas e
-- penalidades diferentes.
-- =====================================================================

-- 1) REGISTRO DA DISPENSA ---------------------------------------------
ALTER TABLE public.admissoes
  ADD COLUMN IF NOT EXISTS exame_demissional_dispensado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exame_demissional_dispensa_motivo text,
  ADD COLUMN IF NOT EXISTS exame_demissional_dispensa_registrada_em timestamptz,
  ADD COLUMN IF NOT EXISTS exame_demissional_dispensa_registrada_por uuid;

-- Dispensa sem motivo é dispensa sem defesa: em fiscalização, o que sustenta
-- a ausência do exame é a justificativa documentada.
ALTER TABLE public.admissoes
  DROP CONSTRAINT IF EXISTS chk_exame_demissional_dispensa_motivada;
ALTER TABLE public.admissoes
  ADD CONSTRAINT chk_exame_demissional_dispensa_motivada
  CHECK (
    exame_demissional_dispensado = false
    OR COALESCE(btrim(exame_demissional_dispensa_motivo), '') <> ''
  );

CREATE OR REPLACE FUNCTION public.admissao_carimbar_dispensa_exame()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.exame_demissional_dispensado
     AND (TG_OP = 'INSERT' OR NOT COALESCE(OLD.exame_demissional_dispensado, false)) THEN
    NEW.exame_demissional_dispensa_registrada_em  := now();
    NEW.exame_demissional_dispensa_registrada_por := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admissao_dispensa_exame ON public.admissoes;
CREATE TRIGGER trg_admissao_dispensa_exame
  BEFORE INSERT OR UPDATE OF exame_demissional_dispensado ON public.admissoes
  FOR EACH ROW EXECUTE FUNCTION public.admissao_carimbar_dispensa_exame();

-- 2) CONTROLE DO PRAZO -------------------------------------------------
-- Uma linha por desligamento que ainda deve exame, com a situação já
-- classificada. É o que alimenta painel, alerta e conferência do RH.
CREATE OR REPLACE FUNCTION public.exame_demissional_pendencias(
  p_tenant_id uuid,
  p_empresa_id uuid DEFAULT NULL
)
RETURNS TABLE(
  admissao_id uuid,
  colaborador_nome text,
  colaborador_cpf text,
  data_desligamento date,
  data_exame_demissional date,
  prazo_final date,
  dias_restantes int,
  situacao text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    a.id,
    a.nome_completo,
    a.cpf,
    a.data_desligamento,
    a.data_exame_demissional,
    (a.data_desligamento + 10)::date AS prazo_final,
    ((a.data_desligamento + 10)::date - CURRENT_DATE)::int AS dias_restantes,
    CASE
      WHEN a.data_exame_demissional IS NOT NULL
           AND a.data_exame_demissional <= a.data_desligamento + 10 THEN 'em_dia'
      WHEN a.data_exame_demissional IS NOT NULL                     THEN 'realizado_fora_do_prazo'
      WHEN CURRENT_DATE > a.data_desligamento + 10                  THEN 'vencido'
      WHEN CURRENT_DATE >= a.data_desligamento + 7                  THEN 'vence_em_breve'
      ELSE 'no_prazo'
    END AS situacao
  FROM public.admissoes a
  WHERE a.tenant_id = p_tenant_id
    AND (p_empresa_id IS NULL OR a.empresa_id = p_empresa_id)
    AND a.status = 'desligado'
    AND a.data_desligamento IS NOT NULL
    AND COALESCE(a.exame_demissional_dispensado, false) = false
  ORDER BY (a.data_desligamento + 10);
$$;

REVOKE EXECUTE ON FUNCTION public.exame_demissional_pendencias(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.exame_demissional_pendencias(uuid, uuid) TO authenticated;

-- 3) A ROTINA DE QA PASSA A ENXERGAR A DISPENSA ------------------------
-- Sem isto, um desligamento legitimamente dispensado continuaria contando
-- como falha — o próprio chamado aponta que os dois casos precisam deixar
-- de ser indistinguíveis.
CREATE OR REPLACE FUNCTION public.qa_caso_desl_065()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;
