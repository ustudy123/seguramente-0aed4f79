import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface EqualizacaoEscala {
  escala_id: string;
  escala_nome: string;
  total_equalizacao_min: number;
  dias_uteis_efetivos: number;
  qtd_feriados: number;
  /** Memória de cálculo completa (RN10): dias úteis brutos, feriados
   *  deduzidos, carga semanal real, déficit diário, observações. */
  memoria: Record<string, any>;
}

/**
 * Equalização mensal (fechar 44h) por escala ativa do tenant, calculada
 * pela função SQL ponto_equalizacao_competencia_tenant (RN01–RN04 + RN10).
 * Disponível desde o dia 1 do mês, antes de qualquer sábado trabalhado.
 */
export function usePontoEqualizacao(competencia: string) {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["ponto-equalizacao", tenantId, competencia],
    queryFn: async (): Promise<EqualizacaoEscala[]> => {
      if (!tenantId || !competencia) return [];
      const { data, error } = await (supabase.rpc as any)(
        "ponto_equalizacao_competencia_tenant",
        { p_tenant_id: tenantId, p_competencia: competencia }
      );
      if (error) throw error;
      return (data || []) as EqualizacaoEscala[];
    },
    enabled: !!tenantId && !!competencia,
  });
}

export interface SabadoTrabalhado {
  data: string;
  trabalhado_min: number;
}

export interface EqualizacaoColaborador {
  colaborador_cpf: string;
  colaborador_nome: string;
  escala_id: string;
  escala_nome: string;
  total_equalizacao_min: number;
  /** Sábados com ponto no mês (candidatos a equalização — RN05). */
  sabados: SabadoTrabalhado[];
  /** Sábado já marcado como equalização, se houver. */
  data_marcada: string | null;
  /** Excedente acima do teto já liberado pelo RH via art. 61. */
  art61_liberado: boolean;
}

/**
 * Gerenciador da marcação do sábado de equalização (RN05) e da liberação
 * de excedente retido pelo teto legal (RN07 / art. 61 CLT).
 * A marcação é INDIVIDUAL por colaborador, mesmo dentro da mesma escala.
 */
export function usePontoEqualizacaoGerenciador(competencia: string) {
  const { tenantId } = useAuth();
  const qc = useQueryClient();

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["ponto-equalizacao"] });
    qc.invalidateQueries({ queryKey: ["banco-horas-dias"] });
    qc.invalidateQueries({ queryKey: ["banco-horas"] });
  };

  const { data: colaboradores = [], isLoading } = useQuery({
    queryKey: ["ponto-equalizacao", "listar", tenantId, competencia],
    queryFn: async (): Promise<EqualizacaoColaborador[]> => {
      if (!tenantId || !competencia) return [];
      const { data, error } = await (supabase.rpc as any)("ponto_equalizacao_listar", {
        p_tenant_id: tenantId,
        p_competencia: competencia,
      });
      if (error) throw error;
      return (data || []).map((c: any) => ({
        ...c,
        sabados: Array.isArray(c.sabados) ? c.sabados : [],
      })) as EqualizacaoColaborador[];
    },
    enabled: !!tenantId && !!competencia,
  });

  const definir = useMutation({
    mutationFn: async (p: { cpf: string; data: string }) => {
      if (!tenantId) throw new Error("Tenant não identificado");
      const { error } = await (supabase.rpc as any)("ponto_equalizacao_definir", {
        p_tenant_id: tenantId,
        p_colaborador_cpf: p.cpf,
        p_competencia: competencia,
        p_data: p.data,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidar(); toast.success("Sábado de equalização definido"); },
    onError: (e: Error) => toast.error(`Erro ao definir: ${e.message}`),
  });

  const remover = useMutation({
    mutationFn: async (cpf: string) => {
      if (!tenantId) throw new Error("Tenant não identificado");
      const { error } = await (supabase.rpc as any)("ponto_equalizacao_remover", {
        p_tenant_id: tenantId,
        p_colaborador_cpf: cpf,
        p_competencia: competencia,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidar(); toast.success("Marcação removida"); },
    onError: (e: Error) => toast.error(`Erro ao remover: ${e.message}`),
  });

  const liberarArt61 = useMutation({
    mutationFn: async (p: { cpf: string; justificativa: string }) => {
      if (!tenantId) throw new Error("Tenant não identificado");
      const { error } = await (supabase.rpc as any)("ponto_equalizacao_art61_liberar", {
        p_tenant_id: tenantId,
        p_colaborador_cpf: p.cpf,
        p_competencia: competencia,
        p_justificativa: p.justificativa,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidar(); toast.success("Excedente liberado (art. 61 CLT)"); },
    onError: (e: Error) => toast.error(`Erro ao liberar: ${e.message}`),
  });

  return { colaboradores, isLoading, definir, remover, liberarArt61 };
}
