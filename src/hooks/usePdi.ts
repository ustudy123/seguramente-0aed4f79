import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { toast } from "sonner";
import type {
  Pdi, PdiInsert, PdiStatus,
  PdiMeta, PdiMetaInsert, PdiMetaStatus, PdiMetaCategoria, PdiCheckinFrequencia,
  PdiAcao, PdiAcaoInsert, PdiAcaoStatus, PdiAcaoTipo,
  PdiCheckin, PdiCheckinInsert,
  PdiFeedback, PdiFeedbackInsert,
} from "@/types/pdi";

export function usePdi() {
  const { tenantId, user, profile } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();
  const qc = useQueryClient();

  // ── PDIs ───────────────────────────────
  const { data: pdis = [], isLoading } = useQuery({
    queryKey: ["pdis", tenantId, empresaAtivaId],
    queryFn: async (): Promise<Pdi[]> => {
      if (!tenantId) return [];
      let q = supabase
        .from("pdis")
        .select(`*, metas:pdi_metas(*, acoes:pdi_acoes(*))`)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (empresaAtivaId) q = q.eq("empresa_id", empresaAtivaId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map(p => ({
        ...p,
        status: p.status as PdiStatus,
        metas: (p.metas || []).map((m: any) => ({
          ...m,
          categoria: m.categoria as PdiMetaCategoria,
          status: m.status as PdiMetaStatus,
          frequencia_checkin: m.frequencia_checkin as PdiCheckinFrequencia,
          acoes: (m.acoes || []).map((a: any) => ({
            ...a,
            tipo: a.tipo as PdiAcaoTipo,
            status: a.status as PdiAcaoStatus,
          })),
        })),
      })) as Pdi[];
    },
    enabled: !!tenantId,
  });

  const createPdi = useMutation({
    mutationFn: async (d: PdiInsert) => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      const { data, error } = await supabase
        .from("pdis")
        .insert({ ...d, tenant_id: tenantId, empresa_id: empresaAtivaId || null, criado_por: user?.id, criado_por_nome: profile?.nome_completo } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pdis"] }); toast.success("PDI criado!"); },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const updatePdi = useMutation({
    mutationFn: async ({ id, ...d }: { id: string } & Partial<PdiInsert> & { status?: PdiStatus }) => {
      const { error } = await supabase.from("pdis").update(d as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pdis"] }); toast.success("PDI atualizado!"); },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const deletePdi = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pdis").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pdis"] }); toast.success("PDI excluído!"); },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  // ── METAS ──────────────────────────────
  const createMeta = useMutation({
    mutationFn: async (d: PdiMetaInsert) => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      const { error } = await supabase.from("pdi_metas").insert({ ...d, tenant_id: tenantId } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pdis"] }); toast.success("Meta adicionada!"); },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const updateMeta = useMutation({
    mutationFn: async ({ id, ...d }: { id: string } & Partial<PdiMetaInsert> & { status?: PdiMetaStatus; progresso?: number }) => {
      const { error } = await supabase.from("pdi_metas").update(d as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pdis"] }); toast.success("Meta atualizada!"); },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const deleteMeta = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pdi_metas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pdis"] }); toast.success("Meta excluída!"); },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  // ── AÇÕES ──────────────────────────────
  const createAcao = useMutation({
    mutationFn: async (d: PdiAcaoInsert) => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      const { error } = await supabase.from("pdi_acoes").insert({ ...d, tenant_id: tenantId } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pdis"] }); toast.success("Ação adicionada!"); },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const updateAcao = useMutation({
    mutationFn: async ({ id, ...d }: { id: string } & Partial<PdiAcaoInsert> & { status?: PdiAcaoStatus }) => {
      const { error } = await supabase.from("pdi_acoes").update(d as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pdis"] }); toast.success("Ação atualizada!"); },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const deleteAcao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pdi_acoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pdis"] }); toast.success("Ação excluída!"); },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  // ── CHECK-INS ──────────────────────────
  const { data: checkins = [] } = useQuery({
    queryKey: ["pdi-checkins", tenantId],
    queryFn: async (): Promise<PdiCheckin[]> => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("pdi_checkins")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as PdiCheckin[];
    },
    enabled: !!tenantId,
  });

  const createCheckin = useMutation({
    mutationFn: async (d: PdiCheckinInsert) => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      const { error } = await supabase.from("pdi_checkins").insert({
        ...d, tenant_id: tenantId, realizado_por: user?.id, realizado_por_nome: profile?.nome_completo,
      } as any);
      if (error) throw error;
      // Atualizar progresso da meta se valor informado
      if (d.valor_atualizado !== undefined && d.valor_atualizado !== null) {
        const { data: meta } = await supabase.from("pdi_metas").select("valor_alvo, valor_base").eq("id", d.meta_id).single();
        if (meta && meta.valor_alvo) {
          const range = meta.valor_alvo - (meta.valor_base || 0);
          const prog = range > 0 ? Math.round(((d.valor_atualizado - (meta.valor_base || 0)) / range) * 100) : 0;
          await supabase.from("pdi_metas").update({
            valor_atual: d.valor_atualizado,
            progresso: Math.min(100, Math.max(0, prog)),
            status: prog >= 100 ? "concluida" : "em_andamento",
          } as any).eq("id", d.meta_id);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pdis"] });
      qc.invalidateQueries({ queryKey: ["pdi-checkins"] });
      toast.success("Check-in registrado!");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  // ── FEEDBACKS ──────────────────────────
  const { data: feedbacks = [] } = useQuery({
    queryKey: ["pdi-feedbacks", tenantId],
    queryFn: async (): Promise<PdiFeedback[]> => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("pdi_feedbacks")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as PdiFeedback[];
    },
    enabled: !!tenantId,
  });

  const createFeedback = useMutation({
    mutationFn: async (d: PdiFeedbackInsert & { colaborador_id?: string; colaborador_nome?: string; pdi_titulo?: string }) => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      const { error } = await supabase.from("pdi_feedbacks").insert({
        pdi_id: d.pdi_id, meta_id: d.meta_id, tipo: d.tipo,
        ponto_forte: d.ponto_forte, ponto_melhorar: d.ponto_melhorar,
        recomendacao: d.recomendacao, comentario: d.comentario,
        tenant_id: tenantId, autor_id: user?.id, autor_nome: profile?.nome_completo,
      } as any);
      if (error) throw error;

      // Also insert into the main feedbacks table for cross-module visibility
      if (d.colaborador_id && d.colaborador_nome) {
        const descricao = [
          d.ponto_forte && `Ponto forte: ${d.ponto_forte}`,
          d.ponto_melhorar && `A melhorar: ${d.ponto_melhorar}`,
          d.recomendacao && `Recomendação: ${d.recomendacao}`,
          d.comentario && `Comentário: ${d.comentario}`,
        ].filter(Boolean).join(" | ");

        await supabase.from("feedbacks" as never).insert({
          tenant_id: tenantId,
          colaborador_id: d.colaborador_id,
          colaborador_nome: d.colaborador_nome,
          categoria: "desenvolvimento",
          descricao: descricao || "Feedback via PDI",
          registrado_por: user?.id,
          registrado_por_nome: profile?.nome_completo || "Usuário",
          pdi_id: d.pdi_id,
          pdi_titulo: d.pdi_titulo || null,
        } as never);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pdi-feedbacks"] });
      qc.invalidateQueries({ queryKey: ["feedbacks"] });
      toast.success("Feedback registrado!");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  // ── STATS ──────────────────────────────
  const pdisAtivos = pdis.filter(p => p.status === "ativo").length;
  const pdisConcluidos = pdis.filter(p => p.status === "concluido").length;
  const totalMetas = pdis.reduce((a, p) => a + (p.metas?.length || 0), 0);
  const metasConcluidas = pdis.reduce((a, p) => a + (p.metas?.filter(m => m.status === "concluida").length || 0), 0);
  const progressoMedio = pdis.length > 0
    ? Math.round(pdis.reduce((a, p) => a + p.progresso, 0) / pdis.length)
    : 0;

  return {
    pdis, isLoading,
    createPdi: createPdi.mutateAsync, isCreatingPdi: createPdi.isPending,
    updatePdi: updatePdi.mutateAsync,
    deletePdi: deletePdi.mutateAsync,
    createMeta: createMeta.mutateAsync,
    updateMeta: updateMeta.mutateAsync,
    deleteMeta: deleteMeta.mutateAsync,
    createAcao: createAcao.mutateAsync,
    updateAcao: updateAcao.mutateAsync,
    deleteAcao: deleteAcao.mutateAsync,
    checkins, createCheckin: createCheckin.mutateAsync, isCreatingCheckin: createCheckin.isPending,
    feedbacks, createFeedback: createFeedback.mutateAsync,
    pdisAtivos, pdisConcluidos, totalMetas, metasConcluidas, progressoMedio,
  };
}
