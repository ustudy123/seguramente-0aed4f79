import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Brain,
  Users,
  BarChart3,
  Plus,
  TrendingUp,
  ShieldCheck,
  FileText,
  Activity,
  Lock,
  Flame,
  ClipboardList,
  Info,
  LayoutDashboard,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePsicossocial } from "@/hooks/usePsicossocial";
import { CampanhaList } from "./CampanhaList";
import { CampanhaForm } from "./CampanhaForm";
import { IPSGauge } from "./IPSGauge";
import { InstrumentosVisualizacao } from "./InstrumentosVisualizacao";
import { AssistenteSelecaoInstrumento } from "./AssistenteSelecaoInstrumento";
import { RadaresPsicossocialSection } from "./RadaresPsicossocialSection";
import { IPSHistoricoChart } from "./IPSHistoricoChart";
import { InventarioPGR } from "./InventarioPGR";
import { RiscosPsicossociaisPanel } from "./RiscosPsicossociaisPanel";
import { GHEPanel } from "./GHEPanel";
import { AlertasPsicossociaisPanel } from "./AlertasPsicossociaisPanel";
import { IndicesDerivadosDashboard } from "./IndicesDerivadosDashboard";
import { IndiceConfiabilidadeCard } from "./IndiceConfiabilidadeCard";
import { DashboardAvancadoIPS } from "./DashboardAvancadoIPS";

import { OnboardingEmptyState } from "./OnboardingEmptyState";
import { ProximaAcaoBanner } from "./ProximaAcaoBanner";
import { DistribuicaoModal } from "./DistribuicaoModal";
import { ResultadosModal } from "./ResultadosModal";
import { type IPSClassificacao, getIPSColor, getIPSBgColor, calcularIPSClassificacao } from "@/types/psicossocial";
import type { CampanhaPsicossocial } from "@/types/psicossocial";
import { cn } from "@/lib/utils";

const MINIMO_ANONIMATO = 5;

const INDICES_INFO = [
  { codigo: 'IPS', nome: 'Índice Psicossocial YourEyes', desc: 'Score geral do ambiente organizacional (0-100). É o termômetro principal da saúde psicossocial da empresa.', color: 'bg-purple-100 text-purple-600', destaque: true },
  { codigo: 'IRP-S', nome: 'Risco Psicossocial', desc: 'Mede a exposição da equipe a fatores de risco como sobrecarga, conflito e falta de suporte.', color: 'bg-red-100 text-red-600', destaque: false },
  { codigo: 'IBO-S', nome: 'Burnout', desc: 'Detecta indícios de esgotamento profissional: exaustão emocional, despersonalização e baixa realização.', color: 'bg-orange-100 text-orange-600', destaque: false },
  { codigo: 'IBD-S', nome: 'Boreout', desc: 'Identifica falta de desafio e engajamento. Tão prejudicial quanto o Burnout para turnover e produtividade.', color: 'bg-slate-100 text-slate-600', destaque: false },
  { codigo: 'IREC-S', nome: 'Recuperação', desc: 'Avalia a capacidade dos colaboradores de se recuperarem fora do horário de trabalho.', color: 'bg-blue-100 text-blue-600', destaque: false },
  { codigo: 'ICOP-S', nome: 'Clareza Organizacional', desc: 'Mede se os colaboradores entendem claramente seus papéis, expectativas e direcionamento da empresa.', color: 'bg-emerald-100 text-emerald-600', destaque: false },
  { codigo: 'INOT-S', nome: 'Trabalho Noturno', desc: 'Avalia riscos específicos de equipes que trabalham no 3º turno ou em horários noturnos.', color: 'bg-indigo-100 text-indigo-600', destaque: false },
];

