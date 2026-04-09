import { useState, useCallback, useEffect } from "react";
import { Mic, Square, Loader2, Save, CheckCircle2, Pencil, X, Sparkles, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ResponsabilidadeFieldProps {
  cargoId: string;
  cargoNome?: string;
  cargoDescricao?: string | null;
  initialValue?: string | null;
  onSaved?: (value: string) => void;
}

export function ResponsabilidadeField({ cargoId, cargoNome, cargoDescricao, initialValue, onSaved }: ResponsabilidadeFieldProps) {
  const [value, setValue] = useState(initialValue || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(!initialValue);
  const queryClient = useQueryClient();
  const { tenantId } = useAuth();

  useEffect(() => {
    setValue(initialValue || "");
    setIsEditing(!initialValue);
  }, [initialValue]);

  const recorder = useAudioRecorder({ maxDuration: 180 });

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const { error } = await fromTable("cargos")
        .update({ responsabilidade: value } as any)
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
    // Wait for MediaRecorder.onstop to fire and process chunks
    await new Promise((res) => setTimeout(res, 1200));

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

  const handleAiAction = useCallback(async (acao: "gerar" | "melhorar") => {
    if (acao === "melhorar" && !value.trim()) {
      toast.error("Digite algum texto primeiro para melhorar.");
      return;
    }

    setIsAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-responsabilidade-funcao", {
        body: {
          cargoNome: cargoNome || "Função",
          descricao: cargoDescricao || "",
          textoAtual: value,
          acao,
          tenantId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const textoGerado = data.texto as string;
      if (textoGerado) {
        setValue(textoGerado);
        toast.success(acao === "gerar" ? "Texto gerado pela IA!" : "Texto melhorado pela IA!");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar com IA");
    } finally {
      setIsAiLoading(false);
    }
  }, [value, cargoNome, cargoDescricao]);

  // ── VIEW MODE ──────────────────────────────────────────────────────────────
  if (!isEditing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Label className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-success" />
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
        <div className="flex items-center gap-2 flex-wrap">

          {/* IA Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 text-xs border-primary/40 text-primary hover:bg-primary/5"
                disabled={isAiLoading || isTranscribing || recorder.isRecording}
              >
                {isAiLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {isAiLoading ? "Processando..." : "IA"}
                {!isAiLoading && <ChevronDown className="w-3 h-3 opacity-60" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onClick={() => handleAiAction("gerar")}
                className="gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-primary" />
                <div>
                  <div className="text-sm font-medium">Gerar com IA</div>
                  <div className="text-xs text-muted-foreground">Cria texto do zero</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleAiAction("melhorar")}
              className="gap-2 cursor-pointer"
              disabled={!value.trim()}
            >
              <Sparkles className="w-4 h-4 text-warning" />
                <div>
                  <div className="text-sm font-medium">Melhorar com IA</div>
                  <div className="text-xs text-muted-foreground">Aprimora o texto atual</div>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Audio record button */}
          {recorder.isRecording ? (
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5 h-8 text-xs"
              onClick={handleStopAndTranscribe}
              disabled={isTranscribing || isAiLoading}
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
              disabled={isTranscribing || isAiLoading}
            >
              <Mic className="w-3.5 h-3.5 text-primary" />
              Gravar Áudio
            </Button>
          )}

          {/* Cancel button */}
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

      {/* AI loading indicator */}
      {isAiLoading && (
        <div className="flex items-center gap-2 text-xs text-primary animate-pulse px-1">
          <Sparkles className="w-3.5 h-3.5" />
          IA processando o texto...
        </div>
      )}

      <Textarea
        placeholder="Descreva a responsabilidade desta função: objetivos, impacto no negócio, área de atuação... Ou use IA para gerar automaticamente, ou grave um áudio."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={5}
        className={cn(
          "resize-none text-sm transition-colors",
          recorder.isRecording && "border-destructive/60",
          isAiLoading && "border-primary/40 bg-primary/5"
        )}
      />

      {recorder.error && (
        <p className="text-xs text-destructive">{recorder.error}</p>
      )}
    </div>
  );
}
