import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Mic, Square, Sparkles, Loader2, AlertTriangle, CheckCircle2, Info, FileText, Pencil, BookTemplate } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePontoEscalas } from "@/hooks/usePontoEscalas";
import { usePontoEscalasAvancado } from "@/hooks/usePontoEscalasAvancado";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";

interface BlocoDia {
  dia_semana: string;
  blocos: { inicio: string; fim: string }[];
}

interface Recorrencia {
  descricao: string;
  ordinal_mes?: string;
  dia_semana?: string;
  hora_inicio?: string;
  hora_fim?: string;
}

interface Alerta {
  severidade: "info" | "atencao" | "erro";
  mensagem: string;
}

interface EstruturaEscala {
  nome_sugerido: string;
  tipo: string;
  nivel_confianca: "alta" | "media" | "baixa";
  jornada_diaria_minutos: number;
  jornada_semanal_minutos: number;
  intervalo_intrajornada_minutos: number;
  hora_entrada_padrao: string;
  hora_saida_padrao: string;
  sabado_util: boolean;
  domingo_util: boolean;
  tem_adicional_noturno: boolean;
  periodos_diarios: BlocoDia[];
  recorrencias?: Recorrencia[];
  alertas: Alerta[];
  perguntas_complementares?: string[];
  descricao_contratual: string;
  resumo_interpretacao: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DIAS_LABEL: Record<string, string> = {
  segunda: "Segunda", terca: "Terça", quarta: "Quarta", quinta: "Quinta",
  sexta: "Sexta", sabado: "Sábado", domingo: "Domingo",
};

export function CadastroInteligenteEscala({ open, onOpenChange }: Props) {
  const { criarEscala, criandoEscala } = usePontoEscalas();
  const { padroes, salvarEstruturaCompleta, salvandoEstrutura } = usePontoEscalasAvancado();
  const { tenantId } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();
  const [descricao, setDescricao] = useState("");
  const [interpretando, setInterpretando] = useState(false);
  const [estrutura, setEstrutura] = useState<EstruturaEscala | null>(null);
  const [textoOriginal, setTextoOriginal] = useState("");
  const [origemInput, setOrigemInput] = useState<"texto" | "audio">("texto");
  const [transcricaoAudio, setTranscricaoAudio] = useState<string | null>(null);

  // Áudio
  const [gravando, setGravando] = useState(false);
  const [transcrevendo, setTranscrevendo] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const reset = () => {
    setDescricao(""); setEstrutura(null); setTextoOriginal("");
    setOrigemInput("texto"); setTranscricaoAudio(null);
  };

  const aplicarPadrao = (padraoId: string) => {
    const p = padroes.find((x) => x.id === padraoId);
    if (!p) return;
    setDescricao(p.exemplo_descricao || p.descricao || "");
    toast.success(`Padrão "${p.nome}" carregado. Ajuste e clique em Interpretar.`);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const startGravacao = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await transcreverAudio(blob);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setGravando(true);
    } catch (e) {
      toast.error("Não foi possível acessar o microfone");
    }
  };

  const stopGravacao = () => {
    mediaRecorderRef.current?.stop();
    setGravando(false);
  };

  const transcreverAudio = async (blob: Blob) => {
    setTranscrevendo(true);
    try {
      const reader = new FileReader();
      const base64: string = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const { data, error } = await supabase.functions.invoke("ai-transcribe-audio", {
        body: { audioBase64: base64 },
      });
      if (error) throw error;
      const texto = data?.text || "";
      setDescricao((d) => (d ? d + " " : "") + texto);
      setOrigemInput("audio");
      setTranscricaoAudio(texto);
      toast.success("Áudio transcrito. Revise o texto antes de interpretar.");
    } catch (e) {
      toast.error("Falha na transcrição do áudio");
    } finally {
      setTranscrevendo(false);
    }
  };

