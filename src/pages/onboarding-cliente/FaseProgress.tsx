import { CheckCircle2 } from "lucide-react";
import { FASES } from "./constants";

export function FaseProgress({ fase }: { fase: string }) {
  const currentIdx = FASES.findIndex(f => f.key === fase);
  
  return (
    <div className="w-full">
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 right-0 top-4 h-0.5 bg-muted-foreground/20" />
        <div
          className="absolute left-0 top-4 h-0.5 bg-primary transition-all duration-700"
          style={{ width: `${Math.max(0, (currentIdx / (FASES.length - 1)) * 100)}%` }}
        />
        {FASES.map((f, i) => {
          const done = i < currentIdx;
          const current = i === currentIdx;
          return (
            <div key={f.key} className="flex flex-col items-center gap-1.5 relative z-10">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                done ? 'bg-primary text-primary-foreground' :
                current ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' :
                'bg-background border-2 border-muted-foreground/30 text-muted-foreground'
              }`}>
                {done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${
                current ? 'text-primary' : done ? 'text-muted-foreground' : 'text-muted-foreground/50'
              }`}>{f.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
