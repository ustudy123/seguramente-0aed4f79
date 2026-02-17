import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface PopData {
  id: string;
  tenant_id: string;
  atividade_id: string;
  cargo_id: string;
  codigo: string;
  titulo: string;
  status: string;
  versao_atual: string;
  gerado_por_ia: boolean;
  criado_por: string | null;
  criado_por_nome: string | null;
  aprovado_por: string | null;
  aprovado_por_nome: string | null;
  data_aprovacao: string | null;
  objetivo: string | null;
  escopo: string | null;
  responsabilidades: Record<string, string> | null;
  definicoes: string | null;
  pre_requisitos: string[] | null;
  materiais_ferramentas: string[] | null;
  epis_sst: string | null;
  procedimento_passos: Array<{ numero: number; descricao: string; tempo_estimado?: string; ponto_atencao?: string }> | null;
  criterios_qualidade: string | null;
  registros_evidencias: string | null;
  tratamento_nao_conformidades: string | null;
  referencias: string | null;
  html_completo: string | null;
  created_at: string;
  updated_at: string;
}

export interface PopVersao {
  id: string;
  pop_id: string;
  versao: string;
  status: string;
  titulo: string;
  conteudo_snapshot: Record<string, unknown>;
  html_snapshot: string | null;
  motivo_alteracao: string | null;
  resumo_mudancas: string | null;
  alterado_por_nome: string | null;
  created_at: string;
}

export function usePopAtividade(cargoId?: string) {
  const { tenantId, user, profile } = useAuth();
  const userName = profile?.nome_completo || "Sistema";
  const qc = useQueryClient();

  const { data: pops = [], isLoading } = useQuery({
    queryKey: ["funcao_pops", cargoId],
    queryFn: async (): Promise<PopData[]> => {
      if (!tenantId || !cargoId) return [];
      const { data, error } = await supabase
        .from("funcao_pops" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("cargo_id", cargoId)
        .order("created_at") as { data: PopData[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && !!cargoId,
  });

  const getPopByAtividade = (atividadeId: string) =>
    pops.find((p) => p.atividade_id === atividadeId);

  const criarPopMut = useMutation({
    mutationFn: async (input: {
      atividade_id: string;
      titulo: string;
      gerado_por_ia: boolean;
      popContent?: Record<string, unknown>;
    }) => {
      if (!tenantId || !cargoId) throw new Error("Sem contexto");
      
      // Generate code
      const { data: existing } = await supabase
        .from("funcao_pops" as never)
        .select("codigo")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1) as { data: Array<{ codigo: string }> | null };
      
      const lastNum = existing?.[0]?.codigo
        ? parseInt(existing[0].codigo.replace("POP-FUN-", ""), 10) || 0
        : 0;
      const codigo = `POP-FUN-${String(lastNum + 1).padStart(3, "0")}`;

      const content = input.popContent || {};
      const { data, error } = await supabase
        .from("funcao_pops" as never)
        .insert({
          tenant_id: tenantId,
          cargo_id: cargoId,
          atividade_id: input.atividade_id,
          codigo,
          titulo: input.titulo,
          gerado_por_ia: input.gerado_por_ia,
          criado_por: user?.id,
          criado_por_nome: userName,
          objetivo: (content as any).objetivo || null,
          escopo: (content as any).escopo || null,
          responsabilidades: (content as any).responsabilidades || {},
          definicoes: (content as any).definicoes || null,
          pre_requisitos: (content as any).pre_requisitos || [],
          materiais_ferramentas: (content as any).materiais_ferramentas || [],
          epis_sst: (content as any).epis_sst || null,
          procedimento_passos: (content as any).procedimento_passos || [],
          criterios_qualidade: (content as any).criterios_qualidade || null,
          registros_evidencias: (content as any).registros_evidencias || null,
          tratamento_nao_conformidades: (content as any).tratamento_nao_conformidades || null,
          referencias: (content as any).referencias || null,
        } as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funcao_pops", cargoId] });
      toast.success("POP criado com sucesso!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const atualizarPopMut = useMutation({
    mutationFn: async (input: { id: string; updates: Partial<PopData>; motivo?: string }) => {
      if (!tenantId) throw new Error("Sem contexto");

      // Get current state for version snapshot
      const currentPop = pops.find((p) => p.id === input.id);
      if (currentPop) {
        // Save version snapshot
        const currentVersion = parseFloat(currentPop.versao_atual) || 1.0;
        const newVersion = (currentVersion + 0.1).toFixed(1);

        await supabase.from("funcao_pop_versoes" as never).insert({
          tenant_id: tenantId,
          pop_id: input.id,
          versao: currentPop.versao_atual,
          status: currentPop.status,
          titulo: currentPop.titulo,
          conteudo_snapshot: {
            objetivo: currentPop.objetivo,
            escopo: currentPop.escopo,
            responsabilidades: currentPop.responsabilidades,
            definicoes: currentPop.definicoes,
            pre_requisitos: currentPop.pre_requisitos,
            materiais_ferramentas: currentPop.materiais_ferramentas,
            epis_sst: currentPop.epis_sst,
            procedimento_passos: currentPop.procedimento_passos,
            criterios_qualidade: currentPop.criterios_qualidade,
            registros_evidencias: currentPop.registros_evidencias,
            tratamento_nao_conformidades: currentPop.tratamento_nao_conformidades,
            referencias: currentPop.referencias,
          },
          motivo_alteracao: input.motivo || null,
          alterado_por: user?.id,
          alterado_por_nome: userName,
        } as never);

        input.updates.versao_atual = newVersion;
      }

      const { error } = await supabase
        .from("funcao_pops" as never)
        .update(input.updates as never)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funcao_pops", cargoId] });
      toast.success("POP atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluirPopMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("funcao_pops" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funcao_pops", cargoId] });
      toast.success("POP removido!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Fetch versions for a specific POP
  const buscarVersoes = async (popId: string): Promise<PopVersao[]> => {
    if (!tenantId) return [];
    const { data, error } = await supabase
      .from("funcao_pop_versoes" as never)
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("pop_id", popId)
      .order("created_at", { ascending: false }) as { data: PopVersao[] | null; error: Error | null };
    if (error) { toast.error(error.message); return []; }
    return data || [];
  };

  // Generate POP via AI
  const gerarPopIA = async (params: Record<string, string | undefined>) => {
    const { data, error } = await supabase.functions.invoke("ai-pop-generator", { body: params });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data.pop;
  };

  // AI rewrite helper
  const reescreverTrechoIA = async (trecho: string, instrucao: string) => {
    const { data, error } = await supabase.functions.invoke("ai-pop-generator", {
      body: { action: "rewrite", trecho, instrucao },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data.result as string;
  };

  return {
    pops,
    isLoading,
    getPopByAtividade,
    criarPop: criarPopMut.mutateAsync,
    criandoPop: criarPopMut.isPending,
    atualizarPop: atualizarPopMut.mutateAsync,
    atualizandoPop: atualizarPopMut.isPending,
    excluirPop: excluirPopMut.mutateAsync,
    buscarVersoes,
    gerarPopIA,
    reescreverTrechoIA,
  };
}
