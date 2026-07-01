-- =====================================================================
-- Corrige: invalid input value for enum usuario_tipo: "proprietario"
-- =====================================================================
-- Várias funções de ponto verificam o papel do usuário com listas como
--   ub.tipo_usuario IN ('gestor','administrador','proprietario','rh','rh_dp')
-- onde `tipo_usuario` é a COLUNA do enum `usuario_tipo`. Ao avaliar o IN, o
-- Postgres tenta coagir cada literal ao enum; como 'proprietario' e 'rh' NÃO
-- são valores do enum, a avaliação falha com:
--   invalid input value for enum usuario_tipo: "proprietario"
--
-- Isso trava o ENVIO de ajuste de ponto (INSERT em ponto_ajustes → trigger de
-- consolidação grava em ponto_marcacoes/ponto_diario → triggers
-- validar_periodo_aberto_ponto*/ que rodam quando o período está FECHADO) e
-- também a APROVAÇÃO (processar_ajuste_ponto), para usuários "proprietário".
--
-- O papel 'proprietario' já é tratado como válido no front
-- (src/hooks/useUsuarioVinculos.ts: TIPOS_ACESSO_GLOBAL) e em ~10 funções SQL;
-- só faltou adicioná-lo ao enum. 'rh' é usado como sinônimo de RH nas mesmas
-- listas. Adicionamos ambos ao enum — resolve o erro em TODAS as funções de
-- uma vez, sem recriar nenhuma lógica crítica de ponto/abono/consolidação.
--
-- Idempotente (IF NOT EXISTS). Cada ADD VALUE em statement próprio: um valor
-- novo de enum não pode ser usado na mesma transação em que é criado — aqui
-- apenas adicionamos, não usamos, então rodar em sequência é seguro.
-- =====================================================================

ALTER TYPE public.usuario_tipo ADD VALUE IF NOT EXISTS 'proprietario';

ALTER TYPE public.usuario_tipo ADD VALUE IF NOT EXISTS 'rh';
