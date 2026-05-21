import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import {
  useHumorDiario,
  HUMOR_OPTIONS,
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
  } = useHumorDiario();

  const [open, setOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [forceOpen, setForceOpen] = useState(false);

  // Listen for reopen event from Header
  useEffect(() => {
    const handler = () => {
      setForceOpen(true);
      setOpen(true);
    };
    window.addEventListener("humor-reopen", handler);
    return () => window.removeEventListener("humor-reopen", handler);
  }, []);

  const shouldShow = forceOpen || (precisaRegistrarHumor && open);

  if (isLoading || !shouldShow) return null;

  const handleSelect = async (label: string, emoji: string) => {
    setSaving(true);
    try {
      if (isAtualizacao) {
        await atualizarHumor.mutateAsync({ humor: label, emoji, motivo: "Check-in de meio de jornada" });
        marcarMiddayVisto();
      } else {
        await registrarHumor.mutateAsync({ humor: label, emoji });
        marcarMorningVisto();
      }
      toast.success("Humor registrado! 💛");
      setOpen(false);
      setForceOpen(false);
    } catch {
      toast.error("Erro ao registrar humor");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    if (isAtualizacao) marcarMiddayVisto();
    else marcarMorningVisto();
    setOpen(false);
    setForceOpen(false);
  };

  return (
    <Dialog open onOpenChange={() => handleSkip()}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden border-0 bg-transparent shadow-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="bg-card rounded-2xl border shadow-2xl overflow-hidden"
        >
          <div className="bg-gradient-to-r from-primary/10 via-accent/10 to-primary/5 px-6 py-5 relative">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-foreground">
                {isAtualizacao ? "Como está agora?" : "Como você está hoje?"}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Esse registro é pessoal e confidencial.
            </p>
          </div>

          <div className="px-6 py-5 grid grid-cols-4 gap-3">
            {HUMOR_OPTIONS.map((opt) => (
              <motion.button
                key={opt.id}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                disabled={saving}
                onClick={() => handleSelect(opt.label, opt.emoji)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/50 transition-all disabled:opacity-50"
              >
                <span className="text-2xl">{opt.emoji}</span>
                <span className="text-[10px] font-medium text-foreground/70">{opt.label}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
