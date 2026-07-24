/**
 * Porte da empresa ativa, medido por colaboradores ativos do CNPJ.
 *
 * Conta admissões concluídas e não inativas da `empresa_id` corrente. O CNPJ
 * é a unidade: cada `empresa_cadastro` tem o seu, e o plano de ação é emitido
 * por CNPJ, não por grupo econômico.
 */
import { useQuery } from "@tanstack/react-query";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useTenant } from "@/hooks/useTenant";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { classificarPorte, type FaixaPorte } from "@/lib/porteEmpresa";

export interface PorteEmpresaInfo {
  colaboradores: number;
  faixa: FaixaPorte;
  razaoSocial: string;
  cnpj: string;
}

export function usePorteEmpresa() {
  const { tenantId } = useTenant();
  const { empresaAtivaId } = useEmpresaAtiva();

  return useQuery<PorteEmpresaInfo | null>({
    queryKey: ["porte-empresa", tenantId, empresaAtivaId],
    enabled: !!tenantId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!tenantId) return null;

      let q = fromTable("admissoes")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "concluido");

      if (empresaAtivaId) q = q.eq("empresa_id", empresaAtivaId);

      // `inativo` pode ser null em registros antigos — null conta como ativo.
      q = q.or("inativo.is.null,inativo.eq.false");

      const { count, error } = await q;
      if (error) throw error;

      let razaoSocial = "";
      let cnpj = "";
      if (empresaAtivaId) {
        const { data: emp } = await fromTable("empresa_cadastro")
          .select("razao_social, nome_fantasia, cnpj")
          .eq("id", empresaAtivaId)
          .maybeSingle();
        razaoSocial = emp?.razao_social || emp?.nome_fantasia || "";
        cnpj = emp?.cnpj || "";
      }

      const colaboradores = count ?? 0;
      return { colaboradores, faixa: classificarPorte(colaboradores), razaoSocial, cnpj };
    },
  });
}
