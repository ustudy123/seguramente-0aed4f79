import * as React from "react";
import { Input } from "@/components/ui/input";

export interface PhoneInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value?: string;
  onChange?: (value: string) => void;
}

/**
 * Formats a phone number to (XX) XXXXX-XXXX pattern
 */
export const formatPhone = (value: string): string => {
  const numbers = value.replace(/\D/g, "");
  
  if (numbers.length <= 2) {
    return numbers.length > 0 ? `(${numbers}` : "";
  }
  
  if (numbers.length <= 7) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  }
  
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
};

/**
 * Removes formatting from phone number, returning only digits
 */
export const cleanPhone = (phone: string): string => {
  return phone.replace(/\D/g, "");
};

/**
 * Validates if phone number has correct length (10 or 11 digits)
 */
export const validatePhone = (phone: string): boolean => {
  const cleaned = cleanPhone(phone);
  return cleaned.length === 10 || cleaned.length === 11;
};

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value = "", onChange, className, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState(() => formatPhone(value));

    React.useEffect(() => {
      setDisplayValue(formatPhone(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      const formatted = formatPhone(inputValue);
      const cleaned = cleanPhone(inputValue);
      
      // Limit to 11 digits
      if (cleaned.length <= 11) {
        setDisplayValue(formatted);
        onChange?.(cleaned);
      }
    };

    return (
      <Input
        ref={ref}
        type="tel"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        placeholder="(00) 00000-0000"
        maxLength={15}
        className={className}
        {...props}
      />
    );
  }
);

PhoneInput.displayName = "PhoneInput";

export { PhoneInput };
