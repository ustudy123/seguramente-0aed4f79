import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CompetenciaInput } from "@/components/ui/competencia-input";
import { usePonto } from "@/hooks/usePonto";
import { usePontoFechamento } from "@/hooks/usePontoFechamento";
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, Legend } from "recharts";
import { TrendingUp, Users, AlertTriangle, Clock, FileText, Shield, Wallet } from "lucide-react";

const COLORS = ["hsl(var(--primary))", "#f59e0b", "#ef4444", "#22c55e", "#8b5cf6", "#06b6d4"];

export function PontoDashboardTab() {
  const [competencia, setCompetencia] = useState(format(new Date(), "yyyy-MM"));
  const { usePontoDiario } = usePonto();
  const { useFechamentos } = usePontoFechamento();

  // Get all days of the month to aggregate
  const startDate = startOfMonth(new Date(competencia + "-01"));
  const endDate = endOfMonth(startDate);
  const today = new Date();

  // Use today's data for quick stats
  const { data: pontosHoje = [] } = usePontoDiario(today);
  const { data: fechamentos = [] } = useFechamentos();

  const stats = {
    presentes: pontosHoje.filter(p => p.entrada).length,
    ausentes: pontosHoje.filter(p => p.status === "falta").length,
    atrasos: pontosHoje.filter(p => p.status === "atraso").length,
    incompletos: pontosHoje.filter(p => p.status === "incompleto").length,
    total: pontosHoje.length,
  };

  // Status distribution for pie chart
  const statusData = [
    { name: "Regular", value: pontosHoje.filter(p => p.status === "regular").length },
    { name: "Atraso", value: pontosHoje.filter(p => p.status === "atraso").length },
    { name: "Falta", value: pontosHoje.filter(p => p.status === "falta").length },
    { name: "Incompleto", value: pontosHoje.filter(p => p.status === "incompleto").length },
    { name: "Justificado", value: pontosHoje.filter(p => p.status === "justificado").length },
  ].filter(d => d.value > 0);

  // Risk indicators
  const riskItems = [
    {
      label: "Excesso de Jornada",
      desc: "Colaboradores com > 10h trabalhadas hoje",
      count: pontosHoje.filter(p => {
        if (!p.horas_trabalhadas) return false;
        const parts = p.horas_trabalhadas.split(":");
        return parts.length >= 1 && parseInt(parts[0]) >= 10;
      }).length,
      severity: "alta",
    },
    {
      label: "Faltas sem justificativa",
      desc: "Colaboradores ausentes sem registro",
      count: stats.ausentes,
      severity: stats.ausentes > 3 ? "alta" : "media",
    },
    {
      label: "Marcações incompletas",
      desc: "Registros com batidas faltando",
      count: stats.incompletos,
      severity: stats.incompletos > 5 ? "alta" : "baixa",
    },
    {
      label: "Atrasos",
      desc: "Colaboradores que chegaram atrasados",
      count: stats.atrasos,
      severity: stats.atrasos > 5 ? "media" : "baixa",
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary" /> Dashboard de Risco Trabalhista
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Visão geral da jornada — {format(today, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <CompetenciaInput value={competencia} onChange={setCompetencia} className="w-[140px] sm:w-[180px]" />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-primary mx-auto mb-1" />
            <p className="text-xl sm:text-2xl font-bold">{stats.total}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Total Registros</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-green-500 mx-auto mb-1" />
            <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.presentes}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Presentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500 mx-auto mb-1" />
            <p className="text-xl sm:text-2xl font-bold text-yellow-600">{stats.atrasos}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Atrasos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-red-500 mx-auto mb-1" />
            <p className="text-xl sm:text-2xl font-bold text-red-600">{stats.ausentes}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Faltas</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="p-3 sm:p-4 text-center">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500 mx-auto mb-1" />
            <p className="text-xl sm:text-2xl font-bold text-orange-600">{stats.incompletos}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Incompletos</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status Pie */}
        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição de Status — Hoje</CardTitle></CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">Sem dados para exibir</p>
            )}
          </CardContent>
        </Card>

        {/* Risk Indicators */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-warning" /> Indicadores de Risco</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {riskItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium text-sm">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <div className="text-right">
                  <p className={`text-xl font-bold ${item.count > 0 ? (item.severity === "alta" ? "text-red-600" : item.severity === "media" ? "text-yellow-600" : "text-muted-foreground") : "text-green-600"}`}>
                    {item.count}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Fechamentos recentes */}
      <Card>
        <CardHeader><CardTitle className="text-base">Fechamentos Recentes</CardTitle></CardHeader>
        <CardContent>
          {fechamentos.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Nenhum fechamento registrado.</p>
          ) : (
            <div className="space-y-2">
              {fechamentos.slice(0, 6).map(f => (
                <div key={f.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <span className="font-medium">{f.competencia}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      {f.total_colaboradores} colaboradores • {f.total_faltas} faltas
                    </span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${f.status === "fechado" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
                    {f.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
