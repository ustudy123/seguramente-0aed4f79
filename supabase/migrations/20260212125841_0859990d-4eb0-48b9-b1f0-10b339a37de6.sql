-- Deletar histórico e registro de humor de hoje para reset de teste
DELETE FROM humor_historico WHERE humor_diario_id = 'de740f0e-3df4-426b-bb01-bb821785712c';
DELETE FROM humor_diario WHERE id = 'de740f0e-3df4-426b-bb01-bb821785712c';