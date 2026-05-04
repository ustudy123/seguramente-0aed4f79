import { useSuperAdminStats, useSuperAdminGrowth } from "@/hooks/useSuperAdminPainel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2, Users, UserPlus, TrendingUp, Brain, MessageSquare, Target, Sparkles, Activity,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, Legend,
} from "recharts";

const KPI_ITEMS = [
  { key: "tenants", label: "Empresas Ativas", icon: Building2, color: "from-blue-500 to-blue-600", get: (s: any) => `${s.tenants.ativos}/${s.tenants.total}`, sub: (s: any) => `+${s.tenants.novos_30d} em 30d` },
  { key: "usuarios", label: "Usuários", icon: Users, color: "from-purple-500 to-purple-600", get: (s: any) => s.usuarios.total, sub: (s: any) => `${s.usuarios.ativos_7d} ativos 7d` },
  { key: "colaboradores", label: "Colaboradores", icon: UserPlus, color: "from-emerald-500 to-emerald-600", get: (s: any) => s.colaboradores.total, sub: (s: any) => `+${s.colaboradores.novos_30d} em 30d` },
  { key: "leads", label: "Leads CRM", icon: Target, color: "from-orange-500 to-orange-600", get: (s: any) => s.leads.total, sub: (s: any) => `${s.leads.em_negociacao} em negociação` },
  { key: "conversao", label: "Convertidos", icon: Sparkles, color: "from-pink-500 to-pink-600", get: (s: any) => s.leads.convertidos, sub: (s: any) => `${s.leads.total ? ((s.leads.convertidos / s.leads.total) * 100).toFixed(1) : 0}% taxa` },
  { key: "landing", label: "Landing Leads", icon: TrendingUp, color: "from-cyan-500 to-cyan-600", get: (s: any) => s.landing_leads.total, sub: (s: any) => `${s.landing_leads.com_diagnostico} c/ diagnóstico` },
  { key: "psico_ativas", label: "Campanhas Ativas", icon: Brain, color: "from-violet-500 to-violet-600", get: (s: any) => s.campanhas_psicossociais.ativas, sub: (s: any) => `${s.campanhas_psicossociais.total} totais` },
  { key: "psico_fim", label: "Campanhas Finalizadas", icon: Activity, color: "from-rose-500 to-rose-600", get: (s: any) => s.campanhas_psicossociais.finalizadas, sub: () => `Histórico completo` },
];

export function SuperAdminOverview() {
  const { data: stats, isLoading } = useSuperAdminStats();
  const { data: growth = [] } = useSuperAdminGrowth(30);

  if (isLoading || !stats) {
    return <div className="p-8 text-center text-muted-foreground">Carregando KPIs...</div>;
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {KPI_ITEMS.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
            >
              <Card className={`bg-gradient-to-br ${item.color} border-0 text-white overflow-hidden`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide opacity-90">{item.label}</p>
                      <p className="text-3xl font-bold mt-1">{item.get(stats)}</p>
                      <p className="text-xs opacity-80 mt-1">{item.sub(stats)}</p>
                    </div>
                    <Icon className="w-6 h-6 opacity-80" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Crescimento de Tenants & Usuários (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={growth}>
                <defs>
                  <linearGradient id="gT" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gU" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(217 91% 60%)" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="hsl(217 91% 60%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="tenants" stroke="hsl(var(--primary))" fill="url(#gT)" name="Tenants" />
                <Area type="monotone" dataKey="usuarios" stroke="hsl(217 91% 60%)" fill="url(#gU)" name="Usuários" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Captação Diária de Leads (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={growth}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="leads" fill="hsl(25 95% 53%)" radius={[4, 4, 0, 0]} name="Leads" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
