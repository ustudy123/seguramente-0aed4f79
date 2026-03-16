import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, Search } from "lucide-react";
import { toast } from "sonner";
import { TIPOS_SERVICO } from "@/types/terceiros";
import type { Terceiro, TerceiroAcesso } from "@/types/terceiros";
import { formatCnpj, cleanCnpj, validateCnpj, buscarCnpj } from "@/lib/brasilapi";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (data: Partial<Terceiro>) => Promise<void>;
  initial?: Terceiro | null;
  isPending?: boolean;
}

export function TerceiroForm({ open, onOpenChange, onSubmit, initial, isPending }: Props) {
  const [form, setForm] = useState<Partial<Terceiro>>({
    razao_social: initial?.razao_social || "",
    nome_fantasia: initial?.nome_fantasia || "",
    cnpj: initial?.cnpj || "",
    atividade_principal: initial?.atividade_principal || "",
    cnae: initial?.cnae || "",
    responsavel_nome: initial?.responsavel_nome || "",
    responsavel_cargo: initial?.responsavel_cargo || "",
    email: initial?.email || "",
    telefone: initial?.telefone || "",
    tipo_servico: initial?.tipo_servico || [],
    unidades: initial?.unidades || [],
    setores: initial?.setores || [],
    tipo_acesso: initial?.tipo_acesso || "eventual",
    contrato_inicio: initial?.contrato_inicio || "",
    contrato_fim: initial?.contrato_fim || "",
    atividade_risco: initial?.atividade_risco || false,
    observacoes: initial?.observacoes || "",
  });

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const toggleServico = (s: string) => {
    const arr = form.tipo_servico || [];
    set("tipo_servico", arr.includes(s) ? arr.filter((x) => x !== s) : [...arr, s]);
  };

  const handleSubmit = async () => {
    if (!form.razao_social || !form.cnpj) return;
    await onSubmit(form);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar Terceiro" : "Novo Terceiro"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Razão Social *</Label>
              <Input value={form.razao_social || ""} onChange={(e) => set("razao_social", e.target.value)} />
            </div>
            <div>
              <Label>Nome Fantasia</Label>
              <Input value={form.nome_fantasia || ""} onChange={(e) => set("nome_fantasia", e.target.value)} />
            </div>
            <div>
              <Label>CNPJ *</Label>
              <Input value={form.cnpj || ""} onChange={(e) => set("cnpj", e.target.value)} placeholder="00.000.000/0000-00" />
            </div>
            <div>
              <Label>CNAE</Label>
              <Input value={form.cnae || ""} onChange={(e) => set("cnae", e.target.value)} />
            </div>
            <div>
              <Label>Atividade Principal</Label>
              <Input value={form.atividade_principal || ""} onChange={(e) => set("atividade_principal", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Responsável Técnico</Label>
              <Input value={form.responsavel_nome || ""} onChange={(e) => set("responsavel_nome", e.target.value)} />
            </div>
            <div>
              <Label>Cargo</Label>
              <Input value={form.responsavel_cargo || ""} onChange={(e) => set("responsavel_cargo", e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email || ""} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.telefone || ""} onChange={(e) => set("telefone", e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Tipo de Serviço</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {TIPOS_SERVICO.map((s) => (
                <Badge
                  key={s}
                  variant={form.tipo_servico?.includes(s) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleServico(s)}
                >
                  {s}
                  {form.tipo_servico?.includes(s) && <X className="w-3 h-3 ml-1" />}
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Unidades onde atua</Label>
              <Input
                value={(form.unidades || []).join(", ")}
                onChange={(e) => set("unidades", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                placeholder="Ex: Matriz, Filial SP (separar por vírgula)"
              />
            </div>
            <div>
              <Label>Setores onde pode atuar</Label>
              <Input
                value={(form.setores || []).join(", ")}
                onChange={(e) => set("setores", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                placeholder="Ex: Produção, Manutenção (separar por vírgula)"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Tipo de Acesso</Label>
              <Select value={form.tipo_acesso} onValueChange={(v) => set("tipo_acesso", v as TerceiroAcesso)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="eventual">Eventual</SelectItem>
                  <SelectItem value="recorrente">Recorrente</SelectItem>
                  <SelectItem value="continuo">Contínuo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Início do Contrato</Label>
              <Input type="date" value={form.contrato_inicio || ""} onChange={(e) => set("contrato_inicio", e.target.value)} />
            </div>
            <div>
              <Label>Fim do Contrato</Label>
              <Input type="date" value={form.contrato_fim || ""} onChange={(e) => set("contrato_fim", e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
            <Switch checked={form.atividade_risco || false} onCheckedChange={(v) => set("atividade_risco", v)} />
            <div>
              <p className="text-sm font-medium">Este terceiro executa atividade com risco?</p>
              <p className="text-xs text-muted-foreground">Se sim, controles obrigatórios serão ativados automaticamente.</p>
            </div>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea value={form.observacoes || ""} onChange={(e) => set("observacoes", e.target.value)} rows={2} />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.razao_social || !form.cnpj || isPending}>
              {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {initial ? "Salvar" : "Cadastrar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
