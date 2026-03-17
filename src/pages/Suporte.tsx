import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bug, AlertTriangle, MessageSquare, Lightbulb, HelpCircle,
  Plus, Search, Filter, Clock, CheckCircle2, XCircle, Loader2,
  ChevronRight, Send, ArrowUpCircle, ArrowDownCircle, Minus,
  Flame, LifeBuoy, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuthContext } from "@/contexts/AuthContext";
import {
  useSuporteTickets,
  TIPO_LABELS, STATUS_LABELS, PRIORIDADE_LABELS,
  type SuporteTicket, type TicketTipo, type TicketStatus, type TicketPrioridade,
  type TicketComentario,
} from "@/hooks/useSuporteTickets";

const MODULOS = [
  "Colaboradores", "Admissões", "Ponto", "Férias", "Atestados", "EPIs",
  "Incidentes & Acidentes", "Avaliações", "PDI", "Terceiros", "Ouvidoria",
  "Feedback", "Financeiro", "Hub Contábil", "Documentos", "Configurações", "Outro",
];

const tipoIcons: Record<TicketTipo, React.ElementType> = {
  bug: Bug,
  falha: AlertTriangle,
  reclamacao: MessageSquare,
  sugestao: Lightbulb,
  duvida: HelpCircle,
};

const tipoColors: Record<TicketTipo, string> = {
  bug: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  falha: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  reclamacao: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  sugestao: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  duvida: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

const statusColors: Record<TicketStatus, string> = {
  aberto: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  em_analise: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  em_andamento: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  resolvido: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  fechado: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  cancelado: "bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400",
};

const prioridadeIcons: Record<TicketPrioridade, React.ElementType> = {
  baixa: ArrowDownCircle,
  media: Minus,
  alta: ArrowUpCircle,
  critica: Flame,
};

const prioridadeColors: Record<TicketPrioridade, string> = {
  baixa: "text-blue-500",
  media: "text-yellow-500",
  alta: "text-orange-500",
  critica: "text-red-600",
};

export default function Suporte() {
  const { hasMinimumRole } = useAuthContext();
  const isAdmin = hasMinimumRole("admin");
  const { tickets, isLoading, isSuperAdmin, createTicket, updateTicket, fetchComentarios, addComentario } = useSuporteTickets();

  const [showForm, setShowForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SuporteTicket | null>(null);
  const [comentarios, setComentarios] = useState<TicketComentario[]>([]);
  const [novoComentario, setNovoComentario] = useState("");
  const [loadingComentarios, setLoadingComentarios] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterTipo, setFilterTipo] = useState<string>("todos");

  // Form state
  const [formTitulo, setFormTitulo] = useState("");
  const [formDescricao, setFormDescricao] = useState("");
  const [formTipo, setFormTipo] = useState<TicketTipo>("bug");
  const [formPrioridade, setFormPrioridade] = useState<TicketPrioridade>("media");
  const [formModulo, setFormModulo] = useState("");

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (filterStatus !== "todos" && t.status !== filterStatus) return false;
      if (filterTipo !== "todos" && t.tipo !== filterTipo) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          t.titulo.toLowerCase().includes(q) ||
          t.descricao.toLowerCase().includes(q) ||
          (t.criado_por_nome || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [tickets, filterStatus, filterTipo, searchQuery]);

  const stats = useMemo(() => ({
    total: tickets.length,
    abertos: tickets.filter((t) => t.status === "aberto").length,
    emAndamento: tickets.filter((t) => ["em_analise", "em_andamento"].includes(t.status)).length,
    resolvidos: tickets.filter((t) => ["resolvido", "fechado"].includes(t.status)).length,
  }), [tickets]);

  const handleSubmit = async () => {
    if (!formTitulo.trim() || !formDescricao.trim()) return;
    await createTicket.mutateAsync({
      titulo: formTitulo.trim(),
      descricao: formDescricao.trim(),
      tipo: formTipo,
      prioridade: formPrioridade,
      modulo: formModulo || null,
    });
    setFormTitulo("");
    setFormDescricao("");
    setFormTipo("bug");
    setFormPrioridade("media");
    setFormModulo("");
    setShowForm(false);
  };

  const openTicketDetail = async (ticket: SuporteTicket) => {
    setSelectedTicket(ticket);
    setLoadingComentarios(true);
    try {
      const data = await fetchComentarios(ticket.id);
      setComentarios(data);
    } catch {
      setComentarios([]);
    }
    setLoadingComentarios(false);
  };

  const handleAddComentario = async () => {
    if (!novoComentario.trim() || !selectedTicket) return;
    await addComentario.mutateAsync({ ticketId: selectedTicket.id, conteudo: novoComentario.trim() });
    setNovoComentario("");
    const data = await fetchComentarios(selectedTicket.id);
    setComentarios(data);
  };

  const handleStatusChange = async (ticketId: string, newStatus: TicketStatus) => {
    await updateTicket.mutateAsync({ id: ticketId, status: newStatus });
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket((prev) => prev ? { ...prev, status: newStatus } : null);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-primary/10 rounded-xl">
          <LifeBuoy className="w-7 h-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Central de Suporte</h1>
          <p className="text-muted-foreground text-sm">Reporte bugs, falhas, sugestões e acompanhe os tickets</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: stats.total, icon: MessageSquare, color: "text-foreground" },
          { label: "Abertos", value: stats.abertos, icon: Clock, color: "text-sky-600" },
          { label: "Em Andamento", value: stats.emAndamento, icon: Loader2, color: "text-amber-600" },
          { label: "Resolvidos", value: stats.resolvidos, icon: CheckCircle2, color: "text-emerald-600" },
        ].map((s) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border rounded-xl p-4 flex items-center gap-3"
          >
            <s.icon className={cn("w-5 h-5", s.color)} />
            <div>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-1 gap-3 w-full sm:w-auto">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tickets..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos tipos</SelectItem>
              {Object.entries(TIPO_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Ticket
        </Button>
      </div>

      {/* Status tabs */}
      <Tabs value={filterStatus} onValueChange={setFilterStatus}>
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="aberto">Abertos</TabsTrigger>
          <TabsTrigger value="em_analise">Em Análise</TabsTrigger>
          <TabsTrigger value="em_andamento">Em Andamento</TabsTrigger>
          <TabsTrigger value="resolvido">Resolvidos</TabsTrigger>
          <TabsTrigger value="fechado">Fechados</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Ticket List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <LifeBuoy className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum ticket encontrado</p>
          <p className="text-sm mt-1">Crie um novo ticket para reportar um problema</p>
          <Button onClick={() => setShowForm(true)} className="mt-4 gap-2">
            <Plus className="w-4 h-4" /> Novo Ticket
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filteredTickets.map((ticket) => {
              const TipoIcon = tipoIcons[ticket.tipo];
              const PrioIcon = prioridadeIcons[ticket.prioridade];
              return (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  onClick={() => openTicketDetail(ticket)}
                  className="bg-card border rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer group"
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("p-2 rounded-lg shrink-0", tipoColors[ticket.tipo])}>
                      <TipoIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm truncate">{ticket.titulo}</h3>
                        <Badge variant="outline" className={cn("text-[10px] shrink-0", statusColors[ticket.status])}>
                          {STATUS_LABELS[ticket.status]}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{ticket.descricao}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <PrioIcon className={cn("w-3.5 h-3.5", prioridadeColors[ticket.prioridade])} />
                          {PRIORIDADE_LABELS[ticket.prioridade]}
                        </span>
                        {ticket.modulo && <span>• {ticket.modulo}</span>}
                        <span>• {ticket.criado_por_nome || "Anônimo"}</span>
                        {isSuperAdmin && <span className="font-medium text-primary">• Tenant: {ticket.tenant_id.slice(0, 8)}…</span>}
                        <span>• {new Date(ticket.created_at).toLocaleDateString("pt-BR")}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Create Ticket Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="w-5 h-5 text-primary" /> Novo Ticket
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input
                value={formTitulo}
                onChange={(e) => setFormTitulo(e.target.value)}
                placeholder="Resumo do problema..."
                maxLength={200}
              />
            </div>
            <div>
              <Label>Descrição *</Label>
              <Textarea
                value={formDescricao}
                onChange={(e) => setFormDescricao(e.target.value)}
                placeholder="Descreva o problema em detalhes: o que aconteceu, passos para reproduzir, comportamento esperado..."
                rows={4}
                maxLength={2000}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={formTipo} onValueChange={(v) => setFormTipo(v as TicketTipo)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={formPrioridade} onValueChange={(v) => setFormPrioridade(v as TicketPrioridade)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORIDADE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Módulo relacionado</Label>
              <Select value={formModulo} onValueChange={setFormModulo}>
                <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                <SelectContent>
                  {MODULOS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button
                onClick={handleSubmit}
                disabled={!formTitulo.trim() || !formDescricao.trim() || createTicket.isPending}
              >
                {createTicket.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Enviar Ticket
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          {selectedTicket && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-3">
                  <div className={cn("p-2 rounded-lg shrink-0", tipoColors[selectedTicket.tipo])}>
                    {(() => { const I = tipoIcons[selectedTicket.tipo]; return <I className="w-5 h-5" />; })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="text-lg">{selectedTicket.titulo}</DialogTitle>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge className={cn("text-xs", tipoColors[selectedTicket.tipo])}>
                        {TIPO_LABELS[selectedTicket.tipo]}
                      </Badge>
                      <Badge className={cn("text-xs", statusColors[selectedTicket.status])}>
                        {STATUS_LABELS[selectedTicket.status]}
                      </Badge>
                      {(() => {
                        const PI = prioridadeIcons[selectedTicket.prioridade];
                        return (
                          <span className={cn("flex items-center gap-1 text-xs", prioridadeColors[selectedTicket.prioridade])}>
                            <PI className="w-3.5 h-3.5" /> {PRIORIDADE_LABELS[selectedTicket.prioridade]}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-4 pr-2">
                  {/* Meta info */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Reportado por:</span>{" "}
                      <span className="font-medium">{selectedTicket.criado_por_nome || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Data:</span>{" "}
                      <span className="font-medium">{new Date(selectedTicket.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                    {selectedTicket.modulo && (
                      <div>
                        <span className="text-muted-foreground">Módulo:</span>{" "}
                        <span className="font-medium">{selectedTicket.modulo}</span>
                      </div>
                    )}
                    {selectedTicket.atribuido_a_nome && (
                      <div>
                        <span className="text-muted-foreground">Atribuído a:</span>{" "}
                        <span className="font-medium">{selectedTicket.atribuido_a_nome}</span>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm whitespace-pre-wrap">{selectedTicket.descricao}</p>
                  </div>

                  {/* Resolution */}
                  {selectedTicket.resolucao && (
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-1">Resolução</p>
                      <p className="text-sm">{selectedTicket.resolucao}</p>
                    </div>
                  )}

                  {/* Admin: change status */}
                  {isAdmin && !["fechado", "cancelado"].includes(selectedTicket.status) && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-muted-foreground">Alterar status:</span>
                      {(["em_analise", "em_andamento", "resolvido", "fechado", "cancelado"] as TicketStatus[])
                        .filter((s) => s !== selectedTicket.status)
                        .map((s) => (
                          <Button
                            key={s}
                            variant="outline"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => handleStatusChange(selectedTicket.id, s)}
                          >
                            {STATUS_LABELS[s]}
                          </Button>
                        ))}
                    </div>
                  )}

                  {/* Comments */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-sm mb-3">Comentários</h4>
                    {loadingComentarios ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </div>
                    ) : comentarios.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">Nenhum comentário ainda.</p>
                    ) : (
                      <div className="space-y-3">
                        {comentarios.map((c) => (
                          <div key={c.id} className="flex gap-2">
                            <Avatar className="w-7 h-7 shrink-0">
                              <AvatarFallback className="text-[10px] bg-primary/10">
                                {getInitials(c.autor_nome)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 bg-muted/40 rounded-lg p-2.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold">{c.autor_nome || "Anônimo"}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(c.created_at).toLocaleString("pt-BR")}
                                </span>
                              </div>
                              <p className="text-sm mt-1">{c.conteudo}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2 mt-3">
                      <Input
                        placeholder="Adicionar comentário..."
                        value={novoComentario}
                        onChange={(e) => setNovoComentario(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAddComentario()}
                      />
                      <Button
                        size="icon"
                        onClick={handleAddComentario}
                        disabled={!novoComentario.trim() || addComentario.isPending}
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
