import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabasePublic } from "@/lib/supabasePublic";
import { Loader2, Paperclip, X, CheckCircle2, Plus, Calendar as CalendarIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  token: string;
  colaboradorNome: string;
}

type TipoMarc = "entrada" | "saida" | "saida_almoco" | "retorno_almoco";

interface Marcacao { id: string; data: string; hora: string; tipo: TipoMarc; }
interface AjustePend { id: string; data: string; hora: string; tipo: TipoMarc; status: string; }
interface ItemAjuste { id: string; data: string; hora: string; tipo: TipoMarc; }

const MAX_FILE_MB = 5;
const MAX_FILES = 3;
const MAX_ITENS = 20;

const TIPO_LABEL: Record<TipoMarc, string> = {
  entrada: "Entrada",
  saida_almoco: "Saída Almoço",
  retorno_almoco: "Retorno Almoço",
  saida: "Saída",
};

const ORDEM_TIPOS: TipoMarc[] = ["entrada", "saida_almoco", "retorno_almoco", "saida"];

function fmtData(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function fmtHora(h: string) {
  return (h || "").slice(0, 5);
}
function novoId() {
  return Math.random().toString(36).slice(2, 9);
}

export function SolicitarAjusteModal({ open, onOpenChange, token }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [loading, setLoading] = useState(false);
  const [marcacoes, setMarcacoes] = useState<Marcacao[]>([]);
  const [ajustesPend, setAjustesPend] = useState<AjustePend[]>([]);

  const [itens, setItens] = useState<ItemAjuste[]>([]);
  const [motivo, setMotivo] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [done, setDone] = useState(false);

  const reset = () => {
    setItens([]); setMotivo(""); setFiles([]); setDone(false);
  };

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabasePublic.rpc("listar_ponto_externo", { p_token: token, p_dias: 14 });
      if (error) { toast.error(error.message); setLoading(false); return; }
      const r = data as any;
      if (r?.error) { toast.error(r.error); setLoading(false); return; }
      setMarcacoes((r?.marcacoes || []) as Marcacao[]);
      setAjustesPend((r?.ajustes || []) as AjustePend[]);
      setLoading(false);
    })();
  }, [open, token]);

  // Agrupa marcações + ajustes pendentes por data (últimos 14 dias)
  const dias = useMemo(() => {
    const map = new Map<string, { marcs: Marcacao[]; ajustes: AjustePend[] }>();
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      map.set(d.toISOString().slice(0, 10), { marcs: [], ajustes: [] });
    }
    marcacoes.forEach((m) => { if (map.has(m.data)) map.get(m.data)!.marcs.push(m); });
    ajustesPend.forEach((a) => { if (map.has(a.data)) map.get(a.data)!.ajustes.push(a); });
    return Array.from(map.entries()).map(([data, v]) => ({ data, ...v }));
  }, [marcacoes, ajustesPend]);

  const adicionarItem = (data?: string, tipo?: TipoMarc) => {
    if (itens.length >= MAX_ITENS) { toast.error(`Máximo de ${MAX_ITENS} ajustes por solicitação.`); return; }
    setItens((prev) => [...prev, { id: novoId(), data: data || today, hora: "", tipo: tipo || "entrada" }]);
  };

  const atualizarItem = (id: string, patch: Partial<ItemAjuste>) => {
    setItens((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };
  const removerItem = (id: string) => setItens((prev) => prev.filter((it) => it.id !== id));

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
    if (itens.length === 0) return "Adicione ao menos uma marcação para ajuste.";
    if (motivo.trim().length < 5) return "Justificativa precisa ter ao menos 5 caracteres.";
    const now = new Date();
    for (const it of itens) {
      if (!it.data || !it.hora) return "Preencha data e hora em todos os ajustes.";
      if (it.data > today) return "Não é permitido solicitar ajuste para data futura.";
      if (it.data === today) {
        const [hh, mm] = it.hora.split(":").map(Number);
        if (hh > now.getHours() || (hh === now.getHours() && mm > now.getMinutes())) {
          return "Não é permitido solicitar ajuste para horário futuro.";
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

      const payload = itens.map((it) => ({
        data: it.data,
        hora: `${it.hora}:00`,
        tipo: it.tipo,
      }));

      const { data: resp, error } = await supabasePublic.rpc("solicitar_ajustes_ponto_externo_batch", {
        p_token: token,
        p_itens: payload as any,
        p_motivo: motivo.trim(),
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

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        {done ? (
          <div className="text-center space-y-3 py-4">
            <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
            <DialogTitle>Solicitação enviada!</DialogTitle>
            <DialogDescription>
              {itens.length === 1
                ? "Seu pedido de ajuste foi registrado e ficará pendente para aprovação do gestor."
                : `Seus ${itens.length} pedidos de ajuste foram registrados e ficarão pendentes para aprovação do gestor.`}
            </DialogDescription>
            <Button onClick={() => { onOpenChange(false); reset(); }} className="w-full">Fechar</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Solicitar Ajuste de Ponto</DialogTitle>
              <DialogDescription>
                Veja seu registro dos últimos 14 dias e adicione um ou vários ajustes de uma só vez. O gestor aprovará tudo em conjunto.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Coluna 1: Espelho do ponto */}
              <div className="flex flex-col min-h-0">
                <div className="flex items-center gap-2 mb-2">
                  <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                  <h4 className="text-sm font-semibold">Seu Registro Recente</h4>
                </div>
                <ScrollArea className="flex-1 border rounded-md p-2 bg-muted/20">
                  {loading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                  ) : (
                    <div className="space-y-2">
                      {dias.map((d) => {
                        const tiposPresentes = new Set(d.marcs.map((m) => m.tipo));
                        const tiposFaltantes = ORDEM_TIPOS.filter((t) => !tiposPresentes.has(t));
                        return (
                          <div key={d.data} className="border rounded-md p-2 bg-background text-xs">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium">{fmtData(d.data)}</span>
                              {d.ajustes.length > 0 && (
                                <Badge variant="outline" className="text-[10px] h-5">
                                  {d.ajustes.length} pendente(s)
                                </Badge>
                              )}
                            </div>
                            {d.marcs.length === 0 && d.ajustes.length === 0 ? (
                              <p className="text-muted-foreground italic text-[11px]">Sem marcações</p>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {d.marcs.map((m) => (
                                  <Badge key={m.id} variant="secondary" className="text-[10px] font-mono">
                                    {TIPO_LABEL[m.tipo]} {fmtHora(m.hora)}
                                  </Badge>
                                ))}
                                {d.ajustes.map((a) => (
                                  <Badge key={a.id} variant="outline" className="text-[10px] font-mono border-amber-500 text-amber-700 dark:text-amber-400">
                                    {TIPO_LABEL[a.tipo]} {fmtHora(a.hora)} • {a.status}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            {tiposFaltantes.length > 0 && d.data <= today && (
                              <div className="flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t">
                                <span className="text-[10px] text-muted-foreground">Adicionar:</span>
                                {tiposFaltantes.map((t) => (
                                  <button
                                    key={t}
                                    type="button"
                                    onClick={() => adicionarItem(d.data, t)}
                                    className="text-[10px] px-1.5 py-0.5 rounded border border-dashed hover:bg-primary hover:text-primary-foreground transition"
                                  >
                                    + {TIPO_LABEL[t]}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Coluna 2: Ajustes solicitados */}
              <div className="flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">Ajustes a Solicitar ({itens.length})</h4>
                  <Button size="sm" variant="outline" onClick={() => adicionarItem()} className="h-7 text-xs">
                    <Plus className="w-3 h-3 mr-1" /> Adicionar
                  </Button>
                </div>
                <ScrollArea className="flex-1 border rounded-md p-2">
                  {itens.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">
                      Clique nos botões "+ Entrada/Saída" do espelho ao lado ou em "Adicionar" para criar pedidos.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {itens.map((it) => (
                        <div key={it.id} className="border rounded-md p-2 space-y-2 bg-muted/20">
                          <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-end">
                            <div>
                              <Label className="text-[10px]">Data</Label>
                              <Input
                                type="date"
                                value={it.data}
                                max={today}
                                onChange={(e) => atualizarItem(it.id, { data: e.target.value })}
                                className="h-8 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-[10px]">Hora</Label>
                              <Input
                                type="time"
                                value={it.hora}
                                onChange={(e) => atualizarItem(it.id, { hora: e.target.value })}
                                className="h-8 text-xs w-[100px]"
                              />
                            </div>
                            <div>
                              <Label className="text-[10px]">Tipo</Label>
                              <Select value={it.tipo} onValueChange={(v: TipoMarc) => atualizarItem(it.id, { tipo: v })}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {ORDEM_TIPOS.map((t) => (
                                    <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removerItem(it.id)}
                              className="h-8 w-8 text-destructive"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t">
              <div>
                <Label className="text-xs">Justificativa (aplicada a todos os ajustes) *</Label>
                <Textarea
                  rows={2}
                  placeholder="Ex.: Sem sinal de internet no momento das marcações."
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  maxLength={500}
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">{motivo.length}/500</p>
              </div>

              <div>
                <Label className="text-xs flex items-center gap-1">
                  <Paperclip className="w-3 h-3" /> Anexos (opcional, até {MAX_FILES} de {MAX_FILE_MB}MB)
                </Label>
                <Input
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  onChange={(e) => handleFiles(e.target.files)}
                  disabled={files.length >= MAX_FILES}
                  className="h-9"
                />
                {files.length > 0 && (
                  <ul className="mt-1 space-y-1">
                    {files.map((f, i) => (
                      <li key={i} className="flex items-center justify-between text-xs bg-muted/50 px-2 py-1 rounded">
                        <span className="truncate max-w-[300px]">{f.name}</span>
                        <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button className="flex-1" onClick={handleSubmit} disabled={enviando || itens.length === 0}>
                  {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : `Enviar ${itens.length || ""} Solicitação${itens.length !== 1 ? "ões" : ""}`}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
