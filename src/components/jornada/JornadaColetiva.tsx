import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Users, TrendingUp, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function JornadaColetiva() {
  const { tenantId } = useTenant();
  const [analises, setAnalises] = useState<any[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from("jornada_analises")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => setAnalises(data || []));
  }, [tenantId]);

  // Group by department
  const porDepartamento = new Map<string, any[]>();
  analises.forEach(a => {
    const dept = a.departamento || "Sem departamento";
    if (!porDepartamento.has(dept)) porDepartamento.set(dept, []);
    porDepartamento.get(dept)!.push(a);
  });

  const deptStats = Array.from(porDepartamento.entries()).map(([dept, items]) => ({
    departamento: dept,
    colaboradores: items.length,
    mediaHoras: (items.reduce((s, i) => s + Number(i.media_diaria_horas || 0), 0) / items.length).toFixed(1),
    totalExtras: items.reduce((s, i) => s + Number(i.total_horas_extras || 0), 0).toFixed(0),
    riscoAlto: items.filter(i => i.nivel_risco === "alto").length,
    naoConforme: items.filter(i => i.status_conformidade === "nao_conforme").length,
  })).sort((a, b) => Number(b.totalExtras) - Number(a.totalExtras));

  const chartData = deptStats.map(d => ({
    nome: d.departamento.length > 15 ? d.departamento.slice(0, 15) + "..." : d.departamento,
    horas: Number(d.mediaHoras),
    extras: Number(d.totalExtras),
  }));

  // Insights
  const insights: string[] = [];
  deptStats.forEach(d => {
    if (Number(d.mediaHoras) > 9) {
      insights.push(`${d.departamento}: média de ${d.mediaHoras}h/dia indica possível subdimensionamento`);
    }
    if (d.riscoAlto > d.colaboradores * 0.5) {
      insights.push(`${d.departamento}: ${d.riscoAlto} de ${d.colaboradores} colaboradores em risco alto`);
    }
  });

  return (
    <div className="space-y-6">
      {analises.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Nenhuma análise coletiva disponível. Execute a análise no Dashboard primeiro.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Insights */}
          {insights.length > 0 && (
            <Card className="border-orange-200 bg-orange-50/50">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" /> Insights Automáticos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {insights.map((ins, i) => (
                    <li key={i} className="text-sm text-orange-800 flex items-start gap-2">
                      <span className="text-orange-500 mt-0.5">•</span> {ins}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Chart */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Comparativo por Departamento</CardTitle></CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="nome" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="horas" name="Média h/dia" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="extras" name="Total HE" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
              )}
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Visão por Departamento</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-3 text-left">Departamento</th>
                      <th className="p-3 text-center">Colaboradores</th>
                      <th className="p-3 text-center">Média h/dia</th>
                      <th className="p-3 text-center">Total HE</th>
                      <th className="p-3 text-center">Risco Alto</th>
                      <th className="p-3 text-center">Não Conforme</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deptStats.map((d, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-3 font-medium">{d.departamento}</td>
                        <td className="p-3 text-center">{d.colaboradores}</td>
                        <td className="p-3 text-center">{d.mediaHoras}h</td>
                        <td className="p-3 text-center">{d.totalExtras}h</td>
                        <td className="p-3 text-center">
                          {d.riscoAlto > 0 ? (
                            <Badge variant="destructive" className="text-[10px]">{d.riscoAlto}</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">0</Badge>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {d.naoConforme > 0 ? (
                            <Badge variant="destructive" className="text-[10px]">{d.naoConforme}</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">0</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
