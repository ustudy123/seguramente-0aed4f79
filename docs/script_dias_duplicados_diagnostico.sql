-- =====================================================================
-- Sábados aparecendo duas vezes na lista do Banco de Horas
--
-- Hipótese: existem DUAS linhas de ponto_diario para a mesma pessoa no
-- mesmo dia. A tela monta a lista com uma junção por data — duas linhas,
-- duas aparições, cada uma com o seu total.
--
-- Como isso passa pela chave única (tenant_id, colaborador_cpf, data):
-- se o CPF estiver gravado em formatos diferentes ("117.626.459-12" e
-- "11762645912"), o banco entende como duas pessoas diferentes. As
-- consultas normalizam o CPF na leitura, então as duas linhas voltam
-- juntas — e o dia duplica.
--
-- Somente leitura.
-- =====================================================================

-- 1) EXISTE DUPLICIDADE? E DE QUE TIPO -------------------------------
SELECT count(*)                                        AS dias_duplicados,
       count(DISTINCT cpf)                             AS pessoas_afetadas,
       count(*) FILTER (WHERE formatos > 1)            AS por_formato_de_cpf,
       count(*) FILTER (WHERE formatos = 1)            AS mesmo_cpf_mesma_grafia,
       min(data)                                       AS primeiro_dia,
       max(data)                                       AS ultimo_dia
FROM (
  SELECT tenant_id,
         regexp_replace(COALESCE(colaborador_cpf,''), '[^0-9]', '', 'g') AS cpf,
         data,
         count(*) AS linhas,
         count(DISTINCT colaborador_cpf) AS formatos
  FROM public.ponto_diario
  GROUP BY 1, 2, 3
  HAVING count(*) > 1
) x;


-- 2) OS CASOS RELATADOS, LINHA A LINHA --------------------------------
-- Luiza, Adriana (27/06) e Luciani (09/06). Mostra as duas linhas de
-- cada dia, com o CPF exatamente como está gravado.
SELECT d.colaborador_nome,
       d.data,
       d.colaborador_cpf AS cpf_como_esta_gravado,
       d.entrada, d.saida, d.horas_trabalhadas, d.status, d.tipo_dia,
       d.empresa_id,
       d.created_at, d.updated_at
FROM public.ponto_diario d
JOIN (
  SELECT tenant_id,
         regexp_replace(COALESCE(colaborador_cpf,''), '[^0-9]', '', 'g') AS cpf,
         data
  FROM public.ponto_diario
  GROUP BY 1, 2, 3
  HAVING count(*) > 1
) dup
  ON dup.tenant_id = d.tenant_id
 AND dup.data = d.data
 AND dup.cpf = regexp_replace(COALESCE(d.colaborador_cpf,''), '[^0-9]', '', 'g')
WHERE d.colaborador_nome ILIKE ANY (ARRAY['%luiza%', '%adriana%', '%luciani%'])
ORDER BY d.colaborador_nome, d.data, d.created_at
LIMIT 60;


-- 3) O RETRATO GERAL, POR PESSOA --------------------------------------
-- Quem tem mais dias duplicados. Se a lista for curta, é caso pontual;
-- se for longa, é a gravação do CPF que está inconsistente na origem.
SELECT max(d.colaborador_nome) AS colaborador,
       regexp_replace(COALESCE(d.colaborador_cpf,''), '[^0-9]', '', 'g') AS cpf,
       count(DISTINCT d.data) AS dias_duplicados,
       string_agg(DISTINCT d.colaborador_cpf, '  |  ') AS formatos_gravados,
       min(d.data) AS de, max(d.data) AS ate
FROM public.ponto_diario d
JOIN (
  SELECT tenant_id,
         regexp_replace(COALESCE(colaborador_cpf,''), '[^0-9]', '', 'g') AS cpf,
         data
  FROM public.ponto_diario
  GROUP BY 1, 2, 3
  HAVING count(*) > 1
) dup
  ON dup.tenant_id = d.tenant_id
 AND dup.data = d.data
 AND dup.cpf = regexp_replace(COALESCE(d.colaborador_cpf,''), '[^0-9]', '', 'g')
GROUP BY 2
ORDER BY 3 DESC
LIMIT 30;
