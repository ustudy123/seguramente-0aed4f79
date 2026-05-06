import { useState } from "react";
import { motion } from "framer-motion";
import {
  Target, BarChart3, Layers, Building2, Users, User,
  Plus, Settings, Sparkles, MessageSquare, Calculator, BookOpen,
  ListChecks, LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useMetasModule } from "@/hooks/useMetasModule";
import { MetasDashboard } from "@/components/metas/MetasDashboard";
import { MetasListView } from "@/components/metas/MetasListView";
import { MetaFormModule } from "@/components/metas/MetaFormModule";
import { MetaDetailModuleDialog } from "@/components/metas/MetaDetailModuleDialog";
import { DesdobramentoDialog } from "@/components/metas/DesdobramentoDialog";
import { MetasConfig } from "@/components/metas/MetasConfig";
import { MetasIndicadoresConfig } from "@/components/metas/MetasIndicadoresConfig";
import { MetasConsistenciaPanel } from "@/components/metas/MetasConsistenciaPanel";
import { MetasConsolidacaoPanel } from "@/components/metas/MetasConsolidacaoPanel";
import { MetasChatAssistente } from "@/components/metas/MetasChatAssistente";
import { GuiaRapidoMetas } from "@/components/metas/GuiaRapidoMetas";
import type { MetaCompleta, MetaNivel } from "@/types/metas-module";
import { useAvaliacaoPermissoes } from "@/hooks/useAvaliacaoPermissoes";

