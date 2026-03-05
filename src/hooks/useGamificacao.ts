import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { handleMutationError } from "@/lib/toastError";

export interface Medalha {
  id: string;
  tenant_id: string;
  nome: string;
  descricao: string | null;
  icone: string;
  cor: string;
  tipo: string;
  criterio: Record<string, unknown>;
  pontos_bonus: number;
  ativo: boolean;
  created_at: string;
}

export interface MedalhaConquistada {
  id: string;
  tenant_id: string;
  medalha_id: string;
  colaborador_id: string;
  colaborador_nome: string;
  trilha_id: string | null;
  data_conquista: string;
  created_at: string;
  // joined
  medalha?: Medalha;
}

export interface Certificado {
  id: string;
  tenant_id: string;
  trilha_id: string;
  colaborador_id: string;
  colaborador_nome: string;
  data_conclusao: string;
  pontos_obtidos: number;
  codigo: string;
  created_at: string;
  // joined
  trilha_nome?: string;
}

export interface RankingEntry {
  colaborador_id: string;
  colaborador_nome: string;
  total_pontos: number;
  trilhas_concluidas: number;
  medalhas_count: number;
}

export function useGamificacao() {
  const { tenantId, user } = useAuth();
  const colaboradorId = user?.id;
  const qc = useQueryClient();

  // My medals
  const { data: minhasMedalhas = [], isLoading: loadingMedalhas } = useQuery({
    queryKey: ["minhas_medalhas", tenantId, colaboradorId],
    queryFn: async () => {
      if (!tenantId || !colaboradorId) return [];
      const { data, error } = await supabase
        .from("trilha_medalhas_colaboradores" as never)
        .select("*, medalha:trilha_medalhas(*)")
        .eq("tenant_id", tenantId)
        .eq("colaborador_id", colaboradorId)
        .order("data_conquista", { ascending: false }) as { data: any[] | null; error: Error | null };
      if (error) throw error;
      const result = (data || []).map((d) => ({
        ...d,
        medalha: Array.isArray(d.medalha) ? d.medalha[0] : d.medalha,
      })) as MedalhaConquistada[];
      return result;
    },
    enabled: !!tenantId && !!colaboradorId,
  });

  // My certificates
  const { data: meusCertificados = [], isLoading: loadingCertificados } = useQuery({
    queryKey: ["meus_certificados", tenantId, colaboradorId],
    queryFn: async () => {
      if (!tenantId || !colaboradorId) return [];
      const { data, error } = await supabase
        .from("trilha_certificados" as never)
        .select("*, trilha:trilhas(nome)")
        .eq("tenant_id", tenantId)
        .eq("colaborador_id", colaboradorId)
        .order("data_conclusao", { ascending: false }) as { data: any[] | null; error: Error | null };
      if (error) throw error;
      const result = (data || []).map((d) => {
        const trilhaData = Array.isArray(d.trilha) ? d.trilha[0] : d.trilha;
        return { ...d, trilha_nome: trilhaData?.nome || "Trilha" };
      }) as Certificado[];
      return result;
    },
    enabled: !!tenantId && !!colaboradorId,
  });

  // Ranking (all collaborators)
  const { data: ranking = [], isLoading: loadingRanking } = useQuery({
    queryKey: ["trilha_ranking", tenantId],
    queryFn: async (): Promise<RankingEntry[]> => {
      if (!tenantId) return [];

      // Get all progress for the tenant
      const { data: progressos, error } = await supabase
        .from("trilha_progresso" as never)
        .select("colaborador_id, colaborador_nome, pontos_obtidos, status, trilha_id")
        .eq("tenant_id", tenantId)
        .eq("status", "concluido") as { data: any[] | null; error: Error | null };
      if (error) throw error;
      if (!progressos?.length) return [];

      // Get medal counts
      const { data: medalhas } = await supabase
        .from("trilha_medalhas_colaboradores" as never)
        .select("colaborador_id")
        .eq("tenant_id", tenantId) as { data: any[] | null; error: Error | null };

      // Get certificate counts
      const { data: certs } = await supabase
        .from("trilha_certificados" as never)
        .select("colaborador_id")
        .eq("tenant_id", tenantId) as { data: any[] | null; error: Error | null };

      // Aggregate
      const map = new Map<string, RankingEntry>();
      for (const p of progressos) {
        const existing = map.get(p.colaborador_id);
        if (existing) {
          existing.total_pontos += p.pontos_obtidos || 0;
        } else {
          map.set(p.colaborador_id, {
            colaborador_id: p.colaborador_id,
            colaborador_nome: p.colaborador_nome,
            total_pontos: p.pontos_obtidos || 0,
            trilhas_concluidas: 0,
            medalhas_count: 0,
          });
        }
      }

      // Count unique trilhas concluidas per user
      for (const entry of map.values()) {
        entry.trilhas_concluidas = (certs || []).filter(
          (c: any) => c.colaborador_id === entry.colaborador_id
        ).length;
        entry.medalhas_count = (medalhas || []).filter(
          (m: any) => m.colaborador_id === entry.colaborador_id
        ).length;
      }

      return Array.from(map.values()).sort((a, b) => b.total_pontos - a.total_pontos);
    },
    enabled: !!tenantId,
  });

  // All medal definitions (for admin)
  const { data: medalhasConfig = [], isLoading: loadingConfig } = useQuery({
    queryKey: ["trilha_medalhas_config", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("trilha_medalhas" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at") as { data: Medalha[] | null; error: Error | null };
      if (error) throw error;
      return (data || []) as Medalha[];
    },
    enabled: !!tenantId,
  });

  const criarMedalhaMut = useMutation({
    mutationFn: async (input: Partial<Medalha> & { nome: string }) => {
      if (!tenantId) throw new Error("Sem contexto");
      const { data, error } = await supabase
        .from("trilha_medalhas" as never)
        .insert({ tenant_id: tenantId, ...input } as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trilha_medalhas_config"] });
      toast.success("Medalha criada!");
    },
    onError: handleMutationError,
  });

  const excluirMedalhaMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trilha_medalhas" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trilha_medalhas_config"] });
      toast.success("Medalha removida!");
    },
    onError: handleMutationError,
  });

  return {
    minhasMedalhas,
    meusCertificados,
    ranking,
    medalhasConfig,
    loadingMedalhas,
    loadingCertificados,
    loadingRanking,
    loadingConfig,
    criarMedalha: criarMedalhaMut.mutateAsync,
    excluirMedalha: excluirMedalhaMut.mutateAsync,
    criandoMedalha: criarMedalhaMut.isPending,
  };
}
