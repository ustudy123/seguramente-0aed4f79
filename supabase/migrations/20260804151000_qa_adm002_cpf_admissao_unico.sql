-- =====================================================================
-- QA ADM-002 — duplicidade de CPF aceita em admissoes
--
-- A tabela admissoes não tem índice único no CPF. Duas admissões ativas da
-- mesma pessoa geram dois vínculos no eSocial, onde o CPF é a chave do
-- trabalhador. A rotina provou o caso: gravou o mesmo CPF duas vezes.
--
-- A comparação também é sobre a string crua, então "111.222.333-96" e
-- "11122233396" passam como pessoas diferentes — mesma raiz do COLAB-033.
--
-- Duas peças:
--   1. normalizar o CPF na escrita (só dígitos), para que a comparação seja
--      sobre a pessoa e não sobre a digitação;
--   2. índice único PARCIAL sobre as admissões em curso. Readmissão é
--      legítima: quem já foi desligado pode voltar, e um índice sobre todas
--      as linhas impediria isso.
-- =====================================================================

-- 1) NORMALIZAÇÃO NA ESCRITA ------------------------------------------
CREATE OR REPLACE FUNCTION public.admissao_normalizar_cpf()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.cpf IS NOT NULL THEN
    NEW.cpf := NULLIF(regexp_replace(NEW.cpf, '[^0-9]', '', 'g'), '');
  END IF;
  RETURN NEW;
END;
$$;

-- BEFORE, e antes da validação de dígito verificador na ordem alfabética
-- dos nomes de trigger ('admissao_...' < 'valida_cpf_admissao'), para que a
-- validação receba o valor já limpo.
DROP TRIGGER IF EXISTS admissao_normaliza_cpf ON public.admissoes;
CREATE TRIGGER admissao_normaliza_cpf
  BEFORE INSERT OR UPDATE OF cpf ON public.admissoes
  FOR EACH ROW EXECUTE FUNCTION public.admissao_normalizar_cpf();

-- 2) DIAGNÓSTICO — quem já está duplicado -----------------------------
-- O índice não entra se houver duplicidade preexistente. Esta função mostra
-- o que precisa ser resolvido pelo RH antes.
CREATE OR REPLACE FUNCTION public.admissoes_cpf_duplicado()
RETURNS TABLE(tenant_id uuid, cpf text, quantidade bigint, admissoes uuid[], nomes text[])
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.tenant_id,
         regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g') AS cpf,
         count(*),
         array_agg(a.id ORDER BY a.created_at),
         array_agg(a.nome_completo ORDER BY a.created_at)
  FROM public.admissoes a
  WHERE COALESCE(a.cpf, '') <> ''
    AND a.status NOT IN ('desligado', 'reprovado')
  GROUP BY 1, 2
  HAVING count(*) > 1;
$$;

GRANT EXECUTE ON FUNCTION public.admissoes_cpf_duplicado() TO authenticated;

-- 3) ÍNDICE ÚNICO PARCIAL ---------------------------------------------
-- Só sobre as admissões que ainda representam um vínculo em formação ou
-- ativo. 'desligado' e 'reprovado' ficam de fora: readmitir é legítimo, e
-- reprovado não gera vínculo.
--
-- Se houver duplicidade hoje, o índice não é criado e o deploy NÃO quebra —
-- fica o aviso e a função de diagnóstico acima. Travar a aplicação inteira
-- por causa de dado sujo preexistente seria pior que o problema.
DO $idx$
DECLARE
  v_dups int;
BEGIN
  SELECT count(*) INTO v_dups FROM public.admissoes_cpf_duplicado();

  IF v_dups > 0 THEN
    RAISE WARNING
      'ADM-002: índice único NÃO criado — % CPF(s) já duplicado(s) em admissões ativas. '
      'Rode SELECT * FROM public.admissoes_cpf_duplicado(); resolva os casos e reaplique.',
      v_dups;
    RETURN;
  END IF;

  -- Normaliza o histórico antes de indexar, senão a mesma pessoa com
  -- pontuação diferente continua escapando.
  UPDATE public.admissoes
     SET cpf = regexp_replace(cpf, '[^0-9]', '', 'g')
   WHERE cpf IS NOT NULL
     AND cpf <> regexp_replace(cpf, '[^0-9]', '', 'g');

  CREATE UNIQUE INDEX IF NOT EXISTS uq_admissoes_cpf_ativa
    ON public.admissoes (tenant_id, regexp_replace(cpf, '[^0-9]', '', 'g'))
    WHERE cpf IS NOT NULL
      AND status NOT IN ('desligado', 'reprovado');

  RAISE NOTICE 'ADM-002: índice único de CPF criado sobre admissões ativas.';
END $idx$;
