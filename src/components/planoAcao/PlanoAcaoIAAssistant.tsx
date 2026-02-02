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
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Assistente IA
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
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
            <CardContent className="space-y-4">
              {/* Tabs */}
              <div className="flex gap-2">
                <Button
                  variant={activeTab === "sugerir" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setActiveTab("sugerir"); limpar(); }}
                >
                  <Lightbulb className="h-4 w-4 mr-1" />
                  Sugerir Ações
                </Button>
                <Button
                  variant={activeTab === "5w2h" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setActiveTab("5w2h"); limpar(); }}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Gerar 5W2H
                </Button>
                <Button
                  variant={activeTab === "priorizar" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setActiveTab("priorizar"); limpar(); }}
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
                  />
                  <Button onClick={handleSugerir} disabled={isLoading || !contexto.trim()}>
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
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                  <Textarea
                    placeholder="Descrição da ação..."
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    rows={2}
                  />
                  <Button 
                    onClick={activeTab === "5w2h" ? handleGerar5W2H : handlePriorizar} 
                    disabled={isLoading || !titulo.trim()}
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
                  className="space-y-4 pt-4 border-t"
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
                          className="p-3 bg-background rounded-lg border space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{sugestao.titulo}</p>
                              <p className="text-xs text-muted-foreground mt-1">{sugestao.descricao}</p>
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
                              variant="outline"
                              onClick={() => onApplySuggestion(sugestao)}
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
                          <div key={idx} className="p-2 bg-background rounded border">
                            <span className="font-medium text-primary">{item.label}:</span>
                            <p className="text-muted-foreground mt-1">{item.value}</p>
                          </div>
                        ))}
                      </div>
                      {onApply5W2H && (
                        <Button 
                          size="sm" 
                          onClick={() => onApply5W2H(resultado.w5h2!)}
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
                        <div className="p-3 bg-background rounded border text-center">
                          <p className="text-xs text-muted-foreground">Gravidade</p>
                          <p className="text-2xl font-bold text-red-500">{resultado.gut.gravidade}</p>
                        </div>
                        <div className="p-3 bg-background rounded border text-center">
                          <p className="text-xs text-muted-foreground">Urgência</p>
                          <p className="text-2xl font-bold text-orange-500">{resultado.gut.urgencia}</p>
                        </div>
                        <div className="p-3 bg-background rounded border text-center">
                          <p className="text-xs text-muted-foreground">Tendência</p>
                          <p className="text-2xl font-bold text-yellow-500">{resultado.gut.tendencia}</p>
                        </div>
                      </div>
                      <div className="p-3 bg-primary/10 rounded-lg text-center">
                        <p className="text-sm text-muted-foreground">Pontuação Total</p>
                        <p className="text-3xl font-bold text-primary">{resultado.gut.total}</p>
                        <Progress value={(resultado.gut.total / 125) * 100} className="mt-2" />
                      </div>
                      <p className="text-sm text-muted-foreground">{resultado.gut.justificativa}</p>
                      {onApplyGUT && (
                        <Button 
                          size="sm" 
                          onClick={() => onApplyGUT(resultado.gut!)}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Aplicar Priorização
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Resumo */}
                  {resultado.resumo && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm">{resultado.resumo}</p>
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
