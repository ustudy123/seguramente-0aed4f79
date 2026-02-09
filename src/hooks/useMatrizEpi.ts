import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface CET {
  id: string;
  tenant_id: string;
  nome: string;
  descricao: string | null;
  norma_regulamentadora: string | null;
  icone: string | null;
  ativo: boolean;
}

export interface FuncaoEpi {
  id: string;
  cargo_id: string;
  epi_tipo_id: string;
  obrigatorio: boolean;
  justificativa: string | null;
  epi_tipo?: { id: string; nome: string; categoria: string | null };
}

export interface FuncaoCet {
  id: string;
  cargo_id: string;
  cet_id: string;
  observacao: string | null;
  cet?: CET;
}

export interface EpiCet {
  id: string;
  epi_tipo_id: string;
  cet_id: string;
}

export interface ProtecaoColaborador {
  colaborador_id: string;
  colaborador_nome: string;
  cargo: string;
  cargo_id: string | null;
  epis_exigidos: { epi_tipo_id: string; nome: string; obrigatorio: boolean }[];
  epis_entregues: { epi_tipo_id: string; nome: string; status: string; data_validade: string | null }[];
  cets: string[];
  conformidade: number; // 0-100
  alertas: string[];
}

const CETS_PADRAO = [
  { nome: "Trabalho em Altura", descricao: "Atividades acima de 2m do nível inferior", norma_regulamentadora: "NR-35", icone: "mountain" },
  { nome: "Espaço Confinado", descricao: "Acesso a espaços com ventilação limitada", norma_regulamentadora: "NR-33", icone: "box" },
  { nome: "Eletricidade", descricao: "Atividades em instalações elétricas e proximidades", norma_regulamentadora: "NR-10", icone: "zap" },
  { nome: "Agentes Químicos", descricao: "Exposição a substâncias químicas nocivas", norma_regulamentadora: "NR-15", icone: "flask-conical" },
  { nome: "Ruído", descricao: "Exposição a níveis elevados de ruído", norma_regulamentadora: "NR-15", icone: "volume-2" },
  { nome: "Trabalho Noturno", descricao: "Jornada de trabalho no período noturno", norma_regulamentadora: "NR-17", icone: "moon" },
  { nome: "Calor", descricao: "Exposição a fontes de calor intenso", norma_regulamentadora: "NR-15", icone: "thermometer" },
  { nome: "Radiação", descricao: "Exposição a radiações ionizantes ou não-ionizantes", norma_regulamentadora: "NR-15", icone: "radio" },
  { nome: "Máquinas e Equipamentos", descricao: "Operação de máquinas e equipamentos", norma_regulamentadora: "NR-12", icone: "cog" },
  { nome: "Trabalho com Inflamáveis", descricao: "Manuseio de líquidos e combustíveis inflamáveis", norma_regulamentadora: "NR-20", icone: "flame" },
];

