import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  Edit,
  CheckCircle2,
  MessageSquare,
  User,
  Clock,
  AlertTriangle,
  History,
  FileText,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PlanoHistorico } from "@/types/planoAcao";

interface PlanoAcaoHistoricoProps {
  historico: PlanoHistorico[];
}

const eventoConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  criacao: { icon: Plus, color: "text-green-600", bgColor: "bg-green-100" },
  edicao: { icon: Edit, color: "text-blue-600", bgColor: "bg-blue-100" },
  status_alterado: { icon: ArrowRight, color: "text-purple-600", bgColor: "bg-purple-100" },
  tarefa_concluida: { icon: CheckCircle2, color: "text-green-600", bgColor: "bg-green-100" },
  comentario: { icon: MessageSquare, color: "text-blue-600", bgColor: "bg-blue-100" },
  responsavel_alterado: { icon: User, color: "text-orange-600", bgColor: "bg-orange-100" },
  prazo_alterado: { icon: Clock, color: "text-yellow-600", bgColor: "bg-yellow-100" },
  evidencia: { icon: FileText, color: "text-primary", bgColor: "bg-primary/10" },
};

export function PlanoAcaoHistorico({ historico }: PlanoAcaoHistoricoProps) {
  if (historico.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Nenhum evento registrado</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Histórico de Atividades</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Linha do tempo vertical */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-6">
            {historico.map((evento, index) => {
              const config = eventoConfig[evento.tipo_evento] || {
                icon: AlertTriangle,
                color: "text-muted-foreground",
                bgColor: "bg-muted",
              };
              const EventIcon = config.icon;

              return (
                <div key={evento.id} className="relative pl-10">
                  {/* Ícone na timeline */}
                  <div
                    className={`absolute left-0 w-8 h-8 rounded-full ${config.bgColor} flex items-center justify-center`}
                  >
                    <EventIcon className={`h-4 w-4 ${config.color}`} />
                  </div>

                  {/* Conteúdo */}
                  <div className="bg-muted/30 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{evento.descricao}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(evento.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>{evento.usuario_nome || "Sistema"}</span>
                    </div>

                    {/* Mostrar dados alterados se houver */}
                    {evento.dados_novos && Object.keys(evento.dados_novos).length > 0 && (
                      <div className="mt-2 p-2 bg-background rounded text-xs">
                        <span className="text-muted-foreground">Alterações: </span>
                        {Object.entries(evento.dados_novos).map(([key, value], i) => (
                          <span key={key}>
                            {i > 0 && ", "}
                            <span className="font-medium">{key}</span>: {String(value)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
