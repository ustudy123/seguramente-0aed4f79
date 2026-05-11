import { useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  Target,
  Calendar,
  User,
  MapPin,
  HelpCircle,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Edit,
  Trash2,
  MessageSquare,
  History,
  ListTodo,
  Navigation,
  Save,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePlanoAcao } from "@/hooks/usePlanoAcao";
import { PlanoAcaoTarefas } from "./PlanoAcaoTarefas";
import { PlanoAcaoHistorico } from "./PlanoAcaoHistorico";
import { PlanoAcaoComentarios } from "./PlanoAcaoComentarios";
import { PlanoAcaoFormModal } from "./PlanoAcaoFormModal";
import { InfoCardModal, W5H2Detail, GutModal } from "./InfoCardModal";
import type { AcaoStatus, AcaoGutPrioridade } from "@/types/planoAcao";

interface PlanoAcaoDetailProps {
  acaoId: string;
  onClose: () => void;
}

const statusConfig: Record<AcaoStatus, { label: string; color: string; icon: React.ElementType }> = {
  pendente: { label: "Pendente", color: "bg-muted text-muted-foreground", icon: Clock },
  em_andamento: { label: "Em Andamento", color: "bg-blue-100 text-blue-700", icon: Target },
  pausada: { label: "Pausada", color: "bg-yellow-100 text-yellow-700", icon: AlertTriangle },
  concluida: { label: "Concluída", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  cancelada: { label: "Cancelada", color: "bg-gray-100 text-gray-500", icon: Trash2 },
};

const prioridadeConfig: Record<AcaoGutPrioridade, { label: string; color: string }> = {
  baixo: { label: "Baixa", color: "bg-gray-100 text-gray-700" },
  medio: { label: "Média", color: "bg-blue-100 text-blue-700" },
  urgente: { label: "Urgente", color: "bg-orange-100 text-orange-700" },
  imediato: { label: "Imediata", color: "bg-red-100 text-red-700" },
};

const ORIGEM_DETAIL_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  manual: { label: "Criação Manual", icon: "✏️", color: "text-muted-foreground" },
  ergonomia: { label: "Ergonomia Inteligente", icon: "🧠", color: "text-blue-700" },
  ouvidoria: { label: "Ouvidoria", icon: "📢", color: "text-purple-700" },
  epi: { label: "Gestão de EPIs", icon: "🦺", color: "text-amber-700" },
  ponto: { label: "Gestão de Ponto", icon: "⏰", color: "text-green-700" },
  humor: { label: "Humor Diário", icon: "😊", color: "text-pink-700" },
};

