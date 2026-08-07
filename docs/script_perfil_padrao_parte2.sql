-- =====================================================================
-- Perfil padrão "Colaborador" — PARTE 2 de 2
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
-- CONFERÊNCIA — rode junto com a parte 2
-- =====================================================================

-- Função e os DOIS gatilhos no lugar? Esperado: true e 2 linhas.
SELECT to_regprocedure('public.perfil_padrao_colaborador(uuid)') IS NOT NULL AS funcao_ok;
SELECT tgname, tgrelid::regclass AS tabela
FROM pg_trigger
WHERE tgname IN ('trigger_vincular_perfil_padrao', 'trigger_substituir_perfil_padrao');

-- QUEM ESTÁ NO LIMBO HOJE (usuários antigos, sem nenhum perfil).
-- A regra nova vale só para cadastros novos — estes continuam como
-- estão. A lista é para o RH decidir caso a caso.
SELECT ub.tenant_id, ub.cpf, ub.tipo_usuario
FROM public.usuarios_base ub
WHERE COALESCE(ub.status::text, 'ativo') = 'ativo'
  AND COALESCE(ub.tipo_usuario::text, '') NOT IN ('administrador', 'gestor')
  AND NOT EXISTS (
    SELECT 1 FROM public.usuario_perfil_vinculos v
    WHERE v.usuario_id = ub.id AND COALESCE(v.ativo, true) = true
  )
ORDER BY ub.tenant_id, ub.cpf;
