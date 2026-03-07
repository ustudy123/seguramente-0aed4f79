import { useState } from "react";
import { motion } from "framer-motion";
import {
  Brain,
  Users,
  Send,
  BarChart3,
  Plus,
  QrCode,
  Link as LinkIcon,
  AlertTriangle,
  TrendingUp,
  ShieldCheck,
  FileText,
  Activity,
  Sparkles,
  Lock,
  Flame,
  Battery,
  ClipboardList,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePsicossocial } from "@/hooks/usePsicossocial";
import { CampanhaList } from "./CampanhaList";
import { CampanhaForm } from "./CampanhaForm";
import { IPSGauge } from "./IPSGauge";
import { InstrumentosVisualizacao } from "./InstrumentosVisualizacao";
import { AssistenteSelecaoInstrumento } from "./AssistenteSelecaoInstrumento";
import { RadaresPsicossocialSection } from "./RadaresPsicossocialSection";
import { IPSHistoricoChart } from "./IPSHistoricoChart";
import { InventarioPGR } from "./InventarioPGR";
import { type IPSClassificacao, getIPSColor, getIPSBgColor, calcularIPSClassificacao } from "@/types/psicossocial";
import { cn } from "@/lib/utils";

const MINIMO_ANONIMATO = 5;

export function PsicossocialDashboard() {
  const [showAssistente, setShowAssistente] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [instrumentoPreSelecionado, setInstrumentoPreSelecionado] = useState<string | undefined>();
  const { campanhas, campanhasAtivas, isLoadingCampanhas } = usePsicossocial();

  const handleNovaCampanha = () => setShowAssistente(true);

  const handleAssistenteSelect = (instrumento: string, _manual: boolean) => {
    setInstrumentoPreSelecionado(instrumento);
    setShowForm(true);
  };

  const totalCampanhas = campanhas.length;
  const campanhasEncerradas = campanhas.filter(c => c.status === 'encerrada').length;
  const totalRespostas = campanhas.reduce((sum, c) => sum + (c.total_respostas || 0), 0);

  // IPS consolidado das campanhas encerradas com dados suficientes
  const campanhasComIPS = campanhas.filter(c => c.ips_score != null && (c.total_respostas || 0) >= MINIMO_ANONIMATO);
  const ipsConsolidado = campanhasComIPS.length > 0
    ? Math.round(campanhasComIPS.reduce((sum, c) => sum + (c.ips_score || 50), 0) / campanhasComIPS.length)
    : null;
  const ipsClassificacao: IPSClassificacao | null = ipsConsolidado != null ? calcularIPSClassificacao(ipsConsolidado) : null;

  if (isLoadingCampanhas) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-600" />
            Gestão Psicossocial
          </h2>
          <p className="text-muted-foreground text-sm">
            NR-01 · NR-17 · ISO 45001 · ISO 45003 — Análise multidimensional baseada em evidências
          </p>
        </div>
        <Button onClick={handleNovaCampanha} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Campanha
        </Button>
      </div>

      {/* Stats + IPS */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        {/* IPS Card */}
        <Card className="lg:col-span-2 border-purple-200 bg-gradient-to-br from-purple-50/50 to-background">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-600" />
              IPS — Índice Psicossocial Organizacional
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center py-2">
            {ipsConsolidado != null && ipsClassificacao ? (
              <IPSGauge score={ipsConsolidado} classificacao={ipsClassificacao} size="md" />
            ) : (
              <div className="flex flex-col items-center gap-2 py-4">
                <div className="p-3 rounded-full bg-muted">
                  <Lock className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Mín. {MINIMO_ANONIMATO} respostas para liberar análise
                </p>
              </div>
            )}
            <div className="mt-3 w-full grid grid-cols-5 gap-0.5 text-xs">
              {[
                { label: '0-34', nome: 'Crítico', color: 'bg-red-500' },
                { label: '35-49', nome: 'Risco', color: 'bg-orange-500' },
                { label: '50-64', nome: 'Atenção', color: 'bg-amber-500' },
                { label: '65-79', nome: 'Estável', color: 'bg-blue-500' },
                { label: '80-100', nome: 'Saudável', color: 'bg-emerald-500' },
              ].map(item => (
                <div key={item.label} className="flex flex-col items-center gap-0.5">
                  <div className={cn("h-1.5 w-full rounded-full", item.color)} />
                  <span className="text-muted-foreground text-[10px]">{item.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Campanhas Ativas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Campanhas Ativas</CardTitle>
            <div className="p-2 rounded-lg bg-purple-100">
              <Brain className="h-4 w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campanhasAtivas}</div>
            <p className="text-xs text-muted-foreground">de {totalCampanhas} campanhas</p>
          </CardContent>
        </Card>

        {/* Respostas Coletadas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Respostas</CardTitle>
            <div className="p-2 rounded-lg bg-blue-100">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRespostas > 0 ? totalRespostas : '—'}</div>
            <p className="text-xs text-muted-foreground">
              {totalRespostas >= MINIMO_ANONIMATO ? 'Análise liberada' : `Mín. ${MINIMO_ANONIMATO} para análise`}
            </p>
          </CardContent>
        </Card>

        {/* Concluídas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
            <div className="p-2 rounded-lg bg-emerald-100">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campanhasEncerradas}</div>
            <p className="text-xs text-muted-foreground">histórico disponível</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs principais */}
      <Tabs defaultValue="burnout-boreout">
        <TabsList className="w-full sm:w-auto flex-wrap h-auto">
          <TabsTrigger value="burnout-boreout" className="gap-2">
            <Flame className="h-4 w-4" />
            Burnout & Boreout
          </TabsTrigger>
          <TabsTrigger value="campanhas" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Campanhas
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Histórico IPS
          </TabsTrigger>
          <TabsTrigger value="pgr" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Inventário PGR
          </TabsTrigger>
          <TabsTrigger value="instrumentos" className="gap-2">
            <FileText className="h-4 w-4" />
            Instrumentos
          </TabsTrigger>
          <TabsTrigger value="indicadores" className="gap-2">
            <Activity className="h-4 w-4" />
            Indicadores
          </TabsTrigger>
        </TabsList>

        {/* Tab: Burnout & Boreout */}
        <TabsContent value="burnout-boreout" className="mt-4">
          <RadaresPsicossocialSection />
        </TabsContent>

        {/* Tab: Campanhas */}
        <TabsContent value="campanhas" className="mt-4">
          <CampanhaList campanhas={campanhas} onNovaCampanha={handleNovaCampanha} />
        </TabsContent>

        {/* Tab: Histórico IPS */}
        <TabsContent value="historico" className="mt-4 space-y-4">
          <IPSHistoricoChart campanhas={campanhas} />
        </TabsContent>

        {/* Tab: Inventário PGR */}
        <TabsContent value="pgr" className="mt-4 space-y-4">
          <InventarioPGR campanhas={campanhas} />
        </TabsContent>

        {/* Tab: Instrumentos */}
        <TabsContent value="instrumentos" className="mt-4">
          <InstrumentosVisualizacao />
        </TabsContent>

        {/* Tab: Indicadores */}
        <TabsContent value="indicadores" className="mt-4 space-y-4">
          {/* Regra de Anonimato */}
          <Card className="border-blue-200 bg-blue-50/40">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-blue-100">
                  <ShieldCheck className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Regra de Anonimato Estatístico</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Os resultados só são apresentados quando houver <strong>mínimo de {MINIMO_ANONIMATO} respostas</strong> na campanha.
                    Com menos de {MINIMO_ANONIMATO} respondentes, a análise permanece bloqueada para garantir a privacidade individual.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Índices */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-purple-600" />
                Índices Calculados Automaticamente
              </CardTitle>
              <CardDescription>Gerados a partir das respostas após atingir o mínimo de anonimato</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { codigo: 'IPS', nome: 'Índice Psicossocial Seguramente', desc: 'Score geral do ambiente organizacional (0-100)', color: 'bg-purple-100 text-purple-600', destaque: true },
                  { codigo: 'IRP-S', nome: 'Risco Psicossocial', desc: 'Exposição a fatores de risco', color: 'bg-red-100 text-red-600', destaque: false },
                  { codigo: 'IBO-S', nome: 'Burnout', desc: 'Indícios de esgotamento profissional', color: 'bg-orange-100 text-orange-600', destaque: false },
                  { codigo: 'IBD-S', nome: 'Boreout', desc: 'Falta de desafio e engajamento', color: 'bg-slate-100 text-slate-600', destaque: false },
                  { codigo: 'IREC-S', nome: 'Recuperação', desc: 'Capacidade de recuperação pós-trabalho', color: 'bg-blue-100 text-blue-600', destaque: false },
                  { codigo: 'ICOP-S', nome: 'Clareza Organizacional', desc: 'Clareza de papéis e direcionamento', color: 'bg-emerald-100 text-emerald-600', destaque: false },
                ].map(({ codigo, nome, desc, color, destaque }) => (
                  <div key={codigo} className={cn("p-4 rounded-lg border", destaque && "border-purple-200 bg-purple-50/30")}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn("px-2 py-0.5 rounded text-xs font-bold", color)}>{codigo}</div>
                      {destaque && <Badge className="bg-purple-600 text-xs">Principal</Badge>}
                    </div>
                    <p className="font-medium text-sm">{nome}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Classificação IPS */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Classificação do IPS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-5">
                {[
                  { range: '80-100', label: 'Ambiente Saudável', cls: 'saudavel' as IPSClassificacao },
                  { range: '65-79', label: 'Ambiente Estável', cls: 'estavel' as IPSClassificacao },
                  { range: '50-64', label: 'Atenção', cls: 'atencao' as IPSClassificacao },
                  { range: '35-49', label: 'Risco Psicossocial', cls: 'risco' as IPSClassificacao },
                  { range: '0-34', label: 'Risco Crítico', cls: 'critico' as IPSClassificacao },
                ].map(({ range, label, cls }) => (
                  <div key={range} className={cn("p-3 rounded-lg text-center", getIPSBgColor(cls))}>
                    <p className={cn("text-lg font-bold", getIPSColor(cls))}>{range}</p>
                    <p className={cn("text-xs font-medium", getIPSColor(cls))}>{label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Assistente de Seleção */}
      <AssistenteSelecaoInstrumento
        open={showAssistente}
        onOpenChange={setShowAssistente}
        onSelectInstrumento={handleAssistenteSelect}
      />

      {/* Modal de Nova Campanha */}
      <CampanhaForm
        open={showForm}
        onOpenChange={setShowForm}
        instrumentoSugerido={instrumentoPreSelecionado}
      />
    </div>
  );
}
