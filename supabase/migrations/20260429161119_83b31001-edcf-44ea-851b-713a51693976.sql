
-- ============================================================
-- 1. Função que gera/completa a estrutura padrão de pastas
-- ============================================================
CREATE OR REPLACE FUNCTION public.gerar_estrutura_padrao_pastas(
  p_tenant_id uuid,
  p_empresa_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_user_nome text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_criadas integer := 0;
  v_root_id uuid;
  v_cat_id uuid;
  v_user_id uuid := COALESCE(p_user_id, gen_random_uuid());
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM empresa_cadastro WHERE id = p_empresa_id AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Empresa % não pertence ao tenant %', p_empresa_id, p_tenant_id;
  END IF;

  -- ROOT: Governança e Administração
  SELECT id INTO v_root_id FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id IS NULL AND nome='Governança e Administração';
  IF v_root_id IS NULL THEN
    INSERT INTO documento_pastas (nome,tipo,ordem,icone,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('Governança e Administração','root',0,'Scale',NULL,p_tenant_id,p_empresa_id,v_user_id,p_user_nome) RETURNING id INTO v_root_id; v_criadas:=v_criadas+1;
  END IF;
  PERFORM 1 FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id=v_root_id AND nome='Contrato Social e Estatuto';
  IF NOT FOUND THEN INSERT INTO documento_pastas (nome,tipo,ordem,icone,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('Contrato Social e Estatuto','categoria',0,'Building2',v_root_id,p_tenant_id,p_empresa_id,v_user_id,p_user_nome); v_criadas:=v_criadas+1; END IF;
  PERFORM 1 FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id=v_root_id AND nome='Políticas e Diretrizes';
  IF NOT FOUND THEN INSERT INTO documento_pastas (nome,tipo,ordem,icone,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('Políticas e Diretrizes','categoria',1,'Target',v_root_id,p_tenant_id,p_empresa_id,v_user_id,p_user_nome); v_criadas:=v_criadas+1; END IF;
  PERFORM 1 FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id=v_root_id AND nome='Licenças e Autorizações';
  IF NOT FOUND THEN INSERT INTO documento_pastas (nome,tipo,ordem,icone,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('Licenças e Autorizações','categoria',2,'FileCheck',v_root_id,p_tenant_id,p_empresa_id,v_user_id,p_user_nome); v_criadas:=v_criadas+1; END IF;
  PERFORM 1 FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id=v_root_id AND nome='Certidões';
  IF NOT FOUND THEN INSERT INTO documento_pastas (nome,tipo,ordem,icone,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('Certidões','categoria',3,'Award',v_root_id,p_tenant_id,p_empresa_id,v_user_id,p_user_nome); v_criadas:=v_criadas+1; END IF;
  PERFORM 1 FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id=v_root_id AND nome='Registros em Conselhos';
  IF NOT FOUND THEN INSERT INTO documento_pastas (nome,tipo,ordem,icone,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('Registros em Conselhos','categoria',4,'Shield',v_root_id,p_tenant_id,p_empresa_id,v_user_id,p_user_nome); v_criadas:=v_criadas+1; END IF;

  -- ROOT: Sistema de Gestão
  SELECT id INTO v_root_id FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id IS NULL AND nome='Sistema de Gestão';
  IF v_root_id IS NULL THEN
    INSERT INTO documento_pastas (nome,tipo,ordem,icone,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('Sistema de Gestão','root',1,'BookOpen',NULL,p_tenant_id,p_empresa_id,v_user_id,p_user_nome) RETURNING id INTO v_root_id; v_criadas:=v_criadas+1;
  END IF;
  PERFORM 1 FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id=v_root_id AND nome='Procedimentos e Instruções de Trabalho';
  IF NOT FOUND THEN INSERT INTO documento_pastas (nome,tipo,ordem,icone,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('Procedimentos e Instruções de Trabalho','categoria',0,'FileText',v_root_id,p_tenant_id,p_empresa_id,v_user_id,p_user_nome); v_criadas:=v_criadas+1; END IF;
  PERFORM 1 FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id=v_root_id AND nome='Registros da Qualidade';
  IF NOT FOUND THEN INSERT INTO documento_pastas (nome,tipo,ordem,icone,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('Registros da Qualidade','categoria',1,'CheckSquare',v_root_id,p_tenant_id,p_empresa_id,v_user_id,p_user_nome); v_criadas:=v_criadas+1; END IF;

  -- ROOT: Gestão de Riscos
  SELECT id INTO v_root_id FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id IS NULL AND nome='Gestão de Riscos';
  IF v_root_id IS NULL THEN
    INSERT INTO documento_pastas (nome,tipo,ordem,icone,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('Gestão de Riscos','root',2,'AlertTriangle',NULL,p_tenant_id,p_empresa_id,v_user_id,p_user_nome) RETURNING id INTO v_root_id; v_criadas:=v_criadas+1;
  END IF;
  PERFORM 1 FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id=v_root_id AND nome='Inventário de Riscos';
  IF NOT FOUND THEN INSERT INTO documento_pastas (nome,tipo,ordem,icone,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('Inventário de Riscos','categoria',0,'List',v_root_id,p_tenant_id,p_empresa_id,v_user_id,p_user_nome); v_criadas:=v_criadas+1; END IF;
  PERFORM 1 FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id=v_root_id AND nome='Análise de Riscos (APR / HAZOP)';
  IF NOT FOUND THEN INSERT INTO documento_pastas (nome,tipo,ordem,icone,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('Análise de Riscos (APR / HAZOP)','categoria',1,'Search',v_root_id,p_tenant_id,p_empresa_id,v_user_id,p_user_nome); v_criadas:=v_criadas+1; END IF;
  PERFORM 1 FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id=v_root_id AND nome='Planos de Emergência';
  IF NOT FOUND THEN INSERT INTO documento_pastas (nome,tipo,ordem,icone,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('Planos de Emergência','categoria',2,'ShieldAlert',v_root_id,p_tenant_id,p_empresa_id,v_user_id,p_user_nome); v_criadas:=v_criadas+1; END IF;

  -- ROOT: SST
  SELECT id INTO v_root_id FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id IS NULL AND nome='SST';
  IF v_root_id IS NULL THEN
    INSERT INTO documento_pastas (nome,tipo,ordem,icone,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('SST','root',3,'Shield',NULL,p_tenant_id,p_empresa_id,v_user_id,p_user_nome) RETURNING id INTO v_root_id; v_criadas:=v_criadas+1;
  END IF;
  -- SST > Programas Legais
  SELECT id INTO v_cat_id FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id=v_root_id AND nome='Programas Legais';
  IF v_cat_id IS NULL THEN INSERT INTO documento_pastas (nome,tipo,ordem,icone,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('Programas Legais','categoria',0,'FileCheck',v_root_id,p_tenant_id,p_empresa_id,v_user_id,p_user_nome) RETURNING id INTO v_cat_id; v_criadas:=v_criadas+1; END IF;
  PERFORM 1 FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id=v_cat_id AND nome='PGR';
  IF NOT FOUND THEN INSERT INTO documento_pastas (nome,tipo,ordem,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('PGR','custom',0,v_cat_id,p_tenant_id,p_empresa_id,v_user_id,p_user_nome); v_criadas:=v_criadas+1; END IF;
  PERFORM 1 FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id=v_cat_id AND nome='PCMSO';
  IF NOT FOUND THEN INSERT INTO documento_pastas (nome,tipo,ordem,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('PCMSO','custom',1,v_cat_id,p_tenant_id,p_empresa_id,v_user_id,p_user_nome); v_criadas:=v_criadas+1; END IF;
  PERFORM 1 FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id=v_cat_id AND nome='LTCAT';
  IF NOT FOUND THEN INSERT INTO documento_pastas (nome,tipo,ordem,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('LTCAT','custom',2,v_cat_id,p_tenant_id,p_empresa_id,v_user_id,p_user_nome); v_criadas:=v_criadas+1; END IF;
  -- SST > Treinamentos
  SELECT id INTO v_cat_id FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id=v_root_id AND nome='Treinamentos';
  IF v_cat_id IS NULL THEN INSERT INTO documento_pastas (nome,tipo,ordem,icone,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('Treinamentos','categoria',1,'GraduationCap',v_root_id,p_tenant_id,p_empresa_id,v_user_id,p_user_nome) RETURNING id INTO v_cat_id; v_criadas:=v_criadas+1; END IF;
  PERFORM 1 FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id=v_cat_id AND nome='NR-01 — Disposições Gerais e Gerenciamento de Riscos';
  IF NOT FOUND THEN INSERT INTO documento_pastas (nome,tipo,ordem,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('NR-01 — Disposições Gerais e Gerenciamento de Riscos','custom',0,v_cat_id,p_tenant_id,p_empresa_id,v_user_id,p_user_nome); v_criadas:=v_criadas+1; END IF;
  PERFORM 1 FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id=v_cat_id AND nome='NR-05 — CIPA';
  IF NOT FOUND THEN INSERT INTO documento_pastas (nome,tipo,ordem,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('NR-05 — CIPA','custom',1,v_cat_id,p_tenant_id,p_empresa_id,v_user_id,p_user_nome); v_criadas:=v_criadas+1; END IF;
  PERFORM 1 FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id=v_cat_id AND nome='NR-06 — EPIs';
  IF NOT FOUND THEN INSERT INTO documento_pastas (nome,tipo,ordem,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('NR-06 — EPIs','custom',2,v_cat_id,p_tenant_id,p_empresa_id,v_user_id,p_user_nome); v_criadas:=v_criadas+1; END IF;
  -- SST > Registros e Evidências
  SELECT id INTO v_cat_id FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id=v_root_id AND nome='Registros e Evidências';
  IF v_cat_id IS NULL THEN INSERT INTO documento_pastas (nome,tipo,ordem,icone,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('Registros e Evidências','categoria',2,'ClipboardList',v_root_id,p_tenant_id,p_empresa_id,v_user_id,p_user_nome) RETURNING id INTO v_cat_id; v_criadas:=v_criadas+1; END IF;
  PERFORM 1 FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id=v_cat_id AND nome='CAT — Comunicação de Acidente';
  IF NOT FOUND THEN INSERT INTO documento_pastas (nome,tipo,ordem,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('CAT — Comunicação de Acidente','custom',0,v_cat_id,p_tenant_id,p_empresa_id,v_user_id,p_user_nome); v_criadas:=v_criadas+1; END IF;
  PERFORM 1 FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id=v_cat_id AND nome='Inspeções de Segurança';
  IF NOT FOUND THEN INSERT INTO documento_pastas (nome,tipo,ordem,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('Inspeções de Segurança','custom',1,v_cat_id,p_tenant_id,p_empresa_id,v_user_id,p_user_nome); v_criadas:=v_criadas+1; END IF;
  PERFORM 1 FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id=v_cat_id AND nome='Permissões de Trabalho';
  IF NOT FOUND THEN INSERT INTO documento_pastas (nome,tipo,ordem,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('Permissões de Trabalho','custom',2,v_cat_id,p_tenant_id,p_empresa_id,v_user_id,p_user_nome); v_criadas:=v_criadas+1; END IF;

  -- ROOT: Gestão de Pessoas
  PERFORM 1 FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id IS NULL AND nome='Gestão de Pessoas';
  IF NOT FOUND THEN INSERT INTO documento_pastas (nome,tipo,ordem,icone,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('Gestão de Pessoas','root',5,'Users',NULL,p_tenant_id,p_empresa_id,v_user_id,p_user_nome); v_criadas:=v_criadas+1; END IF;

  -- ROOT: Investigação de Incidentes
  SELECT id INTO v_root_id FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id IS NULL AND nome='Investigação de Incidentes';
  IF v_root_id IS NULL THEN
    INSERT INTO documento_pastas (nome,tipo,ordem,icone,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('Investigação de Incidentes','root',6,'SearchX',NULL,p_tenant_id,p_empresa_id,v_user_id,p_user_nome) RETURNING id INTO v_root_id; v_criadas:=v_criadas+1;
  END IF;
  PERFORM 1 FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id=v_root_id AND nome='Acidentes de Trabalho';
  IF NOT FOUND THEN INSERT INTO documento_pastas (nome,tipo,ordem,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('Acidentes de Trabalho','categoria',0,v_root_id,p_tenant_id,p_empresa_id,v_user_id,p_user_nome); v_criadas:=v_criadas+1; END IF;
  PERFORM 1 FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id=v_root_id AND nome='Quase Acidentes';
  IF NOT FOUND THEN INSERT INTO documento_pastas (nome,tipo,ordem,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('Quase Acidentes','categoria',1,v_root_id,p_tenant_id,p_empresa_id,v_user_id,p_user_nome); v_criadas:=v_criadas+1; END IF;
  PERFORM 1 FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id=v_root_id AND nome='Não Conformidades';
  IF NOT FOUND THEN INSERT INTO documento_pastas (nome,tipo,ordem,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('Não Conformidades','categoria',2,v_root_id,p_tenant_id,p_empresa_id,v_user_id,p_user_nome); v_criadas:=v_criadas+1; END IF;

  -- ROOT: Auditorias e Melhoria Contínua
  SELECT id INTO v_root_id FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id IS NULL AND nome='Auditorias e Melhoria Contínua';
  IF v_root_id IS NULL THEN
    INSERT INTO documento_pastas (nome,tipo,ordem,icone,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('Auditorias e Melhoria Contínua','root',7,'CheckSquare',NULL,p_tenant_id,p_empresa_id,v_user_id,p_user_nome) RETURNING id INTO v_root_id; v_criadas:=v_criadas+1;
  END IF;
  PERFORM 1 FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id=v_root_id AND nome='Auditorias Internas';
  IF NOT FOUND THEN INSERT INTO documento_pastas (nome,tipo,ordem,icone,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('Auditorias Internas','categoria',0,'ClipboardCheck',v_root_id,p_tenant_id,p_empresa_id,v_user_id,p_user_nome); v_criadas:=v_criadas+1; END IF;
  PERFORM 1 FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id=v_root_id AND nome='Auditorias Externas e Certificações';
  IF NOT FOUND THEN INSERT INTO documento_pastas (nome,tipo,ordem,icone,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('Auditorias Externas e Certificações','categoria',1,'Award',v_root_id,p_tenant_id,p_empresa_id,v_user_id,p_user_nome); v_criadas:=v_criadas+1; END IF;
  PERFORM 1 FROM documento_pastas WHERE tenant_id=p_tenant_id AND empresa_id=p_empresa_id AND pasta_pai_id=v_root_id AND nome='Ações Corretivas e Preventivas';
  IF NOT FOUND THEN INSERT INTO documento_pastas (nome,tipo,ordem,icone,pasta_pai_id,tenant_id,empresa_id,criado_por,criado_por_nome) VALUES ('Ações Corretivas e Preventivas','categoria',2,'RefreshCw',v_root_id,p_tenant_id,p_empresa_id,v_user_id,p_user_nome); v_criadas:=v_criadas+1; END IF;

  RETURN v_criadas;
END;
$$;

-- ============================================================
-- 2. Trigger AFTER INSERT em empresa_cadastro
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_auto_gerar_pastas_empresa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.gerar_estrutura_padrao_pastas(NEW.tenant_id, NEW.id, auth.uid(), NULL);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Falha ao gerar pastas para empresa %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_gerar_pastas_empresa ON public.empresa_cadastro;
CREATE TRIGGER auto_gerar_pastas_empresa
  AFTER INSERT ON public.empresa_cadastro
  FOR EACH ROW EXECUTE FUNCTION public.trg_auto_gerar_pastas_empresa();

-- ============================================================
-- 3. Função de reconciliação
-- ============================================================
CREATE OR REPLACE FUNCTION public.reconciliar_pastas_todas_empresas()
RETURNS TABLE(out_empresa_id uuid, out_razao_social text, out_pastas_criadas integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec RECORD;
  v_criadas integer;
BEGIN
  FOR rec IN SELECT ec.id AS eid, ec.tenant_id AS tid, ec.razao_social AS rs FROM public.empresa_cadastro ec
  LOOP
    v_criadas := public.gerar_estrutura_padrao_pastas(rec.tid, rec.eid, NULL, 'Reconciliação automática');
    out_empresa_id := rec.eid;
    out_razao_social := rec.rs;
    out_pastas_criadas := v_criadas;
    RETURN NEXT;
  END LOOP;
  RETURN;
END;
$$;

-- ============================================================
-- 4. Executar reconciliação agora
-- ============================================================
SELECT count(*) FILTER (WHERE out_pastas_criadas > 0) AS empresas_regularizadas,
       sum(out_pastas_criadas) AS total_pastas_criadas
FROM public.reconciliar_pastas_todas_empresas();
