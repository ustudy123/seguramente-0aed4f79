-- =====================================================================
-- Justificativas de ponto: flag de abono automático + 12 padrão do sistema
-- =====================================================================
-- Documento "Folha de Ponto – Ajustes" v1.1: cada justificativa passa a ter
-- uma regra de abono automático (Sim / Não / Configurável). O abono deixa de
-- ser um campo manual e passa a ser determinado pela justificativa, aplicado
-- na aprovação do ajuste.
--
-- Adiciona:
--   * tipo_abono: 'sim' | 'nao' | 'configuravel'  (default 'nao')
--   * codigo: identificador estável (para seed/handling especial)
--   * sistema: marca as justificativas padrão (não podem ser excluídas)
-- E semeia as 12 justificativas padrão por tenant (idempotente).
-- =====================================================================

ALTER TABLE public.ponto_justificativas
  ADD COLUMN IF NOT EXISTS tipo_abono text NOT NULL DEFAULT 'nao',
  ADD COLUMN IF NOT EXISTS codigo text,
  ADD COLUMN IF NOT EXISTS sistema boolean NOT NULL DEFAULT false;

DO $ck$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ponto_justificativas_tipo_abono_chk'
  ) THEN
    ALTER TABLE public.ponto_justificativas
      ADD CONSTRAINT ponto_justificativas_tipo_abono_chk
      CHECK (tipo_abono IN ('sim','nao','configuravel'));
  END IF;
END $ck$;

-- Função idempotente de seed das 12 justificativas padrão para um tenant.
-- Idempotente mesmo com o UNIQUE(tenant_id, empresa_id, nome) sendo frouxo
-- quando empresa_id IS NULL (NULLs distintos no Postgres): faz UPDATE e, se
-- não existir, INSERT. Chamável via RPC pelo botão "Restaurar padrões".
CREATE OR REPLACE FUNCTION public.seed_justificativas_padrao(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      (1,  'ABONO',                          'ABONO',                         'sim'),
      (2,  'ATESTADO DE ACOMPANHAMENTO',     'ATESTADO_ACOMPANHAMENTO',       'configuravel'),
      (3,  'AVISO PRÉVIO TRABALHADO',        'AVISO_PREVIO_TRABALHADO',       'sim'),
      (4,  'COMPENSAÇÃO DE HORAS',           'COMPENSACAO_HORAS',             'sim'),
      (5,  'DAY OFF',                        'DAY_OFF',                       'sim'),
      (6,  'FALTA JUSTIFICADA ABONADA',      'FALTA_JUSTIFICADA_ABONADA',     'sim'),
      (7,  'FALTA JUSTIFICADA NÃO ABONADA',  'FALTA_JUSTIFICADA_NAO_ABONADA', 'nao'),
      (8,  'FALTA NÃO JUSTIFICADA',          'FALTA_NAO_JUSTIFICADA',         'nao'),
      (9,  'FERIADO',                        'FERIADO',                       'sim'),
      (10, 'FOLGA',                          'FOLGA',                         'sim'),
      (11, 'HOME OFFICE',                    'HOME_OFFICE',                   'sim'),
      (12, 'HORA IN ITINERE',                'HORA_IN_ITINERE',               'sim')
    ) AS t(ordem, nome, codigo, tipo_abono)
  LOOP
    UPDATE public.ponto_justificativas
      SET tipo_abono = rec.tipo_abono,
          codigo = rec.codigo,
          sistema = true,
          ativo = true,
          ordem = rec.ordem,
          updated_at = now()
    WHERE tenant_id = p_tenant_id
      AND empresa_id IS NULL
      AND (codigo = rec.codigo OR nome = rec.nome);
    IF NOT FOUND THEN
      INSERT INTO public.ponto_justificativas
        (tenant_id, empresa_id, nome, codigo, tipo_abono, sistema, ativo, ordem, requer_anexo, horas_abono)
      VALUES
        (p_tenant_id, NULL, rec.nome, rec.codigo, rec.tipo_abono, true, true, rec.ordem, false, 0);
    END IF;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.seed_justificativas_padrao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_justificativas_padrao(uuid) TO authenticated;

-- Semeia para todos os tenants existentes (cada tenant com usuários cadastrados).
DO $seed$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT DISTINCT tenant_id FROM public.usuarios_base WHERE tenant_id IS NOT NULL
  LOOP
    BEGIN
      PERFORM public.seed_justificativas_padrao(t.tenant_id);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $seed$;
