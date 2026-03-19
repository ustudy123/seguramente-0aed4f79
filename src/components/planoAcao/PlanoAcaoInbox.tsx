import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { 
  Inbox as InboxIcon, 
  Clock, 
  ChevronRight,
  UserCheck,
  PenLine,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { PlanoAcao } from "@/types/planoAcao";

interface PlanoAcaoInboxProps {
  responsavel: PlanoAcao[];
  criadas: PlanoAcao[];
  isLoading: boolean;
}

const PRIORIDADE_CONFIG = {
  baixo: { label: "Baixa", color: "bg-success/10 text-success" },
  medio: { label: "Média", color: "bg-warning/10 text-warning" },
  urgente: { label: "Urgente", color: "bg-orange-500/10 text-orange-600" },
  imediato: { label: "Imediato", color: "bg-destructive/10 text-destructive" },
};

type InboxFilter = "responsavel" | "criadas";

function AcaoItem({ acao }: { acao: PlanoAcao }) {
  const navigate = useNavigate();
  const prioConfig = PRIORIDADE_CONFIG[acao.prioridade];
  const isLate = acao.prazo && new Date(acao.prazo) < new Date();

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border hover:bg-accent cursor-pointer group transition-colors",
        isLate && "bg-destructive/5 border-destructive/30"
      )}
      onClick={() => navigate(`/plano-acao/${acao.id}`)}
    >
      <div className="flex flex-col items-center justify-center w-10 h-10 rounded bg-muted text-sm">
        <span className="font-bold">{acao.pontuacao_gut || '-'}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-mono text-muted-foreground">{acao.codigo}</span>
          <Badge className={cn("text-xs", prioConfig?.color)}>{prioConfig?.label}</Badge>
          {acao.status === "concluida" && <Badge variant="outline" className="text-xs">Concluída</Badge>}
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
          {acao.responsavel_nome && (
            <span className="flex items-center gap-1">
              <UserCheck className="h-3 w-3" />
              {acao.responsavel_nome}
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.div>
  );
}

export function PlanoAcaoInbox({ responsavel, criadas, isLoading }: PlanoAcaoInboxProps) {
  const [filter, setFilter] = useState<InboxFilter>("responsavel");

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

  const acoes = filter === "responsavel" ? responsavel : criadas;

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setFilter("responsavel")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border",
            filter === "responsavel"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card text-muted-foreground border-border hover:bg-accent"
          )}
        >
          <UserCheck className="h-4 w-4" />
          Sou Responsável
          {responsavel.length > 0 && (
            <span className={cn(
              "ml-1 px-1.5 py-0.5 text-xs rounded-full",
              filter === "responsavel" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              {responsavel.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setFilter("criadas")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border",
            filter === "criadas"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card text-muted-foreground border-border hover:bg-accent"
          )}
        >
          <PenLine className="h-4 w-4" />
          Criadas por mim
          {criadas.length > 0 && (
            <span className={cn(
              "ml-1 px-1.5 py-0.5 text-xs rounded-full",
              filter === "criadas" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              {criadas.length}
            </span>
          )}
        </button>
      </div>

      {/* Lista */}
      {acoes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <InboxIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground text-center">
              {filter === "responsavel" 
                ? "Nenhuma ação atribuída a você" 
                : "Nenhuma ação criada por você"}
            </p>
            <p className="text-sm text-muted-foreground/70 text-center mt-1">
              {filter === "responsavel" 
                ? "Ações onde você é responsável aparecerão aqui" 
                : "Ações que você criou aparecerão aqui"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4 space-y-2">
            {acoes.map((acao) => (
              <AcaoItem key={acao.id} acao={acao} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
