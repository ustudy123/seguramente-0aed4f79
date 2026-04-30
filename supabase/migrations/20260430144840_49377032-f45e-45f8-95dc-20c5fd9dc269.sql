
CREATE OR REPLACE FUNCTION public.clone_perfil_permissoes(_source_perfil_id uuid, _target_perfil_id uuid, _target_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.perfil_permissoes (perfil_id, tenant_id, modulo, acao, escopo, ativo)
  SELECT _target_perfil_id, _target_tenant_id, pp.modulo, pp.acao, pp.escopo, pp.ativo
  FROM public.perfil_permissoes pp
  WHERE pp.perfil_id = _source_perfil_id
    AND pp.ativo = true
    AND NOT EXISTS (
      SELECT 1 FROM public.perfil_permissoes existing
      WHERE existing.perfil_id = _target_perfil_id
        AND existing.modulo = pp.modulo
        AND existing.acao = pp.acao
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_clone_template_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  src_id uuid;
BEGIN
  -- Try to find a source perfil with same name that has permissions
  SELECT pa2.id INTO src_id
  FROM public.perfis_acesso pa2
  WHERE pa2.nome = NEW.nome
    AND pa2.id <> NEW.id
    AND EXISTS (SELECT 1 FROM public.perfil_permissoes pp2 WHERE pp2.perfil_id = pa2.id AND pp2.ativo = true)
  ORDER BY pa2.created_at ASC
  LIMIT 1;

  IF src_id IS NOT NULL THEN
    PERFORM public.clone_perfil_permissoes(src_id, NEW.id, NEW.tenant_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS perfis_acesso_clone_template_permissions ON public.perfis_acesso;
CREATE TRIGGER perfis_acesso_clone_template_permissions
AFTER INSERT ON public.perfis_acesso
FOR EACH ROW
EXECUTE FUNCTION public.trg_clone_template_permissions();

-- Backfill existing empty perfis
DO $$
DECLARE
  r record;
  src_id uuid;
BEGIN
  FOR r IN
    SELECT pa.id, pa.tenant_id, pa.nome
    FROM public.perfis_acesso pa
    WHERE pa.ativo = true
      AND NOT EXISTS (SELECT 1 FROM public.perfil_permissoes pp WHERE pp.perfil_id = pa.id AND pp.ativo = true)
  LOOP
    SELECT pa2.id INTO src_id
    FROM public.perfis_acesso pa2
    WHERE pa2.nome = r.nome
      AND pa2.id <> r.id
      AND EXISTS (SELECT 1 FROM public.perfil_permissoes pp2 WHERE pp2.perfil_id = pa2.id AND pp2.ativo = true)
    ORDER BY pa2.created_at ASC
    LIMIT 1;

    IF src_id IS NOT NULL THEN
      PERFORM public.clone_perfil_permissoes(src_id, r.id, r.tenant_id);
    END IF;
  END LOOP;
END $$;

-- Backfill wallasmonteirob@gmail.com vínculo
INSERT INTO public.usuario_perfil_vinculos (tenant_id, usuario_id, perfil_id, ativo, is_perfil_principal, atribuido_por_nome)
SELECT u.tenant_id, u.id, pa.id, true, true, 'Sistema (backfill)'
FROM public.usuarios_base u
JOIN public.perfis_acesso pa ON pa.tenant_id = u.tenant_id AND pa.nome = 'Colaborador com Acesso' AND pa.ativo = true
WHERE u.email_principal = 'wallasmonteirob@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.usuario_perfil_vinculos v
    WHERE v.usuario_id = u.id AND v.perfil_id = pa.id
  );
