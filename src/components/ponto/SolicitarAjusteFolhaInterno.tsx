import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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

// Modelo de alternância livre entrada↔saída (igual ao banco — ver
// migration 20260610180000_ponto_alternancia_entrada_saida): a posição
// na sequência cronológica define o tipo. Índice par = ENTRADA, índice
// ímpar = SAÍDA. O dia pode ter quantos pares forem necessários.
type TipoMarc = "entrada" | "saida";

const MAX_FILE_MB = 5;
const MAX_ITENS = 60;
/** Limite de marcações por dia no formulário (8 pares entrada/saída). */
const MAX_MARCS_DIA = 16;

/** Tipo de uma marcação pela posição: par = entrada, ímpar = saída. */
function tipoPorIndice(i: number): TipoMarc {
  return i % 2 === 0 ? "entrada" : "saida";
}
function tipoLabel(i: number): string {
  return tipoPorIndice(i) === "entrada" ? "Entrada" : "Saída";
}

const OUTRO_VALUE = "__outro__";

// Justificativas fixas (mesmas do ponto externo), sempre disponíveis.
// Prefixo "preset:" no value para diferenciar das cadastradas (que usam o id do banco).
const PRESETS_FIXOS = [
  "Esqueci de registrar o ponto",
  "Falha no equipamento / aplicativo",
  "Sem sinal de internet no momento",
  "Atraso por trânsito / transporte público",
  "Saída antecipada autorizada pelo gestor",
  "Reunião externa / atendimento em cliente",
  "Atestado médico / consulta",
  "Erro ao registrar (horário incorreto)",
];
const PRESET_PREFIX = "preset:";

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
/**
 * Horas trabalhadas (decimais) somando cada par entrada→saída da
 * sequência. Marcações sem par (saída pendente) são ignoradas.
 */
function horasTrabalhadasDia(marcs: string[]): number {
  let total = 0;
  for (let i = 0; i + 1 < marcs.length; i += 2) {
    const e = toMin(marcs[i]), s = toMin(marcs[i + 1]);
    if (e != null && s != null && s > e) total += s - e;
  }
  return Math.max(0, total / 60);
}

interface DiaEdit {
  // undefined = não editado (usa as marcações originais).
  // array = sequência cronológica de horários "HH:MM" que substitui o dia.
  marcacoes?: string[];
  justificativaId: string;
  outroTexto: string;
  horasAbono: string;     // string para input livre; convertido em number ao enviar
  anexo: File | null;
}

