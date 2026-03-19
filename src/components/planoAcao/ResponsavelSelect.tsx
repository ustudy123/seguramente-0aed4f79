import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useColaboradores } from "@/hooks/useColaboradores";

interface ResponsavelSelectProps {
  value: string;
  onChange: (value: string, id?: string) => void;
  placeholder?: string;
  className?: string;
}

export function ResponsavelSelect({ value, onChange, placeholder = "Selecione ou digite o responsável", className }: ResponsavelSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isManual, setIsManual] = useState(false);
  const { colaboradores, isLoading } = useColaboradores();

  const filtered = useMemo(() => {
    if (!search) return colaboradores.slice(0, 20);
    const lower = search.toLowerCase();
    return colaboradores.filter(c => 
      c.nome_completo.toLowerCase().includes(lower) ||
      c.cargo?.toLowerCase().includes(lower)
    ).slice(0, 20);
  }, [colaboradores, search]);

  if (isManual) {
    return (
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Digite o nome do responsável"
          className={className}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsManual(false)}
          className="shrink-0 text-xs"
        >
          Buscar
        </Button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground", className)}
          type="button"
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="p-2 border-b">
          <Input
            placeholder="Buscar colaborador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>
        <div className="max-h-[200px] overflow-y-auto p-1">
          {isLoading ? (
            <p className="text-sm text-muted-foreground p-2 text-center">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground p-2 text-center">Nenhum colaborador encontrado</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                className={cn(
                  "flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent cursor-pointer",
                  value === c.nome_completo && "bg-accent"
                )}
                onClick={() => {
                  onChange(c.nome_completo, c.id);
                  setOpen(false);
                  setSearch("");
                }}
              >
                <Check className={cn("h-4 w-4 shrink-0", value === c.nome_completo ? "opacity-100" : "opacity-0")} />
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.nome_completo}</p>
                  {c.cargo && <p className="text-xs text-muted-foreground truncate">{c.cargo}</p>}
                </div>
              </button>
            ))
          )}
        </div>
        <div className="border-t p-1">
          <button
            type="button"
            className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-accent cursor-pointer text-muted-foreground"
            onClick={() => {
              setIsManual(true);
              setOpen(false);
              setSearch("");
            }}
          >
            <UserPlus className="h-4 w-4" />
            Digitar manualmente
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
