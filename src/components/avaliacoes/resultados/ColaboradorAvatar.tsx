import { useStorageImageUrl } from "@/hooks/useStorageImageUrl";
import { cn } from "@/lib/utils";

interface ColaboradorAvatarProps {
  nome: string;
  fotoUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
}

export function ColaboradorAvatar({ nome, fotoUrl, className, fallbackClassName }: ColaboradorAvatarProps) {
  const resolved = useStorageImageUrl(fotoUrl || null, "documentos");

  return (
    <div className={cn("rounded-full overflow-hidden bg-muted flex items-center justify-center", className)}>
      {resolved ? (
        <img src={resolved} alt={nome} className="w-full h-full object-cover" />
      ) : (
        <span className={cn("text-xs font-bold text-foreground", fallbackClassName)}>
          {nome?.charAt(0)?.toUpperCase() || "?"}
        </span>
      )}
    </div>
  );
}