export function useMatrizEpi() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  // ========== CETs ==========
  const cetsQuery = useQuery({
    queryKey: ["cets", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("condicoes_especiais_trabalho")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("nome");
      if (error) throw error;

      // Seed default CETs if empty
      if (data.length === 0) {
        const seeds = CETS_PADRAO.map((c) => ({ ...c, tenant_id: tenantId }));
        const { data: novas, error: seedErr } = await supabase
          .from("condicoes_especiais_trabalho")
          .insert(seeds)
          .select();
        if (seedErr) {
          console.error("Erro ao criar CETs padrão:", seedErr);
          return [] as CET[];
        }
        return novas as CET[];
      }
      return data as CET[];
    },
    enabled: !!tenantId,
  });

  // ========== Função × EPI ==========
  const funcaoEpisQuery = useQuery({
    queryKey: ["funcao-epis", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("funcao_epis")
        .select("*, epi_tipo:epi_tipos(id, nome, categoria)")
        .eq("tenant_id", tenantId);
      if (error) throw error;
      return data as FuncaoEpi[];
    },
    enabled: !!tenantId,
  });

  // ========== Função × CET ==========
  const funcaoCetsQuery = useQuery({
    queryKey: ["funcao-cets", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("funcao_cets")
        .select("*, cet:condicoes_especiais_trabalho(*)")
        .eq("tenant_id", tenantId);
      if (error) throw error;
      return data as FuncaoCet[];
    },
    enabled: !!tenantId,
  });

  // ========== EPI × CET ==========
  const epiCetsQuery = useQuery({
    queryKey: ["epi-cets", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("epi_cets")
        .select("*")
        .eq("tenant_id", tenantId);
      if (error) throw error;
      return data as EpiCet[];
    },
    enabled: !!tenantId,
  });

  // ========== MUTATIONS ==========
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["funcao-epis"] });
    queryClient.invalidateQueries({ queryKey: ["funcao-cets"] });
    queryClient.invalidateQueries({ queryKey: ["epi-cets"] });
    queryClient.invalidateQueries({ queryKey: ["cets"] });
  };

  const salvarMatrizFuncao = useMutation({
    mutationFn: async ({
      cargoId,
      episIds,
      episComplementaresIds,
      cetIds,
    }: {
      cargoId: string;
      episIds: string[];
      episComplementaresIds: string[];
      cetIds: string[];
    }) => {
      if (!tenantId) throw new Error("Tenant não identificado");

      // Delete existing for this cargo
      await supabase.from("funcao_epis").delete().eq("cargo_id", cargoId).eq("tenant_id", tenantId);
      await supabase.from("funcao_cets").delete().eq("cargo_id", cargoId).eq("tenant_id", tenantId);

      // Insert EPIs obrigatórios
      if (episIds.length > 0) {
        const rows = episIds.map((epiTipoId) => ({
          tenant_id: tenantId,
          cargo_id: cargoId,
          epi_tipo_id: epiTipoId,
          obrigatorio: true,
        }));
        const { error } = await supabase.from("funcao_epis").insert(rows);
        if (error) throw error;
      }

      // Insert EPIs complementares
      if (episComplementaresIds.length > 0) {
        const rows = episComplementaresIds.map((epiTipoId) => ({
          tenant_id: tenantId,
          cargo_id: cargoId,
          epi_tipo_id: epiTipoId,
          obrigatorio: false,
        }));
        const { error } = await supabase.from("funcao_epis").insert(rows);
        if (error) throw error;
      }

      // Insert CETs
      if (cetIds.length > 0) {
        const rows = cetIds.map((cetId) => ({
          tenant_id: tenantId,
          cargo_id: cargoId,
          cet_id: cetId,
        }));
        const { error } = await supabase.from("funcao_cets").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Matriz de proteção atualizada!");
    },
    onError: (error) => {
      toast.error("Erro ao salvar matriz: " + error.message);
    },
  });

  // ========== HELPERS ==========
  const getEpisPorCargo = (cargoId: string) => {
    return (funcaoEpisQuery.data || []).filter((fe) => fe.cargo_id === cargoId);
  };

  const getCetsPorCargo = (cargoId: string) => {
    return (funcaoCetsQuery.data || []).filter((fc) => fc.cargo_id === cargoId);
  };

  return {
    cets: cetsQuery.data || [],
    cetsLoading: cetsQuery.isLoading,
    funcaoEpis: funcaoEpisQuery.data || [],
    funcaoEpisLoading: funcaoEpisQuery.isLoading,
    funcaoCets: funcaoCetsQuery.data || [],
    funcaoCetsLoading: funcaoCetsQuery.isLoading,
    epiCets: epiCetsQuery.data || [],
    salvarMatrizFuncao: salvarMatrizFuncao.mutateAsync,
    salvandoMatriz: salvarMatrizFuncao.isPending,
    getEpisPorCargo,
    getCetsPorCargo,
    invalidateAll,
  };
}
