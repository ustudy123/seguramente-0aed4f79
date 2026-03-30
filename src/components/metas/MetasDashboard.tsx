import { useState } from "react";
import {
  Target, BarChart3, TrendingUp, AlertTriangle, CheckCircle2,
  Clock, Zap, Building2, Users, User, Layers,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { MetaCompleta } from "@/types/metas-module";
import { NIVEL_LABELS, NIVEL_CORES, STATUS_LABELS, STATUS_CORES } from "@/types/metas-module";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

interface MetasDashboardProps {
  metas: MetaCompleta[];
  stats: {
    total: number;
    ativas: number;
    emAndamento: number;
    concluidas: number;
    atrasadas: number;
    emAprovacao: number;
    progressoMedio: number;
    porNivel: Record<string, number>;
    riscoAlto: number;
  };
}

const NIVEL_ICONS = {
  estrategica: Layers,
  unidade: Building2,
  setor: Users,
  individual: User,
};

const PIE_COLORS = ["#8b5cf6", "#3b82f6", "#f59e0b", "#22c55e"];

export function MetasDashboard({ metas, stats }: MetasDashboardProps) {
  const nivelData = Object.entries(stats.porNivel).map(([k, v]) => ({
    name: NIVEL_LABELS[k as keyof typeof NIVEL_LABELS],
    value: v,
  }));

  const statusData = [
    { name: "Não Iniciadas", value: metas.filter(m => m.status === "nao_iniciada").length, fill: "#94a3b8" },
    { name: "Em Andamento", value: stats.emAndamento, fill: "#3b82f6" },
    { name: "Concluídas", value: stats.concluidas, fill: "#22c55e" },
    { name: "Atrasadas", value: stats.atrasadas, fill: "#ef4444" },
  ];

  const metasRecentes = [...metas]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: "Total", value: stats.total, icon: Target, color: "text-foreground" },
          { label: "Ativas", value: stats.ativas, icon: Zap, color: "text-green-600" },
          { label: "Em Andamento", value: stats.emAndamento, icon: TrendingUp, color: "text-blue-600" },
          { label: "Concluídas", value: stats.concluidas, icon: CheckCircle2, color: "text-emerald-600" },
          { label: "Atrasadas", value: stats.atrasadas, icon: AlertTriangle, color: "text-red-600" },
          { label: "Aguardando Aprovação", value: stats.emAprovacao, icon: Clock, color: "text-amber-600" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center space-y-1">
              <s.icon className={`h-5 w-5 mx-auto ${s.color}`} />
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Progresso Médio */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progresso Médio Geral</span>
            <span className="text-lg font-bold">{stats.progressoMedio}%</span>
          </div>
          <Progress value={stats.progressoMedio} className="h-3" />
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Metas por Nível */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3">Metas por Nível</h3>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(stats.porNivel) as [string, number][]).map(([nivel, count]) => {
                const Icon = NIVEL_ICONS[nivel as keyof typeof NIVEL_ICONS] || Target;
                return (
                  <div key={nivel} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">{NIVEL_LABELS[nivel as keyof typeof NIVEL_LABELS]}</p>
                      <p className="font-semibold">{count}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Distribuição por Status */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3">Distribuição por Status</h3>
            {stats.total > 0 ? (
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie
                    data={statusData.filter(d => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={60}
                    dataKey="value"
                    strokeWidth={2}
                  >
                    {statusData.filter(d => d.value > 0).map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Metas Recentes */}
      {metasRecentes.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3">Atividade Recente</h3>
            <div className="space-y-2">
              {metasRecentes.map(m => (
                <div key={m.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge className={`${NIVEL_CORES[m.nivel]} text-[10px] shrink-0`}>
                      {NIVEL_LABELS[m.nivel]}
                    </Badge>
                    <span className="text-sm truncate">{m.titulo}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Progress value={m.progresso} className="w-16 h-1.5" />
                    <span className="text-xs font-medium w-8 text-right">{m.progresso}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
