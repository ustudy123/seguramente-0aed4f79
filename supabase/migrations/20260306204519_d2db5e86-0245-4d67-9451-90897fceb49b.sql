
-- Precisa dropar e recriar pois mudou o tipo de retorno (adicionando campanha_instrumento)
DROP FUNCTION IF EXISTS public.buscar_convite_por_token(text);

CREATE OR REPLACE FUNCTION public.buscar_convite_por_token(p_token text)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  campanha_id uuid,
  colaborador_id text,
  colaborador_nome text,
  colaborador_cpf text,
  colaborador_cargo text,
  colaborador_departamento text,
  token text,
  status text,
  enviado_via text,
  enviado_em timestamp with time zone,
  iniciado_em timestamp with time zone,
  concluido_em timestamp with time zone,
  created_at timestamp with time zone,
  campanha_nome text,
  campanha_descricao text,
  campanha_tipo text,
  campanha_status text,
  campanha_instrumento text,
  campanha_data_inicio text,
  campanha_data_fim text,
  campanha_anonimo boolean,
  campanha_permite_identificacao_voluntaria boolean,
  campanha_mensagem_institucional text,
  campanha_politica_uso_dados text,
  campanha_blocos_dinamicos jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.id, c.tenant_id, c.campanha_id, c.colaborador_id, c.colaborador_nome,
    c.colaborador_cpf, c.colaborador_cargo, c.colaborador_departamento,
    c.token, c.status::TEXT, c.enviado_via, c.enviado_em, c.iniciado_em,
    c.concluido_em, c.created_at,
    camp.nome, camp.descricao, camp.tipo, camp.status::TEXT,
    camp.instrumento::TEXT,
    camp.data_inicio, camp.data_fim, camp.anonimo,
    camp.permite_identificacao_voluntaria, camp.mensagem_institucional,
    camp.politica_uso_dados, camp.blocos_dinamicos
  FROM public.questionario_psicossocial_convites c
  JOIN public.questionario_psicossocial_campanhas camp ON camp.id = c.campanha_id
  WHERE c.token = UPPER(p_token)
  LIMIT 1;
$$;
