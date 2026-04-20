import { useQuery } from "@tanstack/react-query";
import { fromTable } from "@/integrations/supabase/untypedClient";

export interface EscalaPeriodoRow {
  id: string;
  escala_id: string;
  dia_semana: string;
  ordem_bloco: number;
  hora_inicio: string;
  hora_fim: string;
}

export interface EscalaRecorrenciaRow {
  id: string;
  escala_id: string;
  descricao: string | null;
  ordinal_mes: string;
  dia_semana: string;
  hora_inicio: string;
  hora_fim: string;
  observacao: string | null;
}

const ORDEM_DIAS = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"];

export function useEscalaDetalhes(escalaId: string | null | undefined) {
  const periodosQuery = useQuery({
    queryKey: ["ponto-escala-periodos", escalaId],
    queryFn: async (): Promise<EscalaPeriodoRow[]> => {
      if (!escalaId) return [];
      const { data, error } = await fromTable("ponto_escala_periodos")
        .select("*")
        .eq("escala_id", escalaId);
      if (error) throw error;
      const rows = (data || []) as EscalaPeriodoRow[];
      return rows.sort((a, b) => {
        const di = ORDEM_DIAS.indexOf(a.dia_semana) - ORDEM_DIAS.indexOf(b.dia_semana);
        return di !== 0 ? di : a.ordem_bloco - b.ordem_bloco;
      });
    },
    enabled: !!escalaId,
  });

  const recorrenciasQuery = useQuery({
    queryKey: ["ponto-escala-recorrencias", escalaId],
    queryFn: async (): Promise<EscalaRecorrenciaRow[]> => {
      if (!escalaId) return [];
      const { data, error } = await fromTable("ponto_escala_recorrencias")
        .select("*")
        .eq("escala_id", escalaId);
      if (error) throw error;
      return (data || []) as EscalaRecorrenciaRow[];
    },
    enabled: !!escalaId,
  });

  return {
    periodos: periodosQuery.data || [],
    recorrencias: recorrenciasQuery.data || [],
    loading: periodosQuery.isLoading || recorrenciasQuery.isLoading,
  };
}

export const DIAS_SEMANA_LABEL: Record<string, string> = {
  segunda: "Segunda",
  terca: "Terça",
  quarta: "Quarta",
  quinta: "Quinta",
  sexta: "Sexta",
  sabado: "Sábado",
  domingo: "Domingo",
};

export const ORDINAL_MES_LABEL: Record<string, string> = {
  "1": "1º",
  "2": "2º",
  "3": "3º",
  "4": "4º",
  ultimo: "Último",
  todos: "Todos",
};
