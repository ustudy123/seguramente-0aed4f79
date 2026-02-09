import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, FolderPlus } from "lucide-react";

interface CreatePastaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentPastaId: string | null;
  parentPastaNome: string | null;
  onCreate: (data: { nome: string; tipo: string; pasta_pai_id: string | null }) => Promise<void>;
  creating: boolean;
}

export function CreatePastaModal({
  open,
  onOpenChange,
  parentPastaId,
  parentPastaNome,
  onCreate,
  creating,
}: CreatePastaModalProps) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("custom");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;

    await onCreate({
      nome: nome.trim(),
      tipo,
      pasta_pai_id: parentPastaId,
    });

    setNome("");
    setTipo("custom");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-primary" />
            Nova Pasta
          </DialogTitle>
          <DialogDescription>
            {parentPastaNome
              ? `Criar subpasta em "${parentPastaNome}"`
              : "Criar nova pasta raiz"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome da Pasta</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: 2025, Janeiro, Treinamentos..."
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Pasta Personalizada</SelectItem>
                <SelectItem value="ano">Ano</SelectItem>
                <SelectItem value="mes">Mês</SelectItem>
                <SelectItem value="categoria">Categoria</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={creating}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!nome.trim() || creating}>
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar Pasta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
