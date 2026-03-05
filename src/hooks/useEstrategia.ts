import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { toast } from "sonner";
import type {
  EstrategiaSwot,
  SwotItem,
  SwotTipo,
  SwotClassificacao,
  SwotImpacto,
  EstrategiaOceanoAzul,
  OceanoItem,
  OceanoQuadrante,
  EstrategiaCultura,
  EstrategiaOrganograma,
} from "@/types/estrategia";

export function useEstrategia() {
  const { tenantId, user } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();
  const qc = useQueryClient();

  // ─── SWOT ───
  const { data: swots = [], isLoading: loadingSwots } = useQuery({
    queryKey: ["estrategia_swot", tenantId, empresaAtivaId],
    queryFn: async () => {
      if (!tenantId) return [];
      let q = supabase
        .from("estrategia_swot" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (empresaAtivaId) q = q.eq("empresa_id", empresaAtivaId);
      const { data, error } = await q as { data: EstrategiaSwot[] | null; error: Error | null };
      if (error) throw error;
      return (data || []) as EstrategiaSwot[];
    },
    enabled: !!tenantId,
  });

  const createSwot = useMutation({
    mutationFn: async (input: { titulo: string; descricao?: string; escopo?: string; unidade?: string; periodo?: string; projeto?: string }) => {
      const { data, error } = await supabase
        .from("estrategia_swot" as never)
        .insert({ ...input, tenant_id: tenantId, empresa_id: empresaAtivaId || null, criado_por: user?.id, criado_por_nome: user?.user_metadata?.nome || user?.email } as never)
        .select()
        .single() as { data: EstrategiaSwot | null; error: Error | null };
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["estrategia_swot"] }); toast.success("Análise SWOT criada"); },
    onError: () => toast.error("Erro ao criar SWOT"),
  });

  const deleteSwot = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("estrategia_swot" as never).delete().eq("id", id) as { error: Error | null };
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["estrategia_swot"] }); toast.success("SWOT removida"); },
  });

  // ─── SWOT Items ───
  const useSwotItens = (swotId: string | null) =>
    useQuery({
      queryKey: ["estrategia_swot_itens", swotId],
      queryFn: async () => {
        if (!swotId) return [];
        const { data, error } = await supabase
          .from("estrategia_swot_itens" as never)
          .select("*")
          .eq("swot_id", swotId)
          .order("ordem") as { data: SwotItem[] | null; error: Error | null };
        if (error) throw error;
        return (data || []) as SwotItem[];
      },
      enabled: !!swotId,
    });

  const createSwotItem = useMutation({
    mutationFn: async (input: { swot_id: string; tipo: SwotTipo; descricao: string; classificacao?: SwotClassificacao; impacto?: SwotImpacto }) => {
      const { error } = await supabase
        .from("estrategia_swot_itens" as never)
        .insert({ ...input, tenant_id: tenantId } as never) as { error: Error | null };
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["estrategia_swot_itens"] }); },
  });

  const deleteSwotItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("estrategia_swot_itens" as never).delete().eq("id", id) as { error: Error | null };
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["estrategia_swot_itens"] }); },
  });

  // ─── Oceano Azul ───
  const { data: oceanos = [], isLoading: loadingOceanos } = useQuery({
    queryKey: ["estrategia_oceano_azul", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("estrategia_oceano_azul" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }) as { data: EstrategiaOceanoAzul[] | null; error: Error | null };
      if (error) throw error;
      return (data || []) as EstrategiaOceanoAzul[];
    },
    enabled: !!tenantId,
  });

  const createOceano = useMutation({
    mutationFn: async (input: { titulo: string; descricao?: string; swot_id?: string }) => {
      const { data, error } = await supabase
        .from("estrategia_oceano_azul" as never)
        .insert({ ...input, tenant_id: tenantId, criado_por: user?.id, criado_por_nome: user?.user_metadata?.nome || user?.email } as never)
        .select()
        .single() as { data: EstrategiaOceanoAzul | null; error: Error | null };
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["estrategia_oceano_azul"] }); toast.success("Matriz Oceano Azul criada"); },
  });

  const deleteOceano = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("estrategia_oceano_azul" as never).delete().eq("id", id) as { error: Error | null };
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["estrategia_oceano_azul"] }); toast.success("Matriz removida"); },
  });

  const useOceanoItens = (oceanoId: string | null) =>
    useQuery({
      queryKey: ["estrategia_oceano_itens", oceanoId],
      queryFn: async () => {
        if (!oceanoId) return [];
        const { data, error } = await supabase
          .from("estrategia_oceano_itens" as never)
          .select("*")
          .eq("oceano_id", oceanoId)
          .order("ordem") as { data: OceanoItem[] | null; error: Error | null };
        if (error) throw error;
        return (data || []) as OceanoItem[];
      },
      enabled: !!oceanoId,
    });

  const createOceanoItem = useMutation({
    mutationFn: async (input: { oceano_id: string; quadrante: OceanoQuadrante; descricao: string; swot_item_id?: string }) => {
      const { error } = await supabase
        .from("estrategia_oceano_itens" as never)
        .insert({ ...input, tenant_id: tenantId } as never) as { error: Error | null };
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["estrategia_oceano_itens"] }); },
  });

  const deleteOceanoItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("estrategia_oceano_itens" as never).delete().eq("id", id) as { error: Error | null };
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["estrategia_oceano_itens"] }); },
  });

  // ─── Cultura ───
  const { data: cultura, isLoading: loadingCultura } = useQuery({
    queryKey: ["estrategia_cultura", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from("estrategia_cultura" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle() as { data: EstrategiaCultura | null; error: Error | null };
      if (error) throw error;
      return data as EstrategiaCultura | null;
    },
    enabled: !!tenantId,
  });

  const upsertCultura = useMutation({
    mutationFn: async (input: Partial<EstrategiaCultura>) => {
      const payload = { ...input, tenant_id: tenantId, criado_por: user?.id, criado_por_nome: user?.user_metadata?.nome || user?.email };
      const { error } = await supabase
        .from("estrategia_cultura" as never)
        .upsert(payload as never, { onConflict: "tenant_id" }) as { error: Error | null };
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["estrategia_cultura"] }); toast.success("Cultura salva"); },
    onError: () => toast.error("Erro ao salvar cultura"),
  });

  // ─── Organograma ───
  const { data: organograma = [], isLoading: loadingOrganograma } = useQuery({
    queryKey: ["estrategia_organograma", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("estrategia_organograma" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("ordem") as { data: EstrategiaOrganograma[] | null; error: Error | null };
      if (error) throw error;
      return (data || []) as EstrategiaOrganograma[];
    },
    enabled: !!tenantId,
  });

  const createOrgNode = useMutation({
    mutationFn: async (input: { titulo: string; parent_id?: string; cargo_id?: string; departamento_id?: string; nome_ocupante?: string; tipo?: string }) => {
      const { error } = await supabase
        .from("estrategia_organograma" as never)
        .insert({ ...input, tenant_id: tenantId } as never) as { error: Error | null };
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["estrategia_organograma"] }); toast.success("Posição adicionada"); },
  });

  const updateOrgNode = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<EstrategiaOrganograma>) => {
      const { error } = await supabase
        .from("estrategia_organograma" as never)
        .update(updates as never)
        .eq("id", id) as { error: Error | null };
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["estrategia_organograma"] }); },
  });

  const deleteOrgNode = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("estrategia_organograma" as never).delete().eq("id", id) as { error: Error | null };
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["estrategia_organograma"] }); toast.success("Posição removida"); },
  });

  return {
    // SWOT
    swots, loadingSwots, createSwot, deleteSwot, useSwotItens, createSwotItem, deleteSwotItem,
    // Oceano
    oceanos, loadingOceanos, createOceano, deleteOceano, useOceanoItens, createOceanoItem, deleteOceanoItem,
    // Cultura
    cultura, loadingCultura, upsertCultura,
    // Organograma
    organograma, loadingOrganograma, createOrgNode, updateOrgNode, deleteOrgNode,
  };
}
