/**
 * Mapeia rotas e itens do sidebar para os "módulos" usados em
 * `perfil_permissoes.modulo`. Quando um usuário tem um perfil de acesso
 * vinculado, o sidebar e o ProtectedRoute usam este mapa para esconder/bloquear
 * páginas que ele não pode acessar.
 *
 * Owners (proprietário) e superadmins ignoram este mapa (acesso total).
 *
 * Comportamento de fallback: para usuários COM perfil vinculado, qualquer
 * rota não mapeada e não listada em `ALWAYS_ALLOWED_PATHS` é considerada
 * RESTRITA (bloqueada). Para usuários sem perfil vinculado, vale a hierarquia
 * de roles (definida no ProtectedRoute / AppSidebar).
 */
export const PATH_TO_MODULO: Record<string, string> = {
  // Estrutura organizacional
  "/empresa": "configuracoes",
  "/cadastros/filiais": "configuracoes",
  "/cadastros/departamentos": "configuracoes",
  "/cadastros/cargos": "configuracoes",
  "/colaboradores": "colaboradores",
  "/marketplace": "configuracoes",

  // Estratégia & Governança (link de topo do sidebar)
  "/estrategia": "configuracoes",

  // Saúde & Segurança
  "/compliance-sst": "sst",
  "/incidentes-acidentes": "incidentes",
  "/ergonomia": "ergonomia",
  "/psicossocial": "psicossocial",
  "/epis": "epi",
  "/terceiros": "sst",

  // Planos & Desenvolvimento
  "/metas": "avaliacoes",
  "/plano-acao": "plano_acao",
  "/avaliacoes": "avaliacoes",
  "/pdi": "pdi",

  // Pessoas
  "/cultura-celebracoes": "bem_estar",
  "/contratos-experiencia": "admissoes",
  "/onboarding-rh": "admissoes",
  "/ferias": "colaboradores",
  "/atestados": "atestados",
  "/felicidade": "bem_estar",
  "/feedback-ocorrencias": "feedback",
  "/ouvidoria": "ouvidoria",
  "/aprendizado-papeis": "trilhas",
  "/trilhas": "trilhas",
  "/feed": "bem_estar",
  "/ponto": "colaboradores",
  "/analise-jornada": "colaboradores",

  // Documentos
  "/documentos": "configuracoes",

  // Financeiro
  "/financeiro": "financeiro",
  "/financeiro/beneficios": "beneficios",
  "/hub-contabil": "hub_contabil",

  // Academia (acessível via perfil/roles)
  "/academia": "trilhas",
};

/**
 * Rotas sempre liberadas para usuários autenticados, mesmo com perfil restrito.
 * Inclui itens essenciais ao auto-serviço (próprio perfil, suporte, etc).
 */
export const ALWAYS_ALLOWED_PATHS = new Set<string>([
  "/",
  "/meu-perfil",
  "/suporte",
  "/pendencias",
  "/configuracoes", // a página em si filtra por role; necessário p/ auto-serviço
  "/onboarding-rh-self",
  "/bem-estar", // espaço pessoal de auto-percepção
]);

/**
 * Devolve o módulo associado a uma rota, ou null se a rota é considerada
 * "global" (sempre liberada — vide `ALWAYS_ALLOWED_PATHS`).
 *
 * IMPORTANTE: para o gating estrito por perfil, a checagem deve ser feita
 * em duas etapas pelo chamador:
 *   1) se a rota está em `ALWAYS_ALLOWED_PATHS` → liberada
 *   2) caso contrário, exigir mapeamento em `PATH_TO_MODULO` e validar a permissão
 *      Rotas não mapeadas para usuários COM perfil vinculado devem ser BLOQUEADAS.
 */
export function getModuloForPath(pathname: string): string | null {
  // Normaliza: remove query string e hash
  const cleanPath = pathname.split("?")[0].split("#")[0];

  // Match exato
  if (PATH_TO_MODULO[cleanPath]) return PATH_TO_MODULO[cleanPath];

  // Match por prefixo (mais longo primeiro)
  const sortedKeys = Object.keys(PATH_TO_MODULO).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (cleanPath === key || cleanPath.startsWith(key + "/")) {
      return PATH_TO_MODULO[key];
    }
  }
  return null;
}
