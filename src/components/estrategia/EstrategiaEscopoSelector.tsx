import { Building2, Users2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGruposEconomicos } from "@/hooks/useGruposEconomicos";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { cn } from "@/lib/utils";

export type EstrategiaEscopo =
  | { tipo: "empresa"; grupoId: null }
  | { tipo: "grupo"; grupoId: string };

interface Props {
  escopo: EstrategiaEscopo;
  onChange: (escopo: EstrategiaEscopo) => void;
}

export function EstrategiaEscopoSelector({ escopo, onChange }: Props) {
  const { grupos } = useGruposEconomicos();
  const { empresaAtiva } = useEmpresaAtiva();

  // Only show groups that the active company belongs to
  const gruposVisiveis = grupos.filter(
    (g) => g.ativo && empresaAtiva?.grupo_economico_id === g.id
  );

  const handleChange = (value: string) => {
    if (value === "empresa") {
      onChange({ tipo: "empresa", grupoId: null });
    } else {
      onChange({ tipo: "grupo", grupoId: value });
    }
  };

  // Reset to empresa scope if current group is no longer visible
  const selectedValue = escopo.tipo === "empresa"
    ? "empresa"
    : gruposVisiveis.some((g) => g.id === escopo.grupoId)
      ? escopo.grupoId!
      : "empresa";

  return (
    <div className="flex items-center gap-2 bg-muted/50 border rounded-lg px-3 py-2">
      <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
        Escopo:
      </span>
      <Select value={selectedValue} onValueChange={handleChange}>
        <SelectTrigger className="h-8 text-xs border-0 bg-transparent shadow-none focus:ring-0 w-auto min-w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="empresa">
            <span className="flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-primary" />
              <span>{empresaAtiva?.nome_fantasia || empresaAtiva?.razao_social || "Empresa selecionada"}</span>
            </span>
          </SelectItem>
          {grupos.length > 0 && (
            <>
              <div className="px-2 py-1 text-[11px] text-muted-foreground font-semibold uppercase tracking-wide mt-1">
                Grupos Econômicos
              </div>
              {grupos.filter((g) => g.ativo).map((grupo) => (
                <SelectItem key={grupo.id} value={grupo.id}>
                  <span className="flex items-center gap-2">
                    <Users2 className="w-3.5 h-3.5 text-accent-foreground" />
                    <span>{grupo.nome}</span>
                  </span>
                </SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>

      <Badge
        variant="outline"
        className={cn(
          "text-[10px] h-5 px-1.5",
          escopo.tipo === "empresa"
            ? "border-primary/30 text-primary bg-primary/5"
            : "border-amber-400/40 text-amber-600 bg-amber-50"
        )}
      >
        {escopo.tipo === "empresa" ? "Por empresa" : "Grupo econômico"}
      </Badge>
    </div>
  );
}
