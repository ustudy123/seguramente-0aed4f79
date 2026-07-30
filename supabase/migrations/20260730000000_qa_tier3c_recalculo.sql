-- ============================================================================
-- QA Tier 3C — recálculo automático (e o OBRG-020, destravado)
--
--   DOC-041  documento vencido continuava com status "valido"
--   EMP-035  cota de PcD não acompanhava a mudança de faixa de empregados
--   OBRG-020 categoria/subcategoria eram TEXT livre e aceitaram "banana"
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. DOC-041 — status do documento derivado da validade
--
-- terceiro_documentos JÁ tem essa automação (os casos TDOC-001..005 passam); o
-- módulo geral de documentos não tinha, e a validade era apenas um dado.
--
-- CUIDADO DELIBERADO: a trigger só age quando data_validade está preenchida.
-- Documentos sem validade mantêm o status que têm — é o que preserva os valores
-- 'ativo' e 'pendente', que descrevem outra coisa (situação do documento, não
-- vigência). Sobrescrevê-los apagaria significado.
--
-- Vocabulário desta tabela: 'vencendo' (aqui) equivale a 'a_vencer' (terceiros).
-- São módulos com dicionários distintos; não unifiquei para não quebrar telas.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.atualizar_status_documento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.data_validade IS NULL THEN
    RETURN NEW;  -- sem vigência a declarar: preserva 'ativo'/'pendente'
  END IF;

  IF NEW.data_validade < CURRENT_DATE THEN
    NEW.status := 'vencido';
  ELSIF NEW.data_validade <= CURRENT_DATE + INTERVAL '60 days' THEN
    NEW.status := 'vencendo';
  ELSE
    NEW.status := 'valido';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_status_documento ON public.documentos;
CREATE TRIGGER auto_status_documento
BEFORE INSERT OR UPDATE OF data_validade ON public.documentos
FOR EACH ROW EXECUTE FUNCTION public.atualizar_status_documento();


-- A trigger só age na escrita. Um documento que vence amanhã não recebe UPDATE
-- nenhum no dia seguinte — continuaria "valido" para sempre. Daí a rotina
-- diária, no mesmo espírito da automação de terceiros.
CREATE OR REPLACE FUNCTION public.reavaliar_validade_documentos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_qtd integer := 0;
BEGIN
  WITH alvo AS (
    SELECT id,
           CASE
             WHEN data_validade < CURRENT_DATE THEN 'vencido'
             WHEN data_validade <= CURRENT_DATE + INTERVAL '60 days' THEN 'vencendo'
             ELSE 'valido'
           END AS novo
      FROM public.documentos
     WHERE data_validade IS NOT NULL
  )
  UPDATE public.documentos d
     SET status = a.novo
    FROM alvo a
   WHERE d.id = a.id
     AND d.status IS DISTINCT FROM a.novo;

  GET DIAGNOSTICS v_qtd = ROW_COUNT;
  RETURN v_qtd;
END;
$$;

-- Corrige de imediato o passivo: os 7 documentos já vencidos que seguiam
-- marcados como válidos, e os que entraram na janela de 60 dias.
SELECT public.reavaliar_validade_documentos();

-- Roda todo dia às 04:10. pg_cron já está habilitado neste projeto.
SELECT cron.unschedule('reavaliar-validade-documentos')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reavaliar-validade-documentos');

SELECT cron.schedule(
  'reavaliar-validade-documentos',
  '10 4 * * *',
  $cron$ SELECT public.reavaliar_validade_documentos(); $cron$
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. EMP-035 — cota de PcD acompanha a faixa de empregados
--
-- A empresa passava de 200 para 201 colaboradores (faixa de 2% para 3%) e a
-- cota gravada continuava a antiga. Só a tela recalculava, e só quando alguém
-- editava por lá — importação e API ignoravam.
--
-- Faixas da Lei 8.213/91, art. 93, e arredondamento PARA CIMA, idênticos ao que
-- EmpresaObrigacoesInclusao.tsx já faz (350 × 3% = 10,5 → 11).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recalcular_cota_pcd()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total INTEGER := COALESCE(NEW.total_colaboradores, 0);
  v_pct   NUMERIC;
BEGIN
  -- Só recalcula para quem está sujeito à cota.
  IF NOT COALESCE(NEW.pcd_obrigatoria, FALSE) THEN
    RETURN NEW;
  END IF;

  v_pct := CASE
    WHEN v_total BETWEEN 100 AND 200  THEN 2
    WHEN v_total BETWEEN 201 AND 500  THEN 3
    WHEN v_total BETWEEN 501 AND 1000 THEN 4
    WHEN v_total > 1000               THEN 5
    -- Abaixo de 100 não há obrigação legal; preserva o que estiver gravado
    -- (a tela usa 2% como piso quando marcam a obrigação manualmente).
    ELSE COALESCE(NEW.pcd_percentual_exigido, 2)
  END;

  NEW.pcd_percentual_exigido := v_pct;

  IF v_total > 0 AND v_pct > 0 THEN
    NEW.pcd_quantidade_exigida := CEIL((v_total * v_pct) / 100.0);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_cota_pcd ON public.empresa_cadastro;
CREATE TRIGGER auto_cota_pcd
BEFORE INSERT OR UPDATE OF total_colaboradores, pcd_obrigatoria ON public.empresa_cadastro
FOR EACH ROW EXECUTE FUNCTION public.recalcular_cota_pcd();


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. OBRG-020 — domínio de categoria e subcategoria
--
-- Estava fora do Tier 3A porque o relatório dizia que os valores válidos
-- "vivem só no comentário do código" e eu não os havia encontrado. Estão em
-- src/types/empresa.ts, no catálogo de obrigações automáticas.
--
-- As três categorias batem exatamente com o que há na base (legal 21, sst 11,
-- financeira 1) — nenhum registro fica de fora.
--
-- ATENÇÃO: o CHECK de SUBCATEGORIA abaixo só foi aplicado após auditar os
-- valores em uso. Se aparecer subcategoria fora desta lista em outra base,
-- o ALTER falha — audite antes com:
--   SELECT subcategoria, count(*) FROM public.empresa_obrigacoes
--    WHERE subcategoria IS NOT NULL GROUP BY 1;
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.empresa_obrigacoes
  DROP CONSTRAINT IF EXISTS empresa_obrigacoes_categoria_dominio;
ALTER TABLE public.empresa_obrigacoes
  ADD CONSTRAINT empresa_obrigacoes_categoria_dominio
  CHECK (categoria IS NULL OR categoria IN ('legal', 'sst', 'financeira'));

ALTER TABLE public.empresa_obrigacoes
  DROP CONSTRAINT IF EXISTS empresa_obrigacoes_subcategoria_dominio;
ALTER TABLE public.empresa_obrigacoes
  ADD CONSTRAINT empresa_obrigacoes_subcategoria_dominio
  CHECK (subcategoria IS NULL OR subcategoria IN (
    'pcd', 'aprendiz', 'cipa', 'sesmt', 'fap', 'tac',
    'grau_risco', 'jornada', 'condicoes_especiais'
  ));
