import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { PerfilAuditLog } from "@/hooks/usePerfisAcesso";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  PlusCircle, Pencil, Copy, Power, PowerOff, UserPlus, UserMinus,
  History,
} from "lucide-react";

const ACAO_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  criacao: { label: "Criação", icon: PlusCircle, color: "text-emerald-600" },
  edicao: { label: "Edição", icon: Pencil, color: "text-blue-600" },
  clonagem: { label: "Clonagem", icon: Copy, color: "text-violet-600" },
  ativacao: { label: "Ativação", icon: Power, color: "text-emerald-600" },
  inativacao: { label: "Inativação", icon: PowerOff, color: "text-amber-600" },
  vinculacao: { label: "Vínculo criado", icon: UserPlus, color: "text-blue-600" },
  desvinculacao: { label: "Vínculo removido", icon: UserMinus, color: "text-red-600" },
};

interface AuditLogPerfilProps {
  logs: PerfilAuditLog[];
  loading?: boolean;
}

export function AuditLogPerfil({ logs, loading }: AuditLogPerfilProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12 space-y-2">
        <History className="w-8 h-8 text-muted-foreground/30 mx-auto" />
        <p className="text-sm text-muted-foreground">Nenhuma ação registrada ainda</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[480px]">
      <div className="space-y-2 pr-2">
        {logs.map((log) => {
          const config = ACAO_CONFIG[log.acao] || { label: log.acao, icon: History, color: "text-muted-foreground" };
          const Icon = config.icon;
          return (
            <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-card">
              <div className={`mt-0.5 ${config.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={`text-[10px] h-4 px-1.5 ${config.color} border-current/30`}>
                    {config.label}
                  </Badge>
                  {log.realizado_por_nome && (
                    <span className="text-[11px] text-muted-foreground">por {log.realizado_por_nome}</span>
                  )}
                  <span className="text-[11px] text-muted-foreground ml-auto">
                    {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
                {log.descricao && (
                  <p className="text-[12px] text-foreground/80 mt-0.5 truncate">{log.descricao}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