  const interpretar = async () => {
    if (descricao.trim().length < 10) {
      toast.error("Descreva a jornada com mais detalhes");
      return;
    }
    setInterpretando(true);
    try {
      const { data, error } = await supabase.functions.invoke("interpretar-escala", {
        body: { descricao },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setEstrutura(data.estrutura);
      setTextoOriginal(descricao);
      toast.success("Escala interpretada! Revise antes de salvar.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na interpretação");
    } finally {
      setInterpretando(false);
    }
  };

  const formatMin = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h${m > 0 ? `${m.toString().padStart(2, "0")}` : ""}`;
  };

  const salvarEscala = async () => {
    if (!estrutura || !tenantId) return;

    try {
      // 1. Criar a escala base (com colunas estendidas)
      const escalaCriada: any = await criarEscala({
        nome: estrutura.nome_sugerido,
        tipo: estrutura.tipo,
        jornada_diaria_minutos: estrutura.jornada_diaria_minutos,
        jornada_semanal_minutos: estrutura.jornada_semanal_minutos,
        intervalo_intrajornada_minutos: estrutura.intervalo_intrajornada_minutos,
        hora_entrada_padrao: estrutura.hora_entrada_padrao,
        hora_saida_padrao: estrutura.hora_saida_padrao,
        sabado_util: estrutura.sabado_util,
        domingo_util: estrutura.domingo_util,
        percentual_adicional_noturno: estrutura.tem_adicional_noturno ? 20 : 0,
        usa_hora_ficta_noturna: estrutura.tem_adicional_noturno,
        percentual_hora_extra_50: 50,
        percentual_hora_extra_100: 100,
        tolerancia_minutos: 5,
        tolerancia_diaria_minutos: 10,
        ativa: true,
        descricao_original: textoOriginal,
        descricao_contratual: estrutura.descricao_contratual,
        nivel_confianca: estrutura.nivel_confianca,
        origem_input: origemInput,
      } as any);

      const escalaId = escalaCriada?.id;
      if (!escalaId) {
        toast.warning("Escala criada, mas não foi possível salvar períodos/recorrências.");
        handleClose(false);
        return;
      }

      // 2. Achatar períodos diários em registros (um por bloco)
      const periodos = (estrutura.periodos_diarios || []).flatMap((dia) =>
        dia.blocos.map((b, idx) => ({
          dia_semana: dia.dia_semana,
          ordem_bloco: idx + 1,
          hora_inicio: b.inicio,
          hora_fim: b.fim,
        }))
      );

      // 3. Recorrências válidas (com ordinal e horários)
      const recorrencias = (estrutura.recorrencias || [])
        .filter((r) => r.ordinal_mes && r.dia_semana && r.hora_inicio && r.hora_fim)
        .map((r) => ({
          descricao: r.descricao || null,
          ordinal_mes: r.ordinal_mes!,
          dia_semana: r.dia_semana!,
          hora_inicio: r.hora_inicio!,
          hora_fim: r.hora_fim!,
          observacao: null,
        }));

      // 4. Salvar tudo + histórico
      await salvarEstruturaCompleta({
        escalaId,
        periodos,
        recorrencias,
        historico: {
          entrada_original: textoOriginal,
          origem_input: origemInput,
          transcricao_audio: transcricaoAudio,
          saida_ia: estrutura,
          nivel_confianca: estrutura.nivel_confianca,
          descricao_contratual: estrutura.descricao_contratual,
          alertas: estrutura.alertas,
        },
      });

      toast.success("Escala completa salva com períodos, recorrências e histórico.");
      handleClose(false);
    } catch (err) {
      console.error(err);
      // toast já tratado nos hooks
    }
  };

  const confiancaBadge = () => {
    if (!estrutura) return null;
    const map = {
      alta: { label: "Alta confiança", cls: "bg-green-100 text-green-800 border-green-300" },
      media: { label: "Média confiança", cls: "bg-yellow-100 text-yellow-800 border-yellow-300" },
      baixa: { label: "Baixa confiança", cls: "bg-red-100 text-red-800 border-red-300" },
    };
    const c = map[estrutura.nivel_confianca];
    return <Badge variant="outline" className={c.cls}>{c.label}</Badge>;
  };

  const podeSalvar = estrutura && estrutura.nivel_confianca !== "baixa" &&
    !estrutura.alertas.some((a) => a.severidade === "erro");

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Cadastro Inteligente de Escala
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Etapa 1 - Captura */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <Label className="flex items-center gap-2 font-medium">
                <FileText className="w-4 h-4" /> Descreva a jornada de trabalho
              </Label>
              <Textarea
                placeholder='Ex: "Trabalhamos de segunda a sexta, das 07:54 às 12:00 e 13:30 às 18:00, e no segundo sábado do mês das 08:00 às 12:00."'
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={4}
                disabled={interpretando || transcrevendo}
              />
              <div className="flex items-center gap-2 flex-wrap">
                {!gravando ? (
                  <Button
                    variant="outline" size="sm" onClick={startGravacao}
                    disabled={transcrevendo || interpretando}
                  >
                    <Mic className="w-4 h-4 mr-2" />
                    {transcrevendo ? "Transcrevendo..." : "Gravar áudio"}
                  </Button>
                ) : (
                  <Button variant="destructive" size="sm" onClick={stopGravacao}>
                    <Square className="w-4 h-4 mr-2" /> Parar gravação
                  </Button>
                )}
                {transcrevendo && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                <div className="flex-1" />
                <Button onClick={interpretar} disabled={interpretando || transcrevendo || !descricao.trim()}>
                  {interpretando ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Interpretando...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" /> Interpretar com IA</>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                💡 Após a interpretação, você poderá revisar e ajustar os campos antes de salvar.
              </p>
            </CardContent>
          </Card>

          {/* Etapa 2 - Prévia */}
          {estrutura && (
            <>
              <Card className="border-primary/30">
                <CardContent className="pt-4 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold">Entendimento do sistema</h3>
                    </div>
                    {confiancaBadge()}
                  </div>
                  <p className="text-sm text-muted-foreground italic">
                    {estrutura.resumo_interpretacao}
                  </p>

                  <Separator />

                  {/* Campos editáveis */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Nome da escala</Label>
                      <Input
                        value={estrutura.nome_sugerido}
                        onChange={(e) => setEstrutura({ ...estrutura, nome_sugerido: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Tipo</Label>
                      <Input value={estrutura.tipo} readOnly className="bg-muted" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Hora entrada</Label>
                      <Input
                        type="time"
                        value={estrutura.hora_entrada_padrao}
                        onChange={(e) => setEstrutura({ ...estrutura, hora_entrada_padrao: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Hora saída</Label>
                      <Input
                        type="time"
                        value={estrutura.hora_saida_padrao}
                        onChange={(e) => setEstrutura({ ...estrutura, hora_saida_padrao: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Jornada diária (min)</Label>
                      <Input
                        type="number"
                        value={estrutura.jornada_diaria_minutos}
                        onChange={(e) => setEstrutura({ ...estrutura, jornada_diaria_minutos: +e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">{formatMin(estrutura.jornada_diaria_minutos)}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Jornada semanal (min)</Label>
                      <Input
                        type="number"
                        value={estrutura.jornada_semanal_minutos}
                        onChange={(e) => setEstrutura({ ...estrutura, jornada_semanal_minutos: +e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">{formatMin(estrutura.jornada_semanal_minutos)}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Intervalo intrajornada (min)</Label>
                      <Input
                        type="number"
                        value={estrutura.intervalo_intrajornada_minutos}
                        onChange={(e) => setEstrutura({ ...estrutura, intervalo_intrajornada_minutos: +e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-6 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={estrutura.sabado_util}
                        onCheckedChange={(v) => setEstrutura({ ...estrutura, sabado_util: v })}
                      />
                      <Label className="text-sm">Sábado útil (semanal)</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={estrutura.domingo_util}
                        onCheckedChange={(v) => setEstrutura({ ...estrutura, domingo_util: v })}
                      />
                      <Label className="text-sm">Domingo útil</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={estrutura.tem_adicional_noturno}
                        onCheckedChange={(v) => setEstrutura({ ...estrutura, tem_adicional_noturno: v })}
                      />
                      <Label className="text-sm">Adicional noturno</Label>
                    </div>
                  </div>

                  {/* Grade semanal */}
                  {estrutura.periodos_diarios?.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Grade semanal interpretada</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                          {estrutura.periodos_diarios.map((p, i) => (
                            <div key={i} className="text-sm border rounded-md p-2 bg-muted/30">
                              <span className="font-medium">{DIAS_LABEL[p.dia_semana] || p.dia_semana}: </span>
                              <span className="font-mono text-xs">
                                {p.blocos.map((b) => `${b.inicio}–${b.fim}`).join(" / ")}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Recorrências */}
                  {estrutura.recorrencias && estrutura.recorrencias.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                          🔁 Recorrências e exceções
                        </Label>
                        <div className="space-y-1 mt-2">
                          {estrutura.recorrencias.map((r, i) => (
                            <div key={i} className="text-sm border rounded-md p-2 bg-blue-50 dark:bg-blue-950/30">
                              {r.descricao}
                              {r.hora_inicio && r.hora_fim && (
                                <span className="font-mono text-xs ml-2">({r.hora_inicio}–{r.hora_fim})</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Alertas */}
                  {estrutura.alertas?.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Alertas</Label>
                        {estrutura.alertas.map((a, i) => {
                          const Icon = a.severidade === "erro" ? AlertTriangle : a.severidade === "atencao" ? AlertTriangle : Info;
                          const cls = a.severidade === "erro"
                            ? "bg-red-50 border-red-300 text-red-900 dark:bg-red-950/40 dark:text-red-200"
                            : a.severidade === "atencao"
                            ? "bg-yellow-50 border-yellow-300 text-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-200"
                            : "bg-blue-50 border-blue-300 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200";
                          return (
                            <div key={i} className={`text-sm border rounded-md p-2 flex gap-2 ${cls}`}>
                              <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                              <span>{a.mensagem}</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* Perguntas complementares */}
                  {estrutura.perguntas_complementares && estrutura.perguntas_complementares.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                          ❓ Perguntas para complementar
                        </Label>
                        {estrutura.perguntas_complementares.map((p, i) => (
                          <div key={i} className="text-sm border rounded-md p-2 bg-amber-50 dark:bg-amber-950/30">
                            {p}
                          </div>
                        ))}
                        <p className="text-xs text-muted-foreground">
                          Adicione respostas no campo de descrição acima e clique em "Interpretar" novamente.
                        </p>
                      </div>
                    </>
                  )}

                  {/* Descrição contratual */}
                  <Separator />
                  <div className="space-y-1">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                      <Pencil className="w-3 h-3" /> Descrição contratual gerada
                    </Label>
                    <Textarea
                      value={estrutura.descricao_contratual}
                      onChange={(e) => setEstrutura({ ...estrutura, descricao_contratual: e.target.value })}
                      rows={3}
                      className="text-sm"
                    />
                  </div>
                </CardContent>
              </Card>

              {!podeSalvar && (
                <div className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 rounded-md p-3 flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    {estrutura.nivel_confianca === "baixa"
                      ? "Confiança baixa: revise os campos com cuidado ou complemente a descrição antes de salvar."
                      : "Existem alertas impeditivos. Corrija os campos antes de salvar."}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          {estrutura && (
            <Button onClick={salvarEscala} disabled={criandoEscala || !podeSalvar}>
              {criandoEscala ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : "Confirmar e salvar escala"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
