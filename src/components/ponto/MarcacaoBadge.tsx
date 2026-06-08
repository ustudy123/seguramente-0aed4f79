import { useState } from "react";
import { LogIn, LogOut, Pencil, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Props {
  id: string;
  hora: string;
  isEntry: boolean;
  original: boolean;
  podeEditar: boolean;
  editando: boolean;
  onSalvar: (args: { marcacaoId: string; novaHora: string }) => Promise<unknown>;
}

export function MarcacaoBadge({ id, hora, isEntry, original, podeEditar, editando, onSalvar }: Props) {
  const [open, setOpen] = useState(false);
  const [novaHora, setNovaHora] = useState(hora?.substring(0, 5) || "");

  const badgeClasses = cn(
    "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono border transition",
    original ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200",
    podeEditar && "cursor-pointer hover:opacity-80 hover:shadow-sm"
  );

  const content = (
    <>
      {isEntry ? <LogIn className="w-3 h-3" /> : <LogOut className="w-3 h-3" />}
      {hora?.substring(0, 5)}
      {podeEditar && <Pencil className="w-2.5 h-2.5 opacity-60 ml-0.5" />}
    </>
  );

  if (!podeEditar) {
    return (
      <span className={badgeClasses} title={original ? "Registro Nativo" : "Registro Ajustado"}>
        {content}
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setNovaHora(hora?.substring(0, 5) || ""); }}>
      <PopoverTrigger asChild>
        <button type="button" className={badgeClasses} title="Clique para editar a marcação">
          {content}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
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
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={editando}>
              Cancelar
            </Button>
            <Button
              size="sm"
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
  );
}
