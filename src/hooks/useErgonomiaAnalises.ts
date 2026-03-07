import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export interface RiscoIdentificadoIA {
  tipo: string;
  eixo: "fisico" | "cognitivo" | "organizacional";
  severidade: "baixo" | "medio" | "alto" | "critico";
  descricao: string;
  itemNR17?: string;
}

export interface ErgonomiaAnalise {
  id: string;
  tenant_id: string;
  empresa_id?: string;
  setor: string;
  cargo: string;
  atividade?: string;
  unidade?: string;
  num_trabalhadores: number;
  tipo_analise: "ia" | "manual" | "checklist";
  data_analise: string;
  realizado_por?: string;
  riscos_identificados: RiscoIdentificadoIA[];
  recomendacoes: string[];
  lacunas_normativas: string[];
  conformidade_estimada: number;
  resumo_geral?: string;
  classificacao_risco: "baixo" | "moderado" | "alto";
  evidencias_urls: string[];
  contexto_adicional?: string;
  transcricao_audio?: string;
  status: "ativo" | "arquivado";
  created_at: string;
  updated_at: string;
}

export interface NovaAnalise {
  setor: string;
  cargo: string;
  atividade?: string;
  unidade?: string;
  num_trabalhadores?: number;
  tipo_analise: "ia" | "manual" | "checklist";
  riscos_identificados: RiscoIdentificadoIA[];
  recomendacoes: string[];
  lacunas_normativas: string[];
  conformidade_estimada: number;
  resumo_geral?: string;
  classificacao_risco: "baixo" | "moderado" | "alto";
  evidencias_urls?: string[];
  contexto_adicional?: string;
  transcricao_audio?: string;
}

export function useErgonomiaAnalises() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  const { data: analises = [], isLoading } = useQuery({
    queryKey: ["ergonomia_analises"],
    queryFn: async () => {
      const { data: tenant } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id || "")
        .single();

      if (!tenant?.tenant_id) return [];

      const { data, error } = await supabase
        .from("ergonomia_analises")
        .select("*")
        .eq("tenant_id", tenant.tenant_id)
        .eq("status", "ativo")
        .order("data_analise", { ascending: false });

      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((data || []) as unknown as ErgonomiaAnalise[]);
    },
  });

  const salvarAnalise = useMutation({
    mutationFn: async (novaAnalise: NovaAnalise) => {
      const { data: tenant } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id || "")
        .single();

      if (!tenant?.tenant_id) throw new Error("Tenant não encontrado");

      const { data, error } = await supabase
        .from("ergonomia_analises")
        .insert({
          ...novaAnalise,
          tenant_id: tenant.tenant_id,
          realizado_por: profile?.nome_completo || "Sistema",
          riscos_identificados: novaAnalise.riscos_identificados as unknown as never,
          recomendacoes: novaAnalise.recomendacoes as unknown as never,
          lacunas_normativas: novaAnalise.lacunas_normativas as unknown as never,
          evidencias_urls: (novaAnalise.evidencias_urls || []) as unknown as never,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ergonomia_analises"] });
      toast.success("Análise salva permanentemente na base ergonômica!");
    },
    onError: (err: Error) => {
      toast.error("Erro ao salvar análise: " + err.message);
    },
  });

  const arquivarAnalise = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ergonomia_analises")
        .update({ status: "arquivado" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ergonomia_analises"] });
      toast.success("Análise arquivada");
    },
  });

  // Estatísticas derivadas
  const stats = {
    totalAnalises: analises.length,
    postosAvaliados: new Set(analises.map((a) => `${a.setor}|${a.cargo}`)).size,
    setoresAvaliados: new Set(analises.map((a) => a.setor)).size,
    cargosAvaliados: new Set(analises.map((a) => a.cargo)).size,
    riscosAltos: analises.filter((a) => a.classificacao_risco === "alto").length,
    riscosModetados: analises.filter((a) => a.classificacao_risco === "moderado").length,
    totalRiscosIdentificados: analises.reduce(
      (sum, a) => sum + (a.riscos_identificados?.length || 0),
      0
    ),
    conformidadeMedia:
      analises.length > 0
        ? Math.round(
            analises.reduce((sum, a) => sum + (a.conformidade_estimada || 0), 0) /
              analises.length
          )
        : 0,
  };

  // Mapa de riscos por setor/cargo
  const mapaRiscos = analises.reduce(
    (acc, analise) => {
      const key = analise.setor;
      if (!acc[key]) {
        acc[key] = {
          setor: analise.setor,
          analises: [],
          classificacao: "baixo" as "baixo" | "moderado" | "alto",
          totalRiscos: 0,
          cargos: [] as string[],
        };
      }
      acc[key].analises.push(analise);
      acc[key].totalRiscos += analise.riscos_identificados?.length || 0;
      if (!acc[key].cargos.includes(analise.cargo)) {
        acc[key].cargos.push(analise.cargo);
      }
      // Classificação: pior do grupo
      if (
        analise.classificacao_risco === "alto" ||
        acc[key].classificacao === "alto"
      ) {
        acc[key].classificacao = "alto";
      } else if (
        analise.classificacao_risco === "moderado" ||
        acc[key].classificacao === "moderado"
      ) {
        acc[key].classificacao = "moderado";
      }
      return acc;
    },
    {} as Record<
      string,
      {
        setor: string;
        analises: ErgonomiaAnalise[];
        classificacao: "baixo" | "moderado" | "alto";
        totalRiscos: number;
        cargos: string[];
      }
    >
  );

  // Análise LER/DORT por cargo
  const analiseLERDORT = Object.entries(
    analises.reduce(
      (acc, analise) => {
        const cargo = analise.cargo;
        if (!acc[cargo]) {
          acc[cargo] = { cargo, analises: [], scoreTotal: 0 };
        }
        acc[cargo].analises.push(analise);

        // Score baseado em fatores de risco ergonômico
        const riscos = analise.riscos_identificados || [];
        const scoreAnalise = riscos.reduce((s, r) => {
          if (r.severidade === "critico") return s + 4;
          if (r.severidade === "alto") return s + 3;
          if (r.severidade === "medio") return s + 2;
          return s + 1;
        }, 0);
        acc[cargo].scoreTotal += scoreAnalise;
        return acc;
      },
      {} as Record<string, { cargo: string; analises: ErgonomiaAnalise[]; scoreTotal: number }>
    )
  )
    .map(([, v]) => ({
      cargo: v.cargo,
      numAnalises: v.analises.length,
      scoreTotal: v.scoreTotal,
      probabilidade:
        v.scoreTotal >= 10
          ? ("alta" as const)
          : v.scoreTotal >= 5
          ? ("moderada" as const)
          : ("baixa" as const),
    }))
    .sort((a, b) => b.scoreTotal - a.scoreTotal);

  return {
    analises,
    isLoading,
    stats,
    mapaRiscos,
    analiseLERDORT,
    salvarAnalise: salvarAnalise.mutateAsync,
    isSalvando: salvarAnalise.isPending,
    arquivarAnalise: arquivarAnalise.mutateAsync,
  };
}
