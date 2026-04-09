/**
 * Helper para acessar tabelas do Supabase que não estão no schema auto-gerado.
 * 
 * Uso:
 *   import { fromTable } from "@/integrations/supabase/untypedClient";
 *   const { data } = await fromTable("nome_tabela").select("*").eq("tenant_id", tenantId);
 * 
 * Isso substitui o pattern `(supabase as any).from("tabela")` ou `supabase.from("tabela" as never)`
 * de forma centralizada e rastreável.
 */
import { supabase } from "./client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedSupabaseClient = ReturnType<typeof supabase.from<any>>;

/**
 * Acessa uma tabela do Supabase que não está no schema tipado.
 * Retorna o query builder padrão do Supabase sem erros de tipo.
 */
export function fromTable(table: string): UntypedSupabaseClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from(table);
}
