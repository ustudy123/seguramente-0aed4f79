import { useState, useEffect, useRef } from "react";
import { Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import { AppSidebar } from "./AppSidebar";
import { Header } from "./Header";
import { HumorDiarioPopup } from "@/components/humor/HumorDiarioPopup";
import { useHumorDiario } from "@/hooks/useHumorDiario";
import { EmpresaAtivaProvider } from "@/contexts/EmpresaAtivaContext";
import { useIframeNavigation } from "@/hooks/useIframeNavigation";

export const MainLayout = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showHumorPopup, setShowHumorPopup] = useState(false);
  const { precisaRegistrarHumor, isLoading, marcarMorningVisto, marcarMiddayVisto, isAtualizacao } = useHumorDiario();
  // Use ref to trigger popup only once per "need" transition (false → true)
  const popupShownRef = useRef(false);

  useEffect(() => {
    if (!isLoading && precisaRegistrarHumor && !popupShownRef.current) {
      popupShownRef.current = true;
      setShowHumorPopup(true);
    }
    // Reset the ref when no longer needed so next occasion can fire
    if (!isLoading && !precisaRegistrarHumor) {
      popupShownRef.current = false;
    }
  }, [isLoading, precisaRegistrarHumor]);

  const handleHumorClose = () => {
    // Mark the appropriate occasion as shown so it won't fire again today
    if (isAtualizacao) {
      marcarMiddayVisto();
    } else {
      marcarMorningVisto();
    }
    setShowHumorPopup(false);
  };

  return (
    <EmpresaAtivaProvider>
      <div className="min-h-screen bg-background">
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

        {/* Popup obrigatório de humor do dia — sem botão fechar quando automático */}
        <HumorDiarioPopup 
          open={showHumorPopup} 
          onClose={handleHumorClose}
          isAutomatic
        />
      </div>
    </EmpresaAtivaProvider>
  );
};
