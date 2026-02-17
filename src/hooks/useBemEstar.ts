import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export type BemEstarEixo =
  | "autoconhecimento"
  | "sentido"
  | "relacoes"
  | "autonomia"
  | "autorrealizacao"
  | "atencao_plena"
  | "gratidao";

export interface BemEstarResposta {
  id: string;
  eixo: string;
  tipo: string;
  valor_numerico: number | null;
  valor_texto: string | null;
  opcao_selecionada: string | null;
  created_at: string;
}

export const EIXOS_CONFIG: Record<BemEstarEixo, {
  label: string;
  cor: string;
  emoji: string;
  descricao: string;
}> = {
  autoconhecimento: {
    label: "Autoconhecimento & Emoções",
    cor: "hsl(45, 93%, 47%)",
    emoji: "🟡",
    descricao: "Como você está se sentindo no trabalho",
  },
  sentido: {
    label: "Sentido & Propósito",
    cor: "hsl(142, 71%, 45%)",
    emoji: "🟢",
    descricao: "Se o seu trabalho faz sentido para você",
  },
  relacoes: {
    label: "Relações & Conexão Humana",
    cor: "hsl(217, 91%, 60%)",
    emoji: "🔵",
    descricao: "Qualidade das suas relações no trabalho",
  },
  autonomia: {
    label: "Autonomia & Reconhecimento",
    cor: "hsl(271, 91%, 65%)",
    emoji: "🟣",
    descricao: "Se você se sente reconhecido e com autonomia",
  },
  autorrealizacao: {
    label: "Autorrealização & Desenvolvimento",
    cor: "hsl(24, 95%, 53%)",
    emoji: "🟠",
    descricao: "Se você sente que está evoluindo",
  },
  atencao_plena: {
    label: "Atenção Plena & Presença",
    cor: "hsl(0, 84%, 60%)",
    emoji: "🔴",
    descricao: "Ritmo e sustentabilidade no trabalho",
  },
  gratidao: {
    label: "Gratidão & Cultura Positiva",
    cor: "hsl(30, 41%, 44%)",
    emoji: "🟤",
    descricao: "Oxigênio emocional e momentos positivos",
  },
};

export function useBemEstar() {
  const { user, tenantId } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const respostasQuery = useQuery({
    queryKey: ["bem-estar-respostas", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("bem_estar_respostas")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as BemEstarResposta[];
    },
    enabled: !!userId,
  });

  const gratidaoQuery = useQuery({
    queryKey: ["bem-estar-gratidao", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("bem_estar_gratidao")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!userId,
  });

  const salvarResposta = useMutation({
    mutationFn: async (dados: {
      eixo: BemEstarEixo;
      tipo: string;
      valor_numerico?: number;
      valor_texto?: string;
      opcao_selecionada?: string;
    }) => {
      if (!userId || !tenantId) throw new Error("Não autenticado");
      const { error } = await supabase.from("bem_estar_respostas").insert({
        tenant_id: tenantId,
        user_id: userId,
        ...dados,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bem-estar-respostas"] });
      toast.success("Reflexão registrada! 💚");
    },
    onError: () => toast.error("Erro ao registrar reflexão."),
  });

  const salvarGratidao = useMutation({
    mutationFn: async (dados: { conteudo: string; tipo?: string }) => {
      if (!userId || !tenantId) throw new Error("Não autenticado");
      const { error } = await supabase.from("bem_estar_gratidao").insert({
        tenant_id: tenantId,
        user_id: userId,
        ...dados,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bem-estar-gratidao"] });
      toast.success("Momento positivo registrado! ✨");
    },
    onError: () => toast.error("Erro ao registrar."),
  });

  // Calculate radar data from recent responses
  const radarData = Object.keys(EIXOS_CONFIG).map((eixo) => {
    const respostasEixo = (respostasQuery.data || []).filter(
      (r) => r.eixo === eixo && r.valor_numerico != null
    );
    const media =
      respostasEixo.length > 0
        ? respostasEixo.slice(0, 5).reduce((s, r) => s + (r.valor_numerico || 0), 0) /
          Math.min(respostasEixo.length, 5)
        : 0;
    return {
      eixo: eixo as BemEstarEixo,
      valor: media,
      total: respostasEixo.length,
    };
  });

  const getStatusLabel = (valor: number) => {
    if (valor >= 4) return "Forte";
    if (valor >= 2.5) return "Em atenção";
    if (valor > 0) return "Pode melhorar";
    return "Sem dados";
  };

  const getStatusColor = (valor: number) => {
    if (valor >= 4) return "text-emerald-600";
    if (valor >= 2.5) return "text-amber-500";
    if (valor > 0) return "text-orange-500";
    return "text-muted-foreground";
  };

  return {
    respostas: respostasQuery.data || [],
    gratidao: gratidaoQuery.data || [],
    radarData,
    isLoading: respostasQuery.isLoading,
    salvarResposta: salvarResposta.mutateAsync,
    salvandoResposta: salvarResposta.isPending,
    salvarGratidao: salvarGratidao.mutateAsync,
    salvandoGratidao: salvarGratidao.isPending,
    getStatusLabel,
    getStatusColor,
  };
}
