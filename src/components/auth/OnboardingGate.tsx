import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { Rocket, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const DELAY_MS = 90_000; // 1 minute 30 seconds

/**
 * OnboardingGate — renders a blocking full-screen modal after 90s
 * if the authenticated user hasn't completed onboarding yet.
 * Redirects to the full onboarding portal (/onboarding-cliente/:token).
 */
export function OnboardingGate() {
  const { profile, isSuperAdmin } = useAuthContext();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const needsOnboarding =
    !!profile &&
    !(profile as any).onboarding_concluido &&
    !isSuperAdmin;

  useEffect(() => {
    if (!needsOnboarding) {
      setShowModal(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    timerRef.current = setTimeout(() => {
      setShowModal(true);
    }, DELAY_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [needsOnboarding]);

  const handleGoToOnboarding = () => {
    const token = (profile as any)?.onboarding_token;
    if (token) {
      navigate(`/onboarding-cliente/${token}`);
    } else {
      // Fallback to internal onboarding if no token available
      navigate("/onboarding");
    }
  };

  return (
    <AnimatePresence>
      {showModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 30 }}
            className="max-w-lg w-full mx-4 bg-card border border-border rounded-2xl shadow-2xl p-8 text-center space-y-6"
          >
            <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Rocket className="w-8 h-8 text-primary" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">
                Complete a configuração
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Para liberar o acesso completo ao sistema, finalize a configuração inicial
                da sua empresa. São poucos passos e leva apenas alguns minutos.
              </p>
            </div>

            <Button
              size="lg"
              className="w-full gap-2"
              onClick={handleGoToOnboarding}
            >
              Iniciar Configuração
              <ArrowRight className="w-4 h-4" />
            </Button>

            <p className="text-xs text-muted-foreground">
              Esta etapa é obrigatória para utilizar o sistema.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
