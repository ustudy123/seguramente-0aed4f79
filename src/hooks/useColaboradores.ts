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
  email: string;
  celular: string | null;
  filial: string | null;
  data_admissao: string | null;
  empresa_id?: string | null;
}

export function useColaboradores() {
  const { tenantId } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();

  const { data: colaboradores = [], isLoading, error, refetch } = useQuery({
    queryKey: ["colaboradores", tenantId, empresaAtivaId],
    queryFn: async (): Promise<Colaborador[]> => {
      if (!tenantId) return [];

      let query = supabase
        .from("admissoes")
        .select("id, nome_completo, cpf, cargo, departamento, email, celular, filial, data_admissao, empresa_id")
        .eq("tenant_id", tenantId)
        .eq("status", "concluido");

      if (empresaAtivaId) {
        query = query.eq("empresa_id", empresaAtivaId);
      }

      const { data, error } = await query.order("nome_completo");

      if (error) throw error;
      return data || [];
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
