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
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Target className="w-7 h-7 text-primary" />
            PDI — Plano de Desenvolvimento Individual
          </h1>
          <p className="text-muted-foreground mt-1">
            Estruture metas, ações e acompanhamentos para o crescimento de cada colaborador.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} size="lg" className="gap-2 shadow-md">
          <Plus className="w-4 h-4" /> Criar novo PDI
        </Button>
      </motion.div>

      {/* Banner: O que é PDI */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-info/5">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                <Lightbulb className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-foreground mb-1">O que é o PDI e para que serve?</h2>
                <p className="text-sm text-muted-foreground">
                  O Plano de Desenvolvimento Individual organiza, em um único lugar,{" "}
                  <strong className="text-foreground">o que cada colaborador precisa desenvolver</strong>,{" "}
                  <strong className="text-foreground">como vai desenvolver</strong> e{" "}
                  <strong className="text-foreground">em quanto tempo</strong>. Use-o para alinhar expectativas,
                  registrar evoluções e garantir que o desenvolvimento aconteça de forma estruturada.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Passo a passo */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {[
          { icon: UserPlus, title: "1. Crie um PDI", desc: "Selecione o colaborador, defina período (trimestral, semestral ou anual) e responsáveis." },
          { icon: Target, title: "2. Adicione metas SMART", desc: "Específicas, mensuráveis, atingíveis, relevantes e com prazo. Use a I.A. para sugestões." },
          { icon: ListChecks, title: "3. Defina ações", desc: "Quebre cada meta em tarefas, hábitos, treinamentos ou mentorias com prazos claros." },
          { icon: CalendarCheck, title: "4. Faça check-ins", desc: "Registre avanços, bloqueios e evidências. Acompanhe o progresso em tempo real." },
        ].map((s) => (
          <Card key={s.title} className="hover:shadow-md transition-shadow border-l-4 border-l-primary/40">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                  <s.icon className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-sm text-foreground">{s.title}</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Stats */}
      <PdiStats
        pdisAtivos={pdi.pdisAtivos}
        pdisConcluidos={pdi.pdisConcluidos}
        totalMetas={pdi.totalMetas}
        metasConcluidas={pdi.metasConcluidas}
        progressoMedio={pdi.progressoMedio}
      />

      {/* FAQ */}
      <Accordion type="single" collapsible className="bg-muted/30 rounded-lg border px-4">
        <AccordionItem value="faq" className="border-0">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">
            <span className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-primary" /> Dúvidas frequentes sobre o PDI
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 text-sm text-muted-foreground pb-4">
            <div>
              <p className="font-medium text-foreground">Quando devo criar um PDI?</p>
              <p>Ao admitir um novo colaborador, após avaliação de desempenho, em mudança de função ou sempre que identificar uma lacuna de competência.</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Quem participa?</p>
              <p>O colaborador (protagonista), o gestor direto (responsável) e, opcionalmente, um co-responsável (RH, mentor ou padrinho).</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Com que frequência fazer check-ins?</p>
              <p>Recomendamos check-ins <strong>quinzenais ou mensais</strong>. Anote avanços, bloqueios e o próximo passo de cada meta.</p>
            </div>
            <div>
              <p className="font-medium text-foreground">O que é uma meta SMART?</p>
              <p><strong>S</strong>pecífica · <strong>M</strong>ensurável · <strong>A</strong>tingível · <strong>R</strong>elevante · <strong>T</strong>emporal. Ex.: "Concluir curso de Excel avançado com nota ≥ 80% até 30/06".</p>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

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
