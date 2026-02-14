import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { 
  Inbox as InboxIcon, 
  Clock, 
  AlertTriangle, 
  ChevronRight,
  User,
  Target,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { PlanoAcao } from "@/types/planoAcao";

interface PlanoAcaoInboxProps {
  acoes: PlanoAcao[];
  isLoading: boolean;
}

const PRIORIDADE_CONFIG = {
  baixo: { label: "Baixa", color: "bg-success/10 text-success" },
  medio: { label: "Média", color: "bg-warning/10 text-warning" },
  urgente: { label: "Urgente", color: "bg-orange-500/10 text-orange-600" },
  imediato: { label: "Imediato", color: "bg-destructive/10 text-destructive" },
};

export function PlanoAcaoInbox({ acoes, isLoading }: PlanoAcaoInboxProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </CardContent>
      </Card>
    );
  }

  // Categorizar ações
  const atrasadas = acoes.filter(a => a.prazo && new Date(a.prazo) < new Date());
  const imediatas = acoes.filter(a => a.prioridade === 'imediato' && !atrasadas.includes(a));
  const urgentes = acoes.filter(a => a.prioridade === 'urgente' && !atrasadas.includes(a) && !imediatas.includes(a));
  const outras = acoes.filter(a => !atrasadas.includes(a) && !imediatas.includes(a) && !urgentes.includes(a));

  const sections = [
    { title: "Atrasadas", items: atrasadas, highlight: true },
    { title: "Prioridade Imediata", items: imediatas, highlight: false },
    { title: "Urgentes", items: urgentes, highlight: false },
    { title: "Outras Ações", items: outras, highlight: false },
  ].filter(s => s.items.length > 0);

  if (acoes.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <InboxIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground text-center">Sua caixa de entrada está vazia</p>
          <p className="text-sm text-muted-foreground/70 text-center mt-1">
            Ações atribuídas a você aparecerão aqui
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {sections.map((section, sIdx) => (
        <motion.div
          key={section.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: sIdx * 0.1 }}
        >
          <Card className={cn(section.highlight && "border-destructive/50")}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>{section.title}</span>
                <Badge variant="secondary">{section.items.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {section.items.map((acao, idx) => {
                const prioConfig = PRIORIDADE_CONFIG[acao.prioridade];
                const isLate = acao.prazo && new Date(acao.prazo) < new Date();

                return (
                  <motion.div
                    key={acao.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border hover:bg-accent cursor-pointer group transition-colors",
                      isLate && "bg-destructive/5 border-destructive/30"
                    )}
                    onClick={() => navigate(`/plano-acao/${acao.id}`)}
                  >
                    {/* GUT Score */}
                    <div className="flex flex-col items-center justify-center w-10 h-10 rounded bg-muted text-sm">
                      <span className="font-bold">{acao.pontuacao_gut || '-'}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-mono text-muted-foreground">{acao.codigo}</span>
                        <Badge className={cn("text-xs", prioConfig?.color)}>{prioConfig?.label}</Badge>
                      </div>
                      <p className="font-medium text-sm truncate">{acao.titulo}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {acao.prazo && (
                          <span className={cn("flex items-center gap-1", isLate && "text-destructive")}>
                            <Clock className="h-3 w-3" />
                            {isLate ? (
                              `Atrasado há ${formatDistanceToNow(new Date(acao.prazo), { locale: ptBR })}`
                            ) : (
                              `Prazo: ${format(new Date(acao.prazo), "dd/MM", { locale: ptBR })}`
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </motion.div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
