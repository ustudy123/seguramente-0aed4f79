import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Loader2,
  Plus,
  CheckCircle,
  ClipboardList,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePlanoAcao } from "@/hooks/usePlanoAcao";
import type { Manifestacao } from "@/types/ouvidoria";
import { TIPO_MANIFESTACAO_LABELS } from "@/types/ouvidoria";

interface AcaoSugestao {
  titulo: string;
  descricao: string;
  porque: string;
  onde: string;
  como: string;
  tipo: "corretiva" | "preventiva" | "melhoria";
  gravidade: number;
  urgencia: number;
  tendencia: number;
}

interface OuvidoriaAcoesModalProps {
  manifestacao: Manifestacao;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TIPO_LABELS: Record<string, string> = {
  corretiva: "Corretiva",
  preventiva: "Preventiva",
  melhoria: "Melhoria",
};

const TIPO_COLORS: Record<string, string> = {
  corretiva: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  preventiva: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  melhoria: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

function calcPrioridade(g: number, u: number, t: number) {
  const gut = g * u * t;
  if (gut >= 64) return "imediato";
  if (gut >= 27) return "urgente";
  if (gut >= 8) return "medio";
  return "baixo";
}

export function OuvidoriaAcoesModal({
  manifestacao,
  open,
  onOpenChange,
}: OuvidoriaAcoesModalProps) {
  const { createAcao } = usePlanoAcao();
  const [sugestoes, setSugestoes] = useState<AcaoSugestao[]>([]);
  const [loading, setLoading] = useState(false);
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set());
  const [criando, setCriando] = useState(false);
  const [criadas, setCriadas] = useState<Set<number>>(new Set());

  const buscarSugestoes = async () => {
    setLoading(true);
    setSugestoes([]);
    setSelecionadas(new Set());
    setCriadas(new Set());
    try {
      const { data, error } = await supabase.functions.invoke("ai-ouvidoria-acoes", {
        body: {
          tipo: TIPO_MANIFESTACAO_LABELS[manifestacao.tipo],
          assunto: manifestacao.assunto,
          mensagem: manifestacao.mensagem,
        },
      });

      if (error) throw error;
      if (data?.acoes) {
        setSugestoes(data.acoes.slice(0, 5));
      }
    } catch (err) {
      console.error("Erro ao buscar sugestões:", err);
      toast.error("Erro ao gerar sugestões de ações");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelecionada = (idx: number) => {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const criarAcoesSelecionadas = async () => {
    if (selecionadas.size === 0) return;
    setCriando(true);
    const novasCriadas = new Set(criadas);

    for (const idx of selecionadas) {
      if (criadas.has(idx)) continue;
      const s = sugestoes[idx];
      try {
        await createAcao({
          titulo: s.titulo,
          descricao: s.descricao,
          porque: s.porque,
          onde: s.onde,
          como: s.como,
          tipo: s.tipo,
          gravidade: s.gravidade,
          urgencia: s.urgencia,
          tendencia: s.tendencia,
          prioridade: calcPrioridade(s.gravidade, s.urgencia, s.tendencia) as any,
          origem_modulo: "ouvidoria",
          origem_id: manifestacao.id?.match(/^[0-9a-f]{8}-/) ? manifestacao.id : undefined,
          origem_descricao: `${TIPO_MANIFESTACAO_LABELS[manifestacao.tipo]}: ${manifestacao.assunto}`,
          exige_evidencia: false,
        });
        novasCriadas.add(idx);
      } catch (err) {
        console.error("Erro ao criar ação:", err);
      }
    }

    setCriadas(novasCriadas);
    const qtd = novasCriadas.size - criadas.size;
    if (qtd > 0) {
      toast.success(`${qtd} ação(ões) criada(s) no Plano de Ação!`);
    }
    setCriando(false);
  };

  const criarAcaoUnica = async (s: AcaoSugestao, idx: number) => {
    setCriando(true);
    try {
      await createAcao({
        titulo: s.titulo,
        descricao: s.descricao,
        porque: s.porque,
        onde: s.onde,
        como: s.como,
        tipo: s.tipo,
        gravidade: s.gravidade,
        urgencia: s.urgencia,
        tendencia: s.tendencia,
        prioridade: calcPrioridade(s.gravidade, s.urgencia, s.tendencia) as any,
        origem_modulo: "ouvidoria",
        origem_id: manifestacao.id?.match(/^[0-9a-f]{8}-/) ? manifestacao.id : undefined,
        origem_descricao: `${TIPO_MANIFESTACAO_LABELS[manifestacao.tipo]}: ${manifestacao.assunto}`,
        exige_evidencia: false,
      });
      setCriadas((prev) => new Set(prev).add(idx));
      toast.success("Ação criada no Plano de Ação!");
    } catch (err) {
      console.error("Erro ao criar ação:", err);
      toast.error("Erro ao criar ação");
    } finally {
      setCriando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Criar Ações — Plano de Ação
          </DialogTitle>
          <DialogDescription>
            Gere sugestões de ações com IA ou crie manualmente a partir desta manifestação.
          </DialogDescription>
        </DialogHeader>

        {/* Info da manifestação */}
        <div className="p-3 rounded-lg bg-muted/50 border text-sm space-y-1">
          <p className="font-medium">{manifestacao.assunto}</p>
          <p className="text-muted-foreground line-clamp-2">{manifestacao.mensagem}</p>
        </div>

        {/* Botão para gerar sugestões */}
        {sugestoes.length === 0 && !loading && (
          <Button onClick={buscarSugestoes} className="w-full" size="lg">
            <Sparkles className="w-4 h-4 mr-2" />
            Gerar Sugestões com IA
          </Button>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analisando manifestação e gerando sugestões...</p>
          </div>
        )}

        {/* Lista de sugestões */}
        {sugestoes.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Brain className="w-4 h-4 text-primary" />
                {sugestoes.length} sugestão(ões) gerada(s)
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={buscarSugestoes} disabled={loading}>
                  <Sparkles className="w-3 h-3 mr-1" />
                  Regenerar
                </Button>
                {selecionadas.size > 0 && (
                  <Button
                    size="sm"
                    onClick={criarAcoesSelecionadas}
                    disabled={criando}
                  >
                    {criando ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Plus className="w-3 h-3 mr-1" />
                    )}
                    Criar {selecionadas.size} selecionada(s)
                  </Button>
                )}
              </div>
            </div>

            <AnimatePresence>
              {sugestoes.map((s, idx) => {
                const isCriada = criadas.has(idx);
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`p-4 rounded-lg border space-y-2 ${
                      isCriada ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" : "bg-card"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {!isCriada && (
                        <Checkbox
                          checked={selecionadas.has(idx)}
                          onCheckedChange={() => toggleSelecionada(idx)}
                          className="mt-1"
                        />
                      )}
                      {isCriada && (
                        <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium text-sm">{s.titulo}</h4>
                          <Badge className={`text-xs ${TIPO_COLORS[s.tipo]}`}>
                            {TIPO_LABELS[s.tipo]}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            GUT: {s.gravidade * s.urgencia * s.tendencia}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{s.descricao}</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="font-medium">Por quê:</span>{" "}
                            <span className="text-muted-foreground">{s.porque}</span>
                          </div>
                          <div>
                            <span className="font-medium">Onde:</span>{" "}
                            <span className="text-muted-foreground">{s.onde}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="font-medium">Como:</span>{" "}
                            <span className="text-muted-foreground">{s.como}</span>
                          </div>
                        </div>
                      </div>
                      {!isCriada && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => criarAcaoUnica(s, idx)}
                          disabled={criando}
                          className="shrink-0"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Criar
                        </Button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
