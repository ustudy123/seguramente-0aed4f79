import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, FileText, Pencil, Trash2, Scale } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface CCT {
  id: string;
  sindicato: string;
  numero_registro?: string;
  vigencia_inicio: string;
  vigencia_fim: string;
  piso_salarial?: number;
  adicional_he_50?: number;
  adicional_he_100?: number;
  adicional_noturno?: number;
  beneficios_obrigatorios?: any[];
  observacoes?: string;
  ativo: boolean;
}

const EMPTY_CCT: Omit<CCT, "id"> = {
  sindicato: "",
  numero_registro: "",
  vigencia_inicio: "",
  vigencia_fim: "",
  piso_salarial: undefined,
  adicional_he_50: 50,
  adicional_he_100: 100,
  adicional_noturno: 20,
  beneficios_obrigatorios: [],
  observacoes: "",
  ativo: true,
};

export function FolhaCCTTab() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<CCT | null>(null);
  const [form, setForm] = useState<Omit<CCT, "id">>(EMPTY_CCT);
  const [salvando, setSalvando] = useState(false);

  const { data: ccts = [], isLoading } = useQuery({
    queryKey: ["folha-ccts", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("folha_cct" as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("vigencia_fim", { ascending: false });
      return (data || []) as CCT[];
    },
    enabled: !!tenantId,
  });

  const abrirNovo = () => {
    setEditando(null);
    setForm(EMPTY_CCT);
    setDialogOpen(true);
  };

  const abrirEdicao = (cct: CCT) => {
    setEditando(cct);
    setForm({
      sindicato: cct.sindicato,
      numero_registro: cct.numero_registro || "",
      vigencia_inicio: cct.vigencia_inicio,
      vigencia_fim: cct.vigencia_fim,
      piso_salarial: cct.piso_salarial,
      adicional_he_50: cct.adicional_he_50 ?? 50,
      adicional_he_100: cct.adicional_he_100 ?? 100,
      adicional_noturno: cct.adicional_noturno ?? 20,
      beneficios_obrigatorios: cct.beneficios_obrigatorios || [],
      observacoes: cct.observacoes || "",
      ativo: cct.ativo,
    });
    setDialogOpen(true);
  };

  const salvar = async () => {
    if (!form.sindicato || !form.vigencia_inicio || !form.vigencia_fim) {
      toast.warning("Preencha sindicato e vigência.");
      return;
    }
    setSalvando(true);
    try {
      const payload = { ...form, tenant_id: tenantId };
      if (editando) {
        await supabase.from("folha_cct" as any).update(payload as any).eq("id", editando.id);
        toast.success("CCT atualizada.");
      } else {
        await supabase.from("folha_cct" as any).insert(payload as any);
        toast.success("CCT cadastrada.");
      }
      queryClient.invalidateQueries({ queryKey: ["folha-ccts"] });
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (id: string) => {
    await supabase.from("folha_cct" as any).delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["folha-ccts"] });
    toast.success("CCT removida.");
  };

  const vigenciaAtiva = (fim: string) => new Date(fim) >= new Date();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Scale className="w-5 h-5 text-primary" /> Convenções Coletivas (CCT/ACT)
          </h3>
          <p className="text-sm text-muted-foreground">Parametrize pisos salariais e adicionais conforme sindicato</p>
        </div>
        <Button onClick={abrirNovo} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Nova CCT
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sindicato</TableHead>
                <TableHead>Vigência</TableHead>
                <TableHead className="text-right">Piso</TableHead>
                <TableHead className="text-center">HE 50%</TableHead>
                <TableHead className="text-center">HE 100%</TableHead>
                <TableHead className="text-center">Noturno</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : ccts.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma CCT cadastrada.</TableCell></TableRow>
              ) : ccts.map((cct) => (
                <TableRow key={cct.id}>
                  <TableCell className="font-medium">{cct.sindicato}</TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(cct.vigencia_inicio), "dd/MM/yyyy")} — {format(new Date(cct.vigencia_fim), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell className="text-right">{cct.piso_salarial ? `R$ ${Number(cct.piso_salarial).toFixed(2)}` : "—"}</TableCell>
                  <TableCell className="text-center">{cct.adicional_he_50 ?? 50}%</TableCell>
                  <TableCell className="text-center">{cct.adicional_he_100 ?? 100}%</TableCell>
                  <TableCell className="text-center">{cct.adicional_noturno ?? 20}%</TableCell>
                  <TableCell className="text-center">
                    {vigenciaAtiva(cct.vigencia_fim) && cct.ativo
                      ? <Badge className="bg-green-500/10 text-green-700 border-green-200">Vigente</Badge>
                      : <Badge variant="secondary">Expirada</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => abrirEdicao(cct)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => excluir(cct.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar CCT" : "Nova Convenção Coletiva"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sindicato *</Label>
              <Input value={form.sindicato} onChange={e => setForm(f => ({ ...f, sindicato: e.target.value }))} placeholder="Ex: SINDIMETAL-SP" />
            </div>
            <div className="space-y-2">
              <Label>Nº Registro MTE</Label>
              <Input value={form.numero_registro || ""} onChange={e => setForm(f => ({ ...f, numero_registro: e.target.value }))} placeholder="Ex: MR000123/2025" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vigência Início *</Label>
                <Input type="date" value={form.vigencia_inicio} onChange={e => setForm(f => ({ ...f, vigencia_inicio: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Vigência Fim *</Label>
                <Input type="date" value={form.vigencia_fim} onChange={e => setForm(f => ({ ...f, vigencia_fim: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Piso Salarial (R$)</Label>
              <Input type="number" step="0.01" value={form.piso_salarial ?? ""} onChange={e => setForm(f => ({ ...f, piso_salarial: e.target.value ? Number(e.target.value) : undefined }))} placeholder="Ex: 2.500,00" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>HE 50% (%)</Label>
                <Input type="number" value={form.adicional_he_50 ?? 50} onChange={e => setForm(f => ({ ...f, adicional_he_50: Number(e.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label>HE 100% (%)</Label>
                <Input type="number" value={form.adicional_he_100 ?? 100} onChange={e => setForm(f => ({ ...f, adicional_he_100: Number(e.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label>Noturno (%)</Label>
                <Input type="number" value={form.adicional_noturno ?? 20} onChange={e => setForm(f => ({ ...f, adicional_noturno: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes || ""} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={3} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
              <Label>Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
