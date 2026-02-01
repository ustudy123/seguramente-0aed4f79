import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Activity, 
  RefreshCw,
  FileDown,
  Plus,
  AlertTriangle,
  ClipboardCheck,
  Brain,
  Dumbbell,
  Building2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useErgonomia } from "@/hooks/useErgonomia";
import { ErgonomiaStats } from "@/components/ergonomia/ErgonomiaStats";
import { CategoriaCard } from "@/components/ergonomia/CategoriaCard";
import { ItemDetailModal } from "@/components/ergonomia/ItemDetailModal";
import { EmptyState } from "@/components/ergonomia/EmptyState";
import { RiscoForm } from "@/components/ergonomia/RiscoForm";
import { RiscosList } from "@/components/ergonomia/RiscosList";
import { AcaoForm } from "@/components/ergonomia/AcaoForm";
import { AcoesList } from "@/components/ergonomia/AcoesList";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ITENS_NR17_PADRAO,
  type ItemNR17,
  type ErgonomiaStatus,
  type ErgonomiaCategoria,
  type AcaoStatus
} from "@/types/ergonomia";

const CATEGORIAS_ORDENADAS: ErgonomiaCategoria[] = [
  'organizacao_trabalho',
  'mobiliario',
  'equipamentos',
  'condicoes_ambientais',
  'levantamento_cargas',
  'aet'
];

export default function Ergonomia() {
  const [selectedItem, setSelectedItem] = useState<ItemNR17 | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [showRiscoForm, setShowRiscoForm] = useState(false);
  const [showAcaoForm, setShowAcaoForm] = useState(false);
  
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

  if (isLoadingItens) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
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
          <p className="text-muted-foreground mt-1">
            Governança ergonômica e conformidade com a NR-17
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => refetchItens()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button variant="outline" size="sm">
            <FileDown className="h-4 w-4 mr-2" />
            Exportar Relatório
          </Button>
        </div>
      </motion.div>

      {itensNR17.length === 0 ? (
        <EmptyState onInitialize={handleInitialize} isInitializing={isInitializing} />
      ) : (
        <>
          {/* Estatísticas */}
          <ErgonomiaStats
            estatisticas={estatisticas}
            percentualConformidade={percentualConformidade}
            nivelMaturidade={nivelMaturidade}
          />

          {/* Tabs principais */}
          <Tabs defaultValue="conformidade" className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <TabsList>
                <TabsTrigger value="conformidade" className="gap-2">
                  <Activity className="h-4 w-4" />
                  Conformidade NR-17
                </TabsTrigger>
                <TabsTrigger value="riscos" className="gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Riscos ({riscos.length})
                </TabsTrigger>
                <TabsTrigger value="acoes" className="gap-2">
                  <ClipboardCheck className="h-4 w-4" />
                  Plano de Ação ({acoes.length})
                </TabsTrigger>
              </TabsList>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowRiscoForm(true)}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Novo Risco
                </Button>
                <Button 
                  size="sm"
                  onClick={() => setShowAcaoForm(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Ação
                </Button>
              </div>
            </div>

            {/* Tab: Conformidade NR-17 */}
            <TabsContent value="conformidade" className="space-y-4">
              <Tabs defaultValue="todos" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="todos" className="gap-2">
                    <Activity className="h-4 w-4" />
                    Todos os Itens
                  </TabsTrigger>
                  <TabsTrigger value="fisico" className="gap-2">
                    <Dumbbell className="h-4 w-4" />
                    Eixo Físico
                  </TabsTrigger>
                  <TabsTrigger value="cognitivo" className="gap-2">
                    <Brain className="h-4 w-4" />
                    Eixo Cognitivo
                  </TabsTrigger>
                  <TabsTrigger value="organizacional" className="gap-2">
                    <Building2 className="h-4 w-4" />
                    Eixo Organizacional
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="todos" className="space-y-4">
                  {CATEGORIAS_ORDENADAS.map((categoria) => {
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
                </TabsContent>

                <TabsContent value="fisico" className="space-y-4">
                  {(['mobiliario', 'equipamentos', 'levantamento_cargas', 'condicoes_ambientais'] as ErgonomiaCategoria[]).map((categoria) => {
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
                </TabsContent>

                <TabsContent value="cognitivo" className="space-y-4">
                  {(['aet'] as ErgonomiaCategoria[]).map((categoria) => {
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
                </TabsContent>

                <TabsContent value="organizacional" className="space-y-4">
                  {(['organizacao_trabalho'] as ErgonomiaCategoria[]).map((categoria) => {
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
                </TabsContent>
              </Tabs>
            </TabsContent>

            {/* Tab: Riscos */}
            <TabsContent value="riscos" className="space-y-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {isLoadingRiscos ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-32" />
                    ))}
                  </div>
                ) : (
                  <RiscosList riscos={riscos} />
                )}
              </motion.div>
            </TabsContent>

            {/* Tab: Plano de Ação */}
            <TabsContent value="acoes" className="space-y-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {isLoadingAcoes ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-32" />
                    ))}
                  </div>
                ) : (
                  <AcoesList 
                    acoes={acoes} 
                    onUpdateStatus={handleUpdateAcaoStatus}
                  />
                )}
              </motion.div>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Modal de Detalhes do Item */}
      <ItemDetailModal
        item={selectedItem}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onSave={handleSaveItem}
        isSaving={isUpdatingStatus}
      />

      {/* Modal de Novo Risco */}
      <RiscoForm
        open={showRiscoForm}
        onOpenChange={setShowRiscoForm}
        onSubmit={createRisco}
        itensNR17={itensNR17}
        isLoading={isCreatingRisco}
      />

      {/* Modal de Nova Ação */}
      <AcaoForm
        open={showAcaoForm}
        onOpenChange={setShowAcaoForm}
        onSubmit={createAcao}
        riscos={riscos}
        itensNR17={itensNR17}
        isLoading={isCreatingAcao}
      />
    </div>
  );
}
