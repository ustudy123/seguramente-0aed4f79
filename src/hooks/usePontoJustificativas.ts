import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useAuth } from "./useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { toast } from "sonner";

export interface PontoJustificativa {
  id: string;
  tenant_id: string;
  empresa_id: string | null;
  nome: string;
  descricao: string | null;
  horas_abono: number;
  requer_anexo: boolean;
  ativo: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
}

export function usePontoJustificativas() {
  const { tenantId, user, hasMinimumRole } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();
  const qc = useQueryClient();
  const podeGerenciar = hasMinimumRole("admin");

  const list = useQuery({
    queryKey: ["ponto-justificativas", tenantId],
    queryFn: async (): Promise<PontoJustificativa[]> => {
      if (!tenantId) return [];
      const { data, error } = await fromTable("ponto_justificativas")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("ordem", { ascending: true })
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data || []) as PontoJustificativa[];
    },
    enabled: !!tenantId,
  });

  const upsert = useMutation({
    mutationFn: async (j: Partial<PontoJustificativa> & { nome: string; horas_abono: number }) => {
      if (!tenantId || !user) throw new Error("Não autenticado");
      const payload: any = {
        tenant_id: tenantId,
        empresa_id: empresaAtivaId || null,
        nome: j.nome.trim(),
        descricao: j.descricao?.trim() || null,
        horas_abono: Number(j.horas_abono) || 0,
        requer_anexo: !!j.requer_anexo,
        ativo: j.ativo !== false,
        ordem: j.ordem ?? 0,
        created_by: user.id,
      };
      if (j.id) {
        const { error } = await fromTable("ponto_justificativas").update(payload).eq("id", j.id);
        if (error) throw error;
      } else {
        const { error } = await fromTable("ponto_justificativas").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ponto-justificativas"] });
      toast.success("Justificativa salva!");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable("ponto_justificativas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ponto-justificativas"] });
      toast.success("Justificativa removida.");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover."),
  });

  return {
    justificativas: list.data || [],
    loading: list.isLoading,
    podeGerenciar,
    salvar: upsert.mutateAsync,
    salvando: upsert.isPending,
    remover: remove.mutateAsync,
  };
}
