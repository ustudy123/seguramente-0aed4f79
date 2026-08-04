-- =====================================================================
-- QA ADM-101 / ADM-102 / ADM-103 — documento de admissão no limbo
--
-- O upload da admissão grava em public.documentos com
--   colaborador_id: null   -- "Colaborador ainda não tem profile"
-- e sem pasta_id. Enquanto a pessoa está em admissão isso é verdade. O
-- problema é que ninguém volta depois: concluída a admissão, a pessoa vira
-- colaborador, ganha registro em usuarios_base — e os documentos dela
-- continuam soltos. A tela agrupa por (colaborador_id || 'sem-colaborador'),
-- então caem todos no balde avulso e o RH arquiva à mão. É o retrabalho que
-- o arquivamento único deveria ter eliminado.
--
-- Medido em 03/08/2026: 24 de 215 documentos sem pasta e sem dono; 3 de
-- 10.057 admissões concluídas com documento ainda no limbo.
--
-- Três peças, nesta ordem:
--   1. resolver a pasta do colaborador (cria se faltar, igual ao front)
--   2. trigger em documentos: preenche dono e pasta no momento da escrita,
--      valha o caminho que valer (tela, importação, edge function, SQL)
--   3. reconciliação retroativa + gatilho na conclusão da admissão, para o
--      passivo e para quem foi admitido antes desta correção
-- =====================================================================

-- 1) PASTA DO COLABORADOR ---------------------------------------------
-- Espelha src/utils/criarPastaColaborador.ts: raiz "Gestão de Pessoas" →
-- pasta da pessoa → subpastas padrão. Idempotente: se já existe, devolve.
-- Devolve a subpasta "Admissão" quando p_subpasta é informada, porque é lá
-- que o documento de admissão pertence.
CREATE OR REPLACE FUNCTION public.documento_pasta_do_colaborador(
  p_tenant_id uuid,
  p_colaborador_id uuid,
  p_colaborador_nome text,
  p_colaborador_cpf text DEFAULT NULL,
  p_empresa_id uuid DEFAULT NULL,
  p_subpasta text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_raiz uuid;
  v_pasta uuid;
  v_sub uuid;
  v_nome text := COALESCE(NULLIF(btrim(p_colaborador_nome), ''), 'Colaborador');
  v_padrao text[] := ARRAY['Admissão', 'Vida Funcional', 'Saúde Ocupacional', 'Desligamento'];
  v_item text;
  v_i int := 0;
BEGIN
  IF p_tenant_id IS NULL OR p_colaborador_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_pasta
  FROM public.documento_pastas
  WHERE tenant_id = p_tenant_id
    AND colaborador_id = p_colaborador_id
    AND tipo = 'colaborador'
    AND empresa_id IS NOT DISTINCT FROM p_empresa_id
  LIMIT 1;

  IF v_pasta IS NULL THEN
    SELECT id INTO v_raiz
    FROM public.documento_pastas
    WHERE tenant_id = p_tenant_id
      AND nome = 'Gestão de Pessoas'
      AND empresa_id IS NOT DISTINCT FROM p_empresa_id
    LIMIT 1;

    IF v_raiz IS NULL THEN
      INSERT INTO public.documento_pastas (tenant_id, nome, tipo, ordem, icone, empresa_id)
      VALUES (p_tenant_id, 'Gestão de Pessoas', 'root', 5, 'Users', p_empresa_id)
      RETURNING id INTO v_raiz;
    END IF;

    INSERT INTO public.documento_pastas (
      tenant_id, nome, tipo, pasta_pai_id, colaborador_id, colaborador_cpf,
      colaborador_nome, ordem, icone, empresa_id
    ) VALUES (
      p_tenant_id, v_nome, 'colaborador', v_raiz, p_colaborador_id,
      NULLIF(regexp_replace(COALESCE(p_colaborador_cpf, ''), '[^0-9]', '', 'g'), ''),
      v_nome, 0, 'User', p_empresa_id
    )
    RETURNING id INTO v_pasta;
  END IF;

  -- Subpastas padrão (idempotente)
  FOREACH v_item IN ARRAY v_padrao LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.documento_pastas
      WHERE tenant_id = p_tenant_id AND pasta_pai_id = v_pasta AND nome = v_item
    ) THEN
      INSERT INTO public.documento_pastas (tenant_id, nome, tipo, pasta_pai_id, ordem, empresa_id)
      VALUES (p_tenant_id, v_item, 'categoria', v_pasta, v_i, p_empresa_id);
    END IF;
    v_i := v_i + 1;
  END LOOP;

  IF p_subpasta IS NULL THEN
    RETURN v_pasta;
  END IF;

  SELECT id INTO v_sub
  FROM public.documento_pastas
  WHERE tenant_id = p_tenant_id AND pasta_pai_id = v_pasta AND nome = p_subpasta
  LIMIT 1;

  RETURN COALESCE(v_sub, v_pasta);
