CREATE OR REPLACE FUNCTION public.validar_periodo_aberto_ponto_diario()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_competencia TEXT;
  v_fechado BOOLEAN;
  v_uid uuid := auth.uid();
  v_pode_burlar boolean := false;
BEGIN
  v_competencia := to_char(NEW.data::date, 'YYYY-MM');
  SELECT EXISTS(
    SELECT 1 FROM ponto_fechamentos
    WHERE tenant_id = NEW.tenant_id AND competencia = v_competencia AND status = 'fechado'
  ) INTO v_fechado;

  IF TG_OP = 'UPDATE' AND v_fechado AND NEW.status != 'justificado' THEN
    -- Permitir override para gestores/admins/proprietários/RH/superadmin
    IF v_uid IS NOT NULL THEN
      SELECT
        public.has_role(v_uid, 'manager'::public.app_role)
        OR public.has_role(v_uid, 'admin'::public.app_role)
        OR public.has_role(v_uid, 'owner'::public.app_role)
        OR public.has_role(v_uid, 'superadmin'::public.app_role)
        OR EXISTS (
          SELECT 1 FROM public.usuarios_base ub
          WHERE ub.auth_user_id = v_uid
            AND ub.tenant_id = NEW.tenant_id
            AND ub.tipo_usuario IN ('gestor','administrador','proprietario','rh','rh_dp')
        )
        OR EXISTS (
          SELECT 1 FROM public.usuario_vinculos uv
          JOIN public.usuarios_base ub2 ON ub2.id = uv.usuario_id
          WHERE ub2.auth_user_id = v_uid
            AND uv.tenant_id = NEW.tenant_id
            AND uv.status = 'ativo'
            AND uv.tipo_vinculo::text IN ('gestor','administrador','proprietario','rh')
        )
      INTO v_pode_burlar;
    END IF;

    IF NOT v_pode_burlar THEN
      RAISE EXCEPTION 'Período % está fechado. Alterações bloqueadas.', v_competencia;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validar_periodo_aberto_ponto()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_competencia TEXT;
  v_fechado BOOLEAN;
  v_uid uuid := auth.uid();
  v_pode_burlar boolean := false;
BEGIN
  v_competencia := to_char(NEW.data_marcacao::date, 'YYYY-MM');
  SELECT EXISTS(
    SELECT 1 FROM ponto_fechamentos
    WHERE tenant_id = NEW.tenant_id AND competencia = v_competencia AND status = 'fechado'
  ) INTO v_fechado;

  IF v_fechado THEN
    IF v_uid IS NOT NULL THEN
      SELECT
        public.has_role(v_uid, 'manager'::public.app_role)
        OR public.has_role(v_uid, 'admin'::public.app_role)
        OR public.has_role(v_uid, 'owner'::public.app_role)
        OR public.has_role(v_uid, 'superadmin'::public.app_role)
        OR EXISTS (
          SELECT 1 FROM public.usuarios_base ub
          WHERE ub.auth_user_id = v_uid
            AND ub.tenant_id = NEW.tenant_id
            AND ub.tipo_usuario IN ('gestor','administrador','proprietario','rh','rh_dp')
        )
        OR EXISTS (
          SELECT 1 FROM public.usuario_vinculos uv
          JOIN public.usuarios_base ub2 ON ub2.id = uv.usuario_id
          WHERE ub2.auth_user_id = v_uid
            AND uv.tenant_id = NEW.tenant_id
            AND uv.status = 'ativo'
            AND uv.tipo_vinculo::text IN ('gestor','administrador','proprietario','rh')
        )
      INTO v_pode_burlar;
    END IF;

    IF NOT v_pode_burlar THEN
      RAISE EXCEPTION 'Período % está fechado. Não é possível registrar marcações.', v_competencia;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;