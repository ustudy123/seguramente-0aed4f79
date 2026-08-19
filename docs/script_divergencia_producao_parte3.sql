-- ============================================================================
-- YourEyes · Divergência — as três tabelas grandes, coluna a coluna
--
-- SOMENTE LEITURA.
--
-- Na conferência de estrutura, sete tabelas apareceram como "difere". Quatro
-- couberam na tela e já foram comparadas. Três não couberam — admissoes,
-- afastamentos e ponto_diario, as maiores do sistema — porque a lista de
-- colunas foi cortada em 400 caracteres.
--
-- Esta consulta compara essas três coluna a coluna e devolve SÓ o que
-- diverge: uma linha por coluna faltando ou sobrando. Se as três estiverem
-- alinhadas, o resultado vem vazio.
--
-- COMO RODAR: cole no SQL Editor do projeto de PRODUÇÃO.
-- ============================================================================

WITH repo AS MATERIALIZED (
  SELECT split_part(x, '|', 1) AS tabela, split_part(x, '|', 2) AS coluna
  FROM unnest(ARRAY['admissoes|agencia','admissoes|aviso_previo_cumprido','admissoes|bairro','admissoes|banco','admissoes|bate_ponto','admissoes|cargo','admissoes|cbo','admissoes|celular','admissoes|centro_custo','admissoes|cep','admissoes|chave_conectividade','admissoes|chave_pix','admissoes|cidade','admissoes|classificacao_interna','admissoes|complemento','admissoes|conta','admissoes|cpf','admissoes|created_at','admissoes|criado_por','admissoes|crm_exame_demissional','admissoes|data_admissao','admissoes|data_aviso_previo','admissoes|data_desligamento','admissoes|data_exame_demissional','admissoes|data_homologacao','admissoes|data_nascimento','admissoes|departamento','admissoes|dependentes_irrf','admissoes|desligado_por','admissoes|desligado_por_nome','admissoes|desligamento_protocolo','admissoes|dias_aviso_previo','admissoes|email','admissoes|empresa_id','admissoes|endereco','admissoes|estado','admissoes|estado_civil','admissoes|exame_admissional_clinica','admissoes|exame_admissional_crm','admissoes|exame_admissional_data','admissoes|exame_admissional_medico','admissoes|exame_admissional_observacoes','admissoes|exame_admissional_resultado','admissoes|exame_admissional_validade','admissoes|exame_demissional_dispensa_motivo','admissoes|exame_demissional_dispensa_registrada_em','admissoes|exame_demissional_dispensa_registrada_por','admissoes|exame_demissional_dispensado','admissoes|filial','admissoes|foto_url','admissoes|genero','admissoes|gestor_imediato','admissoes|id','admissoes|inativado_em','admissoes|inativado_por','admissoes|inativo','admissoes|jornada_trabalho','admissoes|matricula_esocial','admissoes|medico_exame_demissional','admissoes|motivo_desligamento','admissoes|motivo_inativacao','admissoes|multa_fgts','admissoes|nacionalidade','admissoes|naturalidade','admissoes|nome_completo','admissoes|nome_mae','admissoes|nome_pai','admissoes|numero','admissoes|observacoes_desligamento','admissoes|onboarding_status','admissoes|onboarding_token','admissoes|resultado_exame_demissional','admissoes|rg','admissoes|salario','admissoes|seguro_desemprego_elegivel','admissoes|sindicato_homologacao','admissoes|status','admissoes|telefone','admissoes|tenant_id','admissoes|tipo_aviso_previo','admissoes|tipo_conta','admissoes|tipo_contrato','admissoes|tipo_vinculo','admissoes|updated_at','afastamentos|alerta_15_dias','afastamentos|alerta_30_dias','afastamentos|aso_retorno_id','afastamentos|aso_retorno_pendente','afastamentos|atualizado_por','afastamentos|beneficio_inss_id','afastamentos|cargo_id','afastamentos|colaborador_cpf','afastamentos|colaborador_id','afastamentos|colaborador_nome','afastamentos|created_at','afastamentos|criado_por','afastamentos|data_atestado','afastamentos|data_fim','afastamentos|data_fim_estabilidade','afastamentos|data_inicio','afastamentos|dias_totais','afastamentos|empresa_id','afastamentos|evento_saude_id','afastamentos|gestor_id','afastamentos|id','afastamentos|motivo_principal','afastamentos|nexo_trabalho','afastamentos|observacoes','afastamentos|prazo_indeterminado','afastamentos|setor_id','afastamentos|status','afastamentos|status_geral_new','afastamentos|tenant_id','afastamentos|tipo_principal_new','afastamentos|unidade_id','afastamentos|updated_at','ponto_diario|adicional_noturno_minutos','ponto_diario|atraso_minutos','ponto_diario|colaborador_cpf','ponto_diario|colaborador_id','ponto_diario|colaborador_nome','ponto_diario|created_at','ponto_diario|data','ponto_diario|empresa_id','ponto_diario|entrada','ponto_diario|escala_id','ponto_diario|he_intervalo_suprimido_minutos','ponto_diario|horas_extras','ponto_diario|horas_extras_100_minutos','ponto_diario|horas_extras_50_minutos','ponto_diario|horas_faltantes','ponto_diario|horas_trabalhadas','ponto_diario|id','ponto_diario|intervalo_intrajornada_minutos','ponto_diario|observacao','ponto_diario|retorno_almoco','ponto_diario|saida','ponto_diario|saida_almoco','ponto_diario|status','ponto_diario|tenant_id','ponto_diario|tipo_dia','ponto_diario|tolerancia_aplicada','ponto_diario|updated_at']) AS x
),
prod AS MATERIALIZED (
  SELECT table_name AS tabela, column_name AS coluna
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN ('admissoes', 'afastamentos', 'ponto_diario')
)
SELECT r.tabela, r.coluna, 'falta na produção' AS situacao,
       'coluna existe no repositório e não aqui — código que a use vai quebrar' AS detalhe
FROM repo r
WHERE NOT EXISTS (SELECT 1 FROM prod p WHERE p.tabela = r.tabela AND p.coluna = r.coluna)

UNION ALL

SELECT p.tabela, p.coluna, 'só na produção',
       'coluna criada fora das migrations; trazer para o repositório'
FROM prod p
WHERE NOT EXISTS (SELECT 1 FROM repo r WHERE r.tabela = p.tabela AND r.coluna = p.coluna)

ORDER BY 1, 3, 2;
