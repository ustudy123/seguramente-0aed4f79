import { motion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Upload,
  FolderInput,
  Pencil,
  Trash2,
  RotateCcw,
  Clock,
  User,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocumentoAuditLog as AuditLogType } from "@/types/documentoPasta";

const actionConfig = {
  upload: {
    label: "Upload",
    icon: Upload,
    color: "text-success",
    bgColor: "bg-success/10",
  },
  move: {
    label: "Movimentação",
    icon: FolderInput,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  rename: {
    label: "Renomeação",
    icon: Pencil,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
  delete: {
    label: "Exclusão",
    icon: Trash2,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
  },
  restore: {
    label: "Restauração",
    icon: RotateCcw,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
};

interface DocumentoAuditLogProps {
  logs: AuditLogType[];
  loading: boolean;
}

export function DocumentoAuditLog({ logs, loading }: DocumentoAuditLogProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-pulse text-muted-foreground">
          Carregando histórico...
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Clock className="w-12 h-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">
          Nenhuma movimentação registrada ainda.
        </p>
        <p className="text-sm text-muted-foreground/70">
          As movimentações de documentos serão exibidas aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="w-4 h-4" />
        Últimas {logs.length} movimentações
      </div>

      <div className="space-y-2">
        {logs.map((log, index) => {
          const config = actionConfig[log.acao];
          const ActionIcon = config?.icon || FileText;

          return (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
              className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className={cn("p-2 rounded-lg", config?.bgColor)}>
                <ActionIcon className={cn("w-4 h-4", config?.color)} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn("font-medium text-sm", config?.color)}>
                    {config?.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(log.created_at), "dd MMM yyyy, HH:mm", {
                      locale: ptBR,
                    })}
                  </span>
                </div>

                <p className="text-sm text-foreground truncate">
                  {log.documento_nome}
                </p>

                {log.acao === "move" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {log.pasta_origem_nome || "Sem pasta"} → {log.pasta_destino_nome || "Sem pasta"}
                  </p>
                )}

                {log.usuario_nome && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <User className="w-3 h-3" />
                    {log.usuario_nome}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
