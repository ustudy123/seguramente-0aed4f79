/**
 * GROCicloPDCA — Aba do ciclo PDCA para conformidade NR-1
 * Plan → Do → Check → Act com rastreabilidade total de riscos GRO
 */
import { useMemo } from "react";
import {
  Target,
  Wrench,
  Search,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  Brain,
  Activity,
  FileWarning,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { GRORisco, GROStatusCiclo } from "@/types/gro";
import { GRO_NIVEL_RISCO_LABELS, GRO_STATUS_LABELS } from "@/types/gro";

interface GROCicloPDCAProps {
  riscos: GRORisco[];
}

interface PDCAEtapa {
  key: GROStatusCiclo | "todos";
  label: string;
  labelPDCA: string;
  descricao: string;
  icon: React.ElementType;
  cor: string;
  corBg: string;
  corBorder: string;
  corProgress: string;
  nrRef: string;
}

const ETAPAS_PDCA: PDCAEtapa[] = [
  {
    key: "identificado",
    label: "Identificados",
    labelPDCA: "PLAN",
    descricao: "Perigos e riscos reconhecidos — aguardando avaliação",
    icon: Target,
    cor: "text-slate-700",
    corBg: "bg-slate-50",
    corBorder: "border-slate-200",
    corProgress: "bg-slate-500",
    nrRef: "NR-1 §1.4.1",
  },
  {
    key: "avaliado",
    label: "Avaliados",
    labelPDCA: "PLAN",
    descricao: "Risco quantificado — probabilidade × severidade calculados",
    icon: Search,
    cor: "text-blue-700",
    corBg: "bg-blue-50",
    corBorder: "border-blue-200",
    corProgress: "bg-blue-500",
    nrRef: "NR-1 §1.4.2",
  },
  {
    key: "controlado",
    label: "Controlados",
    labelPDCA: "DO",
    descricao: "Medidas de controle implementadas — ação vinculada",
    icon: Wrench,
    cor: "text-amber-700",
    corBg: "bg-amber-50",
    corBorder: "border-amber-200",
    corProgress: "bg-amber-500",
    nrRef: "NR-1 §1.4.3",
  },
  {
    key: "monitorado",
    label: "Monitorados",
    labelPDCA: "CHECK",
    descricao: "Eficácia das medidas sendo verificada continuamente",
    icon: TrendingUp,
    cor: "text-emerald-700",
    corBg: "bg-emerald-50",
    corBorder: "border-emerald-200",
    corProgress: "bg-emerald-500",
    nrRef: "NR-1 §1.4.4",
  },
  {
    key: "revisado",
    label: "Revisados",
    labelPDCA: "ACT",
    descricao: "Ciclo completo — risco gerenciado e documentado",
    icon: RotateCcw,
    cor: "text-purple-700",
    corBg: "bg-purple-50",
    corBorder: "border-purple-200",
    corProgress: "bg-purple-500",
    nrRef: "NR-1 §1.4.5",
  },
];

const NIVEL_COLORS: Record<string, string> = {
  critico: "bg-red-100 text-red-700 border-red-200",
  alto: "bg-orange-100 text-orange-700 border-orange-200",
  medio: "bg-amber-100 text-amber-700 border-amber-200",
  baixo: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const NIVEL_POINT: Record<string, string> = {
  critico: "bg-red-500",
  alto: "bg-orange-500",
  medio: "bg-amber-500",
  baixo: "bg-emerald-500",
};

export function GROCicloPDCA({ riscos }: GROCicloPDCAProps) {
  const total = riscos.length;

  const porEtapa = useMemo(() => {
    const map: Record<GROStatusCiclo, GRORisco[]> = {
      identificado: [],
      avaliado: [],
      controlado: [],
      monitorado: [],
      revisado: [],
    };
    riscos.forEach((r) => {
      if (map[r.status_gro]) map[r.status_gro].push(r);
    });
    return map;
  }, [riscos]);

  const naoToleraveis = riscos.filter((r) => ["alto", "critico"].includes(r.nivel_risco));
  const semAcao = naoToleraveis.filter((r) => !r.acao_id);
  const criticos = riscos.filter((r) => r.nivel_risco === "critico");

  // Métricas de maturidade PDCA
  const maturidadeScore = useMemo(() => {
    if (total === 0) return 0;
    const pesos: Record<GROStatusCiclo, number> = {
      identificado: 1,
      avaliado: 2,
      controlado: 3,
      monitorado: 4,
      revisado: 5,
    };
    const somaMax = total * 5;
    const somaAtual = riscos.reduce((acc, r) => acc + (pesos[r.status_gro] || 1), 0);
    return Math.round((somaAtual / somaMax) * 100);
  }, [riscos, total]);

  const maturidadeLabel =
    maturidadeScore >= 80
      ? "Avançado"
      : maturidadeScore >= 60
      ? "Consolidado"
      : maturidadeScore >= 40
      ? "Em desenvolvimento"
      : maturidadeScore >= 20
      ? "Inicial"
      : "Não iniciado";

  const maturidadeCor =
    maturidadeScore >= 80
      ? "text-emerald-700"
      : maturidadeScore >= 60
      ? "text-blue-700"
      : maturidadeScore >= 40
      ? "text-amber-700"
      : "text-red-700";

  return (
    <div className="space-y-4">
      {/* ── Cabeçalho PDCA ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Maturidade GRO */}
        <Card className="border-border/50 md:col-span-1">
          <CardContent className="py-4 px-5">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Maturidade GRO</span>
            </div>
            <p className={cn("text-3xl font-bold", maturidadeCor)}>{maturidadeScore}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">{maturidadeLabel}</p>
            <Progress value={maturidadeScore} className="mt-2 h-1.5" />
            <p className="text-[11px] text-muted-foreground mt-1.5">NR-1 · Processo PDCA contínuo</p>
          </CardContent>
        </Card>

        {/* Alertas críticos */}
        <Card
          className={cn(
            "border md:col-span-2",
            criticos.length > 0 || semAcao.length > 0
              ? "border-red-200 bg-red-50/30"
              : "border-border/50"
          )}
        >
          <CardContent className="py-4 px-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle
                className={cn(
                  "h-4 w-4",
                  criticos.length > 0 ? "text-red-600" : "text-muted-foreground"
                )}
              />
              <span className="text-xs font-medium text-muted-foreground">Atenção Imediata</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    criticos.length > 0 ? "text-red-700" : "text-foreground"
                  )}
                >
                  {criticos.length}
                </p>
                <p className="text-xs text-muted-foreground">Riscos Críticos</p>
              </div>
              <div>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    semAcao.length > 0 ? "text-orange-700" : "text-foreground"
                  )}
                >
                  {semAcao.length}
                </p>
                <p className="text-xs text-muted-foreground">Não toleráveis sem ação</p>
              </div>
            </div>
            {semAcao.length > 0 && (
              <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                <FileWarning className="h-3 w-3" />
                {semAcao.length} risco(s) alto/crítico sem plano de ação vinculado — não conformidade NR-1
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Funil PDCA ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-primary" />
            Ciclo GRO — PDCA Ergonômico
          </CardTitle>
          <CardDescription className="text-xs">
            NR-1 §1.4 — Identificar → Avaliar → Controlar → Monitorar → Revisar
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {/* Barra de funil visual */}
          <div className="px-5 pb-3">
            <div className="flex items-stretch gap-0.5 h-10">
              {ETAPAS_PDCA.map((etapa, idx) => {
                const lista = porEtapa[etapa.key as GROStatusCiclo] || [];
                const largura = total > 0 ? Math.max((lista.length / total) * 100, 4) : 20;
                return (
                  <div
                    key={etapa.key}
                    className="relative flex items-center justify-center text-white text-[10px] font-bold rounded overflow-hidden transition-all"
                    style={{ width: `${largura}%`, minWidth: 28 }}
                  >
                    <div className={cn("absolute inset-0", etapa.corProgress, "opacity-80")} />
                    <span className="relative z-10">{lista.length}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1">
              {ETAPAS_PDCA.map((e) => (
                <span key={e.key} className="text-[9px] text-muted-foreground flex-1 text-center">
                  {e.label}
                </span>
              ))}
            </div>
          </div>

          {/* Cards por etapa */}
          <div className="border-t border-border/50">
            {ETAPAS_PDCA.map((etapa, idx) => {
              const lista = (porEtapa[etapa.key as GROStatusCiclo] || []).slice(0, 5);
              const totalEtapa = (porEtapa[etapa.key as GROStatusCiclo] || []).length;
              const pct = total > 0 ? Math.round((totalEtapa / total) * 100) : 0;
              const Icon = etapa.icon;

              return (
                <div key={etapa.key} className={cn("border-b border-border/30 last:border-0")}>
                  {/* Header da etapa */}
                  <div className={cn("px-5 py-3 flex items-center gap-3", etapa.corBg)}>
                    <div className={cn("p-1.5 rounded-md border", etapa.corBorder)}>
                      <Icon className={cn("h-3.5 w-3.5", etapa.cor)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn("text-xs font-semibold", etapa.cor)}>{etapa.label}</span>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] h-4 px-1.5 border", etapa.corBorder, etapa.cor)}
                        >
                          {etapa.labelPDCA}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{etapa.nrRef}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{etapa.descricao}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn("text-lg font-bold", etapa.cor)}>{totalEtapa}</p>
                      <p className="text-[10px] text-muted-foreground">{pct}% do total</p>
                    </div>
                  </div>

                  {/* Lista de riscos nessa etapa */}
                  {lista.length > 0 && (
                    <div className="divide-y divide-border/20">
                      {lista.map((risco) => (
                        <div
                          key={risco.id}
                          className="px-5 py-2 flex items-center gap-3 hover:bg-muted/30 transition-colors"
                        >
                          <div
                            className={cn("w-2 h-2 rounded-full shrink-0", NIVEL_POINT[risco.nivel_risco])}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{risco.titulo}</p>
                            {(risco.setor || risco.dimensao_psicossocial) && (
                              <p className="text-[10px] text-muted-foreground truncate">
                                {risco.dimensao_psicossocial ?? risco.setor}
                                {risco.cargo ? ` · ${risco.cargo}` : ""}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge
                              variant="outline"
                              className={cn("text-[10px] h-4 px-1.5 border", NIVEL_COLORS[risco.nivel_risco])}
                            >
                              {GRO_NIVEL_RISCO_LABELS[risco.nivel_risco]}
                            </Badge>
                            {risco.subtipo === "psicossocial" ? (
                              <Brain className="h-3 w-3 text-purple-400" />
                            ) : (
                              <Activity className="h-3 w-3 text-blue-400" />
                            )}
                            {risco.acao_id ? (
                              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                            ) : ["alto", "critico"].includes(risco.nivel_risco) ? (
                              <AlertTriangle className="h-3 w-3 text-red-500" />
                            ) : (
                              <Clock className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      ))}
                      {totalEtapa > 5 && (
                        <div className="px-5 py-1.5 text-[11px] text-muted-foreground bg-muted/20">
                          + {totalEtapa - 5} mais nesta etapa
                        </div>
                      )}
                    </div>
                  )}

                  {/* Etapa vazia */}
                  {totalEtapa === 0 && (
                    <div className="px-5 py-2 text-[11px] text-muted-foreground italic">
                      Nenhum risco nesta etapa
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Checklist de conformidade NR-1 ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Checklist de Conformidade — Auditoria NR-1
          </CardTitle>
          <CardDescription className="text-xs">
            Resposta objetiva às 6 perguntas exigidas em auditoria (NR-1 + NR-17)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            {
              pergunta: "Como os perigos foram identificados?",
              ok: total > 0,
              resposta:
                total > 0
                  ? `${total} risco(s) identificado(s) via ${[...new Set(riscos.map((r) => r.fonte))].join(", ")}`
                  : "Nenhum risco registrado no GRO",
              ref: "RQ-07",
            },
            {
              pergunta: "Como os riscos foram avaliados?",
              ok: porEtapa.avaliado.length + porEtapa.controlado.length + porEtapa.monitorado.length + porEtapa.revisado.length > 0,
              resposta:
                porEtapa.avaliado.length + porEtapa.controlado.length + porEtapa.monitorado.length + porEtapa.revisado.length > 0
                  ? `Matriz de risco (probabilidade × severidade) — trigger automático`
                  : "Nenhum risco avaliado ainda",
              ref: "RQ-09",
            },
            {
              pergunta: "Quais critérios foram usados?",
              ok: true,
              resposta: "Probabilidade (5 níveis) × Severidade (4 níveis) → NR-1 Anexo I",
              ref: "RQ-26",
            },
            {
              pergunta: "Quais medidas foram adotadas?",
              ok: porEtapa.controlado.length + porEtapa.monitorado.length + porEtapa.revisado.length > 0,
              resposta:
                porEtapa.controlado.length + porEtapa.monitorado.length + porEtapa.revisado.length > 0
                  ? `${porEtapa.controlado.length + porEtapa.monitorado.length + porEtapa.revisado.length} risco(s) com medidas implementadas`
                  : semAcao.length > 0 ? `⚠ ${semAcao.length} risco(s) não tolerável(is) sem ação` : "Aguardando implementação",
              ref: "RQ-14",
            },
            {
              pergunta: "Como você monitora a eficácia?",
              ok: porEtapa.monitorado.length + porEtapa.revisado.length > 0,
              resposta:
                porEtapa.monitorado.length + porEtapa.revisado.length > 0
                  ? `${porEtapa.monitorado.length + porEtapa.revisado.length} risco(s) em monitoramento/revisado`
                  : "Nenhum risco em fase de monitoramento",
              ref: "RQ-17",
            },
            {
              pergunta: "Como envolve os trabalhadores?",
              ok: riscos.some((r) => r.fonte === "questionario"),
              resposta: riscos.some((r) => r.fonte === "questionario")
                ? "Questionários psicossociais aplicados — dados integrados ao GRO"
                : "Configure campanhas psicossociais para envolver trabalhadores",
              ref: "RQ-19",
            },
          ].map((item, i) => (
            <div
              key={i}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border",
                item.ok ? "bg-emerald-50/50 border-emerald-200/60" : "bg-red-50/50 border-red-200/60"
              )}
            >
              <div className="shrink-0 mt-0.5">
                {item.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">{item.pergunta}</p>
                <p className={cn("text-[11px] mt-0.5", item.ok ? "text-emerald-700" : "text-red-600")}>
                  {item.resposta}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 shrink-0 mt-0.5">
                {item.ref}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
