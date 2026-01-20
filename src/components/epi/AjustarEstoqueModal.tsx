import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EpiCompleto } from "@/types/epi";

interface AjustarEstoqueModalProps {
  epi: EpiCompleto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (epiId: string, novaQuantidade: number, motivo: string) => Promise<void>;
}

export function AjustarEstoqueModal({
  epi,
  open,
  onOpenChange,
  onConfirm,
}: AjustarEstoqueModalProps) {
  const [quantidade, setQuantidade] = useState(epi?.quantidade_estoque || 0);
  const [motivo, setMotivo] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    if (!epi || !motivo.trim()) return;
    setIsLoading(true);
    try {
      await onConfirm(epi.id, quantidade, motivo);
      onOpenChange(false);
      setMotivo("");
    } finally {
      setIsLoading(false);
    }
  };

  // Reset values when EPI changes
  if (epi && quantidade !== epi.quantidade_estoque && !open) {
    setQuantidade(epi.quantidade_estoque);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar Estoque</DialogTitle>
        </DialogHeader>
        {epi && (
          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{epi.tipo.nome}</p>
              <p className="text-sm text-muted-foreground">
                {epi.marca} {epi.modelo && `- ${epi.modelo}`}
              </p>
              <p className="text-sm mt-2">
                Estoque atual: <strong>{epi.quantidade_estoque}</strong>
              </p>
            </div>

            <div className="space-y-2">
              <Label>Nova Quantidade</Label>
              <Input
                type="number"
                min={0}
                value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value))}
              />
              {quantidade !== epi.quantidade_estoque && (
                <p className="text-sm text-muted-foreground">
                  Diferença:{" "}
                  <span
                    className={
                      quantidade > epi.quantidade_estoque
                        ? "text-green-500"
                        : "text-red-500"
                    }
                  >
                    {quantidade > epi.quantidade_estoque ? "+" : ""}
                    {quantidade - epi.quantidade_estoque}
                  </span>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Motivo do Ajuste *</Label>
              <Textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex: Inventário, Correção de contagem, Entrada de compra..."
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || !motivo.trim() || quantidade === epi?.quantidade_estoque}
          >
            {isLoading ? "Salvando..." : "Confirmar Ajuste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
