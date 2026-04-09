import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useAuth } from "./useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { toast } from "sonner";
import { handleMutationError } from "@/lib/toastError";
import { sendEmail } from "@/utils/sendEmail";
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
      const { data, error } = await fromTable("feedbacks")
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
      const { data, error } = await fromTable("feedbacks")
        .insert({
          tenant_id: tenantId,
          ...input,
          registrado_por: user.id,
          registrado_por_nome: profile?.nome_completo || "Usuário",
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["feedbacks"] });
      toast.success("Feedback registrado com sucesso!");

      // Notificar colaborador por email
      if (data) {
        try {
          const colaboradorId = (data as any).colaborador_id;
          if (colaboradorId) {
            const { data: userRecord } = await fromTable("tenant_usuarios")
              .select("email_principal")
              .eq("auth_user_id", colaboradorId)
              .maybeSingle();

            if (userRecord?.email_principal) {
              sendEmail({
                templateName: "feedback",
                recipientEmail: userRecord.email_principal,
                templateData: {
                  colaborador: (data as any).colaborador_nome,
                  categoria: (data as any).categoria,
                  descricao: (data as any).descricao_ia || (data as any).descricao,
                  registradoPor: (data as any).registrado_por_nome,
                },
              }).catch(console.error);
            }
          }
        } catch (e) {
          console.error("Erro ao enviar email de feedback:", e);
        }
      }
    },
    onError: (error: Error) => toast.error("Erro ao registrar feedback: " + error.message),
  });

  // ========== OCORRÊNCIAS ==========
  const { data: ocorrencias = [], isLoading: isLoadingOcorrencias } = useQuery({
    queryKey: ["ocorrencias", tenantId, empresaAtivaId],
    queryFn: async (): Promise<Ocorrencia[]> => {
      if (!tenantId) return [];
      let q = fromTable("ocorrencias")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (empresaAtivaId) q = q.eq("empresa_id", empresaAtivaId);
      const { data, error } = await q as { data: Ocorrencia[] | null; error: Error | null };
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
      const { data, error } = await fromTable("ocorrencias")
        .insert({
          tenant_id: tenantId,
          empresa_id: empresaAtivaId || null,
          ...input,
          bloqueado: isAdv,
          registrado_por: user.id,
          registrado_por_nome: profile?.nome_completo || "Usuário",
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as Ocorrencia;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["ocorrencias"] });
      toast.success("Ocorrência registrada com sucesso!");

      // Registrar advertência no Hub Contábil automaticamente (novo hub_processos)
      if (data && (data as any).is_advertencia && tenantId) {
        const competencia = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
        const colaboradorNome = (data as any).colaborador_nome || "";

        // Verificar se já existe processo para esta ocorrência
        const { data: existente } = await supabase
          .from("hub_processos")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("origem_modulo", "advertencia")
          .eq("origem_registro_id", (data as any).id)
          .maybeSingle();

        if (!existente) {
          await supabase.from("hub_processos").insert({
            tenant_id: tenantId,
            tipo: "advertencia",
            titulo: `Advertência — ${colaboradorNome}`,
            descricao: (data as any).descricao || null,
            colaborador_nome: colaboradorNome || null,
            competencia,
            status: "pronto_para_envio",
            prioridade: "normal",
            gerado_automaticamente: true,
            origem_modulo: "advertencia",
            origem_registro_id: (data as any).id,
            origem_descricao: "Advertência emitida automaticamente pelo módulo disciplinar",
            enviado_por: profile?.nome_completo || user?.email,
          } as any);
        }
      }

      // Notificar gestores sobre ocorrência negativa por email
      if (data && (data as any).tipo === "negativa") {
        try {
          // Buscar gestores (admins e managers do tenant)
          const { data: gestores } = await fromTable("tenant_usuarios")
            .select("email_principal, nome_completo")
            .eq("tenant_id", tenantId)
            .in("tipo_usuario", ["admin", "gestor", "rh"]);

          if (gestores?.length) {
            for (const gestor of gestores.slice(0, 5)) {
              if (gestor.email_principal) {
                sendEmail({
                  templateName: "ocorrencia",
                  recipientEmail: gestor.email_principal,
                  templateData: {
                    colaborador: (data as any).colaborador_nome,
                    tipo: "Negativa",
                    descricao: (data as any).descricao,
                    dataOcorrencia: new Date().toLocaleDateString("pt-BR"),
                  },
                }).catch(console.error);
              }
            }
          }
        } catch (e) {
          console.error("Erro ao enviar email de ocorrência:", e);
        }
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
      const { data, error } = await fromTable("advertencia_links")
        .insert({
          tenant_id: tenantId,
          ...input,
          status: "enviada",
          enviado_em: new Date().toISOString(),
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as AdvertenciaLink;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["ocorrencias"] });
      toast.success("Link de advertência enviado!");

      // Enviar email ao destinatário com link da advertência
      if (data) {
        try {
          const advData = data as AdvertenciaLink;
          const advUrl = `https://seguramente.lovable.app/advertencia?token=${advData.token}`;
          sendEmail({
            templateName: "generico",
            recipientEmail: advData.destinatario_email,
            templateData: {
              assunto: "Advertência — Documento para Ciência",
              titulo: "📋 Advertência Formal",
              mensagem: `${advData.destinatario_nome ? `Prezado(a) ${advData.destinatario_nome}, v` : 'V'}ocê recebeu uma advertência formal. Acesse o link abaixo para visualizar e assinar o documento.`,
              actionUrl: advUrl,
              actionLabel: "Visualizar Advertência",
            },
          }).catch(console.error);
        } catch (e) {
          console.error("Erro ao enviar email de advertência:", e);
        }
      }
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
