/**
 * RN-016 — Card do Índice de Confiabilidade Psicossocial
 *
 * Exibe visualmente o cruzamento entre dados psicossociais e indicadores
 * organizacionais reais (absenteísmo, acidentes, turnover, etc.)
 */
import { useState } from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIndiceConfiabilidade } from "@/hooks/useIndiceConfiabilidade";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  campanhaId: string;
  ipsScore: number;
}

const COR_CLASSIFICACAO = {
  alta: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", badge: "bg-emerald-100 text-emerald-800" },
  moderada: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", badge: "bg-amber-100 text-amber-800" },
  baixa: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", badge: "bg-red-100 text-red-800" },
  insuficiente: { bg: "bg-muted/50", border: "border-muted", text: "text-muted-foreground", badge: "bg-muted text-muted-foreground" },
};

const LABEL_CLASSIFICACAO = {
  alta: "Alta Confiabilidade",
  moderada: "Confiabilidade Moderada",
  baixa: "Baixa Confiabilidade",
  insuficiente: "Dados Insuficientes",
};

const ICON_CLASSIFICACAO = {
  alta: ShieldCheck,
  moderada: ShieldAlert,
  baixa: ShieldAlert,
  insuficiente: ShieldQuestion,
};

export function IndiceConfiabilidadeCard({ campanhaId, ipsScore }: Props) {
  const { indice, isLoading, calcular, isCalculating } = useIndiceConfiabilidade(campanhaId);
  const [expanded, setExpanded] = useState(false);

  const handleCalcular = async () => {
    try {
      await calcular({ campanhaId, ipsScore });
      toast.success("Índice de confiabilidade calculado com sucesso");
    } catch {
      toast.error("Erro ao calcular índice de confiabilidade");
    }
  };

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="h-24" />
      </Card>
    );
  }

  // Sem índice calculado — mostrar botão para calcular
  if (!indice) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6 text-center space-y-3">
          <ShieldQuestion className="h-8 w-8 mx-auto text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Índice de Confiabilidade (RN-016)</p>
            <p className="text-xs text-muted-foreground mt-1">
              Cruza dados psicossociais com indicadores reais da organização
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCalcular}
            disabled={isCalculating}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", isCalculating && "animate-spin")} />
            {isCalculating ? "Calculando..." : "Calcular Confiabilidade"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const cores = COR_CLASSIFICACAO[indice.classificacao];
  const IconeClassificacao = ICON_CLASSIFICACAO[indice.classificacao];

  return (
    <TooltipProvider>
      <Card className={cn("transition-all", cores.border, cores.bg)}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <IconeClassificacao className={cn("h-5 w-5", cores.text)} />
              Índice de Confiabilidade
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">
                    <strong>RN-016:</strong> Cruza os resultados do questionário psicossocial com dados
                    reais da organização (atestados, acidentes, turnover, humor, denúncias, afastamentos)
                    para validar a confiabilidade do diagnóstico.
                  </p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge className={cn("text-xs", cores.badge)}>
                {LABEL_CLASSIFICACAO[indice.classificacao]}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleCalcular}
                disabled={isCalculating}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isCalculating && "animate-spin")} />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Score principal */}
          <div className="flex items-center gap-3">
            <motion.span
              className={cn("text-3xl font-bold", cores.text)}
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              key={indice.indice}
            >
              {indice.indice}%
            </motion.span>
            <div className="flex-1">
              <Progress value={indice.indice} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                Período: {indice.periodoInicio} a {indice.periodoFim}
              </p>
            </div>
          </div>

          {/* Toggle detalhes */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="w-full text-xs gap-1"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" />
                Ocultar fontes cruzadas
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                Ver fontes cruzadas ({indice.fontes.length})
              </>
            )}
          </Button>

          {/* Detalhes das fontes */}
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="space-y-2"
            >
              {indice.fontes.map((f) => (
                <div
                  key={f.fonte}
                  className="flex items-center gap-2 p-2 rounded-lg bg-background/60"
                >
                  <span className="text-lg">{f.icone}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{f.fonte}</p>
                    <p className="text-xs text-muted-foreground truncate">{f.descricao}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={cn(
                      "text-sm font-semibold",
                      f.score >= 60 ? "text-emerald-600" : f.score >= 30 ? "text-amber-600" : "text-red-600"
                    )}>
                      {f.score}%
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] ml-1",
                        f.convergencia === "convergente" && "border-emerald-300 text-emerald-600",
                        f.convergencia === "divergente" && "border-red-300 text-red-600",
                        f.convergencia === "neutro" && "border-amber-300 text-amber-600"
                      )}
                    >
                      {f.convergencia === "convergente" ? "✓" : f.convergencia === "divergente" ? "✗" : "~"}
                    </Badge>
                  </div>
                </div>
              ))}

              <p className="text-[10px] text-muted-foreground text-center pt-1">
                Convergente = dados organizacionais confirmam o diagnóstico psicossocial
              </p>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
