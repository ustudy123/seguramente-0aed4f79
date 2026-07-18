import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Runner de testes automatizados (superadmin).
 *
 * A tela nunca escreve dados de teste diretamente — ela chama funções do
 * banco que rodam a bateria dentro do cercado isolado e devolvem só o
 * resultado. Toda a segurança (isolamento, descarte, verificação de
 * superadmin) vive no banco, não aqui.
 */

export type QaSituacao = "passou" | "falhou" | "nao_implementado" | "erro";

export interface QaBateria {
  id: string;
  iniciada_em: string;
  disparo: string;
  modulo_path: string;
  total: number;
  passou: number;
  falhou: number;
  nao_implementado: number;
  erro: number;
  duracao_ms: number | null;
  observacao: string | null;
  disparada_por_nome: string | null;
}

export interface QaResultado {
  codigo: string;
  situacao: QaSituacao;
  passo_ordem: number | null;
  passo_acao: string | null;
  esperado: string | null;
  obtido: string | null;
  erro_tecnico: string | null;
  duracao_ms: number | null;
}

export interface QaModuloTestavel {
  modulo_path: string;
  label: string;
  casos_executaveis: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (fn: string, args?: Record<string, unknown>) =>
  (supabase.rpc as any)(fn, args);

export function useQaRunner() {
  const qc = useQueryClient();

  /** Módulos que têm ao menos um caso executável — alimenta o seletor. */
  const { data: modulos = [], isLoading: carregandoModulos } = useQuery({
    queryKey: ["qa_modulos_testaveis"],
    queryFn: async (): Promise<QaModuloTestavel[]> => {
      const { data, error } = await rpc("qa_modulos_testaveis");
      if (error) throw error;
      return (data || []) as QaModuloTestavel[];
    },
  });

  /** Histórico das últimas baterias. */
  const { data: baterias = [], isLoading: carregandoBaterias } = useQuery({
    queryKey: ["qa_baterias"],
    queryFn: async (): Promise<QaBateria[]> => {
      const { data, error } = await rpc("qa_listar_baterias", { p_limite: 20 });
      if (error) throw error;
      return (data || []) as QaBateria[];
    },
  });

  /** Dispara uma bateria e espera ela terminar (roda no banco, síncrona). */
  const disparar = useMutation({
    mutationFn: async (moduloPath: string): Promise<string> => {
      const { data, error } = await rpc("qa_disparar_bateria", {
        p_modulo: moduloPath,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qa_baterias"] });
      toast.success("Bateria concluída");
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Falha ao rodar a bateria";
      toast.error(msg);
    },
  });

  return {
    modulos,
    carregandoModulos,
    baterias,
    carregandoBaterias,
    disparar,
  };
}

/** Resultados de uma bateria específica — carregado ao abrir o relatório. */
export function useQaResultados(execucaoId: string | null) {
  return useQuery({
    queryKey: ["qa_resultados", execucaoId],
    enabled: !!execucaoId,
    queryFn: async (): Promise<QaResultado[]> => {
      const { data, error } = await rpc("qa_resultados_da_bateria", {
        p_execucao_id: execucaoId,
      });
      if (error) throw error;
      return (data || []) as QaResultado[];
    },
  });
}

export interface QaDiaAgenda {
  dia_semana: number;
  dia_nome: string;
  ligado: boolean;
  hora: number;
  minuto: number;
}

/** Agendamento por dia da semana (superadmin). */
export function useQaAgendamento() {
  const qc = useQueryClient();

  const { data: dias = [], isLoading: carregando } = useQuery({
    queryKey: ["qa_agendamento_dias"],
    queryFn: async (): Promise<QaDiaAgenda[]> => {
      const { data, error } = await rpc("qa_agendamento_ler_dias");
      if (error) throw error;
      return (data || []) as QaDiaAgenda[];
    },
  });

  const { data: proxima } = useQuery({
    queryKey: ["qa_agendamento_proxima"],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await rpc("qa_agendamento_proxima");
      if (error) throw error;
      // a rpc devolve um escalar; supabase embrulha em [{qa_agendamento_proxima: ...}]
      if (Array.isArray(data)) {
        const row = data[0] as Record<string, unknown> | undefined;
        return (row ? Object.values(row)[0] : null) as string | null;
      }
      return (data as string) ?? null;
    },
  });

  const salvarDia = useMutation({
    mutationFn: async (d: {
      dia: number;
      ligado: boolean;
      hora: number;
      minuto: number;
    }): Promise<string> => {
      const { data, error } = await rpc("qa_agendamento_salvar_dia", {
        p_dia: d.dia,
        p_ligado: d.ligado,
        p_hora: d.hora,
        p_minuto: d.minuto,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qa_agendamento_dias"] });
      qc.invalidateQueries({ queryKey: ["qa_agendamento_proxima"] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar o dia");
    },
  });

  return { dias, proxima, carregando, salvarDia };
}
