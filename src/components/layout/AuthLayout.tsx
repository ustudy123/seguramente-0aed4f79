import { Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import { Logo } from "@/components/ui/Logo";
import authBg from "@/assets/auth-bg.jpg";
import brandingLogo from "@/assets/logo-seguramente-branding.png";

export function AuthLayout() {
  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6">
      {/* Background image with purple overlay */}
      <div className="absolute inset-0 z-0">
        <img src={authBg} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(262,40%,15%/0.92)] via-[hsl(262,35%,18%/0.9)] to-[hsl(280,30%,12%/0.95)]" />
      </div>

      {/* Decorative wave shapes */}
      <div className="absolute inset-0 z-[1] overflow-hidden pointer-events-none">
        <div className="absolute -bottom-10 left-0 right-0 h-40 bg-[hsl(262,40%,22%/0.4)] rounded-[100%_100%_0_0] blur-sm" />
        <div className="absolute top-0 -left-20 w-96 h-96 bg-[hsl(24,90%,54%/0.08)] rounded-full blur-3xl" />
        <div className="absolute bottom-0 -right-20 w-80 h-80 bg-[hsl(262,50%,50%/0.1)] rounded-full blur-3xl" />
      </div>

      {/* Content container */}
      <div className="relative z-10 w-full max-w-5xl flex flex-col lg:flex-row items-center gap-8 lg:gap-16">
        {/* Left - Branding text */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="flex-1 text-center lg:text-left hidden lg:block"
        >
          <div className="bg-[hsl(262,40%,10%/0.75)] backdrop-blur-md rounded-2xl p-8 space-y-6">
            <div className="space-y-3">
              <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight drop-shadow-lg">
                Gestão de Pessoas
                <br />
                <span className="text-[hsl(24,90%,60%)]">Simples e Segura</span>
              </h1>
              <p className="text-white/90 text-lg max-w-md drop-shadow">
                Tudo o que sua empresa precisa para gerenciar colaboradores em uma única plataforma inteligente.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 max-w-md">
              {["Admissão Digital", "Controle de Ponto", "Gestão de EPIs", "Férias e Afastamentos", "Saúde Ocupacional", "Avaliação de Desempenho", "Gestão de Benefícios", "Cultura & Celebrações", "Ouvidoria", "Análise SWOT", "Gestão de Terceiros", "Treinamentos"].map((item, i) => (
                <motion.span
                  key={item}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  className="px-3 py-1.5 bg-white/15 backdrop-blur-sm border border-white/30 rounded-full text-white text-sm font-medium"
                >
                  {item}
                </motion.span>
              ))}
            </div>

            <p className="text-white/60 text-xs pt-4">© 2026 Seguramente. Todos os direitos reservados.</p>
          </div>
        </motion.div>

        {/* Right - Form card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 sm:p-8 lg:p-10"
        >
          <Outlet />
        </motion.div>
      </div>
    </div>
  );
}
