import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, Clock, TrendingUp, ShieldAlert, FileSearch, Wrench, BarChart3 } from "lucide-react";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

export function PDCADashboard() {
  const { tenantId } = useAuth();
  const tid = tenantId;

  // Fetch plano_acoes
  const { data: acoes = [] } = useQuery({
    queryKey: ["pdca-acoes", tid],
    queryFn: async () => {
      if (!tid) return [];
      const { data } = await supabase
        .from("plano_acoes")
        .select("id, status, tipo, origem_modulo, prioridade, created_at, prazo, titulo")
        .eq("tenant_id", tid);
      return data || [];
    },
    enabled: !!tid,
  });

  // Fetch eventos_sst (riscos / incidentes)
  const { data: eventos = [] } = useQuery({
    queryKey: ["pdca-eventos-sst", tid],
    queryFn: async () => {
      if (!tid) return [];
      const { data } = await supabase
        .from("eventos_sst")
        .select("id, tipo, status, gravidade_lesao, data_evento, categoria_principal")
        .eq("tenant_id", tid);
      return data || [];
    },
    enabled: !!tid,
  });

  // Fetch auditorias (plano_acoes from 'ergonomia' or 'ouvidoria' as proxy)
  const { data: documentosVencidos = [] } = useQuery({
    queryKey: ["pdca-docs-vencidos", tid],
    queryFn: async () => {
      if (!tid) return [];
      const { data } = await supabase
        .from("documentos")
        .select("id, status, nome_original, data_validade")
        .eq("tenant_id", tid)
        .in("status", ["vencido", "vencendo"]);
      return data || [];
    },
    enabled: !!tid,
  });

  // PDCA cycle stats
  const today = new Date();
  const planejar = acoes.filter(a => a.status === "pendente").length;
  const executar = acoes.filter(a => a.status === "em_andamento").length;
  const checar = documentosVencidos.length + eventos.filter(e => e.status === "em_analise").length;
  const agir = acoes.filter(a => a.status === "concluida").length;

  const pdcaCiclo = [
    { fase: "P — Planejar", valor: planejar, color: "hsl(var(--primary))", desc: "Ações pendentes de início", icon: Clock },
    { fase: "D — Executar", valor: executar, color: "hsl(var(--chart-2))", desc: "Ações em andamento", icon: Wrench },
    { fase: "C — Checar", valor: checar, color: "hsl(var(--chart-3))", desc: "Docs vencidos + eventos em análise", icon: FileSearch },
    { fase: "A — Agir", valor: agir, color: "hsl(var(--chart-4))", desc: "Ações concluídas", icon: CheckCircle2 },
  ];

  // Radar PDCA por dimensão
  const radarData = [
    {
      dimensao: "Riscos",
      score: Math.min(100, Math.max(0, 100 - eventos.filter(e => e.status === "em_aberto").length * 10)),
    },
    {
      dimensao: "Ações",
      score: acoes.length ? Math.round((acoes.filter(a => a.status === "concluida").length / acoes.length) * 100) : 0,
    },
    {
      dimensao: "Documentos",
      score: Math.min(100, Math.max(0, 100 - documentosVencidos.filter(d => d.status === "vencido").length * 5)),
    },
    {
      dimensao: "Incidentes",
      score: Math.min(100, Math.max(0, 100 - eventos.filter(e => e.tipo === "acidente").length * 15)),
    },
    {
      dimensao: "Auditorias",
      score: acoes.filter(a => a.origem_modulo === "ergonomia").length > 0 ? 70 : 40,
    },
  ];

  // Ações por origem
  const origemMap: Record<string, string> = {
    manual: "Manual",
    ergonomia: "Ergonomia",
    ouvidoria: "Ouvidoria",
    epi: "EPI",
    ponto: "Ponto",
    humor: "Clima",
    sst: "SST",
  };
  const acoesPorOrigem = Object.entries(
    acoes.reduce((acc: Record<string, number>, a: any) => {
      const k = origemMap[a.origem_modulo] || a.origem_modulo;
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  // Evolução últimos 6 meses
  const meses = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(today, 5 - i);
    return format(d, "MMM", { locale: ptBR });
  });
  const evolucao = meses.map((mes, i) => {
    const d = subMonths(today, 5 - i);
    const mesNum = d.getMonth();
    const anoNum = d.getFullYear();
    return {
      mes,
      abertas: acoes.filter((a: any) => {
        const dt = new Date(a.created_at);
        return dt.getMonth() === mesNum && dt.getFullYear() === anoNum;
      }).length,
      concluidas: acoes.filter((a: any) => {
        if (a.status !== "concluida" || !a.prazo) return false;
        const dt = new Date(a.prazo);
        return dt.getMonth() === mesNum && dt.getFullYear() === anoNum;
      }).length,
    };
  });

  const maturidade = Math.round(radarData.reduce((s, d) => s + d.score, 0) / radarData.length);
  const getMaturidadeLabel = (score: number) => {
    if (score >= 80) return { label: "Avançado", color: "text-success" };
    if (score >= 60) return { label: "Maduro", color: "text-primary" };
    if (score >= 40) return { label: "Em Desenvolvimento", color: "text-warning" };
    return { label: "Inicial", color: "text-destructive" };
  };
  const mat = getMaturidadeLabel(maturidade);

  return (
    <div className="space-y-6">
      {/* PDCA Cycle Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {pdcaCiclo.map((fase) => {
          const Icon = fase.icon;
          return (
            <Card key={fase.fase} className="border-border">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-2xl font-bold text-foreground">{fase.valor}</span>
                </div>
                <p className="text-sm font-medium text-foreground">{fase.fase}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{fase.desc}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar PDCA */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Radar de Maturidade PDCA
            </CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-bold text-foreground">{maturidade}%</span>
              <span className={`text-sm font-medium ${mat.color}`}>{mat.label}</span>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="dimensao" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Radar
                  name="Score"
                  dataKey="score"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.2}
                />
              </RadarChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-2">
              {radarData.map((d) => (
                <div key={d.dimensao} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-24">{d.dimensao}</span>
                  <Progress value={d.score} className="h-1.5 flex-1" />
                  <span className="text-xs font-medium w-8 text-right text-foreground">{d.score}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Evolução mensal */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Evolução de Ações — últimos 6 meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={evolucao} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="abertas" name="Abertas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="concluidas" name="Concluídas" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ações por origem */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ações por Origem</CardTitle>
          </CardHeader>
          <CardContent>
            {acoesPorOrigem.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">Nenhuma ação registrada</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={acoesPorOrigem}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={true}
                    labelStyle={{ fontSize: 11, fontFamily: "Inter, sans-serif", fill: "hsl(var(--foreground))", textTransform: "capitalize" }}
                  >
                    {acoesPorOrigem.map((_, idx) => (
                      <Cell
                        key={idx}
                        fill={[
                          "hsl(var(--primary))",
                          "hsl(var(--chart-2))",
                          "hsl(var(--chart-3))",
                          "hsl(var(--chart-4))",
                          "hsl(var(--chart-5))",
                        ][idx % 5]}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Alertas PDCA */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-destructive" />
              Alertas de Melhoria Contínua
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {documentosVencidos.filter(d => d.status === "vencido").length > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {documentosVencidos.filter(d => d.status === "vencido").length} documentos vencidos
                  </p>
                  <p className="text-xs text-muted-foreground">Requerem renovação imediata</p>
                </div>
                <Badge variant="destructive" className="ml-auto shrink-0">
                  {documentosVencidos.filter(d => d.status === "vencido").length}
                </Badge>
              </div>
            )}
            {acoes.filter((a: any) => a.status === "pendente" && a.prazo && new Date(a.prazo) < today).length > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
                <Clock className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {acoes.filter((a: any) => a.status === "pendente" && a.prazo && new Date(a.prazo) < today).length} ações atrasadas
                  </p>
                  <p className="text-xs text-muted-foreground">Prazo vencido sem conclusão</p>
                </div>
              </div>
            )}
            {eventos.filter((e: any) => e.status === "em_aberto" && e.tipo === "acidente").length > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {eventos.filter((e: any) => e.status === "em_aberto" && e.tipo === "acidente").length} acidentes sem investigação
                  </p>
                  <p className="text-xs text-muted-foreground">Requerem análise de causa raiz</p>
                </div>
              </div>
            )}
            {acoes.filter((a: any) => a.status === "concluida").length === 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                <TrendingUp className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Sem ações concluídas</p>
                  <p className="text-xs text-muted-foreground">Conclua ações para avançar o ciclo PDCA</p>
                </div>
              </div>
            )}
            {documentosVencidos.filter(d => d.status === "vencendo").length > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
                <Clock className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {documentosVencidos.filter(d => d.status === "vencendo").length} documentos a vencer
                  </p>
                  <p className="text-xs text-muted-foreground">Atenção nos próximos 30 dias</p>
                </div>
              </div>
            )}
            {acoes.length === 0 && eventos.length === 0 && documentosVencidos.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="w-10 h-10 text-success mb-3" />
                <p className="text-sm font-medium text-foreground">Tudo em ordem!</p>
                <p className="text-xs text-muted-foreground">Nenhum alerta de melhoria contínua</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
