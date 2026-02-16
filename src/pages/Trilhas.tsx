import { useState } from "react";
import { motion } from "framer-motion";
import { Route } from "lucide-react";
import { TrilhaList } from "@/components/trilhas/TrilhaList";
import { TrilhaDetail } from "@/components/trilhas/TrilhaDetail";
import { TrilhaForm } from "@/components/trilhas/TrilhaForm";
import { ModuloForm } from "@/components/trilhas/ModuloForm";
import type { Trilha, TrilhaModulo } from "@/types/trilha";

export default function Trilhas() {
  const [selectedTrilha, setSelectedTrilha] = useState<Trilha | null>(null);
  const [editingTrilha, setEditingTrilha] = useState<Trilha | null>(null);
  const [showTrilhaForm, setShowTrilhaForm] = useState(false);
  const [showModuloForm, setShowModuloForm] = useState(false);
  const [editingModulo, setEditingModulo] = useState<TrilhaModulo | null>(null);

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
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10">
          <Route className="w-6 h-6 text-primary" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Trilhas</h1>
          <p className="text-sm text-muted-foreground">
            Trilhas de conhecimento e desenvolvimento contínuo
          </p>
        </div>
      </div>

      {/* Content */}
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

      {/* Forms */}
      <TrilhaForm
        open={showTrilhaForm}
        onOpenChange={setShowTrilhaForm}
        trilha={editingTrilha}
        onSuccess={() => {
          if (selectedTrilha && editingTrilha?.id === selectedTrilha.id) {
            // Refresh detail view
            setSelectedTrilha(null);
          }
        }}
      />

      {selectedTrilha && (
        <ModuloForm
          open={showModuloForm}
          onOpenChange={setShowModuloForm}
          trilhaId={selectedTrilha.id}
          modulo={editingModulo}
          nextOrdem={(selectedTrilha.total_modulos || 0)}
        />
      )}
    </motion.div>
  );
}
