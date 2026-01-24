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
import { HUMOR_OPTIONS, useHumorDiario } from "@/hooks/useHumorDiario";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface HumorDiarioPopupProps {
  open: boolean;
  onClose: () => void;
}

export function HumorDiarioPopup({ open, onClose }: HumorDiarioPopupProps) {
  const [selectedHumor, setSelectedHumor] = useState<string | null>(null);
  const { registrarHumor, atualizarHumor, isAtualizacao, humorHoje } = useHumorDiario();

  const handleSelectHumor = async () => {
    if (!selectedHumor) {
      toast.error("Selecione como você está se sentindo");
      return;
    }

    const option = HUMOR_OPTIONS.find((h) => h.id === selectedHumor);
    if (!option) return;

    try {
      if (isAtualizacao) {
        // Atualizar registro existente
        await atualizarHumor.mutateAsync({
          humor: option.id,
          emoji: option.emoji,
          motivo: "Check-in periódico (6h)",
        });
        toast.success("Humor atualizado! 🎉");
      } else {
        // Primeiro registro do dia
        await registrarHumor.mutateAsync({
          humor: option.id,
          emoji: option.emoji,
        });
        toast.success("Humor registrado com sucesso! 🎉");
      }
      setSelectedHumor(null);
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
          onClick={handleSelectHumor}
          disabled={!selectedHumor || isPending}
          className="w-full"
          size="lg"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {isAtualizacao ? "Atualizando..." : "Registrando..."}
            </>
          ) : (
            "Confirmar"
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
