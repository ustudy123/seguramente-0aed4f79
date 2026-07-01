-- =====================================================================
-- ponto_ajustes: campos para o novo fluxo de ajustes (Documento v1.1)
-- =====================================================================
--   * dia_inteiro: o ajuste cobre o dia inteiro conforme a escala.
--   * abonar_se_aprovado: escolha do usuário para justificativas de abono
--     configurável (ex.: ATESTADO DE ACOMPANHAMENTO).
--   * observacao: texto livre por período (opcional), separado do 'motivo'
--     (que segue guardando o nome da justificativa).
-- =====================================================================

ALTER TABLE public.ponto_ajustes
  ADD COLUMN IF NOT EXISTS dia_inteiro boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS abonar_se_aprovado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS observacao text;
