import { useAuth } from "./useAuth";
import { usePerfilPermissions } from "./usePerfilPermissions";
import { useMemo } from "react";

/**
 * RF-13 – Permissões por perfil no módulo de EPIs
 *
 * As permissões agora são derivadas do perfil de acesso vinculado ao usuário.
 * O módulo no perfil é "epi" e as ações mapeiam para:
 *   visualizar, criar, editar, excluir, exportar, importar, aprovar,
 *   parametrizar, administrar, acessar_sensivel, etc.
 *
 * Fallback: se o usuário não tem perfil vinculado, usa a hierarquia de roles.
 */
export function useEpiPermissions() {
  const { hasMinimumRole, isSuperAdmin } = useAuth();
  const { temPermissao, perfilVinculado, isOwner } = usePerfilPermissions();

  return useMemo(() => {
    // Se tem perfil vinculado, usar permissões do perfil
    if (perfilVinculado) {
      const pode = (acao: string) => temPermissao("epi", acao);

      return {
        // Visualização
        podeVerEstoque: pode("visualizar"),
        podeVerEntregas: pode("visualizar"),
        podeVerHistorico: pode("visualizar"),
        podeVerAlertas: pode("visualizar"),
        podeVerSaldoLocal: pode("visualizar"),

        // Ações CRUD
        podeRegistrarEntrega: pode("criar"),
        podeRegistrarDevolucao: pode("criar"),
        podeCriarEpi: pode("criar"),
        podeEditarEpi: pode("editar"),
        podeExcluirEpi: pode("excluir"),
        podeCriarTipo: pode("criar"),
        podeMovimentarEstoque: pode("criar") || pode("administrar"),
        podeAjustarEstoque: pode("editar") || pode("administrar"),
        podeGerenciarMatriz: pode("administrar") || pode("parametrizar"),
        podeUsarIAFiscal: pode("administrar"),

        // Configuração
        podeConfigurar: pode("parametrizar") || pode("administrar") || isOwner,

        // Helpers
        isManager: pode("criar"),
        isAdmin: pode("administrar") || pode("editar"),
        isOwner,
      };
    }

    // Fallback: hierarquia de roles (sem perfil vinculado)
    const isManager = hasMinimumRole("manager");
    const isAdmin = hasMinimumRole("admin");
    const isOwnerRole = hasMinimumRole("owner") || isSuperAdmin;

    return {
      podeVerEstoque: true,
      podeVerEntregas: true,
      podeVerHistorico: true,
      podeVerAlertas: true,
      podeVerSaldoLocal: true,
      podeRegistrarEntrega: isManager,
      podeRegistrarDevolucao: isManager,
      podeCriarEpi: isAdmin,
      podeEditarEpi: isAdmin,
      podeExcluirEpi: isAdmin,
      podeCriarTipo: isAdmin,
      podeMovimentarEstoque: isAdmin,
      podeAjustarEstoque: isAdmin,
      podeGerenciarMatriz: isAdmin,
      podeUsarIAFiscal: isAdmin,
      podeConfigurar: isOwnerRole,
      isManager,
      isAdmin,
      isOwner: isOwnerRole,
    };
  }, [hasMinimumRole, isSuperAdmin, temPermissao, perfilVinculado, isOwner]);
}
