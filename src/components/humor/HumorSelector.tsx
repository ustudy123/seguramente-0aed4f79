import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { HUMOR_OPTIONS, useHumorDiario } from "@/hooks/useHumorDiario";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export function HumorSelector() {
  const [open, setOpen] = useState(false);
  const { humorHoje, atualizarHumor, isLoading } = useHumorDiario();

  if (isLoading || !humorHoje) {
    return null;
  }

  const currentOption = HUMOR_OPTIONS.find((h) => h.id === humorHoje.humor);

  const handleSelectHumor = async (humorId: string) => {
    const option = HUMOR_OPTIONS.find((h) => h.id === humorId);
    if (!option || humorId === humorHoje.humor) {
      setOpen(false);
      return;
    }

    try {
      await atualizarHumor.mutateAsync({
        humor: option.id,
        emoji: option.emoji,
      });
      toast.success(`Humor atualizado para ${option.label}!`);
      setOpen(false);
    } catch (error) {
      toast.error("Erro ao atualizar humor");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-2 gap-1 hover:bg-muted/80"
        >
          <motion.span
            key={humorHoje.emoji}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-xl"
          >
            {humorHoje.emoji}
          </motion.span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <div className="space-y-2">
          <p className="text-sm font-medium text-center mb-3">
            Mudar meu humor
          </p>
          <div className="grid grid-cols-4 gap-2">
            {HUMOR_OPTIONS.map((option) => (
              <motion.button
                key={option.id}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSelectHumor(option.id)}
                disabled={atualizarHumor.isPending}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-lg transition-all border-2",
                  humorHoje.humor === option.id
                    ? "border-primary bg-primary/10"
                    : "border-transparent hover:bg-muted"
                )}
              >
                <span className="text-2xl">{option.emoji}</span>
                <span className="text-[10px] font-medium text-muted-foreground leading-tight">
                  {option.label}
                </span>
              </motion.button>
            ))}
          </div>
          {currentOption && (
            <p className="text-xs text-muted-foreground text-center pt-2 border-t">
              Atual: {currentOption.label}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
