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

  const nivelTabs = [
    { value: "estrategica", label: "Estratégicas", icon: Layers, nivel: "estrategica" as MetaNivel },
    { value: "unidade", label: "Unidade", icon: Building2, nivel: "unidade" as MetaNivel },
    { value: "setor", label: "Setor", icon: Users, nivel: "setor" as MetaNivel },
    { value: "individual", label: "Individual", icon: User, nivel: "individual" as MetaNivel },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Target className="w-7 h-7 text-primary" />
            Metas
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestão inteligente de metas estratégicas, por unidade, setor e individual
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowGuia(true)} className="gap-1.5">
            <BookOpen className="h-4 w-4" />
            Guia Rápido
          </Button>
          <Button id="btn-nova-meta" onClick={() => openForm(tab === "dashboard" || tab === "consolidacao" || tab === "chat" || tab === "indicadores" || tab === "config" ? "estrategica" : (tab as MetaNivel))} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Nova Meta
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger id="tab-metas-dashboard" value="dashboard" className="gap-1">
            <BarChart3 className="w-4 h-4" /> Dashboard
          </TabsTrigger>
          {nivelTabs.map(t => (
            <TabsTrigger key={t.value} id={`tab-metas-${t.value}`} value={t.value} className="gap-1">
              <t.icon className="w-4 h-4" /> {t.label}
              {filteredByNivel(t.nivel).length > 0 && (
                <span className="ml-1 text-[10px] bg-muted px-1.5 rounded-full">
                  {filteredByNivel(t.nivel).length}
                </span>
              )}
            </TabsTrigger>
          ))}
          <TabsTrigger id="tab-metas-consolidacao" value="consolidacao" className="gap-1">
            <Calculator className="w-4 h-4" /> Consolidação
          </TabsTrigger>
          <TabsTrigger id="tab-metas-chat" value="chat" className="gap-1">
            <MessageSquare className="w-4 h-4" /> Assistente IA
          </TabsTrigger>
          {podeVerConfiguracoes && (
            <>
              <TabsTrigger id="tab-metas-indicadores" value="indicadores" className="gap-1">
                <BarChart3 className="w-4 h-4" /> Indicadores
              </TabsTrigger>
              <TabsTrigger id="tab-metas-config" value="config" className="gap-1">
                <Settings className="w-4 h-4" /> Configurações
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Dashboard */}
        <TabsContent value="dashboard">
          <div className="space-y-6">
            <MetasDashboard metas={metas} stats={stats} />
            <MetasConsistenciaPanel metas={metas} />
          </div>
        </TabsContent>

        {/* Tabs por nível */}
        {nivelTabs.map(t => (
          <TabsContent key={t.value} value={t.value}>
            <MetasListView
              metas={filteredByNivel(t.nivel)}
              nivel={t.nivel}
              onEdit={handleEdit}
              onDelete={(id) => deleteMeta(id)}
              onWorkflow={(id, status) => alterarWorkflow({ id, novoStatus: status })}
              onDesdobrar={(meta) => setDesdobramentoMeta(meta)}
              onDetail={(meta) => setDetailMeta(meta)}
              onCheckin={(meta) => setDetailMeta(meta)}
            />
          </TabsContent>
        ))}

        {/* Consolidação */}
        <TabsContent value="consolidacao">
          <MetasConsolidacaoPanel metas={metas} />
        </TabsContent>

        {/* Chat IA */}
        <TabsContent value="chat">
          <MetasChatAssistente metas={metas} />
        </TabsContent>

        {/* Indicadores */}
        <TabsContent value="indicadores">
          <MetasIndicadoresConfig />
        </TabsContent>

        {/* Configurações */}
        <TabsContent value="config">
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

      {/* Detail Dialog */}
      <MetaDetailModuleDialog
        meta={detailMeta}
        open={!!detailMeta}
        onOpenChange={(open) => !open && setDetailMeta(null)}
        onCheckin={criarCheckin}
        onAddEvidencia={criarEvidencia}
      />

      {/* Desdobramento Dialog */}
      <DesdobramentoDialog
        meta={desdobramentoMeta}
        open={!!desdobramentoMeta}
        onOpenChange={(open) => !open && setDesdobramentoMeta(null)}
        onDesdobrar={(metaId, nivelDestino) => desdobrarMeta({ metaId, nivelDestino })}
        onCriarMetas={handleDesdobrarConfirm}
        isDesdobrando={isDesdobrando}
      />

      {/* Guia Rápido */}
      <GuiaRapidoMetas open={showGuia} onOpenChange={setShowGuia} />
    </motion.div>
  );
}
