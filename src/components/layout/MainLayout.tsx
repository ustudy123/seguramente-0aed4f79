import { useState, forwardRef } from "react";
import { Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import { AppSidebar } from "./AppSidebar";
import { Header } from "./Header";
import { EmpresaAtivaProvider } from "@/contexts/EmpresaAtivaContext";
import { useIframeNavigation } from "@/hooks/useIframeNavigation";
import { OnboardingGate } from "@/components/auth/OnboardingGate";

export const MainLayout = forwardRef<HTMLDivElement>((_, ref) => {
  useIframeNavigation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <EmpresaAtivaProvider>
      <div ref={ref} className="min-h-screen bg-background">
        <AppSidebar
          isCollapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
        
        <motion.div
          initial={false}
          animate={{ marginLeft: isSidebarCollapsed ? 72 : 260 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="min-h-screen flex flex-col"
        >
          <Header />
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </motion.div>

        {/* Gate de onboarding — bloqueia após 1m30s se não concluído */}
        <OnboardingGate />
      </div>
    </EmpresaAtivaProvider>
  );
});

MainLayout.displayName = "MainLayout";
