import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useJornadaImportacao } from "@/hooks/useJornadaAnalise";
import { toast } from "sonner";
import { Clock, AlertTriangle, TrendingUp, Users, Shield, Activity, RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";

const RISK_COLORS = { baixo: "#22c55e", moderado: "#f59e0b", alto: "#ef4444" };
const CONFORMIDADE_COLORS = { conforme: "#22c55e", atencao: "#f59e0b", nao_conforme: "#ef4444" };

export function JornadaDashboard() {
  const { tenantId } = useTenant();
  const { analisarJornada } = useJornadaImportacao();
  const [analises, setAnalises] = useState<any[]>([]);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analisando, setAnalisando] = useState(false);

  const periodoInicio = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const periodoFim = format(endOfMonth(new Date()), "yyyy-MM-dd");

  const fetchData = async () => {
    if (!tenantId) return;
    setLoading(true);

    const [{ data: analData }, { data: alertData }] = await Promise.all([
      supabase
        .from("jornada_analises")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("jornada_alertas")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("resolvido", false)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    setAnalises(analData || []);
    setAlertas(alertData || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [tenantId]);

  const executarAnalise = async () => {
    setAnalisando(true);
    try {
      const result = await analisarJornada(periodoInicio, periodoFim);
      toast.success(`Análise concluída: ${result.length} colaboradores avaliados`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAnalisando(false);
    }
  };

  // KPIs
  const totalColaboradores = new Set(analises.map(a => a.colaborador_cpf)).size;
  const mediaHorasDiarias = analises.length > 0
    ? (analises.reduce((s, a) => s + Number(a.media_diaria_horas || 0), 0) / analises.length).toFixed(1)
    : "0";
  const totalExtras = analises.reduce((s, a) => s + Number(a.total_horas_extras || 0), 0).toFixed(0);
  const alertasPendentes = alertas.length;
  const riscoAlto = analises.filter(a => a.nivel_risco === "alto").length;
  const naoConformes = analises.filter(a => a.status_conformidade === "nao_conforme").length;

  // Chart data
  const riskDistribution = [
    { name: "Baixo", value: analises.filter(a => a.nivel_risco === "baixo").length, fill: RISK_COLORS.baixo },
    { name: "Moderado", value: analises.filter(a => a.nivel_risco === "moderado").length, fill: RISK_COLORS.moderado },
    { name: "Alto", value: analises.filter(a => a.nivel_risco === "alto").length, fill: RISK_COLORS.alto },
  ].filter(d => d.value > 0);

  const topExtras = [...analises]
    .sort((a, b) => Number(b.total_horas_extras) - Number(a.total_horas_extras))
    .slice(0, 8)
    .map(a => ({
      nome: a.colaborador_nome?.split(" ").slice(0, 2).join(" ") || "—",
      extras: Number(a.total_horas_extras || 0),
    }));

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Período: {periodoInicio} a {periodoFim}
        </p>
        <Button onClick={executarAnalise} disabled={analisando} size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${analisando ? "animate-spin" : ""}`} />
          {analisando ? "Analisando..." : "Executar Análise"}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard icon={Users} label="Colaboradores" value={totalColaboradores} />
        <KPICard icon={Clock} label="Média h/dia" value={mediaHorasDiarias} />
        <KPICard icon={TrendingUp} label="Total HE" value={`${totalExtras}h`} />
        <KPICard icon={AlertTriangle} label="Alertas" value={alertasPendentes} variant={alertasPendentes > 0 ? "destructive" : "default"} />
        <KPICard icon={Activity} label="Risco Alto" value={riscoAlto} variant={riscoAlto > 0 ? "destructive" : "default"} />
        <KPICard icon={Shield} label="Não Conforme" value={naoConformes} variant={naoConformes > 0 ? "destructive" : "default"} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Distribuição de Risco</CardTitle></CardHeader>
          <CardContent>
            {riskDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={riskDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                    {riskDistribution.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                Sem dados. Execute a análise primeiro.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Top Horas Extras por Colaborador</CardTitle></CardHeader>
          <CardContent>
            {topExtras.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={topExtras} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="nome" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="extras" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                Sem dados disponíveis.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent alerts */}
      {alertas.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Alertas Recentes</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alertas.slice(0, 5).map(a => (
                <div key={a.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className={`h-4 w-4 ${a.severidade === "critica" ? "text-destructive" : a.severidade === "alta" ? "text-orange-500" : "text-yellow-500"}`} />
                    <div>
                      <p className="text-sm font-medium">{a.titulo}</p>
                      <p className="text-xs text-muted-foreground">{a.descricao}</p>
                    </div>
                  </div>
                  <Badge variant={a.severidade === "critica" ? "destructive" : "outline"} className="text-[10px]">
                    {a.severidade}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KPICard({ icon: Icon, label, value, variant = "default" }: { icon: any; label: string; value: any; variant?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className={`h-4 w-4 ${variant === "destructive" ? "text-destructive" : "text-muted-foreground"}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className={`text-2xl font-bold ${variant === "destructive" ? "text-destructive" : "text-foreground"}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
