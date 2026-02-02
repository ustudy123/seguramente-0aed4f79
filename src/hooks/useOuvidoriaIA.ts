import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AnaliseOuvidoria {
  sentimento: "positivo" | "neutro" | "negativo" | "urgente";
  categoria: string;
  subcategorias?: string[];
  prioridade: "baixa" | "normal" | "alta" | "urgente";
  resumo: string;
  palavrasChave?: string[];
  encaminhamento: string;
  riscoIdentificado?: boolean;
  acaoSugerida?: string;
  confianca: number;
}

export function useOuvidoriaIA() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analise, setAnalise] = useState<AnaliseOuvidoria | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analisarManifestacao = async (
    tipo: string,
    assunto: string,
    mensagem: string
  ): Promise<AnaliseOuvidoria | null> => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("ai-ouvidoria", {
        body: { tipo, assunto, mensagem }
      });

      if (fnError) throw new Error(fnError.message);
      if (data.error) throw new Error(data.error);

      setAnalise(data);
      toast.success("Análise concluída!");
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro na análise";
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const limpar = () => {
    setAnalise(null);
    setError(null);
  };

  return {
    isAnalyzing,
    analise,
    error,
    analisarManifestacao,
    limpar
  };
}
