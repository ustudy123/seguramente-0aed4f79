import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare, Send, Loader2, Sparkles, Trash2, Bot, User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import type { MetaCompleta } from "@/types/metas-module";

interface MetasChatAssistenteProps {
  metas: MetaCompleta[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function MetasChatAssistente({ metas }: MetasChatAssistenteProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const buildContext = () => {
    const resumo = {
      total: metas.length,
      porNivel: {
        estrategica: metas.filter(m => m.nivel === "estrategica").length,
        unidade: metas.filter(m => m.nivel === "unidade").length,
        setor: metas.filter(m => m.nivel === "setor").length,
        individual: metas.filter(m => m.nivel === "individual").length,
      },
      concluidas: metas.filter(m => m.status === "concluida").length,
      emAndamento: metas.filter(m => m.status === "em_andamento").length,
      atrasadas: metas.filter(m => m.status === "atrasada").length,
      progressoMedio: metas.length > 0
        ? Math.round(metas.reduce((a, m) => a + (m.progresso || 0), 0) / metas.length)
        : 0,
    };

    const topMetas = metas.slice(0, 15).map(m => ({
      titulo: m.titulo,
      nivel: m.nivel,
      progresso: m.progresso,
      status: m.status,
      indicador: m.indicador_nome,
      valor_atual: m.valor_atual,
      valor_alvo: m.valor_alvo,
      responsavel: m.responsavel_nome,
    }));

    return `Contexto atual das metas da empresa:\n${JSON.stringify(resumo, null, 2)}\n\nMetas cadastradas (amostra):\n${JSON.stringify(topMetas, null, 2)}`;
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const contextualPrompt = messages.length === 0
        ? `${buildContext()}\n\nPergunta do usuário: ${input}`
        : input;

      const { data, error } = await supabase.functions.invoke("ai-metas", {
        body: {
          acao: "chat",
          pergunta: contextualPrompt,
        },
      });
      if (error) throw error;

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data?.resposta || "Não foi possível gerar uma resposta.",
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (e: any) {
      toast.error(e.message);
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions = [
    "Resuma o estado atual das metas",
    "Quais metas estão atrasadas?",
    "Sugira ações para melhorar o atingimento",
    "Quais áreas precisam de atenção?",
  ];

  return (
    <Card className="flex flex-col h-[500px]">
      <CardHeader className="pb-2 shrink-0 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Assistente de Metas (IA)
          </CardTitle>
          {messages.length > 0 && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMessages([])}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <ScrollArea className="flex-1 px-4 py-3">
          {messages.length === 0 ? (
            <div className="space-y-4 py-4">
              <div className="text-center space-y-2">
                <Bot className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Olá! Sou seu assistente de metas. Posso ajudar com análises, sugestões e consultas sobre suas metas.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {quickActions.map((action, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="text-xs h-auto py-2 whitespace-normal text-left justify-start"
                    onClick={() => { setInput(action); }}
                  >
                    <Sparkles className="h-3 w-3 mr-1.5 shrink-0" />
                    {action}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}>
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : msg.content}
                  </div>
                  {msg.role === "user" && (
                    <div className="shrink-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-2 items-center">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-lg px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          )}
        </ScrollArea>

        <div className="p-3 border-t shrink-0">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Pergunte sobre suas metas..."
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
              disabled={isLoading}
            />
            <Button size="icon" onClick={sendMessage} disabled={isLoading || !input.trim()}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Respostas geradas por IA — sujeito a revisão humana
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
