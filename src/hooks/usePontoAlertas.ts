import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useAuth } from "./useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { toast } from "sonner";

export interface PontoAlerta {
  id: string;
  tenant_id: string;
  colaborador_id: string | null;
  colaborador_nome: string | null;
  colaborador_cpf: string | null;
  tipo: string;
  severidade: string;
  titulo: string;
  descricao: string | null;
  data_referencia: string | null;
  resolvido: boolean;
  resolvido_em: string | null;
  created_at: string;
}

export const ALERTA_TIPOS = {
  excesso_jornada: { label: "Excesso de Jornada", icon: "⚠️", color: "text-destructive" },
  intervalo_suprimido: { label: "Intervalo Suprimido", icon: "🔴", color: "text-destructive" },
  interjornada_insuficiente: { label: "Interjornada Insuficiente", icon: "🟡", color: "text-warning" },
  banco_vencendo: { label: "Banco Vencendo", icon: "⏰", color: "text-warning" },
  falta_marcacao: { label: "Falta de Marcação", icon: "❌", color: "text-destructive" },
  horas_extras_recorrentes: { label: "HE Recorrentes", icon: "📊", color: "text-warning" },
};

export function usePontoAlertas() {
  const { tenantId } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();
  const queryClient = useQueryClient();

  const alertasQuery = useQuery({
    queryKey: ["ponto-alertas", tenantId, empresaAtivaId],
    queryFn: async (): Promise<PontoAlerta[]> => {
      if (!tenantId) return [];
      let query = fromTable("ponto_alertas")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("resolvido", false);
      if (empresaAtivaId) query = query.eq("empresa_id", empresaAtivaId);
      const { data, error } = await query.order("created_at", { ascending: false }) as { data: PontoAlerta[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const resolverAlertaMutation = useMutation({
    mutationFn: async (alertaId: string) => {
      const { error } = await fromTable("ponto_alertas")
        .update({ resolvido: true, resolvido_em: new Date().toISOString() } as any)
        .eq("id", alertaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ponto-alertas"] });
      toast.success("Alerta resolvido!");
    },
  });

  return {
    alertas: alertasQuery.data || [],
    loadingAlertas: alertasQuery.isLoading,
    resolverAlerta: resolverAlertaMutation.mutateAsync,
  };
}
