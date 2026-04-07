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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      toast.error("Selecione um arquivo de áudio");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
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
      handleClose();
    } catch {
      toast.error("Erro ao importar competências.");
    } finally {
      setImportando(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setStep("gravar");
    setCompetencias([]);
    setTranscricao("");
    recorder.clearRecording();
  };

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Mic className="w-4 h-4" /> Importar por Áudio
      </Button>

      <input type="file" ref={fileInputRef} className="hidden" accept="audio/*" onChange={handleFileUpload} />

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileAudio className="w-5 h-5" /> Importar Competências por Áudio</DialogTitle>
            <DialogDescription>Grave ou envie um áudio descrevendo as competências da função.</DialogDescription>
          </DialogHeader>

          {step === "gravar" && (
            <div className="flex flex-col items-center gap-6 py-6">
              <div className="bg-warning/10 border border-warning/40 rounded-lg p-4 w-full">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                  <div className="space-y-1.5">
                    <p className="font-semibold text-sm text-foreground">Dicas para uma boa transcrição:</p>
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Use um <strong>microfone de boa qualidade</strong></li>
                      <li>Grave em um <strong>ambiente silencioso</strong></li>
                      <li>Fale de forma <strong>clara e pausada</strong></li>
                    </ul>
                  </div>
                </div>
              </div>

              {!recorder.isRecording && !recorder.audioUrl && (
                <div className="flex flex-col items-center gap-4">
                  <p className="text-sm text-muted-foreground text-center max-w-md">
                    Descreva as competências necessárias para a função. Ex: "Precisa saber operar máquinas, ter boa comunicação..."
                  </p>
                  <div className="flex gap-3">
                    <Button size="lg" className="gap-2" onClick={recorder.startRecording}>
                      <Mic className="w-5 h-5" /> Gravar Áudio
                    </Button>
                    <Button size="lg" variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="w-5 h-5" /> Importar Arquivo
                    </Button>
                  </div>
                </div>
              )}

              {recorder.isRecording && (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-24 h-24 rounded-full bg-destructive/10 flex items-center justify-center animate-pulse">
                    <MicOff className="w-10 h-10 text-destructive" />
                  </div>
                  <div className="text-2xl font-mono font-bold text-foreground">{recorder.formattedDuration}</div>
                  <p className="text-sm text-muted-foreground">Gravando...</p>
                  <Button variant="destructive" size="lg" className="gap-2" onClick={() => recorder.stopRecording()}>
                    <Square className="w-4 h-4" /> Parar Gravação
                  </Button>
                </div>
              )}

              {recorder.audioUrl && !recorder.isRecording && (
                <div className="flex flex-col items-center gap-4 w-full max-w-md">
                  <audio controls src={recorder.audioUrl} className="w-full" />
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => recorder.clearRecording()}>Descartar</Button>
                    <Button className="gap-2" onClick={async () => {
                      const base64 = await recorder.getBase64();
                      if (base64) await processarAudio(base64);
                    }}>
                      Processar com IA
                    </Button>
                  </div>
                </div>
              )}

              {recorder.error && <p className="text-sm text-destructive">{recorder.error}</p>}
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
