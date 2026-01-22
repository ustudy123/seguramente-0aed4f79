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
  const { registrarHumor } = useHumorDiario();

  const handleSelectHumor = async () => {
    if (!selectedHumor) {
      toast.error("Selecione como você está se sentindo hoje");
      return;
    }

    const option = HUMOR_OPTIONS.find((h) => h.id === selectedHumor);
    if (!option) return;

    try {
      await registrarHumor.mutateAsync({
        humor: option.id,
        emoji: option.emoji,
      });
      toast.success("Humor registrado com sucesso! 🎉");
      onClose();
    } catch (error) {
      toast.error("Erro ao registrar humor");
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md" 
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center">
          <DialogTitle className="text-2xl font-bold text-center">
            Bom dia! ☀️
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            Como você está se sentindo hoje?
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-3 py-6">
          {HUMOR_OPTIONS.map((option) => (
            <motion.button
              key={option.id}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedHumor(option.id)}
              className={cn(
                "flex flex-col items-center gap-2 p-3 rounded-xl transition-all border-2",
                selectedHumor === option.id
                  ? "border-primary bg-primary/10 shadow-lg"
                  : "border-transparent hover:bg-muted"
              )}
            >
              <span className="text-4xl">{option.emoji}</span>
              <span className="text-xs font-medium text-muted-foreground">
                {option.label}
              </span>
            </motion.button>
          ))}
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
          disabled={!selectedHumor || registrarHumor.isPending}
          className="w-full"
          size="lg"
        >
          {registrarHumor.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Registrando...
            </>
          ) : (
            "Confirmar"
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
