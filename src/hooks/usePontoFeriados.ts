/**
 * RN23 — feriado trabalhado no Espelho e no Banco de Horas.
 *
 * A resolução do feriado é sempre do banco (feriados_da_empresa), nunca
 * recalculada aqui: a filial do colaborador é que define quais feriados
 * municipais/estaduais valem, e duplicar essa regra no front foi
 * justamente o que fez o espelho e a equalização divergirem.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface FeriadoCompetencia {
  data: string;
  feriado_nome: string;
  origem: string;
  trabalhado_min: number;
  folga_compensatoria_em: string | null;
  adicional_100_min: number;
}

/** Feriados da competência para um colaborador (trabalhados ou não). */
export function useFeriadosCompetencia(colaboradorCpf?: string | null, competencia?: string | null) {
  const { tenantId } = useAuth();
  const cpf = (colaboradorCpf || "").replace(/\D/g, "");

  const query = useQuery({
    queryKey: ["ponto-feriados-competencia", tenantId, cpf, competencia],
    enabled: !!tenantId && !!cpf && !!competencia,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("ponto_feriados_competencia", {
        p_tenant_id: tenantId,
        p_colaborador_cpf: cpf,
        p_competencia: competencia,
      });
      if (error) throw error;
      return ((data || []) as any[]).map<FeriadoCompetencia>((f) => ({
        data: String(f.data),
        feriado_nome: String(f.feriado_nome || ""),
        origem: String(f.origem || ""),
        trabalhado_min: Number(f.trabalhado_min) || 0,
        folga_compensatoria_em: f.folga_compensatoria_em ? String(f.folga_compensatoria_em) : null,
        adicional_100_min: Number(f.adicional_100_min) || 0,
      }));
    },
  });

  const porData = new Map<string, FeriadoCompetencia>();
  (query.data || []).forEach((f) => porData.set(f.data, f));

  return { ...query, feriados: query.data || [], porData };
}

/** Registro/remoção da folga compensatória (Lei 605/1949, art. 9º). */
export function useFolgaCompensatoria() {
  const { tenantId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["ponto-feriados-competencia"] });
    queryClient.invalidateQueries({ queryKey: ["ponto-feriado-adicional"] });
  };

  const registrar = useMutation({
    mutationFn: async (p: {
      colaboradorId: string;
      colaboradorCpf: string;
      dataFeriado: string;
      dataFolga: string;
      observacao?: string;
    }) => {
      const { error } = await supabase.from("feriado_folga_compensatoria" as any).upsert(
        {
          tenant_id: tenantId,
          colaborador_id: p.colaboradorId,
          colaborador_cpf: (p.colaboradorCpf || "").replace(/\D/g, ""),
          data_feriado: p.dataFeriado,
          data_folga: p.dataFolga,
          observacao: p.observacao || null,
        },
        { onConflict: "tenant_id,colaborador_cpf,data_feriado" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      invalidar();
      toast({
        title: "Folga compensatória registrada",
        description: "O adicional de 100% deixa de ser devido para este feriado.",
      });
    },
    onError: (e: any) =>
      toast({ title: "Erro ao registrar folga", description: e.message, variant: "destructive" }),
  });

  const remover = useMutation({
    mutationFn: async (p: { colaboradorCpf: string; dataFeriado: string }) => {
      const { error } = await supabase
        .from("feriado_folga_compensatoria" as any)
        .delete()
        .eq("tenant_id", tenantId)
        .eq("colaborador_cpf", (p.colaboradorCpf || "").replace(/\D/g, ""))
        .eq("data_feriado", p.dataFeriado);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidar();
      toast({
        title: "Folga compensatória removida",
        description: "O feriado volta a gerar adicional de 100%.",
      });
    },
    onError: (e: any) =>
      toast({ title: "Erro ao remover folga", description: e.message, variant: "destructive" }),
  });

  return { registrar, remover };
}

/** Consolidado da competência para a folha (por empresa). */
export function useFeriadoAdicionalCompetencia(empresaId?: string | null, competencia?: string | null) {
  const { tenantId } = useAuth();
  return useQuery({
    queryKey: ["ponto-feriado-adicional", tenantId, empresaId, competencia],
    enabled: !!tenantId && !!competencia,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("ponto_feriado_adicional_competencia", {
        p_tenant_id: tenantId,
        p_empresa_id: empresaId || null,
        p_competencia: competencia,
      });
      if (error) throw error;
      return (data || []) as Array<{
        colaborador_cpf: string;
        colaborador_nome: string;
        qtd_feriados_trabalhados: number;
        minutos_trabalhados: number;
        minutos_adicional_100: number;
        dias_compensados: number;
      }>;
    },
  });
}
