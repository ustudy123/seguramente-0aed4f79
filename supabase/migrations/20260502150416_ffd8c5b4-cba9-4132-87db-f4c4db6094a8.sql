CREATE OR REPLACE FUNCTION public.marcar_reavaliacao_gro_risco()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'concluida' AND OLD.status != 'concluida' THEN
    -- Vincular por acao_id direto
    UPDATE public.gro_riscos
    SET
      necessita_reavaliacao = true,
      reavaliacao_motivo = 'Ação vinculada concluída: "' || NEW.titulo || '". Avalie se o risco foi reduzido.',
      reavaliacao_solicitada_em = now()
    WHERE acao_id = NEW.id
      AND ativo = true;

    -- Vincular por campanha quando origem é psicossocial
    IF NEW.origem_modulo = 'psicossocial' AND NEW.origem_id IS NOT NULL THEN
      UPDATE public.gro_riscos
      SET
        necessita_reavaliacao = true,
        reavaliacao_motivo = 'Ação psicossocial concluída: "' || NEW.titulo || '". Reavalie o nível de risco da dimensão.',
        reavaliacao_solicitada_em = now()
      WHERE campanha_id::text = NEW.origem_id
        AND ativo = true
        AND necessita_reavaliacao = false;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;