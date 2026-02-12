import { useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Users,
  Download,
  Filter,
  Building,
  Briefcase,
  Info,
  ChevronDown,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from "recharts";
import { toast } from "sonner";

// Demo data
const demoDistribuicao = [
  { nota: "1 - Insuficiente", quantidade: 2, fill: "hsl(0, 70%, 55%)" },
  { nota: "2 - Em Desenv.", quantidade: 8, fill: "hsl(30, 70%, 55%)" },
  { nota: "3 - Atende", quantidade: 25, fill: "hsl(200, 70%, 55%)" },
  { nota: "4 - Supera", quantidade: 15, fill: "hsl(140, 70%, 55%)" },
  { nota: "5 - Excepcional", quantidade: 5, fill: "hsl(160, 70%, 45%)" },
];

const demoEvolucao = [
  { ciclo: "2025-S1", media: 3.2, participacao: 78 },
  { ciclo: "2025-S2", media: 3.4, participacao: 85 },
  { ciclo: "2026-S1", media: 3.6, participacao: 92 },
];

const demoPorSetor = [
  { setor: "SST", media: 3.8, colaboradores: 12 },
  { setor: "RH", media: 3.5, colaboradores: 8 },
  { setor: "Operações", media: 3.2, colaboradores: 25 },
  { setor: "Administrativo", media: 3.6, colaboradores: 10 },
  { setor: "TI", media: 4.0, colaboradores: 6 },
];

const demoDimensoes = [
  { dimensao: "Entrega", media: 3.7 },
  { dimensao: "Competências", media: 3.5 },
  { dimensao: "Evolução", media: 3.8 },
  { dimensao: "Contexto", media: 3.4 },
];

const demoCorrelacoes = [
  { indicador: "Ações concluídas", correlacao: 0.82, impacto: "alto" },
  { indicador: "Adesão a trilhas", correlacao: 0.71, impacto: "alto" },
  { indicador: "IRP Psicossocial (inv.)", correlacao: -0.45, impacto: "moderado" },
  { indicador: "Jornadas extensas", correlacao: -0.38, impacto: "moderado" },
  { indicador: "Feedbacks positivos", correlacao: 0.65, impacto: "alto" },
];

const demoTopColaboradores = [
  { nome: "Mariana Silva", setor: "SST", nota: 4.6, evolucao: "+0.4" },
  { nome: "Paulo Nascimento", setor: "TI", nota: 4.5, evolucao: "+0.2" },
  { nome: "Juliana Barros", setor: "RH", nota: 4.3, evolucao: "+0.5" },
  { nome: "André Oliveira", setor: "SST", nota: 4.2, evolucao: "+0.1" },
  { nome: "Camila Torres", setor: "Operações", nota: 4.1, evolucao: "+0.3" },
];

const PIE_COLORS = ["hsl(0,70%,55%)", "hsl(30,70%,55%)", "hsl(200,70%,55%)", "hsl(140,70%,55%)", "hsl(160,70%,45%)"];

export function ResultadosCiclo() {
  const [viewMode, setViewMode] = useState("geral");
  const [selectedCiclo, setSelectedCiclo] = useState("2026-S1");

  return (
    <div className="space-y-4">
      {/* Demo banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2 text-sm text-amber-800">
        <Info className="h-4 w-4 shrink-0" />
        <span className="font-medium">Modo Demonstração</span> — Dados fictícios para visualização dos resultados.
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedCiclo} onValueChange={setSelectedCiclo}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Ciclo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2026-S1">2026 – Semestre 1</SelectItem>
            <SelectItem value="2025-S2">2025 – Semestre 2</SelectItem>
            <SelectItem value="2025-S1">2025 – Semestre 1</SelectItem>
          </SelectContent>
        </Select>
        <Select value={viewMode} onValueChange={setViewMode}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="geral">Visão Geral</SelectItem>
            <SelectItem value="setor">Por Setor</SelectItem>
            <SelectItem value="funcao">Por Função</SelectItem>
            <SelectItem value="unidade">Por Unidade</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.info("Exportando PDF...")}>
            <Download className="h-3.5 w-3.5" />
            PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.info("Exportando Excel...")}>
            <Download className="h-3.5 w-3.5" />
            Excel
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Média Geral", value: "3.6", sub: "+0.2 vs anterior", icon: TrendingUp, color: "text-emerald-600 bg-emerald-50" },
          { label: "Avaliações Concluídas", value: "55/60", sub: "92% participação", icon: Users, color: "text-blue-600 bg-blue-50" },
          { label: "Notas Extremas", value: "7", sub: "2 baixas • 5 altas", icon: BarChart3, color: "text-amber-600 bg-amber-50" },
          { label: "PDIs Gerados", value: "12", sub: "22% dos avaliados", icon: FileText, color: "text-purple-600 bg-purple-50" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Distribution chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Distribuição de Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={demoDistribuicao}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="nota" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <RechartsTooltip />
                <Bar dataKey="quantidade" radius={[4, 4, 0, 0]}>
                  {demoDistribuicao.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Evolution chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Evolução entre Ciclos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={demoEvolucao}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="ciclo" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
                <RechartsTooltip />
                <Bar dataKey="media" name="Média" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Radar by dimension */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Média por Dimensão</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={demoDimensoes} cx="50%" cy="50%">
                <PolarGrid />
                <PolarAngleAxis dataKey="dimensao" tick={{ fontSize: 11 }} />
                <Radar dataKey="media" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* By sector */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Média por Setor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {demoPorSetor.map((s) => (
                <div key={s.setor} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5">
                      <Building className="h-3.5 w-3.5 text-muted-foreground" />
                      {s.setor}
                      <Badge variant="secondary" className="text-[10px] h-4">{s.colaboradores}</Badge>
                    </span>
                    <span className="font-semibold">{s.media.toFixed(1)}</span>
                  </div>
                  <Progress value={(s.media / 5) * 100} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Correlations + Top performers */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Correlações com Desempenho</CardTitle>
            <CardDescription className="text-xs">Fatores que mais influenciam a nota final</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {demoCorrelacoes.map((c) => (
                <div key={c.indicador} className="flex items-center justify-between">
                  <span className="text-sm">{c.indicador}</span>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={`text-[10px] ${
                        c.impacto === "alto" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {c.impacto}
                    </Badge>
                    <span className={`text-sm font-mono font-semibold ${c.correlacao > 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {c.correlacao > 0 ? "+" : ""}{c.correlacao.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top Colaboradores</CardTitle>
            <CardDescription className="text-xs">Maiores notas no ciclo atual</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {demoTopColaboradores.map((c, i) => (
                <div key={c.nome} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    i === 0 ? "bg-amber-100 text-amber-700" :
                    i === 1 ? "bg-slate-100 text-slate-700" :
                    i === 2 ? "bg-orange-100 text-orange-700" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.nome}</p>
                    <p className="text-[10px] text-muted-foreground">{c.setor}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{c.nota.toFixed(1)}</p>
                    <p className="text-[10px] text-emerald-600">{c.evolucao}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Relatórios Exportáveis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "PDF Individual", desc: "Relatório para conversa 1:1", icon: FileText },
              { label: "Relatório do Time", desc: "Visão consolidada por gestor", icon: Users },
              { label: "CSV/Excel Completo", desc: "Dados brutos para análise", icon: Download },
              { label: "Relatório Diretoria", desc: "Dashboard consolidado", icon: BarChart3 },
            ].map((r) => (
              <Button
                key={r.label}
                variant="outline"
                className="h-auto flex-col items-start p-4 gap-1"
                onClick={() => toast.info(`Gerando ${r.label}...`)}
              >
                <r.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{r.label}</span>
                <span className="text-[10px] text-muted-foreground">{r.desc}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
