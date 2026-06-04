import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { Loader2, Paperclip, X, CheckCircle2, ChevronLeft, ChevronRight, AlertCircle, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { usePonto } from "@/hooks/usePonto";
import { usePontoJustificativas } from "@/hooks/usePontoJustificativas";
import { ConfigJustificativasModal } from "@/components/ponto/ConfigJustificativasModal";
import type { Colaborador } from "@/hooks/useColaboradores";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  colaboradores: Colaborador[];
  tenantId: string | null | undefined;
  empresaAtivaId?: string | null;
  colaboradorIdInicial?: string;
}

type TipoMarc = "entrada" | "saida_almoco" | "retorno_almoco" | "saida";

const MAX_FILE_MB = 5;
const MAX_ITENS = 60;

const TIPO_LABEL: Record<TipoMarc, string> = {
  entrada: "Entrada",
  saida_almoco: "Saída Almoço",
  retorno_almoco: "Retorno Almoço",
  saida: "Saída",
};

const ORDEM_TIPOS: TipoMarc[] = ["entrada", "saida_almoco", "retorno_almoco", "saida"];

const OUTRO_VALUE = "__outro__";

function fmtHora(h: string) { return (h || "").slice(0, 5); }
function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function isoToBR(iso: string) { const [y,m,d] = iso.split("-"); return `${d}/${m}/${y}`; }
function diaSemana(iso: string) {
  const ds = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  return ds[new Date(iso + "T12:00:00").getDay()];
}
function toMin(s?: string): number | null {
  if (!s || !/^\d{2}:\d{2}/.test(s)) return null;
  return Number(s.slice(0,2)) * 60 + Number(s.slice(3,5));
}
/** Horas trabalhadas (em horas decimais) a partir das 4 marcações. */
function horasTrabalhadasDia(h: Partial<Record<TipoMarc, string>>): number {
  const e = toMin(h.entrada), sa = toMin(h.saida_almoco), ra = toMin(h.retorno_almoco), s = toMin(h.saida);
  let total = 0;
  if (e != null && sa != null && sa > e) total += sa - e;
  if (ra != null && s != null && s > ra) total += s - ra;
  if (total === 0 && e != null && s != null && s > e) total = s - e;
  return Math.max(0, total / 60);
}

interface DiaEdit {
  horarios: Partial<Record<TipoMarc, string>>;
  justificativaId: string;
  outroTexto: string;
  horasAbono: string;     // string para input livre; convertido em number ao enviar
  anexo: File | null;
}

const EMPTY_EDIT: DiaEdit = { horarios: {}, justificativaId: "", outroTexto: "", horasAbono: "", anexo: null };

