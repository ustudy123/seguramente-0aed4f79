import { useState, useRef } from "react";
import { Mic, MicOff, Upload, Loader2, Check, X, FileAudio, Square, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CompetenciaExtraida {
  nome: string;
  tipo: string;
  descricao: string;
  selecionada: boolean;
}

interface AudioCompetenciasImportProps {
  funcaoNome?: string;
  onImportar: (competencias: Omit<CompetenciaExtraida, "selecionada">[]) => Promise<void>;
}

const TIPO_LABELS: Record<string, string> = { tecnica: "Técnica", comportamental: "Comportamental", cognitiva: "Cognitiva" };

export function AudioCompetenciasImport({ funcaoNome, onImportar }: AudioCompetenciasImportProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"gravar" | "processando" | "resultado">("gravar");
  const [competencias, setCompetencias] = useState<CompetenciaExtraida[]>([]);
  const [transcricao, setTranscricao] = useState("");
  const [importando, setImportando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const recorder = useAudioRecorder({ maxDuration: 3600 });

  const processarAudio = async (audioBase64: string) => {
    setStep("processando");
    try {
      const { data, error } = await supabase.functions.invoke("ai-audio-atividades", {
        body: { audioBase64, funcaoNome, tipo: "competencias" },
      });
      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);

      setTranscricao(data.transcricao || "");
      const items = (data.atividades || data.competencias || []).map((c: any) => ({
        nome: c.nome || "",
        tipo: c.tipo || "tecnica",
        descricao: c.descricao || "",
        selecionada: true,
      }));
      setCompetencias(items);
      setStep("resultado");
    } catch (err: any) {
      toast.error("Erro ao processar áudio: " + err.message);
      setStep("gravar");
    }
  };

  const handleStopRecording = async () => {
    const audioBase64 = await recorder.stopRecording();
    if (audioBase64) await processarAudio(audioBase64);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      await processarAudio(base64);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleImportar = async () => {
    const selecionadas = competencias.filter((c) => c.selecionada);
    if (selecionadas.length === 0) return;
    setImportando(true);
    try {
      await onImportar(selecionadas.map(({ selecionada, ...rest }) => rest));
      toast.success(`${selecionadas.length} competência(s) importada(s)!`);
      setOpen(false);
      setStep("gravar");
      setCompetencias([]);
    } catch {
      toast.error("Erro ao importar competências.");
    } finally {
      setImportando(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Mic className="w-4 h-4 mr-1" /> Áudio
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) { setOpen(false); setStep("gravar"); setCompetencias([]); recorder.isRecording && recorder.stopRecording(); } else setOpen(true); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileAudio className="w-5 h-5" /> Importar Competências por Áudio</DialogTitle>
            <DialogDescription>Grave ou envie um áudio descrevendo as competências da função.</DialogDescription>
          </DialogHeader>

          {step === "gravar" && (
            <div className="space-y-4 py-4">
              <div className="flex flex-col items-center gap-4">
                {recorder.isRecording ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center animate-pulse">
                      <Mic className="w-8 h-8 text-destructive" />
                    </div>
                    <p className="text-sm text-muted-foreground">Gravando... {Math.floor(recorder.duration / 60)}:{String(recorder.duration % 60).padStart(2, "0")}</p>
                    <Button variant="destructive" onClick={handleStopRecording}><Square className="w-4 h-4 mr-1" /> Parar</Button>
                  </div>
                ) : (
                  <>
                    <Button size="lg" onClick={() => recorder.startRecording()}><Mic className="w-5 h-5 mr-2" /> Iniciar Gravação</Button>
                    <div className="flex items-center gap-2 text-muted-foreground text-xs"><span>ou</span></div>
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="w-4 h-4 mr-1" /> Enviar Arquivo de Áudio</Button>
                    <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
                  </>
                )}
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground flex gap-2">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Descreva as competências necessárias para a função. Ex: "Precisa saber operar máquinas CNC, ter boa comunicação..."</span>
              </div>
            </div>
          )}

          {step === "processando" && (
            <div className="flex flex-col items-center gap-4 py-12">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Transcrevendo e extraindo competências...</p>
            </div>
          )}

          {step === "resultado" && (
            <div className="space-y-3">
              {transcricao && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">Transcrição do áudio</summary>
                  <p className="mt-1 bg-muted/30 rounded p-2">{transcricao}</p>
                </details>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{competencias.filter(c => c.selecionada).length} de {competencias.length} selecionadas</span>
                <Button variant="ghost" size="sm" onClick={() => setCompetencias(competencias.map(c => ({ ...c, selecionada: !competencias.every(x => x.selecionada) })))}>
                  {competencias.every(c => c.selecionada) ? "Desmarcar todas" : "Selecionar todas"}
                </Button>
              </div>
              <ScrollArea className="max-h-[40vh]">
                <div className="space-y-2">
                  {competencias.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded border bg-card">
                      <Checkbox checked={c.selecionada} onCheckedChange={(v) => { const copy = [...competencias]; copy[i].selecionada = !!v; setCompetencias(copy); }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{c.nome}</span>
                          <Badge variant="outline" className="text-xs">{TIPO_LABELS[c.tipo] || c.tipo}</Badge>
                        </div>
                        {c.descricao && <p className="text-xs text-muted-foreground mt-0.5">{c.descricao}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => { setStep("gravar"); setCompetencias([]); }}>Voltar</Button>
                <Button onClick={handleImportar} disabled={importando || competencias.filter(c => c.selecionada).length === 0}>
                  {importando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                  Importar ({competencias.filter(c => c.selecionada).length})
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
