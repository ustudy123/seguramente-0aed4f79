import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { Wallet, Plus, ArrowUpRight, ArrowDownRight, RefreshCw, TrendingUp, TrendingDown, Upload, Download, FileSpreadsheet, Pencil, Trash2, CalendarDays } from "lucide-react";
import { confirm } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export function PontoBancoHorasTab() {
  const [competencia, setCompetencia] = useState(format(new Date(), "yyyy-MM"));
  const {
    useBancoHorasPorCompetencia,
    useMovimentacoes,
    adicionarMovimentacao,
    adicionandoMovimentacao,
    editarMovimentacao,
    editandoMovimentacao,
    excluirMovimentacao,
    criarBancoHoras,
    criandoBancoHoras,
    editarBancoHoras,
    editandoBancoHoras,
    excluirBancoHoras,
    apurarBancoHoras,
    apurandoBancoHoras,
  } = usePontoBancoHoras();
  const { colaboradores } = useColaboradores();
  const { tenantId } = useAuth();

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
  const [editMov, setEditMov] = useState<null | { id: string; tipo: string; minutos: number; data_referencia: string; descricao: string }>(null);
  const [editBanco, setEditBanco] = useState<null | {
    id: string;
    colaborador_id: string;
    colaborador_cpf: string;
    colaborador_nome: string;
    tipo: string;
    competencia: string;
    saldo_anterior_minutos: number;
    saldo_anterior_horas: number;
    saldo_anterior_mins: number;
    saldo_anterior_negativo: boolean;
    creditos_minutos: number;
    debitos_minutos: number;
    compensados_minutos: number;
    prazo_compensacao: string;
    observacoes: string;
  }>(null);

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

  const handleApurar = async () => {
    const ok = await confirm({
      title: `Apurar banco de horas — ${competencia}`,
      description:
        "O sistema vai calcular créditos (horas além da jornada) e débitos (atrasos, faltas e saídas antecipadas) a partir do ponto de cada colaborador, comparando com a jornada da escala. Lançamentos manuais são preservados; apenas os valores apurados anteriores são substituídos.",
      confirmLabel: "Apurar agora",
    });
    if (!ok) return;
    await apurarBancoHoras(competencia);
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

  // Dias do colaborador em edição (ponto_diario da competência)
  const editComp = editBanco?.competencia || "";
  const editIniFim = (() => {
    if (!editComp || !/^\d{4}-\d{2}$/.test(editComp)) return null;
    const [y, m] = editComp.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate(); // dia 0 do mês seguinte = último dia do mês atual
    const mm = String(m).padStart(2, "0");
    const dd = String(lastDay).padStart(2, "0");
    return { ini: `${editComp}-01`, fim: `${editComp}-${dd}` };
  })();
  const { data: diasBanco = [], isLoading: carregandoDias } = useQuery({
    queryKey: ["banco-horas-dias", editBanco?.colaborador_cpf, editComp],
    enabled: !!editBanco && !!editIniFim,
    queryFn: async () => {
      if (!editBanco || !editIniFim) return [];
      const cpfDigits = (editBanco.colaborador_cpf || "").replace(/\D/g, "");
      let query = (supabase as any)
        .from("ponto_diario")
        .select("id, data, horas_trabalhadas, horas_extras, horas_faltantes, entrada, saida, status, observacao, colaborador_cpf, colaborador_id")
        .gte("data", editIniFim.ini)
        .lte("data", editIniFim.fim)
        .order("data", { ascending: true });
      if (cpfDigits) {
        query = query.eq("colaborador_cpf", cpfDigits);
      } else {
        query = query.eq("colaborador_id", editBanco.colaborador_id);
      }
      const { data, error } = await query;
      if (error) throw error;
      const intervalToMin = (v: any): number => {
        if (!v) return 0;
        if (typeof v === "number") return Math.round(v);
        if (typeof v === "object" && v !== null) {
          const h = v.hours || 0, m = v.minutes || 0, s = v.seconds || 0;
          return h * 60 + m + Math.round(s / 60);
        }
        const s = String(v);
        const parts = s.split(":");
        if (parts.length >= 2) return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
        return 0;
      };
      return (data || []).map((d: any) => ({
        id: d.id,
        data: d.data,
        entrada: d.entrada,
        saida: d.saida,
        status: d.status,
        observacao: d.observacao,
        horas_trabalhadas_minutos: intervalToMin(d.horas_trabalhadas),
        saldo_minutos: intervalToMin(d.horas_extras) - intervalToMin(d.horas_faltantes),
      })) as Array<{
        id: string; data: string; horas_trabalhadas_minutos: number; saldo_minutos: number;
        entrada: string | null; saida: string | null; status: string | null; observacao: string | null;
      }>;
    },
  });

  const onlyDigits = (s: string) => (s || "").toString().replace(/\D/g, "");

  // Filtra bancos de colaboradores ativos (useColaboradores já exclui inativos/desligados)
  const cpfsAtivos = new Set(colaboradores.map(c => onlyDigits(c.cpf || "")));
  const idsAtivos = new Set(colaboradores.map(c => c.id));
  const bancosVisiveis = bancos.filter(b => {
    const cpf = onlyDigits((b as any).colaborador_cpf || "");
    if (cpf && cpfsAtivos.has(cpf)) return true;
    if (b.colaborador_id && idsAtivos.has(b.colaborador_id)) return true;
    return false;
  });

  const totalCreditos = bancosVisiveis.reduce((s, b) => s + b.creditos_minutos, 0);
  const totalDebitos = bancosVisiveis.reduce((s, b) => s + b.debitos_minutos, 0);
  const totalSaldo = bancosVisiveis.reduce((s, b) => s + b.saldo_atual_minutos, 0);

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
        <div className="flex items-center gap-2 flex-wrap">
          <CompetenciaInput value={competencia} onChange={setCompetencia} className="w-[180px]" />
          <Button onClick={handleApurar} disabled={apurandoBancoHoras}>
            <RefreshCw className={`w-4 h-4 mr-2 ${apurandoBancoHoras ? "animate-spin" : ""}`} />
            {apurandoBancoHoras ? "Apurando..." : "Apurar agora"}
          </Button>
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <Upload className="w-4 h-4 mr-2" /> Importar
          </Button>
          <Button variant="outline" onClick={() => setShowCriar(true)}>
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
              ) : bancosVisiveis.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum banco de horas para esta competência.</TableCell></TableRow>
              ) : bancosVisiveis.map(b => (
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
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); setSelectedBanco(b); setShowMovimentacao(true); }}>
                        <RefreshCw className="w-3 h-3 mr-1" /> Movimentar
                      </Button>
                      <Button size="icon" variant="ghost" title="Editar banco" onClick={e => {
                        e.stopPropagation();
                        const sa = b.saldo_anterior_minutos || 0;
                        const abs = Math.abs(sa);
                        setEditBanco({
                          id: b.id,
                          colaborador_id: b.colaborador_id,
                          colaborador_cpf: (b as any).colaborador_cpf || "",
                          colaborador_nome: b.colaborador_nome,
                          tipo: b.tipo,
                          competencia: b.competencia || competencia,
                          saldo_anterior_minutos: sa,
                          saldo_anterior_horas: Math.floor(abs / 60),
                          saldo_anterior_mins: abs % 60,
                          saldo_anterior_negativo: sa < 0,
                          creditos_minutos: b.creditos_minutos || 0,
                          debitos_minutos: b.debitos_minutos || 0,
                          compensados_minutos: b.compensados_minutos || 0,
                          prazo_compensacao: (b as any).prazo_compensacao || "",
                          observacoes: (b as any).observacoes || "",
                        });
                      }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Excluir banco" onClick={async e => {
                        e.stopPropagation();
                        const ok = await confirm({
                          title: "Excluir banco de horas?",
                          description: `Todas as movimentações de ${b.colaborador_nome} nesta competência serão removidas. Esta ação não pode ser desfeita.`,
                          confirmLabel: "Excluir",
                          variant: "destructive",
                        });
                        if (ok) {
                          await excluirBancoHoras(b.id);
                          if (selectedBanco?.id === b.id) setSelectedBanco(null);
                        }
                      }}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
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
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimentacoes.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">Sem movimentações</TableCell></TableRow>
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
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {m.origem === "apuracao"
                          ? <Badge variant="secondary" className="text-[10px]">Apurado</Badge>
                          : <Badge variant="outline" className="text-[10px]">Manual</Badge>}
                        <span>{m.descricao || "-"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" title="Editar" onClick={() => setEditMov({ id: m.id, tipo: m.tipo, minutos: m.minutos, data_referencia: m.data_referencia, descricao: m.descricao || "" })}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Excluir" onClick={async () => {
                          const ok = await confirm({ title: "Excluir movimentação?", description: "Esta ação recalculará o saldo do banco de horas.", confirmLabel: "Excluir", variant: "destructive" });
                          if (ok && selectedBanco) await excluirMovimentacao({ id: m.id, bancoHorasId: selectedBanco.id });
                        }}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
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

      {/* Dialog Editar Movimentação */}
      <Dialog open={!!editMov} onOpenChange={(o) => { if (!o) setEditMov(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Movimentação</DialogTitle></DialogHeader>
          {editMov && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={editMov.tipo} onValueChange={v => setEditMov({ ...editMov, tipo: v })}>
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
                  <Input type="date" value={editMov.data_referencia} onChange={e => setEditMov({ ...editMov, data_referencia: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Minutos</Label>
                  <Input type="number" value={editMov.minutos} onChange={e => setEditMov({ ...editMov, minutos: +e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input value={editMov.descricao} onChange={e => setEditMov({ ...editMov, descricao: e.target.value })} placeholder="Opcional" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMov(null)}>Cancelar</Button>
            <Button
              disabled={editandoMovimentacao || !editMov || editMov.minutos <= 0}
              onClick={async () => {
                if (!editMov || !selectedBanco) return;
                await editarMovimentacao({
                  id: editMov.id,
                  bancoHorasId: selectedBanco.id,
                  tipo: editMov.tipo,
                  minutos: editMov.minutos,
                  data_referencia: editMov.data_referencia,
                  descricao: editMov.descricao,
                });
                setEditMov(null);
              }}
            >{editandoMovimentacao ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Importar */}
      <Dialog open={showImport} onOpenChange={(o) => { setShowImport(o); if (!o) setImportResumo(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="w-5 h-5" /> Importar Banco de Horas</DialogTitle>
            <DialogDescription>
              Envie uma planilha .xlsx com as colunas: <strong>CPF</strong>, <strong>Tipo Banco</strong> (mensal/semestral/anual),
              <strong> Tipo Movimentacao</strong> (credito/debito/compensacao), <strong>Data Referencia</strong> (AAAA-MM-DD),
              <strong> Minutos</strong>, <strong>Descricao</strong>. Cada linha cria uma movimentação na competência <strong>{competencia}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Button variant="outline" size="sm" onClick={baixarModeloImport} className="w-full">
              <Download className="w-4 h-4 mr-2" /> Baixar modelo de planilha
            </Button>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              disabled={importando}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); }}
            />
            {importando && <p className="text-sm text-muted-foreground">Processando planilha…</p>}
            {importResumo && (
              <div className="rounded-md border p-3 text-sm space-y-2 max-h-60 overflow-auto">
                <p className="font-medium text-green-700">{importResumo.ok} movimentação(ões) importada(s) com sucesso.</p>
                {importResumo.erros.length > 0 && (
                  <div className="text-red-700">
                    <p className="font-medium">{importResumo.erros.length} erro(s):</p>
                    <ul className="list-disc list-inside text-xs space-y-0.5">
                      {importResumo.erros.slice(0, 30).map((e, i) => <li key={i}>{e}</li>)}
                      {importResumo.erros.length > 30 && <li>… e mais {importResumo.erros.length - 30}</li>}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImport(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Dialog Editar Banco de Horas */}
      <Dialog open={!!editBanco} onOpenChange={(o) => { if (!o) setEditBanco(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Editar Banco de Horas — {editBanco?.colaborador_nome}
            </DialogTitle>
            <DialogDescription>
              Ajuste tipo, competência, saldo anterior e prazo de compensação. O saldo atual é recalculado automaticamente
              (saldo anterior + créditos − débitos − compensados).
            </DialogDescription>
          </DialogHeader>
          {editBanco && (() => {
            const sinal = editBanco.saldo_anterior_negativo ? -1 : 1;
            const saldoAnteriorMin = sinal * (editBanco.saldo_anterior_horas * 60 + editBanco.saldo_anterior_mins);
            const saldoAtual = saldoAnteriorMin + editBanco.creditos_minutos - editBanco.debitos_minutos - editBanco.compensados_minutos;
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Colaborador</Label>
                    <Input value={editBanco.colaborador_nome} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Competência (mês/ano)</Label>
                    <CompetenciaInput
                      value={editBanco.competencia}
                      onChange={v => setEditBanco({ ...editBanco, competencia: v })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Tipo de banco</Label>
                  <Select value={editBanco.tipo} onValueChange={v => setEditBanco({ ...editBanco, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="semestral">Semestral</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Saldo Anterior</Label>
                  <div className="grid grid-cols-[110px_1fr_1fr] gap-2">
                    <Select
                      value={editBanco.saldo_anterior_negativo ? "neg" : "pos"}
                      onValueChange={v => setEditBanco({ ...editBanco, saldo_anterior_negativo: v === "neg" })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pos">+ Crédito</SelectItem>
                        <SelectItem value="neg">− Débito</SelectItem>
                      </SelectContent>
                    </Select>
                    <div>
                      <Input
                        type="number"
                        min={0}
                        value={editBanco.saldo_anterior_horas}
                        onChange={e => setEditBanco({ ...editBanco, saldo_anterior_horas: Math.max(0, parseInt(e.target.value || "0", 10)) })}
                        placeholder="Horas"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">Horas</p>
                    </div>
                    <div>
                      <Input
                        type="number"
                        min={0}
                        max={59}
                        value={editBanco.saldo_anterior_mins}
                        onChange={e => setEditBanco({ ...editBanco, saldo_anterior_mins: Math.min(59, Math.max(0, parseInt(e.target.value || "0", 10))) })}
                        placeholder="Minutos"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">Minutos</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Equivalente a <span className="font-mono">{formatMinutos(saldoAnteriorMin)}</span>.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Prazo de Compensação (dia / mês / ano)</Label>
                  <Input
                    type="date"
                    value={editBanco.prazo_compensacao}
                    onChange={e => setEditBanco({ ...editBanco, prazo_compensacao: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Data limite para compensar o saldo (opcional).</p>
                </div>

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Input
                    value={editBanco.observacoes}
                    onChange={e => setEditBanco({ ...editBanco, observacoes: e.target.value })}
                    placeholder="Ex.: ajuste manual referente a acordo XYZ"
                  />
                </div>

                {/* Lista de dias com ponto na competência */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4" /> Dias com ponto na competência
                  </Label>
                  <div className="rounded-md border max-h-64 overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background">
                        <TableRow>
                          <TableHead className="h-8">Data</TableHead>
                          <TableHead className="h-8">Entrada</TableHead>
                          <TableHead className="h-8">Saída</TableHead>
                          <TableHead className="h-8 text-right">Trabalhado</TableHead>
                          <TableHead className="h-8 text-center">Tipo</TableHead>
                          <TableHead className="h-8 text-right">Valor</TableHead>
                          <TableHead className="h-8 text-right">Saldo</TableHead>
                          <TableHead className="h-8 text-right">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {carregandoDias ? (
                          <TableRow><TableCell colSpan={8} className="text-center py-3 text-xs text-muted-foreground">Carregando dias…</TableCell></TableRow>
                        ) : diasBanco.length === 0 ? (
                          <TableRow><TableCell colSpan={8} className="text-center py-3 text-xs text-muted-foreground">Nenhum ponto registrado nesta competência.</TableCell></TableRow>
                        ) : diasBanco.map(d => {
                          const [y, m, dd] = d.data.split("-");
                          const saldoDia = d.saldo_minutos || 0;
                          const isCredito = saldoDia > 0;
                          const isDebito = saldoDia < 0;
                          const isNeutro = saldoDia === 0;
                          return (
                            <TableRow key={d.id}>
                              <TableCell className="py-1.5 text-xs">{dd}/{m}/{y}</TableCell>
                              <TableCell className="py-1.5 text-xs font-mono">{d.entrada?.slice(0, 5) || "-"}</TableCell>
                              <TableCell className="py-1.5 text-xs font-mono">{d.saida?.slice(0, 5) || "-"}</TableCell>
                              <TableCell className="py-1.5 text-xs font-mono text-right">{formatMinutos(d.horas_trabalhadas_minutos || 0)}</TableCell>
                              <TableCell className="py-1.5 text-center">
                                {isNeutro ? (
                                  <span className="text-xs text-muted-foreground">—</span>
                                ) : isCredito ? (
                                  <span className="text-xs font-semibold uppercase text-green-600">CRÉDITO</span>
                                ) : (
                                  <span className="text-xs font-semibold uppercase text-red-600">DÉBITO</span>
                                )}
                              </TableCell>
                              <TableCell className={`py-1.5 text-xs font-mono text-right ${isCredito ? "text-green-600" : isDebito ? "text-red-600" : "text-muted-foreground"}`}>
                                {isNeutro ? "0h 0min" : `${isCredito ? "+" : "-"}${formatMinutos(Math.abs(saldoDia))}`}
                              </TableCell>
                              <TableCell className={`py-1.5 text-xs font-mono text-right ${saldoDia >= 0 ? "text-green-600" : "text-red-600"}`}>{formatMinutos(saldoDia)}</TableCell>
                              <TableCell className="py-1.5 text-right">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => {
                                    const saldo = d.saldo_minutos || 0;
                                    setSelectedBanco(bancos.find(b => b.id === editBanco.id) || null);
                                    setMovForm({
                                      tipo: saldo >= 0 ? "credito" : "debito",
                                      minutos: Math.abs(saldo) || 0,
                                      data_referencia: d.data,
                                      descricao: `Ajuste referente a ${dd}/${m}/${y}`,
                                    });
                                    setEditBanco(null);
                                    setShowMovimentacao(true);
                                  }}
                                >
                                  <Pencil className="w-3 h-3 mr-1" /> Ajustar dia
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}

                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Clique em "Ajustar dia" para lançar uma movimentação (crédito, débito ou compensação) referente àquele dia específico.
                  </p>
                </div>

                <div className="rounded-md border bg-muted/40 p-3 grid grid-cols-4 gap-3 text-center">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Créditos</p>
                    <p className="font-mono text-sm text-green-600">+{formatMinutos(editBanco.creditos_minutos)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Débitos</p>
                    <p className="font-mono text-sm text-red-600">-{formatMinutos(editBanco.debitos_minutos)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Compensados</p>
                    <p className="font-mono text-sm">{formatMinutos(editBanco.compensados_minutos)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Saldo Atual</p>
                    <p className={`font-mono text-sm font-bold ${saldoAtual >= 0 ? "text-green-600" : "text-red-600"}`}>{formatMinutos(saldoAtual)}</p>
                  </div>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBanco(null)}>Cancelar</Button>
            <Button
              disabled={editandoBancoHoras || !editBanco}
              onClick={async () => {
                if (!editBanco) return;
                const sinal = editBanco.saldo_anterior_negativo ? -1 : 1;
                const saldoAnteriorMin = sinal * (editBanco.saldo_anterior_horas * 60 + editBanco.saldo_anterior_mins);
                await editarBancoHoras({
                  id: editBanco.id,
                  tipo: editBanco.tipo,
                  competencia: editBanco.competencia,
                  saldo_anterior_minutos: saldoAnteriorMin,
                  prazo_compensacao: editBanco.prazo_compensacao || null,
                  observacoes: editBanco.observacoes || null,
                });
                setEditBanco(null);
              }}
            >{editandoBancoHoras ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
