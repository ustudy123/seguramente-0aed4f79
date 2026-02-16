import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  AlertTriangle,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Target,
  BarChart3,
  Activity,
  Flame,
  ShieldAlert,
  PieChart,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { INRColaborador } from "@/hooks/useINR";

interface FeriasInteligenciaProps {
  ranking: INRColaborador[];
  criticos: INRColaborador[];
  altos: INRColaborador[];
  onCriarAcaoPreventiva?: (colab: INRColaborador) => void;
  colaboradoresPorSetor: Record<string, { total: number; vencidos: number; alerta: number }>;
}

const nivelConfig = {
  critico: { label: "Crítico", color: "bg-destructive/10 text-destructive border-destructive/20", bar: "bg-destructive" },
  alto: { label: "Alto", color: "bg-warning/10 text-warning border-warning/20", bar: "bg-warning" },
  moderado: { label: "Moderado", color: "bg-info/10 text-info border-info/20", bar: "bg-info" },
  baixo: { label: "Baixo", color: "bg-success/10 text-success border-success/20", bar: "bg-success" },
};

export function FeriasInteligencia({
  ranking,
  criticos,
  altos,
  onCriarAcaoPreventiva,
  colaboradoresPorSetor,
}: FeriasInteligenciaProps) {
  const [expanded, setExpanded] = useState(false);
  const topRanking = expanded ? ranking.filter((r) => r.score > 0) : ranking.filter((r) => r.score > 0).slice(0, 5);
  const setores = Object.entries(colaboradoresPorSetor).sort((a, b) => b[1].vencidos - a[1].vencidos);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* INR™ Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <Brain className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            Inteligência de Férias
            <Badge variant="outline" className="text-[10px] font-mono">INR™</Badge>
          </h2>
          <p className="text-xs text-muted-foreground">
            Indicador de Necessidade de Recuperação — cruza humor, ações, carga e vencimentos
          </p>
        </div>
      </div>

      {/* Alerts */}
      {(criticos.length > 0 || altos.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {criticos.length > 0 && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 flex items-start gap-3">
              <Flame className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-destructive">
                  {criticos.length} colaborador(es) em estado crítico
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {criticos.map((c) => c.nome.split(" ")[0]).join(", ")} — recomendação imediata de férias
                </p>
              </div>
            </div>
          )}
          {altos.length > 0 && (
            <div className="bg-warning/5 border border-warning/20 rounded-xl p-4 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-warning mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-warning">
                  {altos.length} colaborador(es) com risco alto
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Monitorar e planejar férias nos próximos 30 dias
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* INR Ranking */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border shadow-sm">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Ranking INR™</h3>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {ranking.filter((r) => r.score > 0).length} monitorados
            </Badge>
          </div>

          <div className="divide-y divide-border">
            {topRanking.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Nenhum colaborador com score INR elevado no momento
              </div>
            ) : (
              topRanking.map((colab, i) => {
                const cfg = nivelConfig[colab.nivel];
                return (
                  <div
                    key={colab.nome}
                    className={cn(
                      "p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors",
                      colab.nivel === "critico" && "bg-destructive/5"
                    )}
                  >
                    {/* Position */}
                    <span className="text-xs font-mono text-muted-foreground w-5 text-right">
                      {i + 1}
                    </span>

                    {/* Avatar */}
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                        {colab.nome.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground truncate">
                          {colab.nome}
                        </span>
                        <Badge className={cn("text-[10px] shrink-0", cfg.color)}>
                          {cfg.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[11px] text-muted-foreground truncate">
                          {colab.departamento}
                        </p>
                        {colab.fatores.length > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-[11px] cursor-help">
                                {colab.fatores.map((f) => f.icone).join(" ")}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs max-w-[250px]">
                              <ul className="space-y-1">
                                {colab.fatores.map((f, fi) => (
                                  <li key={fi}>
                                    <span className="font-medium">{f.fonte}:</span> {f.descricao} (+{f.peso}pts)
                                  </li>
                                ))}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>

                    {/* Score bar */}
                    <div className="flex items-center gap-3 w-32 shrink-0">
                      <Progress
                        value={colab.score}
                        className={cn("h-2 flex-1", cfg.bar)}
                      />
                      <span className="text-xs font-bold text-foreground w-7 text-right">
                        {colab.score}
                      </span>
                    </div>

                    {/* Action */}
                    {(colab.nivel === "critico" || colab.nivel === "alto") && onCriarAcaoPreventiva && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => onCriarAcaoPreventiva(colab)}
                          >
                            <Target className="w-3.5 h-3.5 text-primary" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs">
                          Criar ação preventiva no Plano de Ação
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {ranking.filter((r) => r.score > 0).length > 5 && (
            <div className="p-3 border-t border-border text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="text-xs"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="w-3 h-3 mr-1" /> Mostrar menos
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3 mr-1" /> Ver todos ({ranking.filter((r) => r.score > 0).length})
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Sidebar: Relatórios por Setor */}
        <div className="space-y-4">
          {/* Férias Vencidas por Setor */}
          <div className="bg-card rounded-xl border border-border shadow-sm">
            <div className="p-4 border-b border-border flex items-center gap-2">
              <PieChart className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Férias por Setor</h3>
            </div>
            <div className="divide-y divide-border">
              {setores.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-xs">
                  Sem dados setoriais
                </div>
              ) : (
                setores.slice(0, 6).map(([setor, data]) => (
                  <div key={setor} className="p-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{setor}</p>
                      <p className="text-[10px] text-muted-foreground">{data.total} colaboradores</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {data.vencidos > 0 && (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px]">
                          {data.vencidos} vencido(s)
                        </Badge>
                      )}
                      {data.alerta > 0 && (
                        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-[10px]">
                          {data.alerta} alerta(s)
                        </Badge>
                      )}
                      {data.vencidos === 0 && data.alerta === 0 && (
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-[10px]">
                          OK
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Risco Trabalhista */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Risco Trabalhista</h3>
            </div>
            {(() => {
              const totalVencidos = Object.values(colaboradoresPorSetor).reduce(
                (s, d) => s + d.vencidos,
                0
              );
              const totalAlerta = Object.values(colaboradoresPorSetor).reduce(
                (s, d) => s + d.alerta,
                0
              );
              const totalGeral = Object.values(colaboradoresPorSetor).reduce(
                (s, d) => s + d.total,
                0
              );
              const riscoScore = totalGeral > 0
                ? Math.round(((totalVencidos * 2 + totalAlerta) / (totalGeral * 2)) * 100)
                : 0;

              return (
                <div className="space-y-3">
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-bold text-foreground">{riscoScore}%</span>
                    <span className="text-xs text-muted-foreground mb-1">exposição</span>
                  </div>
                  <Progress value={riscoScore} className="h-2" />
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-destructive/5 rounded-lg p-2 text-center">
                      <p className="font-bold text-destructive">{totalVencidos}</p>
                      <p className="text-muted-foreground">Vencidas</p>
                    </div>
                    <div className="bg-warning/5 rounded-lg p-2 text-center">
                      <p className="font-bold text-warning">{totalAlerta}</p>
                      <p className="text-muted-foreground">A vencer ≤90d</p>
                    </div>
                  </div>
                  {totalVencidos > 0 && (
                    <p className="text-[10px] text-destructive/80">
                      ⚠ Férias vencidas geram multa de pagamento em dobro (Art. 137, CLT)
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
