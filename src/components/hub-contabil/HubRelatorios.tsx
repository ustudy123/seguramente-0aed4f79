import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HubProcesso } from "@/hooks/useHubProcessos";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import {
  TrendingUp, TrendingDown, CheckCircle2, AlertTriangle,
  Clock, FileText, BarChart2, Target
} from "lucide-react";
import { format, parseISO, subMonths, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  processos: HubProcesso[];
  loading: boolean;
}

const TIPO_LABEL: Record<string, string> = {
  admissao: "Admissão",
  demissao: "Demissão",
  ferias: "Férias",
  advertencia: "Advertência",
  atestado_afastamento: "Atestado",
  ponto_folha: "Folha/Ponto",
  eventos_variaveis: "Eventos Var.",
  solicitacao_geral: "Geral",
  alteracao_contratual: "Alt. Contratual",
  mudanca_salarial: "Mud. Salarial",
  cat: "CAT",
  ppp_ltcat: "PPP/LTCAT",
  pro_labore: "Pró-Labore",
};

const CORES = ["hsl(var(--primary))", "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

const STATUS_FINAIS = ["concluido", "cancelado"];
const STATUS_ANDAMENTO = ["rascunho", "aguardando_documentos", "pronto_para_envio", "enviado_contabilidade",
  "recebido_contabilidade", "em_analise", "pendente_complementacao", "processado",
  "documentos_devolvidos", "aguardando_assinatura", "assinado_parcialmente"];

export function HubRelatorios({ processos, loading }: Props) {
  const stats = useMemo(() => {
    const now = new Date();
    const mes6Atras = subMonths(now, 5);

    // Volume por tipo
    const porTipo = Object.entries(
      processos.reduce<Record<string, number>>((acc, p) => {
        acc[p.tipo] = (acc[p.tipo] || 0) + 1;
        return acc;
      }, {})
    )
      .map(([tipo, total]) => ({ tipo, label: TIPO_LABEL[tipo] || tipo, total }))
      .sort((a, b) => b.total - a.total);

    // Volume por status
    const porStatus = [
      { label: "Em andamento", value: processos.filter(p => STATUS_ANDAMENTO.includes(p.status)).length, color: "#6366f1" },
      { label: "Concluídos", value: processos.filter(p => p.status === "concluido").length, color: "#10b981" },
      { label: "Cancelados", value: processos.filter(p => p.status === "cancelado").length, color: "#ef4444" },
    ].filter(s => s.value > 0);

    // Volume por mês (últimos 6 meses)
    const meses = Array.from({ length: 6 }).map((_, i) => {
      const d = subMonths(now, 5 - i);
      const inicio = startOfMonth(d);
      const fim = endOfMonth(d);
      const count = processos.filter(p =>
        isWithinInterval(parseISO(p.created_at), { start: inicio, end: fim })
      ).length;
      return { mes: format(d, "MMM/yy", { locale: ptBR }), total: count };
    });

    // SLA
    const comSla = processos.filter(p => p.sla_vencimento && !STATUS_FINAIS.includes(p.status));
    const slaVencidos = comSla.filter(p => new Date(p.sla_vencimento!) < now);
    const slaAVencer = comSla.filter(p => {
      const v = new Date(p.sla_vencimento!);
      const diffH = (v.getTime() - now.getTime()) / 3600000;
      return diffH >= 0 && diffH <= 48;
    });

    // Taxa de automação
    const autoGerados = processos.filter(p => p.gerado_automaticamente).length;
    const taxaAuto = processos.length > 0 ? Math.round((autoGerados / processos.length) * 100) : 0;

    // Processos concluídos x pendentes
    const concluidos = processos.filter(p => p.status === "concluido").length;
    const taxaConclusao = processos.length > 0 ? Math.round((concluidos / processos.length) * 100) : 0;

    return { porTipo, porStatus, meses, slaVencidos, slaAVencer, taxaAuto, taxaConclusao, concluidos, autoGerados };
  }, [processos]);

  if (loading) return <div className="text-center py-16 text-muted-foreground">Carregando relatórios...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Relatórios Gerenciais</h2>
        <p className="text-sm text-muted-foreground">Indicadores de performance do Hub Contábil</p>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Total de Processos
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{processos.length}</p>
            <p className="text-xs text-muted-foreground">registros totais</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Taxa de Conclusão
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold text-green-600">{stats.taxaConclusao}%</p>
            <p className="text-xs text-muted-foreground">{stats.concluidos} concluídos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-primary" /> Automação
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold text-primary">{stats.taxaAuto}%</p>
            <p className="text-xs text-muted-foreground">{stats.autoGerados} automáticos</p>
          </CardContent>
        </Card>

        <Card className={stats.slaVencidos.length > 0 ? "border-destructive" : ""}>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className={`w-3.5 h-3.5 ${stats.slaVencidos.length > 0 ? "text-destructive" : ""}`} /> SLA Vencido
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className={`text-2xl font-bold ${stats.slaVencidos.length > 0 ? "text-destructive" : ""}`}>
              {stats.slaVencidos.length}
            </p>
            <p className="text-xs text-muted-foreground">{stats.slaAVencer.length} a vencer em 48h</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Volume mensal */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart2 className="w-4 h-4" /> Volume por Mês (últimos 6 meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.meses} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Processos" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribuição por status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Distribuição por Status
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            {stats.porStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8">Nenhum dado disponível</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={stats.porStatus} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={80} label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {stats.porStatus.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Volume por tipo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart2 className="w-4 h-4" /> Volume por Tipo de Processo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.porTipo.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum processo registrado</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, stats.porTipo.length * 36)}>
              <BarChart data={stats.porTipo} layout="vertical" margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={110} />
                <Tooltip />
                <Bar dataKey="total" radius={[0, 4, 4, 0]} name="Processos">
                  {stats.porTipo.map((_, i) => (
                    <Cell key={i} fill={CORES[i % CORES.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Processos com SLA crítico */}
      {(stats.slaVencidos.length > 0 || stats.slaAVencer.length > 0) && (
        <Card className="border-destructive/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-destructive">
              <Clock className="w-4 h-4" /> Processos com SLA Crítico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...stats.slaVencidos.map(p => ({ ...p, _slaStatus: "vencido" as const })),
                ...stats.slaAVencer.map(p => ({ ...p, _slaStatus: "a_vencer" as const }))].map(p => (
                <div key={p.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border text-sm">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs font-mono text-muted-foreground">{p.codigo}</span>
                    <span className="truncate font-medium">{p.titulo}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.colaborador_nome && (
                      <span className="text-xs text-muted-foreground hidden sm:block">{p.colaborador_nome}</span>
                    )}
                    <Badge className={p._slaStatus === "vencido" ? "bg-destructive/20 text-destructive" : "bg-amber-100 text-amber-800"}>
                      {p._slaStatus === "vencido" ? "Vencido" : "A vencer"}
                    </Badge>
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
