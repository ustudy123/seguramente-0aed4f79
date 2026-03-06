import { Badge } from "@/components/ui/badge";
import { UsuarioStatus, STATUS_LABELS } from "@/hooks/useUsuarios";

const STATUS_VARIANT: Record<UsuarioStatus, string> = {
  ativo: "bg-success/15 text-success border-success/30",
  bloqueado: "bg-destructive/15 text-destructive border-destructive/30",
  suspenso: "bg-orange-500/15 text-orange-600 border-orange-500/30",
  inativo: "bg-muted text-muted-foreground",
  arquivado: "bg-muted text-muted-foreground",
  rascunho: "bg-slate-100 text-slate-600 border-slate-300",
  pendente_convite: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  convite_enviado: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  aguardando_ativacao: "bg-purple-500/15 text-purple-600 border-purple-500/30",
};

export function UsuarioStatusBadge({ status }: { status: UsuarioStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_VARIANT[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
