UPDATE public.questionario_psicossocial_respostas
SET cpf_hash = 'legacy:' || encode(digest(id::text, 'sha256'), 'hex')
WHERE campanha_id IN (
  '37ab14c2-25f9-4503-b9c8-3f97985fa189',
  '55f436c5-fb7b-4b07-b42b-18388a1b7b4f'
) AND cpf_hash IS NULL;