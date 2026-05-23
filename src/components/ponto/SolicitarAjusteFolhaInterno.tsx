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
const MAX_FILES = 3;
const MAX_ITENS = 40;

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

interface DiaEdit {
  horarios: Partial<Record<TipoMarc, string>>;
  justificativaPreset: string;
  justificativaOutro: string;
}

export function SolicitarAjusteFolhaInterno({
  open, onOpenChange, colaboradores, tenantId, empresaAtivaId, colaboradorIdInicial,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const hojeDate = new Date();
  const { solicitarAjuste } = usePonto();

  const [colaboradorId, setColaboradorId] = useState<string>(colaboradorIdInicial || "");
  const [loading, setLoading] = useState(false);
  const [marcsPorDia, setMarcsPorDia] = useState<Record<string, Partial<Record<TipoMarc, string>>>>({});
  const [pendentesPorDia, setPendentesPorDia] = useState<Record<string, number>>({});
  const [mesAtivo, setMesAtivo] = useState(() => `${hojeDate.getFullYear()}-${pad(hojeDate.getMonth()+1)}`);
  const [edits, setEdits] = useState<Record<string, DiaEdit>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [done, setDone] = useState(false);

  const colaborador = useMemo(
    () => colaboradores.find((c) => c.id === colaboradorId) || null,
    [colaboradores, colaboradorId]
  );

  const reset = () => { setEdits({}); setFiles([]); setDone(false); };

  // Carrega marcações + ajustes pendentes do colaborador (últimos 60 dias)
  useEffect(() => {
    if (!open || !colaboradorId || !tenantId) return;
    (async () => {
      setLoading(true);
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - 60);
      const dataIniIso = dataInicio.toISOString().slice(0, 10);

      const [marcRes, ajRes] = await Promise.all([
        fromTable("ponto_marcacoes")
          .select("data_marcacao, hora_marcacao, tipo_marcacao")
          .eq("tenant_id", tenantId)
          .eq("colaborador_id", colaboradorId)
          .gte("data_marcacao", dataIniIso)
          .order("hora_marcacao", { ascending: true }),
        fromTable("ponto_ajustes")
          .select("data_referencia, status")
          .eq("tenant_id", tenantId)
          .eq("colaborador_id", colaboradorId)
          .eq("status", "pendente")
          .gte("data_referencia", dataIniIso),
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
  }, [open, colaboradorId, tenantId]);

  const diasMes = useMemo(() => {
    const [y, m] = mesAtivo.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    const arr: string[] = [];
    for (let d = 1; d <= last; d++) {
      const iso = `${y}-${pad(m)}-${pad(d)}`;
      if (iso <= today) arr.push(iso);
    }
    return arr.reverse();
  }, [mesAtivo, today]);

  const editDia = (data: string): DiaEdit =>
    edits[data] || { horarios: {}, justificativaPreset: "", justificativaOutro: "" };

  const setHorario = (data: string, tipo: TipoMarc, valor: string) => {
    setEdits((prev) => {
      const cur = editDia(data);
      return { ...prev, [data]: { ...cur, horarios: { ...cur.horarios, [tipo]: valor } } };
    });
  };
  const setJustificativaPreset = (data: string, v: string) => {
    setEdits((prev) => ({ ...prev, [data]: { ...editDia(data), justificativaPreset: v } }));
  };
  const setJustificativaOutro = (data: string, v: string) => {
    setEdits((prev) => ({ ...prev, [data]: { ...editDia(data), justificativaOutro: v } }));
  };

  const itensAlterados = useMemo(() => {
    const out: { data: string; tipo: TipoMarc; hora: string; horaOriginal: string; motivo: string }[] = [];
    Object.entries(edits).forEach(([data, ed]) => {
      const original = marcsPorDia[data] || {};
      const motivoFinal =
        ed.justificativaPreset === "Outro (descrever)"
          ? ed.justificativaOutro.trim()
          : ed.justificativaPreset.trim();
      ORDEM_TIPOS.forEach((t) => {
        const novo = (ed.horarios[t] || "").trim();
        if (!novo) return;
        if (novo === original[t]) return;
        out.push({ data, tipo: t, hora: novo, horaOriginal: original[t] || "", motivo: motivoFinal });
      });
    });
    return out;
  }, [edits, marcsPorDia]);

  const totalAlteracoes = itensAlterados.length;

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    const validos: File[] = [];
    for (const f of Array.from(list)) {
      if (f.size > MAX_FILE_MB * 1024 * 1024) { toast.error(`${f.name}: ultrapassa ${MAX_FILE_MB}MB.`); continue; }
      validos.push(f);
    }
    setFiles([...files, ...validos].slice(0, MAX_FILES));
  };

  const validar = (): string | null => {
    if (!colaborador) return "Selecione o colaborador.";
    if (totalAlteracoes === 0) return "Altere ou inclua ao menos um horário na folha.";
    if (totalAlteracoes > MAX_ITENS) return `Máximo de ${MAX_ITENS} ajustes por envio.`;
    const now = new Date();
    const diasComItens = new Set(itensAlterados.map((i) => i.data));
    for (const data of diasComItens) {
      const ed = editDia(data);
      const motivo =
        ed.justificativaPreset === "Outro (descrever)"
          ? ed.justificativaOutro.trim()
          : ed.justificativaPreset.trim();
      if (!motivo || motivo.length < 5) return `Selecione uma justificativa para ${isoToBR(data)}.`;
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
      for (let i = 0; i < itensAlterados.length; i++) {
        const it = itensAlterados[i];
        const tipoAjuste = it.horaOriginal ? "correcao" : "inclusao";
        await solicitarAjuste({
          colaboradorId: colaborador.id,
          colaboradorNome: colaborador.nome_completo,
          colaboradorCpf: (colaborador as any).cpf || "",
          dataReferencia: it.data,
          tipoAjuste,
          tipoMarcacao: it.tipo,
          horaOriginal: it.horaOriginal ? `${it.horaOriginal}:00` : undefined,
          horaSolicitada: `${it.hora}:00`,
          motivo: it.motivo,
          anexos: i === 0 ? files : undefined, // anexa só no primeiro para não duplicar
        });
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
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col">
        {done ? (
          <div className="text-center space-y-3 py-6">
            <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
            <DialogTitle>Solicitação enviada!</DialogTitle>
            <DialogDescription>
              {totalAlteracoes === 1
                ? "Seu ajuste foi registrado e ficará pendente para aprovação do gestor."
                : `Seus ${totalAlteracoes} ajustes foram registrados e ficarão pendentes para aprovação do gestor.`}
            </DialogDescription>
            <Button onClick={() => { onOpenChange(false); reset(); }} className="w-full">Fechar</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Folha de Ponto · Ajustes</DialogTitle>
              <DialogDescription>
                Edite ou inclua os horários direto na folha mensal. Para cada dia alterado, selecione uma justificativa. Todos os pedidos são enviados ao gestor de uma única vez.
              </DialogDescription>
            </DialogHeader>

            {/* Colaborador + Mês */}
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

            {/* Folha */}
            <ScrollArea className="flex-1 border rounded-md min-h-[300px]">
              {!colaboradorId ? (
                <p className="text-center text-sm text-muted-foreground py-12">
                  Selecione um colaborador para visualizar a folha de ponto.
                </p>
              ) : loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : diasMes.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Nenhum dia disponível neste mês.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0 z-10">
                    <tr className="text-left">
                      <th className="px-2 py-2 font-medium w-[110px]">Dia</th>
                      {ORDEM_TIPOS.map((t) => (
                        <th key={t} className="px-2 py-2 font-medium">{TIPO_LABEL[t]}</th>
                      ))}
                      <th className="px-2 py-2 font-medium w-[260px]">Justificativa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diasMes.map((data) => {
                      const original = marcsPorDia[data] || {};
                      const pendentes = pendentesPorDia[data] || 0;
                      const ed = editDia(data);
                      const temAlteracao = ORDEM_TIPOS.some((t) => {
                        const v = ed.horarios[t];
                        return v && v !== original[t];
                      });
                      const isWeekend = [0,6].includes(new Date(data + "T12:00:00").getDay());
                      return (
                        <tr
                          key={data}
                          className={`border-t ${temAlteracao ? "bg-primary/5" : isWeekend ? "bg-muted/20" : ""}`}
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
                                  onChange={(e) => setHorario(data, t, e.target.value)}
                                  className={`h-8 text-xs font-mono ${
                                    incluido ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                                    : alterado ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30"
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
                            {temAlteracao ? (
                              <div className="space-y-1">
                                <Select value={ed.justificativaPreset} onValueChange={(v) => setJustificativaPreset(data, v)}>
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Selecione…" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {JUSTIFICATIVAS_PRESET.map((j) => (
                                      <SelectItem key={j} value={j} className="text-xs">{j}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {ed.justificativaPreset === "Outro (descrever)" && (
                                  <Input
                                    value={ed.justificativaOutro}
                                    onChange={(e) => setJustificativaOutro(data, e.target.value)}
                                    placeholder="Descreva o motivo"
                                    className="h-8 text-xs"
                                    maxLength={300}
                                  />
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-muted-foreground italic">— altere um horário para justificar</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </ScrollArea>

            {/* Rodapé */}
            <div className="space-y-3 pt-3 border-t">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-[220px]">
                  <Label className="text-xs flex items-center gap-1">
                    <Paperclip className="w-3 h-3" /> Anexos (opcional, até {MAX_FILES} de {MAX_FILE_MB}MB)
                  </Label>
                  <Input
                    type="file" multiple accept="image/*,application/pdf"
                    onChange={(e) => handleFiles(e.target.files)}
                    disabled={files.length >= MAX_FILES}
                    className="h-9 mt-1"
                  />
                  {files.length > 0 && (
                    <ul className="mt-1 space-y-1">
                      {files.map((f, i) => (
                        <li key={i} className="flex items-center justify-between text-xs bg-muted/50 px-2 py-1 rounded">
                          <span className="truncate max-w-[300px]">{f.name}</span>
                          <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-destructive">
                            <X className="w-3 h-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="text-right space-y-1">
                  <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                    {totalAlteracoes > 0 ? (
                      <Badge variant="secondary" className="text-xs">
                        {totalAlteracoes} alteração{totalAlteracoes !== 1 ? "ões" : ""} pendente{totalAlteracoes !== 1 ? "s" : ""}
                      </Badge>
                    ) : (
                      <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Nenhuma alteração ainda</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button className="flex-1" onClick={handleSubmit} disabled={enviando || totalAlteracoes === 0 || !colaboradorId}>
                  {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : `Enviar ${totalAlteracoes || ""} Ajuste${totalAlteracoes !== 1 ? "s" : ""}`}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
