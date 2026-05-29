import { useState, forwardRef } from "react";
import { Outlet } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AppSidebar } from "./AppSidebar";
import { Header } from "./Header";
import { EmpresaAtivaProvider } from "@/contexts/EmpresaAtivaContext";
import { useIframeNavigation } from "@/hooks/useIframeNavigation";
import { OnboardingGate } from "@/components/auth/OnboardingGate";
import { EmpresaSelecaoObrigatoria } from "@/components/auth/EmpresaSelecaoObrigatoria";
import { useIsMobile } from "@/hooks/use-mobile";
import { HumorCheckInPopup } from "@/components/humor/HumorCheckInPopup";

export const MainLayout = forwardRef<HTMLDivElement>((_, ref) => {
  useIframeNavigation();
  const isMobile = useIsMobile();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <EmpresaAtivaProvider>
      <div ref={ref} className="min-h-screen bg-background">
        {/* Mobile overlay */}
        <AnimatePresence>
          {isMobile && isMobileSidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 z-40"
              onClick={() => setIsMobileSidebarOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Sidebar */}
        {isMobile ? (
          <AnimatePresence>
            {isMobileSidebarOpen && (
              <motion.div
                initial={{ x: -264 }}
                animate={{ x: 0 }}
                exit={{ x: -264 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="fixed left-0 top-0 z-50 h-screen"
              >
                <AppSidebar
                  isCollapsed={false}
                  onToggle={() => setIsMobileSidebarOpen(false)}
                  isMobile
                  onClose={() => setIsMobileSidebarOpen(false)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        ) : (
          <AppSidebar
            isCollapsed={isSidebarCollapsed}
            onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
        )}

        <motion.div
          initial={false}
          animate={{ marginLeft: isMobile ? 0 : isSidebarCollapsed ? 72 : 260 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="min-h-screen flex flex-col"
        >
          <Header
            onMenuToggle={() => setIsMobileSidebarOpen(true)}
            isMobile={isMobile}
            isSidebarCollapsed={isSidebarCollapsed}
            onSidebarToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />

          <main className={isMobile ? "flex-1 p-3" : "flex-1 p-6"}>
            <Outlet />
          </main>
        </motion.div>

        <OnboardingGate />
        <EmpresaSelecaoObrigatoria />
        <HumorCheckInPopup />
      </div>
    </EmpresaAtivaProvider>
  );
});

MainLayout.displayName = "MainLayout";
