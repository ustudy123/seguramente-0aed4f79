
CREATE OR REPLACE FUNCTION public.verificar_conclusao_trilha()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_modulos INT;
  v_concluidos INT;
  v_pontos INT;
  v_existe_cert BOOLEAN;
BEGIN
  IF NEW.status != 'concluido' THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_total_modulos
  FROM public.trilha_modulos
  WHERE trilha_id = NEW.trilha_id AND ativo = true;

  SELECT COUNT(*) INTO v_concluidos
  FROM public.trilha_progresso
  WHERE trilha_id = NEW.trilha_id
    AND colaborador_id = NEW.colaborador_id
    AND tenant_id = NEW.tenant_id
    AND status = 'concluido';

  IF v_concluidos >= v_total_modulos AND v_total_modulos > 0 THEN
    -- Check certificate existence using text cast on the uuid column
    SELECT EXISTS(
      SELECT 1 FROM public.trilha_certificados
      WHERE trilha_id = NEW.trilha_id
        AND colaborador_id::text = NEW.colaborador_id
        AND tenant_id = NEW.tenant_id
    ) INTO v_existe_cert;

    IF NOT v_existe_cert THEN
      SELECT COALESCE(SUM(pontos_obtidos), 0) INTO v_pontos
      FROM public.trilha_progresso
      WHERE trilha_id = NEW.trilha_id
        AND colaborador_id = NEW.colaborador_id
        AND tenant_id = NEW.tenant_id;

      -- Cast text colaborador_id to uuid for insert
      BEGIN
        INSERT INTO public.trilha_certificados (
          tenant_id, trilha_id, colaborador_id, colaborador_nome,
          pontos_obtidos, codigo
        ) VALUES (
          NEW.tenant_id, NEW.trilha_id, NEW.colaborador_id::uuid, NEW.colaborador_nome,
          v_pontos, 'CERT-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 8))
        );
      EXCEPTION WHEN invalid_text_representation THEN
        -- colaborador_id is not a valid UUID, skip certificate
        NULL;
      END;

      -- Award medals with same cast
      BEGIN
        INSERT INTO public.trilha_medalhas_colaboradores (
          tenant_id, medalha_id, colaborador_id, colaborador_nome, trilha_id
        )
        SELECT NEW.tenant_id, m.id, NEW.colaborador_id::uuid, NEW.colaborador_nome, NEW.trilha_id
        FROM public.trilha_medalhas m
        WHERE m.tenant_id = NEW.tenant_id
          AND m.tipo = 'conclusao_trilha'
          AND m.ativo = true
          AND NOT EXISTS (
            SELECT 1 FROM public.trilha_medalhas_colaboradores mc
            WHERE mc.medalha_id = m.id
              AND mc.colaborador_id::text = NEW.colaborador_id
              AND mc.trilha_id = NEW.trilha_id
          );
      EXCEPTION WHEN invalid_text_representation THEN
        NULL;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
