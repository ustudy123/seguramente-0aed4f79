import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Receipt, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";

interface Props { hub: any; }

const tipoLabels: Record<string, string> = {
  inss: "INSS", fgts: "FGTS", irrf: "IRRF", darf: "DARF", grrf: "GRRF",
  contribuicao_sindical: "Contrib. Sindical", pis: "PIS", cofins: "COFINS",
  csll: "CSLL", iss: "ISS", outro: "Outro",
};

const statusIcons: Record<string, any> = {
  pendente: <Receipt className="w-4 h-4 text-amber-500" />,
  paga: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  vencida: <XCircle className="w-4 h-4 text-red-500" />,
  cancelada: <XCircle className="w-4 h-4 text-gray-400" />,
};

export function HubGuias({ hub }: Props) {
  const { guias, criarGuia, atualizarGuia, loading } = hub;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ tipo: "", competencia: "", valor: "", data_vencimento: "", descricao: "" });

  const handleSubmit = async () => {
    if (!form.tipo || !form.competencia || !form.data_vencimento) return;
    await criarGuia({ ...form, valor: parseFloat(form.valor) || 0 });
    setForm({ tipo: "", competencia: "", valor: "", data_vencimento: "", descricao: "" });
    setDialogOpen(false);
  };

  const handlePagar = async (guia: any) => {
    await atualizarGuia(guia.id, { data_pagamento: new Date().toISOString().split("T")[0] });
  };

  if (loading) return <div className="flex items-center justify-center py-16 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Guias e Impostos</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Nova Guia</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar Guia</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Tipo *</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(tipoLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Competência *</Label>
                <Input type="month" value={form.competencia} onChange={(e) => setForm({ ...form, competencia: e.target.value })} />
              </div>
              <div>
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
              </div>
              <div>
                <Label>Data Vencimento *</Label>
                <Input type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} />
              </div>
              <Button onClick={handleSubmit} className="w-full" disabled={!form.tipo || !form.competencia || !form.data_vencimento}>Registrar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {guias.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhuma guia registrada.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {guias.map((guia: any) => {
            const dias = differenceInDays(parseISO(guia.data_vencimento), new Date());
            return (
              <Card key={guia.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {statusIcons[guia.status]}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{tipoLabels[guia.tipo] || guia.tipo}</span>
                        <Badge variant="outline" className="text-xs">{guia.competencia}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Venc: {format(parseISO(guia.data_vencimento), "dd/MM/yyyy")}
                        {guia.status === "pendente" && dias <= 7 && dias >= 0 && <span className="text-amber-600 ml-1"> ({dias}d restantes)</span>}
                        {guia.data_pagamento && ` • Pago em ${format(parseISO(guia.data_pagamento), "dd/MM/yyyy")}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-sm">R$ {Number(guia.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    {guia.status === "pendente" && (
                      <Button size="sm" variant="outline" onClick={() => handlePagar(guia)}>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Pagar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
