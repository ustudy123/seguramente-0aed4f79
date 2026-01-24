import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  MinusCircle,
  Calendar,
  User,
  FileText,
  Save
} from "lucide-react";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  CATEGORIA_LABELS,
  type ItemNR17,
  type ErgonomiaStatus
} from "@/types/ergonomia";

interface ItemDetailModalProps {
  item: ItemNR17 | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, status: ErgonomiaStatus, observacoes?: string) => Promise<void>;
  isSaving?: boolean;
}

export function ItemDetailModal({ 
  item, 
  open, 
  onOpenChange, 
  onSave,
  isSaving = false
}: ItemDetailModalProps) {
  const [status, setStatus] = useState<ErgonomiaStatus>(item?.status || 'nao_atendido');
  const [observacoes, setObservacoes] = useState(item?.observacoes || '');

  // Reset form when item changes
  if (item && status !== item.status && !open) {
    setStatus(item.status);
    setObservacoes(item.observacoes || '');
  }

  const handleSave = async () => {
    if (!item) return;
    await onSave(item.id, status, observacoes);
    onOpenChange(false);
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <Badge variant="outline" className="mb-2 text-xs">
                {item.codigo}
              </Badge>
              <DialogTitle className="text-xl">{item.titulo}</DialogTitle>
              <DialogDescription className="mt-2">
                {CATEGORIA_LABELS[item.categoria]}
              </DialogDescription>
            </div>
            <Badge className={STATUS_COLORS[item.status]}>
              {STATUS_LABELS[item.status]}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Descrição */}
          {item.descricao && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <FileText className="h-4 w-4" />
                Descrição do Requisito
              </div>
              <p className="text-sm text-foreground leading-relaxed bg-muted/30 p-4 rounded-lg">
                {item.descricao}
              </p>
            </div>
          )}

          <Separator />

          {/* Informações de Avaliação */}
          <div className="grid grid-cols-2 gap-4">
            {item.data_avaliacao && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Última avaliação:</span>
                <span className="font-medium">
                  {format(new Date(item.data_avaliacao), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>
            )}
            {item.responsavel_nome && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Responsável:</span>
                <span className="font-medium">{item.responsavel_nome}</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Formulário de Atualização */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status de Conformidade</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ErgonomiaStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="atendido">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      Atendido
                    </div>
                  </SelectItem>
                  <SelectItem value="parcial">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-warning" />
                      Parcial
                    </div>
                  </SelectItem>
                  <SelectItem value="nao_atendido">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-destructive" />
                      Não Atendido
                    </div>
                  </SelectItem>
                  <SelectItem value="nao_aplicavel">
                    <div className="flex items-center gap-2">
                      <MinusCircle className="h-4 w-4 text-muted-foreground" />
                      Não Aplicável
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Observações e Evidências</Label>
              <Textarea
                placeholder="Descreva as evidências, justificativas ou ações necessárias..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={4}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
