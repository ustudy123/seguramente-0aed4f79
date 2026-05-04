import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ShieldAlert,
  Moon,
  Flame,
  Battery,
  Eye,
  BrainCircuit,
  Lock,
  TrendingDown,
  TrendingUp,
  Minus,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { CampanhaPsicossocial } from "@/types/psicossocial";

const MINIMO_ANONIMATO = 5;

interface IndiceConfig {
  codigo: string;
  nome: string;
  descricao: string;
  icon: React.ElementType;
  /** Campo no objeto campanha */
  campo: keyof CampanhaPsicossocial;
  /** true = escala de risco (maior = pior), false = escala de proteção (maior = melhor) */
  invertido: boolean;
}

const INDICES: IndiceConfig[] = [
  {
    codigo: "IRP-S",
    nome: "Risco Psicossocial",
    descricao: "Exposição geral a fatores de risco",
    icon: ShieldAlert,
    campo: "irps_score",
    invertido: true,
  },
  {
    codigo: "IBO-S",
    nome: "Burnout",
    descricao: "Esgotamento profissional",
    icon: Flame,
    campo: "ibo_score",
    invertido: true,
  },
  {
    codigo: "IBD-S",
    nome: "Boreout",
    descricao: "Desengajamento e subcarga",
    icon: Battery,
    campo: "ibd_score",
    invertido: true,
  },
  {
    codigo: "IREC-S",
    nome: "Recuperação",
    descricao: "Capacidade de descanso pós-trabalho",
    icon: Eye,
    campo: "irec_score",
    invertido: true,
  },
  {
    codigo: "ICOP-S",
    nome: "Clareza Organizacional",
    descricao: "Clareza de papéis e direcionamento",
    icon: BrainCircuit,
    campo: "icop_score",
    invertido: true,
  },
  {
    codigo: "INOT-S",
    nome: "Trabalho Noturno",
    descricao: "Risco específico do trabalho noturno/3º turno",
    icon: Moon,
    campo: "inot_score",
    invertido: true,
  },
];

type Semaforo = "saudavel" | "atencao" | "moderado" | "elevado";

function classificar(score: number): Semaforo {
  if (score <= 24) return "saudavel";
  if (score <= 49) return "atencao";
  if (score <= 74) return "moderado";
  return "elevado";
}

