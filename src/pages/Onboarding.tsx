import { useState } from "react";
import { motion } from "framer-motion";
import { UserPlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OnboardingTemplateList } from "@/components/onboarding/OnboardingTemplateList";
import { OnboardingTemplateForm } from "@/components/onboarding/OnboardingTemplateForm";
import { OnboardingTemplateDetail } from "@/components/onboarding/OnboardingTemplateDetail";
import { OnboardingProcessosList } from "@/components/onboarding/OnboardingProcessosList";
import { OnboardingIndicadores } from "@/components/onboarding/OnboardingIndicadores";
import type { OnboardingTemplate } from "@/types/onboarding";

export default function Onboarding() {
  const [selectedTemplate, setSelectedTemplate] = useState<OnboardingTemplate | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<OnboardingTemplate | null>(null);
  const [showTemplateForm, setShowTemplateForm] = useState(false);

  const handleNewTemplate = () => {
    setEditingTemplate(null);
    setShowTemplateForm(true);
  };

  const handleEditTemplate = (t: OnboardingTemplate) => {
    setEditingTemplate(t);
    setShowTemplateForm(true);
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
            <UserPlus className="w-6 h-6 text-primary" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Onboarding Gamificado</h1>
            <p className="text-sm text-muted-foreground">
              Acolha, oriente e conheça seus novos colaboradores
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-base text-muted-foreground">
          Este é o seu ponto de partida para explorar o onboarding gamificado. Aqui, você passará por diversas etapas que tornarão sua integração na empresa mais interativa e engajante. Boa sorte!
        </p>
      </div>

      <Tabs defaultValue="processos" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="processos">Processos</TabsTrigger>
          <TabsTrigger value="indicadores">Indicadores</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="processos" className="mt-6">
          <OnboardingProcessosList />
        </TabsContent>

        <TabsContent value="indicadores" className="mt-6">
          <OnboardingIndicadores />
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          {selectedTemplate ? (
            <OnboardingTemplateDetail
              template={selectedTemplate}
              onBack={() => setSelectedTemplate(null)}
              onEdit={() => handleEditTemplate(selectedTemplate)}
            />
          ) : (
            <OnboardingTemplateList
              onSelect={setSelectedTemplate}
              onNew={handleNewTemplate}
              onEdit={handleEditTemplate}
            />
          )}
        </TabsContent>
      </Tabs>

      <OnboardingTemplateForm
        open={showTemplateForm}
        onOpenChange={setShowTemplateForm}
        template={editingTemplate}
      />
    </motion.div>
  );
}