export default function Metas() {
  const [tab, setTab] = useState("dashboard");
  const [nivelFiltro, setNivelFiltro] = useState<MetaNivel | "todas">("todas");
  const { metas, isLoading, createMeta, updateMeta, deleteMeta, alterarWorkflow, criarCheckin, criarEvidencia, desdobrarMeta, isDesdobrando, configuracao, salvarConfig, stats, isCreating } = useMetasModule();
  const [showForm, setShowForm] = useState(false);
  const [formNivel, setFormNivel] = useState<MetaNivel>("individual");
  const [editingMeta, setEditingMeta] = useState<MetaCompleta | null>(null);
  const [detailMeta, setDetailMeta] = useState<MetaCompleta | null>(null);
  const [desdobramentoMeta, setDesdobramentoMeta] = useState<MetaCompleta | null>(null);
  const [showGuia, setShowGuia] = useState(false);

  const { podeVerConfiguracoes } = useAvaliacaoPermissoes();

  const openForm = (nivel: MetaNivel) => {
    setFormNivel(nivel);
    setEditingMeta(null);
    setShowForm(true);
  };

  const handleSave = async (data: Partial<MetaCompleta>) => {
    if (editingMeta) {
      await updateMeta({ id: editingMeta.id, ...data });
    } else {
      await createMeta(data);
    }
    setShowForm(false);
    setEditingMeta(null);
  };

  const handleEdit = (meta: MetaCompleta) => {
    setEditingMeta(meta);
    setFormNivel(meta.nivel);
    setShowForm(true);
  };

  const handleDesdobrarConfirm = async (metasCriar: Partial<MetaCompleta>[]) => {
    for (const m of metasCriar) {
      await createMeta(m);
    }
  };

  const filteredByNivel = (nivel: MetaNivel) => metas.filter(m => m.nivel === nivel);
  const metasFiltradas = nivelFiltro === "todas" ? metas : metas.filter(m => m.nivel === nivelFiltro);

  const niveis = [
    { value: "estrategica" as MetaNivel, label: "Metas Estratégicas", labelCurto: "Estratégicas", icon: Layers, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/30", border: "border-purple-300 dark:border-purple-800" },
    { value: "unidade" as MetaNivel, label: "Metas por Unidade", labelCurto: "Unidade", icon: Building2, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-300 dark:border-blue-800" },
    { value: "setor" as MetaNivel, label: "Metas por Setor", labelCurto: "Setor", icon: Users, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-300 dark:border-amber-800" },
    { value: "individual" as MetaNivel, label: "Metas Individuais", labelCurto: "Individual", icon: User, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-300 dark:border-emerald-800" },
  ];

  const novaMetaNivel: MetaNivel = nivelFiltro !== "todas" ? nivelFiltro : "estrategica";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Target className="w-7 h-7 text-primary" />
            Metas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Planeje, acompanhe e desdobre metas em todos os níveis da organização
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowGuia(true)} className="gap-1.5">
            <BookOpen className="h-4 w-4" />
            Guia
          </Button>
          <Button id="btn-nova-meta" size="sm" onClick={() => openForm(novaMetaNivel)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Nova Meta
          </Button>
        </div>
      </div>

      {/* Tabs principais simplificadas */}
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap border-b">
          <TabsList className="bg-transparent p-0 h-auto gap-1">
            <TabsTrigger
              id="tab-metas-dashboard"
              value="dashboard"
              className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2"
            >
              <BarChart3 className="w-4 h-4" /> Visão Geral
            </TabsTrigger>
            <TabsTrigger
              id="tab-metas-lista"
              value="lista"
              className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2"
            >
              <ListChecks className="w-4 h-4" /> Minhas Metas
              {metas.length > 0 && (
                <span className="ml-1 text-[10px] bg-muted px-1.5 rounded-full">{metas.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger
              id="tab-metas-consolidacao"
              value="consolidacao"
              className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2"
            >
              <Calculator className="w-4 h-4" /> Consolidação
            </TabsTrigger>
            <TabsTrigger
              id="tab-metas-chat"
              value="chat"
              className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2"
            >
              <Sparkles className="w-4 h-4" /> Assistente IA
            </TabsTrigger>
          </TabsList>

          {podeVerConfiguracoes && (
            <div className="flex items-center gap-1 pb-1">
              <Button
                variant={tab === "indicadores" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setTab("indicadores")}
                className="gap-1.5 h-8"
              >
                <BarChart3 className="w-4 h-4" /> Indicadores
              </Button>
              <Button
                variant={tab === "config" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setTab("config")}
                className="gap-1.5 h-8"
              >
                <Settings className="w-4 h-4" /> Configurações
              </Button>
            </div>
          )}
        </div>

        {/* Visão Geral */}
        <TabsContent value="dashboard" className="space-y-5 mt-0">
          {/* Cards rápidos por nível */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {niveis.map(n => {
              const count = filteredByNivel(n.value).length;
              const Icon = n.icon;
              return (
                <button
                  key={n.value}
                  onClick={() => { setNivelFiltro(n.value); setTab("lista"); }}
                  className={cn(
                    "text-left p-4 rounded-xl border-2 transition-all hover:shadow-md hover:-translate-y-0.5",
                    n.bg, n.border,
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Icon className={cn("h-5 w-5", n.color)} />
                    <span className={cn("text-2xl font-bold", n.color)}>{count}</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{n.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {count === 0 ? "Nenhuma meta" : count === 1 ? "1 meta cadastrada" : `${count} metas cadastradas`}
                  </p>
                </button>
              );
            })}
          </div>

          <MetasDashboard metas={metas} stats={stats} />
          <MetasConsistenciaPanel metas={metas} />
        </TabsContent>

        {/* Lista unificada com filtro por nível */}
        <TabsContent value="lista" className="space-y-4 mt-0">
          {/* Filtro segmentado de nível */}
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-muted-foreground mr-1">Filtrar por nível:</span>
                <button
                  onClick={() => setNivelFiltro("todas")}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                    nivelFiltro === "todas"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-border",
                  )}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  Todas
                  <span className="ml-0.5 text-[10px] opacity-80">({metas.length})</span>
                </button>
                {niveis.map(n => {
                  const Icon = n.icon;
                  const active = nivelFiltro === n.value;
                  const count = filteredByNivel(n.value).length;
                  return (
                    <button
                      key={n.value}
                      onClick={() => setNivelFiltro(n.value)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                        active
                          ? cn(n.bg, n.border, n.color, "border-2")
                          : "bg-background hover:bg-muted border-border text-foreground",
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {n.label}
                      <span className="ml-0.5 text-[10px] opacity-80">({count})</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <MetasListView
            metas={metasFiltradas}
            nivel={nivelFiltro === "todas" ? undefined : nivelFiltro}
            onEdit={handleEdit}
            onDelete={(id) => deleteMeta(id)}
            onWorkflow={(id, status) => alterarWorkflow({ id, novoStatus: status })}
            onDesdobrar={(meta) => setDesdobramentoMeta(meta)}
            onDetail={(meta) => setDetailMeta(meta)}
            onCheckin={(meta) => setDetailMeta(meta)}
          />
        </TabsContent>

        <TabsContent value="consolidacao" className="mt-0">
          <MetasConsolidacaoPanel metas={metas} />
        </TabsContent>

        <TabsContent value="chat" className="mt-0">
          <MetasChatAssistente metas={metas} />
        </TabsContent>

        <TabsContent value="indicadores" className="mt-0">
          <MetasIndicadoresConfig />
        </TabsContent>

        <TabsContent value="config" className="mt-0">
          <MetasConfig configuracao={configuracao || null} onSave={salvarConfig} />
        </TabsContent>
      </Tabs>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="w-full max-w-2xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b">
            <DialogTitle>{editingMeta ? "Editar Meta" : "Nova Meta"}</DialogTitle>
            <DialogDescription>
              {editingMeta ? "Atualize os dados da meta" : "Defina os dados da meta com apoio de IA"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <MetaFormModule
              nivel={formNivel}
              initialData={editingMeta || undefined}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditingMeta(null); }}
              isSaving={isCreating}
            />
          </div>
        </DialogContent>
      </Dialog>

      <MetaDetailModuleDialog
        meta={detailMeta}
        open={!!detailMeta}
        onOpenChange={(open) => !open && setDetailMeta(null)}
        onCheckin={criarCheckin}
        onAddEvidencia={criarEvidencia}
      />

      <DesdobramentoDialog
        meta={desdobramentoMeta}
        open={!!desdobramentoMeta}
        onOpenChange={(open) => !open && setDesdobramentoMeta(null)}
        onDesdobrar={(metaId, nivelDestino) => desdobrarMeta({ metaId, nivelDestino })}
        onCriarMetas={handleDesdobrarConfirm}
        isDesdobrando={isDesdobrando}
      />

      <GuiaRapidoMetas open={showGuia} onOpenChange={setShowGuia} />
    </motion.div>
  );
}
