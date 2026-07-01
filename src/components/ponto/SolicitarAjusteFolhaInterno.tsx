import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { Loader2, Paperclip, X, CheckCircle2, ChevronLeft, ChevronRight, AlertCircle, Settings2, Plus } from "lucide-react";
import { toast } from "sonner";
import { usePonto } from "@/hooks/usePonto";
import { usePontoJustificativas } from "@/hooks/usePontoJustificativas";
import { ConfigJustificativasModal } from "@/components/ponto/ConfigJustificativasModal";
import type { Colaborador } from "@/hooks/useColaboradores";
import { cleanCpf, formatCpf } from "@/lib/cpf";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  colaboradores: Colaborador[];
  tenantId: string | null | undefined;
  empresaAtivaId?: string | null;
  colaboradorIdInicial?: string;
}

// Modelo de alternância livre entrada↔saída (igual ao banco): a posição na
// sequência cronológica define o tipo. Índice par = ENTRADA, ímpar = SAÍDA.
type TipoMarc = "entrada" | "saida";

const MAX_FILE_MB = 5;
const MAX_ITENS = 60;
/** Limite de marcações por dia no formulário (8 pares entrada/saída). */
const MAX_MARCS_DIA = 16;

/** Chave da justificativa de "Dia Inteiro" dentro do mapa por horário. */
const DIA_KEY = "__dia__";

function tipoPorIndice(i: number): TipoMarc {
  return i % 2 === 0 ? "entrada" : "saida";
}
function tipoLabel(i: number): string {
  return tipoPorIndice(i) === "entrada" ? "Entrada" : "Saída";
}

function fmtHora(h: string) { return (h || "").slice(0, 5); }
function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function isoToBR(iso: string) { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; }
function diaSemana(iso: string) {
  const ds = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return ds[new Date(iso + "T12:00:00").getDay()];
}
function toMin(s?: string): number | null {
  if (!s || !/^\d{2}:\d{2}/.test(s)) return null;
  return Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
}

/** Justificativa + observação de um período (ou do dia inteiro). */
interface PeriodoJust {
  justificativaId: string;
  observacao: string;
  abonarSeAprovado: boolean; // usado só quando a justificativa é "configuravel"
}
const EMPTY_PJ: PeriodoJust = { justificativaId: "", observacao: "", abonarSeAprovado: false };

interface DiaEdit {
  // undefined = não editado (usa as marcações originais).
  marcacoes?: string[];
  diaInteiro: boolean;
  // Justificativa por horário "HH:MM" (ou DIA_KEY para o dia inteiro).
  just: Record<string, PeriodoJust>;
  anexo: File | null;
}

const EMPTY_EDIT: DiaEdit = { diaInteiro: false, just: {}, anexo: null };

