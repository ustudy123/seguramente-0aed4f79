import { 
  Shield, Activity, Stethoscope, Brain, HeartPulse, 
  GraduationCap, Scale, Users, Sparkles 
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MarketplaceCategoria } from "@/hooks/useMarketplace";

const iconMap: Record<string, React.ElementType> = {
  Shield, Activity, Stethoscope, Brain, HeartPulse,
  GraduationCap, Scale, Users,
};

interface MarketplaceCategoriasProps {
  categorias: MarketplaceCategoria[];
  selectedId?: string;
  onSelect: (id?: string) => void;
}

export function MarketplaceCategorias({ categorias, selectedId, onSelect }: MarketplaceCategoriasProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(undefined)}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border",
          !selectedId
            ? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-transparent shadow-lg shadow-indigo-500/25"
            : "bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
        )}
      >
        <Sparkles className="h-4 w-4" />
        Todos
      </button>
      {categorias.map((cat) => {
        const Icon = iconMap[cat.icone || ""] || Shield;
        const isSelected = selectedId === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => onSelect(isSelected ? undefined : cat.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border",
              isSelected
                ? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-transparent shadow-lg shadow-indigo-500/25"
                : "bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {cat.nome}
          </button>
        );
      })}
    </div>
  );
}
