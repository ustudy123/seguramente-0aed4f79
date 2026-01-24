import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  HUMOR_OPTIONS, 
  useHumorDiario, 
  getMicroPerguntaDoDia,
  type MicroPergunta 
} from "@/hooks/useHumorDiario";
import { toast } from "sonner";
import { Loader2, ChevronRight, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";

interface HumorDiarioPopupProps {
  open: boolean;
  onClose: () => void;
}

type Step = "humor" | "micropergunta";

export function HumorDiarioPopup({ open, onClose }: HumorDiarioPopupProps) {
  const [step, setStep] = useState<Step>("humor");
  const [selectedHumor, setSelectedHumor] = useState<string | null>(null);
  const [microPerguntaResposta, setMicroPerguntaResposta] = useState<string | null>(null);
  const { registrarHumor, atualizarHumor, isAtualizacao } = useHumorDiario();

  const microPergunta: MicroPergunta = getMicroPerguntaDoDia();

  const handleNextStep = () => {
    if (!selectedHumor) {
      toast.error("Selecione como você está se sentindo");
      return;
    }
    setStep("micropergunta");
  };

  const handleSubmit = async (skipMicroPergunta = false) => {
    if (!selectedHumor) return;

    const option = HUMOR_OPTIONS.find((h) => h.id === selectedHumor);
    if (!option) return;

    try {
      const payload = {
        humor: option.id,
        emoji: option.emoji,
        micropergunta_tipo: skipMicroPergunta ? undefined : microPergunta.id,
        micropergunta_resposta: skipMicroPergunta ? undefined : microPerguntaResposta || undefined,
      };

      if (isAtualizacao) {
        await atualizarHumor.mutateAsync({
          ...payload,
          motivo: "Check-in periódico (6h)",
        });
        toast.success("Humor atualizado! 🎉");
      } else {
        await registrarHumor.mutateAsync(payload);
        toast.success("Humor registrado com sucesso! 🎉");
      }
      
      // Reset state
      setSelectedHumor(null);
      setMicroPerguntaResposta(null);
      setStep("humor");
      onClose();
    } catch (error) {
      toast.error("Erro ao registrar humor");
    }
  };

  const isPending = registrarHumor.isPending || atualizarHumor.isPending;

  // Determinar saudação baseada na hora
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia! ☀️" : hora < 18 ? "Boa tarde! 🌤️" : "Boa noite! 🌙";
  
  const mensagem = isAtualizacao 
    ? "Como você está se sentindo agora?" 
    : "Como você está se sentindo hoje?";

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-lg" 
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <AnimatePresence mode="wait">
          {step === "humor" ? (
            <motion.div
              key="humor-step"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <DialogHeader className="text-center">
                <DialogTitle className="text-2xl font-bold text-center">
                  {saudacao}
                </DialogTitle>
                <DialogDescription className="text-center text-base">
                  {mensagem}
                </DialogDescription>
              </DialogHeader>

              <div className="py-4">
                <div className="flex flex-wrap justify-center gap-3">
                  {HUMOR_OPTIONS.map((option) => (
                    <motion.button
                      key={option.id}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedHumor(option.id)}
                      className={cn(
                        "flex flex-col items-center gap-1 p-3 rounded-xl transition-all border-2",
                        selectedHumor === option.id
                          ? "border-primary bg-primary/10 shadow-lg"
                          : "border-transparent hover:bg-muted"
                      )}
                    >
                      <span className="text-3xl">{option.emoji}</span>
                      <span className="text-xs font-medium text-muted-foreground">
                        {option.label}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>

              <AnimatePresence>
                {selectedHumor && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="text-center mb-2"
                  >
                    <p className="text-sm text-muted-foreground">
                      Você selecionou:{" "}
                      <span className="font-semibold text-foreground">
                        {HUMOR_OPTIONS.find((h) => h.id === selectedHumor)?.label}
                      </span>
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <Button
                onClick={handleNextStep}
                disabled={!selectedHumor}
                className="w-full"
                size="lg"
              >
                Continuar
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="micropergunta-step"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <DialogHeader className="text-center">
                <DialogTitle className="text-xl font-bold text-center">
                  Uma pergunta rápida 💭
                </DialogTitle>
                <DialogDescription className="text-center text-base mt-2">
                  {microPergunta.pergunta}
                </DialogDescription>
              </DialogHeader>

              <div className="py-6">
                <div className="flex flex-wrap justify-center gap-3">
                  {microPergunta.opcoes.map((opcao) => (
                    <motion.button
                      key={opcao.value}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setMicroPerguntaResposta(opcao.value)}
                      className={cn(
                        "px-6 py-3 rounded-xl transition-all border-2 font-medium",
                        microPerguntaResposta === opcao.value
                          ? "border-primary bg-primary/10 text-primary shadow-lg"
                          : "border-border hover:bg-muted text-foreground"
                      )}
                    >
                      {opcao.label}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => handleSubmit(true)}
                  disabled={isPending}
                  className="flex-1"
                  size="lg"
                >
                  <SkipForward className="w-4 h-4 mr-2" />
                  Pular
                </Button>
                <Button
                  onClick={() => handleSubmit(false)}
                  disabled={isPending}
                  className="flex-1"
                  size="lg"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Confirmar"
                  )}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center mt-3">
                Esta pergunta é opcional e ajuda a melhorar seu ambiente de trabalho
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
