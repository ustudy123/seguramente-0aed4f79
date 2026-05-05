import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, 
  Lightbulb, 
  FileText, 
  BarChart3, 
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ArrowRight,
  Check,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { usePlanoAcaoIA, type SugestaoAcao, type GUT, type W5H2 } from "@/hooks/usePlanoAcaoIA";
import { usePlanoAcao } from "@/hooks/usePlanoAcao";
import { toast } from "sonner";

interface PlanoAcaoIAAssistantProps {
  onApplySuggestion?: (sugestao: SugestaoAcao) => void;
  onApply5W2H?: (w5h2: W5H2) => void;
  onApplyGUT?: (gut: GUT) => void;
}

const PRIORIDADE_MAP: Record<string, "baixo" | "medio" | "urgente" | "imediato"> = {
  baixa: "baixo",
  media: "medio",
  alta: "urgente",
  urgente: "imediato",
};

export function PlanoAcaoIAAssistant({ 
  onApplySuggestion, 
  onApply5W2H, 
  onApplyGUT 
}: PlanoAcaoIAAssistantProps) {
  const [contexto, setContexto] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<"sugerir" | "5w2h" | "priorizar">("sugerir");
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());
  const [createdIndexes, setCreatedIndexes] = useState<Set<number>>(new Set());
  const [isCreating, setIsCreating] = useState(false);

  const { isLoading, resultado, sugerirAcoes, gerar5W2H, priorizarAcao, limpar } = usePlanoAcaoIA();
  const { createAcao } = usePlanoAcao();

  const handleSugerir = async () => {
    if (!contexto.trim()) return;
    setSelectedIndexes(new Set());
    setCreatedIndexes(new Set());
    await sugerirAcoes(contexto);
  };

  const handleGerar5W2H = async () => {
    if (!titulo.trim()) return;
    await gerar5W2H(titulo, descricao);
  };

  const handlePriorizar = async () => {
    if (!titulo.trim()) return;
    await priorizarAcao(titulo, descricao);
  };

  const toggleSelect = (idx: number) => {
    if (createdIndexes.has(idx)) return;
    setSelectedIndexes(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectAll = () => {
    if (!resultado?.sugestoes) return;
    const allAvailable = resultado.sugestoes
      .map((_, i) => i)
      .filter(i => !createdIndexes.has(i));
    
    const allSelected = allAvailable.every(i => selectedIndexes.has(i));
    if (allSelected) {
      setSelectedIndexes(new Set());
    } else {
      setSelectedIndexes(new Set(allAvailable));
    }
  };

  const handleCriarSelecionadas = async () => {
    if (!resultado?.sugestoes || selectedIndexes.size === 0) return;
    setIsCreating(true);
    let successCount = 0;

    for (const idx of selectedIndexes) {
      const sugestao = resultado.sugestoes[idx];
      if (!sugestao || createdIndexes.has(idx)) continue;

      try {
        const prioridade = PRIORIDADE_MAP[sugestao.prioridade] || "medio";
        const gutScore = prioridade === "imediato" ? 5 : prioridade === "urgente" ? 4 : prioridade === "medio" ? 3 : 2;
        
        await createAcao({
          titulo: sugestao.titulo,
          descricao: sugestao.descricao,
          tipo: sugestao.tipo,
          origem_modulo: "manual",
          origem_descricao: "Gerada via Assistente IA",
          prioridade,
          gravidade: gutScore,
          urgencia: gutScore,
          tendencia: gutScore,
          exige_evidencia: false,
        });
        
        setCreatedIndexes(prev => new Set(prev).add(idx));
        successCount++;
      } catch (err) {
        console.error(`Erro ao criar ação "${sugestao.titulo}":`, err);
      }
    }

    setSelectedIndexes(new Set());
    if (successCount > 0) {
      toast.success(`${successCount} ação(ões) criada(s) com sucesso no Plano de Ação!`);
    }
    setIsCreating(false);
  };

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case "urgente": return "bg-red-500";
      case "alta": return "bg-orange-500";
      case "media": return "bg-yellow-500";
      default: return "bg-green-500";
    }
  };

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case "corretiva": return "text-red-600 bg-red-100";
      case "preventiva": return "text-blue-600 bg-blue-100";
      default: return "text-green-600 bg-green-100";
    }
  };

  const availableCount = resultado?.sugestoes
    ? resultado.sugestoes.filter((_, i) => !createdIndexes.has(i)).length
    : 0;

  return (
    <Card className="relative border-0 overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950 text-white shadow-2xl shadow-indigo-500/20">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-violet-500/10 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
        <div className="absolute top-1/2 right-1/3 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl animate-pulse [animation-delay:2s]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:32px_32px]" />
      </div>

      <CardHeader className="pb-2 relative z-10">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-lg text-white">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-900 animate-pulse" />
            </div>
            <div>
              <span className="bg-gradient-to-r from-white to-indigo-200 bg-clip-text text-transparent font-bold">
                Assistente IA
              </span>
              <p className="text-[10px] font-normal text-indigo-300/80 tracking-widest uppercase mt-0.5">
                Inteligência Artificial
              </p>
            </div>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-indigo-300 hover:text-white hover:bg-white/10"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <CardContent className="space-y-4 relative z-10">
              {/* Tabs removidas */}

              {/* Input Forms */}
              {activeTab === "sugerir" && (
                <div className="space-y-3">
                  <Textarea
                    placeholder="Descreva o problema, risco ou situação para receber sugestões de ações..."
                    value={contexto}
                    onChange={(e) => setContexto(e.target.value)}
                    rows={3}
                    className="bg-white/5 border-white/10 text-white placeholder:text-indigo-300/40 focus:border-indigo-400/50 focus:ring-indigo-400/20"
                  />
                  <Button 
                    onClick={handleSugerir} 
                    disabled={isLoading || !contexto.trim()}
                    className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-0 shadow-lg shadow-indigo-500/25 hover:from-indigo-600 hover:to-violet-700 disabled:opacity-40"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    Gerar Sugestões
                  </Button>
                </div>
              )}




              {/* Results */}
              {resultado && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4 pt-4 border-t border-white/10"
                >
                  {/* Sugestões com seleção múltipla */}
                  {resultado.sugestoes && resultado.sugestoes.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                          <Lightbulb className="h-4 w-4 text-yellow-500" />
                          Ações Sugeridas
                        </h4>
                        {availableCount > 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={selectAll}
                            className="text-indigo-300 hover:text-white hover:bg-white/10 text-xs h-7"
                          >
                            {selectedIndexes.size === availableCount ? "Desmarcar todas" : "Selecionar todas"}
                          </Button>
                        )}
                      </div>

                      {resultado.sugestoes.map((sugestao, idx) => {
                        const isCreated = createdIndexes.has(idx);
                        const isSelected = selectedIndexes.has(idx);

                        return (
                          <div 
                            key={idx}
                            className={`p-3 rounded-lg border transition-all ${
                              isCreated
                                ? "bg-emerald-500/10 border-emerald-500/30 opacity-70 cursor-default"
                                : isSelected
                                ? "bg-indigo-500/15 border-indigo-400/40 shadow-md shadow-indigo-500/10 cursor-pointer"
                                : "bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/20 cursor-pointer"
                            }`}
                            onClick={() => !isCreated && toggleSelect(idx)}
                          >
                            <div className="flex items-start gap-3">
                                <div
                                  className="mt-0.5 shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                {isCreated ? (
                                  <div className="w-5 h-5 rounded bg-emerald-500 flex items-center justify-center">
                                    <Check className="h-3.5 w-3.5 text-white" />
                                  </div>
                                ) : (
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleSelect(idx)}
                                    className="border-white/30 data-[state=checked]:bg-indigo-500 data-[state=checked]:border-indigo-500"
                                  />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <p className={`font-medium text-sm ${isCreated ? "text-emerald-300 line-through" : "text-white"}`}>
                                      {sugestao.titulo}
                                    </p>
                                    <p className="text-xs text-indigo-200/60 mt-1">{sugestao.descricao}</p>
                                  </div>
                                  <div className="flex gap-1 shrink-0">
                                    {isCreated && (
                                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">
                                        ✓ Criada
                                      </Badge>
                                    )}
                                    <Badge className={getTipoColor(sugestao.tipo)} variant="secondary">
                                      {sugestao.tipo}
                                    </Badge>
                                    <Badge className={getPrioridadeColor(sugestao.prioridade)}>
                                      {sugestao.prioridade}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Barra de ação fixa */}
                      {selectedIndexes.size > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center justify-between p-3 rounded-lg bg-indigo-500/20 border border-indigo-400/30"
                        >
                          <p className="text-sm text-indigo-200">
                            <strong>{selectedIndexes.size}</strong> ação(ões) selecionada(s)
                          </p>
                          <Button
                            onClick={handleCriarSelecionadas}
                            disabled={isCreating}
                            size="sm"
                            className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-0 shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-teal-700"
                          >
                            {isCreating ? (
                              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando...</>
                            ) : (
                              <><Plus className="h-4 w-4 mr-2" />Criar {selectedIndexes.size} Ação(ões) no Plano</>
                            )}
                          </Button>
                        </motion.div>
                      )}
                    </div>
                  )}

                  {/* 5W2H */}
                  {resultado.w5h2 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-500" />
                        Metodologia 5W2H
                      </h4>
                      <div className="grid gap-2 text-sm">
                        {[
                          { label: "O quê (What)", value: resultado.w5h2.what },
                          { label: "Por quê (Why)", value: resultado.w5h2.why },
                          { label: "Onde (Where)", value: resultado.w5h2.where },
                          { label: "Quando (When)", value: resultado.w5h2.when },
                          { label: "Quem (Who)", value: resultado.w5h2.who },
                          { label: "Como (How)", value: resultado.w5h2.how },
                          { label: "Quanto (How Much)", value: resultado.w5h2.howMuch },
                        ].map((item, idx) => (
                          <div key={idx} className="p-2 bg-white/5 rounded border border-white/10">
                            <span className="font-medium text-indigo-300">{item.label}:</span>
                            <p className="text-indigo-100/70 mt-1">{item.value}</p>
                          </div>
                        ))}
                      </div>
                      {onApply5W2H && (
                        <Button 
                          size="sm" 
                          onClick={() => onApply5W2H(resultado.w5h2!)}
                          className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-0 shadow-lg shadow-indigo-500/25 hover:from-indigo-600 hover:to-violet-700"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Aplicar 5W2H
                        </Button>
                      )}
                    </div>
                  )}

                  {/* GUT */}
                  {resultado.gut && (
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-purple-500" />
                        Matriz GUT
                      </h4>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-3 bg-white/5 rounded border border-white/10 text-center">
                          <p className="text-xs text-indigo-300/60">Gravidade</p>
                          <p className="text-2xl font-bold text-red-400">{resultado.gut.gravidade}</p>
                        </div>
                        <div className="p-3 bg-white/5 rounded border border-white/10 text-center">
                          <p className="text-xs text-indigo-300/60">Urgência</p>
                          <p className="text-2xl font-bold text-orange-400">{resultado.gut.urgencia}</p>
                        </div>
                        <div className="p-3 bg-white/5 rounded border border-white/10 text-center">
                          <p className="text-xs text-indigo-300/60">Tendência</p>
                          <p className="text-2xl font-bold text-yellow-400">{resultado.gut.tendencia}</p>
                        </div>
                      </div>
                      <div className="p-3 bg-indigo-500/10 rounded-lg text-center border border-indigo-500/20">
                        <p className="text-sm text-indigo-300/60">Pontuação Total</p>
                        <p className="text-3xl font-bold text-indigo-300">{resultado.gut.total}</p>
                        <Progress value={(resultado.gut.total / 125) * 100} className="mt-2" />
                      </div>
                      <p className="text-sm text-indigo-200/60">{resultado.gut.justificativa}</p>
                      {onApplyGUT && (
                        <Button 
                          size="sm" 
                          onClick={() => onApplyGUT(resultado.gut!)}
                          className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-0 shadow-lg shadow-indigo-500/25 hover:from-indigo-600 hover:to-violet-700"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Aplicar Priorização
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Resumo */}
                  {resultado.resumo && (
                    <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                      <p className="text-sm text-indigo-100/80">{resultado.resumo}</p>
                    </div>
                  )}
                </motion.div>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
