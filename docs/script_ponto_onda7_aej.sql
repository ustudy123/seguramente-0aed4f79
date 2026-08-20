-- ============================================================================
-- ENTREGA — ONDA 7 (parte 2): AEJ — Arquivo Eletronico de Jornada (Portaria 671)
-- Alvos: ponto_arquivos_aej (nova) + ponto_gerar_aej, ponto_aej_extrair (novas)
-- PONTO-211
--
-- O AEJ e a saida OBRIGATORIA do "programa de tratamento" na Portaria 671 (ele
-- substituiu o AFDT/ACJEF da 1510/2009) e a peca que a fiscalizacao pede junto
-- com o AFD. Hoje nao existe em lugar nenhum do banco. Passa a existir a tabela
-- do arquivo arquivado, o gerador (a partir da apuracao fechada + contrato +
-- marcacoes TRATADAS, em registros tipados, assinado por hash) e a extracao para
-- download/fiscalizacao.
--
-- GARANTIAS: nao altera o motor de saldo, o espelho, o fechamento nem as
-- marcacoes. So LE a apuracao e grava o arquivo. Aditivo e idempotente. Roda
-- inteiro em UMA transacao.
-- ============================================================================

SET lock_timeout = '10s';
-- (1) Arquivo arquivado -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ponto_arquivos_aej (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL,
  empresa_id          uuid,
  competencia         text NOT NULL,
  periodo_ini         date,
  periodo_fim         date,
  empregador_cnpj     text,
  empregador_nome     text,
  total_trabalhadores integer NOT NULL DEFAULT 0,
  total_marcacoes     integer NOT NULL DEFAULT 0,
  total_registros     integer NOT NULL DEFAULT 0,
  conteudo            text,
  conteudo_estruturado jsonb,
  hash_arquivo        text,
  arquivo_url         text,
  gerado_em           timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ponto_arquivos_aej_comp
  ON public.ponto_arquivos_aej (tenant_id, empresa_id, competencia);

COMMENT ON TABLE public.ponto_arquivos_aej IS
  'Arquivo Eletronico de Jornada (AEJ) gerado pelo programa de tratamento (Portaria MTP 671/2021): jornada tratada (contrato + marcacoes tratadas + apuracao) da competencia, arquivada, assinada por hash e vinculada ao empregador. Saida obrigatoria junto com o AFD.';

ALTER TABLE public.ponto_arquivos_aej ENABLE ROW LEVEL SECURITY;

DO $rls$
BEGIN
  IF to_regprocedure('public.get_user_tenant_id()') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_policies
       WHERE schemaname='public' AND tablename='ponto_arquivos_aej'
         AND policyname='ponto_arquivos_aej_tenant') THEN
    CREATE POLICY ponto_arquivos_aej_tenant
      ON public.ponto_arquivos_aej
      FOR ALL
      USING (tenant_id = public.get_user_tenant_id())
      WITH CHECK (tenant_id = public.get_user_tenant_id());
  END IF;
END $rls$;

-- Trava do cercado do QA (isolamento de tenant) — PONTO-270.
DO $cerca$
BEGIN
  IF to_regprocedure('public.qa_bloqueia_fora_do_cercado()') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_trigger
       WHERE tgname = 'qa_guarda_cercado'
         AND tgrelid = 'public.ponto_arquivos_aej'::regclass
         AND NOT tgisinternal) THEN
    CREATE TRIGGER qa_guarda_cercado
      BEFORE INSERT OR UPDATE OR DELETE ON public.ponto_arquivos_aej
      FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_fora_do_cercado();
  END IF;
END $cerca$;

INSERT INTO public.qa_tabelas_protegidas (tabela, motivo)
SELECT 'ponto_arquivos_aej', 'Cerca generica: tabela tem tenant_id'
WHERE to_regclass('public.qa_tabelas_protegidas') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.qa_tabelas_protegidas x
                  WHERE x.tabela = 'ponto_arquivos_aej');

