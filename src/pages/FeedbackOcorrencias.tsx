import { useState } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Plus, List, AlertOctagon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFeedbackOcorrencias } from "@/hooks/useFeedbackOcorrencias";
import { useAuth } from "@/hooks/useAuth";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";
import { FeedbackList } from "@/components/feedback/FeedbackList";
import { FeedbackStats } from "@/components/feedback/FeedbackStats";
import { OcorrenciaForm } from "@/components/feedback/OcorrenciaForm";
import { OcorrenciaList } from "@/components/feedback/OcorrenciaList";

export default function FeedbackOcorrencias() {
  const [activeTab, setActiveTab] = useState("feedback-novo");
  const { hasMinimumRole } = useAuth();
  const {
    feedbacks,
    isLoadingFeedbacks,
    criarFeedback,
    criandoFeedback,
    ocorrencias,
    isLoadingOcorrencias,
    criarOcorrencia,
    criandoOcorrencia,
    criarAdvertenciaLink,
    feedbackStats,
    ocorrenciaStats,
  } = useFeedbackOcorrencias();

  const isManager = hasMinimumRole("manager");

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageCircle className="w-7 h-7 text-primary" />
            Feedback & Ocorrências
          </h1>
          <p className="text-muted-foreground">
            Registre feedbacks estruturados e ocorrências de forma rápida e objetiva
          </p>
        </div>
      </motion.div>

      {/* Stats */}
      {isManager && <FeedbackStats feedbackStats={feedbackStats} ocorrenciaStats={ocorrenciaStats} />}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="feedback-novo" className="gap-1 text-xs sm:text-sm">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Novo</span> Feedback
          </TabsTrigger>
          <TabsTrigger value="feedback-lista" className="gap-1 text-xs sm:text-sm">
            <List className="w-4 h-4" />
            Feedbacks
          </TabsTrigger>
          <TabsTrigger value="ocorrencia-nova" className="gap-1 text-xs sm:text-sm">
            <AlertOctagon className="w-4 h-4" />
            <span className="hidden sm:inline">Nova</span> Ocorrência
          </TabsTrigger>
          <TabsTrigger value="ocorrencia-lista" className="gap-1 text-xs sm:text-sm">
            <List className="w-4 h-4" />
            Ocorrências
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feedback-novo" className="mt-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto">
            <FeedbackForm onSubmit={criarFeedback} isLoading={criandoFeedback} />
          </motion.div>
        </TabsContent>

        <TabsContent value="feedback-lista" className="mt-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-xl border p-6">
            <h2 className="text-lg font-semibold mb-4">Histórico de Feedbacks</h2>
            <FeedbackList feedbacks={feedbacks} isLoading={isLoadingFeedbacks} />
          </motion.div>
        </TabsContent>

        <TabsContent value="ocorrencia-nova" className="mt-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto">
            <OcorrenciaForm
              onSubmit={criarOcorrencia}
              onCreateAdvertenciaLink={criarAdvertenciaLink}
              isLoading={criandoOcorrencia}
            />
          </motion.div>
        </TabsContent>

        <TabsContent value="ocorrencia-lista" className="mt-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-xl border p-6">
            <h2 className="text-lg font-semibold mb-4">Histórico de Ocorrências</h2>
            <OcorrenciaList ocorrencias={ocorrencias} isLoading={isLoadingOcorrencias} />
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
