// @ts-ignore
import logoImage from "@/assets/logo-seguramente.png?v=2";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  textClassName?: string;
}

const sizeClasses = {
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-12 h-12",
  xl: "w-16 h-16",
};

const textSizeClasses = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
  xl: "text-3xl",
};

export function Logo({ size = "md", showText = true, textClassName }: LogoProps) {
  return (
    <div className="flex items-center gap-3">
      <img 
        src={logoImage} 
        alt="Seguramente" 
        className={sizeClasses[size]}
      />
      {showText && (
        <span className={`font-bold tracking-tight ${textSizeClasses[size]} ${textClassName || "text-foreground"}`}>
          Seguramente
        </span>
      )}
    </div>
  );
}
