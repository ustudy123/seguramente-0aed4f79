-- =====================================================================
-- Usuário criado sem perfil recebe o perfil padrão "Colaborador"
--
-- Recomendação nº 2 do parecer de perfis de acesso, na alternativa
-- escolhida pelo produto: perfil mínimo automático.
--
-- O problema: o cadastro permite criar usuário sem vincular perfil de
-- acesso. Nada avisa. A pessoa recebe o convite, entra e encontra o
-- sistema vazio — e, desde a camada de RLS por perfil, o banco também
-- só entrega a ela os próprios dados. Vira chamado.
--
-- A solução: todo usuário criado SEM perfil ganha automaticamente o
-- perfil "Colaborador (padrão)" do seu cliente — auto-serviço puro,
-- tudo em escopo proprio_usuario: meu perfil, meu ponto, meus
-- atestados, meus holerites, bem-estar, trilhas, PDI e feedback.
-- Como o escopo é proprio_usuario, as telas administrativas
-- (listagens, gestão) continuam bloqueadas pela regra que já existe
-- na interface (ADMIN_PATHS) e no banco (perfil_permite_modulo).
--
-- Três cuidados de desenho:
--   · o vínculo automático NÃO é principal: se depois o RH vincular um
--     perfil de verdade, o principal vence na resolução da interface;
--   · quando um perfil de verdade é vinculado, o automático é
--     desativado — a pessoa fica só com o escolhido;
--   · usuários de tipo administrador/gestor não recebem o automático:
--     eles operam pela hierarquia de papéis, e um perfil restrito
--     vinculado sem querer PODERIA reduzir o acesso deles.
--
-- Nenhum usuário existente é alterado: a regra vale para cadastros
-- novos. Colocar perfil em quem hoje não tem mudaria o modo de
-- navegação dessas pessoas (de hierarquia de papéis para perfil), e
-- isso merece decisão à parte — o script de entrega traz a consulta
-- que lista quem está nessa situação.
-- =====================================================================

