import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

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
}

export function useColaboradores() {
  const { tenantId } = useAuth();

  const { data: colaboradores = [], isLoading, error, refetch } = useQuery({
    queryKey: ["colaboradores", tenantId],
    queryFn: async (): Promise<Colaborador[]> => {
      if (!tenantId) return [];

      // Buscar admissões com status 'concluido' - são os colaboradores ativos
      const { data, error } = await supabase
        .from("admissoes")
        .select("id, nome_completo, cpf, cargo, departamento, email, celular, filial, data_admissao")
        .eq("tenant_id", tenantId)
        .eq("status", "concluido")
        .order("nome_completo");

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
