import { useState, useCallback, useEffect } from "react";
import { Mic, Square, Loader2, Save, CheckCircle2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useQueryClient } from "@tanstack/react-query";
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
  const [isEditing, setIsEditing] = useState(!initialValue);
  const queryClient = useQueryClient();

  useEffect(() => {
    setValue(initialValue || "");
    // If there's a saved value, show in view mode; otherwise open edit mode
    setIsEditing(!initialValue);
  }, [initialValue]);

  const recorder = useAudioRecorder({ maxDuration: 180 });

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("cargos" as never)
        .update({ responsabilidade: value } as never)
        .eq("id", cargoId);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["cargos"] });

      onSaved?.(value);
      toast.success("Responsabilidade salva!");
      setIsEditing(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setIsSaving(false);
    }
  }, [cargoId, value, onSaved, queryClient]);

  const handleCancel = useCallback(() => {
    setValue(initialValue || "");
    setIsEditing(false);
    recorder.clearRecording?.();
  }, [initialValue, recorder]);

  const handleStopAndTranscribe = useCallback(async () => {
    recorder.stopRecording();
    await new Promise((res) => setTimeout(res, 600));

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

  // ── VIEW MODE ──────────────────────────────────────────────────────────────
  if (!isEditing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Label className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
            Responsabilidade da Função
          </Label>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 h-7 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="w-3 h-3" />
            Editar
          </Button>
        </div>
        <div className="rounded-md border border-border bg-muted/40 px-3 py-3 text-sm text-foreground whitespace-pre-wrap leading-relaxed min-h-[80px]">
          {value || <span className="text-muted-foreground italic">Nenhuma responsabilidade cadastrada.</span>}
        </div>
      </div>
    );
  }

  // ── EDIT MODE ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
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

          {/* Cancel button — only if there's already a saved value */}
          {initialValue && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 h-8 text-xs text-muted-foreground"
              onClick={handleCancel}
              disabled={isSaving}
            >
              <X className="w-3.5 h-3.5" />
              Cancelar
            </Button>
          )}

          {/* Save button */}
          <Button
            size="sm"
            className="gap-1.5 h-8 text-xs"
            onClick={handleSave}
            disabled={isSaving || !value.trim()}
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {isSaving ? "Salvando..." : "Salvar"}
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
          recorder.isRecording && "border-destructive/60"
        )}
      />

      {recorder.error && (
        <p className="text-xs text-destructive">{recorder.error}</p>
      )}
    </div>
  );
}
