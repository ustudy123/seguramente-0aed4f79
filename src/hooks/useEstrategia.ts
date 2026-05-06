import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { toast } from "sonner";
import type { EstrategiaEscopo } from "@/components/estrategia/EstrategiaEscopoSelector";
import type {
  EstrategiaSwot, SwotItem, SwotTipo, SwotClassificacao, SwotImpacto,
  EstrategiaOceanoAzul, OceanoItem, OceanoQuadrante,
  EstrategiaCultura, EstrategiaOrganograma,
} from "@/types/estrategia";

export function useEstrategia(escopo?: EstrategiaEscopo) {
  const { tenantId, user } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();
  const qc = useQueryClient();

  const isGrupo = escopo?.tipo === "grupo";
  const grupoId = isGrupo ? escopo.grupoId : null;

  // Helper: apply scope filter to a query
  function applyScope(q: any) {
    if (isGrupo && grupoId) return q.eq("grupo_economico_id", grupoId);
    if (empresaAtivaId) return q.eq("empresa_id", empresaAtivaId);
    return q;
  }

  // Helper: scope payload for insert/upsert
  function scopePayload() {
    if (isGrupo && grupoId) return { grupo_economico_id: grupoId, empresa_id: null };
    return { empresa_id: empresaAtivaId || null, grupo_economico_id: null };
  }

  const scopeKey = isGrupo ? grupoId : empresaAtivaId;

  // ─── SWOT ───
  const { data: swots = [], isLoading: loadingSwots } = useQuery({
    queryKey: ["estrategia_swot", tenantId, scopeKey, isGrupo],
    queryFn: async () => {
      if (!tenantId) return [];
      let q = fromTable("estrategia_swot").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
      q = applyScope(q);
      const { data, error } = await q as { data: EstrategiaSwot[] | null; error: Error | null };
      if (error) throw error;
      return (data || []) as EstrategiaSwot[];
    },
    enabled: !!tenantId,
  });

  const createSwot = useMutation({
    mutationFn: async (input: { titulo: string; descricao?: string; escopo?: string; unidade?: string; periodo?: string; projeto?: string }) => {
      const { data, error } = await fromTable("estrategia_swot")
        .insert({ ...input, tenant_id: tenantId, ...scopePayload(), criado_por: user?.id, criado_por_nome: user?.user_metadata?.nome || user?.email } as any)
        .select().single() as { data: EstrategiaSwot | null; error: Error | null };
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["estrategia_swot"] }); toast.success("Análise SWOT criada"); },
    onError: () => toast.error("Erro ao criar SWOT"),
  });

  const deleteSwot = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable("estrategia_swot").delete().eq("id", id) as { error: Error | null };
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
        const { data, error } = await fromTable("estrategia_swot_itens").select("*").eq("swot_id", swotId).order("ordem") as { data: SwotItem[] | null; error: Error | null };
        if (error) throw error;
        return (data || []) as SwotItem[];
      },
      enabled: !!swotId,
    });

  const createSwotItem = useMutation({
    mutationFn: async (input: { swot_id: string; tipo: SwotTipo; descricao: string; classificacao?: SwotClassificacao; impacto?: SwotImpacto }) => {
      const { error } = await fromTable("estrategia_swot_itens").insert({ ...input, tenant_id: tenantId } as any) as { error: Error | null };
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["estrategia_swot_itens"] }); },
  });

  const deleteSwotItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable("estrategia_swot_itens").delete().eq("id", id) as { error: Error | null };
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["estrategia_swot_itens"] }); },
  });

  // ─── Oceano Azul ───
  const { data: oceanos = [], isLoading: loadingOceanos } = useQuery({
    queryKey: ["estrategia_oceano_azul", tenantId, scopeKey, isGrupo],
    queryFn: async () => {
      if (!tenantId) return [];
      let q = fromTable("estrategia_oceano_azul").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
      q = applyScope(q);
      const { data, error } = await q as { data: EstrategiaOceanoAzul[] | null; error: Error | null };
      if (error) throw error;
      return (data || []) as EstrategiaOceanoAzul[];
    },
    enabled: !!tenantId,
  });

  const createOceano = useMutation({
    mutationFn: async (input: { titulo: string; descricao?: string; swot_id?: string }) => {
      const { data, error } = await fromTable("estrategia_oceano_azul")
        .insert({ ...input, tenant_id: tenantId, ...scopePayload(), criado_por: user?.id, criado_por_nome: user?.user_metadata?.nome || user?.email } as any)
        .select().single() as { data: EstrategiaOceanoAzul | null; error: Error | null };
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["estrategia_oceano_azul"] }); toast.success("Matriz Oceano Azul criada"); },
  });

  const deleteOceano = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable("estrategia_oceano_azul").delete().eq("id", id) as { error: Error | null };
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["estrategia_oceano_azul"] }); toast.success("Matriz removida"); },
  });

  const useOceanoItens = (oceanoId: string | null) =>
    useQuery({
      queryKey: ["estrategia_oceano_itens", oceanoId],
      queryFn: async () => {
        if (!oceanoId) return [];
        const { data, error } = await fromTable("estrategia_oceano_itens").select("*").eq("oceano_id", oceanoId).order("ordem") as { data: OceanoItem[] | null; error: Error | null };
        if (error) throw error;
        return (data || []) as OceanoItem[];
      },
      enabled: !!oceanoId,
    });

  const createOceanoItem = useMutation({
    mutationFn: async (input: { oceano_id: string; quadrante: OceanoQuadrante; descricao: string; swot_item_id?: string }) => {
      const { error } = await fromTable("estrategia_oceano_itens").insert({ ...input, tenant_id: tenantId } as any) as { error: Error | null };
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["estrategia_oceano_itens"] }); },
  });

  const deleteOceanoItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable("estrategia_oceano_itens").delete().eq("id", id) as { error: Error | null };
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["estrategia_oceano_itens"] }); },
  });

  // ─── Cultura ───
  const { data: cultura, isLoading: loadingCultura } = useQuery({
    queryKey: ["estrategia_cultura", tenantId, scopeKey, isGrupo],
    queryFn: async () => {
      if (!tenantId) return null;
      let q = fromTable("estrategia_cultura").select("*").eq("tenant_id", tenantId);
      q = applyScope(q);
      const { data, error } = await (q as any).maybeSingle() as { data: EstrategiaCultura | null; error: Error | null };
      if (error) throw error;
      return data as EstrategiaCultura | null;
    },
    enabled: !!tenantId,
  });

  const upsertCultura = useMutation({
    mutationFn: async (input: Partial<EstrategiaCultura>) => {
      const payload = { ...input, tenant_id: tenantId, ...scopePayload(), criado_por: user?.id, criado_por_nome: user?.user_metadata?.nome || user?.email };
      // Always update by id when there is already a record for the active scope, else insert.
      // This guarantees isolation per empresa / per grupo (avoiding overwriting other companies).
      if (cultura?.id) {
        const { error } = await fromTable("estrategia_cultura").update(payload as any).eq("id", cultura.id) as { error: Error | null };
        if (error) throw error;
      } else {
        const { error } = await fromTable("estrategia_cultura").insert(payload as any) as { error: Error | null };
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["estrategia_cultura"] }); toast.success("Cultura salva"); },
    onError: () => toast.error("Erro ao salvar cultura"),
  });

  // ─── Organograma ───
  const { data: organograma = [], isLoading: loadingOrganograma } = useQuery({
    queryKey: ["estrategia_organograma", tenantId, scopeKey, isGrupo],
    queryFn: async () => {
      if (!tenantId) return [];
      let q = fromTable("estrategia_organograma").select(`
        *,
        colaborador:colaborador_id (
          id,
          nome_completo,
          foto_url
        )
      `).eq("tenant_id", tenantId).order("ordem");
      q = applyScope(q);
      const { data, error } = await q as { data: any[] | null; error: Error | null };
      if (error) throw error;
      return (data || []) as (EstrategiaOrganograma & { colaborador?: any })[];
    },
    enabled: !!tenantId,
  });

  const createOrgNode = useMutation({
    mutationFn: async (input: { titulo: string; parent_id?: string; cargo_id?: string; departamento_id?: string; nome_ocupante?: string; colaborador_id?: string; tipo?: string }) => {
      const { data, error } = await fromTable("estrategia_organograma").insert({ ...input, tenant_id: tenantId, ...scopePayload() } as any).select().single() as { data: EstrategiaOrganograma | null; error: Error | null };
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["estrategia_organograma"] }); toast.success("Posição adicionada"); },
  });

  const updateOrgNode = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<EstrategiaOrganograma>) => {
      const { error } = await fromTable("estrategia_organograma").update(updates as any).eq("id", id) as { error: Error | null };
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["estrategia_organograma"] }); },
  });

  const deleteOrgNode = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable("estrategia_organograma").delete().eq("id", id) as { error: Error | null };
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["estrategia_organograma"] }); toast.success("Posição removida"); },
  });

  return {
    swots, loadingSwots, createSwot, deleteSwot, useSwotItens, createSwotItem, deleteSwotItem,
    oceanos, loadingOceanos, createOceano, deleteOceano, useOceanoItens, createOceanoItem, deleteOceanoItem,
    cultura, loadingCultura, upsertCultura,
    organograma, loadingOrganograma, createOrgNode, updateOrgNode, deleteOrgNode,
  };
}
