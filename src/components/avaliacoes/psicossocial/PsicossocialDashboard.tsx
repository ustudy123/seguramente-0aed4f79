import { useState, useEffect, useMemo } from "react";
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
import { AssistenteSelecaoInstrumento } from "./AssistenteSelecaoInstrumento";
import { RadaresPsicossocialSection } from "./RadaresPsicossocialSection";
import { IPSHistoricoChart } from "./IPSHistoricoChart";
import { InventarioPGR } from "./InventarioPGR";
import { GHEPanel } from "./GHEPanel";
import { ResultadosPorGHEPanel } from "./ResultadosPorGHEPanel";
import { AlertasPsicossociaisPanel } from "./AlertasPsicossociaisPanel";
import { IndicesDerivadosDashboard } from "./IndicesDerivadosDashboard";
import { MetodologiaPanel } from "./MetodologiaPanel";
import { IndiceConfiabilidadeCard } from "./IndiceConfiabilidadeCard";
import { DashboardAvancadoIPS } from "./DashboardAvancadoIPS";
import { ResultadosPsicossociaisHub } from "./ResultadosPsicossociaisHub";
import { useEntrevistasGuiadasAggregates } from "@/hooks/useEntrevistasGuiadasAggregates";


import { OnboardingEmptyState } from "./OnboardingEmptyState";
import { ProximaAcaoBanner } from "./ProximaAcaoBanner";
import { DistribuicaoModal } from "./DistribuicaoModal";
import { ResultadosModal } from "./ResultadosModal";
import { type IPSClassificacao, getIPSColor, getIPSBgColor, calcularIPSClassificacao, MINIMO_ANONIMATO_PADRAO, getMinimoRespostas, isEntrevistaInstrumento } from "@/types/psicossocial";
import type { CampanhaPsicossocial } from "@/types/psicossocial";
import { cn } from "@/lib/utils";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";


// Empresas autorizadas a visualizar IPS consolidado da empresa quando
// campanhas individuais ficam abaixo do mínimo (ISO 45003) — sem expor
// os scores por categoria. Caso pontual aprovado pelo cliente.
const EMPRESAS_CONSOLIDADO_LIBERADO = new Set<string>([
  "85b3e1db-6564-4fbc-987f-f8dea4f29ff3", // Laboratório Bioanálises / Dalmora
  "640e74f8-5807-4e92-9852-6f2964e52702", // SUDOMED (tecnico.capanema@sudomed.com.br)
]);


