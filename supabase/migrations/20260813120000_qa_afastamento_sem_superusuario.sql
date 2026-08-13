-- =====================================================================
-- QA · AFAST-001 e 003 sem depender de superusuário
--
-- As rotinas escritas em 20260813110000 montavam o cenário de "registro
-- legado" desligando os gatilhos com session_replication_role. Isso
-- funciona numa réplica local, onde se roda como superusuário — e falha
-- no Supabase, onde o usuário `postgres` NÃO é superusuário:
--
--   permission denied to set parameter "session_replication_role"
--
-- Defeito da rotina de teste, não da correção: o encerramento automático
-- em si está aplicado e funcionando.
--
-- O cenário legado passa a ser montado por um caminho legítimo, que
-- qualquer usuário consegue: nasce como prazo indeterminado (o sistema
-- aceita sem data de fim) e depois a marcação é retirada. A guarda não
-- reage, porque ela só impede APAGAR uma data de término que existia —
-- e aqui nunca existiu. O resultado é exatamente o registro antigo que
-- queremos testar.
--
-- AFAST-001 também muda de alvo, por um motivo real: com o gatilho no
-- ar, afastamento vencido não consegue mais NASCER ativo. Testar "a
-- rotina diária encerra o vencido" virou impossível de montar sem
-- desligar o próprio gatilho. O que importa — e continua verificável — é
-- a invariante: afastamento vencido não permanece ativo, seja pelo
-- gatilho ou pela rotina; e rodar a rotina duas vezes não muda nada.
-- =====================================================================

SET lock_timeout = '10s';

-- Helper: registro legado (ativo, sem data de fim, sem prazo indeterminado),
-- montado sem privilégio nenhum.
CREATE OR REPLACE FUNCTION public.qa_afast_legado(p_nome text, p_inicio date)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE v_id uuid;
BEGIN
  -- Nasce legítimo: prazo indeterminado pode existir sem data de término.
  v_id := public.qa_afast_novo(p_nome, p_inicio, NULL, true);

  -- Retira a marcação. A guarda de UPDATE só reage quando havia uma data
  -- de término e alguém tenta apagá-la; aqui nunca houve.
  UPDATE public.afastamentos
     SET prazo_indeterminado = false,
         status_geral_new    = 'registrado'
   WHERE id = v_id;

  RETURN v_id;
END $$;

COMMENT ON FUNCTION public.qa_afast_legado(text, date) IS
  'Monta, sem superusuário, o registro que existia antes da correção de 13/08: ativo, sem data de término e sem prazo indeterminado.';

-- ─────────────────────────────────────────────────────────────────────
-- AFAST-001 — afastamento vencido não permanece ativo
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_caso_afast_001()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE
  r public.qa_retorno;
  v_id uuid;
  v_st text;
  v_n  int;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'Registrar afastamento cujo período de término já passou';
  r.esperado    := 'Não permanece ativo — encerra pelo gatilho ou pela rotina';

  v_id := public.qa_afast_legado('QA Vencido', CURRENT_DATE - 40);
  UPDATE public.afastamentos SET data_fim = CURRENT_DATE - 10 WHERE id = v_id;

  SELECT public.afastamento_encerrar_vencidos() INTO v_n;
  SELECT status::text INTO v_st FROM public.afastamentos WHERE id = v_id;

  IF v_st <> 'encerrado' THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: afastamento com término em %s continua como "%s". Enquanto '
             || 'contar como ativo, ele infla a régua dos 15 dias e o absenteísmo, e mantém o '
             || 'colaborador impedido de bater ponto — o RH só sai disso apagando o registro.',
             to_char(CURRENT_DATE - 10, 'DD/MM/YYYY'), v_st);
    RETURN r;
  END IF;

  r.passo_ordem := 2;
  r.passo_acao  := 'Rodar a rotina de encerramento de novo';
  r.esperado    := 'Nada muda — ela roda todo dia e precisa ser inócua quando não há o que fazer';
  SELECT public.afastamento_encerrar_vencidos() INTO v_n;

  IF v_n <> 0 THEN
    r.situacao := 'falhou';
    r.obtido := format('A rotina não é idempotente: na segunda execução ainda encerrou %s '
                    || 'registro(s).', v_n);
    RETURN r;
  END IF;

  r.situacao := 'passou';
  r.obtido := 'Vencido não fica ativo, e rodar a rotina de novo não mexe em nada.';
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- AFAST-003 — preencher a data de término encerra na hora
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_caso_afast_003()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE
  r public.qa_retorno;
  v_id uuid;
  v_st text;
  v_fim date;
  v_existe boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'Informar a data de término de um afastamento legado já vencido';
  r.esperado    := 'Encerra na hora, sem esperar a rotina da madrugada';

  v_id := public.qa_afast_legado('QA Legado', CURRENT_DATE - 60);

  -- Confere que o cenário é mesmo o legado: ativo e sem data de término.
  SELECT status::text, data_fim INTO v_st, v_fim
    FROM public.afastamentos WHERE id = v_id;
  IF v_st <> 'ativo' OR v_fim IS NOT NULL THEN
    r.situacao := 'erro';
    r.obtido := format('Não foi possível montar o cenário legado (situação %s, término %s).',
                       v_st, coalesce(v_fim::text, 'nenhum'));
    RETURN r;
  END IF;

  UPDATE public.afastamentos SET data_fim = CURRENT_DATE - 50 WHERE id = v_id;
  SELECT status::text INTO v_st FROM public.afastamentos WHERE id = v_id;

  IF v_st <> 'encerrado' THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: informar a data de término deixou o registro como "%s". Sem '
             || 'encerramento imediato, o RH continua sem caminho de saída a não ser apagar o '
             || 'afastamento — que é justamente o que estamos tentando evitar.', v_st);
    RETURN r;
  END IF;

  r.passo_ordem := 2;
  r.passo_acao  := 'Conferir que o registro continua existindo';
  r.esperado    := 'Histórico preservado, nada apagado';
  SELECT EXISTS (SELECT 1 FROM public.afastamentos WHERE id = v_id) INTO v_existe;

  IF NOT v_existe THEN
    r.situacao := 'falhou';
    r.obtido := 'O encerramento apagou o registro. Afastamento é histórico de saúde '
             || 'ocupacional: encerra, não some.';
    RETURN r;
  END IF;

  r.situacao := 'passou';
  r.obtido := 'Ao informar a data de término o afastamento encerrou na hora, e o registro '
           || 'continua na base para consulta e para o eSocial.';
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;
