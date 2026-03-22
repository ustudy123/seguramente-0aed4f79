/**
 * CompetenciaInput — exibe e aceita MM/YYYY mas armazena YYYY-MM internamente.
 * Props compatíveis com um input controlado simples.
 */
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CompetenciaInputProps {
  value: string; // armazenado como YYYY-MM
  onChange: (value: string) => void; // emite YYYY-MM
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/** Converte YYYY-MM → MM/YYYY para exibição */
function toDisplay(val: string): string {
  if (!val) return "";
  const m = val.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${m[2]}/${m[1]}`;
  return val;
}

/** Converte MM/YYYY → YYYY-MM para persistência */
function toStore(display: string): string {
  const m = display.match(/^(\d{2})\/(\d{4})$/);
  if (m) return `${m[2]}-${m[1]}`;
  return display;
}

export function CompetenciaInput({
  value,
  onChange,
  placeholder = "MM/AAAA",
  className,
  disabled,
}: CompetenciaInputProps) {
  const [display, setDisplay] = useState(toDisplay(value));

  // Sincroniza quando value externo muda (p.ex. reset do form)
  useEffect(() => {
    setDisplay(toDisplay(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/[^\d/]/g, "");

    // Auto-inserção da barra após 2 dígitos
    if (raw.length === 2 && !raw.includes("/")) {
      raw = raw + "/";
    }

    // Limita a 7 caracteres: MM/AAAA
    if (raw.length > 7) raw = raw.slice(0, 7);

    setDisplay(raw);

    // Emite YYYY-MM somente quando estiver completo
    const stored = toStore(raw);
    if (/^\d{4}-\d{2}$/.test(stored)) {
      onChange(stored);
    } else if (raw === "") {
      onChange("");
    }
  };

  const handleBlur = () => {
    // Ao sair, normaliza o display baseado no valor salvo
    if (value) {
      setDisplay(toDisplay(value));
    }
  };

  return (
    <Input
      value={display}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={cn(className)}
      disabled={disabled}
      maxLength={7}
      inputMode="numeric"
    />
  );
}
