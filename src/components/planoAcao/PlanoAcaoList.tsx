import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Clock, 
  User, 
  ChevronRight, 
  AlertTriangle,
  CheckCircle2,
  Target,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  MapPin,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { PlanoAcao } from "@/types/planoAcao";
import { PlanoAcaoFormModal } from "./PlanoAcaoFormModal";

interface PlanoAcaoListProps {
  acoes: PlanoAcao[];
  isLoading: boolean;
  emptyMessage?: string;
}

const PRIORIDADE_CONFIG = {
  baixo: { label: "Baixa", color: "bg-success/10 text-success border-success/30" },
  medio: { label: "Média", color: "bg-warning/10 text-warning border-warning/30" },
  urgente: { label: "Urgente", color: "bg-orange-500/10 text-orange-600 border-orange-500/30" },
  imediato: { label: "Imediato", color: "bg-destructive/10 text-destructive border-destructive/30" },
};

const STATUS_CONFIG = {
  pendente: { label: "Pendente", color: "bg-muted text-muted-foreground", icon: Clock },
  em_andamento: { label: "Em Andamento", color: "bg-blue-500/10 text-blue-600", icon: Target },
  pausada: { label: "Pausada", color: "bg-warning/10 text-warning", icon: AlertTriangle },
  concluida: { label: "Concluída", color: "bg-success/10 text-success", icon: CheckCircle2 },
  cancelada: { label: "Cancelada", color: "bg-destructive/10 text-destructive", icon: Trash2 },
};

const ORIGEM_LABELS: Record<string, { label: string }> = {
  manual: { label: "Manual" },
  ergonomia: { label: "Ergonomia" },
  ouvidoria: { label: "Ouvidoria" },
  epi: { label: "EPIs" },
  ponto: { label: "Ponto" },
  humor: { label: "Humor" },
  psicossocial: { label: "Psicossocial" },
  atestados: { label: "Atestados" },
  sst: { label: "SST" },
  compliance_sst: { label: "Compliance SST" },
  compliance: { label: "Compliance" },
  documentos: { label: "Documentos" },
  avaliacoes: { label: "Avaliações" },
  estrategia: { label: "Estratégia" },
  gro: { label: "GRO" },
};

export function PlanoAcaoList({ acoes, isLoading, emptyMessage = "Nenhuma ação encontrada" }: PlanoAcaoListProps) {
  const navigate = useNavigate();
  const [editAcao, setEditAcao] = useState<PlanoAcao | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (acoes.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Target className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground text-center">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  const isAtrasada = (acao: PlanoAcao) => {
    if (!acao.prazo || acao.status === 'concluida') return false;
    return new Date(acao.prazo) < new Date();
  };

  return (
  const sortedAcoes = [...acoes].sort((a, b) => {
    const scoreA = a.pontuacao_gut ?? 0;
    const scoreB = b.pontuacao_gut ?? 0;
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {sortedAcoes.map((acao, idx) => {
          const prioConfig = PRIORIDADE_CONFIG[acao.prioridade];
          const statusConfig = STATUS_CONFIG[acao.status];
          const StatusIcon = statusConfig?.icon || Clock;
          const atrasada = isAtrasada(acao);

          return (
            <motion.div
              key={acao.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: idx * 0.03 }}
            >
              <Card 
                className={cn(
                  "hover:shadow-md transition-all cursor-pointer group",
                  atrasada && "border-destructive/50 bg-destructive/5"
                )}
                onClick={() => navigate(`/plano-acao/${acao.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* GUT Score */}
                    <div className="hidden sm:flex flex-col items-center justify-center w-14 h-14 rounded-lg bg-muted shrink-0">
                      <span className="text-lg font-bold">{acao.pontuacao_gut || '-'}</span>
                      <span className="text-[10px] text-muted-foreground">GUT</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-xs font-mono text-muted-foreground">
                              {acao.codigo}
                            </span>
                            <Badge variant="outline" className={cn("text-xs", prioConfig?.color)}>
                              {prioConfig?.label}
                            </Badge>
                            <Badge variant="outline" className={cn("text-xs", statusConfig?.color)}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusConfig?.label}
                            </Badge>
                            {atrasada && (
                              <Badge variant="destructive" className="text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Atrasada
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" />
                              Criado em: {format(new Date(acao.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          <h3 className="font-medium truncate">{acao.titulo}</h3>
                          {acao.descricao && (
                            <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                              {acao.descricao}
                            </p>
                          )}
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/plano-acao/${acao.id}`); }}>
                              <Eye className="h-4 w-4 mr-2" />
                              Visualizar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditAcao(acao); }}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Meta info */}
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
                        {acao.responsavel_nome && (
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span className="truncate max-w-[120px]">{acao.responsavel_nome}</span>
                          </div>
                        )}
                        {acao.prazo && (
                          <div className={cn("flex items-center gap-1", atrasada && "text-destructive")}>
                            <Clock className="h-3 w-3" />
                            <span>{format(new Date(acao.prazo), "dd/MM/yyyy", { locale: ptBR })}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <Badge variant="secondary" className="text-[10px] h-4">
                            {ORIGEM_LABELS[acao.origem_modulo]?.label || acao.origem_modulo}
                          </Badge>
                        </div>
                        {acao.origem_descricao && (
                          <span className="text-xs text-muted-foreground italic truncate max-w-[200px]" title={acao.origem_descricao}>
                            {acao.origem_descricao}
                          </span>
                        )}
                      </div>

                      {/* Progress */}
                      {acao.progresso > 0 && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Progresso</span>
                            <span className="font-medium">{acao.progresso}%</span>
                          </div>
                          <Progress value={acao.progresso} className="h-1.5" />
                        </div>
                      )}
                    </div>

                    <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {editAcao && (
        <PlanoAcaoFormModal
          open={!!editAcao}
          onOpenChange={(open) => !open && setEditAcao(null)}
          editData={editAcao}
        />
      )}
    </div>
  );
}
