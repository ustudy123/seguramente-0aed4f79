import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { handleMutationError } from "@/lib/toastError";
import type { TrilhaProgresso, TrilhaComProgresso, Trilha, TrilhaModulo } from "@/types/trilha";

export function useTrilhaProgresso() {
  const { tenantId, user, profile } = useAuth();
  const qc = useQueryClient();
  const colaboradorId = user?.id;
  const colaboradorNome = profile?.nome_completo || user?.email || "";

  // Fetch all active trilhas with user's progress
  const { data: minhasTrilhas = [], isLoading } = useQuery({
    queryKey: ["minhas_trilhas", tenantId, colaboradorId],
    queryFn: async (): Promise<TrilhaComProgresso[]> => {
      if (!tenantId || !colaboradorId) return [];

      // Fetch active trilhas
      const { data: trilhas, error: tErr } = await supabase
        .from("trilhas" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("status", "ativa")
        .order("created_at", { ascending: false }) as { data: Trilha[] | null; error: Error | null };
      if (tErr) throw tErr;
      if (!trilhas?.length) return [];

      // Fetch user's progress across all trilhas
      const { data: progresso, error: pErr } = await supabase
        .from("trilha_progresso" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("colaborador_id", colaboradorId) as { data: TrilhaProgresso[] | null; error: Error | null };
      if (pErr) throw pErr;

      return trilhas.map((trilha) => {
        const progressoModulos = (progresso || []).filter((p) => p.trilha_id === trilha.id);
        const totalConcluidos = progressoModulos.filter((p) => p.status === "concluido").length;
        const pontosObtidos = progressoModulos.reduce((sum, p) => sum + (p.pontos_obtidos || 0), 0);
        const percentual = trilha.total_modulos > 0 ? Math.round((totalConcluidos / trilha.total_modulos) * 100) : 0;
        return { ...trilha, progressoModulos, totalConcluidos, pontosObtidos, percentual };
      });
    },
    enabled: !!tenantId && !!colaboradorId,
  });

  // Fetch progress for specific trilha
  const useModuloProgresso = (trilhaId?: string) =>
    useQuery({
      queryKey: ["trilha_progresso", trilhaId, colaboradorId],
      queryFn: async (): Promise<TrilhaProgresso[]> => {
        if (!trilhaId || !tenantId || !colaboradorId) return [];
        const { data, error } = await supabase
          .from("trilha_progresso" as never)
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("trilha_id", trilhaId)
          .eq("colaborador_id", colaboradorId) as { data: TrilhaProgresso[] | null; error: Error | null };
        if (error) throw error;
        return data || [];
      },
      enabled: !!trilhaId,
    });

  const iniciarModuloMut = useMutation({
    mutationFn: async ({ trilhaId, moduloId }: { trilhaId: string; moduloId: string }) => {
      if (!tenantId || !colaboradorId) throw new Error("Sem contexto");
      const { data, error } = await supabase
        .from("trilha_progresso" as never)
        .upsert(
          {
            tenant_id: tenantId,
            trilha_id: trilhaId,
            modulo_id: moduloId,
            colaborador_id: colaboradorId,
            colaborador_nome: colaboradorNome,
            status: "em_andamento",
            data_inicio: new Date().toISOString(),
          } as never,
          { onConflict: "tenant_id,trilha_id,modulo_id,colaborador_id" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["trilha_progresso", vars.trilhaId] });
      qc.invalidateQueries({ queryKey: ["minhas_trilhas"] });
    },
    onError: handleMutationError,
  });

  const concluirModuloMut = useMutation({
    mutationFn: async ({
      trilhaId,
      moduloId,
      evidenciaTexto,
      evidenciaFile,
      nota,
      pontosObtidos,
    }: {
      trilhaId: string;
      moduloId: string;
      evidenciaTexto?: string;
      evidenciaFile?: File;
      nota?: number;
      pontosObtidos?: number;
    }) => {
      if (!tenantId || !colaboradorId) throw new Error("Sem contexto");

      let evidenciaUrl: string | null = null;

      // Upload evidence file if provided
      if (evidenciaFile) {
        const ext = evidenciaFile.name.split(".").pop() || "file";
        const filePath = `${colaboradorId}/${trilhaId}/${moduloId}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("trilha-evidencias")
          .upload(filePath, evidenciaFile, { upsert: true });
        if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`);
        evidenciaUrl = filePath;
      }

      const { data, error } = await supabase
        .from("trilha_progresso" as never)
        .upsert(
          {
            tenant_id: tenantId,
            trilha_id: trilhaId,
            modulo_id: moduloId,
            colaborador_id: colaboradorId,
            colaborador_nome: colaboradorNome,
            status: "concluido",
            data_inicio: new Date().toISOString(),
            data_conclusao: new Date().toISOString(),
            evidencia_texto: evidenciaTexto || null,
            evidencia_url: evidenciaUrl,
            nota: nota ?? null,
            pontos_obtidos: pontosObtidos ?? null,
          } as never,
          { onConflict: "tenant_id,trilha_id,modulo_id,colaborador_id" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["trilha_progresso", vars.trilhaId] });
      qc.invalidateQueries({ queryKey: ["minhas_trilhas"] });
      toast.success("Módulo concluído! 🎉");
    },
    onError: handleMutationError,
  });

  return {
    minhasTrilhas,
    isLoading,
    useModuloProgresso,
    iniciarModulo: iniciarModuloMut.mutateAsync,
    concluirModulo: concluirModuloMut.mutateAsync,
    concluindo: concluirModuloMut.isPending,
  };
}
