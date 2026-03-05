import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { toast } from "sonner";
import { handleMutationError } from "@/lib/toastError";
import type { Feedback, Ocorrencia, AdvertenciaLink, FeedbackCategoria, OcorrenciaTipo } from "@/types/feedback";

export function useFeedbackOcorrencias() {
  const { tenantId, user, profile } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();
  const queryClient = useQueryClient();

  // ========== FEEDBACKS ==========
  const { data: feedbacks = [], isLoading: isLoadingFeedbacks } = useQuery({
    queryKey: ["feedbacks", tenantId],
    queryFn: async (): Promise<Feedback[]> => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("feedbacks" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }) as { data: Feedback[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const criarFeedbackMutation = useMutation({
    mutationFn: async (input: {
      colaborador_id: string;
      colaborador_nome: string;
      colaborador_cargo?: string;
      colaborador_departamento?: string;
      colaborador_filial?: string;
      categoria: FeedbackCategoria;
      descricao: string;
      descricao_ia?: string;
      ia_utilizada?: boolean;
      enviado_email?: boolean;
    }) => {
      if (!tenantId || !user) throw new Error("Não autenticado");
      const { data, error } = await supabase
        .from("feedbacks" as never)
        .insert({
          tenant_id: tenantId,
          ...input,
          registrado_por: user.id,
          registrado_por_nome: profile?.nome_completo || "Usuário",
        } as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedbacks"] });
      toast.success("Feedback registrado com sucesso!");
    },
    onError: (error: Error) => toast.error("Erro ao registrar feedback: " + error.message),
  });

  // ========== OCORRÊNCIAS ==========
  const { data: ocorrencias = [], isLoading: isLoadingOcorrencias } = useQuery({
    queryKey: ["ocorrencias", tenantId],
    queryFn: async (): Promise<Ocorrencia[]> => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("ocorrencias" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }) as { data: Ocorrencia[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const criarOcorrenciaMutation = useMutation({
    mutationFn: async (input: {
      colaborador_id: string;
      colaborador_nome: string;
      colaborador_cargo?: string;
      colaborador_departamento?: string;
      colaborador_filial?: string;
      tipo: OcorrenciaTipo;
      descricao: string;
      is_advertencia?: boolean;
    }) => {
      if (!tenantId || !user) throw new Error("Não autenticado");
      const isAdv = input.is_advertencia || false;
      const { data, error } = await supabase
        .from("ocorrencias" as never)
        .insert({
          tenant_id: tenantId,
          ...input,
          bloqueado: isAdv,
          registrado_por: user.id,
          registrado_por_nome: profile?.nome_completo || "Usuário",
        } as never)
        .select()
        .single();
      if (error) throw error;
      return data as Ocorrencia;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["ocorrencias"] });
      toast.success("Ocorrência registrada com sucesso!");

      // Registrar advertência no Hub Contábil automaticamente
      if (data && (data as any).is_advertencia && tenantId) {
        const competencia = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
        await supabase.from("hub_documentos").insert({
          tenant_id: tenantId,
          competencia,
          tipo: "outro",
          descricao: `Advertência formal — ${(data as any).colaborador_nome || ""}`,
          colaborador_nome: (data as any).colaborador_nome || null,
          direcao: "enviado",
          enviado_por: profile?.nome_completo || user?.email,
          status: "ativo",
          versao: 1,
        } as any).then(() => {
          supabase.from("hub_historico").insert({
            tenant_id: tenantId,
            competencia,
            acao: "enviado",
            tipo_documento: "advertencia",
            usuario_id: user?.id,
            usuario_nome: profile?.nome_completo || user?.email,
            perfil: "rh",
            descricao: `Advertência enviada automaticamente — ${(data as any).colaborador_nome || ""}`,
          } as any);
        });
      }
    },
    onError: (error: Error) => toast.error("Erro ao registrar ocorrência: " + error.message),
  });

  // ========== ADVERTÊNCIA LINKS ==========
  const criarAdvertenciaLinkMutation = useMutation({
    mutationFn: async (input: {
      ocorrencia_id: string;
      destinatario_email: string;
      destinatario_nome?: string;
    }) => {
      if (!tenantId) throw new Error("Não autenticado");
      const { data, error } = await supabase
        .from("advertencia_links" as never)
        .insert({
          tenant_id: tenantId,
          ...input,
          status: "enviada",
          enviado_em: new Date().toISOString(),
        } as never)
        .select()
        .single();
      if (error) throw error;
      return data as AdvertenciaLink;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ocorrencias"] });
      toast.success("Link de advertência enviado!");
    },
    onError: (error: Error) => toast.error("Erro ao enviar advertência: " + error.message),
  });

  // ========== STATS ==========
  const feedbackStats = {
    total: feedbacks.length,
    reconhecimento: feedbacks.filter((f) => f.categoria === "reconhecimento").length,
    alinhamento: feedbacks.filter((f) => f.categoria === "alinhamento").length,
    desenvolvimento: feedbacks.filter((f) => f.categoria === "desenvolvimento").length,
  };

  const ocorrenciaStats = {
    total: ocorrencias.length,
    positiva: ocorrencias.filter((o) => o.tipo === "positiva").length,
    neutra: ocorrencias.filter((o) => o.tipo === "neutra").length,
    negativa: ocorrencias.filter((o) => o.tipo === "negativa").length,
    advertencias: ocorrencias.filter((o) => o.is_advertencia).length,
  };

  return {
    feedbacks,
    isLoadingFeedbacks,
    criarFeedback: criarFeedbackMutation.mutateAsync,
    criandoFeedback: criarFeedbackMutation.isPending,
    ocorrencias,
    isLoadingOcorrencias,
    criarOcorrencia: criarOcorrenciaMutation.mutateAsync,
    criandoOcorrencia: criarOcorrenciaMutation.isPending,
    criarAdvertenciaLink: criarAdvertenciaLinkMutation.mutateAsync,
    criandoAdvertenciaLink: criarAdvertenciaLinkMutation.isPending,
    feedbackStats,
    ocorrenciaStats,
  };
}
