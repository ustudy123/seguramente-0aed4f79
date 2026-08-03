-- Workshop (entrevista coletiva): expor tipo_sessao/grupo_nome/participantes_previstos
-- e o tipo_instrumento da campanha na RPC pública usada pela página /entrevista/:token.
-- Postgres não permite CREATE OR REPLACE mudando o RETURNS TABLE → DROP + CREATE.

DROP FUNCTION IF EXISTS public.get_entrevista_by_token(text);

CREATE FUNCTION public.get_entrevista_by_token(p_token text)
RETURNS TABLE (
  id uuid,
  campanha_id uuid,
  campanha_nome text,
  empresa_nome text,
  modalidade text,
  status text,
  fase_atual int,
  riscos_cobertos int,
  total_riscos int,
  consentimento_lgpd_em timestamptz,
  iniciada_em timestamptz,
  concluida_em timestamptz,
  tipo_sessao text,
  grupo_nome text,
  participantes_previstos int,
  tipo_instrumento text
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT e.id, e.campanha_id, c.nome, emp.razao_social,
         e.modalidade, e.status, e.fase_atual, e.riscos_cobertos, e.total_riscos,
         e.consentimento_lgpd_em, e.iniciada_em, e.concluida_em,
         e.tipo_sessao, e.grupo_nome, e.participantes_previstos,
         c.tipo_instrumento
  FROM public.psicossocial_entrevistas e
  JOIN public.questionario_psicossocial_campanhas c ON c.id = e.campanha_id
  LEFT JOIN public.empresa_cadastro emp ON emp.id = e.empresa_id
  WHERE e.token = p_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_entrevista_by_token(text) TO anon, authenticated;
