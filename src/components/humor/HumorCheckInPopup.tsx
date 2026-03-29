import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  useHumorDiario,
  HUMOR_OPTIONS,
  getMicroPerguntaAleatoria,
  type MicroPergunta,
} from "@/hooks/useHumorDiario";
import { toast } from "sonner";

export function HumorCheckInPopup() {
  const {
    isLoading,
    precisaRegistrarHumor,
    isAtualizacao,
    marcarMorningVisto,
    marcarMiddayVisto,
    registrarHumor,
    atualizarHumor,
    humorHoje,
  } = useHumorDiario();

  const [open, setOpen] = useState(true);
  const [selectedHumor, setSelectedHumor] = useState<string | null>(null);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [step, setStep] = useState<"humor" | "micro">("humor");
  const [microPergunta] = useState<MicroPergunta>(() => getMicroPerguntaAleatoria());
  const [microResposta, setMicroResposta] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (isLoading || !precisaRegistrarHumor || !open) return null;

  const handleSelectHumor = (humor: string, emoji: string) => {
    setSelectedHumor(humor);
    setSelectedEmoji(emoji);
    setStep("micro");
  };

  const handleConfirm = async () => {
    if (!selectedHumor || !selectedEmoji) return;
    setSaving(true);
    try {
      if (isAtualizacao) {
        await atualizarHumor.mutateAsync({
          humor: selectedHumor,
          emoji: selectedEmoji,
          motivo: "Check-in de meio de jornada",
          micropergunta_tipo: microResposta ? microPergunta.id : undefined,
          micropergunta_resposta: microResposta || undefined,
        });
        marcarMiddayVisto();
      } else {
        await registrarHumor.mutateAsync({
          humor: selectedHumor,
          emoji: selectedEmoji,
          micropergunta_tipo: microResposta ? microPergunta.id : undefined,
          micropergunta_resposta: microResposta || undefined,
        });
        marcarMorningVisto();
      }
      toast.success("Humor registrado! 💛");
      setOpen(false);
    } catch {
      toast.error("Erro ao registrar humor");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    if (isAtualizacao) {
      marcarMiddayVisto();
    } else {
      marcarMorningVisto();
    }
    setOpen(false);
  };

  return (
    <Dialog open onOpenChange={() => handleSkip()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-0 bg-transparent shadow-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="bg-card rounded-2xl border shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-primary/10 via-accent/10 to-primary/5 px-6 py-5 relative">
            <button
              onClick={handleSkip}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-foreground">
                {isAtualizacao ? "Como está agora?" : "Como você está hoje?"}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isAtualizacao
                ? "Seu humor pode mudar ao longo do dia — e tudo bem."
                : "Esse registro é pessoal e confidencial."}
            </p>
          </div>

          <div className="px-6 py-5">
            <AnimatePresence mode="wait">
              {step === "humor" ? (
                <motion.div
                  key="humor"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="grid grid-cols-4 gap-3"
                >
                  {HUMOR_OPTIONS.map((opt) => (
                    <motion.button
                      key={opt.id}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleSelectHumor(opt.label, opt.emoji)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                        selectedHumor === opt.label
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-border hover:border-primary/30 hover:bg-muted/50"
                      }`}
                    >
                      <span className="text-2xl">{opt.emoji}</span>
                      <span className="text-[10px] font-medium text-foreground/70">{opt.label}</span>
                    </motion.button>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="micro"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  {/* Selected humor preview */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="text-lg">{selectedEmoji}</span>
                    <span>Você está <strong className="text-foreground">{selectedHumor}</strong></span>
                    <button
                      onClick={() => setStep("humor")}
                      className="ml-auto text-xs text-primary hover:underline"
                    >
                      Alterar
                    </button>
                  </div>

                  {/* Micro question */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">{microPergunta.pergunta}</p>
                    <div className="flex flex-wrap gap-2">
                      {microPergunta.opcoes.map((op) => (
                        <button
                          key={op.value}
                          onClick={() => setMicroResposta(op.value)}
                          className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                            microResposta === op.value
                              ? "border-primary bg-primary/10 text-primary font-medium"
                              : "border-border hover:border-primary/30 text-foreground/70"
                          }`}
                        >
                          {op.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleConfirm}
                      disabled={saving}
                      className="text-xs text-muted-foreground"
                    >
                      Pular pergunta
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleConfirm}
                      disabled={saving || !microResposta}
                      className="ml-auto"
                    >
                      {saving ? "Salvando..." : "Confirmar"}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
