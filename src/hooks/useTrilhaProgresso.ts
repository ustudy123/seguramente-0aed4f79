import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { handleMutationError } from "@/lib/toastError";
import type { TrilhaProgresso, TrilhaComProgresso, Trilha, TrilhaModulo } from "@/types/trilha";

export function useTrilhaProgresso() {
  const { tenantId, user, profile } = useAuth();
  const qc = useQueryClient();
  const colaboradorId = user?.id;
  const colaboradorNome = profile?.nome_completo || user?.email || "";

  // Fetch trilhas assigned to the current user (individual, department, or "todos")
  const { data: minhasTrilhas = [], isLoading } = useQuery({
    queryKey: ["minhas_trilhas", tenantId, colaboradorId, user?.email],
    queryFn: async (): Promise<TrilhaComProgresso[]> => {
      if (!tenantId || !colaboradorId) return [];

      // Resolve current user's admissao record (assignments target admissoes.id, not auth.uid)
      let admissaoIds: string[] = [];
      let departamentos: string[] = [];
      if (user?.email) {
        const emailNorm = user.email.trim().toLowerCase();
        // Busca todas as admissões do tenant e casa o e-mail de forma robusta
        // (case-insensitive, ignorando espaços) — evita que diferenças de
        // caixa/espaço no cadastro impeçam o funcionário de ver a trilha.
        const { data: admissoes } = await fromTable("admissoes")
          .select("id, departamento, email")
          .eq("tenant_id", tenantId) as { data: any[] | null; error: Error | null };
        const minhas = (admissoes || []).filter(
          (a) => String(a.email || "").trim().toLowerCase() === emailNorm
        );
        admissaoIds = minhas.map((a) => a.id);
        departamentos = [...new Set(minhas.map((a) => a.departamento).filter(Boolean))] as string[];
      }

      // Fetch assignments applicable to this user
      const { data: atribuicoes, error: aErr } = await fromTable("trilha_atribuicoes")
        .select("trilha_id, tipo_alvo, alvo_id, alvo_nome")
        .eq("tenant_id", tenantId) as { data: any[] | null; error: Error | null };
      if (aErr) throw aErr;

      const trilhaIdsAtribuidas = new Set<string>();
      for (const a of atribuicoes || []) {
        if (a.tipo_alvo === "todos") trilhaIdsAtribuidas.add(a.trilha_id);
        else if (a.tipo_alvo === "colaborador" && a.alvo_id && admissaoIds.includes(a.alvo_id)) trilhaIdsAtribuidas.add(a.trilha_id);
        else if (a.tipo_alvo === "departamento" && a.alvo_nome && departamentos.includes(a.alvo_nome)) trilhaIdsAtribuidas.add(a.trilha_id);
      }

      if (trilhaIdsAtribuidas.size === 0) return [];

      // Fetch atribuídas trilhas (any status except arquivada)
      const { data: trilhas, error: tErr } = await fromTable("trilhas")
        .select("*")
        .eq("tenant_id", tenantId)
        .in("id", Array.from(trilhaIdsAtribuidas))
        .neq("status", "arquivada")
        .order("created_at", { ascending: false }) as { data: Trilha[] | null; error: Error | null };
      if (tErr) throw tErr;
      if (!trilhas?.length) return [];

      // Fetch user's progress across all trilhas
      const { data: progresso, error: pErr } = await fromTable("trilha_progresso")
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
        const { data, error } = await fromTable("trilha_progresso")
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
      const { data, error } = await fromTable("trilha_progresso")
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

      const { data, error } = await fromTable("trilha_progresso")
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

  // Marca/desmarca conteúdos individuais do módulo como concluídos.
  // A linha de progresso já existe (abrir o módulo a cria via iniciarModulo),
  // então usamos UPDATE — não mexe no status do módulo.
  const marcarConteudoMut = useMutation({
    mutationFn: async ({ trilhaId, moduloId, conteudosConcluidos }: { trilhaId: string; moduloId: string; conteudosConcluidos: string[] }) => {
      if (!tenantId || !colaboradorId) throw new Error("Sem contexto");
      const { error } = await fromTable("trilha_progresso")
        .update({ conteudos_concluidos: conteudosConcluidos } as never)
        .eq("tenant_id", tenantId)
        .eq("trilha_id", trilhaId)
        .eq("modulo_id", moduloId)
        .eq("colaborador_id", colaboradorId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["trilha_progresso", vars.trilhaId] });
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
    marcarConteudo: marcarConteudoMut.mutateAsync,
  };
}
