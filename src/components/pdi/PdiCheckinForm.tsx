import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PdiMeta, PdiCheckinInsert } from "@/types/pdi";

interface PdiCheckinFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metas: PdiMeta[];
  onCreate: (data: PdiCheckinInsert) => Promise<any>;
}

export const PdiCheckinForm = ({ open, onOpenChange, metas, onCreate }: PdiCheckinFormProps) => {
  const [form, setForm] = useState({
    meta_id: "",
    avancos: "",
    bloqueios: "",
    proximo_passo: "",
    valor_atualizado: "",
  });

  const handleSubmit = async () => {
    if (!form.meta_id) return;
    await onCreate({
      meta_id: form.meta_id,
      avancos: form.avancos || undefined,
      bloqueios: form.bloqueios || undefined,
      proximo_passo: form.proximo_passo || undefined,
      valor_atualizado: form.valor_atualizado ? Number(form.valor_atualizado) : undefined,
    });
    onOpenChange(false);
    setForm({ meta_id: "", avancos: "", bloqueios: "", proximo_passo: "", valor_atualizado: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Check-in</DialogTitle>
          <DialogDescription>Registre o progresso de uma meta</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Meta *</Label>
            <Select value={form.meta_id} onValueChange={v => setForm(f => ({ ...f, meta_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione a meta" /></SelectTrigger>
              <SelectContent>
                {metas.map(m => <SelectItem key={m.id} value={m.id}>{m.titulo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>O que avancei desde o último check-in?</Label>
            <Textarea value={form.avancos} onChange={e => setForm(f => ({ ...f, avancos: e.target.value }))} rows={2} />
          </div>
          <div>
            <Label>O que me travou?</Label>
            <Textarea value={form.bloqueios} onChange={e => setForm(f => ({ ...f, bloqueios: e.target.value }))} rows={2} />
          </div>
          <div>
            <Label>Próximo passo</Label>
            <Textarea value={form.proximo_passo} onChange={e => setForm(f => ({ ...f, proximo_passo: e.target.value }))} rows={2} />
          </div>
          <div>
            <Label>Atualizar valor do indicador</Label>
            <Input type="number" value={form.valor_atualizado} onChange={e => setForm(f => ({ ...f, valor_atualizado: e.target.value }))} placeholder="Opcional" />
          </div>
          <Button onClick={handleSubmit} disabled={!form.meta_id} className="w-full">Registrar Check-in</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
