import { useState } from "react";
import { motion } from "framer-motion";
import { QuizManager } from "./QuizManager";
import { AtribuicaoTrilhaModal } from "./AtribuicaoTrilhaModal";
import { LinkTerceiroButton } from "./LinkTerceiroButton";
import {
  ArrowLeft,
  Plus,
  BookOpen,
  Clock,
  GraduationCap,
  Pencil,
  Trash2,
  Video,
  FileText,
  Link2,
  Presentation,
  HelpCircle,
  Wrench,
  CheckSquare,
  Brain,
  Lightbulb,
  Zap,
  MoreHorizontal,
  GripVertical,
  Loader2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useTrilhaModulos } from "@/hooks/useTrilhas";
import type { Trilha, TrilhaModulo, TrilhaModuloTipo } from "@/types/trilha";
import { TRILHA_TIPO_LABELS, TRILHA_PRIORIDADE_LABELS, TRILHA_STATUS_LABELS, MODULO_TIPO_LABELS } from "@/types/trilha";

const moduloIcons: Record<TrilhaModuloTipo, React.ElementType> = {
  video: Video,
  pdf: FileText,
  link: Link2,
  apresentacao: Presentation,
  conteudo_interno: BookOpen,
  quiz: HelpCircle,
  atividade_pratica: Wrench,
  checklist: CheckSquare,
  reflexao: Brain,
  estudo_caso: Lightbulb,
  microdesafio: Zap,
};

interface TrilhaDetailProps {
  trilha: Trilha;
  onBack: () => void;
  onEdit: (trilha: Trilha) => void;
  onAddModulo: () => void;
  onEditModulo: (modulo: TrilhaModulo) => void;
}

export function TrilhaDetail({ trilha, onBack, onEdit, onAddModulo, onEditModulo }: TrilhaDetailProps) {
  const { modulos, isLoading, excluirModulo } = useTrilhaModulos(trilha.id);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showAtribuicao, setShowAtribuicao] = useState(false);

  const tempoTotal = modulos.reduce((acc, m) => acc + (m.tempo_estimado_min || 0), 0);
  const pontosTotal = modulos.reduce((acc, m) => acc + (m.pontuacao || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="mt-1">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-foreground">{trilha.nome}</h2>
            <Badge className={cn("text-[10px]",
              trilha.status === "ativa" ? "bg-success/10 text-success" :
              trilha.status === "rascunho" ? "bg-muted text-muted-foreground" :
              "bg-muted text-muted-foreground"
            )}>
              {TRILHA_STATUS_LABELS[trilha.status]}
            </Badge>
          </div>
          {trilha.descricao && (
            <p className="text-sm text-muted-foreground">{trilha.descricao}</p>
          )}
          {trilha.objetivo && (
            <p className="text-sm text-muted-foreground mt-1 italic">Objetivo: {trilha.objetivo}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="outline" className="text-xs">{TRILHA_TIPO_LABELS[trilha.tipo]}</Badge>
            <Badge variant="outline" className="text-xs">{TRILHA_PRIORIDADE_LABELS[trilha.prioridade]}</Badge>
            {trilha.conexao_pdi && <Badge variant="outline" className="text-xs">Conectada ao PDI</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          <LinkTerceiroButton trilhaId={trilha.id} />
          <Button variant="outline" size="sm" onClick={() => setShowAtribuicao(true)}>
            <Users className="w-4 h-4 mr-2" /> Atribuir
          </Button>
          <Button variant="outline" size="sm" onClick={() => onEdit(trilha)}>
            <Pencil className="w-4 h-4 mr-2" /> Editar
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <BookOpen className="w-5 h-5 text-primary mx-auto mb-1" strokeWidth={1.75} />
            <p className="text-2xl font-bold text-foreground">{modulos.length}</p>
            <p className="text-xs text-muted-foreground">Módulos</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <Clock className="w-5 h-5 text-primary mx-auto mb-1" strokeWidth={1.75} />
            <p className="text-2xl font-bold text-foreground">{tempoTotal}min</p>
            <p className="text-xs text-muted-foreground">Tempo total</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <GraduationCap className="w-5 h-5 text-primary mx-auto mb-1" strokeWidth={1.75} />
            <p className="text-2xl font-bold text-foreground">{pontosTotal}</p>
            <p className="text-xs text-muted-foreground">Pontos</p>
          </CardContent>
        </Card>
      </div>

      {/* Modules */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Módulos da Trilha</h3>
        <Button size="sm" onClick={onAddModulo}>
          <Plus className="w-4 h-4 mr-2" /> Adicionar Módulo
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : modulos.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <BookOpen className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground mb-3">Nenhum módulo adicionado.</p>
          <Button variant="outline" onClick={onAddModulo}>
            <Plus className="w-4 h-4 mr-2" /> Adicionar Primeiro Módulo
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {modulos.map((modulo, i) => {
            const Icon = moduloIcons[modulo.tipo] || BookOpen;
            return (
              <motion.div
                key={modulo.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card
                  className="border-border hover:border-primary/20 transition-all cursor-pointer"
                  onClick={() => onEditModulo(modulo)}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="text-xs font-mono w-6 text-center">{i + 1}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-primary/5">
                      <Icon className="w-5 h-5 text-primary" strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{modulo.titulo}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        <span>{MODULO_TIPO_LABELS[modulo.tipo]}</span>
                        <span>{modulo.tempo_estimado_min}min</span>
                        <span>{modulo.pontuacao} pts</span>
                        {modulo.evidencia_obrigatoria && (
                          <Badge variant="outline" className="text-[10px] h-5">Evidência</Badge>
                        )}
                      </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEditModulo(modulo)}>
                            <Pencil className="w-4 h-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(modulo.id)}>
                            <Trash2 className="w-4 h-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Quiz manager for quiz modules */}
      {modulos.filter((m) => m.tipo === "quiz").map((m) => (
        <div key={m.id} className="border-t border-border pt-4">
          <p className="text-xs text-muted-foreground mb-2">Quiz: {m.titulo}</p>
          <QuizManager moduloId={m.id} />
        </div>
      ))}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir módulo?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação é irreversível.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteId) { excluirModulo(deleteId); setDeleteId(null); } }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Atribuição modal */}
      <AtribuicaoTrilhaModal
        open={showAtribuicao}
        onOpenChange={setShowAtribuicao}
        trilhaId={trilha.id}
      />
    </div>
  );
}
