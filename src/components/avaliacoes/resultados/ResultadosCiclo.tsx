import { useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Users,
  Download,
  FileText,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from "recharts";
import { toast } from "sonner";
import { useResultadosAvaliacao } from "@/hooks/useResultadosAvaliacao";
import { Skeleton } from "@/components/ui/skeleton";

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2">
      <BarChart3 className="h-8 w-8 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function ResultadosCiclo() {
  const [selectedCicloId, setSelectedCicloId] = useState<string | undefined>();

  const {
    ciclos,
    cicloId,
    resumo,
    distribuicao,
    topColaboradores,
    dimensoes,
    isLoading,
    hasDados,
  } = useResultadosAvaliacao(selectedCicloId);

  const cicloAtual = ciclos.find(c => c.id === cicloId);

  return (
    <div className="space-y-4">
      {/* Cycle selector */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={cicloId || ""}
          onValueChange={v => setSelectedCicloId(v)}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder={isLoading ? "Carregando…" : "Selecionar ciclo"} />
          </SelectTrigger>
          <SelectContent>
            {ciclos.map(c => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => toast.info("Exportando PDF…")}
          >
            <Download className="h-3.5 w-3.5" />
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => toast.info("Exportando Excel…")}
          >
            <Download className="h-3.5 w-3.5" />
            Excel
          </Button>
        </div>
      </div>

      {/* No cycles */}
      {!isLoading && ciclos.length === 0 && (
        <Card>
          <CardContent className="py-10">
            <EmptyState message="Nenhum ciclo de avaliação encontrado. Crie um ciclo na aba Ciclos." />
          </CardContent>
        </Card>
      )}

      {/* Has cycles but no concluded evaluations */}
      {!isLoading && ciclos.length > 0 && !hasDados && (
        <Card>
          <CardContent className="py-10">
            <EmptyState message={`O ciclo "${cicloAtual?.nome || ""}" ainda não possui avaliações concluídas.`} />
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary stats */}
      {!isLoading && hasDados && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            {[
              {
                label: "Média Geral",
                value: resumo.mediaGeral.toFixed(1),
                sub: "nota final do ciclo",
                icon: TrendingUp,
                color: "text-emerald-600 bg-emerald-50",
              },
              {
                label: "Concluídas",
                value: `${resumo.totalConcluidas}/${resumo.totalRespostas}`,
                sub: `${resumo.taxaParticipacao}% participação`,
                icon: Users,
                color: "text-blue-600 bg-blue-50",
              },
              {
                label: "Notas Extremas",
                value: String(
                  distribuicao[0].quantidade + distribuicao[distribuicao.length - 1].quantidade
                ),
                sub: `${distribuicao[0].quantidade} baixas • ${distribuicao[distribuicao.length - 1].quantidade} altas`,
                icon: BarChart3,
                color: "text-amber-600 bg-amber-50",
              },
              {
                label: "PDIs Vinculados",
                value: String(resumo.pdisGerados),
                sub: "planos de desenvolvimento",
                icon: FileText,
                color: "text-purple-600 bg-purple-50",
              },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg ${s.color}`}>
                    <s.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.sub}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Distribution */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Distribuição de Notas</CardTitle>
              </CardHeader>
              <CardContent>
                {distribuicao.every(d => d.quantidade === 0) ? (
                  <EmptyState message="Sem dados de distribuição." />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={distribuicao}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="nota" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <RechartsTooltip />
                      <Bar dataKey="quantidade" radius={[4, 4, 0, 0]}>
                        {distribuicao.map((entry, idx) => (
                          <Cell key={idx} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Radar by dimension */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Média por Critério</CardTitle>
                <CardDescription className="text-xs">
                  Baseado em notas por critério das avaliações concluídas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dimensoes.length === 0 ? (
                  <EmptyState message="Sem dados de critérios disponíveis." />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={dimensoes} cx="50%" cy="50%">
                      <PolarGrid />
                      <PolarAngleAxis dataKey="dimensao" tick={{ fontSize: 11 }} />
                      <Radar
                        dataKey="media"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary))"
                        fillOpacity={0.3}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top performers */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Top Colaboradores</CardTitle>
              <CardDescription className="text-xs">
                Maiores notas no ciclo — {cicloAtual?.nome}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topColaboradores.length === 0 ? (
                <EmptyState message="Sem avaliações concluídas ainda." />
              ) : (
                <div className="space-y-3">
                  {topColaboradores.map((c, i) => (
                    <div key={c.nome + i} className="flex items-center gap-3">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          i === 0
                            ? "bg-amber-100 text-amber-700"
                            : i === 1
                            ? "bg-slate-100 text-slate-700"
                            : i === 2
                            ? "bg-orange-100 text-orange-700"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.nome}</p>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <div className="w-32">
                          <Progress value={(c.nota / 5) * 100} className="h-1.5" />
                        </div>
                        <p className="text-sm font-bold w-8">{c.nota.toFixed(1)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Export section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Relatórios Exportáveis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "PDF Individual", desc: "Relatório para conversa 1:1", icon: FileText },
                  { label: "Relatório do Time", desc: "Visão consolidada por gestor", icon: Users },
                  { label: "CSV/Excel Completo", desc: "Dados brutos para análise", icon: Download },
                  { label: "Relatório Diretoria", desc: "Dashboard consolidado", icon: BarChart3 },
                ].map(r => (
                  <Button
                    key={r.label}
                    variant="outline"
                    className="h-auto flex-col items-start p-4 gap-1"
                    onClick={() => toast.info(`Gerando ${r.label}…`)}
                  >
                    <r.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{r.label}</span>
                    <span className="text-[10px] text-muted-foreground">{r.desc}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
