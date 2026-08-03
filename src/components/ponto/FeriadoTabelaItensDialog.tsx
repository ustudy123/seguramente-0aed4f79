import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { confirm } from "@/components/ui/confirm-dialog";
import { MESES } from "@/lib/ponto/feriados";
import {
  dataItem, formVazioItem, validarItem,
  type FeriadoItemForm, type FeriadoTabela, type FeriadoTabelaItem,
} from "@/lib/ponto/feriadoTabelas";

export interface FeriadoTabelaItensDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabela: FeriadoTabela | null;
  itens: FeriadoTabelaItem[];
  salvando: boolean;
  onAdicionar: (form: FeriadoItemForm) => void;
  onExcluir: (id: string) => void;
}

/** Gestão dos feriados que compõem uma tabela nomeada. */
export function FeriadoTabelaItensDialog({
  open, onOpenChange, tabela, itens, salvando, onAdicionar, onExcluir,
}: FeriadoTabelaItensDialogProps) {
  const [form, setForm] = useState<FeriadoItemForm>(formVazioItem());
  const [erro, setErro] = useState<string | null>(null);
  const anoRef = tabela?.ano ?? new Date().getFullYear();

  const set = (patch: Partial<FeriadoItemForm>) => setForm((f) => ({ ...f, ...patch }));

  const adicionar = () => {
    const msg = validarItem(form);
    if (msg) { setErro(msg); return; }
    setErro(null);
    onAdicionar(form);
    setForm(formVazioItem());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Feriados da Tabela {tabela?.numero ?? ""} — {tabela?.nome}
          </DialogTitle>
          <DialogDescription>
            Datas fixas ou recorrentes. Todas as filiais vinculadas a esta tabela herdam estes feriados.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border p-3 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Recorrente todo ano</Label>
            <Switch checked={form.recorrente} onCheckedChange={(v) => set({ recorrente: v })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => set({ nome: e.target.value })} />
            </div>
            {form.recorrente ? (
              <>
                <div className="space-y-1">
                  <Label>Dia</Label>
                  <Input
                    type="number" min={1} max={31} value={form.dia}
                    onChange={(e) => set({ dia: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Mês</Label>
                  <Select value={form.mes} onValueChange={(v) => set({ mes: v })}>
                    <SelectTrigger><SelectValue placeholder="Mês" /></SelectTrigger>
                    <SelectContent>
                      {MESES.map((m, i) => (
                        <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <div className="space-y-1 sm:col-span-2">
                <Label>Data</Label>
                <Input
                  type="date" value={form.data}
                  onChange={(e) => set({ data: e.target.value })}
                />
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select
                value={form.tipo}
                onValueChange={(v) => set({ tipo: v as FeriadoItemForm["tipo"] })}
              >
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="feriado">Feriado</SelectItem>
                  <SelectItem value="facultativo">Ponto facultativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={adicionar} disabled={salvando} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Adicionar à tabela
            </Button>
          </div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[130px]">Data</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="w-[150px]">Tipo</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">
                    Nenhum feriado nesta tabela ainda.
                  </TableCell>
                </TableRow>
              ) : itens.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{dataItem(item, anoRef)}</TableCell>
                  <TableCell>
                    {item.nome}
                    {item.recorrente && (
                      <Badge variant="outline" className="ml-2 text-[10px]">recorrente</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.tipo === "feriado" ? "Feriado" : "Ponto facultativo"}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon" variant="ghost" aria-label="Remover"
                      onClick={async () => {
                        const ok = await confirm({
                          title: "Remover feriado da tabela?",
                          description: `"${item.nome}" deixará de valer para as filiais vinculadas.`,
                          confirmLabel: "Remover",
                          variant: "destructive",
                        });
                        if (ok) onExcluir(item.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
