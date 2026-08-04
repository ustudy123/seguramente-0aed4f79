-- =====================================================================
-- QA PONTO-251, PONTO-252, PONTO-253 e PONTO-270
--
-- Quatro achados do mesmo relatório, todos da mesma natureza: a regra certa
-- existe na tela e não existe no banco.
-- =====================================================================


-- ── PONTO-251 — link de marcação sem prazo ───────────────────────────
-- O link é credencial distribuída por mensagem. Sem prazo, é acesso
-- permanente ao ponto do colaborador para quem tiver a URL. Havia 7 links
-- ativos sem prazo nenhum entre 248.
--
-- Prazo padrão de 90 dias: longo o bastante para não atrapalhar o uso
-- diário do PWA, curto o bastante para que um link vazado morra sozinho.

ALTER TABLE public.ponto_links
  ALTER COLUMN data_expiracao SET DEFAULT (now() + interval '90 days');

-- Backfill dos que já estão no ar sem prazo. Conta a partir de agora, não
-- da criação: cortar o acesso de imediato deixaria colaborador sem bater
-- ponto no meio do expediente.
UPDATE public.ponto_links
   SET data_expiracao = now() + interval '90 days'
 WHERE data_expiracao IS NULL;

ALTER TABLE public.ponto_links
  ALTER COLUMN data_expiracao SET NOT NULL;

-- Depender de a consulta lembrar de filtrar por data é o mesmo erro de
-- depender de a tela lembrar de validar. Esta rotina desliga os vencidos.
CREATE OR REPLACE FUNCTION public.ponto_links_desativar_vencidos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_n int;
BEGIN
  UPDATE public.ponto_links
     SET ativo = false, updated_at = now()
   WHERE ativo = true
     AND data_expiracao <= now();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ponto_links_desativar_vencidos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ponto_links_desativar_vencidos() TO authenticated, service_role;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('ponto-links-vencidos')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ponto-links-vencidos');
    PERFORM cron.schedule('ponto-links-vencidos', '17 3 * * *',
                          'SELECT public.ponto_links_desativar_vencidos();');
  ELSE
    RAISE NOTICE 'pg_cron ausente — chame ponto_links_desativar_vencidos() pela aplicação.';
  END IF;
END $cron$;


-- ── PONTO-252 — gestor aprovando o próprio ajuste ────────────────────
-- Nenhuma auto-aprovação foi encontrada entre 1.628 ajustes aprovados, mas
-- não há nada impedindo: pela API ou por SQL direto, passa. A regra vivia
-- só na tela.
--
-- Duas camadas: o CHECK pega a igualdade literal; a trigger pega o caso
-- real, em que o aprovador é um usuário de autenticação e o ajuste aponta
-- para o colaborador — identificadores diferentes da mesma pessoa.

ALTER TABLE public.ponto_ajustes
  DROP CONSTRAINT IF EXISTS chk_ajuste_sem_autoaprovacao;
ALTER TABLE public.ponto_ajustes
  ADD CONSTRAINT chk_ajuste_sem_autoaprovacao
  CHECK (aprovado_por IS NULL OR aprovado_por::text <> colaborador_id::text);

CREATE OR REPLACE FUNCTION public.ponto_ajuste_bloqueia_autoaprovacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cpf_aprovador text;
  v_id_aprovador uuid;
BEGIN
  IF NEW.aprovado_por IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.aprovado_por IS NOT DISTINCT FROM OLD.aprovado_por THEN
    RETURN NEW;
  END IF;

  SELECT ub.id, regexp_replace(COALESCE(ub.cpf, ''), '[^0-9]', '', 'g')
    INTO v_id_aprovador, v_cpf_aprovador
  FROM public.usuarios_base ub
  WHERE ub.auth_user_id = NEW.aprovado_por
    AND ub.tenant_id = NEW.tenant_id
  LIMIT 1;

  IF v_id_aprovador IS NOT NULL
     AND v_id_aprovador::text = NEW.colaborador_id::text THEN
    RAISE EXCEPTION 'Ninguém aprova o próprio ajuste de ponto — a aprovação precisa de um segundo par de olhos.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF COALESCE(v_cpf_aprovador, '') <> ''
     AND v_cpf_aprovador = regexp_replace(COALESCE(NEW.colaborador_cpf, ''), '[^0-9]', '', 'g') THEN
    RAISE EXCEPTION 'Ninguém aprova o próprio ajuste de ponto — a aprovação precisa de um segundo par de olhos.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ponto_ajuste_autoaprovacao ON public.ponto_ajustes;
CREATE TRIGGER trg_ponto_ajuste_autoaprovacao
  BEFORE INSERT OR UPDATE OF aprovado_por, status ON public.ponto_ajustes
  FOR EACH ROW EXECUTE FUNCTION public.ponto_ajuste_bloqueia_autoaprovacao();


-- ── PONTO-253 — retenção da geolocalização (LGPD art. 16) ────────────
-- A marcação tem prazo de guarda próprio (art. 74 da CLT). A coordenada,
-- não: a finalidade dela se esgota quando a marcação é conferida. Guardar
-- tudo indefinidamente trata dois prazos distintos como um só.
--
-- Pré-condição verificada antes de escrever isto: gerar_hash_marcacao()
-- monta o hash com cpf + data + hora + tipo + created_at. Latitude e
-- longitude NÃO entram — expurgá-las não quebra a cadeia de integridade da
-- batida. Essa verificação era o alerta do próprio chamado.

