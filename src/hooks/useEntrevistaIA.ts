import { useCallback, useEffect, useRef, useState } from "react";
import { supabasePublic } from "@/lib/supabasePublic";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-psicossocial-entrevista`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export type EntrevistaMsg = { role: "user" | "assistant"; content: string; origem?: string };

export type EntrevistaMeta = {
  id: string;
  campanha_id: string;
  campanha_nome: string;
  empresa_nome: string | null;
  modalidade: "texto" | "voz";
  status: "pendente" | "em_andamento" | "concluida" | "abandonada";
  fase_atual: number;
  riscos_cobertos: number;
  total_riscos: number;
  consentimento_lgpd_em: string | null;
  iniciada_em: string | null;
  concluida_em: string | null;
};

export function useEntrevistaIA(token: string | undefined) {
  const [meta, setMeta] = useState<EntrevistaMeta | null>(null);
  const [messages, setMessages] = useState<EntrevistaMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Carregar meta + histórico
  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const { data: m, error: e1 } = await (supabasePublic as any).rpc("get_entrevista_by_token", {
        p_token: token,
      });
      if (e1) throw e1;
      const metaRow = Array.isArray(m) ? m[0] : m;
      if (!metaRow) throw new Error("Entrevista não encontrada ou link inválido.");
      setMeta(metaRow);

      const { data: msgs, error: e2 } = await (supabasePublic as any).rpc(
        "list_entrevista_mensagens_by_token",
        { p_token: token }
      );
      if (e2) throw e2;
      setMessages(
        (msgs || []).map((m: any) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          origem: m.origem,
        }))
      );
    } catch (e: any) {
      setError(e.message || "Erro ao carregar entrevista");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Aceitar consentimento + obter mensagem inicial
  const start = useCallback(
    async (modalidade: "texto" | "voz") => {
      if (!token) return;
      const res = await fetch(`${FN_URL}?action=start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}` },
        body: JSON.stringify({ token, modalidade }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro ao iniciar" }));
        throw new Error(err.error || "Erro ao iniciar entrevista");
      }
      await reload();
    },
    [token, reload]
  );

  // Enviar mensagem (streaming)
  const sendMessage = useCallback(
    async (userMessage: string, origem: "texto" | "voz_transcrita" = "texto") => {
      if (!token || streaming) return;
      setStreaming(true);
      setError(null);

      // Adiciona mensagens otimistas
      setMessages((prev) => [...prev, { role: "user", content: userMessage, origem }, { role: "assistant", content: "" }]);

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(`${FN_URL}?action=chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}` },
          body: JSON.stringify({ token, userMessage, origem }),
          signal: ctrl.signal,
        });

        if (res.status === 429) throw new Error("Muitas requisições. Aguarde alguns segundos.");
        if (res.status === 402) throw new Error("Créditos de IA esgotados. Avise o gestor.");
        if (!res.ok || !res.body) throw new Error("Falha ao iniciar resposta.");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let assistantSoFar = "";
        let done = false;

        while (!done) {
          const { done: d, value } = await reader.read();
          if (d) break;
          buf += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buf.indexOf("\n")) !== -1) {
            let line = buf.slice(0, idx);
            buf = buf.slice(idx + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || !line.trim()) continue;
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]") {
              done = true;
              break;
            }
            try {
              const parsed = JSON.parse(json);
              const c = parsed.choices?.[0]?.delta?.content;
              if (c) {
                assistantSoFar += c;
                setMessages((prev) => {
                  const next = [...prev];
                  next[next.length - 1] = { role: "assistant", content: assistantSoFar };
                  return next;
                });
              }
            } catch {
              buf = line + "\n" + buf;
              break;
            }
          }
        }
      } catch (e: any) {
        if (e.name !== "AbortError") setError(e.message);
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [token, streaming]
  );

  // Finalizar entrevista
  const finalize = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${FN_URL}?action=finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}` },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Erro ao finalizar" }));
      throw new Error(err.error || "Erro ao finalizar entrevista");
    }
    await reload();
    return await res.json();
  }, [token, reload]);

  // Detecta se a IA sinalizou fim
  const prontaParaFechar = messages.some(
    (m) => m.role === "assistant" && m.content.includes("[ENTREVISTA_PRONTA_PARA_FECHAR]")
  );

  return {
    meta,
    messages,
    loading,
    streaming,
    error,
    start,
    sendMessage,
    finalize,
    reload,
    prontaParaFechar,
  };
}
