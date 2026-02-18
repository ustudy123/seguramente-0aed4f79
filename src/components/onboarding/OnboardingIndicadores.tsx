import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart3, Users, Clock, CheckCircle2, TrendingUp,
  Heart, Loader2, ChevronDown, Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOnboardingProcessos } from "@/hooks/useOnboarding";
import type { OnboardingProcesso } from "@/types/onboarding";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success, 142 71% 45%))",
  "hsl(var(--warning, 38 92% 50%))",
  "hsl(var(--destructive))",
];

const DEMO_PROCESSOS: OnboardingProcesso[] = [
  { id: "d1", tenant_id: "", admissao_id: "", template_id: null, trilha_id: null, colaborador_nome: "Ana Clara Souza", colaborador_cpf: "", status: "concluido", data_inicio: "2026-01-10", data_conclusao: "2026-01-25", progresso: 100, pontos_obtidos: 450, certificado_emitido: true, pdi_alimentado: true, created_at: "2026-01-10T10:00:00Z", updated_at: "2026-01-25T10:00:00Z" },
  { id: "d2", tenant_id: "", admissao_id: "", template_id: null, trilha_id: null, colaborador_nome: "Carlos Eduardo Lima", colaborador_cpf: "", status: "em_andamento", data_inicio: "2026-02-01", data_conclusao: null, progresso: 65, pontos_obtidos: 280, certificado_emitido: false, pdi_alimentado: false, created_at: "2026-02-01T10:00:00Z", updated_at: "2026-02-15T10:00:00Z" },
  { id: "d3", tenant_id: "", admissao_id: "", template_id: null, trilha_id: null, colaborador_nome: "Mariana Ferreira", colaborador_cpf: "", status: "em_andamento", data_inicio: "2026-02-05", data_conclusao: null, progresso: 40, pontos_obtidos: 160, certificado_emitido: false, pdi_alimentado: false, created_at: "2026-02-05T10:00:00Z", updated_at: "2026-02-16T10:00:00Z" },
  { id: "d4", tenant_id: "", admissao_id: "", template_id: null, trilha_id: null, colaborador_nome: "João Pedro Alves", colaborador_cpf: "", status: "pendente", data_inicio: null, data_conclusao: null, progresso: 0, pontos_obtidos: 0, certificado_emitido: false, pdi_alimentado: false, created_at: "2026-02-14T10:00:00Z", updated_at: "2026-02-14T10:00:00Z" },
  { id: "d5", tenant_id: "", admissao_id: "", template_id: null, trilha_id: null, colaborador_nome: "Beatriz Santos", colaborador_cpf: "", status: "concluido", data_inicio: "2026-01-15", data_conclusao: "2026-02-02", progresso: 100, pontos_obtidos: 420, certificado_emitido: true, pdi_alimentado: true, created_at: "2026-01-15T10:00:00Z", updated_at: "2026-02-02T10:00:00Z" },
  { id: "d6", tenant_id: "", admissao_id: "", template_id: null, trilha_id: null, colaborador_nome: "Rafael Mendes", colaborador_cpf: "", status: "pendente", data_inicio: null, data_conclusao: null, progresso: 0, pontos_obtidos: 0, certificado_emitido: false, pdi_alimentado: false, created_at: "2026-02-17T10:00:00Z", updated_at: "2026-02-17T10:00:00Z" },
];

