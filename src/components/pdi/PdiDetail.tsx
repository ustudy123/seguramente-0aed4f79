import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Target, Calendar, User, TrendingUp, MessageSquare, Pencil, FileText, Lightbulb, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Pdi } from "@/types/pdi";
import { PDI_STATUS_LABELS, PDI_PERIODO_LABELS } from "@/types/pdi";
import { usePdi } from "@/hooks/usePdi";
import { PdiMetaForm } from "./PdiMetaForm";
import { PdiMetaCard } from "./PdiMetaCard";
import { PdiCheckinForm } from "./PdiCheckinForm";
import { PdiFeedbackForm } from "./PdiFeedbackForm";
import { PdiEditModal } from "./PdiEditModal";
import { PdiDocumentoModal } from "./PdiDocumentoModal";
import { useAfastamentosAtivos } from "@/hooks/useAfastamentosAtivos";
import { AfastadoBadge } from "@/components/shared/AfastadoBadge";

interface PdiDetailProps {
  pdi: Pdi;
  onBack: () => void;
}

export const PdiDetail = ({ pdi, onBack }: PdiDetailProps) => {
  const { updatePdi, createMeta, updateMeta, deleteMeta, createAcao, updateAcao, deleteAcao, createCheckin, checkins, createFeedback, feedbacks } = usePdi();
  const { getAfastamento } = useAfastamentosAtivos();
  const [showMetaForm, setShowMetaForm] = useState(false);
  const [showCheckinForm, setShowCheckinForm] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDocumentoModal, setShowDocumentoModal] = useState(false);

  const pdiCheckins = checkins.filter(c => pdi.metas?.some(m => m.id === c.meta_id));
  const pdiFeedbacks = feedbacks.filter(f => f.pdi_id === pdi.id);

  const handleActivate = () => updatePdi({ id: pdi.id, status: "ativo" });

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-foreground">{pdi.titulo}</h1>
            <Badge>{PDI_STATUS_LABELS[pdi.status]}</Badge>
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
             <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {pdi.colaborador_nome}</span>
              <AfastadoBadge afastamento={getAfastamento({ nome: pdi.colaborador_nome })} compact />
            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {format(new Date(pdi.data_inicio), "dd/MM/yy", { locale: ptBR })} — {format(new Date(pdi.data_fim), "dd/MM/yy", { locale: ptBR })}</span>
            <Badge variant="outline">{PDI_PERIODO_LABELS[pdi.periodo]}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowDocumentoModal(true)} className="gap-1.5">
            <FileText className="w-4 h-4" /> Gerar Documento
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowEditModal(true)} className="gap-1.5">
            <Pencil className="w-4 h-4" /> Editar
          </Button>
          {pdi.status === "rascunho" && (
            <Button onClick={handleActivate} className="gap-2"><Target className="w-4 h-4" /> Ativar PDI</Button>
          )}
        </div>
      </motion.div>

      {/* Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-foreground">Progresso geral</span>
            <span className="text-lg font-bold text-primary">{pdi.progresso}%</span>
          </div>
          <Progress value={pdi.progresso} className="h-3" />
          <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
            <span>{pdi.metas?.length || 0} metas</span>
            <span>{pdi.metas?.filter(m => m.status === "concluida").length || 0} concluídas</span>
            {pdi.responsavel_nome && <span>Líder: {pdi.responsavel_nome}</span>}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="metas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="metas" className="gap-1"><Target className="w-3.5 h-3.5" /> Metas ({pdi.metas?.length || 0})</TabsTrigger>
          <TabsTrigger value="checkins" className="gap-1"><TrendingUp className="w-3.5 h-3.5" /> Check-ins ({pdiCheckins.length})</TabsTrigger>
          <TabsTrigger value="feedbacks" className="gap-1"><MessageSquare className="w-3.5 h-3.5" /> Feedbacks ({pdiFeedbacks.length})</TabsTrigger>
        </TabsList>

        {/* METAS */}
        <TabsContent value="metas" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowMetaForm(true)} className="gap-1"><Plus className="w-4 h-4" /> Nova Meta SMART</Button>
          </div>
          {(pdi.metas || []).length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhuma meta definida. Adicione metas SMART para este PDI.</CardContent></Card>
          ) : (
            <div className="space-y-4">
              {pdi.metas!.map(meta => (
                <PdiMetaCard
                  key={meta.id}
                  meta={meta}
                  colaboradorNome={pdi.colaborador_nome}
                  onUpdateMeta={updateMeta}
                  onDeleteMeta={deleteMeta}
                  onCreateAcao={createAcao}
                  onUpdateAcao={updateAcao}
                  onDeleteAcao={deleteAcao}
                />
              ))}
            </div>
          )}
          <PdiMetaForm open={showMetaForm} onOpenChange={setShowMetaForm} pdiId={pdi.id} onCreate={createMeta} />
        </TabsContent>

        {/* CHECK-INS */}
        <TabsContent value="checkins" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowCheckinForm(true)} className="gap-1"><Plus className="w-4 h-4" /> Novo Check-in</Button>
          </div>
          {pdiCheckins.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum check-in registrado ainda.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {pdiCheckins.map(ci => (
                <Card key={ci.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs text-muted-foreground">{format(new Date(ci.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
                      <span className="text-xs text-muted-foreground">{ci.realizado_por_nome}</span>
                    </div>
                    {ci.avancos && <p className="text-sm"><span className="font-medium text-success">Avanços:</span> {ci.avancos}</p>}
                    {ci.bloqueios && <p className="text-sm mt-1"><span className="font-medium text-destructive">Bloqueios:</span> {ci.bloqueios}</p>}
                    {ci.proximo_passo && <p className="text-sm mt-1"><span className="font-medium text-primary">Próximo passo:</span> {ci.proximo_passo}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          <PdiCheckinForm open={showCheckinForm} onOpenChange={setShowCheckinForm} metas={pdi.metas || []} onCreate={createCheckin} />
        </TabsContent>

        {/* FEEDBACKS */}
        <TabsContent value="feedbacks" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowFeedbackForm(true)} className="gap-1"><Plus className="w-4 h-4" /> Novo Feedback</Button>
          </div>
          {pdiFeedbacks.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum feedback registrado ainda.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {pdiFeedbacks.map(fb => (
                <Card key={fb.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant="outline">{fb.tipo === "autoavaliacao" ? "Autoavaliação" : fb.tipo === "lider" ? "Líder" : "Par"}</Badge>
                      <span className="text-xs text-muted-foreground">{fb.autor_nome} — {format(new Date(fb.created_at), "dd/MM/yy", { locale: ptBR })}</span>
                    </div>
                    {fb.ponto_forte && <p className="text-sm"><span className="font-medium text-success">Ponto forte:</span> {fb.ponto_forte}</p>}
                    {fb.ponto_melhorar && <p className="text-sm mt-1"><span className="font-medium text-warning">A melhorar:</span> {fb.ponto_melhorar}</p>}
                    {fb.recomendacao && <p className="text-sm mt-1"><span className="font-medium text-primary">Recomendação:</span> {fb.recomendacao}</p>}
                    {fb.comentario && <p className="text-sm mt-1 text-muted-foreground">{fb.comentario}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          <PdiFeedbackForm open={showFeedbackForm} onOpenChange={setShowFeedbackForm} pdiId={pdi.id} pdiTitulo={pdi.titulo} colaboradorId={pdi.colaborador_id} colaboradorNome={pdi.colaborador_nome} onCreate={createFeedback} />
        </TabsContent>
      </Tabs>

      {/* Modal de edição */}
      <PdiEditModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        pdi={pdi}
        onUpdate={updatePdi}
      />

      {/* Modal de documento */}
      <PdiDocumentoModal
        open={showDocumentoModal}
        onClose={() => setShowDocumentoModal(false)}
        pdi={pdi}
        checkins={pdiCheckins}
        feedbacks={pdiFeedbacks}
      />
    </div>
  );
};
