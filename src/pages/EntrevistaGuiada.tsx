import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";
import {
  Brain,
  Send,
  Loader2,
  Shield,
  CheckCircle2,
  Mic,
  Square,
  AlertTriangle,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useEntrevistaIA } from "@/hooks/useEntrevistaIA";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";

const TRANSCRIBE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-transcribe-audio`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default function EntrevistaGuiada() {
  const { token } = useParams<{ token: string }>();
  const {
    meta,
    messages,
    loading,
    streaming,
    error,
    start,
    sendMessage,
    finalize,
    prontaParaFechar,
  } = useEntrevistaIA(token);

  const [consent, setConsent] = useState(false);
  const [draft, setDraft] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !meta) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4 bg-gradient-to-br from-purple-50 to-indigo-50">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center space-y-3">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold">Link inválido</h2>
            <p className="text-sm text-muted-foreground">
              {error || "Esta entrevista não foi encontrada. Verifique o link recebido."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Tela 1: Consentimento ────────────────────────────────────────────
  if (!meta.consentimento_lgpd_em) {
    return (
      <div className="min-h-dvh bg-gradient-to-br from-purple-50 to-indigo-50 p-4 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-lg w-full"
        >
          <Card className="shadow-xl border-purple-200">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-foreground">Entrevista Psicossocial</h1>
                  <p className="text-xs text-muted-foreground">{meta.empresa_nome}</p>
                </div>
              </div>

              <div className="space-y-3 text-sm text-foreground">
                <p>
                  Olá! Você foi convidado(a) a participar de uma <strong>entrevista anônima</strong>{" "}
                  conduzida por uma assistente de IA especializada em saúde no trabalho.
                </p>
                <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-purple-900 font-medium text-sm">
                    <Shield className="w-4 h-4" /> Suas garantias
                  </div>
                  <ul className="text-xs text-purple-900/80 space-y-1 pl-6 list-disc">
                    <li>Sua identidade não é vinculada às respostas.</li>
                    <li>A IA anonimiza automaticamente nomes, cargos e datas.</li>
                    <li>Suas falas alimentam apenas o relatório psicossocial.</li>
                    <li>Duração estimada: 15 a 25 minutos.</li>
                  </ul>
                </div>
                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox checked={consent} onCheckedChange={(v) => setConsent(!!v)} className="mt-0.5" />
                  <span className="text-xs text-foreground/90">
                    Li e concordo em participar desta entrevista para fins de diagnóstico organizacional,
                    conforme a LGPD.
                  </span>
                </label>
              </div>

              <Button
                disabled={!consent}
                onClick={async () => {
                  try {
                    await start("texto");
                  } catch (e: any) {
                    toast.error(e.message || "Não foi possível iniciar");
                  }
                }}
                className="w-full gap-2 bg-gradient-to-r from-purple-600 to-indigo-600"
              >
                <Sparkles className="w-4 h-4" /> Iniciar entrevista
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ─── Tela 3: Concluída ────────────────────────────────────────────────
  if (meta.status === "concluida") {
    return (
      <div className="min-h-dvh bg-gradient-to-br from-emerald-50 to-teal-50 p-4 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto" />
            <h2 className="text-xl font-bold">Entrevista concluída</h2>
            <p className="text-sm text-muted-foreground">
              Obrigado por compartilhar. Suas respostas vão alimentar o diagnóstico psicossocial
              da empresa, sem identificação pessoal.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Tela 2: Chat ─────────────────────────────────────────────────────
  const progresso = Math.min(100, Math.round((messages.length / 50) * 100));

  return (
    <div className="min-h-dvh bg-gradient-to-br from-purple-50 to-indigo-50 flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur border-b border-purple-100 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shrink-0">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-foreground truncate">Entrevista Psicossocial</h1>
              <p className="text-[11px] text-muted-foreground truncate">{meta.empresa_nome}</p>
            </div>
          </div>
          <Badge variant="outline" className="gap-1 text-xs">
            <Shield className="w-3 h-3" /> Anônimo
          </Badge>
        </div>
        <div className="max-w-3xl mx-auto mt-2">
          <Progress value={progresso} className="h-1" />
        </div>
      </header>

      {/* Chat scroll */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === "user"
                    ? "bg-gradient-to-br from-purple-600 to-indigo-600 text-white"
                    : "bg-white shadow-sm border border-purple-100 text-foreground"
                }`}
              >
                {m.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none prose-p:my-1 prose-strong:text-purple-700">
                    <ReactMarkdown>
                      {m.content.replace("[ENTREVISTA_PRONTA_PARA_FECHAR]", "")}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                )}
              </div>
            </motion.div>
          ))}
          {streaming && messages[messages.length - 1]?.content === "" && (
            <div className="flex justify-start">
              <div className="bg-white shadow-sm border border-purple-100 rounded-2xl px-4 py-3">
                <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input area */}
      <footer className="bg-white/90 backdrop-blur border-t border-purple-100 px-4 py-3">
        <div className="max-w-3xl mx-auto space-y-2">
          {prontaParaFechar && (meta.status as string) !== "concluida" && (
            <Button
              disabled={finalizing}
              onClick={async () => {
                setFinalizing(true);
                try {
                  await finalize();
                  toast.success("Entrevista finalizada. Obrigado!");
                } catch (e: any) {
                  toast.error(e.message || "Erro ao finalizar");
                } finally {
                  setFinalizing(false);
                }
              }}
              className="w-full gap-2 bg-gradient-to-r from-emerald-600 to-teal-600"
            >
              {finalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Finalizar entrevista
            </Button>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Escreva sua resposta..."
              rows={2}
              disabled={streaming || finalizing}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (draft.trim()) {
                    sendMessage(draft.trim());
                    setDraft("");
                  }
                }
              }}
              className="resize-none text-sm"
            />
            <Button
              size="icon"
              disabled={!draft.trim() || streaming || finalizing}
              onClick={() => {
                sendMessage(draft.trim());
                setDraft("");
              }}
              className="bg-gradient-to-br from-purple-600 to-indigo-600"
            >
              {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </footer>
    </div>
  );
}
