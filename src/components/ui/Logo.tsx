import logoImage from "@/assets/logo-seguramente.png";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  textClassName?: string;
}

const sizeClasses = {
  sm: "h-8",
  md: "h-12",
  lg: "h-16",
  xl: "h-20"
};

export function Logo({ size = "md", showText = true }: LogoProps) {
  return (
    <div className="flex items-center justify-center">
      <img
        src={logoImage}
        alt="Seguramente"
        className={`${sizeClasses[size]} w-auto object-contain`}
      />
    </div>
  );
}
