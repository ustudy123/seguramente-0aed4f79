import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, Trash2, Play, Pause, Square, CheckCircle2, Clock, 
  AlertCircle, CircleDot 
} from "lucide-react";
import { useMetasErgonomicas } from "@/hooks/useMetasErgonomicas";
import {
  ACAO_TIPO_LABELS,
  ACAO_STATUS_LABELS,
  ACAO_PRIORIDADE_LABELS,
  type AcaoTipo,
  type AcaoPrioridade,
  type AcaoStatus,
} from "@/types/mea";

interface MetaAcoesPanelProps {
  metaId: string;
}

const statusIcons: Record<AcaoStatus, React.ElementType> = {
  pendente: Clock,
  em_andamento: CircleDot,
  concluida: CheckCircle2,
  cancelada: Square,
  bloqueada: AlertCircle,
};

const statusColors: Record<AcaoStatus, string> = {
  pendente: "bg-muted text-muted-foreground",
  em_andamento: "bg-blue-100 text-blue-700",
  concluida: "bg-green-100 text-green-700",
  cancelada: "bg-muted text-muted-foreground",
  bloqueada: "bg-red-100 text-red-700",
};

const prioridadeColors: Record<AcaoPrioridade, string> = {
  baixa: "bg-slate-100 text-slate-600",
  media: "bg-blue-100 text-blue-600",
  alta: "bg-orange-100 text-orange-600",
  critica: "bg-red-100 text-red-600",
};

export function MetaAcoesPanel({ metaId }: MetaAcoesPanelProps) {
  const { acoes, createAcao, updateAcaoStatus, deleteAcao, registrarTempo } = useMetasErgonomicas(metaId);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    descricao: "",
    tipo: "tarefa" as AcaoTipo,
    prioridade: "media" as AcaoPrioridade,
    prazo: "",
    responsavel_nome: "",
  });

  const handleCreate = async () => {
    if (!form.descricao) return;
    await createAcao({
      meta_id: metaId,
      descricao: form.descricao,
      tipo: form.tipo,
      prioridade: form.prioridade,
      prazo: form.prazo || undefined,
      responsavel_nome: form.responsavel_nome || undefined,
    });
    setForm({ descricao: "", tipo: "tarefa", prioridade: "media", prazo: "", responsavel_nome: "" });
    setShowForm(false);
  };

  const handleTempo = async (acaoId: string, tipo: "inicio" | "pausa" | "retomada" | "encerramento") => {
    await registrarTempo({ acaoId, metaId, tipo });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Ações da Meta</h3>
          <p className="text-xs text-muted-foreground">
            {acoes.length} ação(ões) • {acoes.filter(a => a.status === "concluida").length} concluída(s)
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="gap-1">
          <Plus className="h-3 w-3" />
          Nova Ação
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição *</Label>
              <Input
                value={form.descricao}
                onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Descreva a ação..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm(f => ({ ...f, tipo: v as AcaoTipo }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACAO_TIPO_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Prioridade</Label>
                <Select value={form.prioridade} onValueChange={(v) => setForm(f => ({ ...f, prioridade: v as AcaoPrioridade }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACAO_PRIORIDADE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Prazo</Label>
                <Input type="date" value={form.prazo} onChange={(e) => setForm(f => ({ ...f, prazo: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Responsável</Label>
                <Input
                  value={form.responsavel_nome}
                  onChange={(e) => setForm(f => ({ ...f, responsavel_nome: e.target.value }))}
                  placeholder="Nome"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleCreate}>Criar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {acoes.length === 0 && !showForm && (
        <div className="text-center py-6 text-muted-foreground text-sm">
          Nenhuma ação vinculada a esta meta.
        </div>
      )}

      <div className="space-y-2">
        {acoes.map((acao) => {
          const Icon = statusIcons[acao.status as AcaoStatus] || Clock;
          return (
            <div key={acao.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors">
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`${statusColors[acao.status as AcaoStatus]} text-xs border-0`}>
                    <Icon className="h-3 w-3 mr-1" />
                    {ACAO_STATUS_LABELS[acao.status as AcaoStatus]}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {ACAO_TIPO_LABELS[acao.tipo as AcaoTipo]}
                  </Badge>
                  <Badge className={`${prioridadeColors[acao.prioridade as AcaoPrioridade]} text-xs border-0`}>
                    {ACAO_PRIORIDADE_LABELS[acao.prioridade as AcaoPrioridade]}
                  </Badge>
                </div>
                <p className="text-sm font-medium">{acao.descricao}</p>
                {acao.responsavel_nome && (
                  <p className="text-xs text-muted-foreground">Responsável: {acao.responsavel_nome}</p>
                )}
                {acao.prazo && (
                  <p className="text-xs text-muted-foreground">Prazo: {new Date(acao.prazo).toLocaleDateString("pt-BR")}</p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {acao.status === "pendente" && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleTempo(acao.id, "inicio")} title="Iniciar">
                    <Play className="h-3.5 w-3.5 text-green-600" />
                  </Button>
                )}
                {acao.status === "em_andamento" && (
                  <>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleTempo(acao.id, "pausa")} title="Pausar">
                      <Pause className="h-3.5 w-3.5 text-yellow-600" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleTempo(acao.id, "encerramento")} title="Concluir">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    </Button>
                  </>
                )}
                {acao.status !== "concluida" && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteAcao(acao.id)} title="Excluir">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