export function SolicitarAjusteFolhaInterno({
  open, onOpenChange, colaboradores, tenantId, empresaAtivaId, colaboradorIdInicial,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const hojeDate = new Date();
  const { solicitarAjuste } = usePonto();
  const { justificativas, podeGerenciar } = usePontoJustificativas();
  const justAtivas = useMemo(() => justificativas.filter((j) => j.ativo), [justificativas]);
  const justById = useMemo(() => {
    const m: Record<string, typeof justAtivas[number]> = {};
    justAtivas.forEach((j) => { m[j.id] = j; });
    return m;
  }, [justAtivas]);

  const [colaboradorId, setColaboradorId] = useState<string>(colaboradorIdInicial || "");
  const [loading, setLoading] = useState(false);
  const [marcsPorDia, setMarcsPorDia] = useState<Record<string, string[]>>({});
  const [marcsRawPorDia, setMarcsRawPorDia] = useState<Record<string, string[]>>({});
  const [pendentesPorDia, setPendentesPorDia] = useState<Record<string, number>>({});
  const [mesAtivo, setMesAtivo] = useState(() => `${hojeDate.getFullYear()}-${pad(hojeDate.getMonth() + 1)}`);
  const [edits, setEdits] = useState<Record<string, DiaEdit>>({});
  const [enviando, setEnviando] = useState(false);
  const [done, setDone] = useState(false);
  const [showConfigJust, setShowConfigJust] = useState(false);

  const colaborador = useMemo(
    () => colaboradores.find((c) => c.id === colaboradorId) || null,
    [colaboradores, colaboradorId]
  );

  const reset = () => { setEdits({}); setDone(false); };

  useEffect(() => {
    if (!open || !colaboradorId || !tenantId) return;
    (async () => {
      setLoading(true);
      const [y, m] = mesAtivo.split("-").map(Number);
      const ini = `${y}-${pad(m)}-01`;
      const last = new Date(y, m, 0).getDate();
      const fim = `${y}-${pad(m)}-${pad(last)}`;

      const cpfDigits = cleanCpf(colaborador?.cpf || "");
      const cpfVars = cpfDigits.length === 11
        ? Array.from(new Set([colaborador?.cpf || "", cpfDigits, formatCpf(cpfDigits)].filter(Boolean)))
        : null;

      const marcQuery = fromTable("ponto_marcacoes")
        .select("data_marcacao, hora_marcacao, tipo_marcacao")
        .eq("tenant_id", tenantId)
        .gte("data_marcacao", ini)
        .lte("data_marcacao", fim);
      const ajQuery = fromTable("ponto_ajustes")
        .select("data_referencia, status")
        .eq("tenant_id", tenantId)
        .eq("status", "pendente")
        .gte("data_referencia", ini)
        .lte("data_referencia", fim);

      const [marcRes, ajRes] = await Promise.all([
        (cpfVars
          ? marcQuery.in("colaborador_cpf", cpfVars)
          : marcQuery.eq("colaborador_id", colaboradorId)
        ).order("hora_marcacao", { ascending: true }),
        cpfVars
          ? ajQuery.in("colaborador_cpf", cpfVars)
          : ajQuery.eq("colaborador_id", colaboradorId),
      ]);

      const map: Record<string, string[]> = {};
      const rawMap: Record<string, string[]> = {};
      const porDia: Record<string, { hora: string }[]> = {};
      ((marcRes.data as any[]) || []).forEach((mk) => {
        (porDia[mk.data_marcacao] ||= []).push({ hora: mk.hora_marcacao });
      });
      Object.entries(porDia).forEach(([data, marcas]) => {
        marcas.sort((a, b) => String(a.hora).localeCompare(String(b.hora)));
        map[data] = marcas.map((mk) => fmtHora(mk.hora));
        rawMap[data] = marcas.map((mk) => mk.hora);
      });
      setMarcsPorDia(map);
      setMarcsRawPorDia(rawMap);

      const pend: Record<string, number> = {};
      ((ajRes.data as any[]) || []).forEach((a) => {
        pend[a.data_referencia] = (pend[a.data_referencia] || 0) + 1;
      });
      setPendentesPorDia(pend);

      setLoading(false);
    })();
  }, [open, colaboradorId, tenantId, mesAtivo, colaborador]);

  const diasMes = useMemo(() => {
    const [y, m] = mesAtivo.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    const arr: string[] = [];
    for (let d = 1; d <= last; d++) arr.push(`${y}-${pad(m)}-${pad(d)}`);
    return arr;
  }, [mesAtivo]);

  const editDia = (data: string): DiaEdit => edits[data] || EMPTY_EDIT;

  const patchDia = (data: string, patch: Partial<DiaEdit>) => {
    setEdits((prev) => ({ ...prev, [data]: { ...editDia(data), ...patch } }));
  };

  const getPJ = (data: string, key: string): PeriodoJust => editDia(data).just[key] || EMPTY_PJ;
  const setPJ = (data: string, key: string, patch: Partial<PeriodoJust>) => {
    const ed = editDia(data);
    patchDia(data, { just: { ...ed.just, [key]: { ...getPJ(data, key), ...patch } } });
  };

  const marcacoesEfetivas = (data: string): string[] => {
    const ed = editDia(data);
    if (ed.marcacoes !== undefined) return ed.marcacoes;
    return marcsPorDia[data] || [];
  };

  const ensureEdicao = (data: string): string[] => {
    const ed = editDia(data);
    if (ed.marcacoes !== undefined) return [...ed.marcacoes];
    return [...(marcsPorDia[data] || [])];
  };

  const setMarcacao = (data: string, idx: number, valor: string) => {
    const ed = editDia(data);
    const lista = ed.marcacoes !== undefined ? [...ed.marcacoes] : [...(marcsPorDia[data] || [])];
    const antigo = (lista[idx] || "").trim();
    lista[idx] = valor;
    // Migra a justificativa do horário antigo para o novo (a chave é a hora).
    let just = ed.just;
    if (antigo && antigo !== valor && just[antigo]) {
      just = { ...just };
      just[valor] = just[antigo];
      delete just[antigo];
    }
    patchDia(data, { marcacoes: lista, just });
  };

  const addMarcacao = (data: string) => {
    const lista = ensureEdicao(data);
    if (lista.length >= MAX_MARCS_DIA) {
      toast.error(`Máximo de ${MAX_MARCS_DIA} marcações por dia.`);
      return;
    }
    lista.push("");
    patchDia(data, { marcacoes: lista });
  };

  const removeMarcacao = (data: string, idx: number) => {
    const original = marcsPorDia[data] || [];
    if (idx < original.length) {
      toast.error("Não é possível excluir uma marcação já registrada. Para anular um horário, ajuste-o ou registre uma justificativa.");
      return;
    }
    const lista = ensureEdicao(data);
    lista.splice(idx, 1);
    patchDia(data, { marcacoes: lista });
  };

  const toggleDiaInteiro = (data: string, v: boolean) => {
    patchDia(data, { diaInteiro: v });
  };

  // Diferença POR HORÁRIO (mantém marcações existentes; novo = inclusão;
  // troca de horário = correção). Dias com "Dia Inteiro" não geram itens.
  const itensAlterados = useMemo(() => {
    const out: { data: string; tipo: TipoMarc; hora: string; horaOriginal: string }[] = [];
    Object.entries(edits).forEach(([data, ed]) => {
      if (ed.diaInteiro) return;
      if (ed.marcacoes === undefined) return;
      const original = marcsPorDia[data] || [];
      const raw = marcsRawPorDia[data] || [];
      const rawByHora: Record<string, string> = {};
      original.forEach((o, i) => { if (!(o in rawByHora)) rawByHora[o] = raw[i] || o; });

      const novas = ed.marcacoes.map((s) => (s || "").trim()).filter(Boolean);
      const origSet = new Set(original);
      const novasSet = new Set(novas);
      const ordenadas = [...novas].sort((a, b) => (toMin(a) ?? 0) - (toMin(b) ?? 0));
      const tipoDe = (hora: string): TipoMarc => tipoPorIndice(ordenadas.indexOf(hora));

      const removidos = original.filter((o) => !novasSet.has(o));
      const adicionados = novas.filter((n) => !origSet.has(n));
      let r = 0;
      for (const hora of adicionados) {
        if (r < removidos.length) {
          out.push({ data, tipo: tipoDe(hora), hora, horaOriginal: rawByHora[removidos[r]] || removidos[r] });
          r++;
        } else {
          out.push({ data, tipo: tipoDe(hora), hora, horaOriginal: "" });
        }
      }
    });
    return out;
  }, [edits, marcsPorDia, marcsRawPorDia]);

  const diasComAlteracao = useMemo(() => {
    const set = new Set<string>();
    itensAlterados.forEach((i) => set.add(i.data));
    Object.entries(edits).forEach(([data, ed]) => {
      if (ed.diaInteiro) set.add(data);
    });
    return Array.from(set).filter((data) => (pendentesPorDia[data] ?? 0) === 0);
  }, [itensAlterados, edits, pendentesPorDia]);

  const totalAlteracoes = diasComAlteracao.length;

  const diaBloqueado = (data: string): boolean => (pendentesPorDia[data] ?? 0) > 0;

  const handleAnexoDia = (data: string, file: File | null) => {
    if (!file) { patchDia(data, { anexo: null }); return; }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`${file.name}: ultrapassa ${MAX_FILE_MB}MB.`);
      return;
    }
    patchDia(data, { anexo: file });
  };

  const validar = (): string | null => {
    if (!colaborador) return "Selecione o colaborador.";
    if (totalAlteracoes === 0) return "Altere um horário ou marque \"Dia Inteiro\" em ao menos um dia.";
    if (itensAlterados.length > MAX_ITENS) return `Máximo de ${MAX_ITENS} ajustes de horário por envio.`;
    const now = new Date();
    for (const data of diasComAlteracao) {
      const ed = editDia(data);

      if (ed.diaInteiro) {
        const pj = getPJ(data, DIA_KEY);
        const just = justById[pj.justificativaId];
        if (!just) return `Selecione uma justificativa para o Dia Inteiro em ${isoToBR(data)}.`;
        if (just.requer_anexo && !ed.anexo) return `O anexo é obrigatório para a justificativa "${just.nome}" em ${isoToBR(data)}.`;
        continue;
      }

      const itensDia = itensAlterados.filter((i) => i.data === data);
      for (const it of itensDia) {
        const pj = getPJ(data, it.hora);
        const just = justById[pj.justificativaId];
        if (!just) return `Selecione a justificativa do horário ${it.hora} em ${isoToBR(data)}.`;
        if (just.requer_anexo && !ed.anexo) return `O anexo é obrigatório para a justificativa "${just.nome}" em ${isoToBR(data)}.`;
      }

      // Bloqueia duas marcações no mesmo horário.
      const mins = marcacoesEfetivas(data)
        .map((m) => (m || "").trim())
        .filter(Boolean)
        .map((h) => toMin(h))
        .filter((m): m is number => m !== null)
        .sort((a, b) => a - b);
      for (let i = 1; i < mins.length; i++) {
        if (mins[i] === mins[i - 1]) {
          return `Em ${isoToBR(data)}, há duas marcações no mesmo horário. Remova a duplicada.`;
        }
      }
    }
    for (const it of itensAlterados) {
      if (it.data > today) return "Não é permitido ajustar data futura.";
      if (it.data === today) {
        const [hh, mm] = it.hora.split(":").map(Number);
        if (hh > now.getHours() || (hh === now.getHours() && mm > now.getMinutes())) {
          return "Não é permitido ajustar horário futuro.";
        }
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    const erro = validar();
    if (erro) { toast.error(erro); return; }
    if (!colaborador) return;
    setEnviando(true);
    try {
      const cpf = (colaborador as any).cpf || "";
      for (const data of diasComAlteracao) {
        const ed = editDia(data);
        const anexos = ed.anexo ? [ed.anexo] : undefined;

        if (ed.diaInteiro) {
          const pj = getPJ(data, DIA_KEY);
          const just = justById[pj.justificativaId];
          await solicitarAjuste({
            colaboradorId: colaborador.id,
            colaboradorNome: colaborador.nome_completo,
            colaboradorCpf: cpf,
            dataReferencia: data,
            tipoAjuste: "justificativa",
            motivo: just?.nome || "",
            justificativaId: pj.justificativaId,
            observacao: pj.observacao || undefined,
            abonarSeAprovado: just?.tipo_abono === "configuravel" ? pj.abonarSeAprovado : undefined,
            diaInteiro: true,
            anexos,
          });
          continue;
        }

        const itensDia = itensAlterados.filter((i) => i.data === data);
        for (let i = 0; i < itensDia.length; i++) {
          const it = itensDia[i];
          const pj = getPJ(data, it.hora);
          const just = justById[pj.justificativaId];
          // O anexo do dia acompanha o 1º item E qualquer período cuja
          // justificativa exija anexo — senão um período que exige comprovante
          // (mas não é o 1º) ficaria sem anexo, apesar da validação passar.
          const anexarNesteItem = i === 0 || !!just?.requer_anexo;
          await solicitarAjuste({
            colaboradorId: colaborador.id,
            colaboradorNome: colaborador.nome_completo,
            colaboradorCpf: cpf,
            dataReferencia: it.data,
            tipoAjuste: it.horaOriginal ? "correcao" : "inclusao",
            tipoMarcacao: it.tipo,
            horaOriginal: it.horaOriginal
              ? (it.horaOriginal.length >= 8 ? it.horaOriginal : `${it.horaOriginal}:00`)
              : undefined,
            horaSolicitada: `${it.hora}:00`,
            motivo: just?.nome || "",
            justificativaId: pj.justificativaId,
            observacao: pj.observacao || undefined,
            abonarSeAprovado: just?.tipo_abono === "configuravel" ? pj.abonarSeAprovado : undefined,
            anexos: anexarNesteItem ? anexos : undefined,
          });
        }
      }
      setDone(true);
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar solicitação.");
    }
    setEnviando(false);
  };

  const navegarMes = (delta: number) => {
    const [y, m] = mesAtivo.split("-").map(Number);
    const nd = new Date(y, m - 1 + delta, 1);
    const novo = `${nd.getFullYear()}-${pad(nd.getMonth() + 1)}`;
    if (novo > `${hojeDate.getFullYear()}-${pad(hojeDate.getMonth() + 1)}`) return;
    setMesAtivo(novo);
  };

  const mesLabel = useMemo(() => {
    const [y, m] = mesAtivo.split("-").map(Number);
    const nomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    return `${nomes[m - 1]} ${y}`;
  }, [mesAtivo]);

  // Bloco de justificativa (select + observação + "abonar se aprovado").
  const renderJustBlock = (data: string, key: string, label: string) => {
    const pj = getPJ(data, key);
    const just = justById[pj.justificativaId];
    return (
      <div className="space-y-1 rounded-md border border-border/60 p-1.5">
        <div className="text-[9px] font-semibold text-muted-foreground">{label}</div>
        <Select value={pj.justificativaId} onValueChange={(v) => setPJ(data, key, { justificativaId: v })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Justificativa…" /></SelectTrigger>
          <SelectContent>
            {justAtivas.length === 0 && (
              <SelectItem value="__none__" disabled className="text-xs">Nenhuma justificativa cadastrada</SelectItem>
            )}
            {justAtivas.map((j) => (
              <SelectItem key={j.id} value={j.id} className="text-xs">{j.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={pj.observacao}
          onChange={(e) => setPJ(data, key, { observacao: e.target.value })}
          placeholder="Observação (opcional)"
          className="h-8 text-xs"
          maxLength={300}
        />
        {just?.tipo_abono === "configuravel" && (
          <label className="flex items-center gap-1.5 text-[10px] cursor-pointer pt-0.5">
            <Checkbox
              checked={pj.abonarSeAprovado}
              onCheckedChange={(c) => setPJ(data, key, { abonarSeAprovado: c === true })}
            />
            <span>Abonar se aprovado</span>
          </label>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-6xl max-h-[92vh] flex flex-col">
        {done ? (
          <div className="text-center space-y-3 py-6">
            <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
            <DialogTitle>Solicitação enviada!</DialogTitle>
            <DialogDescription>
              {totalAlteracoes === 1
                ? "Seu ajuste foi registrado e ficará pendente para aprovação do gestor."
                : `Seus ajustes de ${totalAlteracoes} dias foram registrados e ficarão pendentes para aprovação do gestor.`}
            </DialogDescription>
            <Button onClick={() => { onOpenChange(false); reset(); }} className="w-full">Fechar</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <DialogTitle>Folha de Ponto · Ajustes</DialogTitle>
                  <DialogDescription>
                    A folha mostra o mês todo. Edite horários e informe a justificativa de cada período (o abono é aplicado automaticamente pela justificativa na aprovação). Use "Dia Inteiro" para lançar o dia pela escala.
                  </DialogDescription>
                </div>
                {podeGerenciar && (
                  <Button
                    size="sm"
                    onClick={() => setShowConfigJust(true)}
                    className="shrink-0 bg-amber-500 text-white hover:bg-amber-600 border border-amber-600 font-semibold shadow-sm"
                  >
                    <Settings2 className="w-4 h-4 mr-1" /> Justificativas
                  </Button>
                )}
              </div>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Colaborador</Label>
                <Select value={colaboradorId} onValueChange={setColaboradorId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selecione o colaborador" />
                  </SelectTrigger>
                  <SelectContent>
                    {colaboradores
                      .sort((a, b) => a.nome_completo.localeCompare(b.nome_completo))
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-sm">
                          {c.nome_completo}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end justify-between bg-muted/30 rounded-md px-3 py-1.5">
                <Button variant="ghost" size="sm" onClick={() => navegarMes(-1)} className="h-8">
                  <ChevronLeft className="w-4 h-4 mr-1" /> Mês anterior
                </Button>
                <span className="text-sm font-semibold capitalize">{mesLabel}</span>
                <Button
                  variant="ghost" size="sm" onClick={() => navegarMes(1)} className="h-8"
                  disabled={mesAtivo >= `${hojeDate.getFullYear()}-${pad(hojeDate.getMonth() + 1)}`}
                >
                  Próximo mês <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>

            <div className="flex-1 w-full min-w-0 border rounded-md min-h-[300px] overflow-x-auto overflow-y-auto max-h-[60vh] [-webkit-overflow-scrolling:touch] scrollbar-thin">
              {!colaboradorId ? (
                <p className="text-center text-sm text-muted-foreground py-12">
                  Selecione um colaborador para visualizar a folha de ponto.
                </p>
              ) : loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <table className="w-full text-xs min-w-[820px] table-fixed">
                  <thead className="bg-muted/50 sticky top-0 z-10">
                    <tr className="text-left">
                      <th className="px-2 py-2 font-medium w-[120px]">Dia</th>
                      <th className="px-2 py-2 font-medium w-[240px]">Marcações (Entrada / Saída)</th>
                      <th className="px-2 py-2 font-medium w-[280px]">Justificativa por período</th>
                      <th className="px-2 py-2 font-medium w-[140px]">Anexo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diasMes.map((data) => {
                      const original = marcsPorDia[data] || [];
                      const pendentes = pendentesPorDia[data] || 0;
                      const ed = editDia(data);
                      const marcs = marcacoesEfetivas(data);
                      const temAlteracaoHora = ed.marcacoes !== undefined && (
                        ed.marcacoes.length !== original.length ||
                        ed.marcacoes.some((v, i) => (v || "") !== (original[i] || ""))
                      );
                      const ativo = ed.diaInteiro || temAlteracaoHora;
                      const isWeekend = [0, 6].includes(new Date(data + "T12:00:00").getDay());
                      const futuro = data > today;
                      const itensDia = itensAlterados.filter((i) => i.data === data);
                      return (
                        <tr
                          key={data}
                          className={`border-t ${ativo ? "bg-primary/5" : isWeekend ? "bg-muted/20" : ""} ${futuro ? "opacity-50" : ""}`}
                        >
                          <td className="px-2 py-1.5 align-top">
                            <div className="font-mono font-semibold">{isoToBR(data).slice(0, 5)}</div>
                            <div className="text-[10px] text-muted-foreground">{diaSemana(data)}</div>
                            {pendentes > 0 && (
                              <Badge variant="outline" className="text-[9px] mt-1 border-amber-500 text-amber-700 dark:text-amber-400">
                                {pendentes} pend.
                              </Badge>
                            )}
                            {!diaBloqueado(data) && !futuro && (
                              <label className="flex items-center gap-1 mt-1.5 text-[10px] cursor-pointer">
                                <Checkbox
                                  checked={ed.diaInteiro}
                                  onCheckedChange={(c) => toggleDiaInteiro(data, c === true)}
                                />
                                <span>Dia inteiro</span>
                              </label>
                            )}
                          </td>
                          <td className="px-2 py-1.5 align-top">
                            {diaBloqueado(data) ? (
                              <div className="flex items-start gap-2 py-1">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                                <div>
                                  <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">Ajuste ainda pendente — aguarde a aprovação.</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {pendentes} marcação(ões) deste dia aguardam o gestor. Não é possível alterar até aprovar/rejeitar.
                                  </p>
                                </div>
                              </div>
                            ) : ed.diaInteiro ? (
                              <div className="text-[10px] text-muted-foreground italic py-1">
                                Dia inteiro pela escala do colaborador (horários não editáveis).
                              </div>
                            ) : (
                              <div className="space-y-1">
                                {marcs.length === 0 && (
                                  <div className="text-[10px] text-muted-foreground italic">Sem marcações</div>
                                )}
                                {marcs.map((valor, i) => {
                                  const orig = original[i] || "";
                                  const novaMarc = i >= original.length;
                                  const alterado = ed.marcacoes !== undefined && (valor || "") !== orig && !novaMarc;
                                  const tipo = tipoPorIndice(i);
                                  return (
                                    <div key={i} className="flex items-center gap-1">
                                      <span className={`text-[9px] font-semibold w-12 shrink-0 ${tipo === "entrada" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                        {tipoLabel(i)}
                                      </span>
                                      <Input
                                        type="time"
                                        value={valor || ""}
                                        disabled={futuro}
                                        onChange={(e) => setMarcacao(data, i, e.target.value)}
                                        className={`h-7 text-xs font-mono ${
                                          novaMarc ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                                            : alterado ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30"
                                              : orig ? "border-sky-300 bg-sky-50/40 dark:bg-sky-950/20"
                                                : ""
                                        }`}
                                      />
                                      {novaMarc && !futuro && (
                                        <button
                                          type="button"
                                          onClick={() => removeMarcacao(data, i)}
                                          className="text-destructive shrink-0"
                                          title="Remover marcação adicionada"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      )}
                                      {orig && alterado && (
                                        <span className="text-[9px] text-muted-foreground line-through ml-0.5">{orig}</span>
                                      )}
                                    </div>
                                  );
                                })}
                                {!futuro && marcs.length < MAX_MARCS_DIA && (
                                  <button
                                    type="button"
                                    onClick={() => addMarcacao(data)}
                                    className="flex items-center gap-1 text-[10px] text-primary hover:underline mt-0.5"
                                  >
                                    <Plus className="w-3 h-3" /> Adicionar {marcs.length % 2 === 0 ? "entrada" : "saída"}
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-1.5 align-top">
                            {diaBloqueado(data) ? (
                              <span className="text-[10px] text-muted-foreground italic">—</span>
                            ) : ed.diaInteiro ? (
                              renderJustBlock(data, DIA_KEY, "Dia inteiro")
                            ) : itensDia.length > 0 ? (
                              <div className="space-y-1.5">
                                {itensDia.map((it) => renderJustBlock(data, it.hora, `${it.tipo === "entrada" ? "Entrada" : "Saída"} ${it.hora}`))}
                              </div>
                            ) : (
                              <span className="text-[10px] text-muted-foreground italic">— altere um horário ou marque "Dia inteiro"</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 align-top">
                            {ed.anexo ? (
                              <div className="flex items-center justify-between gap-1 text-[10px] bg-muted/60 rounded px-1.5 py-1">
                                <span className="truncate max-w-[100px]" title={ed.anexo.name}>{ed.anexo.name}</span>
                                <button type="button" onClick={() => handleAnexoDia(data, null)} className="text-destructive shrink-0">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <label className={`flex items-center gap-1 text-[10px] cursor-pointer text-muted-foreground hover:text-foreground ${futuro || diaBloqueado(data) ? "pointer-events-none opacity-50" : ""}`}>
                                <Paperclip className="w-3 h-3" />
                                <span>Anexar</span>
                                <input
                                  type="file" className="hidden"
                                  accept="image/*,application/pdf"
                                  onChange={(e) => handleAnexoDia(data, e.target.files?.[0] || null)}
                                />
                              </label>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="space-y-3 pt-3 border-t">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-sky-50 dark:bg-sky-950/20 border border-sky-300 inline-block" /> registrado</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-500 inline-block" /> alterado</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500 inline-block" /> incluído</span>
                </div>
                {totalAlteracoes > 0 ? (
                  <Badge variant="secondary" className="text-xs">
                    {totalAlteracoes} dia{totalAlteracoes !== 1 ? "s" : ""} com ajuste
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Nenhum ajuste ainda</span>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button className="flex-1" onClick={handleSubmit} disabled={enviando || totalAlteracoes === 0 || !colaboradorId}>
                  {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : `Enviar Ajustes${totalAlteracoes ? ` (${totalAlteracoes} dia${totalAlteracoes !== 1 ? "s" : ""})` : ""}`}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
      <ConfigJustificativasModal open={showConfigJust} onOpenChange={setShowConfigJust} />
    </Dialog>
  );
}
