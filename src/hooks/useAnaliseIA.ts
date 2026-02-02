import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface RiscoIdentificado {
  tipo: string;
  eixo: "fisico" | "cognitivo" | "organizacional";
  severidade: "baixo" | "medio" | "alto" | "critico";
  descricao: string;
  itemNR17?: string;
}

export interface AnaliseResultado {
  riscosIdentificados: RiscoIdentificado[];
  lacunasNormativas: string[];
  recomendacoes: string[];
  conformidadeEstimada: number;
  resumoGeral: string;
}

export function useAnaliseIA() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [resultado, setResultado] = useState<AnaliseResultado | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analisarImagem = async (
    imageBase64: string,
    contexto?: string
  ): Promise<AnaliseResultado | null> => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "analyze-ergonomia",
        {
          body: {
            tipo: "imagem",
            conteudo: imageBase64,
            contexto,
          },
        }
      );

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setResultado(data);
      toast.success("Análise concluída com sucesso!");
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

  const analisarTexto = async (
    texto: string,
    contexto?: string
  ): Promise<AnaliseResultado | null> => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "analyze-ergonomia",
        {
          body: {
            tipo: "texto",
            conteudo: texto,
            contexto,
          },
        }
      );

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setResultado(data);
      toast.success("Análise concluída com sucesso!");
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

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const analisarArquivo = async (
    file: File,
    contexto?: string
  ): Promise<AnaliseResultado | null> => {
    if (file.type.startsWith("image/")) {
      const base64 = await fileToBase64(file);
      return analisarImagem(base64, contexto);
    } else {
      // Para documentos, extrair texto (simplificado - apenas nome do arquivo)
      toast.info("Análise de documentos em desenvolvimento. Descrevendo o arquivo...");
      return analisarTexto(
        `Arquivo: ${file.name}, Tipo: ${file.type}, Tamanho: ${(file.size / 1024).toFixed(1)}KB`,
        contexto
      );
    }
  };

  const limparResultado = () => {
    setResultado(null);
    setError(null);
  };

  return {
    isAnalyzing,
    resultado,
    error,
    analisarImagem,
    analisarTexto,
    analisarArquivo,
    limparResultado,
  };
}