export function PlanoAcaoDetail({ acaoId, onClose }: PlanoAcaoDetailProps) {
  const [activeTab, setActiveTab] = useState("tarefas");
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedInfoCard, setSelectedInfoCard] = useState<string | null>(null);
  const [showGutModal, setShowGutModal] = useState(false);
  const [showConcluirDialog, setShowConcluirDialog] = useState(false);
  const [isEditingGut, setIsEditingGut] = useState(false);
  const [gutDraft, setGutDraft] = useState<{ gravidade: number; urgencia: number; tendencia: number }>({
    gravidade: 1,
    urgencia: 1,
    tendencia: 1,
  });
  
  const { useAcao, useTarefas, useHistorico, useComentarios, updateAcao, isUpdatingAcao } = usePlanoAcao();
  
  const { data: acao, isLoading } = useAcao(acaoId);
  const { data: tarefas = [] } = useTarefas(acaoId);
  const { data: historico = [] } = useHistorico(acaoId);
  const { data: comentarios = [] } = useComentarios(acaoId);

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!acao) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">Ação não encontrada</h3>
        <p className="text-sm text-muted-foreground mt-1">
          A ação solicitada não existe ou foi removida.
        </p>
        <Button variant="outline" onClick={onClose} className="mt-4">
          Voltar
        </Button>
      </div>
    );
  }

  const status = statusConfig[acao.status || "pendente"];
  const StatusIcon = status.icon;
  const prioridade = prioridadeConfig[acao.prioridade || "medio"];

  // Componente de card clicável
  const ClickableInfoCard = ({
    cardKey,
    icon: Icon,
    title,
    children,
    iconColor = "text-primary",
  }: {
    cardKey: string;
    icon: React.ElementType;
    title: string;
    children: React.ReactNode;
    iconColor?: string;
  }) => (
    <Card 
      className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-200 group relative"
      onClick={() => setShowEditModal(true)}
      title="Clique para editar"
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          {title}
          <Edit className="h-3 w-3 ml-auto text-muted-foreground/40 group-hover:text-primary transition-colors" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-mono text-muted-foreground">{acao.codigo}</span>
              <Badge className={status.color}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {status.label}
              </Badge>
              <Badge className={prioridade.color}>
                {prioridade.label}
              </Badge>
              {acao.origem_modulo && acao.origem_modulo !== "manual" && (
                <Badge variant="outline" className="text-xs">
                  {ORIGEM_DETAIL_LABELS[acao.origem_modulo]?.icon}{" "}
                  {ORIGEM_DETAIL_LABELS[acao.origem_modulo]?.label || acao.origem_modulo}
                </Badge>
              )}
            </div>
            <h1 className="text-xl font-bold">{acao.titulo}</h1>
            {acao.descricao && (
              <p className="text-muted-foreground mt-1">{acao.descricao}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {acao.status !== "concluida" && (
            <Button 
              size="sm" 
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => setShowConcluirDialog(true)}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Concluir Ação
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowEditModal(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </Button>
        </div>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progresso</span>
            <span className="text-sm text-muted-foreground">{acao.progresso || 0}%</span>
          </div>
          <Progress value={acao.progresso || 0} className="h-2" />
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>{tarefas.filter(t => t.status === "concluida").length} de {tarefas.length} tarefas</span>
            {acao.prazo && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Prazo: {format(new Date(acao.prazo), "dd/MM/yyyy", { locale: ptBR })}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info Cards - 5W2H */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Who - Responsável */}
        <ClickableInfoCard cardKey="who" icon={User} title="Quem (Who)">
          <p className="text-sm">{acao.responsavel_nome || "Não definido"}</p>
        </ClickableInfoCard>

        {/* Where - Onde */}
        <ClickableInfoCard cardKey="where" icon={MapPin} title="Onde (Where)">
          <p className="text-sm">{acao.onde || "Não informado"}</p>
        </ClickableInfoCard>

        {/* Why - Por quê */}
        <ClickableInfoCard cardKey="why" icon={HelpCircle} title="Por quê (Why)">
          <p className="text-sm line-clamp-2">{acao.porque || "Não informado"}</p>
        </ClickableInfoCard>

        {/* How - Como */}
        <ClickableInfoCard cardKey="how" icon={Target} title="Como (How)">
          <p className="text-sm line-clamp-2">{acao.como || "Não informado"}</p>
        </ClickableInfoCard>

        {/* How Much - Quanto custa */}
        <ClickableInfoCard cardKey="howmuch" icon={DollarSign} title="Quanto (How Much)">
          <div className="space-y-1 text-sm">
            {acao.custo_estimado ? (
              <p>Estimado: R$ {acao.custo_estimado.toLocaleString("pt-BR")}</p>
            ) : (
              <p className="text-muted-foreground">Não informado</p>
            )}
            {acao.custo_real && (
              <p>Real: R$ {acao.custo_real.toLocaleString("pt-BR")}</p>
            )}
          </div>
        </ClickableInfoCard>

        {/* GUT Score */}
        <Card className="hover:shadow-md hover:border-primary/30 transition-all duration-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between gap-2">
              <button
                type="button"
                className="flex items-center gap-2 hover:text-primary"
                onClick={() => setShowGutModal(true)}
              >
                <AlertTriangle className="h-4 w-4 text-primary" />
                Matriz GUT
              </button>
              {!isEditingGut ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setGutDraft({
                      gravidade: acao.gravidade || 1,
                      urgencia: acao.urgencia || 1,
                      tendencia: acao.tendencia || 1,
                    });
                    setIsEditingGut(true);
                  }}
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Editar
                </Button>
              ) : (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    disabled={isUpdatingAcao}
                    onClick={async () => {
                      await updateAcao({
                        id: acaoId,
                        data: {
                          gravidade: gutDraft.gravidade,
                          urgencia: gutDraft.urgencia,
                          tendencia: gutDraft.tendencia,
                        } as any,
                      });
                      setIsEditingGut(false);
                    }}
                  >
                    <Save className="h-3 w-3 mr-1" />
                    Salvar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={() => setIsEditingGut(false)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!isEditingGut ? (
              <div className="flex items-center gap-4 text-sm">
                <div className="text-center">
                  <div className="text-lg font-bold text-red-600">{acao.gravidade || 0}</div>
                  <div className="text-xs text-muted-foreground">Gravidade</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-orange-600">{acao.urgencia || 0}</div>
                  <div className="text-xs text-muted-foreground">Urgência</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-yellow-600">{acao.tendencia || 0}</div>
                  <div className="text-xs text-muted-foreground">Tendência</div>
                </div>
                <div className="text-center border-l pl-4">
                  <div className="text-lg font-bold text-primary">
                    {acao.pontuacao_gut ?? (acao.gravidade || 0) * (acao.urgencia || 0) * (acao.tendencia || 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">Score</div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {(["gravidade", "urgencia", "tendencia"] as const).map((key) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs capitalize">{key}</Label>
                    <Select
                      value={String(gutDraft[key])}
                      onValueChange={(v) => setGutDraft((d) => ({ ...d, [key]: Number(v) }))}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                <div className="col-span-3 text-center text-xs text-muted-foreground">
                  Score previsto: <span className="font-bold text-primary">{gutDraft.gravidade * gutDraft.urgencia * gutDraft.tendencia}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Origem */}
        <ClickableInfoCard cardKey="origem" icon={Navigation} title="Origem">
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {ORIGEM_DETAIL_LABELS[acao.origem_modulo]?.icon}{" "}
              {ORIGEM_DETAIL_LABELS[acao.origem_modulo]?.label || acao.origem_modulo}
            </p>
            {acao.origem_descricao && (
              <p className="text-xs text-muted-foreground">{acao.origem_descricao}</p>
            )}
          </div>
        </ClickableInfoCard>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="tarefas" className="flex items-center gap-2">
            <ListTodo className="h-4 w-4" />
            Tarefas
            {tarefas.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded">
                {tarefas.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="comentarios" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Comentários
            {comentarios.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded">
                {comentarios.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tarefas" className="mt-4">
          <PlanoAcaoTarefas acaoId={acaoId} tarefas={tarefas} />
        </TabsContent>

        <TabsContent value="comentarios" className="mt-4">
          <PlanoAcaoComentarios acaoId={acaoId} comentarios={comentarios} />
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <PlanoAcaoHistorico historico={historico} />
        </TabsContent>
      </Tabs>

      {/* Modal de Edição */}
      <PlanoAcaoFormModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        editData={acao}
      />

      {/* Modais de detalhes 5W2H */}
      <InfoCardModal
        open={selectedInfoCard === "who"}
        onOpenChange={(open) => !open && setSelectedInfoCard(null)}
        title="Quem (Who)"
        subtitle="Responsável pela execução"
        icon={User}
      >
        <W5H2Detail label="Responsável Principal" value={acao.responsavel_nome} />
        <W5H2Detail label="Criado por" value={acao.criado_por_nome} />
        {acao.created_at && (
          <W5H2Detail 
            label="Data de Criação" 
            value={format(new Date(acao.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} 
          />
        )}
      </InfoCardModal>

      <InfoCardModal
        open={selectedInfoCard === "where"}
        onOpenChange={(open) => !open && setSelectedInfoCard(null)}
        title="Onde (Where)"
        subtitle="Local ou área de aplicação"
        icon={MapPin}
      >
        <W5H2Detail label="Localização" value={acao.onde} />
        <W5H2Detail label="Módulo de Origem" value={acao.origem_modulo} badge={acao.origem_descricao || undefined} />
      </InfoCardModal>

      <InfoCardModal
        open={selectedInfoCard === "why"}
        onOpenChange={(open) => !open && setSelectedInfoCard(null)}
        title="Por quê (Why)"
        subtitle="Justificativa e motivação"
        icon={HelpCircle}
      >
        <W5H2Detail label="Justificativa" value={acao.porque} emptyText="Nenhuma justificativa informada" />
        <W5H2Detail label="Descrição completa" value={acao.descricao} />
      </InfoCardModal>

      <InfoCardModal
        open={selectedInfoCard === "how"}
        onOpenChange={(open) => !open && setSelectedInfoCard(null)}
        title="Como (How)"
        subtitle="Estratégia de execução"
        icon={Target}
      >
        <W5H2Detail label="Método de Execução" value={acao.como} emptyText="Nenhuma estratégia definida" />
        <W5H2Detail label="Tipo de Ação" value={acao.tipo} />
        {acao.tempo_estimado_minutos && (
          <W5H2Detail 
            label="Tempo Estimado" 
            value={`${Math.floor(acao.tempo_estimado_minutos / 60)}h ${acao.tempo_estimado_minutos % 60}min`} 
          />
        )}
        {acao.tempo_gasto_minutos !== undefined && acao.tempo_gasto_minutos > 0 && (
          <W5H2Detail 
            label="Tempo Gasto" 
            value={`${Math.floor(acao.tempo_gasto_minutos / 60)}h ${acao.tempo_gasto_minutos % 60}min`} 
          />
        )}
      </InfoCardModal>

      <InfoCardModal
        open={selectedInfoCard === "howmuch"}
        onOpenChange={(open) => !open && setSelectedInfoCard(null)}
        title="Quanto (How Much)"
        subtitle="Custos envolvidos"
        icon={DollarSign}
      >
        <W5H2Detail label="Custo Estimado" value={acao.custo_estimado} format="currency" />
        <W5H2Detail label="Custo Real" value={acao.custo_real} format="currency" />
        {acao.custo_estimado && acao.custo_real && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">Variação:</p>
            <p className={`font-medium ${acao.custo_real > acao.custo_estimado ? 'text-red-600' : 'text-green-600'}`}>
              {acao.custo_real > acao.custo_estimado ? '+' : ''}
              R$ {(acao.custo_real - acao.custo_estimado).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              {' '}({((acao.custo_real - acao.custo_estimado) / acao.custo_estimado * 100).toFixed(1)}%)
            </p>
          </div>
        )}
      </InfoCardModal>

      {/* Modal Origem */}
      <InfoCardModal
        open={selectedInfoCard === "origem"}
        onOpenChange={(open) => !open && setSelectedInfoCard(null)}
        title="Origem da Ação"
        subtitle="De onde esta ação foi gerada"
        icon={Navigation}
      >
        <W5H2Detail 
          label="Módulo de Origem" 
          value={`${ORIGEM_DETAIL_LABELS[acao.origem_modulo]?.icon || ""} ${ORIGEM_DETAIL_LABELS[acao.origem_modulo]?.label || acao.origem_modulo}`} 
        />
        {acao.origem_descricao && (
          <W5H2Detail label="Detalhes" value={acao.origem_descricao} />
        )}
        <W5H2Detail label="Criado por" value={acao.criado_por_nome} />
        {acao.created_at && (
          <W5H2Detail 
            label="Data de Criação" 
            value={format(new Date(acao.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} 
          />
        )}
      </InfoCardModal>

      {/* Modal GUT */}
      <GutModal
        open={showGutModal}
        onOpenChange={setShowGutModal}
        gravidade={acao.gravidade || 3}
        urgencia={acao.urgencia || 3}
        tendencia={acao.tendencia || 3}
        pontuacao={acao.pontuacao_gut || 27}
        prioridade={acao.prioridade}
      />

      {/* Dialog de Conclusão Direta */}
      <AlertDialog open={showConcluirDialog} onOpenChange={setShowConcluirDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Concluir Ação
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja marcar esta ação como concluída?
              {tarefas.length > 0 && tarefas.some(t => t.status !== "concluida") && (
                <span className="block mt-2 text-yellow-600 font-medium">
                  ⚠️ Existem {tarefas.filter(t => t.status !== "concluida").length} tarefa(s) ainda não concluída(s). 
                  Elas serão mantidas como estão.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={isUpdatingAcao}
              onClick={async () => {
                await updateAcao({
                  id: acaoId,
                  data: {
                    status: "concluida" as AcaoStatus,
                    progresso: 100,
                    data_conclusao: new Date().toISOString(),
                  },
                });
                setShowConcluirDialog(false);
              }}
            >
              {isUpdatingAcao ? "Concluindo..." : "Sim, concluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