export function SolicitarAjusteFolhaInterno({
  open, onOpenChange, colaboradores, tenantId, empresaAtivaId, colaboradorIdInicial,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const hojeDate = new Date();
  const { solicitarAjuste } = usePonto();
  const { justificativas, podeGerenciar } = usePontoJustificativas();
  const justAtivas = useMemo(() => justificativas.filter((j) => j.ativo), [justificativas]);

  const [colaboradorId, setColaboradorId] = useState<string>(colaboradorIdInicial || "");
  const [loading, setLoading] = useState(false);
  const [marcsPorDia, setMarcsPorDia] = useState<Record<string, Partial<Record<TipoMarc, string>>>>({});
  const [pendentesPorDia, setPendentesPorDia] = useState<Record<string, number>>({});
  const [mesAtivo, setMesAtivo] = useState(() => `${hojeDate.getFullYear()}-${pad(hojeDate.getMonth()+1)}`);
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
      // Busca mês inteiro do mês ativo (e 30 dias antes para ter contexto)
      const [y, m] = mesAtivo.split("-").map(Number);
      const ini = `${y}-${pad(m)}-01`;
      const last = new Date(y, m, 0).getDate();
      const fim = `${y}-${pad(m)}-${pad(last)}`;

      const [marcRes, ajRes] = await Promise.all([
        fromTable("ponto_marcacoes")
          .select("data_marcacao, hora_marcacao, tipo_marcacao")
          .eq("tenant_id", tenantId)
          .eq("colaborador_id", colaboradorId)
          .gte("data_marcacao", ini)
          .lte("data_marcacao", fim)
          .order("hora_marcacao", { ascending: true }),
        fromTable("ponto_ajustes")
          .select("data_referencia, status")
          .eq("tenant_id", tenantId)
          .eq("colaborador_id", colaboradorId)
          .eq("status", "pendente")
          .gte("data_referencia", ini)
          .lte("data_referencia", fim),
      ]);

      const map: Record<string, Partial<Record<TipoMarc, string>>> = {};
      ((marcRes.data as any[]) || []).forEach((m) => {
        if (!map[m.data_marcacao]) map[m.data_marcacao] = {};
        if (!map[m.data_marcacao][m.tipo_marcacao as TipoMarc]) {
          map[m.data_marcacao][m.tipo_marcacao as TipoMarc] = fmtHora(m.hora_marcacao);
        }
      });
      setMarcsPorDia(map);

      const pend: Record<string, number> = {};
      ((ajRes.data as any[]) || []).forEach((a) => {
        pend[a.data_referencia] = (pend[a.data_referencia] || 0) + 1;
      });
      setPendentesPorDia(pend);

      setLoading(false);
    })();
  }, [open, colaboradorId, tenantId, mesAtivo]);

  // Dias do mês ativo — do dia 01 em diante (ascendente)
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

  const setHorario = (data: string, tipo: TipoMarc, valor: string) => {
    const cur = editDia(data);
    patchDia(data, { horarios: { ...cur.horarios, [tipo]: valor } });
  };

  const resolverMotivo = (ed: DiaEdit): { motivo: string; justId: string | null } => {
    if (ed.justificativaId === OUTRO_VALUE) return { motivo: ed.outroTexto.trim(), justId: null };
    const j = justAtivas.find((x) => x.id === ed.justificativaId);
    if (!j) return { motivo: "", justId: null };
    return { motivo: j.nome, justId: j.id };
  };

  /** Horários efetivos do dia = marcação original mesclada com edição. */
  const horariosEfetivos = (data: string): Partial<Record<TipoMarc, string>> => {
    const orig = marcsPorDia[data] || {};
    const ed = editDia(data);
    return { ...orig, ...ed.horarios };
  };

  // Lista de alterações de horários
  const itensAlterados = useMemo(() => {
    const out: { data: string; tipo: TipoMarc; hora: string; horaOriginal: string }[] = [];
    Object.entries(edits).forEach(([data, ed]) => {
      const original = marcsPorDia[data] || {};
      ORDEM_TIPOS.forEach((t) => {
        const novo = (ed.horarios[t] || "").trim();
        if (!novo) return;
        if (novo === original[t]) return;
        out.push({ data, tipo: t, hora: novo, horaOriginal: original[t] || "" });
      });
    });
    return out;
  }, [edits, marcsPorDia]);

  // Dias com alguma intervenção (horário ou abono > 0)
  const diasComAlteracao = useMemo(() => {
    const set = new Set<string>();
    itensAlterados.forEach((i) => set.add(i.data));
    Object.entries(edits).forEach(([data, ed]) => {
      if ((Number(ed.horasAbono) || 0) > 0) set.add(data);
    });
    return Array.from(set);
  }, [itensAlterados, edits]);

  const totalAlteracoes = diasComAlteracao.length;

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
    if (totalAlteracoes === 0) return "Altere um horário ou informe horas de abono em ao menos um dia.";
    if (itensAlterados.length > MAX_ITENS) return `Máximo de ${MAX_ITENS} ajustes de horário por envio.`;
    const now = new Date();
    for (const data of diasComAlteracao) {
      const ed = editDia(data);
      const { motivo, justId } = resolverMotivo(ed);
      
      // Valida obrigatoriedade de anexo se a justificativa exigir
      const just = justAtivas.find(j => j.id === justId);
      if (just?.requer_anexo && !ed.anexo) {
        return `O anexo é obrigatório para a justificativa "${motivo}" em ${isoToBR(data)}.`;
      }

      if (!motivo || motivo.length < 3) return `Selecione uma justificativa para ${isoToBR(data)}.`;
      const abono = Number(ed.horasAbono) || 0;
      if (abono < 0 || abono > 24) return `Horas de abono inválidas em ${isoToBR(data)} (0 a 24).`;
      if (abono > 0) {
        const horas = horasTrabalhadasDia(horariosEfetivos(data));
        if (abono > horas + 0.001) {
          return `Em ${isoToBR(data)}: o abono (${abono.toFixed(1)}h) é maior que as horas registradas/ajustadas no dia (${horas.toFixed(1)}h). Ajuste os horários do dia ou reduza o abono.`;
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
      for (const data of diasComAlteracao) {
        const ed = editDia(data);
        const { motivo, justId } = resolverMotivo(ed);
        const abono = Number(ed.horasAbono) || 0;
        const itensDia = itensAlterados.filter((i) => i.data === data);
        const anexos = ed.anexo ? [ed.anexo] : undefined;

        if (itensDia.length === 0) {
          // dia só com abono (sem alteração de horário) — registra como justificativa pura
          await solicitarAjuste({
            colaboradorId: colaborador.id,
            colaboradorNome: colaborador.nome_completo,
            colaboradorCpf: (colaborador as any).cpf || "",
            dataReferencia: data,
            tipoAjuste: "justificativa",
            motivo,
            justificativaId: justId || undefined,
            horasAbonadas: abono,
            anexos,
          });
        } else {
          for (let i = 0; i < itensDia.length; i++) {
            const it = itensDia[i];
            await solicitarAjuste({
              colaboradorId: colaborador.id,
              colaboradorNome: colaborador.nome_completo,
              colaboradorCpf: (colaborador as any).cpf || "",
              dataReferencia: it.data,
              tipoAjuste: it.horaOriginal ? "correcao" : "inclusao",
              tipoMarcacao: it.tipo,
              horaOriginal: it.horaOriginal ? `${it.horaOriginal}:00` : undefined,
              horaSolicitada: `${it.hora}:00`,
              motivo,
              justificativaId: justId || undefined,
              // abono e anexo só no primeiro item do dia
              horasAbonadas: i === 0 ? abono : 0,
              anexos: i === 0 ? anexos : undefined,
            });
          }
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
    const novo = `${nd.getFullYear()}-${pad(nd.getMonth()+1)}`;
    if (novo > `${hojeDate.getFullYear()}-${pad(hojeDate.getMonth()+1)}`) return;
    setMesAtivo(novo);
  };

  const mesLabel = useMemo(() => {
    const [y, m] = mesAtivo.split("-").map(Number);
    const nomes = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    return `${nomes[m-1]} ${y}`;
  }, [mesAtivo]);

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
                    A folha mostra todo o mês (a partir do dia 01). Edite horários, informe a justificativa, as horas de abono e — se houver — anexe um comprovante para cada dia.
                  </DialogDescription>
                </div>
                {podeGerenciar && (
                  <Button variant="outline" size="sm" onClick={() => setShowConfigJust(true)} className="shrink-0">
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
                    {colaboradores.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-sm">{c.nome_completo}</SelectItem>
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
                  disabled={mesAtivo >= `${hojeDate.getFullYear()}-${pad(hojeDate.getMonth()+1)}`}
                >
                  Próximo mês <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 border rounded-md min-h-[300px]">
              {!colaboradorId ? (
                <p className="text-center text-sm text-muted-foreground py-12">
                  Selecione um colaborador para visualizar a folha de ponto.
                </p>
              ) : loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0 z-10">
                    <tr className="text-left">
                      <th className="px-2 py-2 font-medium w-[90px]">Dia</th>
                      {ORDEM_TIPOS.map((t) => (
                        <th key={t} className="px-2 py-2 font-medium">{TIPO_LABEL[t]}</th>
                      ))}
                      <th className="px-2 py-2 font-medium w-[200px]">Justificativa</th>
                      <th className="px-2 py-2 font-medium w-[90px]">Abono (h)</th>
                      <th className="px-2 py-2 font-medium w-[150px]">Anexo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diasMes.map((data) => {
                      const original = marcsPorDia[data] || {};
                      const pendentes = pendentesPorDia[data] || 0;
                      const ed = editDia(data);
                      const temAlteracaoHora = ORDEM_TIPOS.some((t) => {
                        const v = ed.horarios[t];
                        return v !== undefined && v !== original[t];
                      });
                      const temAbono = (Number(ed.horasAbono) || 0) > 0;
                      const ativo = temAlteracaoHora || temAbono;
                      const isWeekend = [0,6].includes(new Date(data + "T12:00:00").getDay());
                      const futuro = data > today;
                      const horasEfetiv = horasTrabalhadasDia(horariosEfetivos(data));
                      return (
                        <tr
                          key={data}
                          className={`border-t ${ativo ? "bg-primary/5" : isWeekend ? "bg-muted/20" : ""} ${futuro ? "opacity-50" : ""}`}
                        >
                          <td className="px-2 py-1.5 align-top">
                            <div className="font-mono font-semibold">{isoToBR(data).slice(0,5)}</div>
                            <div className="text-[10px] text-muted-foreground">{diaSemana(data)}</div>
                            {pendentes > 0 && (
                              <Badge variant="outline" className="text-[9px] mt-1 border-amber-500 text-amber-700 dark:text-amber-400">
                                {pendentes} pend.
                              </Badge>
                            )}
                          </td>
                          {ORDEM_TIPOS.map((t) => {
                            const orig = original[t] || "";
                            const valor = ed.horarios[t] ?? orig;
                            const alterado = (ed.horarios[t] !== undefined) && ed.horarios[t] !== orig;
                            const incluido = alterado && !orig;
                            return (
                              <td key={t} className="px-2 py-1.5 align-top">
                                <Input
                                  type="time"
                                  value={valor}
                                  disabled={futuro}
                                  onChange={(e) => setHorario(data, t, e.target.value)}
                                  className={`h-8 text-xs font-mono ${
                                    incluido ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                                    : alterado ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30"
                                    : orig ? "border-sky-300 bg-sky-50/40 dark:bg-sky-950/20"
                                    : ""
                                  }`}
                                />
                                {orig && alterado && (
                                  <div className="text-[9px] text-muted-foreground mt-0.5 line-through">orig: {orig}</div>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-2 py-1.5 align-top">
                            {ativo ? (
                              <div className="space-y-1">
                                <Select value={ed.justificativaId} onValueChange={(v) => patchDia(data, { justificativaId: v })}>
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Selecione…" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {justAtivas.length === 0 && (
                                      <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
                                        Nenhuma justificativa cadastrada. Peça ao RH para configurar.
                                      </div>
                                    )}
                                    {justAtivas.map((j) => (
                                      <SelectItem key={j.id} value={j.id} className="text-xs">
                                        {j.nome}
                                      </SelectItem>
                                    ))}
                                    <SelectItem value={OUTRO_VALUE} className="text-xs">Outro (descrever)</SelectItem>
                                  </SelectContent>
                                </Select>
                                {ed.justificativaId === OUTRO_VALUE && (
                                  <Input
                                    value={ed.outroTexto}
                                    onChange={(e) => patchDia(data, { outroTexto: e.target.value })}
                                    placeholder="Descreva o motivo"
                                    className="h-8 text-xs"
                                    maxLength={300}
                                  />
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-muted-foreground italic">— altere horário ou informe abono</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 align-top">
                            <Input
                              type="number"
                              step="0.5" min="0" max="24"
                              disabled={futuro}
                              value={ed.horasAbono}
                              onChange={(e) => patchDia(data, { horasAbono: e.target.value })}
                              placeholder="0"
                              className="h-8 text-xs font-mono"
                            />
                            {ativo && (Number(ed.horasAbono) || 0) > 0 && (
                              <div className={`text-[9px] mt-0.5 ${
                                (Number(ed.horasAbono) || 0) > horasEfetiv + 0.001
                                  ? "text-destructive"
                                  : "text-muted-foreground"
                              }`}>
                                dia: {horasEfetiv.toFixed(1)}h
                              </div>
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
                              <label className={`flex items-center gap-1 text-[10px] cursor-pointer text-muted-foreground hover:text-foreground ${futuro ? "pointer-events-none opacity-50" : ""}`}>
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
            </ScrollArea>

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