const SEMAFORO_CONFIG: Record<Semaforo, { label: string; bg: string; text: string; dot: string }> = {
  saudavel: { label: "Favorável", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  atencao:  { label: "Atenção",   bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-500"   },
  moderado: { label: "Moderado",  bg: "bg-orange-50",  text: "text-orange-700",  dot: "bg-orange-500"  },
  elevado:  { label: "Elevado",   bg: "bg-red-50",     text: "text-red-700",     dot: "bg-red-500"     },
};

interface Props {
  campanhas: CampanhaPsicossocial[];
}

export function IndicesDerivadosDashboard({ campanhas }: Props) {
  const [filtroCampanha, setFiltroCampanha] = useState<string>("recente");

  const validas = useMemo(() => {
    return campanhas.filter(
      (c) => (c.total_respostas || 0) >= MINIMO_ANONIMATO
    ).sort((a, b) => new Date(b.data_fim || b.created_at).getTime() - new Date(a.data_fim || a.created_at).getTime());
  }, [campanhas]);

  const dados = useMemo(() => {
    if (validas.length === 0) return null;

    let atual: CampanhaPsicossocial;
    let anterior: CampanhaPsicossocial | null = null;

    if (filtroCampanha === "recente") {
      // Priorizar campanhas encerradas, senão pegar a mais recente
      const encerradas = validas.filter(c => c.status === "encerrada");
      atual = encerradas.length > 0 ? encerradas[0] : validas[0];
      
      const indexAtual = validas.findIndex(c => c.id === atual.id);
      anterior = validas.length > indexAtual + 1 ? validas[indexAtual + 1] : null;
    } else {
      atual = validas.find(c => c.id === filtroCampanha) || validas[0];
      const indexAtual = validas.findIndex(c => c.id === atual.id);
      anterior = validas.length > indexAtual + 1 ? validas[indexAtual + 1] : null;
    }

    return INDICES.map((idx) => {
      const scoreAtual = (atual[idx.campo] as number | null) ?? null;
      const scoreAnterior = anterior ? ((anterior[idx.campo] as number | null) ?? null) : null;

      let tendencia: "up" | "down" | "stable" | null = null;
      if (scoreAtual != null && scoreAnterior != null) {
        const diff = scoreAtual - scoreAnterior;
        if (Math.abs(diff) < 3) tendencia = "stable";
        else if (idx.invertido) {
          // Escala de risco: subiu = piorou, desceu = melhorou
          tendencia = diff > 0 ? "up" : "down";
        } else {
          tendencia = diff > 0 ? "down" : "up";
        }
      }

      return {
        ...idx,
        score: scoreAtual,
        scoreAnterior,
        classificacao: scoreAtual != null ? classificar(scoreAtual) : null,
        tendencia,
      };
    });
  }, [campanhas]);

  if (!dados) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
          <div className="p-3 rounded-full bg-muted">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Os índices derivados serão exibidos após a primeira campanha encerrada com mín. {MINIMO_ANONIMATO} respostas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-purple-600" />
        <h3 className="font-semibold text-base">Índices Derivados SIPRO</h3>
        <Badge variant="outline" className="text-xs">Última campanha encerrada</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {dados.map((item, i) => {
          const Icon = item.icon;
          const sem = item.classificacao ? SEMAFORO_CONFIG[item.classificacao] : null;

          return (
            <motion.div
              key={item.codigo}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <Card className={cn(
                "relative overflow-hidden transition-shadow hover:shadow-md",
                sem?.bg || "bg-muted/30"
              )}>
                <CardHeader className="pb-1 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className={cn("text-xs font-bold", sem?.text)}>
                      {item.codigo}
                    </Badge>
                    <Icon className={cn("h-4 w-4", sem?.text || "text-muted-foreground")} />
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-1">
                  {item.score != null ? (
                    <>
                      <div className="flex items-end gap-1.5">
                        <span className={cn("text-3xl font-bold tabular-nums", sem?.text)}>
                          {Math.round(item.score)}
                        </span>
                        <span className="text-xs text-muted-foreground mb-1">/100</span>
                      </div>

                      <div className="flex items-center gap-1.5 mt-1.5">
                        <div className={cn("h-2 w-2 rounded-full", sem?.dot)} />
                        <span className={cn("text-xs font-medium", sem?.text)}>
                          {sem?.label}
                        </span>

                        {item.tendencia && (
                          <span className="ml-auto flex items-center gap-0.5 text-xs text-muted-foreground">
                            {item.tendencia === "up" && (
                              <TrendingUp className="h-3 w-3 text-red-500" />
                            )}
                            {item.tendencia === "down" && (
                              <TrendingDown className="h-3 w-3 text-emerald-500" />
                            )}
                            {item.tendencia === "stable" && (
                              <Minus className="h-3 w-3 text-muted-foreground" />
                            )}
                          </span>
                        )}
                      </div>

                      {/* Barra visual */}
                      <div className="mt-2 h-1.5 w-full rounded-full bg-background/60">
                        <div
                          className={cn("h-full rounded-full transition-all", sem?.dot)}
                          style={{ width: `${Math.min(item.score, 100)}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">Sem dados</p>
                  )}

                  <p className="text-[11px] text-muted-foreground mt-2 leading-tight">
                    {item.descricao}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="font-medium">Escala de risco:</span>
        {Object.entries(SEMAFORO_CONFIG).map(([key, cfg]) => (
          <span key={key} className="flex items-center gap-1">
            <div className={cn("h-2 w-2 rounded-full", cfg.dot)} />
            {cfg.label}
          </span>
        ))}
        <span className="ml-auto flex items-center gap-2">
          <TrendingDown className="h-3 w-3 text-emerald-500" /> Melhorou
          <TrendingUp className="h-3 w-3 text-red-500" /> Piorou
        </span>
      </div>
    </div>
  );
}
