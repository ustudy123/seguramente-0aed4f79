import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import type { NotasCriterios } from "@/types/avaliacao";

export interface ResultadosCicloData {
  ciclos: Array<{ id: string; nome: string; status: string }>;
  resumo: {
    mediaGeral: number;
    totalConcluidas: number;
    totalRespostas: number;
    taxaParticipacao: number;
    pdisGerados: number;
  };
  distribuicao: Array<{ nota: string; quantidade: number; fill: string }>;
  porSetor: Array<{ setor: string; media: number; colaboradores: number }>;
  topColaboradores: Array<{
    nome: string;
    setor: string;
    nota: number;
  }>;
  dimensoes: Array<{ dimensao: string; media: number }>;
}

const NOTE_FILLS = [
  "hsl(0, 70%, 55%)",
  "hsl(30, 70%, 55%)",
  "hsl(200, 70%, 55%)",
  "hsl(140, 70%, 55%)",
  "hsl(160, 70%, 45%)",
];

export function useResultadosAvaliacao(selectedCicloId?: string) {
  const { tenantId } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();

  const { data: ciclos = [], isLoading: isLoadingCiclos } = useQuery({
    queryKey: ["avaliacao-ciclos-resultados", tenantId, empresaAtivaId],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from("avaliacao_ciclos")
        .select("id, nome, status, data_inicio, data_fim")
        .eq("tenant_id", tenantId)
        .order("data_inicio", { ascending: false });
      if (empresaAtivaId) query = query.eq("empresa_id", empresaAtivaId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const cicloId = selectedCicloId || ciclos[0]?.id;

  const { data: respostas = [], isLoading: isLoadingRespostas } = useQuery({
    queryKey: ["avaliacao-respostas-resultados", tenantId, cicloId],
    queryFn: async () => {
      if (!tenantId || !cicloId) return [];
      const { data, error } = await supabase
        .from("avaliacao_respostas")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("ciclo_id", cicloId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && !!cicloId,
  });

  const { data: pdisCount = 0 } = useQuery({
    queryKey: ["pdis-count-avaliacao", tenantId, cicloId],
    queryFn: async () => {
      if (!tenantId || !cicloId) return 0;
      const cicloNome = ciclos.find(c => c.id === cicloId)?.nome || "";
      const { count, error } = await supabase
        .from("pdis")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .ilike("gatilho", `%avaliacao%`);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!tenantId && !!cicloId,
  });

  // Compute derived data
  const concluidas = respostas.filter(r => r.status === "concluida");
  const totalRespostas = respostas.length;
  const totalConcluidas = concluidas.length;
  const mediaGeral = concluidas.length > 0
    ? Math.round((concluidas.reduce((sum, r) => sum + (r.nota_geral || 0), 0) / concluidas.length) * 10) / 10
    : 0;
  const taxaParticipacao = totalRespostas > 0 ? Math.round((totalConcluidas / totalRespostas) * 100) : 0;

  // Distribution by note range
  const distribuicao = [
    { nota: "1 – Insuficiente", range: [1, 1.99] },
    { nota: "2 – Em Desenv.", range: [2, 2.99] },
    { nota: "3 – Atende", range: [3, 3.99] },
    { nota: "4 – Supera", range: [4, 4.99] },
    { nota: "5 – Excepcional", range: [5, 5] },
  ].map((bucket, i) => ({
    nota: bucket.nota,
    fill: NOTE_FILLS[i],
    quantidade: concluidas.filter(r => {
      const n = r.nota_geral || 0;
      return n >= bucket.range[0] && n <= bucket.range[1];
    }).length,
  }));

  // Top performers
  const topColaboradores = [...concluidas]
    .sort((a, b) => (b.nota_geral || 0) - (a.nota_geral || 0))
    .slice(0, 5)
    .map(r => ({
      nome: r.avaliado_nome,
      setor: "—",
      nota: r.nota_geral || 0,
    }));

  // Dimension averages from notas_criterios
  const dimensaoMap: Record<string, number[]> = {};
  concluidas.forEach(r => {
    const notas = (r.notas_criterios as unknown as NotasCriterios) || {};
    Object.entries(notas).forEach(([criterioId, nota]) => {
      if (!dimensaoMap[criterioId]) dimensaoMap[criterioId] = [];
      dimensaoMap[criterioId].push(nota as number);
    });
  });

  const dimensoes = Object.entries(dimensaoMap)
    .slice(0, 6)
    .map(([dim, notas]) => ({
      dimensao: dim.length > 12 ? dim.slice(0, 12) + "…" : dim,
      media: Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10,
    }));

  const resumo = {
    mediaGeral,
    totalConcluidas,
    totalRespostas,
    taxaParticipacao,
    pdisGerados: pdisCount,
  };

  return {
    ciclos,
    cicloId,
    resumo,
    distribuicao,
    topColaboradores,
    dimensoes,
    isLoading: isLoadingCiclos || isLoadingRespostas,
    hasDados: concluidas.length > 0,
  };
}
