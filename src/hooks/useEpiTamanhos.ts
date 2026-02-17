import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface EpiTamanho {
  id: string;
  tenant_id: string;
  tipo_id: string;
  tamanho: string;
  ordem: number;
  created_at: string;
}

export function useEpiTamanhos(tipoId?: string) {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  const tamanhosQuery = useQuery({
    queryKey: ["epi-tamanhos", tenantId, tipoId],
    queryFn: async () => {
      if (!tenantId || !tipoId) return [];
      const { data, error } = await supabase
        .from("epi_tamanhos")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("tipo_id", tipoId)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data as EpiTamanho[];
    },
    enabled: !!tenantId && !!tipoId,
  });

  const allTamanhosQuery = useQuery({
    queryKey: ["epi-tamanhos-all", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("epi_tamanhos")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data as EpiTamanho[];
    },
    enabled: !!tenantId,
  });

  const salvarTamanhosMutation = useMutation({
    mutationFn: async ({ tipoId, tamanhos }: { tipoId: string; tamanhos: string[] }) => {
      if (!tenantId) throw new Error("Tenant não identificado");

      // Delete existing
      await supabase
        .from("epi_tamanhos")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("tipo_id", tipoId);

      // Insert new
      if (tamanhos.length > 0) {
        const rows = tamanhos.map((t, idx) => ({
          tenant_id: tenantId,
          tipo_id: tipoId,
          tamanho: t.trim(),
          ordem: idx,
        }));
        const { error } = await supabase.from("epi_tamanhos").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["epi-tamanhos"] });
      queryClient.invalidateQueries({ queryKey: ["epi-tamanhos-all"] });
      toast.success("Tamanhos salvos com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao salvar tamanhos: " + error.message);
    },
  });

  // Helper: get tamanhos for a given tipo_id from the "all" cache
  const getTamanhosForTipo = (tId: string): EpiTamanho[] => {
    return (allTamanhosQuery.data || []).filter((t) => t.tipo_id === tId);
  };

  return {
    tamanhos: tamanhosQuery.data || [],
    tamanhosLoading: tamanhosQuery.isLoading,
    allTamanhos: allTamanhosQuery.data || [],
    allTamanhosLoading: allTamanhosQuery.isLoading,
    getTamanhosForTipo,
    salvarTamanhos: salvarTamanhosMutation.mutateAsync,
    salvandoTamanhos: salvarTamanhosMutation.isPending,
  };
}
