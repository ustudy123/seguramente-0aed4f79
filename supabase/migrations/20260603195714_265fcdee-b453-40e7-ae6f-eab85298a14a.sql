CREATE OR REPLACE FUNCTION public.ensure_admissao_documentos_by_token(_token uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admissao public.admissoes%ROWTYPE;
  v_inserted_count integer := 0;
BEGIN
  SELECT *
  INTO v_admissao
  FROM public.admissoes
  WHERE onboarding_token = _token
  LIMIT 1;

  IF v_admissao.id IS NULL THEN
    RAISE EXCEPTION 'Token inválido' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.admissao_documentos (
    admissao_id,
    tenant_id,
    nome,
    tipo,
    obrigatorio,
    status
  )
  SELECT
    v_admissao.id,
    v_admissao.tenant_id,
    doc.nome,
    doc.tipo,
    doc.obrigatorio,
    'pendente'::public.documento_status
  FROM (
    VALUES
      ('RG', 'identidade', true),
      ('CPF', 'identidade', true),
      ('Comprovante de Residência', 'endereco', true),
      ('Título de Eleitor', 'identidade', true),
      ('Carteira de Trabalho (CTPS)', 'trabalho', true),
      ('Carteira de Reservista', 'identidade', false),
      ('Certidão de Nascimento/Casamento', 'civil', true),
      ('Foto 3x4', 'foto', true),
      ('Comprovante de Escolaridade', 'formacao', true),
      ('Exame Admissional', 'saude', true),
      ('Certificado de Cursos', 'formacao', false),
      ('Certidão de Nascimento dos Filhos', 'dependentes', false)
  ) AS doc(nome, tipo, obrigatorio)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.admissao_documentos d
    WHERE d.admissao_id = v_admissao.id
      AND d.nome = doc.nome
      AND d.tipo = doc.tipo
  );

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  RETURN v_inserted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_admissao_documentos_by_token(uuid) TO anon, authenticated;

WITH target_admissoes AS (
  SELECT a.id, a.tenant_id, a.nome_completo
  FROM public.admissoes a
), missing_docs AS (
  SELECT ta.id AS admissao_id, ta.tenant_id, doc.nome, doc.tipo, doc.obrigatorio
  FROM target_admissoes ta
  CROSS JOIN (
    VALUES
      ('RG', 'identidade', true),
      ('CPF', 'identidade', true),
      ('Comprovante de Residência', 'endereco', true),
      ('Título de Eleitor', 'identidade', true),
      ('Carteira de Trabalho (CTPS)', 'trabalho', true),
      ('Carteira de Reservista', 'identidade', false),
      ('Certidão de Nascimento/Casamento', 'civil', true),
      ('Foto 3x4', 'foto', true),
      ('Comprovante de Escolaridade', 'formacao', true),
      ('Exame Admissional', 'saude', true),
      ('Certificado de Cursos', 'formacao', false),
      ('Certidão de Nascimento dos Filhos', 'dependentes', false)
  ) AS doc(nome, tipo, obrigatorio)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.admissao_documentos d
    WHERE d.admissao_id = ta.id
      AND d.nome = doc.nome
      AND d.tipo = doc.tipo
  )
)
INSERT INTO public.admissao_documentos (
  admissao_id,
  tenant_id,
  nome,
  tipo,
  obrigatorio,
  status
)
SELECT
  admissao_id,
  tenant_id,
  nome,
  tipo,
  obrigatorio,
  'pendente'::public.documento_status
FROM missing_docs;

WITH missing_workflow AS (
  SELECT a.id AS admissao_id, a.tenant_id
  FROM public.admissoes a
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.admissao_workflow w
    WHERE w.admissao_id = a.id
  )
)
INSERT INTO public.admissao_workflow (
  admissao_id,
  tenant_id,
  etapa,
  ordem,
  status,
  responsavel_nome,
  data_acao
)
SELECT mw.admissao_id,
       mw.tenant_id,
       step.etapa,
       step.ordem,
       CASE WHEN step.ordem = 1 THEN 'aprovado'::public.workflow_status ELSE 'pendente'::public.workflow_status END,
       CASE WHEN step.ordem = 1 THEN 'Sistema' ELSE 'Pendente' END,
       CASE WHEN step.ordem = 1 THEN now() ELSE NULL END
FROM missing_workflow mw
CROSS JOIN (
  VALUES
    ('Cadastro Inicial', 1),
    ('Análise Documental', 2),
    ('Aprovação RH', 3),
    ('Aprovação Final', 4)
) AS step(etapa, ordem);

WITH missing_history AS (
  SELECT a.id AS admissao_id, a.tenant_id, a.nome_completo, a.criado_por
  FROM public.admissoes a
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.admissao_historico h
    WHERE h.admissao_id = a.id
  )
)
INSERT INTO public.admissao_historico (
  admissao_id,
  tenant_id,
  acao,
  descricao,
  usuario_id,
  usuario_nome
)
SELECT
  mh.admissao_id,
  mh.tenant_id,
  'Admissão criada',
  'Histórico inicial recriado automaticamente para ' || coalesce(mh.nome_completo, 'colaborador'),
  mh.criado_por,
  'Sistema'
FROM missing_history mh;