import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Paperclip,
  History,
  ListTodo,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlanoAcao } from "@/hooks/usePlanoAcao";
import { PlanoAcaoTarefas } from "./PlanoAcaoTarefas";
import { PlanoAcaoHistorico } from "./PlanoAcaoHistorico";
import { PlanoAcaoComentarios } from "./PlanoAcaoComentarios";
import type { PlanoAcao, AcaoStatus, AcaoGutPrioridade } from "@/types/planoAcao";

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

export function PlanoAcaoDetail({ acaoId, onClose }: PlanoAcaoDetailProps) {
  const [activeTab, setActiveTab] = useState("tarefas");
  const { useAcao, useTarefas, useHistorico, useComentarios } = usePlanoAcao();
  
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
            </div>
            <h1 className="text-xl font-bold">{acao.titulo}</h1>
            {acao.descricao && (
              <p className="text-muted-foreground mt-1">{acao.descricao}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Quem (Who)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{acao.responsavel_nome || "Não definido"}</p>
          </CardContent>
        </Card>

        {/* Where - Onde */}
        {acao.onde && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Onde (Where)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{acao.onde}</p>
            </CardContent>
          </Card>
        )}

        {/* Why - Por quê */}
        {acao.porque && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-primary" />
                Por quê (Why)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{acao.porque}</p>
            </CardContent>
          </Card>
        )}

        {/* How - Como */}
        {acao.como && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Como (How)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{acao.como}</p>
            </CardContent>
          </Card>
        )}

        {/* How Much - Quanto custa */}
        {(acao.custo_estimado || acao.custo_real) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Quanto (How Much)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm">
                {acao.custo_estimado && (
                  <p>Estimado: R$ {acao.custo_estimado.toLocaleString("pt-BR")}</p>
                )}
                {acao.custo_real && (
                  <p>Real: R$ {acao.custo_real.toLocaleString("pt-BR")}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* GUT Score */}
        {acao.pontuacao_gut && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-primary" />
                Matriz GUT
              </CardTitle>
            </CardHeader>
            <CardContent>
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
                  <div className="text-lg font-bold text-primary">{acao.pontuacao_gut}</div>
                  <div className="text-xs text-muted-foreground">Score</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
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
    </motion.div>
  );
}
