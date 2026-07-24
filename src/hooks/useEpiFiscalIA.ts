import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSupabaseFunctionUrl } from "@/lib/supabaseFunctions";
import { useAuth } from "./useAuth";

export function useEpiFiscalIA() {
  const { tenantId } = useAuth();
  const [analise, setAnalise] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executarAnalise = useCallback(async () => {
    if (!tenantId) return;

    setIsLoading(true);
    setError(null);
    setAnalise("");

    try {
      const response = await fetch(
        getSupabaseFunctionUrl("ai-epi-fiscal"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
          },
          body: JSON.stringify({ tenant_id: tenantId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          throw new Error("Limite de requisições excedido. Tente novamente em alguns minutos.");
        }
        if (response.status === 402) {
          throw new Error("Créditos de IA insuficientes. Adicione créditos ao workspace.");
        }
        throw new Error(errorData.error || "Erro ao executar análise fiscal");
      }

      if (!response.body) throw new Error("Resposta sem body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              setAnalise(fullText);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Final flush
      if (buffer.trim()) {
        for (let raw of buffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              setAnalise(fullText);
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      console.error("Erro na análise fiscal:", err);
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  return {
    analise,
    isLoading,
    error,
    executarAnalise,
  };
}
