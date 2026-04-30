import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { Rocket, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const DELAY_MS = 20_000; // 20 seconds
const ONBOARDING_SHOWN_KEY = "onboarding_gate_shown";

/**
 * OnboardingGate — renders a blocking full-screen modal after 20s
 * if the authenticated user hasn't completed onboarding yet AND
 * the tenant has no existing data (empresa_cadastro).
 * Users added to already-configured tenants are NOT blocked.
 */
export function OnboardingGate() {
  const { profile, isSuperAdmin } = useAuthContext();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [tenantHasData, setTenantHasData] = useState<boolean | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const profileOnboardingIncomplete =
    !!profile &&
    !(profile as any).onboarding_concluido &&
    !isSuperAdmin;

  const tenantId = (profile as any)?.tenant_id;

  // Check if the tenant already has empresa_cadastro data
  useEffect(() => {
    if (!profileOnboardingIncomplete || !tenantId) {
      setTenantHasData(false);
      return;
    }

    supabase
      .from("empresa_cadastro")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .then(({ count, error }) => {
        if (error) {
          // On error, assume no data (safe default: show gate)
          setTenantHasData(false);
          return;
        }
        const hasData = (count ?? 0) > 0;
        setTenantHasData(hasData);

        // If tenant already has data, auto-mark this user's onboarding as done
        if (hasData) {
          supabase
            .from("profiles")
            .update({ onboarding_concluido: true })
            .eq("user_id", (profile as any).user_id)
            .then(() => {
              localStorage.removeItem(ONBOARDING_SHOWN_KEY);
            });
        }
      });
  }, [profileOnboardingIncomplete, tenantId]);

  const needsOnboarding =
    profileOnboardingIncomplete &&
    tenantHasData === false; // Only block if tenant truly has no data

  useEffect(() => {
    // Wait until the tenant check resolves before deciding anything
    if (profileOnboardingIncomplete && tenantHasData === null) {
      return;
    }

    if (!needsOnboarding) {
      setShowModal(false);
      localStorage.removeItem(ONBOARDING_SHOWN_KEY);
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    // If modal was already shown before (reload/return), show immediately
    const alreadyShown = localStorage.getItem(ONBOARDING_SHOWN_KEY);
    if (alreadyShown) {
      setShowModal(true);
      return;
    }

    timerRef.current = setTimeout(() => {
      localStorage.setItem(ONBOARDING_SHOWN_KEY, "true");
      setShowModal(true);
    }, DELAY_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [needsOnboarding, profileOnboardingIncomplete, tenantHasData]);

  const handleGoToOnboarding = () => {
    const token = (profile as any)?.onboarding_token;
    if (token) {
      navigate(`/onboarding-cliente/${token}`);
    } else {
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