CREATE TABLE IF NOT EXISTS public.ponto_retencao_config (
  tenant_id uuid PRIMARY KEY,
  geolocalizacao_dias integer NOT NULL DEFAULT 180
    CHECK (geolocalizacao_dias BETWEEN 30 AND 1825),
  ativo boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.ponto_retencao_config TO authenticated;
GRANT ALL ON public.ponto_retencao_config TO service_role;
ALTER TABLE public.ponto_retencao_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant gerencia ponto_retencao_config" ON public.ponto_retencao_config;
CREATE POLICY "Tenant gerencia ponto_retencao_config" ON public.ponto_retencao_config
  FOR ALL TO authenticated
  USING (tenant_id = public.current_user_tenant_id())
  WITH CHECK (tenant_id = public.current_user_tenant_id());

-- Registro do expurgo: o art. 37 da LGPD exige poder demonstrar o que foi
-- feito. Apagar sem registrar é trocar um problema por outro.
CREATE TABLE IF NOT EXISTS public.ponto_expurgo_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  executado_em timestamptz NOT NULL DEFAULT now(),
  criterio text NOT NULL,
  corte date NOT NULL,
  marcacoes_afetadas integer NOT NULL
);

GRANT SELECT ON public.ponto_expurgo_eventos TO authenticated;
GRANT ALL ON public.ponto_expurgo_eventos TO service_role;
ALTER TABLE public.ponto_expurgo_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant le ponto_expurgo_eventos" ON public.ponto_expurgo_eventos;
CREATE POLICY "Tenant le ponto_expurgo_eventos" ON public.ponto_expurgo_eventos
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_user_tenant_id());

-- Apaga SOMENTE latitude/longitude/endereço. A marcação em si permanece —
-- ela tem base legal própria e prazo de guarda maior.
CREATE OR REPLACE FUNCTION public.ponto_expurgar_geolocalizacao(p_tenant_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  v_corte date;
  v_n int;
  v_total int := 0;
  v_tenants int := 0;
BEGIN
  FOR r IN
    SELECT c.tenant_id, c.geolocalizacao_dias
    FROM public.ponto_retencao_config c
    WHERE c.ativo = true
      AND (p_tenant_id IS NULL OR c.tenant_id = p_tenant_id)
  LOOP
    v_corte := (CURRENT_DATE - r.geolocalizacao_dias)::date;

    UPDATE public.ponto_marcacoes m
       SET latitude = NULL, longitude = NULL,
           endereco_geolocalizacao = NULL,
           distancia_metros = NULL
     WHERE m.tenant_id = r.tenant_id
       AND m.data_marcacao < v_corte
       AND (m.latitude IS NOT NULL OR m.longitude IS NOT NULL
            OR m.endereco_geolocalizacao IS NOT NULL);
    GET DIAGNOSTICS v_n = ROW_COUNT;

    IF v_n > 0 THEN
      INSERT INTO public.ponto_expurgo_eventos (tenant_id, criterio, corte, marcacoes_afetadas)
      VALUES (r.tenant_id,
              format('geolocalizacao apos %s dias (LGPD art. 16)', r.geolocalizacao_dias),
              v_corte, v_n);
    END IF;

    v_total := v_total + v_n;
    v_tenants := v_tenants + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'tenants', v_tenants, 'marcacoes_anonimizadas', v_total);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ponto_expurgar_geolocalizacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ponto_expurgar_geolocalizacao(uuid) TO authenticated, service_role;

-- Todo tenant que já usa ponto nasce com prazo configurado. Sem isto a
-- rotina não teria em quem agir e o parâmetro seguiria "NENHUM".
INSERT INTO public.ponto_retencao_config (tenant_id)
SELECT DISTINCT m.tenant_id FROM public.ponto_marcacoes m
ON CONFLICT (tenant_id) DO NOTHING;

DO $cron2$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('ponto-expurgo-geo')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ponto-expurgo-geo');
    PERFORM cron.schedule('ponto-expurgo-geo', '41 4 * * 0',
                          'SELECT public.ponto_expurgar_geolocalizacao();');
  ELSE
    RAISE NOTICE 'pg_cron ausente — chame ponto_expurgar_geolocalizacao() pela aplicação.';
  END IF;
END $cron2$;


-- ── PONTO-270 — três tabelas fora do cercado de QA ───────────────────
-- A trava é a segunda linha de defesa: impede fisicamente que uma rotina
-- de teste rodada fora do funil escreva em tenant real. Três tabelas do
-- módulo de ponto nasceram sem ela — duas delas criadas nas correções
-- recentes de equalização e excedente.
DO $cercas$
DECLARE
  t text;
  v_n int := 0;
BEGIN
  IF to_regprocedure('public.qa_bloqueia_fora_do_cercado()') IS NULL THEN
    RAISE NOTICE 'PONTO-270: qa_bloqueia_fora_do_cercado() ausente — nada a instalar.';
    RETURN;
  END IF;

  FOREACH t IN ARRAY ARRAY[
    'ponto_equalizacao_mensal',
    'ponto_excedente_decisao',
    'ponto_saldo_fix_intervalo_snapshot'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS qa_guarda_cercado ON public.%I', t);
      EXECUTE format(
        'CREATE TRIGGER qa_guarda_cercado
           BEFORE INSERT OR UPDATE OR DELETE ON public.%I
           FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_fora_do_cercado()', t);

      IF to_regclass('public.qa_tabelas_protegidas') IS NOT NULL THEN
        EXECUTE format(
          'INSERT INTO public.qa_tabelas_protegidas (tabela, motivo)
           VALUES (%L, %L) ON CONFLICT (tabela) DO NOTHING',
          t, 'Trava adicionada em ago/2026 — PONTO-270.');
      END IF;

      v_n := v_n + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'PONTO-270: trava instalada em % tabela(s).', v_n;
END $cercas$;