export function PsicossocialDashboard() {
  const [showAssistente, setShowAssistente] = useState(false);
   const [showForm, setShowForm] = useState(false);
  const [showDashboardAvancado, setShowDashboardAvancado] = useState(false);
  const [campanhaParaEditar, setCampanhaParaEditar] = useState<CampanhaPsicossocial | undefined>();
  const [instrumentoPreSelecionado, setInstrumentoPreSelecionado] = useState<string | undefined>();
  const [bannerDistribuir, setBannerDistribuir] = useState<CampanhaPsicossocial | null>(null);
  const [bannerResultados, setBannerResultados] = useState<CampanhaPsicossocial | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab") || "visao";
  const [activeTab, setActiveTab] = useState(tabFromUrl);
  const [apenasAtivas, setApenasAtivas] = useState(false);

  // Sincroniza tab com URL (deep-link via sidebar)
  useEffect(() => {
    if (tabFromUrl !== activeTab) setActiveTab(tabFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabFromUrl]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const next = new URLSearchParams(searchParams);
    if (value === "visao") next.delete("tab");
    else next.set("tab", value);
    setSearchParams(next, { replace: true });
  };

  const { campanhas: campanhasAll, campanhasAtivas, isLoadingCampanhas } = usePsicossocial();
  const campanhas = apenasAtivas ? campanhasAll.filter(c => c.status === 'ativa') : campanhasAll;

  const handleNovaCampanha = () => {
    setCampanhaParaEditar(undefined);
    setInstrumentoPreSelecionado(undefined);
    setShowForm(false);
    setShowAssistente(true);
  };

  const handleEditarCampanha = (campanha: CampanhaPsicossocial) => {
    console.log("Iniciando edição da campanha:", campanha.id);
    setCampanhaParaEditar(campanha);
    setInstrumentoPreSelecionado(campanha.instrumento);
    setShowAssistente(false); 
    setShowForm(true);
  };

  const handleAssistenteSelect = (instrumento: string, _manual: boolean) => {
    setInstrumentoPreSelecionado(instrumento);
    setShowAssistente(false);
    setShowForm(true);
  };

  const totalCampanhas = campanhas.length;
  const campanhasEncerradas = campanhas.filter(c => c.status === 'encerrada').length;
  const totalRespostas = campanhas.reduce((sum, c) => sum + (c.total_respostas || 0), 0);

  const campanhasComIPS = campanhas.filter(c => c.ips_score != null && (c.total_respostas || 0) >= MINIMO_ANONIMATO);
  // Para campanhas SIPRO, o campo `ips_score` armazena o IRP-S (alto = ruim).
  // Convertemos para a escala IPS (alto = bom) usando 100 - score, mantendo a
  // consistência visual com o ResultadosModal e com o PDF de relatório.
  const ipsConsolidado = campanhasComIPS.length > 0
    ? Math.round(
        campanhasComIPS.reduce((sum, c) => {
          const raw = c.ips_score ?? 50;
          const valorIPS = c.instrumento === 'sipro' ? 100 - raw : raw;
          return sum + valorIPS;
        }, 0) / campanhasComIPS.length
      )
    : null;
  const ipsClassificacao: IPSClassificacao | null = ipsConsolidado != null ? calcularIPSClassificacao(ipsConsolidado) : null;

  if (isLoadingCampanhas) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Estado vazio — nenhuma campanha criada
  if (totalCampanhas === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-end gap-2">
          <Button id="btn-nova-campanha" onClick={handleNovaCampanha} className="gap-2 bg-purple-600 hover:bg-purple-700 text-white">
            <Plus className="h-4 w-4" />
            Nova Campanha
          </Button>
        </div>
        <OnboardingEmptyState onNovaCampanha={handleNovaCampanha} />

        <AssistenteSelecaoInstrumento
          open={showAssistente}
          onOpenChange={setShowAssistente}
          onSelectInstrumento={handleAssistenteSelect}
        />
        <CampanhaForm
          open={showForm}
          onOpenChange={setShowForm}
          campanhaParaEditar={campanhaParaEditar}
          instrumentoSugerido={instrumentoPreSelecionado}
        />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4">
          <div className="flex items-center gap-2">
            <Button id="btn-nova-campanha" onClick={handleNovaCampanha} className="gap-2 bg-purple-600 hover:bg-purple-700 text-white">
              <Plus className="h-4 w-4" />
              Nova Campanha
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Privacidade e anonimato protegidos</p>
                <p className="text-sm text-muted-foreground">
                  As respostas são anônimas, exibidas apenas de forma agregada e respeitam o mínimo de 5 respondentes por grupo.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="hidden" />

          <TabsContent value="visao" className="mt-0 space-y-6">
            {/* Banner de Próxima Ação */}
        <ProximaAcaoBanner
          campanhas={campanhas}
          onDistribuir={(c) => setBannerDistribuir(c)}
          onVerResultados={(c) => {
            setBannerResultados(c);
          }}
        />

        {/* Toggle de escopo dos indicadores */}
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <p>
              Os indicadores abaixo são <strong>históricos</strong> — incluem campanhas encerradas para preservar a prova documental do monitoramento (NR-01 / ISO 45003).
            </p>
          </div>
          <Button
            variant={apenasAtivas ? "default" : "outline"}
            size="sm"
            onClick={() => setApenasAtivas(v => !v)}
            className="gap-2 shrink-0"
          >
            <Activity className="h-3.5 w-3.5" />
            {apenasAtivas ? "Mostrando: apenas ativas" : "Apenas campanhas ativas"}
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">O IPS é o termômetro central da saúde psicossocial. Vai de 0 (crítico) a 100 (saudável). É calculado automaticamente após 5+ respostas anônimas.</p>
                  </TooltipContent>
                </Tooltip>
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
                  <p className="text-xs text-muted-foreground/70 text-center">
                    Isso garante o anonimato dos respondentes
                  </p>
                </div>
              )}
              
              {ipsConsolidado != null && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4 w-full gap-2 border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800"
                  onClick={() => setShowDashboardAvancado(true)}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Análise Detalhada
                </Button>
              )}

              <div className="mt-3 w-full grid grid-cols-5 gap-0.5 text-xs">
                {[
                  { label: '0-34', nome: 'Crítico', color: 'bg-red-500' },
                  { label: '35-49', nome: 'Risco', color: 'bg-orange-500' },
                  { label: '50-64', nome: 'Atenção', color: 'bg-amber-500' },
                  { label: '65-79', nome: 'Estável', color: 'bg-blue-500' },
                  { label: '80-100', nome: 'Saudável', color: 'bg-emerald-500' },
                ].map(item => (
                  <Tooltip key={item.label}>
                    <TooltipTrigger asChild>
                      <div className="flex flex-col items-center gap-0.5 cursor-help">
                        <div className={cn("h-1.5 w-full rounded-full", item.color)} />
                        <span className="text-muted-foreground text-[10px]">{item.label}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs font-medium">{item.nome}: {item.label}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Campanhas Ativas */}
          <Card
            className="cursor-pointer hover:border-purple-200 transition-colors"
            onClick={() => handleTabChange("campanhas")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Campanhas Ativas</CardTitle>
              <div className="p-2 rounded-lg bg-purple-100">
                <Brain className="h-4 w-4 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{campanhasAtivas}</div>
              <p className="text-xs text-muted-foreground">de {totalCampanhas} campanhas</p>
              {campanhasAtivas > 0 && (
                <p className="text-xs text-purple-600 font-medium mt-1">Ver campanhas →</p>
              )}
            </CardContent>
          </Card>

          {/* Respostas Coletadas */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                Respostas
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Total acumulado de todas as campanhas. Mínimo de 5 por campanha para liberar a análise.</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <div className="p-2 rounded-lg bg-blue-100">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalRespostas > 0 ? totalRespostas : '—'}</div>
              <p className="text-xs text-muted-foreground">
                {totalRespostas >= MINIMO_ANONIMATO ? '✅ Análise liberada' : `Mín. ${MINIMO_ANONIMATO} para análise`}
              </p>
            </CardContent>
          </Card>

          {/* Concluídas */}
          <Card
            className="cursor-pointer hover:border-emerald-200 transition-colors"
            onClick={() => handleTabChange("historico")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
              <div className="p-2 rounded-lg bg-emerald-100">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{campanhasEncerradas}</div>
              <p className="text-xs text-muted-foreground">
                {campanhasEncerradas > 0 ? 'Ver histórico →' : 'histórico disponível'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Alertas Psicossociais */}
        <AlertasPsicossociaisPanel />

        {/* RN-016: Índice de Confiabilidade — cruza psicossocial com dados reais */}
        {campanhasComIPS.length > 0 && ipsConsolidado != null && (
          <div className="grid gap-4 md:grid-cols-2">
            {campanhasComIPS.slice(0, 2).map((c) => (
              <IndiceConfiabilidadeCard
                key={c.id}
                campanhaId={c.id}
                ipsScore={c.ips_score || 50}
              />
            ))}
          </div>
        )}

            {/* Índices Derivados */}
            <IndicesDerivadosDashboard campanhas={campanhas} />
          </TabsContent>

          {/* Tab: Riscos Psicossociais */}
          <TabsContent value="riscos" className="mt-4">
            <RiscosPsicossociaisPanel />
          </TabsContent>

          {/* Tab: GHE */}
          <TabsContent value="ghe" className="mt-4">
            <GHEPanel />
          </TabsContent>

          {/* Tab: Campanhas */}
          <TabsContent value="campanhas" className="mt-4">
            <CampanhaList 
              campanhas={campanhas} 
              onNovaCampanha={handleNovaCampanha} 
              onEditarCampanha={handleEditarCampanha} 
            />
          </TabsContent>

          {/* Tab: Burnout & Boreout */}
          <TabsContent value="burnout-boreout" className="mt-4">
            <RadaresPsicossocialSection campanhas={campanhas} />
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

          {/* Tab: Índices */}
          <TabsContent value="indicadores" className="mt-4 space-y-4">
            {/* Regra de Anonimato */}
            <Card className="border-blue-200 bg-blue-50/40">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-blue-100">
                    <ShieldCheck className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">🔒 Regra de Anonimato Estatístico</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Os resultados só são apresentados quando houver <strong>mínimo de {MINIMO_ANONIMATO} respostas</strong> na campanha.
                      Com menos de {MINIMO_ANONIMATO} respondentes, a análise permanece bloqueada para garantir que ninguém seja identificado.
                      Em empresas pequenas, o sistema agrupa dados por Setor → Empresa automaticamente.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Índices com tooltips explicativos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-purple-600" />
                  O que cada índice significa?
                </CardTitle>
                <CardDescription>Passe o mouse sobre o ícone ℹ️ para entender cada índice</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {INDICES_INFO.map(({ codigo, nome, desc, color, destaque }) => (
                    <div key={codigo} className={cn("p-4 rounded-lg border", destaque && "border-purple-200 bg-purple-50/30")}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={cn("px-2 py-0.5 rounded text-xs font-bold", color)}>{codigo}</div>
                        {destaque && <Badge className="bg-purple-600 text-xs">Principal</Badge>}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground/50 cursor-help ml-auto" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="text-xs">{desc}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="font-medium text-sm">{nome}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{desc}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Classificação IPS */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Como interpretar o IPS?</CardTitle>
                <CardDescription>Cada faixa define um nível de ação necessário</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-5">
                  {[
                    { range: '80-100', label: 'Ambiente Saudável', acao: 'Manutenção e reconhecimento', cls: 'saudavel' as IPSClassificacao },
                    { range: '65-79', label: 'Ambiente Estável', acao: 'Melhorias pontuais', cls: 'estavel' as IPSClassificacao },
                    { range: '50-64', label: 'Atenção', acao: 'Monitoramento intensificado', cls: 'atencao' as IPSClassificacao },
                    { range: '35-49', label: 'Risco Psicossocial', acao: 'Ações corretivas prioritárias', cls: 'risco' as IPSClassificacao },
                    { range: '0-34', label: 'Risco Crítico', acao: 'Intervenção urgente NR-01', cls: 'critico' as IPSClassificacao },
                  ].map(({ range, label, acao, cls }) => (
                    <div key={range} className={cn("p-3 rounded-lg text-center space-y-1", getIPSBgColor(cls))}>
                      <p className={cn("text-lg font-bold", getIPSColor(cls))}>{range}</p>
                      <p className={cn("text-xs font-semibold", getIPSColor(cls))}>{label}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">{acao}</p>
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

        {/* Modal de Nova Campanha / Edição */}
        <CampanhaForm
          open={showForm}
          onOpenChange={(o) => {
            setShowForm(o);
            if (!o) setCampanhaParaEditar(undefined);
          }}
          campanhaParaEditar={campanhaParaEditar}
          instrumentoSugerido={instrumentoPreSelecionado}
        />

        {/* Modais do Banner */}
        {bannerDistribuir && (
          <DistribuicaoModal
            open={!!bannerDistribuir}
            onOpenChange={(o) => !o && setBannerDistribuir(null)}
            campanha={bannerDistribuir}
          />
        )}
        {bannerResultados && (
          <ResultadosModal
            open={!!bannerResultados}
            onOpenChange={(o) => !o && setBannerResultados(null)}
            campanha={bannerResultados}
          />
        )}

        <DashboardAvancadoIPS
          open={showDashboardAvancado}
          onOpenChange={setShowDashboardAvancado}
          campanhas={campanhas}
        />
      </div>
    </TooltipProvider>
  );
}
