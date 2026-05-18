import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CampanhaPsicossocial } from "@/types/psicossocial";

/** Mínimo absoluto de respostas — ISO 45003 / COPSOQ III */
export const MIN_RESPOSTAS_ABS = 5;

export interface MinRespostasGheBreakdown {
  ghe_id: string;
  codigo: string;
  nome: string;
  elegiveis: number;
  ausencias: number;
  base: number;
  percentual: number;
  min: number;
}

export interface MinRespostasResult {
  /** Threshold mínimo de respostas para liberar resultados da campanha */
  minRespostas: number;
  /** Total elegíveis somando todos os GHEs */
  totalElegiveis: number;
  /** Base após descontar ausências justificadas */
  totalBase: number;
  /** Detalhamento por GHE */
  porGhe: MinRespostasGheBreakdown[];
  /** Indica se o cálculo veio da configuração de algum GHE (ou se é o mínimo absoluto fallback) */
  configurado: boolean;
  isLoading: boolean;
}

function ceilMin(elegiveis: number, ausencias: number, pct: number): number {
  const base = Math.max(0, elegiveis - Math.max(0, ausencias));
  const pctVal = Math.max(0, Math.min(100, pct || 0));
  const calc = Math.ceil((base * pctVal) / 100);
  return Math.max(MIN_RESPOSTAS_ABS, calc);
}

/**
 * Calcula o número mínimo de respostas necessário para liberar os resultados de
 * uma campanha psicossocial com base na configuração dos GHEs vinculados.
 *
 * Regra:
 *  - Para cada GHE: minGhe = max(5, ceil((elegíveis − ausências) × pct/100))
 *  - Total da campanha = soma dos minGhe (cada GHE tem sua própria população)
 *  - Se a campanha não tem GHEs, retorna o mínimo absoluto de 5.
 */
export function useMinRespostasCampanha(
  campanha: Pick<CampanhaPsicossocial, "id" | "tenant_id" | "empresa_id"> & { ghe_ids?: string[] | null },
): MinRespostasResult {
  const gheIds = campanha.ghe_ids || [];
  const hasGhes = gheIds.length > 0;

  const { data: ghes = [], isLoading: lGhe } = useQuery({
    queryKey: ["psicossocial-ghes-min", gheIds],
    enabled: hasGhes,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("psicossocial_ghe" as any)
        .select("id, codigo, nome, ausencias_justificadas, percentual_minimo")
        .in("id", gheIds);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: ghePairs = [], isLoading: lPairs } = useQuery({
    queryKey: ["psicossocial-ghe-pairs-min", gheIds],
    enabled: hasGhes,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("psicossocial_ghe_cargos" as any)
        .select("ghe_id, cargo_id, departamento_id")
        .in("ghe_id", gheIds);
      if (error) throw error;
      return (data || []) as unknown as { ghe_id: string; cargo_id: string | null; departamento_id: string | null }[];
    },
  });

  const cargoIds = Array.from(new Set(ghePairs.map(p => p.cargo_id).filter(Boolean) as string[]));
  const deptoIds = Array.from(new Set(ghePairs.map(p => p.departamento_id).filter(Boolean) as string[]));

  const { data: cargosMap = {} } = useQuery({
    queryKey: ["cargos-map-min", cargoIds],
    enabled: cargoIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("cargos").select("id, nome").in("id", cargoIds);
      if (error) throw error;
      return Object.fromEntries((data || []).map(c => [c.id, (c.nome || "").trim().toLowerCase()]));
    },
  });

  const { data: deptosMap = {} } = useQuery({
    queryKey: ["deptos-map-min", deptoIds],
    enabled: deptoIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("departamentos").select("id, nome").in("id", deptoIds);
      if (error) throw error;
      return Object.fromEntries((data || []).map(d => [d.id, (d.nome || "").trim().toLowerCase()]));
    },
  });

  const { data: admissoes = [], isLoading: lAdm } = useQuery({
    queryKey: ["admissoes-empresa-min", campanha.empresa_id, campanha.tenant_id],
    enabled: hasGhes && !!campanha.empresa_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admissoes")
        .select("cargo, departamento, status")
        .eq("empresa_id", campanha.empresa_id!)
        .eq("tenant_id", campanha.tenant_id);
      if (error) throw error;
      return (data || []) as { cargo: string | null; departamento: string | null; status: string | null }[];
    },
  });

  if (!hasGhes) {
    return {
      minRespostas: MIN_RESPOSTAS_ABS,
      totalElegiveis: 0,
      totalBase: 0,
      porGhe: [],
      configurado: false,
      isLoading: false,
    };
  }

  const porGhe: MinRespostasGheBreakdown[] = ghes.map((g: any) => {
    const pairs = ghePairs.filter(p => p.ghe_id === g.id);
    const keys = new Set(
      pairs.map(p => {
        const c = p.cargo_id ? (cargosMap as Record<string, string>)[p.cargo_id] || "" : "";
        const d = p.departamento_id ? (deptosMap as Record<string, string>)[p.departamento_id] || "" : "";
        return `${c}|${d}`;
      }).filter(k => k !== "|"),
    );
    const elegiveis = admissoes.filter(a => {
      const status = (a.status || "").toLowerCase();
      if (status && ["desligado", "demitido", "inativo"].includes(status)) return false;
      const key = `${(a.cargo || "").trim().toLowerCase()}|${(a.departamento || "").trim().toLowerCase()}`;
      return keys.has(key);
    }).length;
    const ausencias = Number(g.ausencias_justificadas ?? 0);
    const pct = Number(g.percentual_minimo ?? 0);
    const base = Math.max(0, elegiveis - ausencias);
    return {
      ghe_id: g.id,
      codigo: g.codigo,
      nome: g.nome,
      elegiveis,
      ausencias,
      base,
      percentual: pct,
      min: ceilMin(elegiveis, ausencias, pct),
    };
  });

  const totalElegiveis = porGhe.reduce((s, x) => s + x.elegiveis, 0);
  const totalBase = porGhe.reduce((s, x) => s + x.base, 0);
  const minRespostas = porGhe.length > 0
    ? Math.max(MIN_RESPOSTAS_ABS, porGhe.reduce((s, x) => s + x.min, 0))
    : MIN_RESPOSTAS_ABS;
  const configurado = porGhe.some(x => x.percentual > 0 || x.ausencias > 0);

  return {
    minRespostas,
    totalElegiveis,
    totalBase,
    porGhe,
    configurado,
    isLoading: lGhe || lPairs || lAdm,
  };
}
