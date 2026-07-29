-- Política de leitura pública apenas para profissionais ativos
DROP POLICY IF EXISTS "Public can view active professionals" ON public.marketplace_profissionais;
CREATE POLICY "Public can view active professionals"
  ON public.marketplace_profissionais FOR SELECT
  TO anon
  USING (status = 'ativo'::marketplace_profissional_status);

-- Permissões por coluna: anon NUNCA lê email/telefone/user_id/tenant_id/codigo_afiliado
REVOKE SELECT ON public.marketplace_profissionais FROM anon;
GRANT SELECT (
  id, nome_completo, foto_url, bio, formacao_academica,
  registro_profissional, conselho, uf_registro, registro_validade,
  certificacoes, especialidades, areas_atuacao, modalidades_atendimento,
  cidade, estado, status, plano, selo_verificado, nota_media,
  total_avaliacoes, total_servicos_executados, tem_atestado_capacidade,
  latitude, longitude, created_at
) ON public.marketplace_profissionais TO anon;