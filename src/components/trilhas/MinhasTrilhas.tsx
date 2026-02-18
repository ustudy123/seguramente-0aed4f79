import { useState } from "react";
import { motion } from "framer-motion";
import {
  Route,
  BookOpen,
  Clock,
  GraduationCap,
  Star,
  Trophy,
  Loader2,
  ChevronRight,
  PlayCircle,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrilhaProgresso } from "@/hooks/useTrilhaProgresso";
import { DemoBanner } from "./DemoBanner";
import type { TrilhaComProgresso, TrilhaTipo } from "@/types/trilha";
import { TRILHA_TIPO_LABELS, TRILHA_PRIORIDADE_LABELS } from "@/types/trilha";

const tipoStyles: Record<TrilhaTipo, string> = {
  tecnica: "bg-blue-500/10 text-blue-600",
  comportamental: "bg-violet-500/10 text-violet-600",
  lideranca: "bg-amber-500/10 text-amber-600",
  cultura: "bg-rose-500/10 text-rose-600",
  ergonomia_saude: "bg-emerald-500/10 text-emerald-600",
  processos: "bg-cyan-500/10 text-cyan-600",
};

interface MinhasTrilhasProps {
  onOpenTrilha: (trilha: TrilhaComProgresso) => void;
}

export function MinhasTrilhas({ onOpenTrilha }: MinhasTrilhasProps) {
  const { minhasTrilhas, isLoading } = useTrilhaProgresso();
  const isDemo = minhasTrilhas.length > 0 && minhasTrilhas[0].id.startsWith("demo-");
  const [filter, setFilter] = useState<"all" | "em_andamento" | "concluido" | "nao_iniciado">("all");

  const categorized = minhasTrilhas.map((t) => {
    const cat = t.percentual >= 100 ? "concluido" : t.percentual > 0 ? "em_andamento" : "nao_iniciado";
    return { ...t, categoria: cat };
  });

  const filtered = filter === "all" ? categorized : categorized.filter((t) => t.categoria === filter);

  const stats = {
    total: minhasTrilhas.length,
    emAndamento: categorized.filter((t) => t.categoria === "em_andamento").length,
    concluidas: categorized.filter((t) => t.categoria === "concluido").length,
    pontosTotal: minhasTrilhas.reduce((s, t) => s + t.pontosObtidos, 0),
  };

  return (
    <div className="space-y-6">
      {isDemo && <DemoBanner />}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Route className="w-5 h-5 text-primary" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Disponíveis</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-info/10">
              <PlayCircle className="w-5 h-5 text-info" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.emAndamento}</p>
              <p className="text-xs text-muted-foreground">Em andamento</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <CheckCircle2 className="w-5 h-5 text-success" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.concluidas}</p>
              <p className="text-xs text-muted-foreground">Concluídas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <Star className="w-5 h-5 text-warning" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.pontosTotal}</p>
              <p className="text-xs text-muted-foreground">Pontos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 w-fit">
        {([
          { key: "all", label: "Todas" },
          { key: "em_andamento", label: "Em andamento" },
          { key: "nao_iniciado", label: "Não iniciadas" },
          { key: "concluido", label: "Concluídas" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
              filter === key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border border-border">
          <Route className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" strokeWidth={1.5} />
          <p className="text-muted-foreground">
            {minhasTrilhas.length === 0
              ? "Nenhuma trilha disponível no momento."
              : "Nenhuma trilha nesta categoria."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((trilha, i) => (
            <motion.div
              key={trilha.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <Card
                className="border-border hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group"
                onClick={() => onOpenTrilha(trilha)}
              >
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                        {trilha.nome}
                      </h3>
                      {trilha.descricao && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{trilha.descricao}</p>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 ml-2 group-hover:text-primary transition-colors" />
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Badge className={cn("text-[10px]", tipoStyles[trilha.tipo])}>
                      {TRILHA_TIPO_LABELS[trilha.tipo]}
                    </Badge>
                    <Badge
                      className={cn(
                        "text-[10px]",
                        trilha.prioridade === "obrigatoria"
                          ? "bg-destructive/10 text-destructive"
                          : trilha.prioridade === "recomendada"
                          ? "bg-warning/10 text-warning"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {TRILHA_PRIORIDADE_LABELS[trilha.prioridade]}
                    </Badge>
                  </div>

                  {/* Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {trilha.totalConcluidos}/{trilha.total_modulos} módulos
                      </span>
                      <span className="font-medium text-foreground">{trilha.percentual}%</span>
                    </div>
                    <Progress value={trilha.percentual} className="h-2" />
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{trilha.total_modulos} módulos</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5" />
                      <span>{trilha.pontosObtidos} pts</span>
                    </div>
                    {trilha.prazo_dias && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{trilha.prazo_dias}d</span>
                      </div>
                    )}
                  </div>

                  {trilha.percentual >= 100 && (
                    <div className="flex items-center gap-2 text-success text-xs font-medium">
                      <Trophy className="w-4 h-4" />
                      <span>Trilha concluída!</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
