import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Brain, Search, AlertTriangle, Activity, TrendingUp, Users, CheckCircle2, AlertCircle,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_COLORS: Record<string, string> = {
  rascunho: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  ativa: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  encerrada: "bg-blue-500/10 text-blue-600 border-blue-500/20",
};

const CLASSIF_COLORS: Record<string, string> = {
  baixo: "#10b981",
  moderado: "#f59e0b",
  elevado: "#ef4444",
  critico: "#7c2d12",
  sem_classificacao: "#94a3b8",
};

interface OverviewData {
  global: {
    total_campanhas: number; rascunho: number; ativa: number; encerrada: number;
    total_respostas: number; ips_medio: number | null; campanhas_sem_minimo: number;
  };
  distribuicao_classificacao: Record<string, number> | null;
  por_tenant: Array<any>;
  campanhas: Array<any>;
}

export function PsicossocialSuperAdminPanel() {
  const [filterTenant, setFilterTenant] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "psicossocial-overview"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("superadmin_psicossocial_overview");
      if (error) throw error;
      return data as unknown as OverviewData;
    },
    refetchInterval: 60_000,
  });

  const tenants = data?.por_tenant || [];
  const campanhas = data?.campanhas || [];

  const filteredCampanhas = useMemo(() => {
    return campanhas.filter((c: any) => {
      if (filterTenant !== "all" && c.tenant_id !== filterTenant) return false;
      if (filterStatus !== "all" && c.status !== filterStatus) return false;
      if (search && !`${c.nome} ${c.tenant_nome}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [campanhas, filterTenant, filterStatus, search]);

  const filteredTenants = useMemo(() => {
    return tenants
      .filter((t: any) => filterTenant === "all" || t.tenant_id === filterTenant)
      .filter((t: any) => !search || t.tenant_nome.toLowerCase().includes(search.toLowerCase()));
  }, [tenants, filterTenant, search]);

  const classifData = useMemo(() => {
    const dist = data?.distribuicao_classificacao || {};
    return Object.entries(dist).map(([k, v]) => ({ name: k, value: v as number }));
  }, [data]);

  const tenantsRanking = useMemo(() => {
    return [...filteredTenants]
      .filter((t: any) => t.total_respostas > 0)
      .sort((a: any, b: any) => b.total_respostas - a.total_respostas)
      .slice(0, 10);
  }, [filteredTenants]);

  if (isLoading || !data) {
    return <div className="text-center py-8 text-muted-foreground">Carregando dados psicossociais...</div>;
  }

  const g = data.global;

  return (
    <div className="space-y-6">
      {/* KPIs Globais */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI label="Total Campanhas" value={g.total_campanhas} icon={Brain} color="from-violet-500 to-violet-600" />
        <KPI label="Ativas" value={g.ativa} icon={Activity} color="from-emerald-500 to-emerald-600" sub={`${g.rascunho} rascunhos`} />
        <KPI label="Encerradas" value={g.encerrada} icon={CheckCircle2} color="from-blue-500 to-blue-600" />
        <KPI label="Respostas Totais" value={g.total_respostas} icon={Users} color="from-cyan-500 to-cyan-600" />
        <KPI label="IPS Médio" value={g.ips_medio ?? "—"} icon={TrendingUp} color="from-amber-500 to-amber-600" sub={`${g.campanhas_sem_minimo} sem mínimo`} />
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar empresa ou campanha..."
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={filterTenant} onValueChange={setFilterTenant}>
              <SelectTrigger className="w-full md:w-72"><SelectValue placeholder="Empresa" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas</SelectItem>
                {tenants.map((t: any) => (
                  <SelectItem key={t.tenant_id} value={t.tenant_id}>{t.tenant_nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-48"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="ativa">Ativa</SelectItem>
                <SelectItem value="encerrada">Encerrada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Top 10 Empresas por Respostas</CardTitle></CardHeader>
          <CardContent>
            {tenantsRanking.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Sem dados para exibir</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={tenantsRanking} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="tenant_nome" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip />
                  <Bar dataKey="total_respostas" fill="hsl(263 70% 60%)" radius={[0, 4, 4, 0]} name="Respostas" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição IPS (Classificação)</CardTitle></CardHeader>
          <CardContent>
            {classifData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Sem campanhas calculadas</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={classifData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    outerRadius={90} label={(e) => `${e.name}: ${e.value}`}>
                    {classifData.map((d, i) => (
                      <Cell key={i} fill={CLASSIF_COLORS[d.name] || "#94a3b8"} />
                    ))}
                  </Pie>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela por Empresa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-violet-500" /> Panorama por Empresa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead className="text-center">Campanhas</TableHead>
                <TableHead className="text-center">Ativas</TableHead>
                <TableHead className="text-center">Respostas</TableHead>
                <TableHead className="text-center">IPS Médio</TableHead>
                <TableHead className="text-center">Alertas</TableHead>
                <TableHead className="text-center">Sem mínimo</TableHead>
                <TableHead>Última Atividade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTenants.map((t: any) => (
                <TableRow key={t.tenant_id}>
                  <TableCell>
                    <div className="font-medium">{t.tenant_nome}</div>
                    <div className="text-xs text-muted-foreground">{t.colaboradores_ativos} colab. · {t.plano}</div>
                  </TableCell>
                  <TableCell className="text-center font-semibold">{t.total_campanhas}</TableCell>
                  <TableCell className="text-center">
                    {t.ativas > 0 ? <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">{t.ativas}</Badge> : <span className="text-muted-foreground">0</span>}
                  </TableCell>
                  <TableCell className="text-center">{t.total_respostas}</TableCell>
                  <TableCell className="text-center">
                    {t.ips_medio != null ? (
                      <Badge variant="outline" className="font-mono">{Number(t.ips_medio).toFixed(1)}</Badge>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {t.alertas > 0 ? (
                      <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" />{t.alertas}</Badge>
                    ) : <span className="text-muted-foreground">0</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {t.ativas_sem_minimo > 0 ? (
                      <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1">
                        <AlertCircle className="w-3 h-3" />{t.ativas_sem_minimo}
                      </Badge>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-xs">
                    {t.ultima_atividade
                      ? formatDistanceToNow(new Date(t.ultima_atividade), { locale: ptBR, addSuffix: true })
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
              {filteredTenants.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                  Nenhuma empresa
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Lista detalhada de campanhas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campanhas ({filteredCampanhas.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campanha</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Tipo / Instrumento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Respostas</TableHead>
                <TableHead className="text-center">IPS</TableHead>
                <TableHead>Período</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCampanhas.slice(0, 100).map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium max-w-xs truncate">{c.nome}</TableCell>
                  <TableCell className="text-xs">{c.tenant_nome || "—"}</TableCell>
                  <TableCell>
                    <div className="text-xs">{c.tipo || "—"}</div>
                    <div className="text-xs text-muted-foreground">{c.instrumento || "—"}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_COLORS[c.status] || ""}>{c.status}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={c.total_respostas < 5 ? "text-amber-600 font-semibold" : ""}>
                      {c.total_respostas || 0}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {c.ips_score != null ? (
                      <Badge variant="outline" className="font-mono"
                        style={{ color: CLASSIF_COLORS[c.ips_classificacao] }}>
                        {Number(c.ips_score).toFixed(0)}
                      </Badge>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell className="text-xs">
                    {c.data_inicio ? format(new Date(c.data_inicio), "dd/MM/yy") : "—"}
                    {" → "}
                    {c.data_fim ? format(new Date(c.data_fim), "dd/MM/yy") : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {filteredCampanhas.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                  Nenhuma campanha encontrada
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function KPI({ label, value, icon: Icon, color, sub }: {
  label: string; value: number | string; icon: any; color: string; sub?: string;
}) {
  return (
    <Card className={`bg-gradient-to-br ${color} border-0 text-white`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide opacity-90">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs opacity-80 mt-1">{sub}</p>}
          </div>
          <Icon className="w-6 h-6 opacity-80" />
        </div>
      </CardContent>
    </Card>
  );
}
