import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PdiFeedbackInsert } from "@/types/pdi";

interface PdiFeedbackFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdiId: string;
  onCreate: (data: PdiFeedbackInsert) => Promise<any>;
}

export const PdiFeedbackForm = ({ open, onOpenChange, pdiId, onCreate }: PdiFeedbackFormProps) => {
  const [form, setForm] = useState({
    tipo: "lider",
    ponto_forte: "",
    ponto_melhorar: "",
    recomendacao: "",
    comentario: "",
  });

  const handleSubmit = async () => {
    await onCreate({
      pdi_id: pdiId,
      tipo: form.tipo,
      ponto_forte: form.ponto_forte || undefined,
      ponto_melhorar: form.ponto_melhorar || undefined,
      recomendacao: form.recomendacao || undefined,
      comentario: form.comentario || undefined,
    });
    onOpenChange(false);
    setForm({ tipo: "lider", ponto_forte: "", ponto_melhorar: "", recomendacao: "", comentario: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Feedback</DialogTitle>
          <DialogDescription>Registre um feedback estruturado</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Tipo</Label>
            <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="autoavaliacao">Autoavaliação</SelectItem>
                <SelectItem value="lider">Líder</SelectItem>
                <SelectItem value="par">Par</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ponto forte</Label>
            <Textarea value={form.ponto_forte} onChange={e => setForm(f => ({ ...f, ponto_forte: e.target.value }))} rows={2} />
          </div>
          <div>
            <Label>Ponto a melhorar</Label>
            <Textarea value={form.ponto_melhorar} onChange={e => setForm(f => ({ ...f, ponto_melhorar: e.target.value }))} rows={2} />
          </div>
          <div>
            <Label>Recomendação</Label>
            <Textarea value={form.recomendacao} onChange={e => setForm(f => ({ ...f, recomendacao: e.target.value }))} rows={2} />
          </div>
          <div>
            <Label>Comentário geral</Label>
            <Textarea value={form.comentario} onChange={e => setForm(f => ({ ...f, comentario: e.target.value }))} rows={2} />
          </div>
          <Button onClick={handleSubmit} className="w-full">Registrar Feedback</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
