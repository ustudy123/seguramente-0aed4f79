import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, FileCode } from "lucide-react";
import { useFolhaCalculo } from "@/hooks/useFolhaCalculo";
import { toast } from "sonner";

const TIPOS_RUBRICA = [
  { value: "PROVENTO", label: "Provento" },
  { value: "DESCONTO", label: "Desconto" },
  { value: "INFORMATIVA", label: "Informativa" },
];

const NATUREZAS = [
  { value: "REMUNERATORIA", label: "Remuneratória" },
  { value: "INDENIZATORIA", label: "Indenizatória" },
  { value: "OUTRA", label: "Outra" },
];

const FORMAS_CALCULO = [
  { value: "VALOR_FIXO", label: "Valor Fixo" },
  { value: "PERCENTUAL_SALARIO", label: "% do Salário" },
  { value: "PERCENTUAL_BASE_ESPECIFICA", label: "% Base Específica" },
  { value: "QUANTIDADE_X_VALOR", label: "Qtd × Valor" },
  { value: "IMPORTADA_EXTERNA", label: "Importada" },
];

export function RubricasTab() {
  const { useRubricas, criarRubrica, criandoRubrica, atualizarRubrica } = useFolhaCalculo();
  const { data: rubricas = [], isLoading } = useRubricas();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const emptyForm = {
    codigo_interno: "",
    descricao: "",
    tipo: "PROVENTO",
    natureza: "REMUNERATORIA",
    forma_calculo: "VALOR_FIXO",
    prioridade_calculo: 100,
    incide_inss: false,
    incide_irrf: false,
    incide_fgts: false,
    incide_ferias: false,
    incide_13: false,
    incide_rescisao: false,
    protegida: false,
  };

  const [form, setForm] = useState(emptyForm);

  const handleSalvar = async () => {
    if (!form.codigo_interno || !form.descricao) return toast.error("Preencha código e descrição");
    if (editingId) {
      await atualizarRubrica({ id: editingId, ...form });
    } else {
      await criarRubrica(form);
    }
    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleEditar = (r: any) => {
    setEditingId(r.id);
    setForm({
      codigo_interno: r.codigo_interno,
      descricao: r.descricao,
      tipo: r.tipo,
      natureza: r.natureza,
      forma_calculo: r.forma_calculo,
      prioridade_calculo: r.prioridade_calculo,
      incide_inss: r.incide_inss,
      incide_irrf: r.incide_irrf,
      incide_fgts: r.incide_fgts,
      incide_ferias: r.incide_ferias,
      incide_13: r.incide_13,
      incide_rescisao: r.incide_rescisao,
      protegida: r.protegida,
    });
    setShowModal(true);
  };

  const tipoBadge = (tipo: string) => {
    if (tipo === "PROVENTO") return <Badge className="bg-emerald-100 text-emerald-800 text-xs">Provento</Badge>;
    if (tipo === "DESCONTO") return <Badge className="bg-red-100 text-red-800 text-xs">Desconto</Badge>;
    return <Badge variant="secondary" className="text-xs">Informativa</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileCode className="w-5 h-5 text-primary" /> Rubricas da Folha
          </h3>
          <p className="text-sm text-muted-foreground">Cadastro de proventos, descontos e incidências</p>
        </div>
        <Button onClick={() => { setEditingId(null); setForm(emptyForm); setShowModal(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Nova Rubrica
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-center">INSS</TableHead>
                <TableHead className="text-center">IRRF</TableHead>
                <TableHead className="text-center">FGTS</TableHead>
                <TableHead className="text-center">Férias</TableHead>
                <TableHead className="text-center">13º</TableHead>
                <TableHead className="text-center">Resc.</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : rubricas.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Nenhuma rubrica cadastrada.</TableCell></TableRow>
              ) : rubricas.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono font-bold">{r.codigo_interno}</TableCell>
                  <TableCell>{r.descricao}</TableCell>
                  <TableCell>{tipoBadge(r.tipo)}</TableCell>
                  <TableCell className="text-center">{r.incide_inss ? "✓" : "—"}</TableCell>
                  <TableCell className="text-center">{r.incide_irrf ? "✓" : "—"}</TableCell>
                  <TableCell className="text-center">{r.incide_fgts ? "✓" : "—"}</TableCell>
                  <TableCell className="text-center">{r.incide_ferias ? "✓" : "—"}</TableCell>
                  <TableCell className="text-center">{r.incide_13 ? "✓" : "—"}</TableCell>
                  <TableCell className="text-center">{r.incide_rescisao ? "✓" : "—"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => handleEditar(r)} disabled={r.protegida}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={(o) => { setShowModal(o); if (!o) { setEditingId(null); setForm(emptyForm); } }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Rubrica" : "Nova Rubrica"}</DialogTitle>
            <DialogDescription>Configure a rubrica e suas incidências</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Código *</Label>
                <Input value={form.codigo_interno} onChange={e => setForm(p => ({ ...p, codigo_interno: e.target.value }))} placeholder="001" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Descrição *</Label>
                <Input value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} placeholder="Salário Base" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(p => ({ ...p, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS_RUBRICA.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Natureza</Label>
                <Select value={form.natureza} onValueChange={v => setForm(p => ({ ...p, natureza: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{NATUREZAS.map(n => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Forma de Cálculo</Label>
                <Select value={form.forma_calculo} onValueChange={v => setForm(p => ({ ...p, forma_calculo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FORMAS_CALCULO.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="mb-3 block">Incidências</Label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: "incide_inss", label: "INSS" },
                  { key: "incide_irrf", label: "IRRF" },
                  { key: "incide_fgts", label: "FGTS" },
                  { key: "incide_ferias", label: "Férias" },
                  { key: "incide_13", label: "13º Salário" },
                  { key: "incide_rescisao", label: "Rescisão" },
                ].map(inc => (
                  <div key={inc.key} className="flex items-center gap-2">
                    <Switch checked={(form as any)[inc.key]} onCheckedChange={v => setForm(p => ({ ...p, [inc.key]: v }))} />
                    <Label className="text-sm">{inc.label}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={criandoRubrica}>
              {criandoRubrica ? "Salvando..." : editingId ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
