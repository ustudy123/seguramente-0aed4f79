import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
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
      let query = fromTable("ponto_escalas")
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
      const { data, error } = await fromTable("ponto_escala_atribuicoes")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("ativa", true) as { data: EscalaAtribuicao[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const sincronizarPeriodos = async (escalaId: string, diasConfig: any) => {
    if (!diasConfig || typeof diasConfig !== "object") return;
    if (!tenantId) return;
    const DIAS = ["segunda","terca","quarta","quinta","sexta","sabado","domingo"];
    const novos: any[] = [];
    DIAS.forEach((dia) => {
      const c = diasConfig[dia];
      if (!c || !c.trabalha) return;
      const entrada = (c.entrada || "").substring(0,5);
      const saida = (c.saida || "").substring(0,5);
      if (!entrada || !saida) return;
      if (c.tem_almoco && c.inicio_almoco && c.fim_almoco) {
        const ini = c.inicio_almoco.substring(0,5);
        const fim = c.fim_almoco.substring(0,5);
        novos.push({ tenant_id: tenantId, escala_id: escalaId, dia_semana: dia, ordem_bloco: 1, hora_inicio: entrada, hora_fim: ini });
        novos.push({ tenant_id: tenantId, escala_id: escalaId, dia_semana: dia, ordem_bloco: 2, hora_inicio: fim, hora_fim: saida });
      } else {
        novos.push({ tenant_id: tenantId, escala_id: escalaId, dia_semana: dia, ordem_bloco: 1, hora_inicio: entrada, hora_fim: saida });
      }
    });
    await fromTable("ponto_escala_periodos").delete().eq("escala_id", escalaId);
    if (novos.length > 0) {
      const { error } = await fromTable("ponto_escala_periodos").insert(novos as any);
      if (error) console.error("Erro ao sincronizar blocos diários:", error);
    }
  };

  const criarEscalaMutation = useMutation({
    mutationFn: async (escala: Partial<PontoEscala> & { dias_config?: any }) => {
      if (!tenantId) throw new Error("Não autenticado");
      const { dias_config, ...rest } = escala as any;
      const { data, error } = await fromTable("ponto_escalas")
        .insert({ ...rest, dias_config, tenant_id: tenantId, empresa_id: empresaAtivaId || null } as any)
        .select()
        .single();
      if (error) throw error;
      if (data?.id && dias_config) await sincronizarPeriodos(data.id, dias_config);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ponto-escalas"] });
      queryClient.invalidateQueries({ queryKey: ["ponto-escala-periodos"] });
      toast.success("Escala criada com sucesso!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const atualizarEscalaMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PontoEscala> & { id: string; dias_config?: any }) => {
      const { dias_config, ...rest } = updates as any;
      const payload: any = { ...rest };
      if (dias_config !== undefined) payload.dias_config = dias_config;
      const { data, error } = await fromTable("ponto_escalas")
        .update(payload as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      if (dias_config) await sincronizarPeriodos(id, dias_config);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ponto-escalas"] });
      queryClient.invalidateQueries({ queryKey: ["ponto-escala-periodos"] });
      toast.success("Escala atualizada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const excluirEscalaMutation = useMutation({
    mutationFn: async (id: string) => {
      // Verifica se há atribuições vinculadas
      const { data: atrib, error: atribErr } = await fromTable("ponto_escala_atribuicoes")
        .select("id")
        .eq("escala_id", id)
        .limit(1) as { data: { id: string }[] | null; error: Error | null };
      if (atribErr) throw atribErr;
      if (atrib && atrib.length > 0) {
        throw new Error("Esta escala já está em uso. Inative-a ao invés de excluir.");
      }
      // Limpa dados relacionados (períodos, recorrências, histórico) antes
      await fromTable("ponto_escala_periodos").delete().eq("escala_id", id);
      await fromTable("ponto_escala_recorrencias").delete().eq("escala_id", id);
      await fromTable("ponto_escala_historico_interpretacao").delete().eq("escala_id", id);
      const { error } = await fromTable("ponto_escalas").delete().eq("id", id);
      if (error) throw error;
      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ponto-escalas"] });
      toast.success("Escala excluída!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const atribuirEscalaMutation = useMutation({
    mutationFn: async (atribuicao: Partial<EscalaAtribuicao>) => {
      if (!tenantId) throw new Error("Não autenticado");
      const { data, error } = await fromTable("ponto_escala_atribuicoes")
        .insert({ ...atribuicao, tenant_id: tenantId } as any)
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
    atualizandoEscala: atualizarEscalaMutation.isPending,
    excluirEscala: excluirEscalaMutation.mutateAsync,
    excluindoEscala: excluirEscalaMutation.isPending,
    atribuirEscala: atribuirEscalaMutation.mutateAsync,
  };
}
