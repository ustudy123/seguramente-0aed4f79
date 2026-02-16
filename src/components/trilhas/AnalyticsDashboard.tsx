import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3, Users, Trophy, Award, BookOpen, TrendingUp,
  AlertTriangle, Lightbulb, Zap, Target, GraduationCap, Clock
} from "lucide-react";
import { useAnalyticsTrilhas, type GatilhoIA } from "@/hooks/useAnalyticsTrilhas";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend
} from "recharts";

export function AnalyticsDashboard() {
  const { data, isLoading } = useAnalyticsTrilhas();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!data) return null;

  const stats = [
    { label: "Trilhas Ativas", value: data.trilhasAtivas, icon: BookOpen, color: "text-primary" },
    { label: "Módulos", value: data.totalModulos, icon: Target, color: "text-primary" },
    { label: "Participantes", value: data.totalInscritos, icon: Users, color: "text-info" },
    { label: "Certificados", value: data.totalCertificados, icon: GraduationCap, color: "text-success" },
    { label: "Medalhas", value: data.totalMedalhas, icon: Award, color: "text-warning" },
    { label: "Pontos Distribuídos", value: data.totalPontosDistribuidos, icon: Trophy, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 text-center">
              <s.icon className={`w-5 h-5 mx-auto mb-1.5 ${s.color}`} strokeWidth={1.75} />
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gatilhos IA */}
      {data.gatilhosIA.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-warning" strokeWidth={1.75} />
              Insights e Gatilhos Inteligentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.gatilhosIA.map((g) => (
              <GatilhoCard key={g.id} gatilho={g} />
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Tendência mensal */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" strokeWidth={1.75} />
              Tendência Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.tendenciaMensal.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.tendenciaMensal}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="conclusoes" stroke="hsl(var(--success))" name="Conclusões" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="novos_inscritos" stroke="hsl(var(--primary))" name="Novos Inscritos" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-muted-foreground py-8 text-center">Sem dados suficientes</p>
            )}
          </CardContent>
        </Card>

        {/* Engajamento por trilha */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" strokeWidth={1.75} />
              Engajamento por Trilha
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.engajamentoPorTrilha.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.engajamentoPorTrilha.slice(0, 6)}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="trilha_nome" tick={{ fontSize: 10 }} className="text-muted-foreground" angle={-20} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <Tooltip />
                  <Bar dataKey="total_inscritos" fill="hsl(var(--primary))" name="Inscritos" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="total_concluidos" fill="hsl(var(--success))" name="Concluíram" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-muted-foreground py-8 text-center">Nenhuma trilha com participantes</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Top módulos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" strokeWidth={1.75} />
              Módulos Mais Concluídos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.modulosMaisConcluidos.length > 0 ? (
              <div className="space-y-2">
                {data.modulosMaisConcluidos.slice(0, 5).map((m, i) => (
                  <div key={m.modulo_id} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{m.titulo}</p>
                      <p className="text-[10px] text-muted-foreground">{m.tipo} • {m.conclusoes} conclusões{m.nota_media != null ? ` • Nota média: ${m.nota_media}` : ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">Nenhum módulo concluído ainda</p>
            )}
          </CardContent>
        </Card>

        {/* Top colaboradores */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" strokeWidth={1.75} />
              Colaboradores Mais Engajados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.progressoPorColaborador.length > 0 ? (
              <div className="space-y-2">
                {data.progressoPorColaborador.slice(0, 5).map((c, i) => (
                  <div key={c.colaborador_id} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{c.colaborador_nome}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {c.pontos_total} pts • {c.trilhas_concluidas}/{c.trilhas_iniciadas} trilhas
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{c.pontos_total} pts</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">Nenhum participante ainda</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela de taxa de conclusão por trilha */}
      {data.engajamentoPorTrilha.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Taxa de Conclusão por Trilha</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.engajamentoPorTrilha.map((t) => (
                <div key={t.trilha_id} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium truncate max-w-[60%]">{t.trilha_nome}</span>
                    <span className="text-muted-foreground">{t.taxa_conclusao}% • {t.total_concluidos}/{t.total_inscritos}</span>
                  </div>
                  <Progress value={t.taxa_conclusao} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function GatilhoCard({ gatilho }: { gatilho: GatilhoIA }) {
  const severityConfig = {
    critical: { bg: "bg-destructive/10 border-destructive/30", icon: AlertTriangle, iconColor: "text-destructive" },
    warning: { bg: "bg-warning/10 border-warning/30", icon: AlertTriangle, iconColor: "text-warning" },
    info: { bg: "bg-info/10 border-info/30", icon: Lightbulb, iconColor: "text-info" },
  };

  const config = severityConfig[gatilho.severidade];
  const Icon = config.icon;

  return (
    <div className={`flex gap-3 p-3 rounded-lg border ${config.bg}`}>
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.iconColor}`} strokeWidth={1.75} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-semibold">{gatilho.titulo}</span>
          <Badge variant="outline" className="text-[10px]">
            {gatilho.colaboradores_afetados} colaborador(es)
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{gatilho.descricao}</p>
        {gatilho.trilha_sugerida && (
          <p className="text-[10px] text-primary mt-1 font-medium">
            💡 Trilha sugerida: {gatilho.trilha_sugerida}
          </p>
        )}
      </div>
    </div>
  );
}
