/**
 * CompetenciaInput — seletor de competência (mês/ano).
 *
 * O RH reclamou de ter que apagar e digitar a competência toda vez; agora é
 * uma lista pronta de meses. O valor continua em YYYY-MM para não afetar
 * nenhum consumidor.
 */
import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface CompetenciaInputProps {
  value: string; // YYYY-MM
  onChange: (value: string) => void; // emite YYYY-MM
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Meses anteriores ao atual exibidos na lista. */
  mesesAnteriores?: number;
  /** Meses futuros exibidos na lista. */
  mesesFuturos?: number;
}

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function rotulo(comp: string): string {
  const m = comp.match(/^(\d{4})-(\d{2})$/);
  if (!m) return comp;
  const idx = Number(m[2]) - 1;
  return `${MESES[idx] ?? m[2]}/${m[1]}`;
}

export function CompetenciaInput({
  value,
  onChange,
  placeholder = "Selecione a competência",
  className,
  disabled,
  mesesAnteriores = 24,
  mesesFuturos = 6,
}: CompetenciaInputProps) {
  const opcoes = useMemo(() => {
    const hoje = new Date();
    const lista: string[] = [];
    for (let i = mesesFuturos; i >= -mesesAnteriores; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      const comp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      lista.push(comp);
    }
    // Garante que uma competência histórica já salva apareça na lista.
    if (value && !lista.includes(value)) {
      lista.push(value);
      lista.sort((a, b) => b.localeCompare(a));
    }
    return lista;
  }, [value, mesesAnteriores, mesesFuturos]);

  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72 bg-popover">
        {opcoes.map((comp) => (
          <SelectItem key={comp} value={comp}>
            {rotulo(comp)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
