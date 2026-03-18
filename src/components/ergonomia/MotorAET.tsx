/**
 * MotorAET — Motor de Recomendação de AET (NR-17)
 * Detecta riscos alto/crítico e gera alerta técnico fundamentado
 * com gatilhos NR-17 e sugestão de abertura de AET formal.
 * GAP-E2: Inclui gatilho automático para riscos críticos importados de campanhas psicossociais.
 */
import { useMemo, useState } from "react";
import {
  Zap,
  AlertTriangle,
  Brain,
  Activity,
  ChevronDown,
  ChevronRight,
  FileText,
  CheckCircle2,
  XCircle,
  Info,
  Layers,
  Users,
  Clock,
  Shield,
  FlameKindling,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { GRORisco } from "@/types/gro";
import { GRO_NIVEL_RISCO_LABELS, GRO_PROBABILIDADE_LABELS, GRO_SEVERIDADE_LABELS } from "@/types/gro";

interface MotorAETProps {
  riscos: GRORisco[];
}

interface GatilhoAET {
  id: string;
  titulo: string;
  descricao: string;
  referencia: string;
  riscosAfetados: GRORisco[];
  criticidade: "obrigatoria" | "recomendada" | "sugerida";
}

const NIVEL_POINT: Record<string, string> = {
  critico: "bg-red-500",
  alto: "bg-orange-500",
  medio: "bg-amber-500",
  baixo: "bg-emerald-500",
};

const NIVEL_BADGE: Record<string, string> = {
  critico: "bg-red-100 text-red-700 border-red-200",
  alto: "bg-orange-100 text-orange-700 border-orange-200",
  medio: "bg-amber-100 text-amber-700 border-amber-200",
  baixo: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const CRITICIDADE_CONFIG = {
  obrigatoria: {
    label: "AET Prioritária",
    cor: "text-red-700 bg-red-50 border-red-200",
    icon: XCircle,
    iconCor: "text-red-600",
  },
  recomendada: {
    label: "AET Recomendada",
    cor: "text-orange-700 bg-orange-50 border-orange-200",
    icon: AlertTriangle,
    iconCor: "text-orange-600",
  },
  sugerida: {
    label: "AET Sugerida",
    cor: "text-blue-700 bg-blue-50 border-blue-200",
    icon: Info,
    iconCor: "text-blue-600",
  },
};

export function MotorAET({ riscos }: MotorAETProps) {
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const toggleExpandido = (id: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Motor de análise: detecta gatilhos para AET ──────────────────────────
  const gatilhos = useMemo<GatilhoAET[]>(() => {
    const resultado: GatilhoAET[] = [];

    // Gatilho 1: Risco alto ou crítico (NR-17 §17.1)
    const riscosCriticosAltos = riscos.filter((r) =>
      ["critico", "alto"].includes(r.nivel_risco)
    );
    if (riscosCriticosAltos.length > 0) {
      resultado.push({
        id: "risco_alto_critico",
        titulo: "Riscos Não Toleráveis Identificados",
        descricao:
          "Existem riscos classificados como Alto ou Crítico que exigem Análise Ergonômica do Trabalho (AET) para definição de medidas de controle adequadas, conforme NR-17 §17.1 e NR-1 §1.4.3.",
        referencia: "NR-17 §17.1 · NR-1 §1.4.3",
        riscosAfetados: riscosCriticosAltos,
        criticidade: riscosCriticosAltos.some((r) => r.nivel_risco === "critico")
          ? "obrigatoria"
          : "recomendada",
      });
    }

    // Gatilho 2: Múltiplos fatores físicos combinados (biomecânica + ambiente)
    const setoresFisicos = riscos
      .filter((r) => r.subtipo === "fisico" && r.setor)
      .reduce<Record<string, GRORisco[]>>((acc, r) => {
        const s = r.setor!;
        if (!acc[s]) acc[s] = [];
        acc[s].push(r);
        return acc;
      }, {});
    const setoresMultiplos = Object.entries(setoresFisicos)
      .filter(([, lista]) => lista.length >= 3)
      .map(([, lista]) => lista)
      .flat();
    if (setoresMultiplos.length > 0) {
      resultado.push({
        id: "multiplos_fatores",
        titulo: "Múltiplos Fatores Ergonômicos no Mesmo Setor",
        descricao:
          "Quando 3 ou mais fatores ergonômicos físicos são identificados no mesmo setor, a NR-17 recomenda AET para avaliação integrada do posto de trabalho, evitando análise fragmentada dos riscos.",
        referencia: "NR-17 §17.3 · NR-17 §17.4",
        riscosAfetados: setoresMultiplos,
        criticidade: "recomendada",
      });
    }

    // Gatilho 3: Indicadores psicossociais críticos (score >= 65 — limiar interno do sistema)
    const psicoCriticos = riscos.filter(
      (r) =>
        r.subtipo === "psicossocial" &&
        r.score_dimensao !== null &&
        r.score_dimensao !== undefined &&
        r.score_dimensao >= 65
    );
    if (psicoCriticos.length > 0) {
      resultado.push({
        id: "psicossocial_critico",
        titulo: "Indicadores Psicossociais em Nível Crítico",
        descricao:
          "O sistema identificou indicadores psicossociais em nível crítico. O sistema recomenda aprofundamento da análise ergonômica para investigar fatores organizacionais combinados, em linha com as diretrizes da ISO 45003 e NR-17 sobre organização do trabalho.",
        referencia: "ISO 45003 §5.4 · NR-17 §17.5",
        riscosAfetados: psicoCriticos,
        criticidade: "recomendada",
      });
    }

    // Gatilho 4: Riscos sem ação vinculada (não toleráveis)
    const semAcao = riscos.filter(
      (r) => ["alto", "critico"].includes(r.nivel_risco) && !r.acao_id
    );
    if (semAcao.length > 0) {
      resultado.push({
        id: "sem_acao",
        titulo: "Riscos Não Toleráveis sem Plano de Ação",
        descricao:
          "Riscos classificados como Alto ou Crítico sem plano de ação vinculado configuram não conformidade com a NR-1. A AET pode subsidiar a definição de medidas de controle prioritárias.",
        referencia: "NR-1 §1.4.3.c · Portaria MTE 1.419/2024",
        riscosAfetados: semAcao,
        criticidade: "obrigatoria",
      });
    }

    // Gatilho 5: Recorrência de riscos por dimensão psicossocial
    const dimensoesCount = riscos
      .filter((r) => r.subtipo === "psicossocial" && r.dimensao_psicossocial)
      .reduce<Record<string, number>>((acc, r) => {
        const d = r.dimensao_psicossocial!;
        acc[d] = (acc[d] || 0) + 1;
        return acc;
      }, {});
    const recorrentes = Object.entries(dimensoesCount)
      .filter(([, count]) => count >= 2)
      .map(([dim]) => dim);
    if (recorrentes.length > 0) {
      const riscosRec = riscos.filter(
        (r) => r.dimensao_psicossocial && recorrentes.includes(r.dimensao_psicossocial)
      );
      resultado.push({
        id: "recorrencia_psicossocial",
        titulo: "Recorrência de Fatores Psicossociais",
        descricao: `As dimensões "${recorrentes.join(", ")}" aparecem em múltiplas campanhas/registros, indicando padrão sistêmico que requer investigação aprofundada via AET organizacional.`,
        referencia: "ISO 45003 §6.1 · NR-1 §1.4.4",
        riscosAfetados: riscosRec,
        criticidade: "sugerida",
      });
    }

    // GAP-E2: Gatilho automático — riscos psicossociais Críticos importados de campanha encerrada
    // Quando campanha encerrada gera risco Crítico, dispara AET obrigatória cruzada
    const psicoCriticosImportados = riscos.filter(
      (r) =>
        r.subtipo === "psicossocial" &&
        r.fonte === "psicossocial" &&
        r.nivel_risco === "critico" &&
        r.campanha_id
    );
    if (psicoCriticosImportados.length > 0) {
      resultado.push({
        id: "gap_e2_campanha_critica",
        titulo: "⚡ Campanha Psicossocial: Risco Crítico Importado",
        descricao:
          "Riscos Críticos foram importados automaticamente ao encerrar uma campanha psicossocial. NR-17 §17.5 e ISO 45003 §5.4 exigem AET formal para investigar a organização do trabalho e definir medidas de controle estruturadas.",
        referencia: "NR-17 §17.5 · ISO 45003 §5.4 · NR-1 §1.4.3",
        riscosAfetados: psicoCriticosImportados,
        criticidade: "obrigatoria",
      });
    }

    // GAP-E2 (complemento): Riscos Altos importados de campanha — AET recomendada
    const psicoAltosImportados = riscos.filter(
      (r) =>
        r.subtipo === "psicossocial" &&
        r.fonte === "psicossocial" &&
        r.nivel_risco === "alto" &&
        r.campanha_id
    );
    if (psicoAltosImportados.length > 0 && psicoCriticosImportados.length === 0) {
      resultado.push({
        id: "gap_e2_campanha_alta",
        titulo: "Campanha Psicossocial: Riscos Altos Importados",
        descricao:
          "Riscos de nível Alto importados de campanhas psicossociais indicam necessidade de revisão da organização do trabalho via AET. Mapeie exposições combinadas e proponha medidas preventivas estruturadas.",
        referencia: "NR-17 §17.5 · ISO 45003 §6.1",
        riscosAfetados: psicoAltosImportados,
        criticidade: "recomendada",
      });
    }

    return resultado;
  }, [riscos]);

  const totalObrigatorias = gatilhos.filter((g) => g.criticidade === "obrigatoria").length;
  const totalRecomendadas = gatilhos.filter((g) => g.criticidade === "recomendada").length;

  if (riscos.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-12 text-center text-muted-foreground text-sm">
          <Zap className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Nenhum risco no GRO para análise.</p>
          <p className="text-xs mt-1">Registre ou importe riscos para o motor AET ser ativado.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Resumo do motor ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border/50">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Gatilhos Detectados</span>
            </div>
            <p className="text-2xl font-bold">{gatilhos.length}</p>
          </CardContent>
        </Card>
        <Card className={cn("border", totalObrigatorias > 0 ? "border-red-200 bg-red-50/20" : "border-border/50")}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className={cn("h-4 w-4", totalObrigatorias > 0 ? "text-red-600" : "text-muted-foreground")} />
              <span className="text-xs text-muted-foreground">AET Obrigatória</span>
            </div>
            <p className={cn("text-2xl font-bold", totalObrigatorias > 0 ? "text-red-700" : "")}>{totalObrigatorias}</p>
          </CardContent>
        </Card>
        <Card className={cn("border", totalRecomendadas > 0 ? "border-orange-200 bg-orange-50/20" : "border-border/50")}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className={cn("h-4 w-4", totalRecomendadas > 0 ? "text-orange-600" : "text-muted-foreground")} />
              <span className="text-xs text-muted-foreground">AET Recomendada</span>
            </div>
            <p className={cn("text-2xl font-bold", totalRecomendadas > 0 ? "text-orange-700" : "")}>{totalRecomendadas}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Riscos Analisados</span>
            </div>
            <p className="text-2xl font-bold">{riscos.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Alerta geral se há obrigatoriedade ── */}
      {totalObrigatorias > 0 && (
        <Alert className="border-red-300 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800 text-sm">AET Obrigatória — Ação Imediata</AlertTitle>
          <AlertDescription className="text-red-700 text-xs mt-1">
            Foram detectados {totalObrigatorias} gatilho(s) que exigem Análise Ergonômica do Trabalho (AET)
            de forma obrigatória. Conforme NR-17 §17.1 e NR-1 §1.4.3, riscos não toleráveis sem medidas
            de controle configuram infração administrativa. Recomenda-se acionar ergonomista habilitado.
          </AlertDescription>
        </Alert>
      )}

      {/* ── Sem gatilhos ── */}
      {gatilhos.length === 0 && (
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardContent className="py-6 text-center">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-800">Nenhum Gatilho de AET Detectado</p>
            <p className="text-xs text-emerald-700 mt-1">
              Os riscos registrados estão dentro dos parâmetros toleráveis. Continue monitorando.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Gatilhos detectados ── */}
      {gatilhos.map((gatilho) => {
        const config = CRITICIDADE_CONFIG[gatilho.criticidade];
        const CritIcon = config.icon;
        const isExpanded = expandidos.has(gatilho.id);

        return (
          <Card key={gatilho.id} className={cn("border", config.cor)}>
            <Collapsible open={isExpanded} onOpenChange={() => toggleExpandido(gatilho.id)}>
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-3 cursor-pointer hover:bg-black/5 transition-colors rounded-t-lg">
                  <div className="flex items-start gap-3">
                    <CritIcon className={cn("h-5 w-5 mt-0.5 shrink-0", config.iconCor)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-sm">{gatilho.titulo}</CardTitle>
                        <Badge variant="outline" className={cn("text-[10px] h-5 px-2 border font-semibold", config.cor)}>
                          {config.label}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs mt-1">{gatilho.descricao}</CardDescription>
                      <div className="flex items-center gap-3 mt-2">
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                          {gatilho.referencia}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {gatilho.riscosAfetados.length} risco(s) afetado(s)
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 mt-1">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="pt-0 pb-4">
                  <div className="border-t border-border/40 pt-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Riscos que acionaram este gatilho:
                    </p>
                    {gatilho.riscosAfetados.slice(0, 8).map((risco) => (
                      <div
                        key={risco.id}
                        className="flex items-center gap-3 p-2.5 bg-background/80 rounded-md border border-border/40"
                      >
                        <div className={cn("w-2 h-2 rounded-full shrink-0", NIVEL_POINT[risco.nivel_risco])} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{risco.titulo}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {risco.setor && (
                              <span className="text-[10px] text-muted-foreground">{risco.setor}</span>
                            )}
                            {risco.dimensao_psicossocial && (
                              <span className="text-[10px] text-purple-600">{risco.dimensao_psicossocial}</span>
                            )}
                            {risco.score_dimensao && (
                              <span className="text-[10px] text-muted-foreground">Score: {risco.score_dimensao}%</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] h-4 px-1.5 border", NIVEL_BADGE[risco.nivel_risco])}
                          >
                            {GRO_NIVEL_RISCO_LABELS[risco.nivel_risco]}
                          </Badge>
                          {risco.subtipo === "psicossocial" ? (
                            <Brain className="h-3 w-3 text-purple-400" />
                          ) : (
                            <Activity className="h-3 w-3 text-blue-400" />
                          )}
                        </div>
                      </div>
                    ))}
                    {gatilho.riscosAfetados.length > 8 && (
                      <p className="text-[11px] text-muted-foreground px-2.5">
                        + {gatilho.riscosAfetados.length - 8} outros riscos
                      </p>
                    )}

                    {/* Orientação técnica */}
                    <div className="mt-3 p-3 bg-muted/30 rounded-md border border-border/30">
                      <p className="text-xs font-medium text-foreground mb-1 flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" />
                        Próximos Passos Recomendados
                      </p>
                      {gatilho.criticidade === "obrigatoria" && (
                        <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside">
                          <li>Contratar ergonomista habilitado (CREA/CFM) para conduzir a AET</li>
                          <li>Documentar a solicitação com data e justificativa técnica</li>
                          <li>Vincular plano de ação aos riscos identificados no GRO</li>
                          <li>Registrar no PGR como medida de controle em implementação</li>
                        </ul>
                      )}
                      {gatilho.criticidade === "recomendada" && (
                        <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside">
                          <li>Avaliar viabilidade de AET no próximo ciclo de revisão</li>
                          <li>Registrar recomendação no GRO como item pendente</li>
                          <li>Priorizar setores com maior concentração de riscos</li>
                        </ul>
                      )}
                      {gatilho.criticidade === "sugerida" && (
                        <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside">
                          <li>Monitorar evolução dos indicadores nas próximas campanhas</li>
                          <li>Considerar grupo focal ou entrevistas com trabalhadores</li>
                          <li>Registrar como ponto de atenção no relatório psicossocial</li>
                        </ul>
                      )}
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}

      {/* ── O que é AET ── */}
      <Card className="border-border/50 bg-muted/20">
        <CardContent className="py-4 px-5">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-foreground">O que é a AET?</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                A <strong>Análise Ergonômica do Trabalho (AET)</strong> é um documento técnico exigido pela NR-17
                que aprofunda a investigação de postos de trabalho com riscos identificados na AEP.
                Deve ser conduzida por ergonomista certificado e resulta em recomendações técnicas para
                adequação das condições de trabalho. É parte integrante do PGR conforme NR-1.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
