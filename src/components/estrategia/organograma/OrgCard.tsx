import { useState, type DragEvent } from "react";
import { Plus, Trash2, User, Briefcase, ArrowRight, GripVertical, Pencil, ArrowUp } from "lucide-react";
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
  onInsertBetween?: (childId: string) => void;
  onMove?: (draggedId: string, targetId: string, position: "child" | "sibling") => void;
  onEdit?: (id: string, updates: Partial<EstrategiaOrganograma>) => void;
}

export function OrgCard({ node, onDelete, onAddChild, onAddSibling, onInsertBetween, onMove, onEdit }: OrgCardProps) {
  const fotoUrl = useStorageImageUrl(node.colaborador?.foto_url);
  const ocupanteNome = node.colaborador?.nome_completo || node.nome_ocupante;
  const [dropPosition, setDropPosition] = useState<DropPosition>(null);
  const [isOver, setIsOver] = useState(false);

  const handleDragStart = (e: DragEvent) => {
    e.dataTransfer.setData("text/plain", node.id);
    e.dataTransfer.effectAllowed = "move";
    // Add a ghost image or just let browser handle it
    const dragImage = e.currentTarget.cloneNode(true) as HTMLElement;
    dragImage.style.opacity = "0.5";
    dragImage.style.position = "absolute";
    dragImage.style.top = "-1000px";
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 100, 50);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsOver(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    
    // Divide into 3 zones: top 25% (sibling above), middle 50% (child), bottom 25% (sibling below)
    if (y < rect.height * 0.25) {
      setDropPosition("sibling");
    } else if (y > rect.height * 0.75) {
      setDropPosition("sibling"); // We'll treat both as sibling for simplicity in this UI
    } else {
      setDropPosition("child");
    }
    
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragLeave = () => {
    setDropPosition(null);
    setIsOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOver(false);
    
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
        "relative group rounded-xl border-2 shadow-md px-5 py-4 min-w-[180px] max-w-[240px] h-[112px] flex flex-col justify-center text-center transition-all hover:shadow-lg cursor-grab active:cursor-grabbing",
        CARD_STYLE.gradient,
        CARD_STYLE.border,
        isOver && "scale-105",
        dropPosition === "child" && "ring-4 ring-primary ring-offset-2 border-primary bg-primary/5",
        dropPosition === "sibling" && "ring-4 ring-secondary ring-offset-2 border-secondary bg-secondary/5",
      )}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Drop indicator overlay */}
      {isOver && dropPosition && (
        <div className={cn(
          "absolute inset-0 flex items-center justify-center rounded-xl bg-background/40 backdrop-blur-[1px] z-20 pointer-events-none border-2 dashed",
          dropPosition === "child" ? "border-primary" : "border-secondary"
        )}>
          <div className={cn(
            "px-3 py-1 rounded-full text-xs font-bold shadow-sm",
            dropPosition === "child" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
          )}>
            {dropPosition === "child" ? "Vincular como Subordinado" : "Mover para este Nível"}
          </div>
        </div>
      )}

      {/* Drag handle */}
      <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-60 transition-opacity">
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
      </div>

      <div className="flex justify-center mb-2">
        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", !fotoUrl && CARD_STYLE.badge)}>
          {fotoUrl ? (
            <Avatar className="w-10 h-10 border-2 border-primary/20">
              <AvatarImage src={fotoUrl} alt={ocupanteNome || "Ocupante"} />
              <AvatarFallback><User className="w-5 h-5" /></AvatarFallback>
            </Avatar>
          ) : (
            <Briefcase className="w-5 h-5" />
          )}
        </div>
      </div>

      <p className="text-sm font-semibold text-foreground leading-tight">{node.titulo}</p>

      {ocupanteNome && (
        <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
          {!fotoUrl && <User className="w-3 h-3" />}
          {ocupanteNome}
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
          onEdit?.(node.id, {});
        }}
      >
        <Pencil className="w-3 h-3" />
      </Button>


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
              A posição "{node.titulo}"{ocupanteNome ? ` (${ocupanteNome})` : ""} será removida permanentemente.
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

      {/* Insert between (above) */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute -top-3 left-1/2 -translate-x-1/2 h-6 w-6 rounded-full bg-amber-500 text-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-amber-600"
            onClick={(e) => {
              e.stopPropagation();
              onInsertBetween?.(node.id);
            }}
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">Inserir entre (acima)</TooltipContent>
      </Tooltip>

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