-- (2) Gerador do AEJ ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ponto_gerar_aej(
  p_tenant_id   uuid,
  p_empresa_id  uuid,
  p_competencia text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ini date := to_date(p_competencia || '-01', 'YYYY-MM-DD');
  v_fim date := (to_date(p_competencia || '-01', 'YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date;
  v_emp    RECORD;
  v_tipoid text;
  w        RECORD;
  mrec     RECORD;
  v_linhas text[] := ARRAY[]::text[];
  v_estr   jsonb  := '[]'::jsonb;
  v_marc   jsonb;
  v_n2 int := 0;   -- registros tipo 2 (contratos/trabalhadores)
  v_n3 int := 0;   -- registros tipo 3 (marcacoes tratadas)
  v_n4 int := 0;   -- registros tipo 4 (apuracoes)
  v_total int;
  v_conteudo text;
  v_hash text;
  v_id uuid;
BEGIN
  -- Empregador (cabeçalho, tipo 1). Identificador: 1=CNPJ; senão CEI/CAEPF.
  SELECT ec.razao_social, ec.cnpj, ec.cei, ec.caepf INTO v_emp
  FROM public.empresa_cadastro ec WHERE ec.id = p_empresa_id;

  v_tipoid := CASE
    WHEN v_emp.cnpj IS NOT NULL AND btrim(v_emp.cnpj) <> '' THEN '1'
    WHEN COALESCE(v_emp.caepf, '') <> '' THEN '3'
    WHEN COALESCE(v_emp.cei, '')   <> '' THEN '4'
    ELSE '9'
  END;

  v_linhas := array_append(v_linhas, format('1|%s|%s|%s|%s|%s|%s',
    v_tipoid,
    COALESCE(v_emp.cnpj, ''),
    COALESCE(NULLIF(v_emp.caepf,''), NULLIF(v_emp.cei,''), ''),
    COALESCE(v_emp.razao_social, ''),
    to_char(v_ini, 'YYYY-MM-DD'), to_char(v_fim, 'YYYY-MM-DD')));

  -- Trabalhadores com jornada no período: UNIAO da apuracao (espelhos) com as
  -- marcacoes tratadas do periodo. Contrato vem de admissoes (por CPF/empresa).
  FOR w IN
    WITH cpfs AS (
      SELECT DISTINCT regexp_replace(COALESCE(colaborador_cpf,''),'[^0-9]','','g') AS cpf_num,
             colaborador_cpf AS cpf_orig, colaborador_nome
      FROM public.ponto_espelhos
      WHERE tenant_id = p_tenant_id AND competencia = p_competencia
        AND (p_empresa_id IS NULL OR empresa_id = p_empresa_id)
      UNION
      SELECT DISTINCT regexp_replace(COALESCE(colaborador_cpf,''),'[^0-9]','','g'),
             colaborador_cpf, colaborador_nome
      FROM public.ponto_marcacoes
      WHERE tenant_id = p_tenant_id
        AND (p_empresa_id IS NULL OR empresa_id = p_empresa_id)
        AND data_marcacao BETWEEN v_ini AND v_fim
        AND COALESCE(desconsiderada, false) = false
    )
    SELECT cpf_num,
           max(cpf_orig)      AS cpf_orig,
           max(colaborador_nome) AS nome
    FROM cpfs
    WHERE cpf_num <> ''
    GROUP BY cpf_num
    ORDER BY 1
  LOOP
    -- Contrato (tipo 2): admissoes por CPF (+ empresa quando informada).
    DECLARE
      v_adm RECORD;
      v_esp RECORD;
    BEGIN
      SELECT a.nome_completo, a.data_admissao, a.jornada_trabalho INTO v_adm
      FROM public.admissoes a
      WHERE regexp_replace(COALESCE(a.cpf,''),'[^0-9]','','g') = w.cpf_num
        AND (p_empresa_id IS NULL OR a.empresa_id = p_empresa_id)
      ORDER BY a.data_admissao DESC NULLS LAST
      LIMIT 1;

      v_linhas := array_append(v_linhas, format('2|%s|%s|%s|%s',
        w.cpf_orig,
        COALESCE(v_adm.nome_completo, w.nome, ''),
        COALESCE(to_char(v_adm.data_admissao, 'YYYY-MM-DD'), ''),
        COALESCE(v_adm.jornada_trabalho, '')));
      v_n2 := v_n2 + 1;

      -- Marcacoes tratadas (tipo 3): originais, nao desconsideradas, ordenadas.
      v_marc := '[]'::jsonb;
      FOR mrec IN
        SELECT m.data_marcacao, m.hora_marcacao, m.tipo_marcacao,
               COALESCE(m.origem_marcacao, 'O') AS origem, m.nsr
        FROM public.ponto_marcacoes m
        WHERE m.tenant_id = p_tenant_id
          AND regexp_replace(COALESCE(m.colaborador_cpf,''),'[^0-9]','','g') = w.cpf_num
          AND (p_empresa_id IS NULL OR m.empresa_id = p_empresa_id)
          AND m.data_marcacao BETWEEN v_ini AND v_fim
          AND COALESCE(m.desconsiderada, false) = false
        ORDER BY m.data_marcacao, m.hora_marcacao
      LOOP
        v_linhas := array_append(v_linhas, format('3|%s|%s|%s|%s|%s|%s',
          w.cpf_orig,
          to_char(mrec.data_marcacao, 'YYYY-MM-DD'),
          to_char(mrec.hora_marcacao, 'HH24:MI'),
          COALESCE(mrec.tipo_marcacao, ''),
          mrec.origem,
          COALESCE(mrec.nsr::text, '')));
        v_n3 := v_n3 + 1;
        v_marc := v_marc || jsonb_build_object(
          'data', mrec.data_marcacao, 'hora', to_char(mrec.hora_marcacao,'HH24:MI'),
          'tipo', mrec.tipo_marcacao, 'origem', mrec.origem, 'nsr', mrec.nsr);
      END LOOP;

      -- Apuracao (tipo 4): totais tratados da competencia (ponto_espelhos).
      SELECT total_horas_normais_minutos, total_horas_extras_50_minutos,
             total_horas_extras_100_minutos, total_adicional_noturno_minutos,
             total_faltas, total_atrasos_minutos, total_dsr
        INTO v_esp
      FROM public.ponto_espelhos
      WHERE tenant_id = p_tenant_id AND competencia = p_competencia
        AND regexp_replace(COALESCE(colaborador_cpf,''),'[^0-9]','','g') = w.cpf_num
        AND (p_empresa_id IS NULL OR empresa_id = p_empresa_id)
      LIMIT 1;

      IF FOUND THEN
        v_linhas := array_append(v_linhas, format('4|%s|%s|%s|%s|%s|%s|%s|%s|%s',
          w.cpf_orig, p_competencia,
          COALESCE(v_esp.total_horas_normais_minutos, 0),
          COALESCE(v_esp.total_horas_extras_50_minutos, 0),
          COALESCE(v_esp.total_horas_extras_100_minutos, 0),
          COALESCE(v_esp.total_adicional_noturno_minutos, 0),
          COALESCE(v_esp.total_faltas, 0),
          COALESCE(v_esp.total_atrasos_minutos, 0),
          COALESCE(v_esp.total_dsr::text, '0')));
        v_n4 := v_n4 + 1;
      END IF;

      v_estr := v_estr || jsonb_build_object(
        'cpf', w.cpf_orig,
        'nome', COALESCE(v_adm.nome_completo, w.nome),
        'contrato', jsonb_build_object('data_admissao', v_adm.data_admissao,
                                       'jornada', v_adm.jornada_trabalho),
        'marcacoes_tratadas', v_marc);
    END;
  END LOOP;

  -- Trailer (tipo 9): contagens. total_registros inclui cabeçalho e trailer.
  v_total := array_length(v_linhas, 1) + 1;  -- +1: a própria linha 9
  v_linhas := array_append(v_linhas, format('9|%s|%s|%s|%s', v_n2, v_n3, v_n4, v_total));

  v_conteudo := array_to_string(v_linhas, E'\n');
  v_hash := encode(public.digest(v_conteudo, 'sha256'), 'hex');

  -- Idempotente: refaz o AEJ desta competência/empresa (marcador por match).
  DELETE FROM public.ponto_arquivos_aej
  WHERE tenant_id = p_tenant_id AND competencia = p_competencia
    AND (p_empresa_id IS NULL OR empresa_id = p_empresa_id
         OR (p_empresa_id IS NULL AND empresa_id IS NULL));

  INSERT INTO public.ponto_arquivos_aej (
    tenant_id, empresa_id, competencia, periodo_ini, periodo_fim,
    empregador_cnpj, empregador_nome, total_trabalhadores, total_marcacoes,
    total_registros, conteudo, conteudo_estruturado, hash_arquivo, gerado_em
  ) VALUES (
    p_tenant_id, p_empresa_id, p_competencia, v_ini, v_fim,
    v_emp.cnpj, v_emp.razao_social, v_n2, v_n3,
    v_total, v_conteudo,
    jsonb_build_object(
      'norma', 'Portaria MTP 671/2021 — AEJ (Arquivo Eletronico de Jornada)',
      'empregador', jsonb_build_object('razao_social', v_emp.razao_social,
                                       'cnpj', v_emp.cnpj, 'cei', v_emp.cei, 'caepf', v_emp.caepf),
      'periodo', jsonb_build_object('inicio', v_ini, 'fim', v_fim),
      'trabalhadores', v_estr),
    v_hash, now()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.ponto_gerar_aej(uuid, uuid, text) IS
  'Gera o AEJ (Arquivo Eletronico de Jornada, Portaria 671) da competencia a partir da apuracao fechada (ponto_espelhos) + contrato (admissoes) + marcacoes TRATADAS (ponto_marcacoes nao desconsideradas, com origem e NSR), em registros tipados (1 cabecalho, 2 contrato, 3 marcacao, 4 apuracao, 9 trailer), assinado por hash e arquivado. Idempotente. PONTO-211.';

-- (3) Extração do AEJ arquivado (download/fiscalização) -----------------------
CREATE OR REPLACE FUNCTION public.ponto_aej_extrair(
  p_tenant_id   uuid,
  p_empresa_id  uuid,
  p_competencia text
)
RETURNS TABLE(
  competencia      text,
  periodo_ini      date,
  periodo_fim      date,
  empregador_nome  text,
  total_trabalhadores integer,
  total_marcacoes  integer,
  total_registros  integer,
  conteudo         text,
  hash_arquivo     text,
  gerado_em        timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Devolve o AEJ arquivado da competencia/empresa (o mais recente). Portaria 671.
  SELECT a.competencia, a.periodo_ini, a.periodo_fim, a.empregador_nome,
         a.total_trabalhadores, a.total_marcacoes, a.total_registros,
         a.conteudo, a.hash_arquivo, a.gerado_em
  FROM public.ponto_arquivos_aej a
  WHERE a.tenant_id = p_tenant_id
    AND a.competencia = p_competencia
    AND (p_empresa_id IS NULL OR a.empresa_id = p_empresa_id
         OR (p_empresa_id IS NULL AND a.empresa_id IS NULL))
  ORDER BY a.gerado_em DESC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.ponto_aej_extrair(uuid, uuid, text) IS
  'Devolve o AEJ arquivado (conteudo tratado + assinatura) da competencia/empresa, para download/fiscalizacao. Portaria 671. PONTO-211.';

-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: t | t | t | OK
--   arquivo_aej    : t  (ponto_arquivos_aej existe)
--   gerador_existe : t  (ponto_gerar_aej)
--   extracao_existe: t  (ponto_aej_extrair)
-- ---------------------------------------------------------------------------
SELECT
  (to_regclass('public.ponto_arquivos_aej') IS NOT NULL)                              AS arquivo_aej,
  (to_regprocedure('public.ponto_gerar_aej(uuid,uuid,text)') IS NOT NULL)             AS gerador_existe,
  (to_regprocedure('public.ponto_aej_extrair(uuid,uuid,text)') IS NOT NULL)           AS extracao_existe,
  CASE WHEN to_regclass('public.ponto_arquivos_aej') IS NOT NULL
        AND to_regprocedure('public.ponto_gerar_aej(uuid,uuid,text)') IS NOT NULL
        AND to_regprocedure('public.ponto_aej_extrair(uuid,uuid,text)') IS NOT NULL
       THEN 'OK' ELSE 'CONFERIR' END AS erro_tecnico;
