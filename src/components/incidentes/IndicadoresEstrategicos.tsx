import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, TrendingDown, TrendingUp, Minus, AlertTriangle, Target, Clock, ShieldCheck } from "lucide-react";
import type { EventoSST } from "@/types/eventoSST";

interface Props {
  eventos: EventoSST[];
  totalColaboradores?: number;
  horasTrabalhadasAno?: number;
}

const InfoTooltip = ({ text }: { text: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help inline-block ml-1" />
    </TooltipTrigger>
    <TooltipContent className="max-w-xs text-xs">{text}</TooltipContent>
  </Tooltip>
);

export const IndicadoresEstrategicos = ({ eventos, totalColaboradores = 100, horasTrabalhadasAno = 200000 }: Props) => {
  const acidentes = eventos.filter(e => e.tipo === "acidente");
  const incidentes = eventos.filter(e => e.tipo === "incidente");
  const acidentesComAfastamento = acidentes.filter(e => e.afastamento && e.afastamento !== "sem_afastamento");
  const acidentesGraves = acidentes.filter(e => e.gravidade_lesao === "grave" || e.obito);
  const comCausaRaiz = eventos.filter(e => e.percepcao_causa && e.percepcao_causa.trim().length > 10);
  const nearMiss = incidentes.length;

  // LTIFR — Lost Time Injury Frequency Rate
  // (Nº acidentes com afastamento / Horas trabalhadas) × 1.000.000
  const ltifr = horasTrabalhadasAno > 0
    ? ((acidentesComAfastamento.length / horasTrabalhadasAno) * 1_000_000)
    : 0;

  // Severity Rate (Taxa de Gravidade)
  // (Total dias perdidos / Horas trabalhadas) × 1.000.000
  const totalDiasAfastamento = acidentes.reduce((acc, e) => {
    if (!e.afastamento || e.afastamento === "sem_afastamento") return acc;
    if (e.afastamento === "ate_15_dias") return acc + 8;
    return acc + 30;
  }, 0);
  const severityRate = horasTrabalhadasAno > 0
    ? ((totalDiasAfastamento / horasTrabalhadasAno) * 1_000_000)
    : 0;

  // Taxa de incidência (acidentes por 100 trabalhadores)
  const taxaIncidencia = totalColaboradores > 0
    ? ((acidentes.length / totalColaboradores) * 100)
    : 0;

  // % eventos com causa raiz definida
  const pctCausaRaiz = eventos.length > 0
    ? ((comCausaRaiz.length / eventos.length) * 100)
    : 0;

  // Índice de near miss (relação near miss / acidentes — Bird: ideal ~300:1)
  const indiceBird = acidentes.length > 0 ? (nearMiss / acidentes.length) : nearMiss;

  // Índice de reincidência (mesmo setor, múltiplos eventos)
  const setorFreq: Record<string, number> = {};
  eventos.forEach(e => {
    const k = e.setor || "Não informado";
    setorFreq[k] = (setorFreq[k] || 0) + 1;
  });
  const setoresReincidentes = Object.values(setorFreq).filter(v => v >= 3).length;

  const getStatusBird = () => {
    if (indiceBird >= 300) return { label: "Excelente", color: "text-green-600", icon: TrendingDown };
    if (indiceBird >= 100) return { label: "Adequado", color: "text-amber-600", icon: Minus };
    if (indiceBird >= 30) return { label: "Atenção", color: "text-orange-600", icon: TrendingUp };
    return { label: "Crítico", color: "text-destructive", icon: AlertTriangle };
  };

  const bird = getStatusBird();
  const BirdIcon = bird.icon;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Target className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-base">Indicadores Estratégicos SST</h3>
        <Badge variant="outline" className="text-xs">ISO 45001 / CLT</Badge>
      </div>

      {/* Linha 1 — Indicadores de frequência */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-destructive">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">
                LTIFR
                <InfoTooltip text="Lost Time Injury Frequency Rate: acidentes com afastamento por milhão de horas trabalhadas. Meta classe mundial: < 1,0" />
              </span>
              <Badge variant={ltifr < 1 ? "outline" : ltifr < 3 ? "secondary" : "destructive"} className="text-xs">
                {ltifr < 1 ? "✓ Meta" : ltifr < 3 ? "Atenção" : "Crítico"}
              </Badge>
            </div>
            <p className="text-3xl font-bold tabular-nums">{ltifr.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">por 1.000.000 h.h.</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">
                Taxa de Gravidade
                <InfoTooltip text="Severity Rate: dias perdidos por afastamento por milhão de horas trabalhadas" />
              </span>
            </div>
            <p className="text-3xl font-bold tabular-nums">{severityRate.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{totalDiasAfastamento} dias perdidos</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-400">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">
                Taxa de Incidência
                <InfoTooltip text="Número de acidentes por 100 trabalhadores no período" />
              </span>
            </div>
            <p className="text-3xl font-bold tabular-nums">{taxaIncidencia.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">por 100 trabalhadores</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">
                Near Miss / Acidente
                <InfoTooltip text="Relação incidentes/acidentes. Pirâmide de Bird: meta ≥ 300 near miss por acidente indica cultura de segurança madura" />
              </span>
              <BirdIcon className={`w-3.5 h-3.5 ${bird.color}`} />
            </div>
            <p className={`text-3xl font-bold tabular-nums ${bird.color}`}>{indiceBird.toFixed(0)}</p>
            <p className={`text-xs mt-0.5 ${bird.color}`}>{bird.label}</p>
          </CardContent>
        </Card>
      </div>

      {/* Linha 2 — Indicadores de qualidade */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">% com Causa Raiz Definida</span>
              <InfoTooltip text="Percentual de eventos que possuem descrição da causa percebida. Meta: > 80%" />
            </div>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-3xl font-bold tabular-nums">{pctCausaRaiz.toFixed(0)}%</span>
              <span className="text-xs text-muted-foreground mb-1">{comCausaRaiz.length} de {eventos.length}</span>
            </div>
            <Progress value={pctCausaRaiz} className="h-2" />
            <p className={`text-xs mt-1 ${pctCausaRaiz >= 80 ? "text-green-600" : pctCausaRaiz >= 50 ? "text-amber-600" : "text-destructive"}`}>
              {pctCausaRaiz >= 80 ? "✓ Meta atingida" : pctCausaRaiz >= 50 ? "⚠ Abaixo da meta (80%)" : "✗ Crítico — investigar"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium">Setores Reincidentes</span>
              <InfoTooltip text="Setores com 3 ou mais eventos registrados — requerem ação prioritária de intervenção" />
            </div>
            <p className="text-3xl font-bold tabular-nums">{setoresReincidentes}</p>
            <div className="mt-2 space-y-1">
              {Object.entries(setorFreq)
                .filter(([, v]) => v >= 3)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([setor, count]) => (
                  <div key={setor} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground truncate flex-1">{setor}</span>
                    <Badge variant="destructive" className="text-xs ml-2">{count}</Badge>
                  </div>
                ))}
              {setoresReincidentes === 0 && (
                <p className="text-xs text-green-600">✓ Nenhum setor reincidente</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Gravidade dos Acidentes</span>
            </div>
            <div className="space-y-1.5 mt-1">
              {[
                { label: "Sem lesão", key: "sem_lesao", color: "bg-green-500" },
                { label: "Leve", key: "leve", color: "bg-amber-400" },
                { label: "Moderada", key: "moderada", color: "bg-orange-500" },
                { label: "Grave", key: "grave", color: "bg-destructive" },
              ].map(({ label, key, color }) => {
                const count = acidentes.filter(e => e.gravidade_lesao === key).length;
                const pct = acidentes.length > 0 ? (count / acidentes.length) * 100 : 0;
                return (
                  <div key={key} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${color} shrink-0`} />
                    <span className="text-xs flex-1">{label}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
                    <div className="w-16">
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  </div>
                );
              })}
              {acidentes.filter(e => e.obito).length > 0 && (
                <div className="flex items-center gap-2 mt-1 p-1.5 rounded bg-destructive/10 border border-destructive/20">
                  <span className="text-xs text-destructive font-medium">⚠ Óbitos: {acidentes.filter(e => e.obito).length}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
