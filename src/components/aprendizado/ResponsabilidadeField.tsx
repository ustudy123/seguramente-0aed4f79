import { useState, useCallback } from "react";
import { Mic, MicOff, Square, Loader2, Save, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ResponsabilidadeFieldProps {
  cargoId: string;
  initialValue?: string | null;
  onSaved?: (value: string) => void;
}

export function ResponsabilidadeField({ cargoId, initialValue, onSaved }: ResponsabilidadeFieldProps) {
  const [value, setValue] = useState(initialValue || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [saved, setSaved] = useState(false);

  const recorder = useAudioRecorder({ maxDuration: 180 });

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("cargos" as never)
        .update({ responsabilidade: value } as never)
        .eq("id", cargoId);

      if (error) throw error;

      setSaved(true);
      onSaved?.(value);
      toast.success("Responsabilidade salva!");
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setIsSaving(false);
    }
  }, [cargoId, value, onSaved]);

  const handleStopAndTranscribe = useCallback(async () => {
    recorder.stopRecording();

    // Wait a tick for the blob to be set
    await new Promise((res) => setTimeout(res, 400));

    const base64 = await recorder.getBase64();
    if (!base64) {
      toast.error("Áudio não capturado. Tente novamente.");
      return;
    }

    setIsTranscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-transcribe-audio", {
        body: { audioBase64: base64 },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const transcribed = data.text as string;
      setValue((prev) => (prev ? prev + "\n" + transcribed : transcribed));
      recorder.clearRecording();
      toast.success("Áudio transcrito com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao transcrever áudio");
    } finally {
      setIsTranscribing(false);
    }
  }, [recorder]);

  const isDirty = value !== (initialValue || "");

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-foreground">
          Responsabilidade da Função
        </Label>
        <div className="flex items-center gap-2">
          {/* Audio record button */}
          {recorder.isRecording ? (
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5 h-8 text-xs"
              onClick={handleStopAndTranscribe}
              disabled={isTranscribing}
            >
              {isTranscribing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Square className="w-3.5 h-3.5" />
              )}
              {isTranscribing ? "Transcrevendo..." : `Parar ${recorder.formattedDuration}`}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 text-xs"
              onClick={recorder.startRecording}
              disabled={isTranscribing}
            >
              <Mic className="w-3.5 h-3.5 text-primary" />
              Gravar por Áudio
            </Button>
          )}

          {/* Save button */}
          <Button
            size="sm"
            className="gap-1.5 h-8 text-xs"
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            variant={saved ? "outline" : "default"}
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {saved ? "Salvo" : "Salvar"}
          </Button>
        </div>
      </div>

      {/* Recording indicator */}
      {recorder.isRecording && (
        <div className="flex items-center gap-2 text-xs text-destructive animate-pulse px-1">
          <span className="w-2 h-2 rounded-full bg-destructive inline-block" />
          Gravando... {recorder.formattedDuration}
        </div>
      )}

      <Textarea
        placeholder="Descreva a responsabilidade desta função: objetivos, impacto no negócio, área de atuação... Ou grave um áudio para preencher automaticamente."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        className={cn(
          "resize-none text-sm transition-colors",
          recorder.isRecording && "border-destructive/60 bg-destructive/5"
        )}
      />

      {recorder.error && (
        <p className="text-xs text-destructive">{recorder.error}</p>
      )}
    </div>
  );
}
