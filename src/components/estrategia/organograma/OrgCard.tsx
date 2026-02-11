import { Plus, Trash2, User, Briefcase } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EstrategiaOrganograma } from "@/types/estrategia";

const CARD_STYLE = {
  gradient: "bg-gradient-to-br from-emerald-500/10 to-emerald-500/5",
  border: "border-emerald-500/30 shadow-emerald-500/10",
  badge: "bg-emerald-500/15 text-emerald-700 border-emerald-500/20",
};

interface OrgCardProps {
  node: EstrategiaOrganograma;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string) => void;
}

export function OrgCard({ node, onDelete, onAddChild }: OrgCardProps) {
  return (
    <div
      className={cn(
        "relative group rounded-xl border-2 shadow-md px-5 py-4 min-w-[180px] max-w-[240px] text-center transition-all hover:shadow-lg",
        CARD_STYLE.gradient,
        CARD_STYLE.border
      )}
    >
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

      {/* Delete button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(node.id);
        }}
      >
        <Trash2 className="w-3 h-3" />
      </Button>

      {/* Add child button */}
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
    </div>
  );
}
