import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { toast } from "sonner";

export interface ExperienciaConfig {
  id: string;
  tenant_id: string;
  empresa_id: string;
  modelo_periodos: "1_periodo" | "2_periodos";
  duracao_primeiro_periodo: number;
  duracao_segundo_periodo: number | null;
  clausula_assecuratoria_padrao: boolean;
  dias_antecedencia_acao: number;
  alerta_15_dias: boolean;
  alerta_7_dias: boolean;
  alerta_2_dias: boolean;
  politica_interna: string | null;
  created_at: string;
  updated_at: string;
}

export function useExperienciaConfig() {
  const { tenantId } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();
  const queryClient = useQueryClient();

  const configQuery = useQuery({
    queryKey: ["experiencia-config", tenantId, empresaAtivaId],
    queryFn: async () => {
      if (!tenantId || !empresaAtivaId) return null;
      const { data, error } = await supabase
        .from("empresa_experiencia_config" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("empresa_id", empresaAtivaId)
        .maybeSingle() as { data: ExperienciaConfig | null; error: any };
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && !!empresaAtivaId,
  });

  const salvarMutation = useMutation({
    mutationFn: async (config: Partial<ExperienciaConfig>) => {
      if (!tenantId || !empresaAtivaId) throw new Error("Selecione uma empresa");

      // Validar soma de períodos
      const modelo = config.modelo_periodos || "2_periodos";
      const p1 = config.duracao_primeiro_periodo || 45;
      const p2 = config.duracao_segundo_periodo || 0;
      if (modelo === "1_periodo" && p1 > 90) {
        throw new Error("Período único não pode exceder 90 dias.");
      }
      if (modelo === "2_periodos" && p1 + (p2 || 0) > 90) {
        throw new Error("Soma dos períodos não pode exceder 90 dias (CLT art. 445).");
      }

      const payload = {
        tenant_id: tenantId,
        empresa_id: empresaAtivaId,
        modelo_periodos: modelo,
        duracao_primeiro_periodo: p1,
        duracao_segundo_periodo: modelo === "2_periodos" ? (p2 || 45) : null,
        clausula_assecuratoria_padrao: config.clausula_assecuratoria_padrao ?? false,
        dias_antecedencia_acao: config.dias_antecedencia_acao ?? 5,
        alerta_15_dias: config.alerta_15_dias ?? true,
        alerta_7_dias: config.alerta_7_dias ?? true,
        alerta_2_dias: config.alerta_2_dias ?? true,
        politica_interna: config.politica_interna || null,
      };

      const { data, error } = await supabase
        .from("empresa_experiencia_config" as never)
        .upsert(payload as never, { onConflict: "tenant_id,empresa_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["experiencia-config"] });
      toast.success("Configuração salva com sucesso!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    config: configQuery.data,
    isLoading: configQuery.isLoading,
    salvar: salvarMutation.mutateAsync,
    salvando: salvarMutation.isPending,
  };
}
