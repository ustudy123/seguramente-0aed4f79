import { useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  RefreshCw,
  Plus,
  AlertTriangle,
  ClipboardCheck,
  Brain,
  Building2,
  Sparkles,
  BookOpen,
  FileText,
  ShieldCheck,
  ChevronRight,
  Dumbbell,
  Database,
  Map,
  BarChart3,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useErgonomia } from "@/hooks/useErgonomia";
import { useErgonomiaInteligente } from "@/hooks/useErgonomiaInteligente";
import { useErgonomiaAnalises } from "@/hooks/useErgonomiaAnalises";
import { ErgonomiaStats } from "@/components/ergonomia/ErgonomiaStats";
import { CategoriaCard } from "@/components/ergonomia/CategoriaCard";
import { ItemDetailModal } from "@/components/ergonomia/ItemDetailModal";
import { EmptyState } from "@/components/ergonomia/EmptyState";
import { RiscoForm } from "@/components/ergonomia/RiscoForm";
import { RiscosList } from "@/components/ergonomia/RiscosList";
import { AcaoForm } from "@/components/ergonomia/AcaoForm";
import { AcoesList } from "@/components/ergonomia/AcoesList";
import { HubServicos } from "@/components/ergonomia/HubServicos";
import { AnaliseIASection } from "@/components/ergonomia/AnaliseIASection";
import { RegistrosErgonomicos } from "@/components/ergonomia/RegistrosErgonomicos";
import { MapaRiscoErgonomico } from "@/components/ergonomia/MapaRiscoErgonomico";
import { InventarioRiscos } from "@/components/ergonomia/InventarioRiscos";
import { AnaliseLERDORT } from "@/components/ergonomia/AnaliseLERDORT";
import { AEPGenerator } from "@/components/ergonomia/aep/AEPGenerator";
import { AEPGeneratorMulti } from "@/components/ergonomia/aep/AEPGeneratorMulti";
import {
  ITENS_NR17_PADRAO,
  MATURIDADE_LABELS,
  MATURIDADE_COLORS,
  type ItemNR17,
  type ErgonomiaStatus,
  type ErgonomiaCategoria,
  type AcaoStatus,
} from "@/types/ergonomia";

const CATEGORIAS_ORDENADAS: ErgonomiaCategoria[] = [
  "organizacao_trabalho",
  "mobiliario",
  "equipamentos",
  "condicoes_ambientais",
  "levantamento_cargas",
  "aet",
];

