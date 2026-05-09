import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, X } from "lucide-react";
import { ATIVIDADES_RISCO } from "@/types/terceiros";
import type { TerceiroTrabalhador } from "@/types/terceiros";
import { EmpresaAtivaBanner } from "@/components/ui/empresa-ativa-banner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (data: Partial<TerceiroTrabalhador>) => Promise<void>;
  terceiroId: string;
  isPending?: boolean;
}

export function TrabalhadorForm({ open, onOpenChange, onSubmit, terceiroId, isPending }: Props) {
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [funcao, setFuncao] = useState("");
  const [unidade, setUnidade] = useState("");
  const [setor, setSetor] = useState("");
  const [atividadesRisco, setAtividadesRisco] = useState<string[]>([]);

  const toggleRisco = (r: string) =>
    setAtividadesRisco((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const handleSubmit = async () => {
    if (!nome) return;
    await onSubmit({
      terceiro_id: terceiroId,
      nome,
      cpf: cpf || null,
      funcao: funcao || null,
      unidade: unidade || null,
      setor: setor || null,
      atividades_risco: atividadesRisco.length > 0 ? atividadesRisco : null,
    });
    setNome("");
    setCpf("");
    setFuncao("");
    setUnidade("");
    setSetor("");
    setAtividadesRisco([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Trabalhador</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <EmpresaAtivaBanner />
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Nome *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div>
              <Label>CPF</Label>
              <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
            </div>
            <div>
              <Label>Cargo</Label>
              <Input value={funcao} onChange={(e) => setFuncao(e.target.value)} />
            </div>
            <div>
              <Label>Unidade</Label>
              <Input value={unidade} onChange={(e) => setUnidade(e.target.value)} />
            </div>
            <div>
              <Label>Setor</Label>
              <Input value={setor} onChange={(e) => setSetor(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Atividades de Risco</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {ATIVIDADES_RISCO.map((r) => (
                <Badge
                  key={r}
                  variant={atividadesRisco.includes(r) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleRisco(r)}
                >
                  {r}
                  {atividadesRisco.includes(r) && <X className="w-3 h-3 ml-1" />}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Define automaticamente treinamentos e documentos exigidos.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!nome || isPending}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Cadastrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
