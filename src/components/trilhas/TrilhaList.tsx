import { useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  BookOpen,
  MoreHorizontal,
  GraduationCap,
  Clock,
  Users,
  Loader2,
  Route,
  Archive,
  Pencil,
  Trash2,
  Eye,
  Wand2,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
import { useTrilhas } from "@/hooks/useTrilhas";
import { GerarTrilhaIAModal } from "./GerarTrilhaIAModal";
import type { Trilha, TrilhaStatus, TrilhaTipo, TrilhaPrioridade } from "@/types/trilha";
import { TRILHA_TIPO_LABELS, TRILHA_PRIORIDADE_LABELS, TRILHA_STATUS_LABELS } from "@/types/trilha";

const statusStyles: Record<TrilhaStatus, string> = {
  rascunho: "bg-muted text-muted-foreground",
  ativa: "bg-success/10 text-success border-success/20",
  arquivada: "bg-muted text-muted-foreground",
};

const tipoStyles: Record<TrilhaTipo, string> = {
  tecnica: "bg-blue-500/10 text-blue-600",
  comportamental: "bg-violet-500/10 text-violet-600",
  lideranca: "bg-amber-500/10 text-amber-600",
  cultura: "bg-rose-500/10 text-rose-600",
  ergonomia_saude: "bg-emerald-500/10 text-emerald-600",
  processos: "bg-cyan-500/10 text-cyan-600",
  onboarding: "bg-indigo-500/10 text-indigo-600",
};

const prioridadeStyles: Record<TrilhaPrioridade, string> = {
  obrigatoria: "bg-destructive/10 text-destructive",
  recomendada: "bg-warning/10 text-warning",
  opcional: "bg-muted text-muted-foreground",
};

interface TrilhaListProps {
  onSelect: (trilha: Trilha) => void;
  onEdit: (trilha: Trilha) => void;
  onNew: () => void;
}

export function TrilhaList({ onSelect, onEdit, onNew }: TrilhaListProps) {
  const { trilhas, isLoading, excluirTrilha, atualizarTrilha } = useTrilhas();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showGerarIA, setShowGerarIA] = useState(false);

  const filtered = trilhas.filter((t) => {
    const matchSearch =
      t.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: trilhas.length,
    ativas: trilhas.filter((t) => t.status === "ativa").length,
    rascunhos: trilhas.filter((t) => t.status === "rascunho").length,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Route className="w-5 h-5 text-primary" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Trilhas criadas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <GraduationCap className="w-5 h-5 text-success" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.ativas}</p>
              <p className="text-xs text-muted-foreground">Ativas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Pencil className="w-5 h-5 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.rascunhos}</p>
              <p className="text-xs text-muted-foreground">Rascunhos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar trilhas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
            {["all", "ativa", "rascunho", "arquivada"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  statusFilter === s
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {s === "all" ? "Todas" : TRILHA_STATUS_LABELS[s as TrilhaStatus]}
              </button>
            ))}
          </div>
          
          <Button variant="outline" className="border-primary/20 hover:bg-primary/5 text-primary gap-2" onClick={() => setShowGerarIA(true)}>
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Gerar por IA</span>
          </Button>

          <Button className="gradient-primary shadow-glow" onClick={onNew}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Trilha
          </Button>
        </div>
      </div>

      <GerarTrilhaIAModal 
        open={showGerarIA} 
        onOpenChange={setShowGerarIA} 
        onSuccess={() => {
          // useTrilhas already handles invalidation, but we can ensure here
        }}
      />

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border border-border">
          <Route className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" strokeWidth={1.5} />
          <p className="text-muted-foreground mb-4">
            {trilhas.length === 0 ? "Nenhuma trilha criada ainda." : "Nenhuma trilha encontrada."}
          </p>
          {trilhas.length === 0 && (
            <Button onClick={onNew}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeira Trilha
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((trilha, i) => (
            <motion.div
              key={trilha.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <Card
                className="border-border hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group"
                onClick={() => onSelect(trilha)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                        {trilha.nome}
                      </h3>
                      {trilha.descricao && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {trilha.descricao}
                        </p>
                      )}
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onSelect(trilha)}>
                            <Eye className="w-4 h-4 mr-2" /> Ver detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEdit(trilha)}>
                            <Pencil className="w-4 h-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          {trilha.status === "rascunho" && (
                            <DropdownMenuItem onClick={() => atualizarTrilha({ id: trilha.id, status: "ativa" as never })}>
                              <GraduationCap className="w-4 h-4 mr-2" /> Ativar
                            </DropdownMenuItem>
                          )}
                          {trilha.status === "ativa" && (
                            <DropdownMenuItem onClick={() => atualizarTrilha({ id: trilha.id, status: "arquivada" as never })}>
                              <Archive className="w-4 h-4 mr-2" /> Arquivar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(trilha.id)}>
                            <Trash2 className="w-4 h-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge className={cn("text-[10px]", statusStyles[trilha.status])}>
                      {TRILHA_STATUS_LABELS[trilha.status]}
                    </Badge>
                    <Badge className={cn("text-[10px]", tipoStyles[trilha.tipo])}>
                      {TRILHA_TIPO_LABELS[trilha.tipo]}
                    </Badge>
                    <Badge className={cn("text-[10px]", prioridadeStyles[trilha.prioridade])}>
                      {TRILHA_PRIORIDADE_LABELS[trilha.prioridade]}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{trilha.total_modulos} módulos</span>
                    </div>
                    {trilha.prazo_dias && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{trilha.prazo_dias} dias</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Delete dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir trilha?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Todos os módulos e progressos vinculados serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteId) { excluirTrilha(deleteId); setDeleteId(null); } }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
