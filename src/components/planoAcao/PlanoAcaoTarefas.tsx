import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Lock,
  MoreHorizontal,
  Trash2,
  Edit,
  User,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePlanoAcao } from "@/hooks/usePlanoAcao";
import type { PlanoTarefa, TarefaStatus } from "@/types/planoAcao";

interface PlanoAcaoTarefasProps {
  acaoId: string;
  tarefas: PlanoTarefa[];
}

const statusConfig: Record<TarefaStatus, { icon: React.ElementType; color: string }> = {
  nao_iniciada: { icon: Circle, color: "text-muted-foreground" },
  em_andamento: { icon: Clock, color: "text-blue-500" },
  bloqueada: { icon: Lock, color: "text-yellow-500" },
  concluida: { icon: CheckCircle2, color: "text-green-500" },
};

const prioridadeColors: Record<string, string> = {
  baixo: "bg-gray-100 text-gray-600",
  medio: "bg-blue-100 text-blue-600",
  urgente: "bg-orange-100 text-orange-600",
  imediato: "bg-red-100 text-red-600",
};

export function PlanoAcaoTarefas({ acaoId, tarefas }: PlanoAcaoTarefasProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newTarefa, setNewTarefa] = useState({
    titulo: "",
    descricao: "",
    prazo: "",
    prioridade: "media" as string,
  });

  const { createTarefa, isCreatingTarefa, updateTarefa, deleteTarefa } = usePlanoAcao();

  const handleAddTarefa = async () => {
    if (!newTarefa.titulo.trim()) return;

    await createTarefa({
      acao_id: acaoId,
      titulo: newTarefa.titulo,
      descricao: newTarefa.descricao || undefined,
      prazo: newTarefa.prazo || undefined,
      prioridade: newTarefa.prioridade as any,
      ordem: tarefas.length,
      status: "nao_iniciada",
    });

    setNewTarefa({ titulo: "", descricao: "", prazo: "", prioridade: "medio" });
    setShowAddDialog(false);
  };

  const handleToggleStatus = async (tarefa: PlanoTarefa) => {
    const newStatus: TarefaStatus = tarefa.status === "concluida" ? "nao_iniciada" : "concluida";
    await updateTarefa({
      id: tarefa.id,
      acaoId,
      data: { status: newStatus },
    });
  };

  const handleDeleteTarefa = async (tarefaId: string) => {
    await deleteTarefa({ id: tarefaId, acaoId });
  };

  const sortedTarefas = [...tarefas].sort((a, b) => {
    // Concluídas vão para o final
    if (a.status === "concluida" && b.status !== "concluida") return 1;
    if (a.status !== "concluida" && b.status === "concluida") return -1;
    // Ordenar por ordem
    return (a.ordem || 0) - (b.ordem || 0);
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Tarefas Operacionais</CardTitle>
        <Button size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar
        </Button>
      </CardHeader>
      <CardContent>
        {tarefas.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Nenhuma tarefa cadastrada</p>
            <p className="text-xs mt-1">Adicione tarefas para acompanhar a execução da ação</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {sortedTarefas.map((tarefa) => {
                const StatusIcon = statusConfig[tarefa.status || "pendente"].icon;
                const statusColor = statusConfig[tarefa.status || "pendente"].color;
                const isOverdue = tarefa.prazo && new Date(tarefa.prazo) < new Date() && tarefa.status !== "concluida";

                return (
                  <motion.div
                    key={tarefa.id}
                    layout
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      tarefa.status === "concluida" ? "bg-muted/30 opacity-60" : "bg-card"
                    } ${isOverdue ? "border-red-300" : ""}`}
                  >
                    <Checkbox
                      checked={tarefa.status === "concluida"}
                      onCheckedChange={() => handleToggleStatus(tarefa)}
                      className="mt-0.5"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium text-sm ${tarefa.status === "concluida" ? "line-through" : ""}`}>
                          {tarefa.titulo}
                        </span>
                        {tarefa.prioridade && tarefa.prioridade !== "medio" && (
                          <Badge variant="secondary" className={prioridadeColors[tarefa.prioridade]}>
                            {tarefa.prioridade}
                          </Badge>
                        )}
                        {isOverdue && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Atrasada
                          </Badge>
                        )}
                      </div>

                      {tarefa.descricao && (
                        <p className="text-sm text-muted-foreground mt-1">{tarefa.descricao}</p>
                      )}

                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        {tarefa.responsavel_nome && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {tarefa.responsavel_nome}
                          </span>
                        )}
                        {tarefa.prazo && (
                          <span className={`flex items-center gap-1 ${isOverdue ? "text-red-500" : ""}`}>
                            <Calendar className="h-3 w-3" />
                            {format(new Date(tarefa.prazo), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        )}
                        {tarefa.data_conclusao && (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            Concluída em {format(new Date(tarefa.data_conclusao), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        )}
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDeleteTarefa(tarefa.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </CardContent>

      {/* Dialog de adicionar tarefa */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                placeholder="Descreva a tarefa..."
                value={newTarefa.titulo}
                onChange={(e) => setNewTarefa({ ...newTarefa, titulo: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                placeholder="Detalhes adicionais (opcional)..."
                value={newTarefa.descricao}
                onChange={(e) => setNewTarefa({ ...newTarefa, descricao: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prazo">Prazo</Label>
                <Input
                  id="prazo"
                  type="date"
                  value={newTarefa.prazo}
                  onChange={(e) => setNewTarefa({ ...newTarefa, prazo: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prioridade">Prioridade</Label>
                <Select
                  value={newTarefa.prioridade}
                  onValueChange={(value) => setNewTarefa({ ...newTarefa, prioridade: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="critica">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddTarefa} disabled={!newTarefa.titulo.trim() || isCreatingTarefa}>
              {isCreatingTarefa ? "Salvando..." : "Adicionar Tarefa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
