import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Target, TrendingUp, CheckCircle2, Users, BarChart3, UserPlus, ListChecks, CalendarCheck, Sparkles, HelpCircle, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { usePdi } from "@/hooks/usePdi";
import { PdiStats } from "@/components/pdi/PdiStats";
import { PdiList } from "@/components/pdi/PdiList";
import { PdiFormModal } from "@/components/pdi/PdiFormModal";
import { PdiDetail } from "@/components/pdi/PdiDetail";
import type { Pdi } from "@/types/pdi";

const PDI = () => {
  const pdi = usePdi();
  const [showForm, setShowForm] = useState(false);
  const [selectedPdi, setSelectedPdi] = useState<Pdi | null>(null);

  if (selectedPdi) {
    const fresh = pdi.pdis.find(p => p.id === selectedPdi.id) || selectedPdi;
    return <PdiDetail pdi={fresh} onBack={() => setSelectedPdi(null)} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Target className="w-7 h-7 text-primary" />
            PDI — Plano de Desenvolvimento
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie ciclos de desenvolvimento dos colaboradores</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Novo PDI
        </Button>
      </motion.div>

      {/* Stats */}
      <PdiStats
        pdisAtivos={pdi.pdisAtivos}
        pdisConcluidos={pdi.pdisConcluidos}
        totalMetas={pdi.totalMetas}
        metasConcluidas={pdi.metasConcluidas}
        progressoMedio={pdi.progressoMedio}
      />

      {/* Tabs */}
      <Tabs defaultValue="todos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="ativos">Ativos</TabsTrigger>
          <TabsTrigger value="concluidos">Concluídos</TabsTrigger>
        </TabsList>
        <TabsContent value="todos">
          <PdiList pdis={pdi.pdis} isLoading={pdi.isLoading} onSelect={setSelectedPdi} onDelete={pdi.deletePdi} />
        </TabsContent>
        <TabsContent value="ativos">
          <PdiList pdis={pdi.pdis.filter(p => p.status === "ativo")} isLoading={pdi.isLoading} onSelect={setSelectedPdi} onDelete={pdi.deletePdi} />
        </TabsContent>
        <TabsContent value="concluidos">
          <PdiList pdis={pdi.pdis.filter(p => p.status === "concluido")} isLoading={pdi.isLoading} onSelect={setSelectedPdi} onDelete={pdi.deletePdi} />
        </TabsContent>
      </Tabs>

      {/* Form Modal */}
      <PdiFormModal open={showForm} onOpenChange={setShowForm} onCreate={pdi.createPdi} isCreating={pdi.isCreatingPdi} />
    </div>
  );
};

export default PDI;