const EMPTY_EDIT: DiaEdit = { justificativaId: "", outroTexto: "", horasAbono: "", anexo: null };

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
  // Marcações originais por dia: lista de horas "HH:MM" em ordem cronológica.
  const [marcsPorDia, setMarcsPorDia] = useState<Record<string, string[]>>({});
  // Mesma lista, mas com a hora crua do banco (com segundos) para casar a
  // marcação original exata no momento da correção (YOUREYES-160).
  const [marcsRawPorDia, setMarcsRawPorDia] = useState<Record<string, string[]>>({});
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

      // Casa as marcações/ajustes por CPF (resiliente a divergência de
      // colaborador_id — ex.: admissão recriada gera novo id, mas o CPF é o
      // mesmo), exatamente como o Espelho. Cobre variações de formatação do
      // CPF. Sem CPF válido, cai no filtro por colaborador_id.
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

      // Reconstrói as marcações do dia como uma SEQUÊNCIA cronológica
      // simples (igual ao espelho). O tipo é dado pela posição
      // (par=entrada, ímpar=saída), no mesmo modelo de alternância do
      // banco. Guardamos também a hora crua (com segundos) para a
      // correção apagar a marcação original exata (YOUREYES-160).
      const map: Record<string, string[]> = {};
      const rawMap: Record<string, string[]> = {};
      const porDia: Record<string, { hora: string }[]> = {};
      ((marcRes.data as any[]) || []).forEach((m) => {
        (porDia[m.data_marcacao] ||= []).push({ hora: m.hora_marcacao });
      });
      Object.entries(porDia).forEach(([data, marcas]) => {
        marcas.sort((a, b) => String(a.hora).localeCompare(String(b.hora)));
        map[data] = marcas.map((m) => fmtHora(m.hora));
        rawMap[data] = marcas.map((m) => m.hora);
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

  /** Marcações efetivas do dia = edição (se houver) ou as originais. */
  const marcacoesEfetivas = (data: string): string[] => {
    const ed = editDia(data);
    if (ed.marcacoes !== undefined) return ed.marcacoes;
    return marcsPorDia[data] || [];
  };

  /** Garante que o dia está em modo de edição (clona as originais). */
  const ensureEdicao = (data: string): string[] => {
    const ed = editDia(data);
    if (ed.marcacoes !== undefined) return [...ed.marcacoes];
    return [...(marcsPorDia[data] || [])];
  };

  const setMarcacao = (data: string, idx: number, valor: string) => {
    const lista = ensureEdicao(data);
    lista[idx] = valor;
    patchDia(data, { marcacoes: lista });
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
    // Só pode remover marcação recém-adicionada (não existente no banco);
    // exclusão de marcação já registrada não é suportada pelo ajuste.
    if (idx < original.length) {
      toast.error("Não é possível excluir uma marcação já registrada. Para anular um horário, ajuste-o ou registre uma justificativa.");
      return;
    }
    const lista = ensureEdicao(data);
    lista.splice(idx, 1);
    patchDia(data, { marcacoes: lista });
  };

  const resolverMotivo = (ed: DiaEdit): { motivo: string; justId: string | null } => {
    if (ed.justificativaId === OUTRO_VALUE) return { motivo: ed.outroTexto.trim(), justId: null };
    if (ed.justificativaId.startsWith(PRESET_PREFIX)) {
      return { motivo: ed.justificativaId.slice(PRESET_PREFIX.length), justId: null };
    }
    const j = justAtivas.find((x) => x.id === ed.justificativaId);
    if (!j) return { motivo: "", justId: null };
    return { motivo: j.nome, justId: j.id };
  };

  // Lista de alterações de horários. Compara posição a posição: cada
  // marcação editada na posição i vs a original na mesma posição.
  // - mudou e havia original na posição  -> correção (horaOriginal = raw[i])
  // - posição nova (além das originais)   -> inclusão (horaOriginal vazio)
  // O tipo (entrada/saída) vem da POSIÇÃO (par/ímpar), igual ao banco.
  // Diferença POR HORÁRIO (não por posição): mantém as marcações que já
  // existem, trata horários novos como INCLUSÃO (sem apagar nada) e só usa
  // CORREÇÃO quando um horário original foi de fato trocado por outro. O tipo
  // (entrada/saída) vem da POSIÇÃO CRONOLÓGICA do dia inteiro (ordenado por
  // horário), igual ao espelho — assim adicionar a entrada da manhã não vira
  // "correção" que sobrescreve a marcação da tarde.
  const itensAlterados = useMemo(() => {
    const out: { data: string; tipo: TipoMarc; hora: string; horaOriginal: string }[] = [];
    Object.entries(edits).forEach(([data, ed]) => {
      if (ed.marcacoes === undefined) return;
      const original = marcsPorDia[data] || [];
      const raw = marcsRawPorDia[data] || [];
      const rawByHora: Record<string, string> = {};
      original.forEach((o, i) => { if (!(o in rawByHora)) rawByHora[o] = raw[i] || o; });

      const novas = ed.marcacoes.map((s) => (s || "").trim()).filter(Boolean);
      const origSet = new Set(original);
      const novasSet = new Set(novas);
      // Tipo pela posição cronológica do dia completo (ordenado por horário).
      const ordenadas = [...novas].sort((a, b) => (toMin(a) ?? 0) - (toMin(b) ?? 0));
      const tipoDe = (hora: string): TipoMarc => tipoPorIndice(ordenadas.indexOf(hora));

      const removidos = original.filter((o) => !novasSet.has(o)); // originais que saíram
      const adicionados = novas.filter((n) => !origSet.has(n));    // horários novos
      let r = 0;
      for (const hora of adicionados) {
        if (r < removidos.length) {
          // um horário original foi trocado por outro -> correção
          out.push({ data, tipo: tipoDe(hora), hora, horaOriginal: rawByHora[removidos[r]] || removidos[r] });
          r++;
        } else {
          // horário novo -> inclusão (mantém os já existentes)
          out.push({ data, tipo: tipoDe(hora), hora, horaOriginal: "" });
        }
      }
    });
    return out;
  }, [edits, marcsPorDia, marcsRawPorDia]);

  // Marcações removidas no formulário: o banco NÃO suporta ajuste de
  // exclusão (processar_ajuste_ponto trata só inclusão/correção). Por
  // isso só permitimos remover marcações que foram ADICIONADAS agora e
  // ainda não existem no banco (posição >= nº de originais). Tentar
  // remover uma marcação já existente é bloqueado na UI/validação.
  const diasComAlteracao = useMemo(() => {
    const set = new Set<string>();
    itensAlterados.forEach((i) => set.add(i.data));
    Object.entries(edits).forEach(([data, ed]) => {
      if ((Number(ed.horasAbono) || 0) > 0) set.add(data);
    });
    // Dias com marcação pendente de aprovação não entram (bloqueio por dia)
    return Array.from(set).filter((data) => (pendentesPorDia[data] ?? 0) === 0);
  }, [itensAlterados, edits, pendentesPorDia]);

  const totalAlteracoes = diasComAlteracao.length;

  // Bloqueio POR DIA: um dia com marcação pendente de aprovação não pode
  // receber novo ajuste; dias sem pendência seguem editáveis.
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

      // Sequência efetiva do dia (ignora marcações vazias do form)
      const seq = marcacoesEfetivas(data).map((m) => (m || "").trim()).filter(Boolean);

      if (abono > 0) {
        const horas = horasTrabalhadasDia(seq);
        if (abono > horas + 0.001) {
          return `Em ${isoToBR(data)}: o abono (${abono.toFixed(1)}h) é maior que as horas registradas/ajustadas no dia (${horas.toFixed(1)}h). Ajuste os horários do dia ou reduza o abono.`;
        }
      }

      // Permite lançar FORA DE ORDEM: o dia é ordenado cronologicamente na
      // consolidação/espelho, então não exigimos sequência crescente aqui.
      // Só bloqueia o erro real de duas marcações no MESMO horário.
      const minsOrdenados = seq
        .map((h) => toMin(h))
        .filter((m): m is number => m !== null)
        .sort((a, b) => a - b);
      for (let i = 1; i < minsOrdenados.length; i++) {
        if (minsOrdenados[i] === minsOrdenados[i - 1]) {
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
              horaOriginal: it.horaOriginal
                ? (it.horaOriginal.length >= 8 ? it.horaOriginal : `${it.horaOriginal}:00`)
                : undefined,
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
                  disabled={mesAtivo >= `${hojeDate.getFullYear()}-${pad(hojeDate.getMonth()+1)}`}
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
                <table className="w-full text-xs min-w-[760px] table-fixed">
                  <thead className="bg-muted/50 sticky top-0 z-10">
                    <tr className="text-left">
                      <th className="px-2 py-2 font-medium w-[80px]">Dia</th>
                      <th className="px-2 py-2 font-medium w-[260px]">Marcações (Entrada / Saída)</th>
                      <th className="px-2 py-2 font-medium w-[180px]">Justificativa</th>
                      <th className="px-2 py-2 font-medium w-[70px]">Abono (h)</th>
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
                      const temAbono = (Number(ed.horasAbono) || 0) > 0;
                      const ativo = temAlteracaoHora || temAbono;
                      const isWeekend = [0,6].includes(new Date(data + "T12:00:00").getDay());
                      const futuro = data > today;
                      const horasEfetiv = horasTrabalhadasDia(marcs.map((m) => (m || "").trim()).filter(Boolean));
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
                            {ativo ? (
                              <div className="space-y-1">
                                <Select value={ed.justificativaId} onValueChange={(v) => patchDia(data, { justificativaId: v })}>
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Selecione…" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PRESETS_FIXOS.map((p) => (
                                      <SelectItem key={p} value={`${PRESET_PREFIX}${p}`} className="text-xs">
                                        {p}
                                      </SelectItem>
                                    ))}
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
                              disabled={futuro || diaBloqueado(data)}
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
                                <span>Anexar {ativo && justAtivas.find(j => j.id === ed.justificativaId)?.requer_anexo && "*"}</span>
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
