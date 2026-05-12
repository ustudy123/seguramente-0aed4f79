import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, ChevronDown, ShieldCheck, FileText, Layers, Target, Brain } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Card explicativo do que é PGR, GRO, NR-01 e ISO 45003.
 * Aparece colapsado por padrão e pode ser expandido para leitura completa.
 */
export function ExplicacaoPGRGRO() {
  const [open, setOpen] = useState(false);

  return (
    <Card className="border-purple-200 bg-gradient-to-br from-purple-50/80 via-white to-indigo-50/40">
      <CardContent className="p-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3 text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-purple-600/10 flex items-center justify-center shrink-0">
              <BookOpen className="h-4 w-4 text-purple-700" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Entenda: PGR, GRO, NR-01 e ISO 45003
              </p>
              <p className="text-xs text-muted-foreground truncate">
                Como o inventário psicossocial se conecta ao Programa de Gerenciamento de Riscos da empresa.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="text-[10px] gap-1 bg-white">
              <ShieldCheck className="h-2.5 w-2.5 text-emerald-600" />
              Conformidade
            </Badge>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                open && "rotate-180"
              )}
            />
          </div>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="pt-4 mt-3 border-t border-purple-100 grid gap-3 md:grid-cols-2">
                <ConceitoCard
                  icon={<Layers className="h-3.5 w-3.5" />}
                  sigla="GRO"
                  nome="Gerenciamento de Riscos Ocupacionais"
                  base="NR-01 (item 1.5)"
                  texto="É o processo contínuo de identificar, avaliar, controlar e monitorar os riscos no trabalho — incluindo riscos físicos, químicos, biológicos, ergonômicos e psicossociais. O GRO é a metodologia. O resultado documental dele é o PGR."
                />
                <ConceitoCard
                  icon={<FileText className="h-3.5 w-3.5" />}
                  sigla="PGR"
                  nome="Programa de Gerenciamento de Riscos"
                  base="NR-01 (item 1.5.4)"
                  texto="É o documento (inventário + plano de ação) que registra os riscos da empresa e as medidas para preveni-los. Toda organização precisa de um PGR atualizado. O inventário psicossocial alimenta a parte de riscos psicossociais do PGR."
                />
                <ConceitoCard
                  icon={<Target className="h-3.5 w-3.5" />}
                  sigla="NR-01"
                  nome="Norma Regulamentadora 01"
                  base="MTE — atualizada por Portaria 1.419/2024"
                  texto="Norma brasileira que estabelece o GRO/PGR. Desde maio/2025, exige expressamente a identificação e o controle de riscos psicossociais (estresse, assédio, sobrecarga, etc.) com a mesma estrutura dos demais riscos ocupacionais."
                />
                <ConceitoCard
                  icon={<Brain className="h-3.5 w-3.5" />}
                  sigla="ISO 45003"
                  nome="Saúde Psicológica no Trabalho"
                  base="ISO 45003:2021"
                  texto="Norma internacional que orienta como gerenciar riscos psicossociais dentro do sistema de SST. Lista os fatores (demandas, controle, suporte, relações, mudanças) e serve de referência técnica para o inventário e plano de ação."
                />
              </div>

              <div className="mt-3 p-3 rounded-md bg-white/70 border border-purple-100 text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Como o sistema opera:</strong>{" "}
                cada campanha (SIPRO/COPSOQ) gera scores por dimensão. O sistema cruza o score com o{" "}
                <strong>catálogo de riscos psicossociais</strong> (NR-01 + ISO 45003), classifica em{" "}
                <em>probabilidade × severidade</em>, atribui um <em>grau de risco</em> (Baixo → Crítico) e
                permite enviar ao <strong>GRO</strong> para virar item do <strong>PGR</strong>, com plano
                de ação 5W2H rastreável.
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

interface ConceitoCardProps {
  icon: React.ReactNode;
  sigla: string;
  nome: string;
  base: string;
  texto: string;
}

function ConceitoCard({ icon, sigla, nome, base, texto }: ConceitoCardProps) {
  return (
    <div className="rounded-lg border border-purple-100 bg-white/80 p-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-600 text-white text-[10px] font-bold">
          {icon}
          {sigla}
        </span>
        <p className="text-xs font-semibold text-foreground">{nome}</p>
      </div>
      <p className="text-[10px] font-mono text-purple-700">{base}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{texto}</p>
    </div>
  );
}
