import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabasePublic } from "@/lib/supabasePublic";
import { Loader2, Paperclip, X, CheckCircle2, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  token: string;
  colaboradorNome: string;
}

type TipoMarc = "entrada" | "saida_almoco" | "retorno_almoco" | "saida";

interface Marcacao { id: string; data: string; hora: string; tipo: TipoMarc; }
interface AjustePend { id: string; data: string; hora: string; tipo: TipoMarc; status: string; }

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

const JUSTIFICATIVAS_PRESET = [
  "Esqueci de registrar o ponto",
  "Falha no equipamento / aplicativo",
  "Sem sinal de internet no momento",
  "Atraso por trânsito / transporte público",
  "Saída antecipada autorizada pelo gestor",
  "Reunião externa / atendimento em cliente",
  "Atestado médico / consulta",
  "Erro ao registrar (horário incorreto)",
  "Outro (descrever)",
];

function fmtHora(h: string) { return (h || "").slice(0, 5); }
function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function isoToBR(iso: string) { const [y,m,d] = iso.split("-"); return `${d}/${m}/${y}`; }
function toMin(s?: string): number | null {
  if (!s || !/^\d{2}:\d{2}/.test(s)) return null;
  return Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
}
function diaSemana(iso: string) {
  const ds = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  return ds[new Date(iso + "T12:00:00").getDay()];
}

// edited[tipo] = "" significa "limpar/sem alteração ainda";  string com hora = ajuste
interface DiaEdit {
  horarios: Partial<Record<TipoMarc, string>>; // novos horários propostos
  justificativaPreset: string;
  justificativaOutro: string;
}

