import { useState } from "react";
import { motion } from "framer-motion";
import { Route, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrilhaList } from "@/components/trilhas/TrilhaList";
import { TrilhaDetail } from "@/components/trilhas/TrilhaDetail";
import { TrilhaForm } from "@/components/trilhas/TrilhaForm";
import { ModuloForm } from "@/components/trilhas/ModuloForm";
import { MinhasTrilhas } from "@/components/trilhas/MinhasTrilhas";
import { TrilhaExecucao } from "@/components/trilhas/TrilhaExecucao";
import { GamificacaoTab } from "@/components/trilhas/GamificacaoTab";
import { AnalyticsDashboard } from "@/components/trilhas/AnalyticsDashboard";
import { TrilhaNotificacoesBell } from "@/components/trilhas/TrilhaNotificacoesBell";
import type { Trilha, TrilhaModulo, TrilhaComProgresso } from "@/types/trilha";

export default function Trilhas() {
  const [selectedTrilha, setSelectedTrilha] = useState<Trilha | null>(null);
  const [editingTrilha, setEditingTrilha] = useState<Trilha | null>(null);
  const [showTrilhaForm, setShowTrilhaForm] = useState(false);
  const [showModuloForm, setShowModuloForm] = useState(false);
  const [editingModulo, setEditingModulo] = useState<TrilhaModulo | null>(null);
  const [execucaoTrilha, setExecucaoTrilha] = useState<TrilhaComProgresso | null>(null);
  const [activeTab, setActiveTab] = useState("minhas");

  const handleNewTrilha = () => {
    setEditingTrilha(null);
    setShowTrilhaForm(true);
  };

  const handleEditTrilha = (trilha: Trilha) => {
    setEditingTrilha(trilha);
    setShowTrilhaForm(true);
  };

  const handleAddModulo = () => {
    setEditingModulo(null);
    setShowModuloForm(true);
  };

  const handleEditModulo = (modulo: TrilhaModulo) => {
    setEditingModulo(modulo);
    setShowModuloForm(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Route className="w-6 h-6 text-primary" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Trilhas</h1>
            <p className="text-sm text-muted-foreground">
              Trilhas de conhecimento e desenvolvimento contínuo
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Esta tela ajuda você a seguir trilhas de aprendizado e desenvolvimento. Explore as opções para se aprimorar cada vez mais!
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <TrilhaNotificacoesBell />
          <Button onClick={handleNewTrilha} className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Trilha
          </Button>
        </div>
      </div>

      {/* Execução mode */}
      {execucaoTrilha ? (
        <TrilhaExecucao trilha={execucaoTrilha} onBack={() => setExecucaoTrilha(null)} />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 max-w-lg">
            <TabsTrigger value="minhas">Minhas Trilhas</TabsTrigger>
            <TabsTrigger value="gamificacao">Gamificação</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="gestao">Gestão</TabsTrigger>
          </TabsList>

          <TabsContent value="minhas" className="mt-6">
            <MinhasTrilhas onOpenTrilha={setExecucaoTrilha} />
          </TabsContent>

          <TabsContent value="gamificacao" className="mt-6">
            <GamificacaoTab />
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <AnalyticsDashboard />
          </TabsContent>

          <TabsContent value="gestao" className="mt-6">
            {selectedTrilha ? (
              <TrilhaDetail
                trilha={selectedTrilha}
                onBack={() => setSelectedTrilha(null)}
                onEdit={handleEditTrilha}
                onAddModulo={handleAddModulo}
                onEditModulo={handleEditModulo}
              />
            ) : (
              <TrilhaList
                onSelect={setSelectedTrilha}
                onEdit={handleEditTrilha}
                onNew={handleNewTrilha}
              />
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Forms */}
      <TrilhaForm
        open={showTrilhaForm}
        onOpenChange={setShowTrilhaForm}
        trilha={editingTrilha}
        onSuccess={() => {
          if (selectedTrilha && editingTrilha?.id === selectedTrilha.id) {
            setSelectedTrilha(null);
          }
        }}
        onManageModulos={(t) => setSelectedTrilha(t)}
      />


      {selectedTrilha && (
        <ModuloForm
          open={showModuloForm}
          onOpenChange={setShowModuloForm}
          trilhaId={selectedTrilha.id}
          modulo={editingModulo}
          nextOrdem={selectedTrilha.total_modulos || 0}
        />
      )}
    </motion.div>
  );
}
