import { Check, X } from "lucide-react";
import { checkPassword, passwordStrength, PASSWORD_MIN_LENGTH } from "@/lib/passwordPolicy";
import { cn } from "@/lib/utils";

interface PasswordStrengthProps {
  value: string;
  className?: string;
}

const items: { key: keyof ReturnType<typeof checkPassword>; label: string }[] = [
  { key: "length", label: `Mínimo ${PASSWORD_MIN_LENGTH} caracteres` },
  { key: "lower", label: "Letra minúscula" },
  { key: "upper", label: "Letra maiúscula" },
  { key: "digit", label: "Número" },
  { key: "symbol", label: "Símbolo (!@#$…)" },
];

export function PasswordStrength({ value, className }: PasswordStrengthProps) {
  const checks = checkPassword(value);
  const { score, label } = passwordStrength(value);
  const barColor =
    score <= 2 ? "bg-destructive" : score === 3 ? "bg-yellow-500" : score === 4 ? "bg-blue-500" : "bg-green-500";

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full transition-all", barColor)}
            style={{ width: `${(score / 5) * 100}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground w-16 text-right">{value ? label : ""}</span>
      </div>
      <ul className="grid grid-cols-2 gap-1 text-xs">
        {items.map((it) => {
          const ok = checks[it.key];
          return (
            <li
              key={it.key}
              className={cn("flex items-center gap-1.5", ok ? "text-green-600 dark:text-green-400" : "text-muted-foreground")}
            >
              {ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
              {it.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