const DEMO_PERCEPCOES = [
  { id: "dp1", pergunta_chave: "acolhimento", pergunta_texto: "Como você se sentiu acolhido(a) nos primeiros dias?", resposta: "Muito bem acolhido", categoria: "integracao", colaborador_nome: "Ana Clara" },
  { id: "dp2", pergunta_chave: "acolhimento", pergunta_texto: "Como você se sentiu acolhido(a) nos primeiros dias?", resposta: "Muito bem acolhido", categoria: "integracao", colaborador_nome: "Beatriz" },
  { id: "dp3", pergunta_chave: "acolhimento", pergunta_texto: "Como você se sentiu acolhido(a) nos primeiros dias?", resposta: "Bem acolhido", categoria: "integracao", colaborador_nome: "Carlos" },
  { id: "dp4", pergunta_chave: "valores_percebidos", pergunta_texto: "Os valores da empresa ficaram claros para você?", resposta: "Sim, totalmente", categoria: "cultura", colaborador_nome: "Ana Clara" },
  { id: "dp5", pergunta_chave: "valores_percebidos", pergunta_texto: "Os valores da empresa ficaram claros para você?", resposta: "Sim, totalmente", categoria: "cultura", colaborador_nome: "Beatriz" },
  { id: "dp6", pergunta_chave: "valores_percebidos", pergunta_texto: "Os valores da empresa ficaram claros para você?", resposta: "Parcialmente", categoria: "cultura", colaborador_nome: "Carlos" },
  { id: "dp7", pergunta_chave: "clareza_papel", pergunta_texto: "Você compreendeu bem seu papel e responsabilidades?", resposta: "Sim, com clareza", categoria: "engajamento", colaborador_nome: "Ana Clara" },
  { id: "dp8", pergunta_chave: "clareza_papel", pergunta_texto: "Você compreendeu bem seu papel e responsabilidades?", resposta: "Sim, com clareza", categoria: "engajamento", colaborador_nome: "Beatriz" },
  { id: "dp9", pergunta_chave: "sentido_trabalho", pergunta_texto: "Você sente que seu trabalho tem propósito?", resposta: "Muito propósito", categoria: "cultura", colaborador_nome: "Ana Clara" },
  { id: "dp10", pergunta_chave: "sentido_trabalho", pergunta_texto: "Você sente que seu trabalho tem propósito?", resposta: "Bastante propósito", categoria: "cultura", colaborador_nome: "Beatriz" },
  { id: "dp11", pergunta_chave: "observacao_livre", pergunta_texto: "", resposta: "A equipe foi muito receptiva, me senti parte do time desde o primeiro dia!", categoria: "geral", colaborador_nome: "Ana Clara Souza" },
  { id: "dp12", pergunta_chave: "observacao_livre", pergunta_texto: "", resposta: "Adorei o processo de integração, muito organizado e acolhedor.", categoria: "geral", colaborador_nome: "Beatriz Santos" },
];

