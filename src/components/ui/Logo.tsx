// @ts-ignore
import logoImage from "@/assets/logo-seguramente.png?v=3";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  textClassName?: string;
}

const sizeClasses = {
  sm: "w-12 h-12",
  md: "w-16 h-16",
  lg: "w-20 h-20",
  xl: "w-28 h-28"
};

const textSizeClasses = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
  xl: "text-3xl"
};

export function Logo({ size = "md", showText = true, textClassName }: LogoProps) {
  return (
    <div className="flex items-center gap-3">
      <img
        src={logoImage}
        alt="Seguramente"
        className={sizeClasses[size]} />

      {showText



      }
    </div>);

}