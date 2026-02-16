import { motion } from "framer-motion";
import {
  Trophy,
  Award,
  Star,
  Zap,
  Heart,
  Target,
  Flame,
  Crown,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useGamificacao, MedalhaConquistada } from "@/hooks/useGamificacao";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const iconMap: Record<string, React.ElementType> = {
  trophy: Trophy,
  award: Award,
  star: Star,
  zap: Zap,
  heart: Heart,
  target: Target,
  flame: Flame,
  crown: Crown,
};

export function MedalhasGaleria() {
  const { minhasMedalhas, loadingMedalhas } = useGamificacao();

  if (loadingMedalhas) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (minhasMedalhas.length === 0) {
    return (
      <div className="text-center py-16 bg-card rounded-xl border border-border">
        <Trophy className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" strokeWidth={1.5} />
        <p className="text-muted-foreground mb-1">Nenhuma medalha conquistada ainda</p>
        <p className="text-xs text-muted-foreground">Complete trilhas para ganhar medalhas!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {minhasMedalhas.map((mc, i) => {
        const medalha = mc.medalha;
        if (!medalha) return null;
        const Icon = iconMap[medalha.icone] || Trophy;
        return (
          <motion.div
            key={mc.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
          >
            <Card className="border-border hover:shadow-md transition-all text-center group">
              <CardContent className="p-4 space-y-2">
                <div
                  className="w-14 h-14 rounded-full mx-auto flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${medalha.cor}20` }}
                >
                  <Icon className="w-7 h-7" style={{ color: medalha.cor }} strokeWidth={1.75} />
                </div>
                <h4 className="text-sm font-semibold text-foreground leading-tight">{medalha.nome}</h4>
                {medalha.descricao && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{medalha.descricao}</p>
                )}
                {medalha.pontos_bonus > 0 && (
                  <Badge variant="outline" className="text-[10px]">
                    +{medalha.pontos_bonus} pts
                  </Badge>
                )}
                <p className="text-[10px] text-muted-foreground">
                  {format(new Date(mc.data_conquista), "dd MMM yyyy", { locale: ptBR })}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
