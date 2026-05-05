import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Brain, Search, AlertTriangle, Activity, TrendingUp, Users,
  CheckCircle2, AlertCircle, Filter, X, ChevronRight, Sparkles,
  Building2, FileBarChart, RefreshCw, Layers, LayoutGrid, List,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<string, string> = {
  rascunho: "bg-slate-500/10 text-slate-600 border-slate-500/30 font-medium",
  ativa: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-medium",
  encerrada: "bg-blue-500/10 text-blue-600 border-blue-500/30 font-medium",
};

const CLASSIF_COLORS: Record<string, string> = {
  saudavel: "hsl(142 71% 45%)",
  estavel: "hsl(142 71% 45%)",
  atencao: "hsl(38 92% 50%)",
  risco: "hsl(0 84% 60%)",
  critico: "hsl(12 76% 25%)",
  baixo: "hsl(142 71% 45%)",
  moderado: "hsl(38 92% 50%)",
  elevado: "hsl(0 84% 60%)",
  sem_classificacao: "hsl(215 16% 47%)",
};

const CLASSIF_LABEL: Record<string, string> = {
  saudavel: "Saudável",
  estavel: "Estável",
  atencao: "Atenção",
  risco: "Risco",
  critico: "Crítico",
  sem_classificacao: "Sem classif.",
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
  const [activeTab, setActiveTab] = useState("overview");

  const { data, isLoading, refetch, isFetching } = useQuery({
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
    return Object.entries(dist).map(([k, v]) => ({
      name: CLASSIF_LABEL[k] || k, key: k, value: v as number,
    }));
  }, [data]);

  const tenantsRanking = useMemo(() => {
    return [...tenants]
      .filter((t: any) => t.total_respostas > 0)
      .sort((a: any, b: any) => b.total_respostas - a.total_respostas)
      .slice(0, 10);
  }, [tenants]);

  const totalAlertas = useMemo(
    () => tenants.reduce((s: number, t: any) => s + (t.alertas || 0) + (t.ativas_sem_minimo || 0), 0),
    [tenants],
  );

  const hasFilters = filterTenant !== "all" || filterStatus !== "all" || search !== "";
  const clearFilters = () => { setFilterTenant("all"); setFilterStatus("all"); setSearch(""); };

  const drillTenant = (tenantId: string) => {
    setFilterTenant(tenantId);
    setActiveTab("campanhas");
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const g = data.global;
  const engajamento = g.total_campanhas > 0 ? Math.round(((g.total_campanhas - g.campanhas_sem_minimo) / g.total_campanhas) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Header com refresh */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Saúde Psicossocial Global</h2>
            <p className="text-xs text-muted-foreground">
              Monitoramento NR-1 de todas as empresas em tempo real
            </p>
          </div>
        </div>
        <Button
          variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {/* KPIs Globais */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI
          label="Total Campanhas" value={g.total_campanhas} icon={Brain}
          color="from-violet-500 to-fuchsia-600"
          sub={`${g.rascunho} rascunhos`}
        />
        <KPI
          label="Ativas" value={g.ativa} icon={Activity}
          color="from-emerald-500 to-teal-600"
          sub="Em coleta"
        />
        <KPI
          label="Encerradas" value={g.encerrada} icon={CheckCircle2}
          color="from-blue-500 to-cyan-600"
          sub="Concluídas"
        />
        <KPI
          label="Respostas" value={g.total_respostas.toLocaleString("pt-BR")} icon={Users}
          color="from-cyan-500 to-blue-600"
          sub="Coletadas"
        />
        <KPI
          label="IPS Médio" value={g.ips_medio != null ? Number(g.ips_medio).toFixed(1) : "—"} icon={TrendingUp}
          color="from-amber-500 to-orange-600"
          sub={g.campanhas_sem_minimo > 0 ? `⚠ ${g.campanhas_sem_minimo} sem mínimo` : "Tudo ok"}
        />
      </div>

      {/* Linha de saúde */}
      <Card className="border-l-4 border-l-violet-500">
        <CardContent className="p-4 flex flex-wrap items-center gap-6">
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-muted-foreground">Engajamento (campanhas com mínimo de respostas)</span>
              <span className="text-sm font-bold">{engajamento}%</span>
            </div>
            <Progress value={engajamento} className="h-2" />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className={cn("w-4 h-4", totalAlertas > 0 ? "text-amber-500" : "text-muted-foreground")} />
            <span className="font-semibold">{totalAlertas}</span>
            <span className="text-muted-foreground">alertas ativos</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="w-4 h-4 text-violet-500" />
            <span className="font-semibold">{tenants.length}</span>
            <span className="text-muted-foreground">empresas monitoradas</span>
          </div>
        </CardContent>
      </Card>

      {/* Filtros sticky */}
      <Card className="sticky top-0 z-10 backdrop-blur-sm bg-card/95 shadow-sm">
        <CardContent className="p-3">
          <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-center">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground px-2">
              <Filter className="w-3.5 h-3.5" /> Filtros
            </div>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9 h-9" placeholder="Buscar empresa ou campanha..."
                value={search} onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterTenant} onValueChange={setFilterTenant}>
              <SelectTrigger className="w-full md:w-64 h-9"><SelectValue placeholder="Empresa" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas ({tenants.length})</SelectItem>
                {tenants.map((t: any) => (
                  <SelectItem key={t.tenant_id} value={t.tenant_id}>{t.tenant_nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-40 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="ativa">Ativa</SelectItem>
                <SelectItem value="encerrada">Encerrada</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                <X className="w-3.5 h-3.5" /> Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs Visão Geral / Empresas / Campanhas */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full md:w-auto md:inline-grid">
          <TabsTrigger value="overview" className="gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Visão Geral
          </TabsTrigger>
          <TabsTrigger value="empresas" className="gap-1.5">
            <Building2 className="w-3.5 h-3.5" /> Empresas
            <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{filteredTenants.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="campanhas" className="gap-1.5">
            <FileBarChart className="w-3.5 h-3.5" /> Campanhas
            <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{filteredCampanhas.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* === VISÃO GERAL === */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-violet-500" />
                  Top 10 Empresas por Respostas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tenantsRanking.length === 0 ? (
                  <EmptyState message="Sem dados de respostas ainda" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={tenantsRanking} layout="vertical" margin={{ left: 90, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category" dataKey="tenant_nome" tick={{ fontSize: 10 }}
                        width={130}
                        tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 18) + "…" : v}
                      />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, fontSize: 12 }}
                        formatter={(v) => [v, "Respostas"]}
                      />
                      <Bar dataKey="total_respostas" fill="hsl(263 70% 60%)" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Brain className="w-4 h-4 text-violet-500" />
                  Distribuição IPS por Classificação
                </CardTitle>
              </CardHeader>
              <CardContent>
                {classifData.length === 0 ? (
                  <EmptyState message="Sem campanhas calculadas" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={classifData} dataKey="value" nameKey="name"
                        cx="50%" cy="50%" outerRadius={100} innerRadius={50}
                        paddingAngle={2}
                        label={(e: any) => `${e.value}`}
                      >
                        {classifData.map((d, i) => (
                          <Cell key={i} fill={CLASSIF_COLORS[d.key] || "#94a3b8"} stroke="hsl(var(--background))" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick alerts list */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Empresas que precisam de atenção
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const alertList = tenants
                  .filter((t: any) => (t.alertas || 0) > 0 || (t.ativas_sem_minimo || 0) > 0)
                  .sort((a: any, b: any) => (b.alertas + b.ativas_sem_minimo) - (a.alertas + a.ativas_sem_minimo))
                  .slice(0, 8);
                if (alertList.length === 0) {
                  return (
                    <div className="text-center py-8 text-sm text-muted-foreground flex flex-col items-center gap-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                      Tudo certo! Nenhuma empresa com alertas críticos.
                    </div>
                  );
                }
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {alertList.map((t: any) => (
                      <button
                        key={t.tenant_id}
                        onClick={() => drillTenant(t.tenant_id)}
                        className="group flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-amber-500/5 hover:border-amber-500/40 transition-all text-left"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{t.tenant_nome}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                            {t.ativas_sem_minimo > 0 && (
                              <span className="text-amber-600">{t.ativas_sem_minimo} sem mínimo</span>
                            )}
                            {t.alertas > 0 && (
                              <span className="text-red-600">{t.alertas} alertas</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" />
                      </button>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === EMPRESAS === */}
        <TabsContent value="empresas" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Empresa</TableHead>
                    <TableHead className="text-center">Campanhas</TableHead>
                    <TableHead className="text-center">Ativas</TableHead>
                    <TableHead className="text-center">Respostas</TableHead>
                    <TableHead className="text-center">IPS Médio</TableHead>
                    <TableHead className="text-center">Alertas</TableHead>
                    <TableHead className="text-center">Sem mínimo</TableHead>
                    <TableHead>Última atividade</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTenants.map((t: any) => {
                    const hasAlert = (t.alertas || 0) > 0 || (t.ativas_sem_minimo || 0) > 0;
                    return (
                      <TableRow
                        key={t.tenant_id}
                        className={cn(
                          "cursor-pointer transition-colors",
                          hasAlert && "bg-amber-500/[0.03] hover:bg-amber-500/[0.07]",
                        )}
                        onClick={() => drillTenant(t.tenant_id)}
                      >
                        <TableCell>
                          <div className="font-medium text-sm">{t.tenant_nome}</div>
                          <div className="text-xs text-muted-foreground">
                            {t.colaboradores_ativos} colab. · {t.plano}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-semibold">{t.total_campanhas}</TableCell>
                        <TableCell className="text-center">
                          {t.ativas > 0 ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">{t.ativas}</Badge>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-center font-mono text-sm">{t.total_respostas}</TableCell>
                        <TableCell className="text-center">
                          {t.ips_medio != null ? (
                            <Badge variant="outline" className="font-mono">{Number(t.ips_medio).toFixed(1)}</Badge>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          {t.alertas > 0 ? (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="w-3 h-3" />{t.alertas}
                            </Badge>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          {t.ativas_sem_minimo > 0 ? (
                            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 gap-1">
                              <AlertCircle className="w-3 h-3" />{t.ativas_sem_minimo}
                            </Badge>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {t.ultima_atividade
                            ? formatDistanceToNow(new Date(t.ultima_atividade), { locale: ptBR, addSuffix: true })
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredTenants.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9}>
                        <EmptyState message="Nenhuma empresa encontrada com os filtros atuais" />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === CAMPANHAS === */}
        <TabsContent value="campanhas" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
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
                  {filteredCampanhas.slice(0, 200).map((c: any) => {
                    const semMinimo = (c.total_respostas || 0) < 5 && c.status === "ativa";
                    return (
                      <TableRow key={c.id} className={cn(semMinimo && "bg-amber-500/[0.03]")}>
                        <TableCell className="font-medium max-w-xs">
                          <div className="truncate text-sm">{c.nome}</div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                          {c.tenant_nome || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-medium">{c.tipo || "—"}</div>
                          <div className="text-[11px] text-muted-foreground">{c.instrumento || "—"}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_STYLE[c.status] || ""}>{c.status}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={cn(
                            "font-mono text-sm",
                            semMinimo && "text-amber-600 font-semibold",
                          )}>
                            {c.total_respostas || 0}
                          </span>
                          {semMinimo && (
                            <div className="text-[10px] text-amber-600">⚠ &lt; 5</div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {c.ips_score != null ? (
                            <Badge
                              variant="outline" className="font-mono"
                              style={{ color: CLASSIF_COLORS[c.ips_classificacao], borderColor: CLASSIF_COLORS[c.ips_classificacao] + "60" }}
                            >
                              {Number(c.ips_score).toFixed(0)}
                            </Badge>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {c.data_inicio ? format(new Date(c.data_inicio), "dd/MM/yy") : "—"}
                          {" → "}
                          {c.data_fim ? format(new Date(c.data_fim), "dd/MM/yy") : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredCampanhas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <EmptyState message="Nenhuma campanha encontrada com os filtros atuais" />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {filteredCampanhas.length > 200 && (
                <div className="text-center text-xs text-muted-foreground py-3 border-t">
                  Exibindo 200 de {filteredCampanhas.length}. Refine os filtros para ver mais.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KPI({ label, value, icon: Icon, color, sub }: {
  label: string; value: number | string; icon: any; color: string; sub?: string;
}) {
  return (
    <Card className={cn(
      "relative overflow-hidden border-0 text-white shadow-md hover:shadow-lg transition-shadow",
      "bg-gradient-to-br", color,
    )}>
      <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10 blur-2xl" />
      <CardContent className="p-4 relative">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider opacity-90 font-medium">{label}</p>
            <p className="text-2xl md:text-3xl font-bold mt-1 tabular-nums">{value}</p>
            {sub && <p className="text-[11px] opacity-80 mt-1 truncate">{sub}</p>}
          </div>
          <div className="p-2 rounded-lg bg-white/15 backdrop-blur-sm">
            <Icon className="w-4 h-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-10 text-sm text-muted-foreground flex flex-col items-center gap-2">
      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
        <Search className="w-4 h-4" />
      </div>
      {message}
    </div>
  );
}
