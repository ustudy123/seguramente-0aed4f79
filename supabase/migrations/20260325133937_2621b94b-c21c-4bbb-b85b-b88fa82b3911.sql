
-- Limpar todos os registros de teste do módulo psicossocial para tenant 299779a8-1cd2-4ffe-9462-78181426cd1a

-- Tabelas com tenant_id direto
DELETE FROM questionario_psicossocial_respostas WHERE tenant_id = '299779a8-1cd2-4ffe-9462-78181426cd1a';
DELETE FROM questionario_psicossocial_convites WHERE tenant_id = '299779a8-1cd2-4ffe-9462-78181426cd1a';
DELETE FROM questionario_psicossocial_campanhas WHERE tenant_id = '299779a8-1cd2-4ffe-9462-78181426cd1a';
DELETE FROM psicossocial_participacoes WHERE tenant_id = '299779a8-1cd2-4ffe-9462-78181426cd1a';
DELETE FROM psicossocial_alertas WHERE tenant_id = '299779a8-1cd2-4ffe-9462-78181426cd1a';
DELETE FROM psicossocial_evidencias WHERE tenant_id = '299779a8-1cd2-4ffe-9462-78181426cd1a';
DELETE FROM psicossocial_inventario_riscos WHERE tenant_id = '299779a8-1cd2-4ffe-9462-78181426cd1a';

-- Tabelas vinculadas via campanha_id (sem tenant_id direto)
DELETE FROM psicossocial_otp_verificacao
WHERE campanha_id IN (
  SELECT id FROM questionario_psicossocial_campanhas WHERE tenant_id = '299779a8-1cd2-4ffe-9462-78181426cd1a'
);

DELETE FROM psicossocial_telefone_usado
WHERE campanha_id IN (
  SELECT id FROM questionario_psicossocial_campanhas WHERE tenant_id = '299779a8-1cd2-4ffe-9462-78181426cd1a'
);
