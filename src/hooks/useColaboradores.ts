import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";

export interface Colaborador {
  id: string;
  nome_completo: string;
  cpf: string;
  cargo: string;
  departamento: string | null;
  email: string | null;
  celular: string | null;
  filial: string | null;
  data_admissao: string | null;
  empresa_id?: string | null;
  gestor_imediato?: string | null;
  foto_url?: string | null;
}

interface UseColaboradoresOptions {
  /** Exclui contratos PJ/Pró-labore/Terceiros (usado em módulos exclusivos CLT como Ponto e Férias). */
  excluirPJ?: boolean;
}

export function useColaboradores(options: UseColaboradoresOptions = {}) {
  const { excluirPJ = false } = options;
  const { tenantId } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();

  const { data: colaboradores = [], isLoading, error, refetch } = useQuery({
    queryKey: ["colaboradores", tenantId, empresaAtivaId, excluirPJ],
    queryFn: async (): Promise<Colaborador[]> => {
      if (!tenantId) return [];

      let query = supabase
        .from("admissoes")
        .select("id, nome_completo, cpf, cargo, departamento, email, celular, filial, data_admissao, empresa_id, gestor_imediato, tipo_contrato")
        .eq("tenant_id", tenantId)
        .eq("status", "concluido");

      if (empresaAtivaId) {
        query = query.eq("empresa_id", empresaAtivaId);
      }

      const { data, error } = await query.order("nome_completo");

      if (error) throw error;

      let rows = data || [];
      if (excluirPJ) {
        // Mantém apenas vínculos CLT (exclui PJ, pró-labore e terceiros).
        const naoCLT = new Set(["pj", "prolabore", "pro_labore", "terceiro", "terceirizado", "autonomo"]);
        rows = rows.filter((r: any) => {
          const tc = (r.tipo_contrato || "").toString().trim().toLowerCase();
          return !naoCLT.has(tc);
        });
      }
      // Remove campo auxiliar para manter o tipo público estável.
      return rows.map(({ tipo_contrato, ...rest }: any) => rest);
    },
    enabled: !!tenantId,
  });

  return {
    colaboradores,
    isLoading,
    error: error?.message || null,
    refetch,
  };
}
