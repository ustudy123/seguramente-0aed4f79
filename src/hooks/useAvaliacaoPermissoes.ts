import { useAuth } from "./useAuth";

/**
 * Controle de permissões do módulo de Avaliação de Desempenho.
 * Baseado nos papéis do usuário (owner/admin = RH, manager = gestor, user = colaborador).
 */
export function useAvaliacaoPermissoes() {
  const { roles, hasMinimumRole } = useAuth();

  const isRH = hasMinimumRole("admin"); // admin + owner
  const isGestor = hasMinimumRole("manager"); // manager, admin, owner
  const isColaborador = hasMinimumRole("user");

  return {
    // Acesso às telas
    podeVerConfiguracoes: isRH,
    podeVerCiclos: isGestor,
    podeVerTemplates: isRH,
    podeVerResultados: isGestor,
    podeCriarCiclo: isRH,
    podeCriarTemplate: isRH,

    // Dentro da avaliação
    podeVerAlertas: isGestor,       // burnout/boreout/psicossocial
    podeVerErgonomia: isGestor,     // painel NR-17
    podeVerEvidencias: isGestor,    // feedbacks, ocorrências
    podeGerarPdi: isGestor,
    podeCriarAcao: isGestor,
    podeAtribuirTrilha: isGestor,

    // Resultados — dados sensíveis
    podeVerPsicossocialIdentificado: isRH,  // dados individuais identificados
    podeExportar: isGestor,
    podeVerDashboardDiretoria: isRH,

    // Autoavaliação — qualquer colaborador autenticado
    podeAutoavaliar: isColaborador,

    // Flags de papel
    isRH,
    isGestor,
    isColaborador,
    roles,
  };
}
