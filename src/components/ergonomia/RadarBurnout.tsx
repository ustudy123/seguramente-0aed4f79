import { motion } from "framer-motion";
import { Flame, AlertTriangle, TrendingDown, Clock, MessageSquareWarning, Heart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface RadarBurnoutProps {
  score: number;
  nivel: 'baixo' | 'moderado' | 'alto' | 'critico';
  fatores: {
    sobrecargaCognitiva: number;
    ritmoTrabalho: number;
    faltaPausas: number;
    humorNegativo: number;
    denuncias: number;
    exigenciasEmocionais: number;
  };
}

const NIVEL_CONFIG = {
  baixo: {
    color: 'text-success',
    bgColor: 'bg-success/10',
    borderColor: 'border-success/30',
    label: 'Baixo Risco',
    icon: '✓',
  },
  moderado: {
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    borderColor: 'border-warning/30',
    label: 'Atenção',
    icon: '⚠',
  },
  alto: {
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    label: 'Alto Risco',
    icon: '🔥',
  },
  critico: {
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/30',
    label: 'Crítico',
    icon: '🚨',
  },
};

const FATORES_CONFIG = [
  { key: 'sobrecargaCognitiva', label: 'Sobrecarga Cognitiva', icon: TrendingDown },
  { key: 'ritmoTrabalho', label: 'Ritmo de Trabalho', icon: Clock },
  { key: 'faltaPausas', label: 'Falta de Pausas', icon: AlertTriangle },
  { key: 'humorNegativo', label: 'Humor Negativo', icon: TrendingDown },
  { key: 'denuncias', label: 'Denúncias/Ocorrências', icon: MessageSquareWarning },
  { key: 'exigenciasEmocionais', label: 'Exigências Emocionais', icon: Heart },
] as const;

export function RadarBurnout({ score, nivel, fatores }: RadarBurnoutProps) {
  const config = NIVEL_CONFIG[nivel];

  return (
    <Card className={cn("border-2", config.borderColor)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className={cn("h-5 w-5", config.color)} />
            <span className="text-lg">Radar de Burnout</span>
          </div>
          <div className={cn("px-3 py-1 rounded-full text-sm font-medium", config.bgColor, config.color)}>
            {config.icon} {config.label}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score Principal */}
        <div className="text-center py-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className={cn(
              "inline-flex items-center justify-center w-24 h-24 rounded-full border-4",
              config.borderColor,
              config.bgColor
            )}
          >
            <span className={cn("text-3xl font-bold", config.color)}>{score}%</span>
          </motion.div>
          <p className="text-sm text-muted-foreground mt-2">
            Índice de Risco de Burnout
          </p>
        </div>

        {/* Fatores */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Fatores de Risco</p>
          {FATORES_CONFIG.map(({ key, label, icon: Icon }) => {
            const value = fatores[key];
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">{label}</span>
                  </div>
                  <span className={cn(
                    "font-medium",
                    value >= 70 ? "text-destructive" : 
                    value >= 40 ? "text-warning" : 
                    "text-muted-foreground"
                  )}>
                    {Math.round(value)}%
                  </span>
                </div>
                <Progress 
                  value={value} 
                  className={cn(
                    "h-1.5",
                    value >= 70 ? "[&>div]:bg-destructive" : 
                    value >= 40 ? "[&>div]:bg-warning" : 
                    "[&>div]:bg-muted-foreground"
                  )}
                />
              </div>
            );
          })}
        </div>

        {/* Dica */}
        {nivel !== 'baixo' && (
          <div className={cn("p-3 rounded-lg text-sm", config.bgColor)}>
            <p className={cn("font-medium", config.color)}>
              {nivel === 'critico' && "Ação imediata necessária! Revise a organização do trabalho."}
              {nivel === 'alto' && "Atenção: Fatores de risco elevados detectados."}
              {nivel === 'moderado' && "Monitore os indicadores e promova pausas regulares."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
