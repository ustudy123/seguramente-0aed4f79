import { Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, Users, FileCheck, HardHat, Calendar, Clock } from "lucide-react";

export function AuthLayout() {
  const features = [
    { icon: Users, text: "Gestão de Colaboradores" },
    { icon: Clock, text: "Controle de Ponto" },
    { icon: Calendar, text: "Férias e Afastamentos" },
    { icon: HardHat, text: "EPIs e Segurança" },
    { icon: FileCheck, text: "Documentos e Admissão" },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-[55%] bg-gradient-to-br from-primary via-primary to-primary/90 p-12 flex-col justify-between relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        
        {/* Logo */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 relative z-10"
        >
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/30">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <span className="text-3xl font-bold text-white tracking-tight">Seguramente</span>
        </motion.div>
        
        {/* Main content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative z-10 space-y-8"
        >
          <div>
            <h1 className="text-5xl font-bold text-white mb-4 leading-tight">
              Gestão de Pessoas
              <br />
              <span className="text-white/90">Simples e Segura</span>
            </h1>
            <p className="text-white/80 text-xl max-w-md">
              Tudo o que sua empresa precisa para gerenciar colaboradores em uma única plataforma inteligente.
            </p>
          </div>
          
          {/* Features grid */}
          <div className="grid grid-cols-2 gap-4 max-w-md">
            {features.map((feature, index) => (
              <motion.div
                key={feature.text}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/20"
              >
                <feature.icon className="w-5 h-5 text-white/90" />
                <span className="text-white/90 text-sm font-medium">{feature.text}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
        
        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="relative z-10"
        >
          <p className="text-white/50 text-sm">
            © 2024 Seguramente. Todos os direitos reservados.
          </p>
        </motion.div>
      </div>
      
      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-gradient-to-br from-background via-background to-muted/20">
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
