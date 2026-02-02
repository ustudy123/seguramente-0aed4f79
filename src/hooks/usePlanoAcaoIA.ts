import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SugestaoAcao {
  titulo: string;
  descricao: string;
  tipo: "corretiva" | "preventiva" | "melhoria";
  prioridade: "baixa" | "media" | "alta" | "urgente";
}

export interface W5H2 {
  what: string;
  why: string;
  where: string;
  when: string;
  who: string;
  how: string;
  howMuch: string;
}

export interface GUT {
  gravidade: number;
  urgencia: number;
  tendencia: number;
  total: number;
  justificativa: string;
}

export interface PlanoAcaoIAResultado {
  sugestoes?: SugestaoAcao[];
  w5h2?: W5H2;
  gut?: GUT;
  resumo: string;
}

export function usePlanoAcaoIA() {
  const [isLoading, setIsLoading] = useState(false);
  const [resultado, setResultado] = useState<PlanoAcaoIAResultado | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sugerirAcoes = async (contexto: string, risco?: string, origem?: string): Promise<PlanoAcaoIAResultado | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("ai-plano-acao", {
        body: {
          tipo: "sugerir",
          contexto,
          dados: { risco, origem }
        }
      });

      if (fnError) throw new Error(fnError.message);
      if (data.error) throw new Error(data.error);

      setResultado(data);
      toast.success("Sugestões geradas com sucesso!");
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao gerar sugestões";
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const gerar5W2H = async (titulo: string, descricao: string, origem?: string): Promise<PlanoAcaoIAResultado | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("ai-plano-acao", {
        body: {
          tipo: "gerar_5w2h",
          contexto: descricao,
          dados: { titulo, descricao, origem }
        }
      });

      if (fnError) throw new Error(fnError.message);
      if (data.error) throw new Error(data.error);

      setResultado(data);
      toast.success("5W2H gerado com sucesso!");
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao gerar 5W2H";
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const priorizarAcao = async (titulo: string, descricao: string, risco?: string): Promise<PlanoAcaoIAResultado | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("ai-plano-acao", {
        body: {
          tipo: "priorizar",
          contexto: titulo,
          dados: { titulo, descricao, risco }
        }
      });

      if (fnError) throw new Error(fnError.message);
      if (data.error) throw new Error(data.error);

      setResultado(data);
      toast.success("Priorização calculada!");
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao priorizar ação";
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const limpar = () => {
    setResultado(null);
    setError(null);
  };

  return {
    isLoading,
    resultado,
    error,
    sugerirAcoes,
    gerar5W2H,
    priorizarAcao,
    limpar
  };
}
