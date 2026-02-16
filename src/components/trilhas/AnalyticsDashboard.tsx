import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3, Users, Trophy, Award, BookOpen, TrendingUp,
  AlertTriangle, Lightbulb, Zap, Target, GraduationCap, Info
} from "lucide-react";
import { useAnalyticsTrilhas, type TrilhaAnalytics, type GatilhoIA, type TrilhaEngajamento, type ColaboradorProgresso, type ModuloRank, type TendenciaMensal } from "@/hooks/useAnalyticsTrilhas";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell, AreaChart, Area
} from "recharts";

// ========== DEMO DATA ==========
function buildDemoData(): TrilhaAnalytics {
  const tendencia: TendenciaMensal[] = [
    { mes: "2025-09", conclusoes: 8, novos_inscritos: 22 },
    { mes: "2025-10", conclusoes: 15, novos_inscritos: 18 },
    { mes: "2025-11", conclusoes: 24, novos_inscritos: 31 },
    { mes: "2025-12", conclusoes: 19, novos_inscritos: 12 },
    { mes: "2026-01", conclusoes: 34, novos_inscritos: 27 },
    { mes: "2026-02", conclusoes: 41, novos_inscritos: 35 },
  ];

  const engajamento: TrilhaEngajamento[] = [
    { trilha_id: "1", trilha_nome: "NR-17 Ergonomia", total_inscritos: 42, total_concluidos: 31, taxa_conclusao: 74, pontos_medio: 850 },
    { trilha_id: "2", trilha_nome: "Liderança Humanizada", total_inscritos: 28, total_concluidos: 12, taxa_conclusao: 43, pontos_medio: 620 },
    { trilha_id: "3", trilha_nome: "Saúde Mental no Trabalho", total_inscritos: 55, total_concluidos: 38, taxa_conclusao: 69, pontos_medio: 780 },
    { trilha_id: "4", trilha_nome: "Cultura de Segurança", total_inscritos: 35, total_concluidos: 8, taxa_conclusao: 23, pontos_medio: 430 },
    { trilha_id: "5", trilha_nome: "Onboarding Técnico", total_inscritos: 18, total_concluidos: 16, taxa_conclusao: 89, pontos_medio: 920 },
    { trilha_id: "6", trilha_nome: "Gestão de Conflitos", total_inscritos: 14, total_concluidos: 3, taxa_conclusao: 21, pontos_medio: 310 },
  ];

  const colaboradores: ColaboradorProgresso[] = [
    { colaborador_id: "a", colaborador_nome: "Ana Souza", trilhas_iniciadas: 5, trilhas_concluidas: 4, pontos_total: 4250, ultima_atividade: "2026-02-15" },
    { colaborador_id: "b", colaborador_nome: "Carlos Pereira", trilhas_iniciadas: 4, trilhas_concluidas: 3, pontos_total: 3180, ultima_atividade: "2026-02-14" },
    { colaborador_id: "c", colaborador_nome: "Beatriz Lima", trilhas_iniciadas: 3, trilhas_concluidas: 3, pontos_total: 2940, ultima_atividade: "2026-02-12" },
    { colaborador_id: "d", colaborador_nome: "Rafael Oliveira", trilhas_iniciadas: 4, trilhas_concluidas: 2, pontos_total: 2100, ultima_atividade: "2026-02-10" },
    { colaborador_id: "e", colaborador_nome: "Letícia Santos", trilhas_iniciadas: 3, trilhas_concluidas: 2, pontos_total: 1870, ultima_atividade: "2026-01-28" },
    { colaborador_id: "f", colaborador_nome: "Fernando Costa", trilhas_iniciadas: 2, trilhas_concluidas: 1, pontos_total: 950, ultima_atividade: "2026-01-15" },
    { colaborador_id: "g", colaborador_nome: "Mariana Silva", trilhas_iniciadas: 1, trilhas_concluidas: 0, pontos_total: 320, ultima_atividade: "2025-12-20" },
  ];

  const modulos: ModuloRank[] = [
    { modulo_id: "m1", titulo: "Postura e Ergonomia no Home Office", tipo: "video", conclusoes: 38, nota_media: 9.2 },
    { modulo_id: "m2", titulo: "Identificação de Riscos Psicossociais", tipo: "quiz", conclusoes: 35, nota_media: 8.7 },
    { modulo_id: "m3", titulo: "Comunicação Não-Violenta", tipo: "atividade_pratica", conclusoes: 31, nota_media: 8.9 },
    { modulo_id: "m4", titulo: "Primeiros Socorros Básicos", tipo: "video", conclusoes: 28, nota_media: 9.5 },
    { modulo_id: "m5", titulo: "Gestão de Tempo e Energia", tipo: "estudo_caso", conclusoes: 24, nota_media: 8.1 },
  ];

  const gatilhos: GatilhoIA[] = [
    {
      id: "humor_neg", tipo: "humor_negativo", titulo: "Humor Negativo Recorrente",
      descricao: "7 colaborador(es) apresentam padrão de humor negativo recorrente nas últimas 2 semanas. Recomenda-se atribuir trilhas de Ergonomia & Saúde ou Bem-Estar.",
      severidade: "critical", trilha_sugerida: "Saúde Mental no Trabalho", colaboradores_afetados: 7, dados: {},
    },
    {
      id: "abandono", tipo: "abandono_trilha", titulo: "Trilhas Abandonadas",
      descricao: "4 colaborador(es) não interagem com suas trilhas há mais de 14 dias. Considere enviar lembretes ou simplificar o conteúdo.",
      severidade: "warning", colaboradores_afetados: 4, dados: { colaboradores: ["Fernando Costa", "Mariana Silva", "João Mendes", "Paula Ramos"] },
    },
    {
      id: "baixa_conclusao", tipo: "img_baixo", titulo: "Trilhas com Baixa Conclusão",
      descricao: "2 trilha(s) têm taxa de conclusão inferior a 30%. Revise a dificuldade, duração ou relevância do conteúdo.",
      severidade: "warning", colaboradores_afetados: 49, dados: { trilhas: ["Cultura de Segurança", "Gestão de Conflitos"] },
    },
    {
      id: "alta_perf", tipo: "alta_performance", titulo: "Colaboradores Destaque",
      descricao: "3 colaborador(es) concluíram 3 ou mais trilhas. Considere reconhecimento formal ou atribuição de trilhas avançadas.",
      severidade: "info", colaboradores_afetados: 3, dados: { colaboradores: ["Ana Souza", "Carlos Pereira", "Beatriz Lima"] },
    },
  ];

  return {
    totalTrilhas: 8,
    trilhasAtivas: 6,
    totalModulos: 47,
    totalInscritos: 68,
    totalConclusoes: 108,
    taxaConclusao: 62,
    totalPontosDistribuidos: 15610,
    totalCertificados: 42,
    totalMedalhas: 29,
    engajamentoPorTrilha: engajamento,
    progressoPorColaborador: colaboradores,
    modulosMaisConcluidos: modulos,
    tendenciaMensal: tendencia,
    gatilhosIA: gatilhos,
  };
}

