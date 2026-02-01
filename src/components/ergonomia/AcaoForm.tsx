import { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type {
  ErgonomiaAcao,
  AcaoPrioridade,
  AcaoStatus,
  ErgonomiaRisco,
  ItemNR17,
} from "@/types/ergonomia";
import {
  PRIORIDADE_LABELS,
  ACAO_STATUS_LABELS,
  SEVERIDADE_COLORS,
} from "@/types/ergonomia";

const PRIORIDADE_COLORS: Record<AcaoPrioridade, string> = {
  baixa: 'bg-success/10 text-success',
  media: 'bg-warning/10 text-warning',
  alta: 'bg-orange-500/10 text-orange-600',
  urgente: 'bg-destructive/10 text-destructive',
};

const TIPO_LABELS = {
  corretiva: 'Corretiva',
  preventiva: 'Preventiva',
  melhoria: 'Melhoria',
};

interface AcaoFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (acao: Omit<ErgonomiaAcao, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) => Promise<unknown>;
  riscos?: ErgonomiaRisco[];
  itensNR17?: ItemNR17[];
  isLoading?: boolean;
}

export function AcaoForm({
  open,
  onOpenChange,
  onSubmit,
  riscos = [],
  itensNR17 = [],
  isLoading = false,
}: AcaoFormProps) {
  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    tipo: "corretiva" as 'corretiva' | 'preventiva' | 'melhoria',
    prioridade: "media" as AcaoPrioridade,
    status: "pendente" as AcaoStatus,
    risco_id: "",
    item_nr17_id: "",
    responsavel_nome: "",
    prazo: "",
    custo_estimado: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await onSubmit({
      ...formData,
      risco_id: formData.risco_id || undefined,
      item_nr17_id: formData.item_nr17_id || undefined,
      prazo: formData.prazo || undefined,
      custo_estimado: formData.custo_estimado ? parseFloat(formData.custo_estimado) : undefined,
    });

    // Reset form
    setFormData({
      titulo: "",
      descricao: "",
      tipo: "corretiva",
      prioridade: "media",
      status: "pendente",
      risco_id: "",
      item_nr17_id: "",
      responsavel_nome: "",
      prazo: "",
      custo_estimado: "",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Nova Ação
          </DialogTitle>
          <DialogDescription>
            Cadastre uma ação corretiva, preventiva ou de melhoria
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="titulo">Título da Ação *</Label>
            <Input
              id="titulo"
              value={formData.titulo}
              onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
              placeholder="Ex: Implementar pausas ativas"
              required
            />
          </div>

          {/* Tipo e Prioridade */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select
                value={formData.tipo}
                onValueChange={(value: 'corretiva' | 'preventiva' | 'melhoria') => 
                  setFormData(prev => ({ ...prev, tipo: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prioridade *</Label>
              <Select
                value={formData.prioridade}
                onValueChange={(value: AcaoPrioridade) => 
                  setFormData(prev => ({ ...prev, prioridade: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORIDADE_LABELS) as AcaoPrioridade[]).map((prio) => (
                    <SelectItem key={prio} value={prio}>
                      <Badge className={PRIORIDADE_COLORS[prio]}>
                        {PRIORIDADE_LABELS[prio]}
                      </Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Risco e Item NR-17 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Vinculada ao Risco</Label>
              <Select
                value={formData.risco_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, risco_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {riscos.map((risco) => (
                    <SelectItem key={risco.id} value={risco.id}>
                      {risco.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Item NR-17</Label>
              <Select
                value={formData.item_nr17_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, item_nr17_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {itensNR17.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.codigo} - {item.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
              placeholder="Descreva detalhadamente a ação a ser executada..."
              rows={3}
            />
          </div>

          {/* Responsável e Prazo */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="responsavel">Responsável</Label>
              <Input
                id="responsavel"
                value={formData.responsavel_nome}
                onChange={(e) => setFormData(prev => ({ ...prev, responsavel_nome: e.target.value }))}
                placeholder="Nome do responsável"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prazo">Prazo</Label>
              <Input
                id="prazo"
                type="date"
                value={formData.prazo}
                onChange={(e) => setFormData(prev => ({ ...prev, prazo: e.target.value }))}
              />
            </div>
          </div>

          {/* Custo Estimado */}
          <div className="space-y-2">
            <Label htmlFor="custo">Custo Estimado (R$)</Label>
            <Input
              id="custo"
              type="number"
              step="0.01"
              value={formData.custo_estimado}
              onChange={(e) => setFormData(prev => ({ ...prev, custo_estimado: e.target.value }))}
              placeholder="0,00"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !formData.titulo}>
              {isLoading ? "Salvando..." : "Cadastrar Ação"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
