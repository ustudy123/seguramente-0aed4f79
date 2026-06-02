import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CompetenciaInput } from "@/components/ui/competencia-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { usePontoBancoHoras, type BancoHoras } from "@/hooks/usePontoBancoHoras";
import { useColaboradores } from "@/hooks/useColaboradores";
import { format } from "date-fns";
import { Wallet, Plus, ArrowUpRight, ArrowDownRight, RefreshCw, TrendingUp, TrendingDown, Upload, Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export function PontoBancoHorasTab() {
  const [competencia, setCompetencia] = useState(format(new Date(), "yyyy-MM"));
  const {
    useBancoHorasPorCompetencia,
    useMovimentacoes,
    adicionarMovimentacao,
    adicionandoMovimentacao,
    criarBancoHoras,
    criandoBancoHoras,
  } = usePontoBancoHoras();
  const { colaboradores } = useColaboradores();

  const { data: bancos = [], isLoading } = useBancoHorasPorCompetencia(competencia);
  const [selectedBanco, setSelectedBanco] = useState<BancoHoras | null>(null);
  const { data: movimentacoes = [] } = useMovimentacoes(selectedBanco?.id || null);

  const [showCriar, setShowCriar] = useState(false);
  const [showMovimentacao, setShowMovimentacao] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importando, setImportando] = useState(false);
  const [importResumo, setImportResumo] = useState<{ ok: number; erros: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [criarForm, setCriarForm] = useState({ colaborador_id: "", tipo: "mensal" });
  const [movForm, setMovForm] = useState({ tipo: "credito", minutos: 0, data_referencia: format(new Date(), "yyyy-MM-dd"), descricao: "" });

  const formatMinutos = (min: number) => {
    const sinal = min < 0 ? "-" : "";
    const abs = Math.abs(min);
    return `${sinal}${Math.floor(abs / 60)}h ${abs % 60}min`;
  };

  const handleCriar = async () => {
    const colab = colaboradores.find(c => c.id === criarForm.colaborador_id);
    if (!colab) { toast.error("Selecione um colaborador"); return; }
    await criarBancoHoras({
      colaborador_id: colab.id,
      colaborador_nome: colab.nome_completo,
      colaborador_cpf: colab.cpf,
      tipo: criarForm.tipo,
      competencia,
    });
    setShowCriar(false);
  };

  const handleMovimentacao = async () => {
    if (!selectedBanco || movForm.minutos <= 0) { toast.error("Preencha os dados"); return; }
    await adicionarMovimentacao({
      bancoHorasId: selectedBanco.id,
      colaboradorCpf: selectedBanco.colaborador_cpf || "",
      dataReferencia: movForm.data_referencia,
      tipo: movForm.tipo,
      minutos: movForm.minutos,
      descricao: movForm.descricao,
    });
    setShowMovimentacao(false);
    setMovForm({ tipo: "credito", minutos: 0, data_referencia: format(new Date(), "yyyy-MM-dd"), descricao: "" });
  };

  const totalCreditos = bancos.reduce((s, b) => s + b.creditos_minutos, 0);
  const totalDebitos = bancos.reduce((s, b) => s + b.debitos_minutos, 0);
  const totalSaldo = bancos.reduce((s, b) => s + b.saldo_atual_minutos, 0);

  const onlyDigits = (s: string) => (s || "").toString().replace(/\D/g, "");

  const baixarModeloImport = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["CPF", "Tipo Banco", "Tipo Movimentacao", "Data Referencia", "Minutos", "Descricao"],
      ["00000000000", "mensal", "credito", format(new Date(), "yyyy-MM-dd"), 60, "Hora extra exemplo"],
      ["00000000000", "mensal", "debito", format(new Date(), "yyyy-MM-dd"), 30, "Atraso exemplo"],
      ["00000000000", "mensal", "compensacao", format(new Date(), "yyyy-MM-dd"), 60, "Folga compensada"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BancoHoras");
    XLSX.writeFile(wb, `modelo-import-banco-horas-${competencia}.xlsx`);
  };

  const handleImportFile = async (file: File) => {
    setImportando(true);
    setImportResumo(null);
    const erros: string[] = [];
    let ok = 0;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (rows.length === 0) { toast.error("Planilha vazia"); setImportando(false); return; }

      // Mapa CPF → colaborador (apenas dígitos)
      const colabPorCpf = new Map<string, typeof colaboradores[number]>();
      for (const c of colaboradores) colabPorCpf.set(onlyDigits(c.cpf || ""), c);

      // Mapa CPF → banco já existente nesta competência
      const bancoPorCpf = new Map<string, BancoHoras>();
      for (const b of bancos) bancoPorCpf.set(onlyDigits(b.colaborador_cpf || ""), b);

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const linha = i + 2;
        try {
          const cpf = onlyDigits(String(r["CPF"] ?? r["cpf"] ?? ""));
          const tipoBanco = String(r["Tipo Banco"] ?? r["tipo_banco"] ?? "mensal").toLowerCase().trim();
          const tipoMov = String(r["Tipo Movimentacao"] ?? r["Tipo Movimentação"] ?? r["tipo_movimentacao"] ?? "credito").toLowerCase().trim();
          const dataRef = String(r["Data Referencia"] ?? r["Data Referência"] ?? r["data_referencia"] ?? "").trim();
          const minutos = Number(r["Minutos"] ?? r["minutos"] ?? 0);
          const descricao = String(r["Descricao"] ?? r["Descrição"] ?? r["descricao"] ?? "").trim();

          if (!cpf) { erros.push(`Linha ${linha}: CPF vazio`); continue; }
          const colab = colabPorCpf.get(cpf);
          if (!colab) { erros.push(`Linha ${linha}: colaborador (CPF ${cpf}) não encontrado`); continue; }
          if (!["credito", "debito", "compensacao"].includes(tipoMov)) { erros.push(`Linha ${linha}: tipo movimentação inválido (${tipoMov})`); continue; }
          if (!dataRef || isNaN(new Date(dataRef).getTime())) { erros.push(`Linha ${linha}: data inválida`); continue; }
          if (!minutos || minutos <= 0) { erros.push(`Linha ${linha}: minutos inválidos`); continue; }

          let banco = bancoPorCpf.get(cpf);
          if (!banco) {
            banco = await criarBancoHoras({
              colaborador_id: colab.id,
              colaborador_nome: colab.nome_completo,
              colaborador_cpf: colab.cpf,
              tipo: ["mensal", "semestral", "anual"].includes(tipoBanco) ? tipoBanco : "mensal",
              competencia,
            }) as BancoHoras;
            bancoPorCpf.set(cpf, banco);
          }

          await adicionarMovimentacao({
            bancoHorasId: banco.id,
            colaboradorCpf: colab.cpf,
            dataReferencia: dataRef,
            tipo: tipoMov,
            minutos,
            descricao,
          });
          ok++;
        } catch (e: any) {
          erros.push(`Linha ${linha}: ${e?.message || "erro desconhecido"}`);
        }
      }
      setImportResumo({ ok, erros });
      if (ok > 0) toast.success(`${ok} movimentação(ões) importada(s)`);
      if (erros.length > 0) toast.warning(`${erros.length} linha(s) com erro`);
    } catch (e: any) {
      toast.error("Erro ao ler planilha: " + (e?.message || ""));
    } finally {
      setImportando(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" /> Banco de Horas
          </h3>
          <p className="text-sm text-muted-foreground">Saldos, movimentações e compensações</p>
        </div>
        <div className="flex items-center gap-2">
          <CompetenciaInput value={competencia} onChange={setCompetencia} className="w-[180px]" />
          <Button onClick={() => setShowCriar(true)}>
            <Plus className="w-4 h-4 mr-2" /> Novo Banco
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-xl font-bold text-green-600">{formatMinutos(totalCreditos)}</p>
              <p className="text-xs text-muted-foreground">Total Créditos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingDown className="w-8 h-8 text-red-500" />
            <div>
              <p className="text-xl font-bold text-red-600">{formatMinutos(totalDebitos)}</p>
              <p className="text-xs text-muted-foreground">Total Débitos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Wallet className="w-8 h-8 text-primary" />
            <div>
              <p className={`text-xl font-bold ${totalSaldo >= 0 ? "text-green-600" : "text-red-600"}`}>{formatMinutos(totalSaldo)}</p>
              <p className="text-xs text-muted-foreground">Saldo Total</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Saldo Anterior</TableHead>
                <TableHead className="text-right">Créditos</TableHead>
                <TableHead className="text-right">Débitos</TableHead>
                <TableHead className="text-right">Compensados</TableHead>
                <TableHead className="text-right">Saldo Atual</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">Carregando...</TableCell></TableRow>
              ) : bancos.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum banco de horas para esta competência.</TableCell></TableRow>
              ) : bancos.map(b => (
                <TableRow key={b.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedBanco(b)}>
                  <TableCell className="font-medium">{b.colaborador_nome}</TableCell>
                  <TableCell><Badge variant="outline">{b.tipo}</Badge></TableCell>
                  <TableCell className="text-right font-mono">{formatMinutos(b.saldo_anterior_minutos)}</TableCell>
                  <TableCell className="text-right font-mono text-green-600">+{formatMinutos(b.creditos_minutos)}</TableCell>
                  <TableCell className="text-right font-mono text-red-600">-{formatMinutos(b.debitos_minutos)}</TableCell>
                  <TableCell className="text-right font-mono">{formatMinutos(b.compensados_minutos)}</TableCell>
                  <TableCell className={`text-right font-mono font-bold ${b.saldo_atual_minutos >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatMinutos(b.saldo_atual_minutos)}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); setSelectedBanco(b); setShowMovimentacao(true); }}>
                      <RefreshCw className="w-3 h-3 mr-1" /> Movimentar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Movimentações do banco selecionado */}
      {selectedBanco && !showMovimentacao && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Movimentações — {selectedBanco.colaborador_nome}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Minutos</TableHead>
                  <TableHead>Descrição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimentacoes.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">Sem movimentações</TableCell></TableRow>
                ) : movimentacoes.map(m => (
                  <TableRow key={m.id}>
                    <TableCell>{m.data_referencia}</TableCell>
                    <TableCell>
                      <Badge className={m.tipo === "credito" ? "bg-green-100 text-green-800" : m.tipo === "debito" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"}>
                        {m.tipo === "credito" && <ArrowUpRight className="w-3 h-3 mr-1" />}
                        {m.tipo === "debito" && <ArrowDownRight className="w-3 h-3 mr-1" />}
                        {m.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">{formatMinutos(m.minutos)}</TableCell>
                    <TableCell>{m.descricao || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dialog Criar */}
      <Dialog open={showCriar} onOpenChange={setShowCriar}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Banco de Horas</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Colaborador</Label>
              <Select value={criarForm.colaborador_id} onValueChange={v => setCriarForm({ ...criarForm, colaborador_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{colaboradores.map(c => <SelectItem key={c.id} value={c.id}>{c.nome_completo}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={criarForm.tipo} onValueChange={v => setCriarForm({ ...criarForm, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="semestral">Semestral</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCriar(false)}>Cancelar</Button>
            <Button onClick={handleCriar} disabled={criandoBancoHoras}>{criandoBancoHoras ? "Criando..." : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Movimentação */}
      <Dialog open={showMovimentacao} onOpenChange={setShowMovimentacao}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Movimentação — {selectedBanco?.colaborador_nome}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={movForm.tipo} onValueChange={v => setMovForm({ ...movForm, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="credito">Crédito (HE)</SelectItem>
                  <SelectItem value="debito">Débito (Falta/Atraso)</SelectItem>
                  <SelectItem value="compensacao">Compensação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Referência</Label>
                <Input type="date" value={movForm.data_referencia} onChange={e => setMovForm({ ...movForm, data_referencia: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Minutos</Label>
                <Input type="number" value={movForm.minutos} onChange={e => setMovForm({ ...movForm, minutos: +e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={movForm.descricao} onChange={e => setMovForm({ ...movForm, descricao: e.target.value })} placeholder="Opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMovimentacao(false)}>Cancelar</Button>
            <Button onClick={handleMovimentacao} disabled={adicionandoMovimentacao}>{adicionandoMovimentacao ? "Registrando..." : "Registrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
