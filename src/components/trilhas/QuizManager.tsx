import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  HelpCircle,
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { useTrilhaQuiz } from "@/hooks/useTrilhaQuiz";
import { QuizPerguntaForm } from "./QuizPerguntaForm";
import type { TrilhaQuizPergunta } from "@/types/trilha";

interface QuizManagerProps {
  moduloId: string;
}

export function QuizManager({ moduloId }: QuizManagerProps) {
  const { perguntas, isLoading, excluirPergunta } = useTrilhaQuiz(moduloId);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TrilhaQuizPergunta | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-primary" strokeWidth={1.75} />
          <h4 className="text-sm font-semibold text-foreground">
            Perguntas do Quiz ({perguntas.length})
          </h4>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Pergunta
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : perguntas.length === 0 ? (
        <div className="text-center py-6 bg-muted/30 rounded-lg border border-border">
          <HelpCircle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-2">Nenhuma pergunta cadastrada.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar primeira pergunta
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {perguntas.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card className="border-border">
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-mono text-muted-foreground mt-1 w-5 flex-shrink-0">
                      {i + 1}.
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{p.pergunta}</p>
                      <div className="mt-2 space-y-1">
                        {p.opcoes.map((opcao, oi) => (
                          <div
                            key={oi}
                            className="flex items-center gap-1.5 text-xs"
                          >
                            {oi === p.resposta_correta ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />
                            ) : (
                              <span className="w-3.5 h-3.5 flex-shrink-0" />
                            )}
                            <span
                              className={
                                oi === p.resposta_correta
                                  ? "text-success font-medium"
                                  : "text-muted-foreground"
                              }
                            >
                              {String.fromCharCode(65 + oi)}) {opcao}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditing(p);
                            setShowForm(true);
                          }}
                        >
                          <Pencil className="w-4 h-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(p.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <QuizPerguntaForm
        open={showForm}
        onOpenChange={setShowForm}
        moduloId={moduloId}
        pergunta={editing}
        nextOrdem={perguntas.length}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pergunta?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação é irreversível.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) {
                  excluirPergunta(deleteId);
                  setDeleteId(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