export default function Ergonomia() {
  const [selectedItem, setSelectedItem] = useState<ItemNR17 | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [showRiscoForm, setShowRiscoForm] = useState(false);
  const [showAcaoForm, setShowAcaoForm] = useState(false);
  const [showConformidade, setShowConformidade] = useState(false);
  const [conformidadeEixo, setConformidadeEixo] = useState<"todos" | "fisico" | "cognitivo" | "organizacional">("todos");
  const [aepMode, setAepMode] = useState<"simples" | "multi">("simples");

  const {
    itensNR17,
    riscos,
    acoes,
    itensPorCategoria,
    estatisticas,
    percentualConformidade,
    nivelMaturidade,
    isLoadingItens,
    isLoadingRiscos,
    isLoadingAcoes,
    initializeItens,
    updateItemStatus,
    createRisco,
    createAcao,
    updateAcaoStatus,
    isInitializing,
    isUpdatingStatus,
    isCreatingRisco,
    isCreatingAcao,
    refetchItens,
  } = useErgonomia();

  const { analises, isLoading: isLoadingAnalises, stats, mapaRiscos, analiseLERDORT, arquivarAnalise } =
    useErgonomiaAnalises();

  const handleViewItem = (item: ItemNR17) => {
    setSelectedItem(item);
    setIsDetailOpen(true);
  };

  const handleUpdateStatus = async (id: string, status: ErgonomiaStatus) => {
    await updateItemStatus({ id, status });
  };

  const handleSaveItem = async (id: string, status: ErgonomiaStatus, observacoes?: string) => {
    await updateItemStatus({ id, status, observacoes });
  };

  const handleInitialize = async () => {
    await initializeItens(ITENS_NR17_PADRAO);
  };

  const handleUpdateAcaoStatus = async (id: string, status: AcaoStatus) => {
    await updateAcaoStatus({ id, status });
  };

  const openConformidade = (eixo?: "todos" | "fisico" | "cognitivo" | "organizacional") => {
    setConformidadeEixo(eixo || "todos");
    setShowConformidade(true);
  };

  if (isLoadingItens) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const categoriasEixo: Record<string, ErgonomiaCategoria[]> = {
    todos: CATEGORIAS_ORDENADAS,
    fisico: ["mobiliario", "equipamentos", "levantamento_cargas", "condicoes_ambientais"],
    cognitivo: ["aet"],
    organizacional: ["organizacao_trabalho"],
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity className="h-7 w-7 text-primary" />
            Ergonomia Inteligente
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Análise ergonômica integrada — identificação, registro e gestão de riscos
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetchItens()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowRiscoForm(true)}>
            <AlertTriangle className="h-4 w-4 mr-2" />
            Novo Risco
          </Button>
          <Button size="sm" onClick={() => setShowAcaoForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Ação
          </Button>
        </div>
      </motion.div>

      {/* ── Indicadores da Base Ergonômica ── */}
      {stats.totalAnalises > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border-border/50">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <Database className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Análises Realizadas</span>
                </div>
                <p className="text-2xl font-bold">{stats.totalAnalises}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Postos Avaliados</span>
                </div>
                <p className="text-2xl font-bold">{stats.postosAvaliados}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span className="text-xs text-muted-foreground">Riscos Identificados</span>
                </div>
                <p className="text-2xl font-bold text-destructive">{stats.totalRiscosIdentificados}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Conformidade Média</span>
                </div>
                <p className="text-2xl font-bold">{stats.conformidadeMedia}%</p>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}

      {itensNR17.length === 0 ? (
        <EmptyState onInitialize={handleInitialize} isInitializing={isInitializing} />
      ) : (
        <>
          {/* ── Card de Conformidade NR-17 ── */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card
              className="border-border/50 cursor-pointer hover:shadow-md transition-all group"
              onClick={() => openConformidade("todos")}
            >
              <CardContent className="py-4 px-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="p-2.5 rounded-lg bg-primary/10 shrink-0">
                      <ShieldCheck className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-semibold text-sm text-foreground">Conformidade NR-17</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${MATURIDADE_COLORS[nivelMaturidade]}`}>
                          {MATURIDADE_LABELS[nivelMaturidade]}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <Progress value={percentualConformidade} className="h-1.5 w-36 md:w-56" />
                        <span className="text-xs text-muted-foreground">{percentualConformidade}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="hidden md:flex items-center gap-6 text-sm shrink-0">
                    <div className="text-center">
                      <p className="font-bold text-success">{estatisticas.atendidos}</p>
                      <p className="text-[11px] text-muted-foreground">Atendidos</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-warning">{estatisticas.parciais}</p>
                      <p className="text-[11px] text-muted-foreground">Parciais</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-destructive">{estatisticas.naoAtendidos}</p>
                      <p className="text-[11px] text-muted-foreground">Não Atend.</p>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-primary shrink-0 group-hover:bg-primary/10"
                    onClick={(e) => { e.stopPropagation(); openConformidade("todos"); }}
                  >
                    Ver itens <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {(estatisticas.riscosCriticos > 0 || estatisticas.acoesPendentes > 0) && (
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50 flex-wrap">
                    {estatisticas.riscosCriticos > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {estatisticas.riscosCriticos} risco(s) crítico(s)
                      </div>
                    )}
                    {estatisticas.acoesPendentes > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-warning">
                        <ClipboardCheck className="h-3.5 w-3.5" />
                        {estatisticas.acoesPendentes} ação(ões) pendente(s)
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* ── Tabs Principais ── */}
          <Tabs defaultValue="analise_ia" className="space-y-4">
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="analise_ia" className="gap-2">
                <Brain className="h-4 w-4" />
                Análise por IA
              </TabsTrigger>
              <TabsTrigger value="registros" className="gap-2">
                <Database className="h-4 w-4" />
                Base Ergonômica
                {stats.totalAnalises > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{stats.totalAnalises}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="mapa" className="gap-2">
                <Map className="h-4 w-4" />
                Mapa de Risco
              </TabsTrigger>
              <TabsTrigger value="inventario" className="gap-2">
                <ClipboardCheck className="h-4 w-4" />
                Inventário de Riscos
              </TabsTrigger>
              <TabsTrigger value="ler_dort" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                LER/DORT
              </TabsTrigger>
              <TabsTrigger value="aep" className="gap-2">
                <FileText className="h-4 w-4" />
                Gerar AEP
              </TabsTrigger>
              <TabsTrigger value="riscos" className="gap-2">
                <AlertTriangle className="h-4 w-4" />
                Riscos NR-17
                {riscos.length > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{riscos.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="acoes" className="gap-2">
                <Zap className="h-4 w-4" />
                Plano de Ação
                {acoes.length > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{acoes.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="hub" className="gap-2">
                <BookOpen className="h-4 w-4" />
                Hub de Serviços
              </TabsTrigger>
            </TabsList>

            {/* Análise por IA */}
            <TabsContent value="analise_ia">
              <AnaliseIASection />
            </TabsContent>

            {/* Base Ergonômica - Registros */}
            <TabsContent value="registros">
              <RegistrosErgonomicos
                analises={analises}
                onArquivar={arquivarAnalise}
              />
            </TabsContent>

            {/* Mapa de Risco Ergonômico */}
            <TabsContent value="mapa">
              <MapaRiscoErgonomico mapaRiscos={mapaRiscos} />
            </TabsContent>

            {/* Inventário de Riscos */}
            <TabsContent value="inventario">
              <InventarioRiscos analises={analises} />
            </TabsContent>

            {/* LER/DORT */}
            <TabsContent value="ler_dort">
              <AnaliseLERDORT analiseLERDORT={analiseLERDORT} />
            </TabsContent>

            {/* Gerar AEP */}
            <TabsContent value="aep" className="space-y-4">
              <div className="flex items-center gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
                <span className="text-sm font-medium">Modo de Geração:</span>
                <div className="flex gap-2">
                  <Button
                    variant={aepMode === "simples" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAepMode("simples")}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Função Única
                  </Button>
                  <Button
                    variant={aepMode === "multi" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAepMode("multi")}
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    Multi-Setor
                  </Button>
                </div>
              </div>
              {aepMode === "simples" ? <AEPGenerator /> : <AEPGeneratorMulti />}
            </TabsContent>

            {/* Riscos NR-17 */}
            <TabsContent value="riscos" className="space-y-4">
              {isLoadingRiscos ? (
                <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}</div>
              ) : (
                <RiscosList riscos={riscos} />
              )}
            </TabsContent>

            {/* Plano de Ação */}
            <TabsContent value="acoes" className="space-y-4">
              {isLoadingAcoes ? (
                <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}</div>
              ) : (
                <AcoesList acoes={acoes} onUpdateStatus={handleUpdateAcaoStatus} />
              )}
            </TabsContent>

            {/* Hub de Serviços */}
            <TabsContent value="hub">
              <HubServicos />
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* ══ Sheet: Conformidade NR-17 ══ */}
      <Sheet open={showConformidade} onOpenChange={setShowConformidade}>
        <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Conformidade NR-17
            </SheetTitle>
            <SheetDescription>
              Itens normativos avaliados — {percentualConformidade}% de conformidade
            </SheetDescription>
            <Tabs
              value={conformidadeEixo}
              onValueChange={(v) => setConformidadeEixo(v as typeof conformidadeEixo)}
              className="mt-3"
            >
              <TabsList className="w-full">
                <TabsTrigger value="todos" className="flex-1 gap-1.5 text-xs">
                  <Activity className="h-3.5 w-3.5" /> Todos
                </TabsTrigger>
                <TabsTrigger value="fisico" className="flex-1 gap-1.5 text-xs">
                  <Dumbbell className="h-3.5 w-3.5" /> Físico
                </TabsTrigger>
                <TabsTrigger value="cognitivo" className="flex-1 gap-1.5 text-xs">
                  <Brain className="h-3.5 w-3.5" /> Cognitivo
                </TabsTrigger>
                <TabsTrigger value="organizacional" className="flex-1 gap-1.5 text-xs">
                  <Building2 className="h-3.5 w-3.5" /> Organizacional
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {categoriasEixo[conformidadeEixo].map((categoria) => {
              const itens = itensPorCategoria[categoria] || [];
              if (itens.length === 0) return null;
              return (
                <CategoriaCard
                  key={categoria}
                  categoria={categoria}
                  itens={itens}
                  onUpdateStatus={handleUpdateStatus}
                  onViewItem={handleViewItem}
                />
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* Modais */}
      <ItemDetailModal
        item={selectedItem}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onSave={handleSaveItem}
      />
      <RiscoForm
        open={showRiscoForm}
        onOpenChange={setShowRiscoForm}
        onSubmit={async (data) => {
          await createRisco(data);
          setShowRiscoForm(false);
        }}
        isLoading={isCreatingRisco}
      />
      <AcaoForm
        open={showAcaoForm}
        onOpenChange={setShowAcaoForm}
        onSubmit={async (data) => {
          await createAcao(data);
          setShowAcaoForm(false);
        }}
        isLoading={isCreatingAcao}
      />
    </div>
  );
}
