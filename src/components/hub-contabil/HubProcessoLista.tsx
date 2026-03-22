import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Filter, ArrowRight, User, Calendar, AlertTriangle } from "lucide-react";
import { HubProcesso } from "@/hooks/useHubProcessos";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  processos: HubProcesso[];
  loading: boolean;
  onNovoProcesso: () => void;
  onVerProcesso: (id: string) => void;
  tipoFiltro?: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-muted text-muted-foreground" },
  aguardando_documentos: { label: "Aguard. Docs", color: "bg-amber-100 text-amber-800" },
  pronto_para_envio: { label: "Pronto p/ Envio", color: "bg-blue-100 text-blue-800" },
  enviado_contabilidade: { label: "Enviado", color: "bg-indigo-100 text-indigo-800" },
  recebido_contabilidade: { label: "Recebido", color: "bg-purple-100 text-purple-800" },
  em_analise: { label: "Em Análise", color: "bg-violet-100 text-violet-800" },
  pendente_complementacao: { label: "Pend. Complementação", color: "bg-orange-100 text-orange-800" },
  processado: { label: "Processado", color: "bg-teal-100 text-teal-800" },
  documentos_devolvidos: { label: "Docs Devolvidos", color: "bg-sky-100 text-sky-800" },
  aguardando_assinatura: { label: "Aguard. Assinatura", color: "bg-yellow-100 text-yellow-800" },
  assinado_parcialmente: { label: "Assinado Parcial", color: "bg-lime-100 text-lime-800" },
  concluido: { label: "Concluído", color: "bg-green-100 text-green-800" },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-800" },
  erro_integracao: { label: "Erro", color: "bg-destructive/20 text-destructive" },
};

const prioridadeConfig: Record<string, string> = {
  urgente: "text-destructive font-bold",
  alta: "text-orange-600 font-semibold",
  normal: "text-muted-foreground",
  baixa: "text-muted-foreground/60",
};

export function HubProcessoLista({ processos, loading, onNovoProcesso, onVerProcesso, tipoFiltro }: Props) {
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("todos");

  const filtrados = processos
    .filter(p => !tipoFiltro || p.tipo === tipoFiltro)
    .filter(p => statusFiltro === "todos" || p.status === statusFiltro)
    .filter(p => {
      if (!busca) return true;
      const b = busca.toLowerCase();
      return (
        p.titulo.toLowerCase().includes(b) ||
        p.codigo.toLowerCase().includes(b) ||
        (p.colaborador_nome?.toLowerCase().includes(b) ?? false) ||
        (p.colaborador_cpf?.includes(b) ?? false)
      );
    });

  if (loading) return <div className="flex items-center justify-center py-16 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, código, CPF..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFiltro} onValueChange={setStatusFiltro}>
          <SelectTrigger className="w-[200px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {Object.entries(statusConfig).map(([key, val]) => (
              <SelectItem key={key} value={key}>{val.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={onNovoProcesso} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" /> Novo Processo
        </Button>
      </div>

      {/* Lista */}
      {filtrados.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            <p>Nenhum processo encontrado</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={onNovoProcesso}>
              Criar novo processo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtrados.map(p => {
            const slaVencido = p.sla_vencimento && new Date(p.sla_vencimento) < new Date();
            return (
              <Card
                key={p.id}
                className={`cursor-pointer hover:border-primary/40 transition-all ${slaVencido ? "border-destructive/50" : ""}`}
                onClick={() => onVerProcesso(p.id)}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground">{p.codigo}</span>
                        {p.prioridade !== "normal" && (
                          <span className={`text-xs uppercase ${prioridadeConfig[p.prioridade]}`}>
                            {p.prioridade}
                          </span>
                        )}
                        {slaVencido && (
                          <span className="flex items-center gap-1 text-xs text-destructive">
                            <AlertTriangle className="w-3 h-3" /> SLA vencido
                          </span>
                        )}
                        {p.gerado_automaticamente && (
                          <span className="text-xs bg-primary/10 text-primary rounded px-1.5 py-0.5">Auto</span>
                        )}
                      </div>
                      <p className="font-medium text-sm mt-0.5 truncate">{p.titulo}</p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {p.colaborador_nome && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <User className="w-3 h-3" /> {p.colaborador_nome}
                          </span>
                        )}
                        {p.competencia && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" /> {p.competencia}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {format(parseISO(p.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={`text-xs ${statusConfig[p.status]?.color || ""}`}>
                        {statusConfig[p.status]?.label || p.status}
                      </Badge>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
