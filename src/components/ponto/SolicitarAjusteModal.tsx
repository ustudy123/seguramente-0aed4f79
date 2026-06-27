import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabasePublic } from "@/lib/supabasePublic";
import { Loader2, Paperclip, X, CheckCircle2, ChevronLeft, ChevronRight, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  token: string;
  /** CPF (apenas dígitos) quando o acesso é via link compartilhado. */
  cpf?: string;
  colaboradorNome: string;
}

type TipoMarc = "entrada" | "saida_almoco" | "retorno_almoco" | "saida";

interface Marcacao { id: string; data: string; hora: string; tipo: TipoMarc; }
interface AjustePend { id: string; data: string; hora: string; tipo: TipoMarc; status: string; }

const MAX_FILE_MB = 5;
const MAX_FILES = 3;
const MAX_ITENS = 40;

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

// Tipo de uma marcação pela POSIÇÃO na sequência do dia:
// par (0,2,4...) = entrada; ímpar (1,3,5...) = saída.
// Modelo de alternância livre — comporta múltiplos ciclos por dia.
function tipoPorIndice(i: number): "entrada" | "saida" {
  return i % 2 === 0 ? "entrada" : "saida";
}
function tipoLabelIndice(i: number): string {
  return tipoPorIndice(i) === "entrada" ? "Entrada" : "Saída";
}

// edited.marcacoes = lista cronológica de horários "HH:MM" do dia
// (undefined = sem alteração; usa as originais). horas em pares.
interface DiaEdit {
  marcacoes?: string[];          // novos horários propostos (sequência)
  justificativaPreset: string;
  justificativaOutro: string;
}

