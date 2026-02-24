import { Building2, AlertTriangle } from "lucide-react";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";

export function EmpresaAtivaBanner() {
  const { empresaAtiva, empresas } = useEmpresaAtiva();

  if (empresas.length <= 1) return null;

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
        empresaAtiva
          ? "border-primary/30 bg-primary/5 text-primary"
          : "border-orange-400/40 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400"
      }`}
    >
      {empresaAtiva ? (
        <Building2 className="h-4 w-4 shrink-0" />
      ) : (
        <AlertTriangle className="h-4 w-4 shrink-0" />
      )}
      <span>
        {empresaAtiva ? (
          <>
            Registrando para: <strong>{empresaAtiva.razao_social}</strong>
          </>
        ) : (
          <>
            <strong>Nenhuma empresa selecionada.</strong> Selecione uma empresa no
            cabeçalho antes de cadastrar.
          </>
        )}
      </span>
    </div>
  );
}