function isDataEmpty(data: TrilhaAnalytics): boolean {
  return data.totalInscritos === 0 && data.totalConclusoes === 0 && data.totalCertificados === 0;
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--info))",
  "hsl(var(--destructive))",
  "hsl(var(--accent-foreground))",
];

export function AnalyticsDashboard() {
  const { data: realData, isLoading } = useAnalyticsTrilhas();

  const demoData = useMemo(() => buildDemoData(), []);
  const isDemo = realData ? isDataEmpty(realData) : true;
  const data = isDemo ? demoData : realData!;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!data) return null;

  const stats = [
    { label: "Trilhas Ativas", value: data.trilhasAtivas, icon: BookOpen, color: "text-primary" },
    { label: "Módulos", value: data.totalModulos, icon: Target, color: "text-primary" },
    { label: "Participantes", value: data.totalInscritos, icon: Users, color: "text-info" },
    { label: "Certificados", value: data.totalCertificados, icon: GraduationCap, color: "text-success" },
    { label: "Medalhas", value: data.totalMedalhas, icon: Award, color: "text-warning" },
    { label: "Pontos Distribuídos", value: data.totalPontosDistribuidos.toLocaleString("pt-BR"), icon: Trophy, color: "text-primary" },
  ];

  // Pie data for type distribution
  const tipoPieData = data.engajamentoPorTrilha.map((t, i) => ({
    name: t.trilha_nome.length > 18 ? t.trilha_nome.slice(0, 18) + "…" : t.trilha_nome,
    value: t.total_inscritos,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <div className="space-y-6">
      {/* Demo banner */}
      {isDemo && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-info/30 bg-info/5">
          <Info className="w-4 h-4 text-info shrink-0" strokeWidth={1.75} />
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-info">Modo Demonstração</span> — Os dados abaixo são fictícios para ilustrar o dashboard. Quando houver dados reais, eles substituirão automaticamente.
          </p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 text-center">
              <s.icon className={`w-5 h-5 mx-auto mb-1.5 ${s.color}`} strokeWidth={1.75} />
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gatilhos IA */}
      {data.gatilhosIA.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-warning" strokeWidth={1.75} />
              Insights e Gatilhos Inteligentes
              {isDemo && <Badge variant="outline" className="text-[10px] text-info border-info/40">Demo</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.gatilhosIA.map((g) => (
              <GatilhoCard key={g.id} gatilho={g} />
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Tendência mensal */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" strokeWidth={1.75} />
              Tendência Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.tendenciaMensal}>
                <defs>
                  <linearGradient id="gradConclusoes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradInscritos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="conclusoes" stroke="hsl(var(--success))" fill="url(#gradConclusoes)" name="Conclusões" strokeWidth={2} dot={{ r: 3 }} />
                <Area type="monotone" dataKey="novos_inscritos" stroke="hsl(var(--primary))" fill="url(#gradInscritos)" name="Novos Inscritos" strokeWidth={2} dot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Engajamento por trilha */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" strokeWidth={1.75} />
              Engajamento por Trilha
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.engajamentoPorTrilha.slice(0, 6)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis dataKey="trilha_nome" type="category" tick={{ fontSize: 10 }} width={110} className="text-muted-foreground" />
                <Tooltip />
                <Bar dataKey="total_inscritos" fill="hsl(var(--primary))" name="Inscritos" radius={[0, 4, 4, 0]} barSize={14} />
                <Bar dataKey="total_concluidos" fill="hsl(var(--success))" name="Concluíram" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Distribuição de participantes (Pie) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Distribuição de Participantes</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={tipoPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {tipoPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number, name: string) => [`${value} inscritos`, name]} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top módulos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" strokeWidth={1.75} />
              Módulos Mais Concluídos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {data.modulosMaisConcluidos.slice(0, 5).map((m, i) => (
                <div key={m.modulo_id} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-5 text-right">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{m.titulo}</p>
                    <p className="text-[10px] text-muted-foreground">{m.tipo} • {m.conclusoes} conclusões{m.nota_media != null ? ` • ⭐ ${m.nota_media}` : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top colaboradores */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" strokeWidth={1.75} />
              Mais Engajados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {data.progressoPorColaborador.slice(0, 5).map((c, i) => (
                <div key={c.colaborador_id} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? "bg-warning/20 text-warning" : i === 1 ? "bg-muted text-muted-foreground" : i === 2 ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30" : "bg-muted/50 text-muted-foreground"}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{c.colaborador_nome}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {c.trilhas_concluidas}/{c.trilhas_iniciadas} trilhas
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">{c.pontos_total.toLocaleString("pt-BR")} pts</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Taxa de conclusão por trilha */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Taxa de Conclusão por Trilha</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.engajamentoPorTrilha.map((t) => (
              <div key={t.trilha_id} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium truncate max-w-[60%]">{t.trilha_nome}</span>
                  <span className="text-muted-foreground">{t.taxa_conclusao}% • {t.total_concluidos}/{t.total_inscritos}</span>
                </div>
                <Progress value={t.taxa_conclusao} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GatilhoCard({ gatilho }: { gatilho: GatilhoIA }) {
  const severityConfig = {
    critical: { bg: "bg-destructive/10 border-destructive/30", icon: AlertTriangle, iconColor: "text-destructive" },
    warning: { bg: "bg-warning/10 border-warning/30", icon: AlertTriangle, iconColor: "text-warning" },
    info: { bg: "bg-info/10 border-info/30", icon: Lightbulb, iconColor: "text-info" },
  };

  const config = severityConfig[gatilho.severidade];
  const Icon = config.icon;

  return (
    <div className={`flex gap-3 p-3 rounded-lg border ${config.bg}`}>
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.iconColor}`} strokeWidth={1.75} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-semibold">{gatilho.titulo}</span>
          <Badge variant="outline" className="text-[10px]">
            {gatilho.colaboradores_afetados} colaborador(es)
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{gatilho.descricao}</p>
        {gatilho.trilha_sugerida && (
          <p className="text-[10px] text-primary mt-1 font-medium">
            💡 Trilha sugerida: {gatilho.trilha_sugerida}
          </p>
        )}
      </div>
    </div>
  );
}