export function OnboardingIndicadores() {
  const { tenantId } = useAuth();
  const { processos: realProcessos, isLoading: loadingProcessos } = useOnboardingProcessos();
  const [filtroCategoria, setFiltroCategoria] = useState("todas");

  // Fetch cultural perception data
  const isDemo = realProcessos.length === 0;
  const { data: realPercepcoes = [], isLoading: loadingPercepcoes } = useQuery({
    queryKey: ["onboarding_percepcao_cultural", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("onboarding_percepcao_cultural" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }) as { data: any[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const isLoading = loadingProcessos || loadingPercepcoes;

  const processos = isDemo ? DEMO_PROCESSOS : realProcessos;
  const percepcoes = isDemo ? DEMO_PERCEPCOES : realPercepcoes;

  // === KPIs ===
  const stats = useMemo(() => {
    const total = processos.length;
    const concluidos = processos.filter(p => p.status === "concluido").length;
    const emAndamento = processos.filter(p => p.status === "em_andamento").length;
    const pendentes = processos.filter(p => p.status === "pendente").length;
    const taxaConclusao = total > 0 ? Math.round((concluidos / total) * 100) : 0;

    // Tempo médio (diferença created_at → data_conclusao para concluídos)
    const tempos = processos
      .filter(p => p.status === "concluido" && p.data_conclusao)
      .map(p => {
        const inicio = new Date(p.created_at).getTime();
        const fim = new Date(p.data_conclusao!).getTime();
        return Math.max(1, Math.round((fim - inicio) / (1000 * 60 * 60 * 24)));
      });
    const tempoMedio = tempos.length > 0 ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : 0;

    return { total, concluidos, emAndamento, pendentes, taxaConclusao, tempoMedio };
  }, [processos]);

  // === Agregação de percepções ===
  const percepcaoAgregada = useMemo(() => {
    const porPergunta: Record<string, { texto: string; respostas: Record<string, number>; total: number }> = {};

    const filtered = filtroCategoria === "todas"
      ? percepcoes
      : percepcoes.filter((p: any) => p.categoria === filtroCategoria);

    filtered.forEach((p: any) => {
      if (p.pergunta_chave === "observacao_livre") return;
      if (!porPergunta[p.pergunta_chave]) {
        porPergunta[p.pergunta_chave] = { texto: p.pergunta_texto, respostas: {}, total: 0 };
      }
      const entry = porPergunta[p.pergunta_chave];
      entry.respostas[p.resposta] = (entry.respostas[p.resposta] || 0) + 1;
      entry.total++;
    });

    return porPergunta;
  }, [percepcoes, filtroCategoria]);

  // === Status distribution chart data ===
  const statusData = useMemo(() => [
    { name: "Concluídos", value: stats.concluidos },
    { name: "Em andamento", value: stats.emAndamento },
    { name: "Pendentes", value: stats.pendentes },
  ].filter(d => d.value > 0), [stats]);

  // === Observações livres ===
  const observacoes = useMemo(() =>
    percepcoes
      .filter((p: any) => p.pergunta_chave === "observacao_livre" && p.resposta && p.resposta !== "—")
      .slice(0, 10),
  [percepcoes]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const categorias = ["todas", "cultura", "integracao", "engajamento", "geral"];

  return (
    <div className="space-y-6">
      {isDemo && (
        <div className="flex items-center gap-2 bg-warning/10 border border-warning/30 rounded-lg px-4 py-2.5 text-sm text-warning">
          <Info className="w-4 h-4 shrink-0" />
          <span>Modo demonstração — dados fictícios para visualização.</span>
        </div>
      )}
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: "Total Processos", value: stats.total, icon: Users, color: "bg-primary/10 text-primary" },
          { label: "Taxa Conclusão", value: `${stats.taxaConclusao}%`, icon: CheckCircle2, color: "bg-success/10 text-success" },
          { label: "Tempo Médio", value: `${stats.tempoMedio}d`, icon: Clock, color: "bg-warning/10 text-warning" },
          { label: "Em Andamento", value: stats.emAndamento, icon: TrendingUp, color: "bg-info/10 text-info" },
          { label: "Respostas Culturais", value: percepcoes.filter((p: any) => p.pergunta_chave !== "observacao_livre").length, icon: Heart, color: "bg-rose-500/10 text-rose-500" },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${kpi.color}`}>
                  <kpi.icon className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{kpi.value}</p>
                  <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Distribuição de Status</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {statusData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum dado disponível</p>
            )}
          </CardContent>
        </Card>

        {/* Taxa de conclusão visual */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Progresso Geral</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="text-5xl font-bold text-primary">{stats.taxaConclusao}%</p>
              <p className="text-sm text-muted-foreground mt-1">Taxa de Conclusão</p>
            </div>
            <Progress value={stats.taxaConclusao} className="h-3" />
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <p className="font-bold text-foreground">{stats.concluidos}</p>
                <p className="text-muted-foreground">Concluídos</p>
              </div>
              <div>
                <p className="font-bold text-foreground">{stats.emAndamento}</p>
                <p className="text-muted-foreground">Em andamento</p>
              </div>
              <div>
                <p className="font-bold text-foreground">{stats.pendentes}</p>
                <p className="text-muted-foreground">Pendentes</p>
              </div>
            </div>
            {stats.tempoMedio > 0 && (
              <div className="bg-accent/50 rounded-lg p-3 text-center">
                <p className="text-sm text-foreground">
                  Tempo médio de conclusão: <strong>{stats.tempoMedio} dias</strong>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Percepção Cultural */}
      {percepcoes.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Heart className="w-4 h-4 text-primary" />
              Percepção Cultural — Respostas Agregadas
            </CardTitle>
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categorias.map(c => (
                  <SelectItem key={c} value={c}>
                    {c === "todas" ? "Todas" : c.charAt(0).toUpperCase() + c.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="space-y-5">
            {Object.entries(percepcaoAgregada).map(([chave, data]) => {
              const sortedRespostas = Object.entries(data.respostas)
                .sort((a, b) => b[1] - a[1]);
              return (
                <div key={chave} className="space-y-2">
                  <p className="text-sm font-medium text-foreground">{data.texto}</p>
                  <p className="text-[11px] text-muted-foreground">{data.total} respostas</p>
                  <div className="space-y-1.5">
                    {sortedRespostas.map(([resposta, count]) => {
                      const pct = Math.round((count / data.total) * 100);
                      return (
                        <div key={resposta} className="space-y-0.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-foreground/80 truncate max-w-[80%]">{resposta}</span>
                            <span className="text-muted-foreground font-medium">{pct}% ({count})</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className="bg-primary rounded-full h-2 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Observações Livres */}
      {observacoes.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Observações dos Colaboradores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {observacoes.map((obs: any, i: number) => (
              <div key={obs.id} className="bg-muted/30 rounded-lg p-3 border border-border">
                <p className="text-sm text-foreground/80 italic">"{obs.resposta}"</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  — {obs.colaborador_nome}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {percepcoes.length === 0 && (
        <Card className="border-dashed border-border">
          <CardContent className="p-8 text-center">
            <Heart className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhuma resposta de percepção cultural ainda. As respostas aparecerão aqui conforme os colaboradores completam o onboarding.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
