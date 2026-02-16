import { useState } from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Plus, Trash2, Users, User, Building2 } from "lucide-react";
import { useTrilhaAtribuicoes } from "@/hooks/useTrilhaAtribuicoes";
import { useColaboradores } from "@/hooks/useColaboradores";
import { useTrilhas } from "@/hooks/useTrilhas";

interface AtribuicaoTrilhaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trilhaId?: string;
}

const TIPO_ALVO_LABELS: Record<string, string> = {
  colaborador: "Colaborador",
  departamento: "Departamento",
  todos: "Todos os Colaboradores",
};

const TIPO_ALVO_ICONS: Record<string, React.ElementType> = {
  colaborador: User,
  departamento: Building2,
  todos: Users,
};

export function AtribuicaoTrilhaModal({ open, onOpenChange, trilhaId }: AtribuicaoTrilhaModalProps) {
  const { atribuicoes, isLoading, atribuir, remover, atribuindo } = useTrilhaAtribuicoes(trilhaId);
  const { colaboradores } = useColaboradores();
  const { trilhas } = useTrilhas();

  const [tipoAlvo, setTipoAlvo] = useState("colaborador");
  const [selectedTrilhaId, setSelectedTrilhaId] = useState(trilhaId || "");
  const [alvoId, setAlvoId] = useState("");
  const [alvoNome, setAlvoNome] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const departamentos = [...new Set(colaboradores.map((c) => c.departamento).filter(Boolean))] as string[];

  const handleAtribuir = async () => {
    const tId = trilhaId || selectedTrilhaId;
    if (!tId) return;

    await atribuir({
      trilha_id: tId,
      tipo_alvo: tipoAlvo,
      alvo_id: tipoAlvo === "todos" ? null : alvoId || null,
      alvo_nome: tipoAlvo === "todos" ? "Todos" : alvoNome || null,
    });
    setAlvoId("");
    setAlvoNome("");
  };

  const handleSelectColaborador = (id: string) => {
    setAlvoId(id);
    const col = colaboradores.find((c) => c.id === id);
    setAlvoNome(col?.nome_completo || "");
  };

  const handleSelectDepartamento = (dep: string) => {
    setAlvoId(dep);
    setAlvoNome(dep);
  };

  const canSubmit =
    (trilhaId || selectedTrilhaId) &&
    (tipoAlvo === "todos" || alvoId);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Atribuir Trilha</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Select trilha if not fixed */}
            {!trilhaId && (
              <div>
                <Label>Trilha</Label>
                <Select value={selectedTrilhaId} onValueChange={setSelectedTrilhaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma trilha..." />
                  </SelectTrigger>
                  <SelectContent>
                    {trilhas
                      .filter((t) => t.status === "ativa")
                      .map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Tipo de atribuição */}
            <div>
              <Label>Atribuir para</Label>
              <Select value={tipoAlvo} onValueChange={(v) => { setTipoAlvo(v); setAlvoId(""); setAlvoNome(""); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="colaborador">Colaborador específico</SelectItem>
                  <SelectItem value="departamento">Departamento inteiro</SelectItem>
                  <SelectItem value="todos">Todos os colaboradores</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Seleção do alvo */}
            {tipoAlvo === "colaborador" && (
              <div>
                <Label>Colaborador</Label>
                <Select value={alvoId} onValueChange={handleSelectColaborador}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {colaboradores.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome_completo} — {c.cargo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {tipoAlvo === "departamento" && (
              <div>
                <Label>Departamento</Label>
                <Select value={alvoId} onValueChange={handleSelectDepartamento}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {departamentos.map((dep) => (
                      <SelectItem key={dep} value={dep}>
                        {dep}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              onClick={handleAtribuir}
              disabled={!canSubmit || atribuindo}
              className="w-full"
            >
              {atribuindo ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Atribuir
            </Button>

            {/* Lista de atribuições existentes */}
            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">
                Atribuições atuais ({atribuicoes.length})
              </h4>
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : atribuicoes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma atribuição ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {atribuicoes.map((a, i) => {
                    const Icon = TIPO_ALVO_ICONS[a.tipo_alvo] || Users;
                    return (
                      <motion.div
                        key={a.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                      >
                        <Card className="border-border">
                          <CardContent className="p-3 flex items-center gap-3">
                            <div className="p-1.5 rounded-lg bg-primary/5">
                              <Icon className="w-4 h-4 text-primary" strokeWidth={1.75} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {a.alvo_nome || "Todos"}
                              </p>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px]">
                                  {TIPO_ALVO_LABELS[a.tipo_alvo] || a.tipo_alvo}
                                </Badge>
                                {!trilhaId && a.trilha_nome && (
                                  <span className="text-[11px] text-muted-foreground truncate">
                                    {a.trilha_nome}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteId(a.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover atribuição?</AlertDialogTitle>
            <AlertDialogDescription>
              O colaborador/departamento deixará de ver esta trilha como atribuída.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteId) { remover(deleteId); setDeleteId(null); } }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
