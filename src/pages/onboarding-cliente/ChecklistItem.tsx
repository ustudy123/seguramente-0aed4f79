import { CheckCircle2, Circle, Clock, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ChecklistItem({
  label, sublabel, done, pending, onClick, link
}: {
  label: string;
  sublabel?: string;
  done: boolean;
  pending?: boolean;
  onClick?: () => void;
  link?: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
        done ? 'bg-primary/5 border-primary/20' :
        pending ? 'bg-accent/30 border-accent animate-pulse' :
        'bg-muted/30 border-transparent hover:border-muted-foreground/20'
      } ${onClick ? 'cursor-pointer hover:bg-muted/50' : ''}`}
      onClick={onClick}
    >
      <div className="shrink-0">
        {done ? (
          <CheckCircle2 className="w-5 h-5 text-primary" />
        ) : pending ? (
          <Clock className="w-5 h-5 text-amber-500" />
        ) : (
          <Circle className="w-5 h-5 text-muted-foreground/40" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${done ? 'line-through text-muted-foreground' : ''}`}>{label}</p>
        {sublabel && <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>}
      </div>
      {link && !done && (
        <Button size="sm" variant="ghost" className="shrink-0 text-xs h-7"
          onClick={e => { e.stopPropagation(); window.open(link, '_blank'); }}>
          Acessar <ChevronRight className="w-3 h-3 ml-1" />
        </Button>
      )}
    </div>
  );
}
