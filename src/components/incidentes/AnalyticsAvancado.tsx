import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import { TrendingDown, AlertTriangle, BarChart3, MapPin, Activity } from "lucide-react";
import type { EventoSST } from "@/types/eventoSST";

interface Props {
  eventos: EventoSST[];
}

const COLORS = ["hsl(var(--destructive))", "hsl(var(--warning, 38 92% 50%))", "hsl(var(--primary))", "hsl(var(--muted-foreground))", "hsl(215 20% 65%)"];

export const AnalyticsAvancado = ({ eventos }: Props) => {
  // Pareto de causas
  const catCounts: Record<string, number> = {};
  eventos.forEach(e => {
    if (e.categoria_principal) {
      catCounts[e.categoria_principal] = (catCounts[e.categoria_principal] || 0) + 1;
    }
  });
  const paretoData = Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([cat, count], i) => ({ cat: cat.length > 22 ? cat.slice(0, 20) + "…" : cat, count, fullCat: cat }));

  const totalCat = paretoData.reduce((s, d) => s + d.count, 0);
  let acumulado = 0;
  const paretoComAcum = paretoData.map(d => {
    acumulado += d.count;
    return { ...d, pct: totalCat > 0 ? Math.round((acumulado / totalCat) * 100) : 0 };
  });

  // Heatmap: setor × turno
  const setores = [...new Set(eventos.map(e => e.setor || "Não inf."))].slice(0, 6);
  const turnos = ["1º Turno", "2º Turno", "3º Turno", "Outro"];
  const heatmapData: Record<string, Record<string, number>> = {};
  setores.forEach(s => { heatmapData[s] = {}; turnos.forEach(t => { heatmapData[s][t] = 0; }); });
  eventos.forEach(e => {
    const s = e.setor || "Não inf.";
    const t = e.turno || "Outro";
    if (heatmapData[s] && heatmapData[s][t] !== undefined) {
      heatmapData[s][t]++;
    }
  });
  const maxHeat = Math.max(...Object.values(heatmapData).flatMap(r => Object.values(r)), 1);

  const getHeatColor = (val: number) => {
    const intensity = val / maxHeat;
    if (intensity === 0) return "bg-muted/30 text-muted-foreground/40";
    if (intensity < 0.25) return "bg-green-100 text-green-700";
    if (intensity < 0.5) return "bg-amber-100 text-amber-700";
    if (intensity < 0.75) return "bg-orange-200 text-orange-800";
    return "bg-red-200 text-red-800 font-bold";
  };

  // Análise de subnotificação automática
  const subnotifAlerts: { setor: string; acidentes: number; incidentes: number; ratio: number }[] = [];
  const setorCounts: Record<string, { ac: number; inc: number }> = {};
  eventos.forEach(e => {
    const k = e.setor || "Não informado";
    if (!setorCounts[k]) setorCounts[k] = { ac: 0, inc: 0 };
    if (e.tipo === "acidente") setorCounts[k].ac++;
    else setorCounts[k].inc++;
  });
  Object.entries(setorCounts).forEach(([setor, { ac, inc }]) => {
    if (ac > 0) {
      const ratio = inc / (ac || 1);
      if (ratio < 3) {
        subnotifAlerts.push({ setor, acidentes: ac, incidentes: inc, ratio });
      }
    }
  });

  // Distribuição por turno
  const turnoCounts: Record<string, { incidentes: number; acidentes: number }> = {};
  eventos.forEach(e => {
    const t = e.turno || "Não informado";
    if (!turnoCounts[t]) turnoCounts[t] = { incidentes: 0, acidentes: 0 };
    if (e.tipo === "incidente") turnoCounts[t].incidentes++;
    else turnoCounts[t].acidentes++;
  });
  const turnoChartData = Object.entries(turnoCounts).map(([turno, data]) => ({ turno, ...data }));

  // Benchmarking interno por mês
  const mesesMap: Record<string, { incidentes: number; acidentes: number }> = {};
  eventos.forEach(e => {
    const mes = e.data_evento?.slice(0, 7) || "?";
    if (!mesesMap[mes]) mesesMap[mes] = { incidentes: 0, acidentes: 0 };
    if (e.tipo === "incidente") mesesMap[mes].incidentes++;
    else mesesMap[mes].acidentes++;
  });
  const tendenciaData = Object.entries(mesesMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([mes, d]) => ({ mes: mes.slice(5), ...d, total: d.incidentes + d.acidentes }));

  // Correlação origem × gravidade
  const origemGrav: Record<string, { baixa: number; media: number; alta: number; critica: number }> = {};
  eventos.forEach(e => {
    const o = e.origem_predominante?.slice(0, 20) || "Não inf.";
    if (!origemGrav[o]) origemGrav[o] = { baixa: 0, media: 0, alta: 0, critica: 0 };
    const g = (e.gravidade_potencial as string) || "baixa";
    if (g in origemGrav[o]) origemGrav[o][g as keyof typeof origemGrav[typeof o]]++;
  });
  const origemChartData = Object.entries(origemGrav).map(([origem, vals]) => ({ origem, ...vals }));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-base">Analytics Avançado</h3>
      </div>

      {/* Subnotificação */}
      {subnotifAlerts.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-4 h-4" />
              ⚠️ Alerta de Subnotificação Provável
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            {subnotifAlerts.map(({ setor, acidentes, incidentes, ratio }) => (
              <div key={setor} className="text-sm flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <div>
                  <span className="font-medium">{setor}:</span>{" "}
                  <span>{acidentes} acidente{acidentes > 1 ? "s" : ""} e apenas {incidentes} incidente{incidentes !== 1 ? "s" : ""}.</span>
                  <span className="text-amber-700 ml-1">
                    Razão {ratio.toFixed(1)}:1 — esperado ≥ 30:1 (Pirâmide de Bird). Possível subnotificação de near miss.
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Pareto de causas */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingDown className="w-4 h-4" /> Pareto de Causas Principais
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          {paretoData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados suficientes</p>
          ) : (
            <div className="space-y-2">
              {paretoComAcum.map((d, i) => (
                <div key={d.cat} className="flex items-center gap-3">
                  <span className="text-xs w-4 text-muted-foreground tabular-nums">{i + 1}</span>
                  <span className="text-xs flex-1 truncate" title={d.fullCat}>{d.cat}</span>
                  <Progress value={(d.count / (paretoComAcum[0]?.count || 1)) * 100} className="h-2 w-20" />
                  <span className="text-xs tabular-nums w-5 text-right">{d.count}</span>
                  <Badge variant="outline" className="text-xs w-14 justify-center">
                    {d.pct}% acum.
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tendência mensal */}
      {tendenciaData.length > 1 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4" /> Tendência Mensal (Benchmarking Interno)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={tendenciaData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <RechartTooltip
                  contentStyle={{ fontSize: 12 }}
                  formatter={(val, name) => [val, name === "incidentes" ? "Incidentes" : "Acidentes"]}
                />
                <Bar dataKey="incidentes" fill="hsl(var(--primary))" name="incidentes" radius={[2, 2, 0, 0]} />
                <Bar dataKey="acidentes" fill="hsl(var(--destructive))" name="acidentes" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Heatmap setor × turno */}
      {setores.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Heatmap de Risco — Setor × Turno
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-1 pr-3 font-medium text-muted-foreground">Setor</th>
                  {turnos.map(t => (
                    <th key={t} className="text-center px-2 py-1 font-medium text-muted-foreground whitespace-nowrap">{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {setores.map(setor => (
                  <tr key={setor}>
                    <td className="py-1 pr-3 font-medium text-sm max-w-[120px] truncate" title={setor}>{setor}</td>
                    {turnos.map(turno => {
                      const val = heatmapData[setor]?.[turno] || 0;
                      return (
                        <td key={turno} className="text-center px-1 py-0.5">
                          <div className={`rounded px-2 py-1 text-xs tabular-nums ${getHeatColor(val)}`}>
                            {val > 0 ? val : "—"}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-muted-foreground mt-2">🟥 Alto risco &nbsp;🟧 Médio &nbsp;🟨 Baixo &nbsp;⬜ Sem ocorrência</p>
          </CardContent>
        </Card>
      )}

      {/* Correlação origem × turno */}
      {turnoChartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm">Distribuição por Turno</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={turnoChartData} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="turno" tick={{ fontSize: 10 }} width={72} />
                <RechartTooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="incidentes" fill="hsl(var(--primary))" name="Incidentes" radius={[0, 2, 2, 0]} />
                <Bar dataKey="acidentes" fill="hsl(var(--destructive))" name="Acidentes" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
