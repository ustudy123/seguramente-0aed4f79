import { motion } from "framer-motion";
import { Zap, Heart, Users, Brain, TrendingUp, Maximize2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface RadarEnergiaProps {
  score: number;
  nivel: 'baixo' | 'moderado' | 'alto' | 'excelente';
  fatores: {
    vitalidade: number;
    engajamento: number;
    presencaPsicologica: number;
    sustentabilidade: number;
  };
  onClick?: () => void;
}

const NIVEL_CONFIG = {
  baixo: {
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/30',
    label: 'Baixa Energia',
    icon: '⚡',
  },
  moderado: {
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    borderColor: 'border-warning/30',
    label: 'Moderada',
    icon: '⚡',
  },
  alto: {
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    label: 'Alta Energia',
    icon: '⚡⚡',
  },
  excelente: {
    color: 'text-success',
    bgColor: 'bg-success/10',
    borderColor: 'border-success/30',
    label: 'Excelente',
    icon: '⚡⚡⚡',
  },
};

const FATORES_CONFIG = [
  { key: 'vitalidade', label: 'Vitalidade da Equipe', icon: Heart },
  { key: 'engajamento', label: 'Engajamento', icon: TrendingUp },
  { key: 'presencaPsicologica', label: 'Presença Psicológica', icon: Brain },
  { key: 'sustentabilidade', label: 'Sustentabilidade', icon: Users },
] as const;

export function RadarEnergia({ score, nivel, fatores, onClick }: RadarEnergiaProps) {
  const config = NIVEL_CONFIG[nivel];

  return (
    <Card 
      className={cn(
        "border-2 transition-all duration-200",
        config.borderColor,
        onClick && "cursor-pointer hover:shadow-lg hover:scale-[1.02]"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className={cn("h-5 w-5", config.color)} />
            <span className="text-lg">Energia Organizacional</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn("px-3 py-1 rounded-full text-sm font-medium", config.bgColor, config.color)}>
              {config.icon} {config.label}
            </div>
            {onClick && (
              <Maximize2 className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
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
            Índice de Energia Organizacional
          </p>
        </div>

        {/* Fatores */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Componentes</p>
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
                    value >= 70 ? "text-success" : 
                    value >= 40 ? "text-warning" : 
                    "text-destructive"
                  )}>
                    {Math.round(value)}%
                  </span>
                </div>
                <Progress 
                  value={value} 
                  className={cn(
                    "h-1.5",
                    value >= 70 ? "[&>div]:bg-success" : 
                    value >= 40 ? "[&>div]:bg-warning" : 
                    "[&>div]:bg-destructive"
                  )}
                />
              </div>
            );
          })}
        </div>

        {/* Insight */}
        <div className={cn("p-3 rounded-lg text-sm", config.bgColor)}>
          <p className={cn("font-medium", config.color)}>
            {nivel === 'excelente' && "🌟 Organização com alta energia e engajamento!"}
            {nivel === 'alto' && "Bom nível de energia. Continue investindo no bem-estar."}
            {nivel === 'moderado' && "Energia moderada. Identifique oportunidades de melhoria."}
            {nivel === 'baixo' && "⚠️ Baixa energia detectada. Ação necessária."}
          </p>
        </div>

        {/* Indicador de clique */}
        {onClick && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            Clique para ver detalhes
          </p>
        )}
      </CardContent>
    </Card>
  );
}
