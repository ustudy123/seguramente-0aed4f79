CREATE OR REPLACE FUNCTION public.cancelar_trilhas_desligamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'desligado' AND OLD.status IS DISTINCT FROM 'desligado' THEN
    DELETE FROM public.trilha_atribuicoes
    WHERE alvo_nome = NEW.nome_completo
      AND tenant_id = NEW.tenant_id
      AND tipo_alvo = 'individual';

    DELETE FROM public.trilha_progresso
    WHERE colaborador_nome = NEW.nome_completo
      AND tenant_id = NEW.tenant_id
      AND status IN ('nao_iniciado', 'em_andamento');
  END IF;
  RETURN NEW;
END;
$$;