import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface EpiLocalEstoque {
  id: string;
  tenant_id: string;
  nome: string;
  tipo: string | null;
  filial_id: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  filial?: { id: string; nome: string } | null;
}

export type LocalEstoqueTipo =
  | "almoxarifado_central"
  | "almoxarifado_setorial"
  | "estoque_obra"
  | "estoque_movel";

export const LOCAL_TIPO_LABELS: Record<LocalEstoqueTipo, string> = {
  almoxarifado_central: "Almoxarifado Central",
  almoxarifado_setorial: "Almoxarifado Setorial",
  estoque_obra: "Estoque em Obra",
  estoque_movel: "Estoque Móvel",
};

export function useEpiLocais() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  const locaisQuery = useQuery({
    queryKey: ["epi-locais-estoque", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("epi_locais_estoque")
        .select("*, filial:filiais(id, nome)")
        .eq("tenant_id", tenantId)
        .order("nome");
      if (error) throw error;
      return data as EpiLocalEstoque[];
    },
    enabled: !!tenantId,
  });

  const criarLocal = useMutation({
    mutationFn: async (dados: {
      nome: string;
      tipo?: string;
      filial_id?: string | null;
      responsavel_id?: string | null;
      responsavel_nome?: string | null;
      observacoes?: string;
    }) => {
      if (!tenantId) throw new Error("Tenant não identificado");
      const { data, error } = await supabase
        .from("epi_locais_estoque")
        .insert({ ...dados, tenant_id: tenantId })
        .select("*, filial:filiais(id, nome)")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["epi-locais-estoque"] });
      toast.success("Local de estoque criado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao criar local: " + error.message);
    },
  });

  const atualizarLocal = useMutation({
    mutationFn: async ({ id, ...dados }: { id: string } & Partial<{
      nome: string;
      tipo: string;
      filial_id: string | null;
      responsavel_id: string | null;
      responsavel_nome: string | null;
      observacoes: string;
      ativo: boolean;
    }>) => {
      const { error } = await supabase
        .from("epi_locais_estoque")
        .update(dados)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["epi-locais-estoque"] });
      toast.success("Local atualizado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar local: " + error.message);
    },
  });

  const toggleAtivoLocal = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("epi_locais_estoque")
        .update({ ativo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { ativo }) => {
      queryClient.invalidateQueries({ queryKey: ["epi-locais-estoque"] });
      toast.success(ativo ? "Local reativado!" : "Local inativado!");
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });

  return {
    locais: locaisQuery.data || [],
    locaisAtivos: (locaisQuery.data || []).filter((l) => l.ativo),
    locaisLoading: locaisQuery.isLoading,
    criarLocal: criarLocal.mutateAsync,
    criandoLocal: criarLocal.isPending,
    atualizarLocal: atualizarLocal.mutateAsync,
    atualizandoLocal: atualizarLocal.isPending,
    toggleAtivoLocal: toggleAtivoLocal.mutateAsync,
  };
}
