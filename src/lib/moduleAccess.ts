/**
 * Mapeia rotas e itens do sidebar para os "módulos" usados em
 * `perfil_permissoes.modulo`. Quando um usuário tem um perfil de acesso
 * vinculado, o sidebar e o ProtectedRoute usam este mapa para esconder/bloquear
 * páginas que ele não pode acessar.
 *
 * Owners (proprietário) e superadmins ignoram este mapa (acesso total).
 *
 * Rotas que NÃO estão neste mapa são consideradas "globais" (Início, Meu Perfil,
 * Suporte, Pendências, Configurações etc.) e ficam liberadas para qualquer
 * usuário autenticado.
 */
export const PATH_TO_MODULO: Record<string, string> = {
  // Estrutura organizacional
  "/empresa": "configuracoes",
  "/cadastros/filiais": "configuracoes",
  "/cadastros/departamentos": "configuracoes",
  "/cadastros/cargos": "configuracoes",
  "/colaboradores": "colaboradores",
  "/marketplace": "configuracoes",

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

  // Estratégia (geralmente RH/Gestor)
  "/estrategia": "configuracoes",
};

/**
 * Rotas sempre liberadas para usuários autenticados, mesmo com perfil restrito.
 */
export const ALWAYS_ALLOWED_PATHS = new Set<string>([
  "/",
  "/meu-perfil",
  "/suporte",
  "/pendencias",
  "/configuracoes", // a página em si filtra por role; necessário p/ auto-serviço
  "/onboarding-rh-self", // placeholder se houver
]);

/**
 * Devolve o módulo associado a uma rota, ou null se a rota é global.
 * Considera prefixos para rotas dinâmicas tipo /plano-acao/:id.
 */
export function getModuloForPath(pathname: string): string | null {
  // Match exato
  if (PATH_TO_MODULO[pathname]) return PATH_TO_MODULO[pathname];

  // Match por prefixo (mais longo primeiro)
  const sortedKeys = Object.keys(PATH_TO_MODULO).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (pathname === key || pathname.startsWith(key + "/")) {
      return PATH_TO_MODULO[key];
    }
  }
  return null;
}
