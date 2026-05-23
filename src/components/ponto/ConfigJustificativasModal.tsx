import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Save, X, Pencil, Clock, Paperclip, ShieldAlert } from "lucide-react";
import { usePontoJustificativas, type PontoJustificativa } from "@/hooks/usePontoJustificativas";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type FormState = Partial<PontoJustificativa> & { nome: string; horas_abono: number };

const EMPTY: FormState = { nome: "", descricao: "", horas_abono: 0, requer_anexo: false, ativo: true, ordem: 0 };

export function ConfigJustificativasModal({ open, onOpenChange }: Props) {
  const { justificativas, loading, podeGerenciar, salvar, salvando, remover } = usePontoJustificativas();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);

  const reset = () => { setForm(EMPTY); setEditId(null); };

  const handleEdit = (j: PontoJustificativa) => {
    setEditId(j.id);
    setForm({
      id: j.id,
      nome: j.nome,
      descricao: j.descricao || "",
      horas_abono: Number(j.horas_abono),
      requer_anexo: j.requer_anexo,
      ativo: j.ativo,
      ordem: j.ordem,
    });
  };

  const handleSave = async () => {
    if (!form.nome.trim()) return;
    await salvar(form);
    reset();
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Remover esta justificativa?")) return;
    await remover(id);
    if (editId === id) reset();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" /> Justificativas de Ponto
          </DialogTitle>
          <DialogDescription>
            Cadastre os motivos que o colaborador pode escolher ao pedir ajuste de ponto. As horas de abono são informadas pelo próprio colaborador em cada dia, conforme o caso (atestado, feriado, etc.).
          </DialogDescription>
        </DialogHeader>

        {!podeGerenciar && (
          <div className="flex items-center gap-2 text-sm bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 rounded-md p-3">
            <ShieldAlert className="w-4 h-4" />
            Apenas perfis Admin, RH ou Dono podem cadastrar/editar justificativas.
          </div>
        )}

        {podeGerenciar && (
          <div className="border rounded-md p-3 space-y-3 bg-muted/30">
            <div className="text-sm font-semibold">{editId ? "Editar justificativa" : "Nova justificativa"}</div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
              <div className="md:col-span-5">
                <Label className="text-xs">Nome *</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Atestado médico" />
              </div>
              <div className="md:col-span-7">
                <Label className="text-xs">Descrição (opcional)</Label>
                <Input value={form.descricao || ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Quando usar este motivo" />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <Switch checked={!!form.requer_anexo} onCheckedChange={(v) => setForm({ ...form, requer_anexo: v })} />
                  <span className="flex items-center gap-1"><Paperclip className="w-3 h-3" /> Exigir anexo</span>
                </label>
                <label className="flex items-center gap-2">
                  <Switch checked={form.ativo !== false} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
                  <span>Ativa</span>
                </label>
              </div>
              <div className="flex gap-2">
                {editId && <Button variant="ghost" size="sm" onClick={reset}><X className="w-4 h-4 mr-1" /> Cancelar</Button>}
                <Button size="sm" onClick={handleSave} disabled={!form.nome.trim() || salvando}>
                  {editId ? <><Save className="w-4 h-4 mr-1" /> Salvar</> : <><Plus className="w-4 h-4 mr-1" /> Adicionar</>}
                </Button>
              </div>
            </div>
          </div>
        )}

        <ScrollArea className="flex-1 border rounded-md">
          {loading ? (
            <p className="text-center text-sm text-muted-foreground py-8">Carregando…</p>
          ) : justificativas.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              Nenhuma justificativa cadastrada. {podeGerenciar ? "Adicione a primeira acima." : "Aguarde o RH/Dono configurar."}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Nome</th>
                  <th className="px-3 py-2 font-medium w-24">Abono</th>
                  <th className="px-3 py-2 font-medium w-24">Anexo</th>
                  <th className="px-3 py-2 font-medium w-24">Status</th>
                  {podeGerenciar && <th className="px-3 py-2 w-24"></th>}
                </tr>
              </thead>
              <tbody>
                {justificativas.map((j) => (
                  <tr key={j.id} className={`border-t ${editId === j.id ? "bg-primary/5" : ""}`}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{j.nome}</div>
                      {j.descricao && <div className="text-xs text-muted-foreground">{j.descricao}</div>}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      <Badge variant={Number(j.horas_abono) > 0 ? "default" : "secondary"}>
                        {Number(j.horas_abono).toFixed(1)}h
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs">{j.requer_anexo ? "Obrigatório" : "Opcional"}</td>
                    <td className="px-3 py-2">
                      <Badge variant={j.ativo ? "outline" : "secondary"} className={j.ativo ? "border-emerald-500 text-emerald-700 dark:text-emerald-400" : ""}>
                        {j.ativo ? "Ativa" : "Inativa"}
                      </Badge>
                    </td>
                    {podeGerenciar && (
                      <td className="px-3 py-2 text-right">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(j)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleRemove(j.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ScrollArea>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
