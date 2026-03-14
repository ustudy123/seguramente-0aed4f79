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
} from "@/hooks/useHumorDiario";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface HumorDiarioPopupProps {
  open: boolean;
  onClose: () => void;
  /** When true (automatic popup), hides the close button — user must select a mood */
  isAutomatic?: boolean;
}

export function HumorDiarioPopup({ open, onClose, isAutomatic = false }: HumorDiarioPopupProps) {
  const [selectedHumor, setSelectedHumor] = useState<string | null>(null);
  const { registrarHumor, atualizarHumor, isAtualizacao } = useHumorDiario();

  const handleSubmit = async () => {
    if (!selectedHumor) {
      toast.error("Selecione como você está se sentindo");
      return;
    }

    const option = HUMOR_OPTIONS.find((h) => h.id === selectedHumor);
    if (!option) return;

    try {
      const payload = {
        humor: option.id,
        emoji: option.emoji,
      };

      if (isAtualizacao) {
        await atualizarHumor.mutateAsync({
          ...payload,
          motivo: "Check-in periódico (5h)",
        });
        toast.success("Humor atualizado! 🎉");
      } else {
        await registrarHumor.mutateAsync(payload);
        toast.success("Humor registrado com sucesso! 🎉");
      }
      
      setSelectedHumor(null);
      onClose();
    } catch (error) {
      toast.error("Erro ao registrar humor");
    }
  };

  const isPending = registrarHumor.isPending || atualizarHumor.isPending;

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia! ☀️" : hora < 18 ? "Boa tarde! 🌤️" : "Boa noite! 🌙";
  
  const mensagem = isAtualizacao 
    ? "Como você está se sentindo agora?" 
    : "Como você está se sentindo hoje?";

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className={cn("sm:max-w-lg", isAutomatic && "[&>button:first-child]:hidden")}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <motion.div
          key="humor-step"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
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
            onClick={handleSubmit}
            disabled={!selectedHumor || isPending}
            className="w-full"
            size="lg"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Registrar"
            )}
          </Button>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
