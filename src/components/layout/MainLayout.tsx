import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import { AppSidebar } from "./AppSidebar";
import { Header } from "./Header";
import { HumorDiarioPopup } from "@/components/humor/HumorDiarioPopup";
import { useHumorDiario } from "@/hooks/useHumorDiario";

export const MainLayout = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showHumorPopup, setShowHumorPopup] = useState(false);
  const { precisaRegistrarHumor, isLoading } = useHumorDiario();

  // Mostrar popup quando usuário não registrou humor hoje
  useEffect(() => {
    if (!isLoading && precisaRegistrarHumor) {
      setShowHumorPopup(true);
    }
  }, [isLoading, precisaRegistrarHumor]);

  return (
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

      {/* Popup obrigatório de humor do dia */}
      <HumorDiarioPopup 
        open={showHumorPopup} 
        onClose={() => setShowHumorPopup(false)} 
      />
    </div>
  );
};
