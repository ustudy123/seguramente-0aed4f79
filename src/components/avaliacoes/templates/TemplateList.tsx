import { useState } from "react";
import { confirm } from "@/components/ui/confirm-dialog";
import { 
  Plus, 
  FileText, 
  MoreVertical,
  Trash2,
  Edit,
  Copy,
  CheckCircle,
  XCircle
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAvaliacoes } from "@/hooks/useAvaliacoes";
import { TemplateForm } from "./TemplateForm";
import type { AvaliacaoTemplate } from "@/types/avaliacao";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { GradientDialogHeader } from "@/components/pdi/GradientDialogHeader";

export function TemplateList() {
  const { templates, isLoadingTemplates, deleteTemplate, updateTemplate } = useAvaliacoes();
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<AvaliacaoTemplate | null>(null);

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({ title: "Excluir template", description: "Tem certeza que deseja excluir este template?", confirmLabel: "Excluir" });
    if (confirmed) {
      await deleteTemplate(id);
    }
  };

  const handleToggleAtivo = async (template: AvaliacaoTemplate) => {
    await updateTemplate({ 
      id: template.id, 
      nome: template.nome,
      ativo: !template.ativo 
    });
  };

  if (isLoadingTemplates) {
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
          <h2 className="text-lg font-semibold">Templates de Avaliação</h2>
          <p className="text-sm text-muted-foreground">
            Modelos reutilizáveis para ciclos de avaliação
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-muted rounded-full">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Nenhum template cadastrado</h3>
                <p className="text-muted-foreground">
                  Crie seu primeiro template para usar nos ciclos de avaliação.
                </p>
              </div>
              <Button onClick={() => setShowForm(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Criar Template
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card 
              key={template.id} 
              className={`hover:shadow-md transition-shadow ${
                !template.ativo ? "opacity-60" : ""
              }`}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={template.tipo === "360" ? "default" : "secondary"}>
                      {template.tipo === "360" ? "360°" : "Simples"}
                    </Badge>
                    {!template.ativo && (
                      <Badge variant="outline" className="text-muted-foreground">
                        Inativo
                      </Badge>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={() => setEditingTemplate(template)}
                        className="gap-2"
                      >
                        <Edit className="h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleToggleAtivo(template)}
                        className="gap-2"
                      >
                        {template.ativo ? (
                          <>
                            <XCircle className="h-4 w-4" />
                            Desativar
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4" />
                            Ativar
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2">
                        <Copy className="h-4 w-4" />
                        Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(template.id)}
                        className="gap-2 text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div>
                  <h3 className="font-semibold">{template.nome}</h3>
                  {template.descricao && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {template.descricao}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{template.categorias.length} categorias</span>
                  <span>{template.criterios.length} critérios</span>
                  <span>Escala {template.escala_min}-{template.escala_max}</span>
                </div>

                {template.categorias.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {template.categorias.slice(0, 3).map((cat) => (
                      <Badge key={cat.id} variant="outline" className="text-xs">
                        {cat.nome}
                      </Badge>
                    ))}
                    {template.categorias.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{template.categorias.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="w-full max-w-3xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b">
            <DialogTitle>Novo Template de Avaliação</DialogTitle>
            <DialogDescription>
              Crie um modelo reutilizável para seus ciclos de avaliação
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <TemplateForm onSuccess={() => setShowForm(false)} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
        <DialogContent className="w-full max-w-3xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b">
            <DialogTitle>Editar Template</DialogTitle>
            <DialogDescription>
              Modifique as configurações do template de avaliação
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {editingTemplate && (
              <TemplateForm 
                template={editingTemplate}
                onSuccess={() => setEditingTemplate(null)} 
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
