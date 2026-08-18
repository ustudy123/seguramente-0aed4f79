-- =====================================================================
-- PONTO-396 — Ajuste de escopo: retira a trava de ponto_diario
-- =====================================================================
-- A migration 20260818130000 aplicou a política de leitura por CPF em
-- três tabelas: ponto_marcacoes, ponto_espelhos e ponto_diario.
--
-- As duas primeiras estão certas e ficam: são as que carregam o dado
-- sensível nominal (batidas com geolocalização e selfie, e os espelhos
-- do colaborador), e são exatamente as que o caso PONTO-396 aponta.
--
-- ponto_diario foi extensão minha e estava errada. A tabela é lida de
-- forma AGREGADA, empresa inteira, por telas de OUTROS módulos:
--
--   src/components/avaliacoes/psicossocial/ContaprovaOrganizacional.tsx
--     — média de hora extra do período, indicador da contraprova
--   src/components/avaliacoes/psicossocial/ChecklistDeteccaoObservavel.tsx
--     — horas extras dos últimos três meses
--   src/components/hub-contabil/HubCompetencias.tsx
--     — contagem de dias apurados por competência
--   src/components/jornada/JornadaIndividual.tsx
--
-- Quem opera essas telas (saude_ocupacional, tecnico_seguranca, perfis
-- do Hub Contábil) mapeia para papel 'user' em src/lib/userRoleMap.ts.
-- Com a trava, esses agregados passariam a somar apenas os dias do
-- próprio leitor: o indicador sairia ERRADO EM SILÊNCIO, que é pior do
-- que falhar — um risco psicossocial subdimensionado não se percebe.
--
-- Fechar ponto_diario corretamente exige separar leitura agregada de
-- leitura nominal, o que não se faz por política de linha. Fica para a
-- onda de indicadores, junto com a memória de cálculo, com o consumo
-- agregado passando por função própria.
-- =====================================================================

DO $ajuste396$
BEGIN
  IF to_regclass('public.ponto_diario') IS NOT NULL THEN
    DROP POLICY IF EXISTS perfil_restringe_leitura_ponto_diario ON public.ponto_diario;
    RAISE NOTICE 'Trava de leitura retirada de ponto_diario (leitura agregada entre modulos).';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Nao foi possivel ajustar a politica de ponto_diario: %', SQLERRM;
END $ajuste396$;
