import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Activity,
  AlertTriangle,
  TrendingUp,
  Info,
  Zap,
  Target,
} from "lucide-react";
import type { EventoSST } from "@/types/eventoSST";
import { cn } from "@/lib/utils";

interface Props {
  eventos: EventoSST[];
}

interface SetorRisco {
  setor: string;
  score: number;
  nivel: "baixo" | "medio" | "alto" | "critico";
  total: number;
  acidentes: number;
  gravePct: number;
  turnoMaisRisco: string;
  tendencia: "estavel" | "crescente" | "decrescente";
  probabilidade30dias: number;
}

function calcularRiscoSetor(setor: string, eventos: EventoSST[]): SetorRisco {
  const evts = eventos.filter((e) => e.setor === setor);
  const acidentes = evts.filter((e) => e.tipo === "acidente");
  const graves = acidentes.filter((e) => e.gravidade_lesao === "grave" || e.obito);
  const gravePct = acidentes.length > 0 ? (graves.length / acidentes.length) * 100 : 0;

  // Frequência recente (últimos 3 meses) vs anterior
  const agora = new Date();
  const tresM = new Date(agora);
  tresM.setMonth(tresM.getMonth() - 3);
  const seisM = new Date(agora);
  seisM.setMonth(seisM.getMonth() - 6);

  const recentes = evts.filter((e) => new Date(e.data_evento) >= tresM).length;
  const anteriores = evts.filter(
    (e) => new Date(e.data_evento) >= seisM && new Date(e.data_evento) < tresM
  ).length;

  const tendencia: SetorRisco["tendencia"] =
    recentes > anteriores + 1 ? "crescente" :
    recentes < anteriores - 1 ? "decrescente" : "estavel";

  // Turno mais frequente
  const turnoCounts: Record<string, number> = {};
  evts.forEach((e) => {
    const t = e.turno || "Não informado";
    turnoCounts[t] = (turnoCounts[t] || 0) + 1;
  });
  const turnoMaisRisco = Object.entries(turnoCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

  // Score de risco (0-100)
  let score = 0;
  score += Math.min(evts.length * 5, 30); // Volume de eventos
  score += Math.min(acidentes.length * 8, 30); // Acidentes
  score += gravePct * 0.2; // % graves
  score += tendencia === "crescente" ? 20 : tendencia === "estavel" ? 5 : 0;
  score += Math.min(recentes * 3, 15); // Eventos recentes

  score = Math.min(Math.round(score), 100);

  // Probabilidade de acidente nos próximos 30 dias (modelo preditivo simples)
  const taxaMensal = recentes / 3; // acidentes por mês nos últimos 3 meses
  const probabilidade30dias = Math.min(
    Math.round((1 - Math.exp(-taxaMensal)) * 100),
    95
  );

  const nivel: SetorRisco["nivel"] =
    score >= 70 ? "critico" : score >= 45 ? "alto" : score >= 20 ? "medio" : "baixo";

  return {
    setor,
    score,
    nivel,
    total: evts.length,
    acidentes: acidentes.length,
    gravePct,
    turnoMaisRisco,
    tendencia,
    probabilidade30dias,
  };
}

export const AnalysePreditiva = ({ eventos }: Props) => {
  const setores = useMemo(() => {
    const unicos = [...new Set(eventos.map((e) => e.setor).filter(Boolean))] as string[];
    return unicos
      .map((s) => calcularRiscoSetor(s, eventos))
      .sort((a, b) => b.score - a.score);
  }, [eventos]);

  const nivelConfig = {
    baixo: { color: "text-green-600", bg: "bg-green-500", border: "border-green-200 bg-green-50/40", label: "Baixo Risco" },
    medio: { color: "text-amber-600", bg: "bg-amber-400", border: "border-amber-200 bg-amber-50/40", label: "Risco Médio" },
    alto: { color: "text-orange-600", bg: "bg-orange-500", border: "border-orange-200 bg-orange-50/40", label: "Alto Risco" },
    critico: { color: "text-destructive", bg: "bg-destructive", border: "border-red-200 bg-red-50/40", label: "Risco Crítico" },
  };

  const tendenciaConfig = {
    crescente: { icon: TrendingUp, color: "text-destructive", label: "Crescente ↑" },
    estavel: { icon: Activity, color: "text-muted-foreground", label: "Estável →" },
    decrescente: { icon: Activity, color: "text-green-600", label: "Decrescente ↓" },
  };

  // Top 3 setores críticos para destaque
  const topCriticos = setores.filter((s) => s.nivel === "critico" || s.nivel === "alto").slice(0, 3);

  if (setores.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 pb-4 text-center">
          <Target className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Sem dados de setor registrados para análise preditiva.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Informe o setor nos eventos para ativar o modelo de risco.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-base">Análise Preditiva de Acidentes</h3>
        <Badge variant="outline" className="text-xs">Score de Risco por Setor</Badge>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">
            O score é calculado com base em: volume de eventos, frequência de acidentes, gravidade, tendência temporal e recência. A probabilidade de 30 dias usa modelo de Poisson simples.
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Alertas proativos */}
      {topCriticos.length > 0 && (
        <Card className="border-destructive/30 bg-red-50/40 dark:bg-red-950/20">
          <CardContent className="pt-3 pb-3 px-4 space-y-2">
            <p className="text-xs font-semibold text-destructive flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              Setores que requerem ação prioritária imediata:
            </p>
            {topCriticos.map((s) => (
              <div key={s.setor} className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-destructive shrink-0" />
                <span className="font-medium flex-1">{s.setor}</span>
                <span className="text-xs text-destructive">
                  {s.probabilidade30dias}% prob./30 dias
                </span>
                <Badge
                  variant="destructive"
                  className="text-xs"
                >
                  Score {s.score}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Grid de setores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {setores.map((s) => {
          const cfg = nivelConfig[s.nivel];
          const tend = tendenciaConfig[s.tendencia];
          const TendIcon = tend.icon;
          return (
            <Card key={s.setor} className={cn("border transition-all hover:shadow-md", cfg.border)}>
              <CardContent className="pt-3 pb-3 px-4">
                <div className="flex items-start justify-between mb-2">
                  <span className="font-medium text-sm truncate flex-1 mr-2">{s.setor}</span>
                  <Badge variant="outline" className={cn("text-xs shrink-0", cfg.color)}>
                    {cfg.label}
                  </Badge>
                </div>

                {/* Score bar */}
                <div className="flex items-center gap-2 mb-3">
                  <span className={cn("text-2xl font-bold tabular-nums", cfg.color)}>{s.score}</span>
                  <div className="flex-1">
                    <div className="w-full h-2 rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", cfg.bg)}
                        style={{ width: `${s.score}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">/100 pts</span>
                  </div>
                </div>

                {/* Métricas */}
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">Prob. 30 dias</span>
                    <span className={cn("font-semibold tabular-nums", s.probabilidade30dias >= 60 ? "text-destructive" : s.probabilidade30dias >= 30 ? "text-amber-600" : "text-green-600")}>
                      {s.probabilidade30dias}%
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">Tendência</span>
                    <span className={cn("font-semibold flex items-center gap-0.5", tend.color)}>
                      <TendIcon className="w-3 h-3" />{tend.label}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">Acidentes</span>
                    <span className="font-semibold">{s.acidentes} de {s.total}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">Turno crítico</span>
                    <span className="font-semibold truncate">{s.turnoMaisRisco}</span>
                  </div>
                </div>

                {s.gravePct > 0 && (
                  <div className="mt-2 pt-2 border-t">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">% Acidentes graves</span>
                      <span className={cn("font-semibold", s.gravePct >= 30 ? "text-destructive" : "text-amber-600")}>
                        {s.gravePct.toFixed(0)}%
                      </span>
                    </div>
                    <Progress value={s.gravePct} className="h-1.5" />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        * Modelo preditivo baseado em análise de frequência histórica (Distribuição de Poisson). Não substitui avaliação de risco formal conforme NR-01.
      </p>
    </div>
  );
};