export function SolicitarAjusteModal({ open, onOpenChange, token, cpf }: Props) {
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
  // Justificativas cadastradas pelo RH (ponto_justificativas), carregadas via RPC pública.
  const [justCadastradas, setJustCadastradas] = useState<string[]>([]);

  // Lista exibida no select: as cadastradas (se houver) + "Outro" no fim.
  // Fallback para a lista interna caso a RPC falhe/retorne vazio.
  const OUTRO_LABEL = "Outro (descrever)";
  const opcoesJustificativa = useMemo(() => {
    const base = justCadastradas.length
      ? justCadastradas
      : JUSTIFICATIVAS_PRESET.filter((x) => x !== OUTRO_LABEL);
    return [...base, OUTRO_LABEL];
  }, [justCadastradas]);

  const reset = () => { setEdits({}); setFiles([]); setDone(false); };

  // Carrega as justificativas cadastradas (mesmas da folha interna) via RPC pública.
  useEffect(() => {
    if (!open || !token) return;
    let cancel = false;
    (async () => {
      try {
        const { data, error } = await supabasePublic.rpc(
          "listar_justificativas_externo" as any,
          { p_token: token }
        );
        if (cancel) return;
        const arr = (data as any)?.justificativas;
        if (!error && Array.isArray(arr) && arr.length > 0) {
          setJustCadastradas(
            arr.map((j: any) => String(j.nome)).filter((n: string) => n.trim().length > 0)
          );
        } else {
          setJustCadastradas([]); // mantém fallback interno
        }
      } catch {
        if (!cancel) setJustCadastradas([]);
      }
    })();
    return () => { cancel = true; };
  }, [open, token]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      // Pede 45 dias para cobrir mês atual + anterior
      const { data, error } = cpf
        ? await supabasePublic.rpc("listar_ponto_externo_cpf" as any, { p_token: token, p_cpf: cpf, p_dias: 45 })
        : await supabasePublic.rpc("listar_ponto_externo" as any, { p_token: token, p_dias: 45 });
      if (error) { toast.error(error.message); setLoading(false); return; }
      const r = data as any;
      if (r?.error) { toast.error(r.error); setLoading(false); return; }
      setMarcacoes((r?.marcacoes || []) as Marcacao[]);
      setAjustesPend((r?.ajustes || []) as AjustePend[]);
      setLoading(false);
    })();
  }, [open, token, cpf]);

  // Gera lista de dias do mês ativo (limitado ao hoje)
  const diasMes = useMemo(() => {
    const [y, m] = mesAtivo.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const arr: string[] = [];
    for (let d = 1; d <= lastDay; d++) {
      const iso = `${y}-${pad(m)}-${pad(d)}`;
      if (iso <= today) arr.push(iso);
    }
    return arr; // Ordem cronológica (01, 02, 03...)
  }, [mesAtivo, today]);

  const marcsPorDia = useMemo(() => {
    // Sequência cronológica de horários por dia (alternância entrada/saída).
    // Reúne TODAS as marcações do dia (não descarta repetidas por tipo).
    const map: Record<string, string[]> = {};
    const porDia: Record<string, { hora: string }[]> = {};
    marcacoes.forEach((m) => {
      (porDia[m.data] ||= []).push({ hora: m.hora });
    });
    Object.entries(porDia).forEach(([data, lista]) => {
      lista.sort((a, b) => String(a.hora).localeCompare(String(b.hora)));
      map[data] = lista.map((x) => fmtHora(x.hora));
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

  // Um dia está BLOQUEADO para ajuste enquanto tiver marcação pendente de
  // aprovação. O bloqueio é por dia: dias sem pendência seguem editáveis.
  const diaBloqueado = (data: string): boolean => (pendentesPorDia[data]?.length ?? 0) > 0;

  // Helpers de edição
  const editDia = (data: string): DiaEdit =>
    edits[data] || { justificativaPreset: "", justificativaOutro: "" };

  // Lista efetiva de marcações do dia (edição ou originais)
  const marcacoesEfetivas = (data: string): string[] => {
    const ed = editDia(data);
    if (ed.marcacoes !== undefined) return ed.marcacoes;
    return marcsPorDia[data] || [];
  };

  // Define a hora de uma posição
  const setMarcacao = (data: string, idx: number, valor: string) => {
    setEdits((prev) => {
      const cur = prev[data] || editDia(data);
      const base = cur.marcacoes !== undefined ? [...cur.marcacoes] : [...(marcsPorDia[data] || [])];
      base[idx] = valor;
      return { ...prev, [data]: { ...cur, marcacoes: base } };
    });
  };

  // Adiciona um par (entrada + saída vazios) ou uma marcação avulsa ao fim
  const adicionarMarcacao = (data: string) => {
    setEdits((prev) => {
      const cur = prev[data] || editDia(data);
      const base = cur.marcacoes !== undefined ? [...cur.marcacoes] : [...(marcsPorDia[data] || [])];
      base.push("");
      return { ...prev, [data]: { ...cur, marcacoes: base } };
    });
  };

  // Remove a última marcação da sequência
  const removerMarcacao = (data: string, idx: number) => {
    setEdits((prev) => {
      const cur = prev[data] || editDia(data);
      const base = cur.marcacoes !== undefined ? [...cur.marcacoes] : [...(marcsPorDia[data] || [])];
      base.splice(idx, 1);
      return { ...prev, [data]: { ...cur, marcacoes: base } };
    });
  };
  const setJustificativaPreset = (data: string, v: string) => {
    setEdits((prev) => ({ ...prev, [data]: { ...editDia(data), justificativaPreset: v } }));
  };
  const setJustificativaOutro = (data: string, v: string) => {
    setEdits((prev) => ({ ...prev, [data]: { ...editDia(data), justificativaOutro: v } }));
  };

  // Itens efetivamente alterados, comparando POSIÇÃO a posição:
  // - mudou e havia original na posição i  -> correção (horaOriginal = original[i])
  // - posição nova (i >= nº de originais)   -> inclusão (sem horaOriginal)
  // O tipo (entrada/saida) é dado pela posição (par/ímpar).
  const itensAlterados = useMemo(() => {
    const out: { data: string; tipo: "entrada" | "saida"; hora: string; horaOriginal?: string; motivo: string }[] = [];
    Object.entries(edits).forEach(([data, ed]) => {
      if (ed.marcacoes === undefined) return;
      if (diaBloqueado(data)) return; // dia com pendência não gera novo ajuste
      const original = marcsPorDia[data] || [];
      const motivoFinal =
        ed.justificativaPreset === "Outro (descrever)"
          ? ed.justificativaOutro.trim()
          : ed.justificativaPreset.trim();
      ed.marcacoes.forEach((novoRaw, i) => {
        const novo = (novoRaw || "").trim();
        if (!novo) return;
        const orig = original[i] || "";
        if (novo === orig) return; // sem alteração nessa posição
        out.push({
          data,
          tipo: tipoPorIndice(i),
          hora: novo,
          horaOriginal: orig || undefined, // havia original => correção
          motivo: motivoFinal,
        });
      });
    });
    return out;
  }, [edits, marcsPorDia, pendentesPorDia]);

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

      // Validação cronológica da sequência de marcações (pares entrada/saída).
      const seq = marcacoesEfetivas(data).map((x) => (x || "").trim());
      const preenchidas = seq.map((h, i) => ({ h, i, min: toMin(h) })).filter((x) => x.h !== "");
      // Toda marcação preenchida precisa ser horário válido
      for (const x of preenchidas) {
        if (x.min === null) return `Em ${isoToBR(data)}, há um horário inválido. Use o formato HH:MM.`;
      }
      // Cada SAÍDA (posição ímpar) deve vir depois da ENTRADA do par (posição par anterior)
      for (let i = 1; i < seq.length; i += 2) {
        const entrada = toMin(seq[i - 1]);
        const saida = toMin(seq[i]);
        if (entrada !== null && saida !== null && saida <= entrada) {
          const par = Math.floor(i / 2) + 1;
          return `Em ${isoToBR(data)}, a Saída do ${par}º par deve ser após a Entrada.`;
        }
      }
      // A sequência inteira deve ser crescente (uma marcação após a anterior)
      for (let i = 1; i < seq.length; i++) {
        const ant = toMin(seq[i - 1]);
        const atual = toMin(seq[i]);
        if (ant !== null && atual !== null && atual <= ant) {
          return `Em ${isoToBR(data)}, os horários devem estar em ordem crescente (${tipoLabelIndice(i)} após a marcação anterior).`;
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
    setEnviando(true);
    try {
      const anexos: { nome: string; url: string; tamanho: number; tipo: string }[] = [];
      for (const f of files) {
        const path = `externo/${token}/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabasePublic.storage.from("ponto-ajustes-anexos").upload(path, f, { contentType: f.type });
        if (upErr) { toast.error(`Falha no upload de ${f.name}: ${upErr.message}`); setEnviando(false); return; }
        anexos.push({ nome: f.name, url: path, tamanho: f.size, tipo: f.type });
      }

      const payload = itensAlterados.map((it) => ({
        data: it.data,
        hora: `${it.hora}:00`,
        hora_original: it.horaOriginal ? `${it.horaOriginal}:00` : null,
        tipo: it.tipo,
        motivo: it.motivo,
      }));

      const { data: resp, error } = cpf
        ? await supabasePublic.rpc("solicitar_ajustes_ponto_externo_cpf_batch" as any, {
            p_token: token,
            p_cpf: cpf,
            p_itens: payload as any,
            p_motivo: "Ajustes da folha de ponto",
            p_anexos: anexos as any,
          })
        : await supabasePublic.rpc("solicitar_ajustes_ponto_externo_batch" as any, {
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


  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="w-[95vw] max-w-[95vw] md:max-w-5xl h-[92vh] max-h-[92vh] flex flex-col overflow-hidden p-4 md:p-6 gap-3">
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

            <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
              {/* Navegação de mês */}
              <div className="flex items-center justify-between bg-muted/30 rounded-md px-3 py-2 shrink-0">
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
                className="flex-1 min-h-0 w-full overflow-x-auto overflow-y-auto border rounded-md ponto-scroll-visible"
              >
                <div className="min-w-[760px] md:min-w-full min-h-full">
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : diasMes.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">Nenhum dia disponível neste mês.</p>
                  ) : (
                    <table className="w-full text-[11px] table-fixed">
                    <thead className="bg-muted/50 sticky top-0 z-10">
                      <tr className="text-left">
                        <th className="px-2 py-2 font-medium w-[10%]">Dia</th>
                        <th className="px-1.5 py-2 font-medium w-[72%]">Marcações (Entrada / Saída)</th>
                        <th className="px-2 py-2 font-medium w-[18%]">Justificativa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diasMes.map((data) => {
                        const original = marcsPorDia[data] || [];
                        const pendentes = pendentesPorDia[data] || [];
                        const ed = editDia(data);
                        const marcs = marcacoesEfetivas(data);
                        const temAlteracao = ed.marcacoes !== undefined && (
                          ed.marcacoes.length !== original.length ||
                          ed.marcacoes.some((v, i) => (v || "") !== (original[i] || ""))
                        );
                        const isWeekend = [0,6].includes(new Date(data + "T12:00:00").getDay());
                        return (
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
                            <td className="px-1.5 py-1.5 align-top">
                              {diaBloqueado(data) ? (
                                <div className="flex items-start gap-2 py-1.5">
                                  <Clock className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                                  <div>
                                    <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">Ajuste ainda pendente — aguarde a aprovação.</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                      Este dia tem {pendentes.length} marcação(ões) aguardando o gestor. Não é possível alterar até ser aprovado ou rejeitado.
                                    </p>
                                  </div>
                                </div>
                              ) : (
                              <div className="flex flex-wrap items-start gap-2">
                                {marcs.length === 0 && (
                                  <span className="text-[10px] text-muted-foreground italic py-1.5">Sem marcações</span>
                                )}
                                {marcs.map((valor, i) => {
                                  const orig = original[i] || "";
                                  const novaMarc = i >= original.length;
                                  const alterado = ed.marcacoes !== undefined && (valor || "") !== orig && !novaMarc;
                                  const tipo = tipoPorIndice(i);
                                  const ehUltima = i === marcs.length - 1;
                                  return (
                                    <div key={i} className="flex flex-col gap-0.5">
                                      <span className={`text-[9px] font-semibold ${tipo === "entrada" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                        {tipoLabelIndice(i)}
                                      </span>
                                      <div className="flex items-center gap-1">
                                        <Input
                                          type="time"
                                          value={valor || ""}
                                          onChange={(e) => setMarcacao(data, i, e.target.value)}
                                          className={`h-8 text-xs font-mono px-1 w-[92px] ${
                                            novaMarc ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                                            : alterado ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30"
                                            : ""
                                          }`}
                                        />
                                        {ehUltima && (
                                          <button
                                            type="button"
                                            onClick={() => removerMarcacao(data, i)}
                                            className="text-muted-foreground hover:text-destructive shrink-0"
                                            title="Remover marcação"
                                          >
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                      {orig && alterado && (
                                        <div className="text-[9px] text-muted-foreground line-through">orig: {orig}</div>
                                      )}
                                    </div>
                                  );
                                })}
                                <button
                                  type="button"
                                  onClick={() => adicionarMarcacao(data)}
                                  className="h-8 mt-[14px] px-2 text-[10px] rounded border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary hover:text-primary shrink-0"
                                  title="Adicionar marcação"
                                >
                                  + marcação
                                </button>
                              </div>
                              )}
                            </td>
                            <td className="px-2 py-1.5 align-top">
                              {temAlteracao ? (
                                <div className="space-y-1.5">
                                  <Select value={ed.justificativaPreset} onValueChange={(v) => setJustificativaPreset(data, v)}>
                                    <SelectTrigger className="h-8 text-xs w-full bg-background">
                                      <SelectValue placeholder="Selecione o motivo..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {opcoesJustificativa.map((j) => (
                                        <SelectItem key={j} value={j} className="text-xs">{j}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {ed.justificativaPreset === "Outro (descrever)" && (
                                    <Input
                                      value={ed.justificativaOutro}
                                      onChange={(e) => setJustificativaOutro(data, e.target.value)}
                                      placeholder="Descreva o motivo"
                                      className="h-8 text-xs bg-background"
                                      maxLength={300}
                                    />
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>


            {/* Rodapé com anexos + envio */}
            <div className="space-y-3 pt-3 border-t shrink-0 bg-background">
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
              <div className="grid grid-cols-2 gap-2 mt-auto">
                <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button className="w-full" onClick={handleSubmit} disabled={enviando || totalAlteracoes === 0}>
                  {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : `Enviar Ajustes (${totalAlteracoes || 0})`}
                </Button>
              </div>

            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
