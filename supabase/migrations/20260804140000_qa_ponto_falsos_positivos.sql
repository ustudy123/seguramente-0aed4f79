-- =========================================================
-- QA — Ponto: correção de dois falsos positivos meus (31/07/2026)
--
-- Dois defeitos nas rotinas que escrevi ontem, ambos da mesma família:
-- filtro largo demais produzindo veredito errado. Falso positivo em
-- ferramenta de QA é pior que falso negativo — falha alarma e é
-- investigada; "passou" indevido cala e ninguém volta.
--
-- ── PONTO-253: estava VERDE POR ENGANO ──────────────────
-- A rotina procurava parâmetro de retenção com
--   column_name ILIKE '%retencao%' OR '%expurgo%' OR '%dias_guarda%'
-- em TODO o schema public. Casou com hub_catalogo_documentos.prazo_retencao_anos,
-- que é do Hub Contábil e não tem relação nenhuma com ponto. Resultado: a
-- rotina concluiu que existe política de retenção para dado acessório de
-- marcação, quando não existe.
-- É a terceira vez que busca por substring me trai nesta suíte: antes foi
-- ILIKE '%cipa%' casando com email_prinCIPAl no DESL-073.
-- CORREÇÃO: escopar a busca às tabelas do próprio módulo.
--
-- ── PONTO-251: estava ALARMANDO POR ENGANO ──────────────
-- A rotina tratava token com menos de 32 caracteres como indício de
-- entropia fraca, e acusou 248 de 248. Lendo o código (PontoLinksTab.tsx):
--   crypto.randomUUID().replace(/-/g, "").substring(0, 16)
-- crypto.randomUUID() é CSPRNG. Truncado em 16 hexadecimais, descontado o
-- nibble de versão fixo do UUID v4, restam 60 bits de entropia — cerca de
-- 1,15 x 10^18 combinações. Não é força-brutável por HTTP.
-- Comprimento é péssimo indicador de entropia: 16 hex de CSPRNG são muito
-- mais fortes que 32 caracteres de Math.random(). E entropia NÃO é
-- verificável em SQL — depende de como o valor é gerado, o que só se sabe
-- lendo o código.
-- CORREÇÃO: remover a heurística de comprimento. Fica o que o banco
-- realmente consegue afirmar: colisão de token (que denunciaria gerador
-- fraco) e comprimento absurdamente curto, abaixo de 12, que seria
-- inseguro sob qualquer alfabeto.
-- =========================================================

SET lock_timeout = '10s';

-- ─────────────────────────────────────────────────────────
-- PONTO-251 — sem a heurística de comprimento
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_251()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_nullable boolean; v_sem_prazo int; v_expirado_ativo int;
  v_total int; v_muito_curto int; v_colisoes int; v_achados text := '';
BEGIN
  IF to_regclass('public.ponto_links') IS NULL THEN
    r.situacao := 'nao_implementado';
    r.obtido   := 'Tabela ponto_links não existe nesta base.';
    RETURN r;
  END IF;

  r.passo_ordem := 1;
  r.passo_acao  := 'Conferir se data_expiracao é obrigatória no schema';
  r.esperado    := 'NOT NULL — link sem prazo não pode existir';

  SELECT NOT a.attnotnull INTO v_nullable
  FROM pg_attribute a
  WHERE a.attrelid = 'public.ponto_links'::regclass AND a.attname = 'data_expiracao';

  r.passo_ordem := 2;
  r.passo_acao  := 'AUDITORIA (somente leitura): links ativos sem prazo ou já vencidos';

  SELECT count(*) INTO v_total FROM public.ponto_links;
  SELECT count(*) INTO v_sem_prazo FROM public.ponto_links
   WHERE ativo IS TRUE AND data_expiracao IS NULL;
  SELECT count(*) INTO v_expirado_ativo FROM public.ponto_links
   WHERE ativo IS TRUE AND data_expiracao IS NOT NULL AND data_expiracao < now();

  r.passo_ordem := 3;
  r.passo_acao  := 'Conferir o que o banco consegue afirmar sobre o token';
  -- Entropia depende de COMO o valor é gerado e não é verificável aqui.
  -- O banco só enxerga duas coisas: colisão (denunciaria gerador fraco) e
  -- comprimento absurdo. O limiar de 12 é conservador: abaixo disso o token
  -- é inseguro sob qualquer alfabeto. A verificação do gerador é revisão de
  -- código, registrada no caso e não simulável em SQL.
  SELECT count(*) INTO v_muito_curto FROM public.ponto_links WHERE length(token) < 12;
  SELECT count(*) INTO v_colisoes FROM (
    SELECT token FROM public.ponto_links GROUP BY token HAVING count(*) > 1
  ) x;

  IF COALESCE(v_nullable, false) THEN
    v_achados := v_achados || 'data_expiracao aceita NULO no schema; ';
  END IF;
  IF v_sem_prazo > 0 THEN
    v_achados := v_achados || format('%s link(s) ATIVO(S) sem prazo nenhum; ', v_sem_prazo);
  END IF;
  IF v_expirado_ativo > 0 THEN
    v_achados := v_achados || format('%s ativo(s) com prazo já vencido; ', v_expirado_ativo);
  END IF;
  IF v_muito_curto > 0 THEN
    v_achados := v_achados || format('%s token(s) com menos de 12 caracteres; ', v_muito_curto);
  END IF;
  IF v_colisoes > 0 THEN
    v_achados := v_achados || format('%s token(s) REPETIDO(S) — indício de gerador fraco; ', v_colisoes);
  END IF;

  IF v_achados = '' THEN
    r.situacao := 'passou';
    r.obtido   := format('%s link(s): prazo obrigatório no schema, nenhum ativo sem prazo ou '
               || 'vencido, nenhuma colisão de token.', v_total);
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('De %s link(s): %s Link de marcação é credencial distribuída por '
               || 'mensagem: sem prazo obrigatório vira acesso permanente ao ponto do '
               || 'colaborador. Correção: data_expiracao NOT NULL com prazo padrão curto, e '
               || 'rotina que desative os vencidos em vez de depender de a consulta lembrar '
               || 'de filtrar por data. NOTA SOBRE ENTROPIA: verificada por revisão de código '
               || 'em 31/07/2026 — crypto.randomUUID() truncado em 16 hexadecimais, cerca de '
               || '60 bits. Adequada. Não é achado.', v_total, v_achados);
    r.detalhe  := jsonb_build_object('schema_aceita_sem_prazo', v_nullable,
                                     'ativos_sem_prazo', v_sem_prazo,
                                     'ativos_vencidos', v_expirado_ativo,
                                     'tokens_muito_curtos', v_muito_curto,
                                     'colisoes', v_colisoes);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- ─────────────────────────────────────────────────────────
