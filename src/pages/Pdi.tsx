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
      {/* Header com gradiente 3D */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-info to-purple-600 p-6 md:p-8 shadow-[0_20px_50px_-15px_hsl(var(--primary)/0.5)]"
      >
        {/* Decorações */}
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-purple-300/20 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="text-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 shadow-lg">
                <Target className="w-7 h-7 drop-shadow" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold drop-shadow-md">
                PDI — Plano de Desenvolvimento Individual
              </h1>
            </div>
            <p className="text-white/90 text-sm md:text-base max-w-2xl">
              Estruture metas, ações e acompanhamentos para o crescimento de cada colaborador.
            </p>
          </div>
          <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.97 }}>
            <Button
              onClick={() => setShowForm(true)}
              size="lg"
              className="gap-2 bg-white text-primary hover:bg-white/95 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] font-semibold"
            >
              <Plus className="w-4 h-4" /> Criar novo PDI
            </Button>
          </motion.div>
        </div>
      </motion.div>

      {/* Banner: O que é PDI */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-rose-950/30 shadow-lg">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-300/20 rounded-full blur-3xl" />
          <CardContent className="relative p-5">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shrink-0 shadow-lg shadow-orange-500/30">
                <Lightbulb className="w-5 h-5 drop-shadow" />
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-foreground mb-1.5 text-base">O que é o PDI e para que serve?</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
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

      {/* Passo a passo com gradientes coloridos */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { icon: UserPlus, title: "1. Crie um PDI", desc: "Selecione o colaborador, defina período (trimestral, semestral ou anual) e responsáveis.", gradient: "from-violet-500 to-purple-600", glow: "shadow-violet-500/30" },
          { icon: Target, title: "2. Adicione metas SMART", desc: "Específicas, mensuráveis, atingíveis, relevantes e com prazo. Use a I.A. para sugestões.", gradient: "from-pink-500 to-rose-600", glow: "shadow-pink-500/30" },
          { icon: ListChecks, title: "3. Defina ações", desc: "Quebre cada meta em tarefas, hábitos, treinamentos ou mentorias com prazos claros.", gradient: "from-sky-500 to-cyan-600", glow: "shadow-sky-500/30" },
          { icon: CalendarCheck, title: "4. Faça check-ins", desc: "Registre avanços, bloqueios e evidências. Acompanhe o progresso em tempo real.", gradient: "from-emerald-500 to-teal-600", glow: "shadow-emerald-500/30" },
        ].map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.07, type: "spring", stiffness: 120 }}
            whileHover={{ y: -6, rotateX: 5, rotateY: -3, scale: 1.02 }}
            style={{ transformStyle: "preserve-3d", perspective: 1000 }}
          >
            <Card className={`relative overflow-hidden h-full border-0 bg-card shadow-lg ${s.glow} hover:shadow-xl transition-shadow`}>
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${s.gradient}`} />
              <CardContent className="p-4 pt-5">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className={`p-2 rounded-xl bg-gradient-to-br ${s.gradient} text-white shadow-md ${s.glow}`}>
                    <s.icon className="w-4 h-4 drop-shadow" />
                  </div>
                  <h3 className="font-bold text-sm text-foreground">{s.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
              </CardContent>
            </Card>
          </motion.div>
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