-- 1) O PERFIL PADRÃO DO CLIENTE ---------------------------------------
-- Devolve o id; cria na primeira vez. Idempotente por (tenant, nome).
CREATE OR REPLACE FUNCTION public.perfil_padrao_colaborador(p_tenant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  m text;
BEGIN
  IF p_tenant_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_id
  FROM public.perfis_acesso
  WHERE tenant_id = p_tenant_id
    AND nome = 'Colaborador (padrão)'
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.perfis_acesso
    (tenant_id, nome, descricao, tipo, ativo, permite_acumulo, cor, icone, criado_por_nome)
  VALUES
    (p_tenant_id,
     'Colaborador (padrão)',
     'Perfil mínimo de auto-serviço, aplicado automaticamente a usuários criados sem perfil. A pessoa vê apenas os próprios dados: perfil, ponto, atestados, holerites, bem-estar, trilhas, PDI e feedback.',
     'padrao_sistema',
     true,
     true,
     '#64748B',
     'user',
     'Sistema (perfil padrão)')
  RETURNING id INTO v_id;

  -- Permissões de auto-serviço: sempre escopo proprio_usuario. As telas
  -- de gestão exigem escopo amplo e continuam fechadas.
  FOREACH m IN ARRAY ARRAY[
    'colaboradores',  -- meu perfil e meu ponto
    'atestados',      -- meus atestados
    'financeiro',     -- meus holerites
    'bem_estar',
    'trilhas',
    'pdi',
    'feedback'
  ] LOOP
    INSERT INTO public.perfil_permissoes
      (perfil_id, tenant_id, modulo, recurso, acao, escopo, ativo, observacao)
    VALUES
      (v_id, p_tenant_id, m, 'geral', 'visualizar', 'proprio_usuario', true,
       'Auto-serviço do perfil padrão');
  END LOOP;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.perfil_padrao_colaborador(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.perfil_padrao_colaborador(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.perfil_padrao_colaborador(uuid) IS
  'Devolve (criando na primeira vez) o perfil mínimo de auto-serviço do cliente, usado quando um usuário é cadastrado sem perfil de acesso.';

-- 2) CADASTRO NOVO SEM PERFIL GANHA O PADRÃO ---------------------------
CREATE OR REPLACE FUNCTION public.trg_vincular_perfil_padrao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_perfil uuid;
BEGIN
  -- Administrador/gestor navega pela hierarquia de papéis; um perfil
  -- restrito vinculado sem querer poderia REDUZIR o acesso deles.
  IF COALESCE(NEW.tipo_usuario::text, 'colaborador') IN ('administrador', 'gestor') THEN
    RETURN NEW;
  END IF;

  v_perfil := public.perfil_padrao_colaborador(NEW.tenant_id);
  IF v_perfil IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.usuario_perfil_vinculos
    (tenant_id, usuario_id, perfil_id, ativo, is_perfil_principal,
     atribuido_por_nome, observacao)
  VALUES
    (NEW.tenant_id, NEW.id, v_perfil, true, false,
     'Sistema (perfil padrão)',
     'Vínculo automático: usuário criado sem perfil de acesso. Substituído automaticamente quando um perfil for atribuído.');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- O cadastro do usuário nunca pode falhar por causa do perfil padrão.
  RAISE NOTICE 'perfil padrão não vinculado para %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_vincular_perfil_padrao ON public.usuarios_base;
CREATE TRIGGER trigger_vincular_perfil_padrao
AFTER INSERT ON public.usuarios_base
FOR EACH ROW EXECUTE FUNCTION public.trg_vincular_perfil_padrao();

-- 3) PERFIL DE VERDADE SUBSTITUI O AUTOMÁTICO --------------------------
-- Quando alguém vincula um perfil escolhido, o vínculo automático do
-- padrão é desativado: a pessoa fica exatamente com o que o RH decidiu.
CREATE OR REPLACE FUNCTION public.trg_substituir_perfil_padrao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_padrao uuid;
BEGIN
  IF COALESCE(NEW.ativo, true) = false THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_padrao
  FROM public.perfis_acesso
  WHERE tenant_id = NEW.tenant_id
    AND nome = 'Colaborador (padrão)'
  LIMIT 1;

  IF v_padrao IS NULL OR NEW.perfil_id = v_padrao THEN
    RETURN NEW;
  END IF;

  UPDATE public.usuario_perfil_vinculos v
  SET ativo = false,
      observacao = COALESCE(v.observacao, '')
        || ' [desativado automaticamente: perfil escolhido vinculado em '
        || to_char(now(), 'DD/MM/YYYY') || ']'
  WHERE v.tenant_id = NEW.tenant_id
    AND v.usuario_id = NEW.usuario_id
    AND v.perfil_id = v_padrao
    AND v.id <> NEW.id
    AND COALESCE(v.ativo, true) = true;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'substituição do perfil padrão falhou para %: %', NEW.usuario_id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_substituir_perfil_padrao ON public.usuario_perfil_vinculos;
CREATE TRIGGER trigger_substituir_perfil_padrao
AFTER INSERT ON public.usuario_perfil_vinculos
FOR EACH ROW EXECUTE FUNCTION public.trg_substituir_perfil_padrao();


-- =====================================================================
-- CONFERÊNCIA — rode junto
-- =====================================================================

-- 1) Função e gatilhos no lugar? Esperado: true, e 2 linhas de trigger.
SELECT to_regprocedure('public.perfil_padrao_colaborador(uuid)') IS NOT NULL AS funcao_ok;
SELECT tgname, tgrelid::regclass AS tabela
FROM pg_trigger
WHERE tgname IN ('trigger_vincular_perfil_padrao', 'trigger_substituir_perfil_padrao');

-- 2) QUEM ESTÁ NO LIMBO HOJE (usuários antigos, sem nenhum perfil).
--    A regra nova vale só para cadastros novos — estes continuam como
--    estão. A lista é para o RH decidir caso a caso.
SELECT ub.tenant_id, ub.cpf, ub.tipo_usuario, ub.created_at::date AS criado_em
FROM public.usuarios_base ub
WHERE COALESCE(ub.status::text, 'ativo') = 'ativo'
  AND COALESCE(ub.tipo_usuario::text, '') NOT IN ('administrador', 'gestor')
  AND NOT EXISTS (
    SELECT 1 FROM public.usuario_perfil_vinculos v
    WHERE v.usuario_id = ub.id AND COALESCE(v.ativo, true) = true
  )
ORDER BY ub.created_at DESC;

-- 3) OPCIONAL — aplicar o padrão também aos usuários da lista acima.
--    Descomente e rode SÓ se decidir que os antigos também devem
--    receber o perfil mínimo. Atenção: para quem hoje navega pela
--    hierarquia de papéis, isso muda a navegação para o modo perfil
--    (só auto-serviço).
-- INSERT INTO public.usuario_perfil_vinculos
--   (tenant_id, usuario_id, perfil_id, ativo, is_perfil_principal, atribuido_por_nome, observacao)
-- SELECT ub.tenant_id, ub.id, public.perfil_padrao_colaborador(ub.tenant_id),
--        true, false, 'Sistema (perfil padrão)', 'Aplicado retroativamente por decisão do RH'
-- FROM public.usuarios_base ub
-- WHERE COALESCE(ub.status::text, 'ativo') = 'ativo'
--   AND COALESCE(ub.tipo_usuario::text, '') NOT IN ('administrador', 'gestor')
--   AND NOT EXISTS (
--     SELECT 1 FROM public.usuario_perfil_vinculos v
--     WHERE v.usuario_id = ub.id AND COALESCE(v.ativo, true) = true
--   );
