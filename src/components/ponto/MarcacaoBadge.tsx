import { useState } from "react";
import { LogIn, LogOut, Pencil, Loader2, Trash2, MapPin, Camera, Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirm } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  id: string;
  hora: string;
  isEntry: boolean;
  original: boolean;
  podeEditar: boolean;
  editando: boolean;
  onSalvar: (args: { marcacaoId: string; novaHora: string }) => Promise<unknown>;
  onExcluir?: (args: { marcacaoId: string }) => Promise<unknown>;
  excluindo?: boolean;
  endereco?: string;
  selfieUrl?: string;
  tipo?: string;
  distanciaMetros?: number | null;
  dentroCerca?: boolean | null;
}

export function MarcacaoBadge({ 
  id, hora, isEntry, original, podeEditar, editando, onSalvar, onExcluir, excluindo,
  endereco, selfieUrl, tipo, distanciaMetros, dentroCerca
}: Props) {
  const [open, setOpen] = useState(false);
  const [novaHora, setNovaHora] = useState(hora?.substring(0, 5) || "");

  const badgeClasses = cn(
    "flex items-center justify-between p-2 rounded-lg border transition-all w-full",
    isEntry
      ? "bg-emerald-50 text-emerald-700 border-emerald-100 hover:border-emerald-300"
      : "bg-rose-50 text-rose-700 border-rose-100 hover:border-rose-300",
    podeEditar && "cursor-pointer"
  );

  const content = (
    <div className="flex items-center gap-3 w-full">
      <div className={cn(
        "p-1.5 rounded-full",
        isEntry ? "bg-emerald-100" : "bg-rose-100"
      )}>
        {isEntry ? <LogIn className="w-3.5 h-3.5" /> : <LogOut className="w-3.5 h-3.5" />}
      </div>
      
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-sm">{hora?.substring(0, 5)}</span>
          <span className="text-[10px] uppercase font-semibold opacity-70">
            {tipo === 'batida' ? (isEntry ? 'Entrada' : 'Saída') : (tipo || (isEntry ? 'Entrada' : 'Saída'))}
          </span>
          {!original && <span className="text-[9px] bg-amber-100 text-amber-700 px-1 rounded">Ajustado</span>}
        </div>
        
        {endereco && (
          <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground line-clamp-1">
            <MapPin className="w-2.5 h-2.5 shrink-0" />
            {endereco}
          </div>
        )}
      </div>

      {selfieUrl && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-8 h-8 rounded border bg-muted overflow-hidden shrink-0">
                <img src={selfieUrl} alt="Selfie" className="w-full h-full object-cover" />
              </div>
            </TooltipTrigger>
            <TooltipContent className="p-0 border-none">
              <img src={selfieUrl} alt="Selfie ampliada" className="w-48 h-48 object-cover rounded-lg shadow-xl" />
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {podeEditar && <Pencil className="w-3 h-3 opacity-40" />}
    </div>
  );

  if (!podeEditar) {
    return (
      <div className={badgeClasses} title={original ? "Registro Nativo" : "Registro Ajustado"}>
        {content}
      </div>
    );
  }

  return (
    <>
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setNovaHora(hora?.substring(0, 5) || ""); }}>
        <PopoverTrigger asChild>
          <button type="button" className={badgeClasses} title="Clique para editar ou excluir a marcação">
            {content}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 max-w-[calc(100vw-2rem)] p-3" align="start" collisionPadding={16}>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold">Editar marcação</p>
              <p className="text-[11px] text-muted-foreground">A alteração será registrada como ajuste pelo gestor.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nova hora</Label>
              <Input
                type="time"
                value={novaHora}
                onChange={(e) => setNovaHora(e.target.value)}
                step={60}
              />
            </div>
            <div className="flex items-center gap-2">
              {onExcluir && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="flex-1 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={editando || excluindo}
                  onClick={async () => {
                    setOpen(false);
                    const ok = await confirm({
                      title: "Excluir marcação?",
                      description: `A marcação das ${hora?.substring(0, 5)} será excluída permanentemente e a jornada do dia será recalculada. Use apenas para batidas duplicadas ou incorretas.`,
                      confirmLabel: "Excluir",
                      variant: "destructive",
                    });
                    if (ok) await onExcluir({ marcacaoId: id });
                  }}
                  title="Excluir esta marcação (para batidas duplicadas/incorretas)"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
                </Button>
              )}
              <Button size="sm" variant="ghost" className="flex-1 px-2" onClick={() => setOpen(false)} disabled={editando}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className="flex-1 px-2"
                disabled={editando || !novaHora || novaHora === hora?.substring(0, 5)}
                onClick={async () => {
                  await onSalvar({ marcacaoId: id, novaHora });
                  setOpen(false);
                }}
              >
                {editando ? <Loader2 className="w-3 h-3 animate-spin" /> : "Salvar"}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
