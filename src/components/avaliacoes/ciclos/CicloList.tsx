import { useState } from "react";
import { confirm } from "@/components/ui/confirm-dialog";
import { 
  Plus, 
  Calendar, 
  Users, 
  MoreVertical,
  Play,
  Pause,
  CheckCircle,
  Clock,
  Trash2,
  Edit
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAvaliacoes } from "@/hooks/useAvaliacoes";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { STATUS_CICLO_LABELS, type AvaliacaoCicloStatus, type AvaliacaoCiclo } from "@/types/avaliacao";
import { CicloForm } from "./CicloForm";
import { IniciarCicloDialog } from "./IniciarCicloDialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { GradientDialogHeader } from "@/components/pdi/GradientDialogHeader";

const statusConfig: Record<AvaliacaoCicloStatus, { color: string; icon: typeof Play }> = {
  rascunho: { color: "bg-slate-100 text-slate-700", icon: Edit },
  ativo: { color: "bg-green-100 text-green-700", icon: Play },
  encerrado: { color: "bg-blue-100 text-blue-700", icon: CheckCircle },
  analisando: { color: "bg-amber-100 text-amber-700", icon: Clock },
};

export function CicloList() {
  const { ciclos, isLoadingCiclos, updateCiclo, deleteCiclo } = useAvaliacoes();
  const [showForm, setShowForm] = useState(false);
  const [editingCiclo, setEditingCiclo] = useState<string | null>(null);
  const [iniciarCiclo, setIniciarCiclo] = useState<AvaliacaoCiclo | null>(null);

  const handleStatusChange = async (id: string, newStatus: AvaliacaoCicloStatus) => {
    // Se está ativando, abre o dialog de geração automática
    if (newStatus === "ativo") {
      const ciclo = ciclos.find(c => c.id === id);
      if (ciclo) {
        setIniciarCiclo(ciclo);
        return;
      }
    }
    await updateCiclo({ id, status: newStatus });
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({ title: "Excluir ciclo", description: "Tem certeza que deseja excluir este ciclo?", confirmLabel: "Excluir" });
    if (confirmed) {
      await deleteCiclo(id);
    }
  };

  if (isLoadingCiclos) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4 mx-auto" />
            <div className="h-8 bg-muted rounded w-1/2 mx-auto" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Ciclos de Avaliação</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie os ciclos de avaliação de desempenho
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Ciclo
        </Button>
      </div>

      {ciclos.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-muted rounded-full">
                <Calendar className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Nenhum ciclo cadastrado</h3>
                <p className="text-muted-foreground">
                  Crie seu primeiro ciclo de avaliação para começar.
                </p>
              </div>
              <Button onClick={() => setShowForm(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Criar Ciclo
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {ciclos.map((ciclo) => {
            const StatusIcon = statusConfig[ciclo.status]?.icon || Clock;
            const statusColor = statusConfig[ciclo.status]?.color || "bg-slate-100";

            return (
              <Card key={ciclo.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={statusColor}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {STATUS_CICLO_LABELS[ciclo.status]}
                        </Badge>
                        {ciclo.template && (
                          <Badge variant="outline">
                            {ciclo.template.tipo === "360" ? "360°" : "Simples"}
                          </Badge>
                        )}
                      </div>

                      <div>
                        <h3 className="font-semibold text-lg">{ciclo.nome}</h3>
                        {ciclo.descricao && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {ciclo.descricao}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {format(new Date(ciclo.data_inicio), "dd/MM/yyyy", { locale: ptBR })} 
                            {" - "}
                            {format(new Date(ciclo.data_fim), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </div>
                        {ciclo.template && (
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            <span>Template: {ciclo.template.nome}</span>
                          </div>
                        )}
                      </div>

                      {ciclo.status === "ativo" && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Progresso</span>
                            <span className="font-medium">0%</span>
                          </div>
                          <Progress value={0} className="h-2" />
                        </div>
                      )}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {ciclo.status === "rascunho" && (
                          <DropdownMenuItem 
                            onClick={() => handleStatusChange(ciclo.id, "ativo")}
                            className="gap-2"
                          >
                            <Play className="h-4 w-4" />
                            Iniciar Ciclo
                          </DropdownMenuItem>
                        )}
                        {ciclo.status === "ativo" && (
                          <DropdownMenuItem 
                            onClick={() => handleStatusChange(ciclo.id, "encerrado")}
                            className="gap-2"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Encerrar Ciclo
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          onClick={() => setEditingCiclo(ciclo.id)}
                          className="gap-2"
                        >
                          <Edit className="h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDelete(ciclo.id)}
                          className="gap-2 text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="w-full max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <VisuallyHidden>
            <DialogTitle>Novo Ciclo de Avaliação</DialogTitle>
            <DialogDescription>Configure um novo ciclo de avaliação de desempenho</DialogDescription>
          </VisuallyHidden>
          <div className="px-6 pt-6">
            <GradientDialogHeader
              icon={Calendar}
              title="Novo Ciclo de Avaliação"
              description="Defina período, abrangência, template e regras de quem avalia quem. O sistema gera automaticamente as avaliações dos elegíveis."
              gradient="from-sky-500 via-blue-500 to-indigo-600"
              glow="shadow-sky-500/40"
            />
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <CicloForm onSuccess={() => setShowForm(false)} />
          </div>
        </DialogContent>
      </Dialog>

      {iniciarCiclo && (
        <IniciarCicloDialog
          ciclo={iniciarCiclo}
          open={!!iniciarCiclo}
          onOpenChange={(open) => { if (!open) setIniciarCiclo(null); }}
          onSuccess={() => setIniciarCiclo(null)}
        />
      )}
    </div>
  );
}
