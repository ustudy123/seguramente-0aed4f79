import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  Trophy,
  RotateCcw,
  HelpCircle,
} from "lucide-react";
import { useTrilhaQuiz } from "@/hooks/useTrilhaQuiz";

interface QuizPlayerProps {
  moduloId: string;
  pontuacaoModulo: number;
  onComplete: (nota: number, pontosObtidos: number) => void;
}

export function QuizPlayer({ moduloId, pontuacaoModulo, onComplete }: QuizPlayerProps) {
  const { perguntas, isLoading } = useTrilhaQuiz(moduloId);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [corretas, setCorretas] = useState(0);
  const [finished, setFinished] = useState(false);

  const pergunta = perguntas[currentIndex];
  const total = perguntas.length;
  const progressPercent = total > 0 ? Math.round(((currentIndex + (answered ? 1 : 0)) / total) * 100) : 0;

  const handleSelect = (optionIndex: number) => {
    if (answered) return;
    setSelectedOption(optionIndex);
  };

  const handleConfirm = () => {
    if (selectedOption === null || !pergunta) return;
    setAnswered(true);
    if (selectedOption === pergunta.resposta_correta) {
      setCorretas((prev) => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < total - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setAnswered(false);
    } else {
      setFinished(true);
    }
  };

  const handleFinish = () => {
    const nota = total > 0 ? Math.round((corretas / total) * 100) : 0;
    const pontos = total > 0 ? Math.round((corretas / total) * pontuacaoModulo) : 0;
    onComplete(nota, pontos);
  };

  const handleRetry = () => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setAnswered(false);
    setCorretas(0);
    setFinished(false);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <HelpCircle className="w-8 h-8 animate-pulse text-primary" />
      </div>
    );
  }

  if (perguntas.length === 0) {
    return (
      <div className="text-center py-8 bg-muted/30 rounded-lg border border-border">
        <HelpCircle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          Nenhuma pergunta cadastrada para este quiz.
        </p>
      </div>
    );
  }

  if (finished) {
    const nota = total > 0 ? Math.round((corretas / total) * 100) : 0;
    const pontos = total > 0 ? Math.round((corretas / total) * pontuacaoModulo) : 0;
    const passed = nota >= 70;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="space-y-4"
      >
        <Card className="border-border">
          <CardContent className="p-6 text-center space-y-4">
            <div className={cn(
              "w-16 h-16 rounded-full mx-auto flex items-center justify-center",
              passed ? "bg-success/10" : "bg-warning/10"
            )}>
              {passed ? (
                <Trophy className="w-8 h-8 text-success" />
              ) : (
                <RotateCcw className="w-8 h-8 text-warning" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">
                {passed ? "Parabéns! 🎉" : "Continue tentando!"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Você acertou {corretas} de {total} perguntas
              </p>
            </div>
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{nota}%</p>
                <p className="text-xs text-muted-foreground">Nota</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{pontos}</p>
                <p className="text-xs text-muted-foreground">Pontos</p>
              </div>
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <Button variant="outline" onClick={handleRetry}>
                <RotateCcw className="w-4 h-4 mr-2" /> Tentar novamente
              </Button>
              {passed && (
                <Button onClick={handleFinish}>
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Concluir módulo
                </Button>
              )}
            </div>
            {!passed && (
              <p className="text-xs text-muted-foreground">
                Você precisa de pelo menos 70% para concluir.
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const isCorrect = selectedOption === pergunta.resposta_correta;

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <Progress value={progressPercent} className="h-2 flex-1" />
        <span className="text-xs text-muted-foreground font-medium">
          {currentIndex + 1}/{total}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="border-border">
            <CardContent className="p-5 space-y-4">
              <p className="text-base font-medium text-foreground">
                {pergunta.pergunta}
              </p>

              <div className="space-y-2">
                {pergunta.opcoes.map((opcao, i) => {
                  const isSelected = selectedOption === i;
                  const isCorrectOption = i === pergunta.resposta_correta;

                  let optionClass = "border-border hover:border-primary/30 hover:bg-accent/50 cursor-pointer";
                  if (isSelected && !answered) {
                    optionClass = "border-primary bg-primary/5 cursor-pointer";
                  }
                  if (answered && isCorrectOption) {
                    optionClass = "border-success bg-success/5";
                  }
                  if (answered && isSelected && !isCorrectOption) {
                    optionClass = "border-destructive bg-destructive/5";
                  }
                  if (answered) {
                    optionClass += " cursor-default";
                  }

                  return (
                    <button
                      key={i}
                      onClick={() => handleSelect(i)}
                      disabled={answered}
                      className={cn(
                        "w-full text-left p-3 rounded-lg border transition-all flex items-center gap-3",
                        optionClass
                      )}
                    >
                      <span className="text-xs font-mono text-muted-foreground w-5 flex-shrink-0">
                        {String.fromCharCode(65 + i)})
                      </span>
                      <span className="text-sm text-foreground flex-1">{opcao}</span>
                      {answered && isCorrectOption && (
                        <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                      )}
                      {answered && isSelected && !isCorrectOption && (
                        <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {answered && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "p-3 rounded-lg text-sm font-medium",
                    isCorrect
                      ? "bg-success/5 text-success border border-success/20"
                      : "bg-destructive/5 text-destructive border border-destructive/20"
                  )}
                >
                  {isCorrect ? "✅ Correto!" : "❌ Incorreto. A resposta certa está destacada acima."}
                </motion.div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                {!answered ? (
                  <Button onClick={handleConfirm} disabled={selectedOption === null}>
                    Confirmar resposta
                  </Button>
                ) : (
                  <Button onClick={handleNext}>
                    {currentIndex < total - 1 ? (
                      <>
                        Próxima <ArrowRight className="w-4 h-4 ml-1" />
                      </>
                    ) : (
                      "Ver resultado"
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