END;
$$;

-- 2) NA ESCRITA: RESOLVE DONO E PASTA ---------------------------------
-- No banco, e não no hook, porque o documento entra por vários caminhos e
-- todos precisam da mesma regra. Nunca sobrescreve o que já veio preenchido.
CREATE OR REPLACE FUNCTION public.documento_resolver_dono_e_pasta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cpf text;
  v_nome text;
  v_emp uuid;
  v_sub text;
BEGIN
  v_cpf := NULLIF(regexp_replace(COALESCE(NEW.colaborador_cpf, ''), '[^0-9]', '', 'g'), '');

  -- Dono: resolve pelo CPF quando o registro da pessoa já existe.
  IF NEW.colaborador_id IS NULL AND v_cpf IS NOT NULL THEN
    SELECT ub.id, ub.nome_completo
      INTO NEW.colaborador_id, v_nome
    FROM public.usuarios_base ub
    WHERE ub.tenant_id = NEW.tenant_id
      AND regexp_replace(COALESCE(ub.cpf, ''), '[^0-9]', '', 'g') = v_cpf
      AND COALESCE(ub.status, 'ativo') <> 'excluido'
    ORDER BY (ub.tipo_usuario = 'colaborador') DESC, ub.created_at
    LIMIT 1;
  END IF;

  -- Pasta: só faz sentido quando há dono.
  IF NEW.pasta_id IS NULL AND NEW.colaborador_id IS NOT NULL THEN
    v_emp := NEW.empresa_id;
    v_sub := CASE WHEN NEW.observacoes = 'Documento da admissão' THEN 'Admissão' ELSE NULL END;

    NEW.pasta_id := public.documento_pasta_do_colaborador(
      NEW.tenant_id,
      NEW.colaborador_id,
      COALESCE(v_nome, NEW.colaborador_nome),
      v_cpf,
      v_emp,
      v_sub
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_documento_resolver_dono_e_pasta ON public.documentos;
CREATE TRIGGER trg_documento_resolver_dono_e_pasta
  BEFORE INSERT OR UPDATE OF colaborador_cpf, colaborador_id, pasta_id ON public.documentos
  FOR EACH ROW EXECUTE FUNCTION public.documento_resolver_dono_e_pasta();

-- 3) RECONCILIAÇÃO RETROATIVA -----------------------------------------
-- Para o passivo já acumulado e para quem concluiu a admissão antes desta
-- correção. p_tenant_id NULL varre todos os tenants (uso administrativo),
-- no espírito da reconciliar_pastas_todas_empresas() que já existe.
CREATE OR REPLACE FUNCTION public.reconciliar_documentos_colaborador(
  p_tenant_id uuid DEFAULT NULL,
  p_colaborador_cpf text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  v_pasta uuid;
  v_dono uuid;
  v_ajustados int := 0;
  v_sem_pessoa int := 0;
  v_cpf_filtro text := NULLIF(regexp_replace(COALESCE(p_colaborador_cpf, ''), '[^0-9]', '', 'g'), '');
BEGIN
  FOR r IN
    SELECT d.id, d.tenant_id, d.empresa_id, d.colaborador_id, d.colaborador_nome,
           d.observacoes,
           regexp_replace(COALESCE(d.colaborador_cpf, ''), '[^0-9]', '', 'g') AS cpf
    FROM public.documentos d
    WHERE (p_tenant_id IS NULL OR d.tenant_id = p_tenant_id)
      AND (d.colaborador_id IS NULL OR d.pasta_id IS NULL)
      AND COALESCE(d.colaborador_cpf, '') <> ''
      AND (v_cpf_filtro IS NULL
           OR regexp_replace(COALESCE(d.colaborador_cpf, ''), '[^0-9]', '', 'g') = v_cpf_filtro)
  LOOP
    v_dono := r.colaborador_id;

    IF v_dono IS NULL THEN
      SELECT ub.id INTO v_dono
      FROM public.usuarios_base ub
      WHERE ub.tenant_id = r.tenant_id
        AND regexp_replace(COALESCE(ub.cpf, ''), '[^0-9]', '', 'g') = r.cpf
        AND COALESCE(ub.status, 'ativo') <> 'excluido'
      ORDER BY (ub.tipo_usuario = 'colaborador') DESC, ub.created_at
      LIMIT 1;
    END IF;

    -- Pessoa ainda não existe como colaborador: admissão em curso, é
    -- legítimo o documento seguir sem dono. Conta e segue.
    IF v_dono IS NULL THEN
      v_sem_pessoa := v_sem_pessoa + 1;
      CONTINUE;
    END IF;

    v_pasta := public.documento_pasta_do_colaborador(
      r.tenant_id, v_dono, r.colaborador_nome, r.cpf, r.empresa_id,
      CASE WHEN r.observacoes = 'Documento da admissão' THEN 'Admissão' ELSE NULL END
    );

    UPDATE public.documentos
       SET colaborador_id = v_dono,
           pasta_id       = COALESCE(pasta_id, v_pasta)
     WHERE id = r.id;

    v_ajustados := v_ajustados + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'documentos_reconciliados', v_ajustados,
    'documentos_sem_pessoa_ainda', v_sem_pessoa
  );
