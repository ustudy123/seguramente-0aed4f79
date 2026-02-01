import { motion } from "framer-motion";
import { AlertTriangle, Dumbbell, Brain, Building2, MapPin, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ErgonomiaRisco, ErgonomiaEixo, RiscoSeveridade } from "@/types/ergonomia";
import {
  EIXO_LABELS,
  EIXO_COLORS,
  SEVERIDADE_LABELS,
  SEVERIDADE_COLORS,
} from "@/types/ergonomia";

const EIXO_ICONS: Record<ErgonomiaEixo, React.ElementType> = {
  fisico: Dumbbell,
  cognitivo: Brain,
  organizacional: Building2,
};

interface RiscosListProps {
  riscos: ErgonomiaRisco[];
  onViewRisco?: (risco: ErgonomiaRisco) => void;
}

// Calcular grau de risco (severidade x probabilidade)
const calcularGrauRisco = (severidade: RiscoSeveridade, probabilidade: RiscoSeveridade): number => {
  const valores: Record<RiscoSeveridade, number> = {
    baixo: 1,
    medio: 2,
    alto: 3,
    critico: 4,
  };
  return valores[severidade] * valores[probabilidade];
};

const getGrauRiscoLabel = (grau: number): { label: string; color: string } => {
  if (grau <= 2) return { label: 'Baixo', color: 'bg-success/10 text-success border-success/30' };
  if (grau <= 6) return { label: 'Moderado', color: 'bg-warning/10 text-warning border-warning/30' };
  if (grau <= 12) return { label: 'Alto', color: 'bg-orange-500/10 text-orange-600 border-orange-500/30' };
  return { label: 'Crítico', color: 'bg-destructive/10 text-destructive border-destructive/30' };
};

export function RiscosList({ riscos, onViewRisco }: RiscosListProps) {
  if (riscos.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-12"
      >
        <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">Nenhum risco cadastrado</h3>
        <p className="text-muted-foreground">
          Cadastre riscos ergonômicos para acompanhamento e controle
        </p>
      </motion.div>
    );
  }

  // Agrupar por eixo
  const riscosPorEixo = riscos.reduce((acc, risco) => {
    if (!acc[risco.eixo]) {
      acc[risco.eixo] = [];
    }
    acc[risco.eixo].push(risco);
    return acc;
  }, {} as Record<ErgonomiaEixo, ErgonomiaRisco[]>);

  return (
    <div className="space-y-6">
      {(Object.keys(riscosPorEixo) as ErgonomiaEixo[]).map((eixo) => {
        const EixoIcon = EIXO_ICONS[eixo];
        const riscosDoEixo = riscosPorEixo[eixo];

        return (
          <Card key={eixo}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className={cn("p-2 rounded-lg", EIXO_COLORS[eixo])}>
                  <EixoIcon className="h-4 w-4" />
                </div>
                <span>Eixo {EIXO_LABELS[eixo]}</span>
                <Badge variant="secondary" className="ml-auto">
                  {riscosDoEixo.length} risco{riscosDoEixo.length !== 1 ? 's' : ''}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {riscosDoEixo.map((risco, index) => {
                const grau = calcularGrauRisco(risco.severidade, risco.probabilidade);
                const grauInfo = getGrauRiscoLabel(grau);

                return (
                  <motion.div
                    key={risco.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-4 rounded-lg border bg-card hover:border-primary/30 transition-colors cursor-pointer group"
                    onClick={() => onViewRisco?.(risco)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                            {risco.titulo}
                          </h4>
                        </div>
                        
                        {risco.descricao && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {risco.descricao}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={cn("text-xs", grauInfo.color)} variant="outline">
                            Grau: {grauInfo.label}
                          </Badge>
                          <Badge className={cn("text-xs", SEVERIDADE_COLORS[risco.severidade])}>
                            Severidade: {SEVERIDADE_LABELS[risco.severidade]}
                          </Badge>
                          <Badge className={cn("text-xs", SEVERIDADE_COLORS[risco.probabilidade])}>
                            Prob.: {SEVERIDADE_LABELS[risco.probabilidade]}
                          </Badge>
                          {risco.departamento && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {risco.departamento}
                            </span>
                          )}
                        </div>
                      </div>

                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                    </div>
                  </motion.div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
