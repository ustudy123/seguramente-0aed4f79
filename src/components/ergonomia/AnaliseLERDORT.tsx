import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  TrendingUp,
  Info,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePlanoAcao } from "@/hooks/usePlanoAcao";

interface AnaliseLERDORTProps {
  analiseLERDORT: {
    cargo: string;
    numAnalises: number;
    scoreTotal: number;
    probabilidade: "alta" | "moderada" | "baixa";
  }[];
}

const PROBABILIDADE_CONFIG = {
  alta: {
    label: "Alta",
    color: "text-destructive bg-destructive/10 border-destructive/30",
    barColor: "bg-destructive",
    icon: "🔴",
    descricao: "Risco elevado de LER/DORT. Intervenção urgente recomendada.",
  },
  moderada: {
    label: "Moderada",
    color: "text-warning bg-warning/10 border-warning/30",
    barColor: "bg-warning",
    icon: "🟡",
    descricao: "Monitoramento e medidas preventivas recomendados.",
  },
  baixa: {
    label: "Baixa",
    color: "text-success bg-success/10 border-success/30",
    barColor: "bg-success",
    icon: "🟢",
    descricao: "Risco controlado. Manter boas práticas ergonômicas.",
  },
};

const RECOMENDACOES_POR_NIVEL = {
  alta: [
    "Análise ergonômica aprofundada (AET)",
    "Revisão completa do posto de trabalho",
    "Implantação imediata de pausas programadas",
    "Rodízio de atividades",
    "Treinamento ergonômico obrigatório",
    "Avaliação médica ocupacional específica",
  ],
  moderada: [
    "Revisão do posto de trabalho",
    "Implantação de pausas",
    "Treinamento ergonômico",
    "Monitoramento periódico",
  ],
  baixa: [
    "Manutenção de boas práticas",
    "Treinamento preventivo anual",
    "Reavaliação periódica",
  ],
};

export function AnaliseLERDORT({ analiseLERDORT }: AnaliseLERDORTProps) {
  const [criadosAcoes, setCriadosAcoes] = useState<Set<string>>(new Set());
  const { createAcao } = usePlanoAcao();
  const navigate = useNavigate();

  const maxScore =
    analiseLERDORT.length > 0
      ? Math.max(...analiseLERDORT.map((a) => a.scoreTotal), 1)
      : 1;

  const handleGerarAcoes = async (cargo: string, probabilidade: "alta" | "moderada" | "baixa") => {
    const recomendacoes = RECOMENDACOES_POR_NIVEL[probabilidade];
    try {
      for (const rec of recomendacoes.slice(0, 3)) {
        await createAcao({
          titulo: `${rec} — ${cargo}`,
          descricao: `Ação preventiva de LER/DORT para o cargo ${cargo}. Probabilidade de risco: ${probabilidade}.`,
          porque: `Análise preditiva identificou probabilidade ${probabilidade} de LER/DORT para o cargo ${cargo}`,
          origem_modulo: "ergonomia",
          origem_descricao: "Análise de Probabilidade LER/DORT",
          prioridade: probabilidade === "alta" ? "alto" : probabilidade === "moderada" ? "medio" : "baixo",
          tipo: "preventiva",
          exige_evidencia: false,
        });
      }
      setCriadosAcoes((prev) => new Set([...prev, cargo]));
      toast.success(`${recomendacoes.slice(0, 3).length} ações criadas para ${cargo}!`, {
        action: {
          label: "Ver Plano de Ação",
          onClick: () => navigate("/plano-acao"),
        },
      });
    } catch {
      toast.error("Erro ao criar ações");
    }
  };

  if (analiseLERDORT.length === 0) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="py-16 text-center">
          <Activity className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-semibold text-lg mb-2">Análise ainda não disponível</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            A análise preditiva de LER/DORT será gerada automaticamente conforme as
            análises ergonômicas forem registradas no sistema.
          </p>
        </CardContent>
      </Card>
    );
  }

  const altasCount = analiseLERDORT.filter((a) => a.probabilidade === "alta").length;
  const moderadasCount = analiseLERDORT.filter((a) => a.probabilidade === "moderada").length;

  return (
    <div className="space-y-5">
      {/* Aviso metodológico */}
      <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg text-sm">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="font-medium mb-1">Análise Preditiva por IA</p>
          <p className="text-muted-foreground text-xs">
            A probabilidade de LER/DORT é calculada cruzando os riscos ergonômicos
            identificados por cargo (repetitividade, esforço físico, postura, organização do
            trabalho). Esta análise é indicativa e deve ser complementada por avaliação
            médica ocupacional.
          </p>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-3 px-4 text-center">
            <p className="text-2xl font-bold text-destructive">{altasCount}</p>
            <p className="text-xs text-muted-foreground">🔴 Alta probabilidade</p>
          </CardContent>
        </Card>
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="py-3 px-4 text-center">
            <p className="text-2xl font-bold text-warning">{moderadasCount}</p>
            <p className="text-xs text-muted-foreground">🟡 Moderada</p>
          </CardContent>
        </Card>
        <Card className="border-success/30 bg-success/5">
          <CardContent className="py-3 px-4 text-center">
            <p className="text-2xl font-bold text-success">
              {analiseLERDORT.length - altasCount - moderadasCount}
            </p>
            <p className="text-xs text-muted-foreground">🟢 Baixa</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de cargos */}
      <div className="space-y-3">
        {analiseLERDORT.map((item, idx) => {
          const config = PROBABILIDADE_CONFIG[item.probabilidade];
          const progressValue = Math.round((item.scoreTotal / maxScore) * 100);

          return (
            <motion.div
              key={item.cargo}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card className="border-border/50">
                <CardContent className="py-4 px-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">{item.cargo}</span>
                        <Badge
                          variant="outline"
                          className={cn("text-xs border", config.color)}
                        >
                          {config.icon} {config.label} Probabilidade
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {config.descricao}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">
                        {item.numAnalises} análise(s)
                      </p>
                    </div>
                  </div>

                  {/* Barra de score */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Score de risco</span>
                      <span>{item.scoreTotal} pts</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className={cn("h-full rounded-full", config.barColor)}
                        initial={{ width: 0 }}
                        animate={{ width: `${progressValue}%` }}
                        transition={{ delay: idx * 0.05 + 0.3, duration: 0.6 }}
                      />
                    </div>
                  </div>

                  {/* Recomendações */}
                  <div className="p-3 bg-muted/50 rounded-lg mb-3">
                    <p className="text-xs font-medium mb-2">Recomendações preventivas:</p>
                    <ul className="space-y-1">
                      {RECOMENDACOES_POR_NIVEL[item.probabilidade]
                        .slice(0, 3)
                        .map((rec, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
                            {rec}
                          </li>
                        ))}
                    </ul>
                  </div>

                  {criadosAcoes.has(item.cargo) ? (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      ✓ Ações criadas no Plano
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2 text-xs"
                      onClick={() => handleGerarAcoes(item.cargo, item.probabilidade)}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Gerar Plano de Ação Preventivo
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
