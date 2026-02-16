import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Bell,
  Clock,
  AlertTriangle,
  XCircle,
  RotateCcw,
  CheckCheck,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useTrilhaNotificacoes, type TrilhaNotificacao } from "@/hooks/useTrilhaNotificacoes";

const tipoConfig: Record<
  TrilhaNotificacao["tipo"],
  { icon: React.ElementType; color: string; bg: string }
> = {
  prazo_proximo: { icon: Clock, color: "text-warning", bg: "bg-warning/10" },
  prazo_vencido: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
  abandono: { icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-500/10" },
  lembrete_retorno: { icon: RotateCcw, color: "text-info", bg: "bg-info/10" },
};

export function TrilhaNotificacoesBell() {
  const { notificacoes, naoLidas, isLoading, marcarLida, marcarTodasLidas } =
    useTrilhaNotificacoes();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="w-5 h-5 text-muted-foreground" />
          {naoLidas > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h4 className="text-sm font-semibold text-foreground">Notificações de Trilhas</h4>
          {naoLidas > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => marcarTodasLidas()}
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1" />
              Marcar todas como lidas
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-80">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : notificacoes.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notificacoes.map((notif) => {
                const config = tipoConfig[notif.tipo];
                const Icon = config.icon;
                return (
                  <button
                    key={notif.id}
                    onClick={() => {
                      if (!notif.lida) marcarLida(notif.id);
                    }}
                    className={cn(
                      "w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors flex gap-3",
                      !notif.lida && "bg-primary/[0.02]"
                    )}
                  >
                    <div className={cn("p-1.5 rounded-lg mt-0.5 flex-shrink-0", config.bg)}>
                      <Icon className={cn("w-4 h-4", config.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            "text-sm truncate",
                            notif.lida ? "text-muted-foreground" : "text-foreground font-medium"
                          )}
                        >
                          {notif.titulo}
                        </p>
                        {!notif.lida && (
                          <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                        )}
                      </div>
                      {notif.descricao && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {notif.descricao}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground/60 mt-1">
                        {formatDistanceToNow(new Date(notif.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