END;
$$;

-- 4) GATILHO NA CONCLUSÃO DA ADMISSÃO ---------------------------------
-- Fecha o ciclo: concluída a admissão, os documentos daquela pessoa saem do
-- limbo sem depender de ninguém lembrar de rodar nada.
CREATE OR REPLACE FUNCTION public.admissao_reconciliar_documentos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'concluido'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'concluido')
     AND COALESCE(NEW.cpf, '') <> '' THEN
    PERFORM public.reconciliar_documentos_colaborador(NEW.tenant_id, NEW.cpf);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admissao_reconciliar_documentos ON public.admissoes;
CREATE TRIGGER trg_admissao_reconciliar_documentos
  AFTER INSERT OR UPDATE OF status ON public.admissoes
  FOR EACH ROW EXECUTE FUNCTION public.admissao_reconciliar_documentos();

REVOKE EXECUTE ON FUNCTION public.reconciliar_documentos_colaborador(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconciliar_documentos_colaborador(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.documento_pasta_do_colaborador(uuid, uuid, text, text, uuid, text) TO authenticated;

-- 5) PASSIVO EXISTENTE -------------------------------------------------
-- Roda uma vez, na aplicação desta migration, para os 24 documentos já
-- medidos. O que sobrar sem dono é admissão em curso — situação legítima.
DO $limpa$
DECLARE v_res jsonb;
BEGIN
  v_res := public.reconciliar_documentos_colaborador(NULL, NULL);
  RAISE NOTICE 'Reconciliação retroativa: %', v_res::text;
END $limpa$;
