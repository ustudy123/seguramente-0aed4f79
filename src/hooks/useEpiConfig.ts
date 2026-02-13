import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface EpiConfig {
  id: string;
  tenant_id: string;
  usar_controle_estoque: boolean;
  created_at: string;
  updated_at: string;
}

export function useEpiConfig() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  const configQuery = useQuery({
    queryKey: ["epi-config", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from("epi_config")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;

      // Auto-create config if not exists
      if (!data) {
        const { data: newConfig, error: insertError } = await supabase
          .from("epi_config")
          .insert({ tenant_id: tenantId, usar_controle_estoque: true })
          .select()
          .single();
        if (insertError) throw insertError;
        return newConfig as EpiConfig;
      }
      return data as EpiConfig;
    },
    enabled: !!tenantId,
  });

  const toggleControleEstoque = useMutation({
    mutationFn: async (valor: boolean) => {
      if (!tenantId || !configQuery.data) throw new Error("Config não encontrada");
      const { error } = await supabase
        .from("epi_config")
        .update({ usar_controle_estoque: valor })
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: (_, valor) => {
      queryClient.invalidateQueries({ queryKey: ["epi-config"] });
      toast.success(
        valor
          ? "Controle de estoque ativado!"
          : "Controle de estoque desativado. Entregas continuarão sendo registradas sem baixa de saldo."
      );
    },
    onError: (error) => {
      toast.error("Erro ao alterar configuração: " + error.message);
    },
  });

  return {
    config: configQuery.data,
    configLoading: configQuery.isLoading,
    usarControleEstoque: configQuery.data?.usar_controle_estoque ?? true,
    toggleControleEstoque: toggleControleEstoque.mutateAsync,
    toggling: toggleControleEstoque.isPending,
  };
}
