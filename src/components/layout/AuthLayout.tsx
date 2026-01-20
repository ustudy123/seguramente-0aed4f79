import { Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2 } from "lucide-react";

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary p-12 flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-foreground/20 rounded-xl flex items-center justify-center">
            <Building2 className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold text-primary-foreground">RH360</span>
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h1 className="text-4xl font-bold text-primary-foreground mb-4">
            Gestão de RH completa para sua empresa
          </h1>
          <p className="text-primary-foreground/80 text-lg">
            Admissão, ponto, férias, documentos, EPIs e muito mais em uma única plataforma.
          </p>
        </motion.div>
        
        <p className="text-primary-foreground/60 text-sm">
          © 2024 RH360. Todos os direitos reservados.
        </p>
      </div>
      
      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md"
        >
          <Outlet />
        </motion.div>
      </div>
    </div>
  );
}
