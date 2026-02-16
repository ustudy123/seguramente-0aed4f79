import { motion } from "framer-motion";
import {
  Trophy,
  Medal,
  Star,
  Crown,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useGamificacao } from "@/hooks/useGamificacao";
import { useAuth } from "@/hooks/useAuth";

const positionStyles = [
  { bg: "bg-amber-500/10", text: "text-amber-600", icon: Crown },
  { bg: "bg-slate-400/10", text: "text-slate-500", icon: Medal },
  { bg: "bg-orange-400/10", text: "text-orange-500", icon: Medal },
];

export function RankingBoard() {
  const { ranking, loadingRanking } = useGamificacao();
  const { user } = useAuth();

  if (loadingRanking) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (ranking.length === 0) {
    return (
      <div className="text-center py-16 bg-card rounded-xl border border-border">
        <TrendingUp className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" strokeWidth={1.5} />
        <p className="text-muted-foreground mb-1">Ranking ainda sem dados</p>
        <p className="text-xs text-muted-foreground">Conclua módulos para aparecer no ranking!</p>
      </div>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="w-5 h-5 text-warning" strokeWidth={1.75} />
          Ranking de Desenvolvimento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {ranking.map((entry, i) => {
          const isMe = entry.colaborador_id === user?.id;
          const posStyle = i < 3 ? positionStyles[i] : null;
          const PosIcon = posStyle?.icon || Star;

          return (
            <motion.div
              key={entry.colaborador_id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                isMe ? "border-primary/30 bg-primary/5" : "border-border hover:bg-accent/30"
              )}
            >
              {/* Position */}
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0",
                  posStyle?.bg || "bg-muted"
                )}
              >
                {i < 3 ? (
                  <PosIcon className={cn("w-4 h-4", posStyle?.text)} strokeWidth={1.75} />
                ) : (
                  <span className="text-sm font-bold text-muted-foreground">{i + 1}</span>
                )}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium truncate", isMe ? "text-primary" : "text-foreground")}>
                  {entry.colaborador_nome}
                  {isMe && <span className="text-xs ml-1 text-primary">(você)</span>}
                </p>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                  <span>{entry.trilhas_concluidas} trilhas</span>
                  <span>{entry.medalhas_count} medalhas</span>
                </div>
              </div>

              {/* Points */}
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-foreground">{entry.total_pontos}</p>
                <p className="text-[10px] text-muted-foreground">pontos</p>
              </div>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
}
