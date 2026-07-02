-- =====================================================================
-- Justificativas padrão: nomes com apenas a primeira letra maiúscula
-- =====================================================================
-- As 12 justificativas do sistema foram semeadas em CAIXA ALTA
-- ("ATESTADO DE ACOMPANHAMENTO"). A pedido, passam a exibir apenas a
-- primeira letra maiúscula ("Atestado de acompanhamento").
-- 1) Renomeia as existentes (match por CODIGO + sistema=true, em todos os
--    tenants). Idempotente.
-- 2) Recria seed_justificativas_padrao com os novos nomes, para novos
--    tenants nascerem já no formato certo.
-- Justificativas criadas manualmente pelo RH (sistema=false) NÃO são tocadas.
-- =====================================================================

UPDATE public.ponto_justificativas SET nome = 'Abono', updated_at = now()
WHERE sistema = true AND codigo = 'ABONO' AND nome <> 'Abono';

UPDATE public.ponto_justificativas SET nome = 'Atestado de acompanhamento', updated_at = now()
WHERE sistema = true AND codigo = 'ATESTADO_ACOMPANHAMENTO' AND nome <> 'Atestado de acompanhamento';

UPDATE public.ponto_justificativas SET nome = 'Aviso prévio trabalhado', updated_at = now()
WHERE sistema = true AND codigo = 'AVISO_PREVIO_TRABALHADO' AND nome <> 'Aviso prévio trabalhado';

UPDATE public.ponto_justificativas SET nome = 'Compensação de horas', updated_at = now()
WHERE sistema = true AND codigo = 'COMPENSACAO_HORAS' AND nome <> 'Compensação de horas';

UPDATE public.ponto_justificativas SET nome = 'Day off', updated_at = now()
WHERE sistema = true AND codigo = 'DAY_OFF' AND nome <> 'Day off';

UPDATE public.ponto_justificativas SET nome = 'Falta justificada abonada', updated_at = now()
WHERE sistema = true AND codigo = 'FALTA_JUSTIFICADA_ABONADA' AND nome <> 'Falta justificada abonada';

UPDATE public.ponto_justificativas SET nome = 'Falta justificada não abonada', updated_at = now()
WHERE sistema = true AND codigo = 'FALTA_JUSTIFICADA_NAO_ABONADA' AND nome <> 'Falta justificada não abonada';

UPDATE public.ponto_justificativas SET nome = 'Falta não justificada', updated_at = now()
WHERE sistema = true AND codigo = 'FALTA_NAO_JUSTIFICADA' AND nome <> 'Falta não justificada';

UPDATE public.ponto_justificativas SET nome = 'Feriado', updated_at = now()
WHERE sistema = true AND codigo = 'FERIADO' AND nome <> 'Feriado';

UPDATE public.ponto_justificativas SET nome = 'Folga', updated_at = now()
WHERE sistema = true AND codigo = 'FOLGA' AND nome <> 'Folga';

UPDATE public.ponto_justificativas SET nome = 'Home office', updated_at = now()
WHERE sistema = true AND codigo = 'HOME_OFFICE' AND nome <> 'Home office';

UPDATE public.ponto_justificativas SET nome = 'Hora in itinere', updated_at = now()
WHERE sistema = true AND codigo = 'HORA_IN_ITINERE' AND nome <> 'Hora in itinere';

-- Seed com os novos nomes (novos tenants / reexecuções). Mesma lógica da
-- versão anterior (20260724150000), casando por CÓDIGO — com uma diferença:
-- o UPDATE agora também alinha o NOME ao padrão novo (primeira maiúscula).
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
      (1,  'Abono',                          'ABONO',                         'sim'),
      (2,  'Atestado de acompanhamento',     'ATESTADO_ACOMPANHAMENTO',       'configuravel'),
      (3,  'Aviso prévio trabalhado',        'AVISO_PREVIO_TRABALHADO',       'sim'),
      (4,  'Compensação de horas',           'COMPENSACAO_HORAS',             'sim'),
      (5,  'Day off',                        'DAY_OFF',                       'sim'),
      (6,  'Falta justificada abonada',      'FALTA_JUSTIFICADA_ABONADA',     'sim'),
      (7,  'Falta justificada não abonada',  'FALTA_JUSTIFICADA_NAO_ABONADA', 'nao'),
      (8,  'Falta não justificada',          'FALTA_NAO_JUSTIFICADA',         'nao'),
      (9,  'Feriado',                        'FERIADO',                       'sim'),
      (10, 'Folga',                          'FOLGA',                         'sim'),
      (11, 'Home office',                    'HOME_OFFICE',                   'sim'),
      (12, 'Hora in itinere',                'HORA_IN_ITINERE',               'sim')
    ) AS t(ordem, nome, codigo, tipo_abono)
  LOOP
    UPDATE public.ponto_justificativas
      SET nome = rec.nome,
          tipo_abono = rec.tipo_abono,
          sistema = true,
          ativo = true,
          ordem = rec.ordem,
          updated_at = now()
    WHERE tenant_id = p_tenant_id
      AND empresa_id IS NULL
      AND codigo = rec.codigo;
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
