import { useAuth } from "./useAuth";
import { useMemo } from "react";

/**
 * RF-13 – Permissões por perfil no módulo de EPIs
 *
 * Hierarquia:
 *  - user:     visualizar estoque, entregas, histórico, alertas, saldo por local
 *  - manager:  + registrar entrega, devolução
 *  - admin:    + criar/editar/excluir EPIs e tipos, movimentar estoque (entrada/saída/transferência), ajustar estoque, matriz, IA fiscal
 *  - owner:    + configurações do módulo
 */
export function useEpiPermissions() {
  const { hasMinimumRole, isSuperAdmin } = useAuth();

  return useMemo(() => {
    const isManager = hasMinimumRole("manager");
    const isAdmin = hasMinimumRole("admin");
    const isOwner = hasMinimumRole("owner") || isSuperAdmin;

    return {
      // Visualização — todos os perfis autenticados
      podeVerEstoque: true,
      podeVerEntregas: true,
      podeVerHistorico: true,
      podeVerAlertas: true,
      podeVerSaldoLocal: true,

      // Manager+
      podeRegistrarEntrega: isManager,
      podeRegistrarDevolucao: isManager,

      // Admin+
      podeCriarEpi: isAdmin,
      podeEditarEpi: isAdmin,
      podeExcluirEpi: isAdmin,
      podeCriarTipo: isAdmin,
      podeMovimentarEstoque: isAdmin, // entradas, saídas, transferências
      podeAjustarEstoque: isAdmin,
      podeGerenciarMatriz: isAdmin,
      podeUsarIAFiscal: isAdmin,

      // Owner+
      podeConfigurar: isOwner,

      // Helpers
      isManager,
      isAdmin,
      isOwner,
    };
  }, [hasMinimumRole, isSuperAdmin]);
}
