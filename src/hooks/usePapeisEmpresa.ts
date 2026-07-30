import { useQuery } from "@tanstack/react-query";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useAuth } from "./useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";

/**
 * Cargos/funções realmente cadastrados na empresa ativa.
 *
 * Usado para calibrar o campo "quem" do plano de ação: a IA só pode
 * responsabilizar papéis que existam na organização. Empresa sem RH, SESMT ou
 * liderança formal recai em "Responsável legal".
 */
export function usePapeisEmpresa() {
  const { tenantId } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();

  return useQuery({
    queryKey: ["papeis-empresa", tenantId, empresaAtivaId],
    queryFn: async (): Promise<string[]> => {
      if (!tenantId) return [];
      let q = fromTable("cargos")
        .select("nome, empresa_id, ativo")
        .eq("tenant_id", tenantId)
        .eq("ativo", true);
      if (empresaAtivaId) q = q.or(`empresa_id.eq.${empresaAtivaId},empresa_id.is.null`);
      const { data, error } = await q;
      if (error) throw error;
      const nomes = ((data || []) as Array<{ nome?: string }>)
        .map(c => (c.nome || "").trim())
        .filter(Boolean);
      return Array.from(new Set(nomes)).sort((a, b) => a.localeCompare(b, "pt-BR"));
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}