export function SolicitarAjusteModal({ open, onOpenChange, token }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const hojeDate = new Date();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [marcacoes, setMarcacoes] = useState<Marcacao[]>([]);
  const [ajustesPend, setAjustesPend] = useState<AjustePend[]>([]);
  const [mesAtivo, setMesAtivo] = useState(() => `${hojeDate.getFullYear()}-${pad(hojeDate.getMonth()+1)}`);
  const [edits, setEdits] = useState<Record<string, DiaEdit>>({}); // por data
  const [files, setFiles] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [done, setDone] = useState(false);
  const [scrollInfo, setScrollInfo] = useState({
    canScrollX: false,
    canScrollY: false,
    thumbXSize: 0,
    thumbXOffset: 0,
    thumbYSize: 0,
    thumbYOffset: 0,
  });

  const reset = () => { setEdits({}); setFiles([]); setDone(false); };

  const updateScrollInfo = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const { clientWidth, scrollWidth, scrollLeft, clientHeight, scrollHeight, scrollTop } = el;
    const canScrollX = scrollWidth > clientWidth + 1;
    const canScrollY = scrollHeight > clientHeight + 1;

    const trackX = Math.max(clientWidth - 32, 0);
    const thumbXSize = canScrollX ? Math.max((clientWidth / scrollWidth) * trackX, 40) : 0;
    const maxThumbX = Math.max(trackX - thumbXSize, 0);
    const thumbXOffset = canScrollX && scrollWidth > clientWidth
      ? (scrollLeft / (scrollWidth - clientWidth)) * maxThumbX
      : 0;

    const trackY = Math.max(clientHeight - 32, 0);
    const thumbYSize = canScrollY ? Math.max((clientHeight / scrollHeight) * trackY, 40) : 0;
    const maxThumbY = Math.max(trackY - thumbYSize, 0);
    const thumbYOffset = canScrollY && scrollHeight > clientHeight
      ? (scrollTop / (scrollHeight - clientHeight)) * maxThumbY
      : 0;

    setScrollInfo({
      canScrollX,
      canScrollY,
      thumbXSize,
      thumbXOffset,
      thumbYSize,
      thumbYOffset,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      // Pede 45 dias para cobrir mês atual + anterior
      const { data, error } = await supabasePublic.rpc("listar_ponto_externo", { p_token: token, p_dias: 45 });
      if (error) { toast.error(error.message); setLoading(false); return; }
      const r = data as any;
      if (r?.error) { toast.error(r.error); setLoading(false); return; }
      setMarcacoes((r?.marcacoes || []) as Marcacao[]);
      setAjustesPend((r?.ajustes || []) as AjustePend[]);
      setLoading(false);
    })();
  }, [open, token]);

  // Gera lista de dias do mês ativo (limitado ao hoje)
  const diasMes = useMemo(() => {
    const [y, m] = mesAtivo.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    const arr: string[] = [];
    for (let d = 1; d <= last; d++) {
      const iso = `${y}-${pad(m)}-${pad(d)}`;
      if (iso <= today) arr.push(iso);
    }
    return arr.reverse(); // mais recentes no topo
  }, [mesAtivo, today]);

  const marcsPorDia = useMemo(() => {
    const map: Record<string, Partial<Record<TipoMarc, string>>> = {};
    marcacoes.forEach((m) => {
      if (!map[m.data]) map[m.data] = {};
      // mantém a primeira hora vista por tipo (ordenado desc na RPC, então a mais recente vence — ajustar para primeira)
      if (!map[m.data][m.tipo]) map[m.data][m.tipo] = fmtHora(m.hora);
    });
    return map;
  }, [marcacoes]);

  const pendentesPorDia = useMemo(() => {
    const map: Record<string, AjustePend[]> = {};
    ajustesPend.forEach((a) => {
      if (a.status !== "pendente") return;
      if (!map[a.data]) map[a.data] = [];
      map[a.data].push(a);
    });
    return map;
  }, [ajustesPend]);

  // Helpers de edição
  const editDia = (data: string): DiaEdit =>
    edits[data] || { horarios: {}, justificativaPreset: "", justificativaOutro: "" };

  const setHorario = (data: string, tipo: TipoMarc, valor: string) => {
    setEdits((prev) => {
      const cur = editDia(data);
      const novosHorarios = { ...cur.horarios, [tipo]: valor };
      return { ...prev, [data]: { ...cur, horarios: novosHorarios } };
    });
  };

  const setJustificativaPreset = (data: string, v: string) => {
    setEdits((prev) => ({ ...prev, [data]: { ...editDia(data), justificativaPreset: v } }));
  };
  const setJustificativaOutro = (data: string, v: string) => {
    setEdits((prev) => ({ ...prev, [data]: { ...editDia(data), justificativaOutro: v } }));
  };

  // Itens efetivamente alterados (vs marcações originais)
  const itensAlterados = useMemo(() => {
    const out: { data: string; tipo: TipoMarc; hora: string; motivo: string }[] = [];
    Object.entries(edits).forEach(([data, ed]) => {
      const original = marcsPorDia[data] || {};
      const motivoFinal =
        ed.justificativaPreset === "Outro (descrever)"
          ? ed.justificativaOutro.trim()
          : ed.justificativaPreset.trim();
      ORDEM_TIPOS.forEach((t) => {
        const novo = (ed.horarios[t] || "").trim();
        if (!novo) return;
        if (novo === original[t]) return; // sem alteração
        out.push({ data, tipo: t, hora: novo, motivo: motivoFinal });
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
    if (totalAlteracoes === 0) return "Altere ou inclua ao menos um horário na folha.";
    if (totalAlteracoes > MAX_ITENS) return `Máximo de ${MAX_ITENS} ajustes por envio.`;
    const now = new Date();
    // valida justificativa por dia
    const diasComItens = new Set(itensAlterados.map((i) => i.data));
    for (const data of diasComItens) {
      const ed = editDia(data);
      const motivo =
        ed.justificativaPreset === "Outro (descrever)"
          ? ed.justificativaOutro.trim()
          : ed.justificativaPreset.trim();
      if (!motivo || motivo.length < 5) return `Selecione uma justificativa para ${isoToBR(data)}.`;

      // Validação de ordem cronológica dos horários
      const h = { ...marcsPorDia[data], ...ed.horarios };
      const e = toMin(h.entrada), sa = toMin(h.saida_almoco), ra = toMin(h.retorno_almoco), s = toMin(h.saida);
      
      if (e !== null && sa !== null && sa <= e) return `Em ${isoToBR(data)}, a Saída Almoço deve ser após a Entrada.`;
      if (sa !== null && ra !== null && ra <= sa) return `Em ${isoToBR(data)}, o Retorno Almoço deve ser após a Saída Almoço.`;
      if (ra !== null && s !== null && s <= ra) return `Em ${isoToBR(data)}, a Saída deve ser após o Retorno Almoço.`;
      if (e !== null && s !== null && s <= e) return `Em ${isoToBR(data)}, a Saída deve ser após a Entrada.`;
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
    setEnviando(true);
    try {
      const anexos: { path: string; nome: string; tamanho: number }[] = [];
      for (const f of files) {
        const path = `externo/${token}/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabasePublic.storage.from("ponto-ajustes-anexos").upload(path, f);
        if (upErr) { toast.error(`Falha no upload de ${f.name}: ${upErr.message}`); setEnviando(false); return; }
        anexos.push({ path, nome: f.name, tamanho: f.size });
      }

      const payload = itensAlterados.map((it) => ({
        data: it.data,
        hora: `${it.hora}:00`,
        tipo: it.tipo,
        motivo: it.motivo,
      }));

      const { data: resp, error } = await supabasePublic.rpc("solicitar_ajustes_ponto_externo_batch", {
        p_token: token,
        p_itens: payload as any,
        p_motivo: "Ajustes da folha de ponto",
        p_anexos: anexos as any,
      });
      if (error) { toast.error(error.message); setEnviando(false); return; }
      const r = resp as any;
      if (r?.error) { toast.error(r.error); setEnviando(false); return; }
      setDone(true);
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar solicitação.");
    }
    setEnviando(false);
  };

  // Navegação de mês
  const navegarMes = (delta: number) => {
    const [y, m] = mesAtivo.split("-").map(Number);
    const nd = new Date(y, m - 1 + delta, 1);
    const novo = `${nd.getFullYear()}-${pad(nd.getMonth()+1)}`;
    // limita a hoje (não permite mês futuro) e ao mês mínimo coberto pela RPC (~45d atrás)
    if (novo > `${hojeDate.getFullYear()}-${pad(hojeDate.getMonth()+1)}`) return;
    setMesAtivo(novo);
  };

  const mesLabel = useMemo(() => {
    const [y, m] = mesAtivo.split("-").map(Number);
    const nomes = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    return `${nomes[m-1]} ${y}`;
  }, [mesAtivo]);

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(updateScrollInfo);
    const el = scrollRef.current;
    if (!el) return () => window.cancelAnimationFrame(frame);

    const resizeObserver = new ResizeObserver(() => updateScrollInfo());
    resizeObserver.observe(el);
    window.addEventListener("resize", updateScrollInfo);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateScrollInfo);
    };
  }, [open, updateScrollInfo, diasMes.length, loading, edits, mesAtivo]);

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="w-[95vw] max-w-[95vw] md:max-w-4xl max-h-[92vh] flex flex-col overflow-hidden p-4 md:p-6">
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
                Edite ou inclua os horários direto na folha. Para cada dia alterado, escolha uma justificativa. Todos os pedidos são enviados ao gestor de uma única vez.
              </DialogDescription>
            </DialogHeader>

            {/* Navegação de mês */}
            <div className="flex items-center justify-between bg-muted/30 rounded-md px-3 py-2">
              <Button variant="ghost" size="sm" onClick={() => navegarMes(-1)} className="h-8">
                <ChevronLeft className="w-4 h-4 mr-1" /> Mês anterior
              </Button>
              <span className="text-sm font-semibold capitalize">{mesLabel}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navegarMes(1)}
                className="h-8"
                disabled={mesAtivo >= `${hojeDate.getFullYear()}-${pad(hojeDate.getMonth()+1)}`}
              >
                Próximo mês <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>

            {/* Folha */}
            <div
              ref={scrollRef}
              className="flex-1 w-full min-w-0 min-h-[300px] max-h-[60vh] overflow-x-auto overflow-y-auto border rounded-md [-webkit-overflow-scrolling:touch] touch-pan-x touch-pan-y ponto-scroll-visible"
            >
              <div className="min-w-[760px] md:min-w-full">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : diasMes.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">Nenhum dia disponível neste mês.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0 z-10">
                      <tr className="text-left">
                        <th className="px-2 py-2 font-medium w-[60px]">Dia</th>
                        <th className="px-2 py-2 font-medium">Entrada</th>
                        <th className="px-2 py-2 font-medium">S.Alm.</th>
                        <th className="px-2 py-2 font-medium">R.Alm.</th>
                        <th className="px-2 py-2 font-medium">Saída</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diasMes.map((data) => {
                        const original = marcsPorDia[data] || {};
                        const pendentes = pendentesPorDia[data] || [];
                        const ed = editDia(data);
                        const temAlteracao = ORDEM_TIPOS.some((t) => {
                          const v = ed.horarios[t];
                          return v && v !== original[t];
                        });
                        const isWeekend = [0,6].includes(new Date(data + "T12:00:00").getDay());
                        return (
                          <>
                            <tr
                              key={data}
                              className={`border-t ${temAlteracao ? "bg-primary/5" : isWeekend ? "bg-muted/20" : ""}`}
                            >
                              <td className="px-2 py-1.5 align-top">
                                <div className="font-mono font-semibold">{isoToBR(data).slice(0,5)}</div>
                                <div className="text-[10px] text-muted-foreground">{diaSemana(data)}</div>
                                {pendentes.length > 0 && (
                                  <Badge variant="outline" className="text-[9px] mt-1 border-amber-500 text-amber-700 dark:text-amber-400">
                                    {pendentes.length} pend.
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
                                      className={`h-8 text-xs font-mono px-1 ${
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
                            </tr>
                            {temAlteracao && (
                              <tr key={`${data}-just`} className={temAlteracao ? "bg-primary/5" : ""}>
                                <td colSpan={5} className="px-2 pb-3 pt-0">
                                  <div className="space-y-1.5 bg-background/50 p-2 rounded-md border border-primary/20">
                                    <Label className="text-[10px] font-semibold text-primary uppercase tracking-wider">
                                      Justificativa para {isoToBR(data)}
                                    </Label>
                                    <Select value={ed.justificativaPreset} onValueChange={(v) => setJustificativaPreset(data, v)}>
                                      <SelectTrigger className="h-8 text-xs w-full bg-background">
                                        <SelectValue placeholder="Selecione o motivo..." />
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
                                        placeholder="Descreva detalhadamente o motivo"
                                        className="h-8 text-xs bg-background"
                                        maxLength={300}
                                      />
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>


            {/* Rodapé com anexos + envio */}
            <div className="space-y-3 pt-3 border-t">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-[220px]">
                  <Label className="text-xs flex items-center gap-1">
                    <Paperclip className="w-3 h-3" /> Anexos (opcional, até {MAX_FILES} de {MAX_FILE_MB}MB)
                  </Label>
                  <Input
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
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

              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" className="flex-1 order-2 sm:order-1" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button className="flex-1 order-1 sm:order-2" onClick={handleSubmit} disabled={enviando || totalAlteracoes === 0}>
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
