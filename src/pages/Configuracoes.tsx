import { useState } from "react";
import { motion } from "framer-motion";
import { Users, Shield, ClipboardList, ShieldCheck, Rocket, ArrowRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EquipeTab } from "@/components/configuracoes/EquipeTab";
import { AuditoriaTab } from "@/components/configuracoes/AuditoriaTab";
import { useAuthContext } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import UsuariosContent from "@/components/configuracoes/UsuariosContent";
import PerfisContent from "@/components/configuracoes/PerfisContent";

export default function Configuracoes() {
  const { hasMinimumRole, profile, isSuperAdmin } = useAuthContext();
  const isAdmin = hasMinimumRole("admin");
  const navigate = useNavigate();

  const needsOnboarding = !!profile && !(profile as any).onboarding_concluido && !isSuperAdmin;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Gerencie sua empresa, equipe e níveis de acesso</p>
      </div>

      {needsOnboarding && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-4 p-4 bg-primary/5 border border-primary/15 rounded-xl"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Rocket className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Configuração inicial pendente</p>
              <p className="text-xs text-muted-foreground">
                Finalize o onboarding para liberar todos os recursos do sistema.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => navigate("/onboarding")} className="gap-1.5 shrink-0">
            Finalizar Configuração
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </motion.div>
      )}

      <Tabs defaultValue="equipe">
        <TabsList>
          <TabsTrigger value="equipe" className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Equipe</span>
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="usuarios" className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Usuários</span>
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="perfis" className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Perfis & Acessos</span>
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="auditoria" className="flex items-center gap-1.5">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Auditoria</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="equipe" className="mt-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {isAdmin ? (
              <EquipeTab />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Você não tem permissão para acessar esta seção.</p>
              </div>
            )}
          </motion.div>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="usuarios" className="mt-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <UsuariosContent />
            </motion.div>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="perfis" className="mt-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <PerfisContent />
            </motion.div>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="auditoria" className="mt-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <AuditoriaTab />
            </motion.div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
