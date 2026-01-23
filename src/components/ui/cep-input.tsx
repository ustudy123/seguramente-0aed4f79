import * as React from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatCep, cleanCep, validateCep, buscarEnderecoPorCep, EnderecoData } from "@/lib/viacep";

export interface CepInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value?: string;
  onChange?: (value: string) => void;
  onAddressFound?: (endereco: EnderecoData) => void;
  showValidation?: boolean;
}

const CepInput = React.forwardRef<HTMLInputElement, CepInputProps>(
  ({ value = "", onChange, onAddressFound, showValidation = true, className, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState(() => formatCep(value));
    const [isLoading, setIsLoading] = React.useState(false);
    const [status, setStatus] = React.useState<"idle" | "valid" | "invalid">("idle");
    const lastSearchedCep = React.useRef<string>("");

    React.useEffect(() => {
      setDisplayValue(formatCep(value));
    }, [value]);

    const searchAddress = React.useCallback(async (cep: string) => {
      const cleaned = cleanCep(cep);
      
      // Avoid duplicate searches
      if (cleaned === lastSearchedCep.current || cleaned.length !== 8) {
        return;
      }
      
      lastSearchedCep.current = cleaned;
      setIsLoading(true);
      setStatus("idle");
      
      try {
        const endereco = await buscarEnderecoPorCep(cleaned);
        
        if (endereco) {
          setStatus("valid");
          onAddressFound?.(endereco);
        } else {
          setStatus("invalid");
        }
      } catch {
        setStatus("invalid");
      } finally {
        setIsLoading(false);
      }
    }, [onAddressFound]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      const cleaned = cleanCep(inputValue);
      
      // Limit to 8 digits
      if (cleaned.length <= 8) {
        const formatted = formatCep(inputValue);
        setDisplayValue(formatted);
        onChange?.(cleaned);
        
        // Reset status when changing
        if (cleaned.length < 8) {
          setStatus("idle");
          lastSearchedCep.current = "";
        }
      }
    };

    const handleBlur = () => {
      const cleaned = cleanCep(displayValue);
      if (validateCep(cleaned)) {
        searchAddress(cleaned);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === "Tab") {
        const cleaned = cleanCep(displayValue);
        if (validateCep(cleaned)) {
          searchAddress(cleaned);
        }
      }
    };

    return (
      <div className="relative">
        <Input
          ref={ref}
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="00000-000"
          maxLength={9}
          className={cn(
            "pr-10",
            showValidation && status === "valid" && "border-primary focus-visible:ring-primary",
            showValidation && status === "invalid" && "border-destructive focus-visible:ring-destructive",
            className
          )}
          {...props}
        />
        {showValidation && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {!isLoading && status === "valid" && (
              <CheckCircle2 className="h-4 w-4 text-primary" />
            )}
            {!isLoading && status === "invalid" && (
              <XCircle className="h-4 w-4 text-destructive" />
            )}
          </div>
        )}
      </div>
    );
  }
);

CepInput.displayName = "CepInput";

export { CepInput };
