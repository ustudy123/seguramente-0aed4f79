import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export interface CBOOption {
  codigo: string;
  titulo: string;
}

interface Props {
  value?: string | null; // codigo CBO armazenado (somente dígitos)
  onChange: (codigo: string | null, option: CBOOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

/** Formata 6 dígitos como `0000-00`. */
function formatCbo(codigo: string): string {
  const d = (codigo || "").replace(/\D/g, "");
  if (d.length <= 4) return d;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}`;
}

export function CBOAutocomplete({ value, onChange, placeholder = "Buscar CBO por código ou título...", disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CBOOption[]>([]);
  const [selected, setSelected] = useState<CBOOption | null>(null);
  const [loading, setLoading] = useState(false);

  // Busca o título do CBO armazenado
  useEffect(() => {
    let active = true;
    if (!value) { setSelected(null); return; }
    if (selected?.codigo === value) return;
    (async () => {
      const { data } = await supabase
        .from("cbo_ocupacoes")
        .select("codigo, titulo")
        .eq("codigo", value)
        .maybeSingle();
      if (active && data) setSelected(data as CBOOption);
    })();
    return () => { active = false; };
  }, [value]);

  // Busca debounced
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(async () => {
      setLoading(true);
      const term = query.trim();
      const onlyDigits = term.replace(/\D/g, "");
      let q = supabase.from("cbo_ocupacoes").select("codigo, titulo").limit(40);
      if (!term) {
        q = q.order("codigo", { ascending: true });
      } else if (onlyDigits.length >= 2 && onlyDigits.length === term.replace(/-/g, "").length) {
        q = q.like("codigo", `${onlyDigits}%`).order("codigo");
      } else {
        q = q.ilike("titulo", `%${term}%`).order("titulo");
      }
      const { data } = await q;
      setResults((data || []) as CBOOption[]);
      setLoading(false);
    }, 200);
    return () => clearTimeout(handle);
  }, [query, open]);

  const handleSelect = (opt: CBOOption) => {
    setSelected(opt);
    onChange(opt.codigo, opt);
    setOpen(false);
    setQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(null);
    onChange(null, null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          {selected ? (
            <span className="truncate text-left">
              <span className="font-mono text-xs text-muted-foreground mr-2">{formatCbo(selected.codigo)}</span>
              {selected.titulo}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <span className="flex items-center gap-1 ml-2 shrink-0">
            {selected && (
              <X className="h-4 w-4 opacity-50 hover:opacity-100" onClick={handleClear} />
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[480px] p-0" align="start">
        <div className="flex items-center gap-2 border-b p-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Digite código ou título da ocupação..."
            className="h-8 border-0 focus-visible:ring-0 px-0"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <ScrollArea className="max-h-72">
          {results.length === 0 && !loading ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              {query ? "Nenhuma ocupação encontrada." : "Comece a digitar para buscar..."}
            </div>
          ) : (
            <ul className="py-1">
              {results.map((opt) => (
                <li key={opt.codigo}>
                  <button
                    type="button"
                    onClick={() => handleSelect(opt)}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-start gap-2",
                      selected?.codigo === opt.codigo && "bg-accent"
                    )}
                  >
                    <Check className={cn("h-4 w-4 mt-0.5 shrink-0", selected?.codigo === opt.codigo ? "opacity-100" : "opacity-0")} />
                    <span className="flex-1">
                      <span className="font-mono text-xs text-muted-foreground mr-2">{formatCbo(opt.codigo)}</span>
                      <span>{opt.titulo}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <div className="border-t px-3 py-2 text-xs text-muted-foreground">
          CBO — Classificação Brasileira de Ocupações. Aceita código com ou sem traço.
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Normaliza um código CBO de string (com ou sem traços/pontos) para apenas dígitos. */
export function normalizeCBO(input: string | null | undefined): string {
  if (!input) return "";
  return String(input).replace(/\D/g, "");
}

/** Formata o código CBO armazenado para exibição. */
export { formatCbo as formatCBO };
