-- =====================================================================
-- Perfil padrão "Colaborador" — PARTE 1 de 2
--
-- Por que em duas partes: criar gatilho exige trancar a tabela com
-- exclusividade. As duas tabelas na MESMA transação, com o sistema em
-- uso, disputam trava com as transações do próprio app — foi o
-- "deadlock detected" da primeira tentativa (que não aplicou nada:
-- deadlock desfaz a transação inteira).
--
-- Uma tabela por execução não tem com quem se abraçar. O lock_timeout
-- abaixo faz o comando desistir com erro limpo se a tabela estiver
-- ocupada — nesse caso, é só rodar de novo (tudo aqui é idempotente).
-- =====================================================================
SET lock_timeout = '10s';

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