export function PsicossocialDashboard() {
  const [showAssistente, setShowAssistente] = useState(false);
   const [showForm, setShowForm] = useState(false);
  const [showDashboardAvancado, setShowDashboardAvancado] = useState(false);
  const [campanhaParaEditar, setCampanhaParaEditar] = useState<CampanhaPsicossocial | undefined>();
  const [instrumentoPreSelecionado, setInstrumentoPreSelecionado] = useState<string | undefined>();
  const [bannerDistribuir, setBannerDistribuir] = useState<CampanhaPsicossocial | null>(null);
  const [bannerResultados, setBannerResultados] = useState<CampanhaPsicossocial | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Retrocompat: as três telas de metodologia viraram sub-abas de "metodologia".
  // Links antigos (?tab=riscos|instrumentos|indicadores) são redirecionados.
  const LEGADO_METODOLOGIA: Record<string, string> = {
    riscos: "riscos",
    instrumentos: "instrumentos",
    indicadores: "indices",
  };
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && t in LEGADO_METODOLOGIA) {
      const next = new URLSearchParams(searchParams);
      next.set("tab", "metodologia");
      next.set("sub", LEGADO_METODOLOGIA[t]);
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
  const campanhasEntrevistaIds = useMemo(
    () => campanhas.filter(c =>isEntrevistaInstrumento((c as any).tipo_instrumento)).map(c => c.id),
    [campanhas],
  );
  const { agregadosPorCampanha } = useEntrevistasGuiadasAggregates(campanhasEntrevistaIds);
  const campanhasEnriquecidas = useMemo<CampanhaPsicossocial[]>(() => {
    if (agregadosPorCampanha.size === 0) return campanhas;

    return campanhas.map((campanha) => {
      const agregado = agregadosPorCampanha.get(campanha.id);
      if (!agregado) return campanha;

      return {
        ...campanha,
        ips_score: agregado.ips_score ?? campanha.ips_score,
        radar_data: agregado.radar_data.length > 0 ? agregado.radar_data : campanha.radar_data,
        total_respostas: agregado.total_concluidas || campanha.total_respostas,
      } as CampanhaPsicossocial;
    });
  }, [campanhas, agregadosPorCampanha]);

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

  const { empresaAtivaId } = useEmpresaAtiva();
  const consolidadoLiberado = empresaAtivaId ? EMPRESAS_CONSOLIDADO_LIBERADO.has(empresaAtivaId) : false;

  // Regra padrão (ISO 45003): só entram no consolidado campanhas que individualmente
  // atinjam o mínimo de respondentes. Para empresas com liberação pontual,
  // aceitamos campanhas com qualquer N desde que o TOTAL agregado da empresa ≥ mínimo.
  const campanhasComIPS = campanhasEnriquecidas.filter(c => {
    const totalRespostas = c.total_respostas || 0;
    const minimo = getMinimoRespostas(c);
    
    return c.ips_score != null && (
      totalRespostas >= minimo ||
      consolidadoLiberado
    );
  });
  const totalRespostasConsolidado = campanhasComIPS.reduce((s, c) => s + (c.total_respostas || 0), 0);
  const consolidadoValido = consolidadoLiberado
    ? totalRespostasConsolidado >= MINIMO_ANONIMATO_PADRAO
    : campanhasComIPS.length > 0;
  const usandoFallbackEmpresa = consolidadoLiberado &&
    campanhasComIPS.length > 0 &&
    campanhasComIPS.every(c => (c.total_respostas || 0) < getMinimoRespostas(c)) &&
    totalRespostasConsolidado >= MINIMO_ANONIMATO_PADRAO;

  // Para campanhas SIPRO, o campo `ips_score` armazena o IRP-S (alto = ruim).
  // Convertemos para a escala IPS (alto = bom) usando 100 - score, mantendo a
  // consistência visual com o ResultadosModal e com o PDF de relatório.
  // Média ponderada por respondentes para refletir o tamanho de cada categoria.
  const ipsConsolidado = consolidadoValido && totalRespostasConsolidado > 0
    ? Math.round(
        campanhasComIPS.reduce((sum, c) => {
          const raw = c.ips_score ?? 50;
          const valorIPS = c.instrumento === 'sipro' ? 100 - raw : raw;
          const peso = c.total_respostas || 0;
          return sum + valorIPS * peso;
        }, 0) / totalRespostasConsolidado
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

  // Estado vazio — nenhuma campanha criada.
  // Só mostra o onboarding completo na aba "visao". Em outras abas (deep-link
  // dos submenus do sidebar), seguimos para o render normal para que cada
  // submenu mostre seu próprio empty state contextualizado.
  if (totalCampanhas === 0 && activeTab === "visao") {
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
        {activeTab === "campanhas" && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4">
            <div className="flex items-center gap-2">
              <Button id="btn-nova-campanha" onClick={handleNovaCampanha} className="gap-2 bg-purple-600 hover:bg-purple-700 text-white">
                <Plus className="h-4 w-4" />
                Nova Campanha
              </Button>
            </div>
          </div>
        )}

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Privacidade e anonimato protegidos</p>
                <p className="text-sm text-muted-foreground">
                  As respostas são anônimas e agregadas. Questionários exigem mín. 5 respostas; entrevistas guiadas são liberadas a partir de 1 resposta.
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
                <>
                  <IPSGauge score={ipsConsolidado} classificacao={ipsClassificacao} size="md" />
                  {usandoFallbackEmpresa && (
                    <div className="mt-3 w-full rounded-md border border-amber-200 bg-amber-50/70 px-2.5 py-1.5 text-[11px] text-amber-900 leading-snug">
                      <strong>Visão consolidada da empresa</strong> — categorias individuais permanecem ocultas (&lt; {MINIMO_ANONIMATO_PADRAO} respondentes). Total agregado: {totalRespostasConsolidado} respostas.
                    </div>
                  )}
                </>
              ) : (
                  <div className="flex flex-col items-center gap-2 py-4">
                    <div className="p-3 rounded-full bg-muted">
                      <Lock className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground text-center">
                      Mínimo de respostas não atingido para análise
                    </p>
                    <p className="text-xs text-muted-foreground/70 text-center">
                      Questionários: mín. 5 · Entrevistas: mín. 1
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
                    <p className="text-xs">Total acumulado. Mínimo de 5 por questionário (ou 1 por entrevista) para liberar a análise.</p>
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
                {totalRespostas >= MINIMO_ANONIMATO_PADRAO ? "✅ Análise liberada" : `Mín. ${MINIMO_ANONIMATO_PADRAO} para análise`}
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

        {/* RN-016: Índice de Confiabilidade — calculado sobre a campanha mais recente com IPS */}
        {campanhasComIPS.length > 0 && ipsConsolidado != null && (
          <IndiceConfiabilidadeCard
            campanhaId={campanhasComIPS[0].id}
            ipsScore={campanhasComIPS[0].ips_score || 50}
          />
        )}

            {/* Índices Derivados */}
            <IndicesDerivadosDashboard campanhas={campanhas} />
          </TabsContent>

          {/* Tab: Metodologia (agrupa Fatores de Riscos, Instrumentos e Índices) */}
          <TabsContent value="metodologia" className="mt-4">
            <MetodologiaPanel campanhas={campanhas} />
          </TabsContent>

          {/* Tab: GHE */}
          <TabsContent value="ghe" className="mt-4">
            <GHEPanel />
          </TabsContent>

          {/* Tab: Resultados Psicossociais (unificado: Geral + GHE + Burnout/Boreout + Histórico IPS) */}
          <TabsContent value="resultados" className="mt-4">
            <ResultadosPsicossociaisHub campanhas={campanhas} />
          </TabsContent>

          {/* Retrocompat: rotas antigas redirecionam para a Hub */}
          <TabsContent value="resultados-ghe" className="mt-4">
            <ResultadosPsicossociaisHub campanhas={campanhas} />
          </TabsContent>
          <TabsContent value="burnout-boreout" className="mt-4">
            <ResultadosPsicossociaisHub campanhas={campanhas} />
          </TabsContent>
          <TabsContent value="historico" className="mt-4 space-y-4">
            <ResultadosPsicossociaisHub campanhas={campanhas} />
          </TabsContent>

          {/* Tab: Campanhas */}
          <TabsContent value="campanhas" className="mt-4">
            <CampanhaList 
              campanhas={campanhas} 
              onNovaCampanha={handleNovaCampanha} 
              onEditarCampanha={handleEditarCampanha} 
            />
          </TabsContent>


          {/* Tab: Inventário PGR */}
          <TabsContent value="pgr" className="mt-4 space-y-4">
            <InventarioPGR campanhas={campanhasEnriquecidas} />
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
