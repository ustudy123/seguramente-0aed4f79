import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { toast } from "sonner";

export interface DesvioSeguranca {
  id: string;
  tenant_id: string;
  codigo: string | null;
  tipo_desvio: "condicao_insegura" | "ato_inseguro" | "desvio_processo";
  categoria: string | null;
  potencial_risco: "baixo" | "medio" | "alto" | "critico";
  status: "aberto" | "em_tratamento" | "resolvido" | "convertido_incidente" | "cancelado";
  unidade: string | null;
  setor: string | null;
  local_especifico: string | null;
  turno: string | null;
  data_desvio: string;
  hora_desvio: string | null;
  reportante_nome: string | null;
  reportante_anonimo: boolean;
  descricao: string;
  causa_provavel: string | null;
  acao_imediata: string | null;
  acao_imediata_responsavel: string | null;
  acao_imediata_prazo: string | null;
  foto_url: string | null;
  convertido_em_incidente_id: string | null;
  convertido_em: string | null;
  criado_por_nome: string | null;
  created_at: string;
  updated_at: string;
}

export type DesvioInsert = Omit<DesvioSeguranca, "id" | "tenant_id" | "codigo" | "created_at" | "updated_at">;

export const useDesviosSeguranca = () => {
  const { tenantId, user, profile } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();
  const queryClient = useQueryClient();

  const { data: desvios = [], isLoading } = useQuery({
    queryKey: ["desvios_seguranca", tenantId, empresaAtivaId],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from("desvios_seguranca")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (empresaAtivaId) query = query.eq("empresa_id", empresaAtivaId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as DesvioSeguranca[];
    },
    enabled: !!tenantId,
  });

  const createDesvio = useMutation({
    mutationFn: async (payload: DesvioInsert) => {
      if (!tenantId) throw new Error("Sem tenant");
      const { data, error } = await supabase
        .from("desvios_seguranca")
        .insert({ ...payload, tenant_id: tenantId, empresa_id: empresaAtivaId || null })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["desvios_seguranca"] });
      toast.success("Desvio registrado com sucesso!");
    },
    onError: (e: Error) => toast.error("Erro ao registrar desvio: " + e.message),
  });

  const updateDesvio = useMutation({
    mutationFn: async ({ id, ...payload }: Partial<DesvioSeguranca> & { id: string }) => {
      const { data, error } = await supabase
        .from("desvios_seguranca")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["desvios_seguranca"] });
      toast.success("Desvio atualizado!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  return { desvios, isLoading, createDesvio, updateDesvio };
};
