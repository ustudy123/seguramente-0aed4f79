import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { toast } from "sonner";
import { handleMutationError } from "@/lib/toastError";

export interface PontoEscala {
  id: string;
  tenant_id: string;
  empresa_id: string | null;
  nome: string;
  tipo: string;
  jornada_diaria_minutos: number;
  jornada_semanal_minutos: number;
  intervalo_intrajornada_minutos: number;
  tolerancia_minutos: number;
  tolerancia_diaria_minutos: number;
  hora_entrada_padrao: string | null;
  hora_saida_padrao: string | null;
  sabado_util: boolean;
  domingo_util: boolean;
  adicional_noturno_inicio: string | null;
  adicional_noturno_fim: string | null;
  percentual_hora_extra_50: number;
  percentual_hora_extra_100: number;
  percentual_adicional_noturno: number;
  usa_hora_ficta_noturna: boolean;
  ativa: boolean;
  created_at: string;
}

export interface EscalaAtribuicao {
  id: string;
  tenant_id: string;
  escala_id: string;
  colaborador_id: string;
  colaborador_nome: string;
  colaborador_cpf: string | null;
  data_inicio: string;
  data_fim: string | null;
  ativa: boolean;
}

export const ESCALA_TIPOS = [
  { value: "5x2", label: "5x2 (Seg-Sex)" },
  { value: "6x1", label: "6x1 (Seg-Sáb)" },
  { value: "12x36", label: "12x36" },
  { value: "personalizada", label: "Personalizada" },
];

export function usePontoEscalas() {
  const { tenantId, user } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();
  const queryClient = useQueryClient();

  const escalasQuery = useQuery({
    queryKey: ["ponto-escalas", tenantId, empresaAtivaId],
    queryFn: async (): Promise<PontoEscala[]> => {
      if (!tenantId) return [];
      let query = supabase
        .from("ponto_escalas" as never)
        .select("*")
        .eq("tenant_id", tenantId);
      if (empresaAtivaId) query = query.eq("empresa_id", empresaAtivaId);
      const { data, error } = await query.order("nome") as { data: PontoEscala[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const atribuicoesQuery = useQuery({
    queryKey: ["ponto-escala-atribuicoes", tenantId],
    queryFn: async (): Promise<EscalaAtribuicao[]> => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("ponto_escala_atribuicoes" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("ativa", true) as { data: EscalaAtribuicao[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const criarEscalaMutation = useMutation({
    mutationFn: async (escala: Partial<PontoEscala>) => {
      if (!tenantId) throw new Error("Não autenticado");
      const { data, error } = await supabase
        .from("ponto_escalas" as never)
        .insert({ ...escala, tenant_id: tenantId, empresa_id: empresaAtivaId || null } as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ponto-escalas"] });
      toast.success("Escala criada com sucesso!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const atualizarEscalaMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PontoEscala> & { id: string }) => {
      const { data, error } = await supabase
        .from("ponto_escalas" as never)
        .update(updates as never)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ponto-escalas"] });
      toast.success("Escala atualizada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const atribuirEscalaMutation = useMutation({
    mutationFn: async (atribuicao: Partial<EscalaAtribuicao>) => {
      if (!tenantId) throw new Error("Não autenticado");
      const { data, error } = await supabase
        .from("ponto_escala_atribuicoes" as never)
        .insert({ ...atribuicao, tenant_id: tenantId } as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ponto-escala-atribuicoes"] });
      toast.success("Escala atribuída!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    escalas: escalasQuery.data || [],
    loadingEscalas: escalasQuery.isLoading,
    atribuicoes: atribuicoesQuery.data || [],
    criarEscala: criarEscalaMutation.mutateAsync,
    criandoEscala: criarEscalaMutation.isPending,
    atualizarEscala: atualizarEscalaMutation.mutateAsync,
    atribuirEscala: atribuirEscalaMutation.mutateAsync,
  };
}
