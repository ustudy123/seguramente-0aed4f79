import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Calculator, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { TABELA_INSS_2025, TABELA_IRRF_2025, TETO_INSS_2025, DEDUCAO_DEPENDENTE_IRRF_2025 } from "@/lib/folha/calculos";

interface Faixa {
  de: number;
  ate: number;
  aliquota: number;
  deducao?: number;
}

interface TabelaFiscal {
  id: string;
  tipo: string;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  ativo: boolean;
  faixas: Faixa[];
  teto: number | null;
  deducao_por_dependente: number | null;
  observacoes: string | null;
}

const fmtMoeda = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

export default function TabelasFiscaisTab() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tipo, setTipo] = useState<"inss" | "irrf">("inss");
  const [vigenciaInicio, setVigenciaInicio] = useState("");
  const [teto, setTeto] = useState("");
  const [deducaoDep, setDeducaoDep] = useState("");
  const [faixas, setFaixas] = useState<Faixa[]>([{ de: 0, ate: 0, aliquota: 0 }]);

  const { data: tabelas = [], isLoading } = useQuery({
    queryKey: ["tabelas-fiscais", tenantId],
    queryFn: async (): Promise<TabelaFiscal[]> => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("tabelas_fiscais" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("vigencia_inicio", { ascending: false }) as { data: any[] | null; error: Error | null };
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        faixas: typeof d.faixas === 'string' ? JSON.parse(d.faixas) : (d.faixas || []),
      }));
    },
    enabled: !!tenantId,
  });

  const criarMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      const { error } = await supabase
        .from("tabelas_fiscais" as never)
        .insert({
          tenant_id: tenantId,
          tipo,
          vigencia_inicio: vigenciaInicio,
          ativo: true,
          faixas: JSON.stringify(faixas),
          teto: teto ? parseFloat(teto) : null,
          deducao_por_dependente: deducaoDep ? parseFloat(deducaoDep) : null,
        } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tabelas-fiscais"] });
      toast.success("Tabela fiscal criada!");
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAtivoMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("tabelas_fiscais" as never)
        .update({ ativo } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tabelas-fiscais"] });
      toast.success("Status atualizado!");
    },
  });

  const resetForm = () => {
    setTipo("inss");
    setVigenciaInicio("");
    setTeto("");
    setDeducaoDep("");
    setFaixas([{ de: 0, ate: 0, aliquota: 0 }]);
  };

  const preencherPadrao = () => {
    if (tipo === "inss") {
      setFaixas(TABELA_INSS_2025.map(f => ({ de: f.de, ate: f.ate, aliquota: f.aliquota })));
      setTeto(String(TETO_INSS_2025));
    } else {
      setFaixas(TABELA_IRRF_2025.map(f => ({ de: f.de, ate: f.ate, aliquota: f.aliquota, deducao: f.deducao })));
      setDeducaoDep(String(DEDUCAO_DEPENDENTE_IRRF_2025));
    }
  };

  const addFaixa = () => setFaixas([...faixas, { de: 0, ate: 0, aliquota: 0 }]);
  const removeFaixa = (i: number) => setFaixas(faixas.filter((_, idx) => idx !== i));
  const updateFaixa = (i: number, field: string, val: string) => {
    const updated = [...faixas];
    (updated[i] as any)[field] = parseFloat(val) || 0;
    setFaixas(updated);
  };

  const tabelasINSS = tabelas.filter(t => t.tipo === "inss");
  const tabelasIRRF = tabelas.filter(t => t.tipo === "irrf");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" /> Tabelas Fiscais Dinâmicas
          </h3>
          <p className="text-sm text-muted-foreground">
            INSS e IRRF parametrizáveis sem necessidade de deploy (RNFOLHA46)
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Nova Tabela</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Tabela Fiscal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo</Label>
                  <Select value={tipo} onValueChange={(v: "inss" | "irrf") => setTipo(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inss">INSS</SelectItem>
                      <SelectItem value="irrf">IRRF</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Vigência início</Label>
                  <Input type="date" value={vigenciaInicio} onChange={e => setVigenciaInicio(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {tipo === "inss" && (
                  <div>
                    <Label>Teto INSS</Label>
                    <Input type="number" step="0.01" value={teto} onChange={e => setTeto(e.target.value)} />
                  </div>
                )}
                {tipo === "irrf" && (
                  <div>
                    <Label>Dedução por dependente</Label>
                    <Input type="number" step="0.01" value={deducaoDep} onChange={e => setDeducaoDep(e.target.value)} />
                  </div>
                )}
                <div className="flex items-end">
                  <Button variant="outline" size="sm" onClick={preencherPadrao}>
                    Preencher com tabela 2025
                  </Button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Faixas</Label>
                  <Button variant="ghost" size="sm" onClick={addFaixa}><Plus className="w-3 h-3 mr-1" /> Faixa</Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>De (R$)</TableHead>
                      <TableHead>Até (R$)</TableHead>
                      <TableHead>Alíquota (%)</TableHead>
                      {tipo === "irrf" && <TableHead>Dedução (R$)</TableHead>}
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {faixas.map((f, i) => (
                      <TableRow key={i}>
                        <TableCell><Input type="number" step="0.01" value={f.de} onChange={e => updateFaixa(i, "de", e.target.value)} /></TableCell>
                        <TableCell><Input type="number" step="0.01" value={f.ate} onChange={e => updateFaixa(i, "ate", e.target.value)} /></TableCell>
                        <TableCell><Input type="number" step="0.01" value={f.aliquota} onChange={e => updateFaixa(i, "aliquota", e.target.value)} /></TableCell>
                        {tipo === "irrf" && <TableCell><Input type="number" step="0.01" value={f.deducao || 0} onChange={e => updateFaixa(i, "deducao", e.target.value)} /></TableCell>}
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeFaixa(i)} disabled={faixas.length <= 1}>
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Button onClick={() => criarMutation.mutate()} disabled={!vigenciaInicio || criarMutation.isPending} className="w-full">
                Salvar Tabela
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabelas existentes */}
      {[{ label: "INSS", data: tabelasINSS }, { label: "IRRF", data: tabelasIRRF }].map(({ label, data }) => (
        <Card key={label}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{label}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Usando tabela padrão 2025 hardcoded. Crie uma tabela para parametrizar.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vigência</TableHead>
                    <TableHead>Faixas</TableHead>
                    <TableHead>{label === "INSS" ? "Teto" : "Ded. Dep."}</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-20">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm">
                        {new Date(t.vigencia_inicio + 'T00:00:00').toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-sm">{t.faixas?.length || 0} faixas</TableCell>
                      <TableCell className="text-sm">
                        R$ {fmtMoeda(t.teto || t.deducao_por_dependente || 0)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.ativo ? "default" : "secondary"}>
                          {t.ativo ? "Ativa" : "Inativa"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleAtivoMutation.mutate({ id: t.id, ativo: !t.ativo })}
                        >
                          {t.ativo ? <XCircle className="w-4 h-4 text-destructive" /> : <CheckCircle2 className="w-4 h-4 text-green-600" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ))}

      <Card className="border-dashed">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong>Nota:</strong> Quando uma tabela dinâmica está ativa, o motor de cálculo a utilizará 
            automaticamente ao invés das constantes hardcoded. Se nenhuma tabela ativa existir, 
            os valores padrão 2025 serão utilizados como fallback.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}