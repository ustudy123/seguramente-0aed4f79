import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { handleMutationError } from "@/lib/toastError";
import type {
  OnboardingTemplate,
  OnboardingEtapa,
  OnboardingChecklistItem,
  OnboardingMensagem,
  OnboardingProcesso,
} from "@/types/onboarding";

export function useOnboardingTemplates() {
  const { tenantId, user, profile } = useAuth();
  const qc = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["onboarding_templates", tenantId],
    queryFn: async (): Promise<OnboardingTemplate[]> => {
      if (!tenantId) return [];
      const { data, error } = await fromTable("onboarding_templates")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }) as { data: OnboardingTemplate[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const criarTemplate = useMutation({
    mutationFn: async (input: Partial<OnboardingTemplate> & { nome: string }) => {
      if (!tenantId) throw new Error("Sem contexto");
      const { data, error } = await fromTable("onboarding_templates")
        .insert({
          tenant_id: tenantId,
          criado_por: user?.id,
          criado_por_nome: profile?.nome_completo || user?.email,
          ...input,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding_templates"] });
      toast.success("Template criado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const atualizarTemplate = useMutation({
    mutationFn: async ({ id, ...input }: Partial<OnboardingTemplate> & { id: string }) => {
      const { error } = await fromTable("onboarding_templates")
        .update(input as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding_templates"] });
      toast.success("Template atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluirTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable("onboarding_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding_templates"] });
      toast.success("Template removido!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    templates,
    isLoading,
    criarTemplate: criarTemplate.mutateAsync,
    atualizarTemplate: atualizarTemplate.mutateAsync,
    excluirTemplate: excluirTemplate.mutateAsync,
    criando: criarTemplate.isPending,
  };
}

export function useOnboardingEtapas(templateId?: string) {
  const { tenantId } = useAuth();
  const qc = useQueryClient();

  const { data: etapas = [], isLoading } = useQuery({
    queryKey: ["onboarding_etapas", templateId],
    queryFn: async (): Promise<OnboardingEtapa[]> => {
      if (!templateId || !tenantId) return [];
      const { data, error } = await fromTable("onboarding_etapas")
        .select("*")
        .eq("template_id", templateId)
        .eq("tenant_id", tenantId)
        .order("ordem") as { data: OnboardingEtapa[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: !!templateId && !!tenantId,
  });

  const criarEtapa = useMutation({
    mutationFn: async (input: Partial<OnboardingEtapa> & { titulo: string }) => {
      if (!tenantId || !templateId) throw new Error("Sem contexto");
      const { data, error } = await fromTable("onboarding_etapas")
        .insert({ tenant_id: tenantId, template_id: templateId, ...input } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding_etapas", templateId] });
      toast.success("Etapa adicionada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const atualizarEtapa = useMutation({
    mutationFn: async ({ id, ...input }: Partial<OnboardingEtapa> & { id: string }) => {
      const { error } = await fromTable("onboarding_etapas")
        .update(input as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding_etapas", templateId] });
      toast.success("Etapa atualizada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluirEtapa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable("onboarding_etapas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding_etapas", templateId] });
      toast.success("Etapa removida!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    etapas,
    isLoading,
    criarEtapa: criarEtapa.mutateAsync,
    atualizarEtapa: atualizarEtapa.mutateAsync,
    excluirEtapa: excluirEtapa.mutateAsync,
    criando: criarEtapa.isPending,
  };
}

export function useOnboardingProcessos() {
  const { tenantId } = useAuth();
  const qc = useQueryClient();

  const { data: processos = [], isLoading } = useQuery({
    queryKey: ["onboarding_processos", tenantId],
    queryFn: async (): Promise<OnboardingProcesso[]> => {
      if (!tenantId) return [];
      const { data, error } = await fromTable("onboarding_processos")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }) as { data: OnboardingProcesso[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const atualizarProcesso = useMutation({
    mutationFn: async ({ id, ...input }: Partial<OnboardingProcesso> & { id: string }) => {
      const { error } = await fromTable("onboarding_processos")
        .update(input as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding_processos"] });
      toast.success("Processo atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    processos,
    isLoading,
    atualizarProcesso: atualizarProcesso.mutateAsync,
  };
}

export function useOnboardingChecklistItems(etapaId?: string) {
  const { tenantId } = useAuth();
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["onboarding_checklist_items", etapaId],
    queryFn: async (): Promise<OnboardingChecklistItem[]> => {
      if (!etapaId || !tenantId) return [];
      const { data, error } = await fromTable("onboarding_checklist_items")
        .select("*")
        .eq("etapa_id", etapaId)
        .eq("tenant_id", tenantId)
        .order("ordem") as { data: OnboardingChecklistItem[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: !!etapaId && !!tenantId,
  });

  const criarItem = useMutation({
    mutationFn: async (input: Partial<OnboardingChecklistItem> & { titulo: string }) => {
      if (!tenantId || !etapaId) throw new Error("Sem contexto");
      const { data, error } = await fromTable("onboarding_checklist_items")
        .insert({ tenant_id: tenantId, etapa_id: etapaId, ...input } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding_checklist_items", etapaId] });
      toast.success("Item adicionado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluirItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable("onboarding_checklist_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding_checklist_items", etapaId] });
      toast.success("Item removido!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { items, isLoading, criarItem: criarItem.mutateAsync, excluirItem: excluirItem.mutateAsync };
}

export function useOnboardingMensagens(etapaId?: string) {
  const { tenantId } = useAuth();
  const qc = useQueryClient();

  const { data: mensagens = [], isLoading } = useQuery({
    queryKey: ["onboarding_mensagens", etapaId],
    queryFn: async (): Promise<OnboardingMensagem[]> => {
      if (!etapaId || !tenantId) return [];
      const { data, error } = await fromTable("onboarding_mensagens")
        .select("*")
        .eq("etapa_id", etapaId)
        .eq("tenant_id", tenantId)
        .order("ordem") as { data: OnboardingMensagem[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: !!etapaId && !!tenantId,
  });

  const criarMensagem = useMutation({
    mutationFn: async (input: Partial<OnboardingMensagem> & { autor_nome: string; mensagem: string }) => {
      if (!tenantId || !etapaId) throw new Error("Sem contexto");
      const { data, error } = await fromTable("onboarding_mensagens")
        .insert({ tenant_id: tenantId, etapa_id: etapaId, ...input } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding_mensagens", etapaId] });
      toast.success("Mensagem adicionada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluirMensagem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable("onboarding_mensagens").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding_mensagens", etapaId] });
      toast.success("Mensagem removida!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { mensagens, isLoading, criarMensagem: criarMensagem.mutateAsync, excluirMensagem: excluirMensagem.mutateAsync };
}
