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
  AlertTriangle,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { usePlanoAcaoIA, type SugestaoAcao, type GUT, type W5H2 } from "@/hooks/usePlanoAcaoIA";

interface PlanoAcaoIAAssistantProps {
  onApplySuggestion?: (sugestao: SugestaoAcao) => void;
  onApply5W2H?: (w5h2: W5H2) => void;
  onApplyGUT?: (gut: GUT) => void;
}

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

  const { isLoading, resultado, sugerirAcoes, gerar5W2H, priorizarAcao, limpar } = usePlanoAcaoIA();

  const handleSugerir = async () => {
    if (!contexto.trim()) return;
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

  return (
    <Card className="relative border-0 overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950 text-white shadow-2xl shadow-indigo-500/20">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-violet-500/10 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
        <div className="absolute top-1/2 right-1/3 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl animate-pulse [animation-delay:2s]" />
        {/* Grid overlay */}
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
              {/* Tabs */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => { setActiveTab("sugerir"); limpar(); }}
                  className={activeTab === "sugerir" 
                    ? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-0 shadow-lg shadow-indigo-500/25 hover:from-indigo-600 hover:to-violet-700" 
                    : "bg-white/5 text-indigo-200 border border-white/10 hover:bg-white/10 hover:text-white"}
                >
                  <Lightbulb className="h-4 w-4 mr-1" />
                  Sugerir Ações
                </Button>
                <Button
                  size="sm"
                  onClick={() => { setActiveTab("5w2h"); limpar(); }}
                  className={activeTab === "5w2h" 
                    ? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-0 shadow-lg shadow-indigo-500/25 hover:from-indigo-600 hover:to-violet-700" 
                    : "bg-white/5 text-indigo-200 border border-white/10 hover:bg-white/10 hover:text-white"}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Gerar 5W2H
                </Button>
                <Button
                  size="sm"
                  onClick={() => { setActiveTab("priorizar"); limpar(); }}
                  className={activeTab === "priorizar" 
                    ? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-0 shadow-lg shadow-indigo-500/25 hover:from-indigo-600 hover:to-violet-700" 
                    : "bg-white/5 text-indigo-200 border border-white/10 hover:bg-white/10 hover:text-white"}
                >
                  <BarChart3 className="h-4 w-4 mr-1" />
                  Priorizar (GUT)
                </Button>
              </div>

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

              {(activeTab === "5w2h" || activeTab === "priorizar") && (
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Título da ação"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    className="w-full px-3 py-2 rounded-md text-sm bg-white/5 border border-white/10 text-white placeholder:text-indigo-300/40 focus:border-indigo-400/50 focus:outline-none focus:ring-1 focus:ring-indigo-400/20"
                  />
                  <Textarea
                    placeholder="Descrição da ação..."
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    rows={2}
                    className="bg-white/5 border-white/10 text-white placeholder:text-indigo-300/40 focus:border-indigo-400/50 focus:ring-indigo-400/20"
                  />
                  <Button 
                    onClick={activeTab === "5w2h" ? handleGerar5W2H : handlePriorizar} 
                    disabled={isLoading || !titulo.trim()}
                    className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-0 shadow-lg shadow-indigo-500/25 hover:from-indigo-600 hover:to-violet-700 disabled:opacity-40"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    {activeTab === "5w2h" ? "Gerar 5W2H" : "Calcular GUT"}
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
                  {/* Sugestões */}
                  {resultado.sugestoes && resultado.sugestoes.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-yellow-500" />
                        Ações Sugeridas
                      </h4>
                      {resultado.sugestoes.map((sugestao, idx) => (
                        <div 
                          key={idx}
                          className="p-3 bg-white/5 rounded-lg border border-white/10 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="font-medium text-sm text-white">{sugestao.titulo}</p>
                              <p className="text-xs text-indigo-200/60 mt-1">{sugestao.descricao}</p>
                            </div>
                            <div className="flex gap-1">
                              <Badge className={getTipoColor(sugestao.tipo)} variant="secondary">
                                {sugestao.tipo}
                              </Badge>
                              <Badge className={getPrioridadeColor(sugestao.prioridade)}>
                                {sugestao.prioridade}
                              </Badge>
                            </div>
                          </div>
                          {onApplySuggestion && (
                            <Button 
                              size="sm" 
                              onClick={() => onApplySuggestion(sugestao)}
                              className="bg-white/10 text-indigo-200 border border-white/10 hover:bg-white/20 hover:text-white"
                            >
                              <ArrowRight className="h-3 w-3 mr-1" />
                              Usar esta sugestão
                            </Button>
                          )}
                        </div>
                      ))}
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
