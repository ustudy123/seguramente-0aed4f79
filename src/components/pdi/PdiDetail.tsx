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

  const isRascunho = pdi.status === "rascunho";
  const totalMetas = pdi.metas?.length || 0;
  const metasConcluidas = pdi.metas?.filter(m => m.status === "concluida").length || 0;

  // próximo passo recomendado
  const nextStep = totalMetas === 0
    ? { icon: Target, title: "Adicione a primeira meta SMART", desc: "Comece definindo o que o colaborador precisa desenvolver. Use o botão 'Nova Meta SMART' abaixo.", tab: "metas" as const, color: "from-primary/15 to-info/10 border-primary/30 text-primary" }
    : isRascunho
    ? { icon: Sparkles, title: "Ative o PDI para começar o acompanhamento", desc: "O PDI ainda está em rascunho. Clique em 'Ativar PDI' no topo para iniciar oficialmente o desenvolvimento.", tab: "metas" as const, color: "from-amber-100 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/20 border-amber-300 text-amber-700 dark:text-amber-300" }
    : pdiCheckins.length === 0
    ? { icon: TrendingUp, title: "Faça o primeiro check-in", desc: "Registre avanços, bloqueios e o próximo passo de cada meta. Recomendamos check-ins quinzenais.", tab: "checkins" as const, color: "from-info/15 to-primary/10 border-info/30 text-info" }
    : { icon: CheckCircle2, title: "PDI em andamento — continue acompanhando", desc: "Mantenha a frequência de check-ins e registre feedbacks regulares para garantir o desenvolvimento contínuo.", tab: "checkins" as const, color: "from-emerald-100 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/20 border-emerald-300 text-emerald-700 dark:text-emerald-300" };

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-foreground">{pdi.titulo}</h1>
            <Badge className={isRascunho ? "bg-amber-500 text-white border-transparent" : "bg-emerald-600 text-white border-transparent"}>
              {PDI_STATUS_LABELS[pdi.status]}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {pdi.colaborador_nome}</span>
            <AfastadoBadge afastamento={getAfastamento({ nome: pdi.colaborador_nome })} compact />
            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {format(new Date(pdi.data_inicio), "dd/MM/yy", { locale: ptBR })} — {format(new Date(pdi.data_fim), "dd/MM/yy", { locale: ptBR })}</span>
            <Badge variant="outline">{PDI_PERIODO_LABELS[pdi.periodo]}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setShowDocumentoModal(true)} className="gap-1.5">
            <FileText className="w-4 h-4" /> Gerar Documento
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowEditModal(true)} className="gap-1.5">
            <Pencil className="w-4 h-4" /> Editar
          </Button>
          {isRascunho && (
            <Button onClick={handleActivate} className="gap-2"><Target className="w-4 h-4" /> Ativar PDI</Button>
          )}
        </div>
      </motion.div>

      {/* Próximo passo recomendado */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className={`border-l-4 bg-gradient-to-br ${nextStep.color}`}>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-background/70 shrink-0">
              <nextStep.icon className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Próximo passo</p>
              <h3 className="font-semibold text-foreground mt-0.5">{nextStep.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{nextStep.desc}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* KPIs + Progresso */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="md:col-span-2 bg-gradient-to-br from-primary/5 via-background to-info/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-primary" /> Progresso geral
              </span>
              <span className="text-2xl font-bold text-primary">{pdi.progresso}%</span>
            </div>
            <Progress value={pdi.progresso} className="h-3" />
            {pdi.responsavel_nome && (
              <p className="text-xs text-muted-foreground mt-2">Líder responsável: <strong className="text-foreground">{pdi.responsavel_nome}</strong></p>
            )}
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-info/10 to-background border-info/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-info/15 text-info"><Target className="w-5 h-5" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground leading-none">{totalMetas}</p>
              <p className="text-xs text-muted-foreground mt-1">Metas SMART</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 border-emerald-300 dark:border-emerald-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="w-5 h-5" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground leading-none">{metasConcluidas}</p>
              <p className="text-xs text-muted-foreground mt-1">Concluídas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="metas" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="metas" className="gap-1.5"><Target className="w-3.5 h-3.5" /> Metas ({totalMetas})</TabsTrigger>
          <TabsTrigger value="checkins" className="gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Check-ins ({pdiCheckins.length})</TabsTrigger>
          <TabsTrigger value="feedbacks" className="gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> Feedbacks ({pdiFeedbacks.length})</TabsTrigger>
        </TabsList>

        {/* METAS */}
        <TabsContent value="metas" className="space-y-4">
          <div className="flex items-center justify-between gap-3 bg-muted/40 rounded-lg p-3 border">
            <p className="text-xs text-muted-foreground flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span><strong className="text-foreground">Dica:</strong> Crie metas <strong>SMART</strong> (específicas, mensuráveis, atingíveis, relevantes e com prazo). Cada meta pode ter várias ações.</span>
            </p>
            <Button size="sm" onClick={() => setShowMetaForm(true)} className="gap-1 shrink-0"><Plus className="w-4 h-4" /> Nova Meta SMART</Button>
          </div>
          {totalMetas === 0 ? (
            <Card className="border-dashed border-2 bg-muted/20">
              <CardContent className="p-10 text-center">
                <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                  <Target className="w-7 h-7" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">Nenhuma meta cadastrada</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                  Comece adicionando uma meta SMART. Ex.: "Concluir curso de Excel avançado com nota ≥ 80% até 30/06".
                </p>
                <Button size="sm" onClick={() => setShowMetaForm(true)} className="gap-1"><Plus className="w-4 h-4" /> Adicionar primeira meta</Button>
              </CardContent>
            </Card>
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
          <div className="flex items-center justify-between gap-3 bg-muted/40 rounded-lg p-3 border">
            <p className="text-xs text-muted-foreground flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-info shrink-0 mt-0.5" />
              <span><strong className="text-foreground">Dica:</strong> Faça check-ins <strong>quinzenais ou mensais</strong>. Anote avanços, bloqueios e o próximo passo de cada meta.</span>
            </p>
            <Button size="sm" onClick={() => setShowCheckinForm(true)} disabled={totalMetas === 0} className="gap-1 shrink-0"><Plus className="w-4 h-4" /> Novo Check-in</Button>
          </div>
          {pdiCheckins.length === 0 ? (
            <Card className="border-dashed border-2 bg-muted/20">
              <CardContent className="p-10 text-center">
                <div className="w-14 h-14 rounded-full bg-info/10 text-info flex items-center justify-center mx-auto mb-3">
                  <TrendingUp className="w-7 h-7" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">Nenhum check-in registrado</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                  {totalMetas === 0 ? "Adicione metas primeiro para poder registrar check-ins." : "Registre o primeiro check-in para acompanhar a evolução."}
                </p>
                {totalMetas > 0 && (
                  <Button size="sm" onClick={() => setShowCheckinForm(true)} className="gap-1"><Plus className="w-4 h-4" /> Registrar primeiro check-in</Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pdiCheckins.map(ci => (
                <Card key={ci.id} className="border-l-4 border-l-info bg-gradient-to-br from-info/5 to-background">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs text-muted-foreground">{format(new Date(ci.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
                      <span className="text-xs text-muted-foreground">{ci.realizado_por_nome}</span>
                    </div>
                    {ci.avancos && <p className="text-sm"><span className="font-medium text-success">✓ Avanços:</span> {ci.avancos}</p>}
                    {ci.bloqueios && <p className="text-sm mt-1"><span className="font-medium text-destructive">⚠ Bloqueios:</span> {ci.bloqueios}</p>}
                    {ci.proximo_passo && <p className="text-sm mt-1"><span className="font-medium text-primary">→ Próximo passo:</span> {ci.proximo_passo}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          <PdiCheckinForm open={showCheckinForm} onOpenChange={setShowCheckinForm} metas={pdi.metas || []} onCreate={createCheckin} />
        </TabsContent>

        {/* FEEDBACKS */}
        <TabsContent value="feedbacks" className="space-y-4">
          <div className="flex items-center justify-between gap-3 bg-muted/40 rounded-lg p-3 border">
            <p className="text-xs text-muted-foreground flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <span><strong className="text-foreground">Dica:</strong> Registre feedbacks do líder, autoavaliação ou pares. Aponte pontos fortes, a melhorar e recomendações.</span>
            </p>
            <Button size="sm" onClick={() => setShowFeedbackForm(true)} className="gap-1 shrink-0"><Plus className="w-4 h-4" /> Novo Feedback</Button>
          </div>
          {pdiFeedbacks.length === 0 ? (
            <Card className="border-dashed border-2 bg-muted/20">
              <CardContent className="p-10 text-center">
                <div className="w-14 h-14 rounded-full bg-warning/10 text-warning flex items-center justify-center mx-auto mb-3">
                  <MessageSquare className="w-7 h-7" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">Nenhum feedback registrado</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                  Feedbacks regulares aceleram o desenvolvimento. Registre o primeiro feedback agora.
                </p>
                <Button size="sm" onClick={() => setShowFeedbackForm(true)} className="gap-1"><Plus className="w-4 h-4" /> Registrar primeiro feedback</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pdiFeedbacks.map(fb => (
                <Card key={fb.id} className="border-l-4 border-l-warning bg-gradient-to-br from-warning/5 to-background">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant="outline" className="bg-background">{fb.tipo === "autoavaliacao" ? "Autoavaliação" : fb.tipo === "lider" ? "Líder" : "Par"}</Badge>
                      <span className="text-xs text-muted-foreground">{fb.autor_nome} — {format(new Date(fb.created_at), "dd/MM/yy", { locale: ptBR })}</span>
                    </div>
                    {fb.ponto_forte && <p className="text-sm"><span className="font-medium text-success">★ Ponto forte:</span> {fb.ponto_forte}</p>}
                    {fb.ponto_melhorar && <p className="text-sm mt-1"><span className="font-medium text-warning">↗ A melhorar:</span> {fb.ponto_melhorar}</p>}
                    {fb.recomendacao && <p className="text-sm mt-1"><span className="font-medium text-primary">→ Recomendação:</span> {fb.recomendacao}</p>}
                    {fb.comentario && <p className="text-sm mt-1 text-muted-foreground italic">"{fb.comentario}"</p>}
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
