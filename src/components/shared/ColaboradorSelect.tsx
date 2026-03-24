import { useState, useMemo } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Colaborador {
  id: string;
  nome_completo: string;
  cargo: string;
  departamento?: string | null;
  filial?: string | null;
  cpf?: string;
}

interface ColaboradorSelectProps {
  value: string;
  onChange: (id: string) => void;
  colaboradores: Colaborador[];
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

export function ColaboradorSelect({
  value,
  onChange,
  colaboradores,
  isLoading,
  placeholder = "Selecione o colaborador",
  className,
}: ColaboradorSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = colaboradores.find((c) => c.id === value);

  const filtered = useMemo(() => {
    if (!search) return colaboradores.slice(0, 30);
    const lower = search.toLowerCase();
    return colaboradores
      .filter(
        (c) =>
          c.nome_completo.toLowerCase().includes(lower) ||
          c.cargo?.toLowerCase().includes(lower) ||
          c.departamento?.toLowerCase().includes(lower)
      )
      .slice(0, 30);
  }, [colaboradores, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal h-10",
            !value && "text-muted-foreground",
            className
          )}
          type="button"
        >
          <span className="truncate">
            {isLoading
              ? "Carregando..."
              : selected
              ? `${selected.nome_completo} — ${selected.cargo}`
              : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="p-2 border-b">
          <Input
            placeholder="Buscar por nome, cargo ou departamento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
            autoFocus
          />
        </div>
        <div className="max-h-[250px] overflow-y-auto p-1">
          {isLoading ? (
            <p className="text-sm text-muted-foreground p-3 text-center">
              Carregando...
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground p-3 text-center">
              Nenhum colaborador encontrado
            </p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                className={cn(
                  "flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent cursor-pointer",
                  value === c.id && "bg-accent"
                )}
                onClick={() => {
                  onChange(c.id);
                  setOpen(false);
                  setSearch("");
                }}
              >
                <Check
                  className={cn(
                    "h-4 w-4 shrink-0",
                    value === c.id ? "opacity-100" : "opacity-0"
                  )}
                />
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.nome_completo}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.cargo}
                    {c.departamento ? ` · ${c.departamento}` : ""}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
