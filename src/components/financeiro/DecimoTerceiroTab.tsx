import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Gift, Eye } from "lucide-react";
import { useFolhaCalculo } from "@/hooks/useFolhaCalculo";
import { useColaboradores } from "@/hooks/useColaboradores";
import { toast } from "sonner";

const fmtMoeda = (v: number) => (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

export function DecimoTerceiroTab() {
  const { use13Calculo, criar13Calculo, criando13 } = useFolhaCalculo();
  const [ano, setAno] = useState(new Date().getFullYear());
  const { data: calculos = [], isLoading } = use13Calculo(ano);
  const { colaboradores } = useColaboradores();
  const [showModal, setShowModal] = useState(false);
  const [showDetalhe, setShowDetalhe] = useState<any>(null);

  const [form, setForm] = useState({
    ano: new Date().getFullYear(),
    colaborador_id: "",
    colaborador_nome: "",
    colaborador_cpf: "",
    parcela: 1 as 1 | 2,
    meses_trabalhados: 12,
    remuneracao_base: 0,
    media_variaveis: 0,
    valor_primeira_parcela: 0,
    dependentes_irrf: 0,
  });

  const handleColabSelect = (id: string) => {
    const c = colaboradores.find((c: any) => c.id === id) as any;
    if (c) {
      setForm(p => ({
        ...p,
        colaborador_id: c.id,
        colaborador_nome: c.nome_completo,
        colaborador_cpf: c.cpf,
        remuneracao_base: c.salario || 0,
      }));
    }
  };

  const handleCalcular = async () => {
    if (!form.colaborador_nome) return toast.error("Selecione o colaborador");
    await criar13Calculo({
      ...form,
      remuneracao_base: form.remuneracao_base,
    });
    setShowModal(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" /> 13º Salário
          </h3>
          <p className="text-sm text-muted-foreground">Cálculo de 1ª e 2ª parcela com INSS/IRRF</p>
        </div>
        <div className="flex gap-2">
          <Input type="number" className="w-24" value={ano} onChange={e => setAno(Number(e.target.value))} />
          <Button onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4 mr-2" /> Calcular 13º
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead className="text-center">Parcela</TableHead>
                <TableHead className="text-center">Meses</TableHead>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">INSS</TableHead>
                <TableHead className="text-right">IRRF</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : calculos.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum cálculo de 13º para {ano}.</TableCell></TableRow>
              ) : calculos.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.colaborador_nome}</TableCell>
                  <TableCell className="text-center"><Badge variant="outline">{c.parcela}ª</Badge></TableCell>
                  <TableCell className="text-center">{c.meses_trabalhados}/12</TableCell>
                  <TableCell className="text-right">R$ {fmtMoeda(c.valor_bruto)}</TableCell>
                  <TableCell className="text-right text-destructive">R$ {fmtMoeda(c.valor_inss)}</TableCell>
                  <TableCell className="text-right text-destructive">R$ {fmtMoeda(c.valor_irrf)}</TableCell>
                  <TableCell className="text-right font-bold">R$ {fmtMoeda(c.total_liquido)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => setShowDetalhe(c)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Calcular */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Calcular 13º Salário</DialogTitle>
            <DialogDescription>Preencha os dados para calcular a parcela</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Colaborador *</Label>
              <Select value={form.colaborador_id} onValueChange={handleColabSelect}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {colaboradores.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome_completo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Parcela</Label>
                <Select value={String(form.parcela)} onValueChange={v => setForm(p => ({ ...p, parcela: Number(v) as 1 | 2 }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1ª Parcela</SelectItem>
                    <SelectItem value="2">2ª Parcela</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Meses Trabalhados</Label>
                <Input type="number" min="1" max="12" value={form.meses_trabalhados} onChange={e => setForm(p => ({ ...p, meses_trabalhados: Number(e.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label>Remuneração Base</Label>
                <Input type="number" step="0.01" value={form.remuneracao_base} onChange={e => setForm(p => ({ ...p, remuneracao_base: Number(e.target.value) }))} />
              </div>
            </div>
            {form.parcela === 2 && (
              <div className="space-y-2">
                <Label>Valor 1ª Parcela (já paga)</Label>
                <Input type="number" step="0.01" value={form.valor_primeira_parcela} onChange={e => setForm(p => ({ ...p, valor_primeira_parcela: Number(e.target.value) }))} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleCalcular} disabled={criando13}>
              {criando13 ? "Calculando..." : "Calcular"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Detalhe */}
      <Dialog open={!!showDetalhe} onOpenChange={() => setShowDetalhe(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>13º Salário — {showDetalhe?.colaborador_nome}</DialogTitle>
          </DialogHeader>
          {showDetalhe && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Parcela:</span> {showDetalhe.parcela}ª</div>
                <div><span className="text-muted-foreground">Meses:</span> {showDetalhe.meses_trabalhados}/12</div>
              </div>
              <Card>
                <CardContent className="space-y-2 pt-4">
                  <div className="flex justify-between"><span>13º Bruto</span><span className="font-medium">R$ {fmtMoeda(showDetalhe.valor_bruto)}</span></div>
                  {showDetalhe.parcela === 2 && <div className="flex justify-between text-muted-foreground"><span>(-) 1ª Parcela</span><span>R$ {fmtMoeda(showDetalhe.valor_primeira_parcela)}</span></div>}
                  <div className="flex justify-between text-destructive"><span>(-) INSS</span><span>R$ {fmtMoeda(showDetalhe.valor_inss)}</span></div>
                  <div className="flex justify-between text-destructive"><span>(-) IRRF</span><span>R$ {fmtMoeda(showDetalhe.valor_irrf)}</span></div>
                  <div className="flex justify-between"><span>FGTS</span><span className="text-muted-foreground">R$ {fmtMoeda(showDetalhe.valor_fgts)}</span></div>
                  <div className="border-t pt-2 flex justify-between font-bold text-lg"><span>Líquido</span><span className="text-primary">R$ {fmtMoeda(showDetalhe.total_liquido)}</span></div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
