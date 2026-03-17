import { motion } from "framer-motion";
import { Plus, Link2, BarChart3, ArrowRight, Brain, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OnboardingEmptyStateProps {
  onNovaCampanha: () => void;
}

const PASSOS = [
  {
    numero: "01",
    icone: Brain,
    titulo: "Crie uma Campanha",
    descricao: "Escolha o instrumento (SIPRO, PHQ-9, etc.) e defina o período. O Assistente te guia na escolha certa.",
    cor: "text-purple-600",
    bgCor: "bg-purple-100",
    bordaCor: "border-purple-200",
    acao: true,
  },
  {
    numero: "02",
    icone: Link2,
    titulo: "Distribua para os Colaboradores",
    descricao: "Envie o link anônimo por WhatsApp, e-mail ou QR Code. Cada resposta é completamente anônima.",
    cor: "text-blue-600",
    bgCor: "bg-blue-100",
    bordaCor: "border-blue-200",
    acao: false,
  },
  {
    numero: "03",
    icone: BarChart3,
    titulo: "Analise os Resultados",
    descricao: "Com mínimo de 5 respostas, o IPS e todos os índices são calculados automaticamente.",
    cor: "text-emerald-600",
    bgCor: "bg-emerald-100",
    bordaCor: "border-emerald-200",
    acao: false,
  },
];

export function OnboardingEmptyState({ onNovaCampanha }: OnboardingEmptyStateProps) {
  return (
    <div className="py-8 space-y-8">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-3"
      >
        <div className="flex justify-center">
          <div className="p-4 rounded-2xl bg-purple-100">
            <Brain className="h-10 w-10 text-purple-600" />
          </div>
        </div>
        <h3 className="text-xl font-bold text-foreground">Bem-vindo à Gestão Psicossocial</h3>
        <p className="text-muted-foreground max-w-md mx-auto text-sm leading-relaxed">
          Monitore o bem-estar da sua equipe com campanhas anônimas e indicadores científicos.
          Comece criando sua primeira campanha — leva menos de 5 minutos.
        </p>
      </motion.div>

      {/* 3 Passos */}
      <div className="grid gap-4 sm:grid-cols-3 max-w-3xl mx-auto">
        {PASSOS.map((passo, idx) => {
          const Icone = passo.icone;
          return (
            <motion.div
              key={passo.numero}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={cn(
                "relative p-5 rounded-xl border-2 bg-background",
                passo.bordaCor
              )}
            >
              {/* Conector */}
              {idx < PASSOS.length - 1 && (
                <div className="hidden sm:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                  <div className="bg-background border border-border rounded-full p-0.5">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg shrink-0", passo.bgCor)}>
                    <Icone className={cn("h-5 w-5", passo.cor)} />
                  </div>
                  <span className={cn("text-xs font-bold uppercase tracking-wider", passo.cor)}>
                    Passo {passo.numero}
                  </span>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-foreground">{passo.titulo}</h4>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{passo.descricao}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* CTA Principal */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex flex-col items-center gap-3"
      >
        <Button
          size="lg"
          onClick={onNovaCampanha}
          className="gap-2 bg-purple-600 hover:bg-purple-700 text-white px-8"
        >
          <Plus className="h-5 w-5" />
          Criar Primeira Campanha
        </Button>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Lock className="h-3 w-3" />
            100% Anônimo
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            Instrumentos Validados
          </span>
          <span>·</span>
          <span>Conformidade NR-01 / ISO 45003</span>
        </div>
      </motion.div>
    </div>
  );
}
