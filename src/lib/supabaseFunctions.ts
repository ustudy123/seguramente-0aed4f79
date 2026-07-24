/**
 * Helper central para construir URLs de Edge Functions do Supabase
 * baseado nas variáveis de ambiente do Vite.
 *
 * Uso:
 *   const url = getSupabaseFunctionUrl("ai-chat");
 *   // -> https://<project>.supabase.co/functions/v1/ai-chat
 */

export function getSupabaseFunctionUrl(functionName: string): string {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;

  if (!baseUrl) {
    console.warn(
      `[getSupabaseFunctionUrl] VITE_SUPABASE_URL não está definido. Verifique o arquivo .env do ambiente.`
    );
    throw new Error("VITE_SUPABASE_URL não configurado");
  }

  const normalized = baseUrl.replace(/\/$/, "");
  return `${normalized}/functions/v1/${functionName}`;
}

/**
 * Retorna o Project ID do Supabase configurado para o ambiente atual.
 */
export function getSupabaseProjectId(): string {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

  if (!projectId) {
    console.warn(
      `[getSupabaseProjectId] VITE_SUPABASE_PROJECT_ID não está definido. Verifique o arquivo .env do ambiente.`
    );
    throw new Error("VITE_SUPABASE_PROJECT_ID não configurado");
  }

  return projectId;
}
