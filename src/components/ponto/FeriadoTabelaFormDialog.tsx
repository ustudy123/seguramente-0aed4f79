import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { UFS } from "@/lib/ponto/feriados";
import {
  formVazioTabela, validarTabela,
  type FeriadoTabela, type FeriadoTabelaForm,
} from "@/lib/ponto/feriadoTabelas";

export interface FeriadoTabelaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: FeriadoTabela | null;
  unidades: { id: string; nome: string; cidade?: string | null; uf?: string | null }[];
  vinculadas: string[];
  salvando: boolean;
  onSubmit: (form: FeriadoTabelaForm, empresaIds: string[]) => void;
}

/** Cadastro da tabela nomeada de feriados + filiais que a reaproveitam. */
export function FeriadoTabelaFormDialog({
  open, onOpenChange, editing, unidades, vinculadas, salvando, onSubmit,
}: FeriadoTabelaFormDialogProps) {
  const [form, setForm] = useState<FeriadoTabelaForm>(formVazioTabela());
  const [empresaIds, setEmpresaIds] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErro(null);
    setEmpresaIds(vinculadas);
    setForm(editing
      ? {
          nome: editing.nome,
          uf: editing.uf || "",
          municipio: editing.municipio || "",
          codigo_ibge: editing.codigo_ibge || "",
          ano: editing.ano ? String(editing.ano) : "",
          descricao: editing.descricao || "",
          ativo: editing.ativo,
        }
      : formVazioTabela());
  }, [open, editing, vinculadas]);

  const set = (patch: Partial<FeriadoTabelaForm>) => setForm((f) => ({ ...f, ...patch }));

  const toggleEmpresa = (id: string) =>
    setEmpresaIds((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]);

  const sugeridas = form.municipio.trim().toLowerCase();
  const mesmasCidade = unidades.filter(
    (u) => sugeridas && (u.cidade || "").trim().toLowerCase() === sugeridas,
  );

  const submit = () => {
    const msg = validarTabela(form);
    if (msg) { setErro(msg); return; }
    onSubmit(form, empresaIds);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Editar Tabela ${editing.numero ?? ""}` : "Nova tabela de feriados"}
          </DialogTitle>
          <DialogDescription>
            A numeração é automática. Uma mesma tabela pode ser reaproveitada por várias
            filiais/empresas do mesmo município.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nome da tabela</Label>
            <Input
              value={form.nome} placeholder="Ex.: Feriados Pato Branco/PR"
              onChange={(e) => set({ nome: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>UF</Label>
              <Select value={form.uf} onValueChange={(v) => set({ uf: v })}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>
                  {UFS.map((uf) => (<SelectItem key={uf} value={uf}>{uf}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Município</Label>
              <Input
                value={form.municipio}
                onChange={(e) => set({ municipio: e.target.value })}
                placeholder="Ex.: Pato Branco"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Código IBGE (opcional)</Label>
              <Input
                value={form.codigo_ibge}
                onChange={(e) => set({ codigo_ibge: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Ano de vigência</Label>
              <Input
                value={form.ano} placeholder="Vazio = permanente"
                onChange={(e) => set({ ano: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea
              rows={2} value={form.descricao}
              onChange={(e) => set({ descricao: e.target.value })}
            />
          </div>

          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Filiais que usam esta tabela</Label>
              {mesmasCidade.length > 0 && (
                <Button
                  type="button" size="sm" variant="outline"
                  onClick={() => setEmpresaIds(Array.from(
                    new Set([...empresaIds, ...mesmasCidade.map((u) => u.id)]),
                  ))}
                >
                  Selecionar as {mesmasCidade.length} do município
                </Button>
              )}
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {unidades.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhuma unidade cadastrada.</p>
              )}
              {unidades.map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={empresaIds.includes(u.id)}
                    onCheckedChange={() => toggleEmpresa(u.id)}
                  />
                  <span>{u.nome}</span>
                  {u.cidade && (
                    <span className="text-xs text-muted-foreground">
                      · {u.cidade}{u.uf ? `/${u.uf}` : ""}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <Label className="text-sm">Tabela ativa</Label>
            <Switch checked={form.ativo} onCheckedChange={(v) => set({ ativo: v })} />
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={salvando}>Salvar tabela</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
