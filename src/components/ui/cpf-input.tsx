import * as React from "react";
import { Input } from "@/components/ui/input";
import { formatCpf, cleanCpf, validateCpf } from "@/lib/cpf";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle } from "lucide-react";

export interface CpfInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value?: string;
  onChange?: (value: string) => void;
  onValidChange?: (isValid: boolean) => void;
  showValidation?: boolean;
}

const CpfInput = React.forwardRef<HTMLInputElement, CpfInputProps>(
  ({ className, value = "", onChange, onValidChange, showValidation = true, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState(() => formatCpf(value));
    const [isValid, setIsValid] = React.useState<boolean | null>(null);

    // Sync display value when external value changes
    React.useEffect(() => {
      setDisplayValue(formatCpf(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value;
      const cleaned = cleanCpf(input);
      
      // Limitar a 11 dígitos
      if (cleaned.length > 11) return;
      
      const formatted = formatCpf(cleaned);
      setDisplayValue(formatted);
      
      // Enviar valor limpo (apenas números) para o form
      onChange?.(cleaned);
      
      // Validar quando tiver 11 dígitos
      if (cleaned.length === 11) {
        const valid = validateCpf(cleaned);
        setIsValid(valid);
        onValidChange?.(valid);
      } else {
        setIsValid(null);
        onValidChange?.(false);
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const cleaned = cleanCpf(displayValue);
      if (cleaned.length === 11) {
        const valid = validateCpf(cleaned);
        setIsValid(valid);
        onValidChange?.(valid);
      }
      props.onBlur?.(e);
    };

    return (
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={props.placeholder || "000.000.000-00"}
          className={cn(
            showValidation && isValid !== null && "pr-10",
            showValidation && isValid === false && "border-destructive focus-visible:ring-destructive",
            showValidation && isValid === true && "border-primary focus-visible:ring-primary",
            className
          )}
        />
        {showValidation && isValid !== null && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isValid ? (
              <CheckCircle2 className="h-4 w-4 text-primary" />
            ) : (
              <XCircle className="h-4 w-4 text-destructive" />
            )}
          </div>
        )}
      </div>
    );
  }
);

CpfInput.displayName = "CpfInput";

export { CpfInput };
