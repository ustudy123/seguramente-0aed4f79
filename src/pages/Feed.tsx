import { useState } from "react";
import { motion } from "framer-motion";
import { MessageSquare, RefreshCw, CalendarHeart, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PostForm } from "@/components/feed/PostForm";
import { PostCard } from "@/components/feed/PostCard";
import { AniversariantesWidget } from "@/components/feed/AniversariantesWidget";
import { TempoEmpresaWidget } from "@/components/feed/TempoEmpresaWidget";
import { useFeed } from "@/hooks/useFeed";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TIPO_ACAO_LABELS, STATUS_ACAO_COLORS, STATUS_ACAO_LABELS } from "@/types/cultura";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

function FeedSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-card rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-16 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-12"
    >
      <div className="inline-flex p-4 rounded-2xl bg-primary/10 mb-4">
        <MessageSquare className="w-10 h-10 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Nenhuma publicação ainda</h3>
      <p className="text-muted-foreground max-w-md mx-auto">
        Seja o primeiro a compartilhar algo com a equipe! Use o formulário acima
        para criar sua primeira publicação.
      </p>
    </motion.div>
  );
}

// Widget de avisos de Cultura & Celebrações
function AvisosCulturaWidget({ onFelicitar }: { onFelicitar: (msg: string) => void }) {
  const { tenantId } = useAuth();
  const [gerando, setGerando] = useState<string | null>(null);

  const { data: acoesPendentes = [] } = useQuery({
    queryKey: ["cultura-acoes-mural", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await (supabase as any)
        .from("cultura_acoes")
        .select("*")
        .eq("tenant_id", tenantId)
        .in("status", ["pendente", "em_andamento"])
        .order("data_referencia", { ascending: true })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const handleClick = async (acao: any) => {
    if (gerando) return;
    setGerando(acao.id);
    try {
      const tipo = acao.tipo === "aniversario" ? "aniversario" : "tempo_casa";
      const nome = acao.colaborador_nome || "Colaborador";
      const anos = acao.titulo?.match(/(\d+)\s*ano/)?.[1] || "1";

      const { data, error } = await supabase.functions.invoke("ai-felicitacao", {
        body: { nome, tipo, anos: parseInt(anos) },
      });

      if (error) throw error;
      if (data?.mensagem) {
        onFelicitar(data.mensagem);
      }
    } catch (err) {
      console.error("Erro ao gerar felicitação:", err);
      // Fallback: prefill com texto simples
      const nome = acao.colaborador_nome || "Colaborador";
      onFelicitar(`🎉 Parabéns, ${nome}! ${acao.titulo}`);
    } finally {
      setGerando(null);
    }
  };

  if (acoesPendentes.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarHeart className="h-4 w-4 text-violet-500" />
          Lembretes de Cultura
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {acoesPendentes.map((acao: any) => (
          <div
            key={acao.id}
            className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors group"
            onClick={() => handleClick(acao)}
            title="Clique para gerar mensagem com IA e publicar"
          >
            {gerando === acao.id ? (
              <Loader2 className="h-3.5 w-3.5 mt-0.5 text-violet-500 shrink-0 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 mt-0.5 text-violet-500 shrink-0 group-hover:scale-110 transition-transform" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{acao.titulo}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant="outline" className="text-[9px] h-4">
                  {TIPO_ACAO_LABELS[acao.tipo] || acao.tipo}
                </Badge>
                <Badge className={`text-[9px] h-4 ${STATUS_ACAO_COLORS[acao.status]}`}>
                  {STATUS_ACAO_LABELS[acao.status]}
                </Badge>
              </div>
              {acao.colaborador_nome && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {acao.colaborador_nome} · {format(parseISO(acao.data_referencia), "dd/MM", { locale: ptBR })}
                </p>
              )}
              <p className="text-[9px] text-violet-500 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                ✨ Clique para gerar mensagem com IA
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function Feed() {
  const { posts, isLoading, refetch } = useFeed();
  const [prefillContent, setPrefillContent] = useState("");

  const handleFelicitacao = (mensagem: string) => {
    setPrefillContent(mensagem);
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mural Interno</h1>
          <p className="text-muted-foreground">
            Conecte-se e compartilhe com sua equipe
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PostForm
            prefillContent={prefillContent}
            onPrefillConsumed={() => setPrefillContent("")}
          />

          {isLoading ? (
            <FeedSkeleton />
          ) : posts.length === 0 ? (
            <EmptyState />
          ) : (
            <div>
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <AvisosCulturaWidget onFelicitar={handleFelicitacao} />
          <AniversariantesWidget onFelicitar={handleFelicitacao} />
          <TempoEmpresaWidget onFelicitar={handleFelicitacao} />
        </div>
      </div>
    </div>
  );
}
