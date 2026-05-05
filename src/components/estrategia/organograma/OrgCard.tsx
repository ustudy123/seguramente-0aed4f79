import { useState, type DragEvent } from "react";
import { Plus, Trash2, User, Briefcase, ArrowRight, GripVertical, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { EstrategiaOrganograma } from "@/types/estrategia";
import { useStorageImageUrl } from "@/hooks/useStorageImageUrl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const CARD_STYLE = {
  gradient: "bg-gradient-to-br from-emerald-500/10 to-emerald-500/5",
  border: "border-emerald-500/30 shadow-emerald-500/10",
  badge: "bg-emerald-500/15 text-emerald-700 border-emerald-500/20",
};

type DropPosition = "child" | "sibling" | null;

interface OrgCardProps {
  node: EstrategiaOrganograma & { colaborador?: { id: string; nome_completo: string; foto_url?: string } };
  onDelete: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onAddSibling: (parentId: string | undefined) => void;
  onMove?: (draggedId: string, targetId: string, position: "child" | "sibling") => void;
  onEdit?: (id: string, updates: Partial<EstrategiaOrganograma>) => void;
}

export function OrgCard({ node, onDelete, onAddChild, onAddSibling, onMove, onEdit }: OrgCardProps) {
  const fotoUrl = useStorageImageUrl(node.colaborador?.foto_url);
  const ocupanteNome = node.colaborador?.nome_completo || node.nome_ocupante;
  const [dropPosition, setDropPosition] = useState<DropPosition>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editTitulo, setEditTitulo] = useState(node.titulo);
  const [editOcupante, setEditOcupante] = useState(node.nome_ocupante || "");

  const handleDragStart = (e: DragEvent) => {
    e.dataTransfer.setData("text/plain", node.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.types.includes("text/plain") ? true : false;
    if (!draggedId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const threshold = rect.height * 0.6;

    setDropPosition(y > threshold ? "child" : "sibling");
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragLeave = () => {
    setDropPosition(null);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData("text/plain");
    if (!draggedId || draggedId === node.id) {
      setDropPosition(null);
      return;
    }
    if (onMove && dropPosition) {
      onMove(draggedId, node.id, dropPosition);
    }
    setDropPosition(null);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "relative group rounded-xl border-2 shadow-md px-5 py-4 min-w-[180px] max-w-[240px] text-center transition-all hover:shadow-lg cursor-grab active:cursor-grabbing",
        CARD_STYLE.gradient,
        CARD_STYLE.border,
        dropPosition === "child" && "ring-2 ring-primary ring-offset-2 border-primary/50",
        dropPosition === "sibling" && "ring-2 ring-secondary ring-offset-2 border-secondary/50",
      )}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Drop indicator */}
      {dropPosition && (
        <div className={cn(
          "absolute inset-x-0 text-[10px] font-medium pointer-events-none z-10",
          dropPosition === "child" ? "-bottom-5 text-primary" : "-top-5 text-secondary-foreground"
        )}>
          {dropPosition === "child" ? "↓ Mover como subordinado" : "→ Mover ao lado"}
        </div>
      )}

      {/* Drag handle */}
      <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-60 transition-opacity">
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
      </div>

      <div className="flex justify-center mb-2">
        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", CARD_STYLE.badge)}>
          <Briefcase className="w-5 h-5" />
        </div>
      </div>

      <p className="text-sm font-semibold text-foreground leading-tight">{node.titulo}</p>

      {node.nome_ocupante && (
        <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
          <User className="w-3 h-3" />
          {node.nome_ocupante}
        </p>
      )}

      <Badge variant="outline" className={cn("mt-2 text-[10px] border", CARD_STYLE.badge)}>
        Função
      </Badge>

      {/* Edit button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute -top-2 -left-2 h-6 w-6 rounded-full bg-background border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary hover:bg-primary/10"
        onClick={(e) => {
          e.stopPropagation();
          setEditTitulo(node.titulo);
          setEditOcupante(node.nome_ocupante || "");
          setEditOpen(true);
        }}
      >
        <Pencil className="w-3 h-3" />
      </Button>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Editar Posição</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome da função</Label>
              <Input value={editTitulo} onChange={(e) => setEditTitulo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Ocupante</Label>
              <Input value={editOcupante} onChange={(e) => setEditOcupante(e.target.value)} placeholder="Nome (opcional)" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button
              disabled={!editTitulo.trim()}
              onClick={() => {
                onEdit?.(node.id, { titulo: editTitulo.trim(), nome_ocupante: editOcupante.trim() || undefined });
                setEditOpen(false);
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete button */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => e.stopPropagation()}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir posição?</AlertDialogTitle>
            <AlertDialogDescription>
              A posição "{node.titulo}"{node.nome_ocupante ? ` (${node.nome_ocupante})` : ""} será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => onDelete(node.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add child (below) */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 h-6 w-6 rounded-full bg-primary text-primary-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/90"
            onClick={(e) => {
              e.stopPropagation();
              onAddChild(node.id);
            }}
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">Adicionar abaixo</TooltipContent>
      </Tooltip>

      {/* Add sibling (side) */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1/2 -right-3 -translate-y-1/2 h-6 w-6 rounded-full bg-secondary text-secondary-foreground border shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-secondary/80"
            onClick={(e) => {
              e.stopPropagation();
              onAddSibling(node.parent_id);
            }}
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">Adicionar ao lado</TooltipContent>
      </Tooltip>
    </div>
  );
}
