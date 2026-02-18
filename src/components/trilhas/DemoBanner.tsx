import { Info } from "lucide-react";

export function DemoBanner() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-2.5 text-sm text-warning">
      <Info className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
      <span>
        <strong>Modo demonstração</strong> — Os dados exibidos são fictícios para fins de visualização.
      </span>
    </div>
  );
}
