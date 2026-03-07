import { useState } from "react";
import { motion } from "framer-motion";
import {
  Map,
  AlertTriangle,
  ChevronRight,
  Building2,
  Users,
  TrendingUp,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { ErgonomiaAnalise } from "@/hooks/useErgonomiaAnalises";

interface MapaRiscoErgonomicoProps {
  mapaRiscos: Record<
    string,
    {
      setor: string;
      analises: ErgonomiaAnalise[];
      classificacao: "baixo" | "moderado" | "alto";
      totalRiscos: number;
      cargos: string[];
    }
  >;
}

const CLASSIFICACAO_CONFIG = {
  baixo: {
    label: "Baixo",
    color: "bg-success/15 border-success/40 hover:bg-success/25",
    badgeColor: "bg-success/10 text-success border-success/30",
    icon: "🟢",
    textColor: "text-success",
  },
  moderado: {
    label: "Moderado",
    color: "bg-warning/15 border-warning/40 hover:bg-warning/25",
    badgeColor: "bg-warning/10 text-warning border-warning/30",
    icon: "🟡",
    textColor: "text-warning",
  },
  alto: {
    label: "Alto",
    color: "bg-destructive/15 border-destructive/40 hover:bg-destructive/25",
    badgeColor: "bg-destructive/10 text-destructive border-destructive/30",
    icon: "🔴",
    textColor: "text-destructive",
  },
};

export function MapaRiscoErgonomico({ mapaRiscos }: MapaRiscoErgonomicoProps) {
  const [setorSelecionado, setSetorSelecionado] = useState<string | null>(null);

  const setores = Object.values(mapaRiscos);
  const setorDetalhe = setorSelecionado ? mapaRiscos[setorSelecionado] : null;

  if (setores.length === 0) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="py-16 text-center">
          <Map className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-semibold text-lg mb-2">Mapa ainda não disponível</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            O mapa de risco ergonômico será gerado automaticamente conforme as
            análises forem realizadas e registradas no sistema.
          </p>
        </CardContent>
      </Card>
    );
  }

  const contadores = {
    alto: setores.filter((s) => s.classificacao === "alto").length,
    moderado: setores.filter((s) => s.classificacao === "moderado").length,
    baixo: setores.filter((s) => s.classificacao === "baixo").length,
  };

  return (
    <div className="space-y-5">
      {/* Legenda / Resumo */}
      <div className="grid grid-cols-3 gap-3">
        {(["alto", "moderado", "baixo"] as const).map((nivel) => (
          <Card key={nivel} className={cn("border", CLASSIFICACAO_CONFIG[nivel].color)}>
            <CardContent className="py-3 px-4 text-center">
              <p className="text-2xl mb-0.5">{CLASSIFICACAO_CONFIG[nivel].icon}</p>
              <p className={cn("text-xl font-bold", CLASSIFICACAO_CONFIG[nivel].textColor)}>
                {contadores[nivel]}
              </p>
              <p className="text-xs text-muted-foreground">
                {contadores[nivel] === 1 ? "setor" : "setores"} com risco{" "}
                {CLASSIFICACAO_CONFIG[nivel].label.toLowerCase()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info */}
      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 shrink-0" />
        Mapa gerado automaticamente a partir das análises registradas. Clique em um setor
        para ver detalhes.
      </div>

      {/* Grid de setores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {setores
          .sort((a, b) => {
            const order = { alto: 0, moderado: 1, baixo: 2 };
            return order[a.classificacao] - order[b.classificacao];
          })
          .map((setor, idx) => {
            const config = CLASSIFICACAO_CONFIG[setor.classificacao];
            return (
              <motion.div
                key={setor.setor}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card
                  className={cn(
                    "border-2 cursor-pointer transition-all",
                    config.color
                  )}
                  onClick={() => setSetorSelecionado(setor.setor)}
                >
                  <CardContent className="py-4 px-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-sm">{setor.setor}</span>
                      </div>
                      <Badge variant="outline" className={cn("text-xs border", config.badgeColor)}>
                        {config.icon} {config.label}
                      </Badge>
                    </div>

                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>{setor.totalRiscos} risco(s) identificado(s)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        <span>{setor.cargos.length} cargo(s) avaliado(s)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5" />
                        <span>{setor.analises.length} análise(s) realizada(s)</span>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1">
                      {setor.cargos.slice(0, 3).map((cargo) => (
                        <Badge key={cargo} variant="secondary" className="text-xs">
                          {cargo}
                        </Badge>
                      ))}
                      {setor.cargos.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{setor.cargos.length - 3}
                        </Badge>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-3 gap-1 text-xs h-7"
                    >
                      Ver detalhes
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
      </div>

      {/* Sheet de detalhe do setor */}
      <Sheet open={!!setorSelecionado} onOpenChange={(o) => !o && setSetorSelecionado(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          {setorDetalhe && (
            <>
              <SheetHeader className="mb-5">
                <SheetTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  {setorDetalhe.setor}
                </SheetTitle>
                <Badge
                  variant="outline"
                  className={cn(
                    "w-fit text-sm border",
                    CLASSIFICACAO_CONFIG[setorDetalhe.classificacao].badgeColor
                  )}
                >
                  {CLASSIFICACAO_CONFIG[setorDetalhe.classificacao].icon} Risco{" "}
                  {CLASSIFICACAO_CONFIG[setorDetalhe.classificacao].label}
                </Badge>
              </SheetHeader>

              <div className="space-y-5">
                {/* Cargos */}
                <div>
                  <h4 className="text-sm font-semibold mb-3">Cargos Analisados</h4>
                  <div className="flex flex-wrap gap-2">
                    {setorDetalhe.cargos.map((cargo) => (
                      <Badge key={cargo} variant="secondary">
                        {cargo}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Análises realizadas */}
                <div>
                  <h4 className="text-sm font-semibold mb-3">
                    Análises Realizadas ({setorDetalhe.analises.length})
                  </h4>
                  <div className="space-y-3">
                    {setorDetalhe.analises.map((analise) => (
                      <div
                        key={analise.id}
                        className="p-3 rounded-lg bg-muted/50 text-sm"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{analise.cargo}</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs border",
                              CLASSIFICACAO_CONFIG[analise.classificacao_risco].badgeColor
                            )}
                          >
                            {CLASSIFICACAO_CONFIG[analise.classificacao_risco].icon}{" "}
                            {CLASSIFICACAO_CONFIG[analise.classificacao_risco].label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                          {analise.resumo_geral || "Sem resumo disponível"}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>
                            {(analise.riscos_identificados || []).length} risco(s)
                          </span>
                          <span>•</span>
                          <span>Conformidade: {analise.conformidade_estimada}%</span>
                        </div>

                        {/* Top riscos */}
                        {(analise.riscos_identificados || []).filter(
                          (r) => r.severidade === "critico" || r.severidade === "alto"
                        ).length > 0 && (
                          <div className="mt-2 pt-2 border-t border-border/50">
                            <p className="text-xs font-medium text-destructive mb-1">
                              Riscos críticos/altos:
                            </p>
                            {analise.riscos_identificados
                              .filter(
                                (r) =>
                                  r.severidade === "critico" || r.severidade === "alto"
                              )
                              .map((r, i) => (
                                <p key={i} className="text-xs text-muted-foreground">
                                  • {r.tipo}
                                </p>
                              ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