-- PONTO-253 — busca de retenção escopada ao módulo
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_253()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_tem_config boolean; v_onde text; v_com_geo_antiga int; v_total int; v_tem_hash boolean;
BEGIN
  IF to_regclass('public.ponto_marcacoes') IS NULL THEN
    r.situacao := 'nao_implementado';
    r.obtido   := 'Tabela ponto_marcacoes não existe nesta base.';
    RETURN r;
  END IF;

  r.passo_ordem := 1;
  r.passo_acao  := 'Conferir parâmetro de retenção NAS TABELAS DO MÓDULO';
  r.esperado    := 'Prazo configurável para geolocalização e imagem, no próprio módulo';

  -- Escopado a ponto_ e jornada_ de propósito: a versão anterior varria o
  -- schema inteiro e casou com hub_catalogo_documentos.prazo_retencao_anos,
  -- concluindo por engano que havia política de retenção para ponto.
  SELECT string_agg(table_name || '.' || column_name, ', ' ORDER BY table_name)
    INTO v_onde
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (table_name LIKE 'ponto\_%' OR table_name LIKE 'jornada\_%')
    AND (column_name ILIKE '%retencao%' OR column_name ILIKE '%expurgo%'
         OR column_name ILIKE '%dias\_guarda%' OR column_name ILIKE '%prazo\_%');

  v_tem_config := v_onde IS NOT NULL;

  r.passo_ordem := 2;
  r.passo_acao  := 'AUDITORIA (somente leitura): geolocalização retida há mais de um ano';

  SELECT count(*) INTO v_total FROM public.ponto_marcacoes;
  SELECT count(*) INTO v_com_geo_antiga FROM public.ponto_marcacoes
   WHERE (latitude IS NOT NULL OR longitude IS NOT NULL)
     AND data_marcacao < CURRENT_DATE - 365;

  r.passo_ordem := 3;
  r.passo_acao  := 'Conferir se a marcação tem hash próprio';
  v_tem_hash := public.qa_coluna_existe('ponto_marcacoes','hash_marcacao');

  IF v_tem_config AND v_com_geo_antiga = 0 THEN
    r.situacao := 'passou';
    r.obtido   := format('Parâmetro de retenção no módulo (%s) e nenhuma geolocalização '
               || 'antiga retida entre %s marcação(ões).', v_onde, v_total);
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('Parâmetro de retenção NAS TABELAS DO MÓDULO: %s. Marcações com '
               || 'geolocalização guardada há mais de um ano: %s, de %s no total. A LGPD, '
               || 'art. 16, exige eliminação ao término do tratamento, e a finalidade da '
               || 'geolocalização se esgota bem antes do prazo de guarda da MARCAÇÃO, que '
               || 'tem base própria no art. 74 da CLT. São dois prazos distintos tratados '
               || 'como um só: guarda-se tudo indefinidamente. Correção: prazo configurável '
               || 'para o acessório, rotina de expurgo com registro do evento (LGPD art. 37), '
               || 'e conferir ANTES se o hash_marcacao (presente: %s) inclui latitude e '
               || 'longitude — se incluir, expurgá-las quebra a cadeia de integridade da '
               || 'batida, e essa decisão precede a implementação do expurgo.',
               COALESCE(v_onde, 'NENHUM'), v_com_geo_antiga, v_total, v_tem_hash);
    r.detalhe  := jsonb_build_object('parametro_no_modulo', v_onde,
                                     'geo_antiga_retida', v_com_geo_antiga,
                                     'total_marcacoes', v_total);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- ─────────────────────────────────────────────────────────
-- Varredura: outras rotinas de QA com busca larga demais
-- Mesma família dos dois defeitos acima. Se aparecer alguma, revisar.
-- ─────────────────────────────────────────────────────────
SELECT p.proname AS rotina_com_busca_ampla
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname LIKE 'qa\_caso\_%'
  AND p.prosrc ~* 'information_schema\.columns'
  AND p.prosrc !~* 'table_name (LIKE|=|IN)'
ORDER BY p.proname;

DO $roda$
BEGIN
  PERFORM public.qa_rodar_bateria('manual','jornada-rotina/ponto');
END $roda$;

SELECT * FROM public.qa_relatorio_falhas('jornada-rotina/ponto');
