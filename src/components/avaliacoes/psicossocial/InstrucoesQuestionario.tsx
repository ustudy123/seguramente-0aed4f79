import { motion } from "framer-motion";
import { Heart, Clock, Coffee, Sparkles, ShieldCheck, ArrowRight, Brain, MessageCircleHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface InstrucoesQuestionarioProps {
  campanhaNome: string;
  onContinuar: () => void;
}

export function InstrucoesQuestionario({ campanhaNome, onContinuar }: InstrucoesQuestionarioProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full"
      >
        <Card className="shadow-xl border-0 ring-1 ring-black/5">
          <CardHeader className="text-center pb-3">
            <div className="flex justify-center mb-3">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                <MessageCircleHeart className="h-8 w-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl">Antes de começar</CardTitle>
            <CardDescription className="text-sm">{campanhaNome}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Mensagem de acolhimento */}
            <div className="rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 p-5">
              <p className="text-base text-violet-900 leading-relaxed">
                <strong>Reserve um momento só para você.</strong> Este questionário é uma escuta cuidadosa
                sobre como você se sente no seu dia de trabalho. Não existem respostas certas ou erradas —
                o que vale é a sua verdade.
              </p>
            </div>

            {/* Dicas */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-background p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                  <Coffee className="h-4 w-4 text-amber-700" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Encontre um lugar tranquilo</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Escolha um momento sem pressa, onde você possa refletir com calma.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                  <Clock className="h-4 w-4 text-blue-700" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Leva poucos minutos</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Em média, de 8 a 15 minutos. Responda no seu próprio ritmo.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-rose-100 flex items-center justify-center shrink-0">
                  <Heart className="h-4 w-4 text-rose-700" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Responda com sinceridade</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    A sua honestidade é o que torna esta escuta realmente útil para todos.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                  <Brain className="h-4 w-4 text-emerald-700" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Pense no seu cotidiano</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Considere como você tem se sentido nas últimas semanas no trabalho.
                  </p>
                </div>
              </div>
            </div>

            {/* Reforço de privacidade */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-900 leading-relaxed">
                <strong>Suas respostas são anônimas.</strong> Nem a empresa, nem a YourEyes conseguem
                identificar quem respondeu o quê. Pode ficar à vontade para ser sincero(a).
              </p>
            </div>

            {/* Mensagem de cuidado */}
            <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4 flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-violet-600 shrink-0 mt-0.5" />
              <p className="text-sm text-violet-900 leading-relaxed">
                Se em algum momento sentir desconforto, você pode pausar e voltar depois.
                <strong> Cuide de você enquanto responde.</strong>
              </p>
            </div>

            <Button
              onClick={onContinuar}
              className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-md"
              size="lg"
            >
              Estou ciente, vamos começar
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Obrigado por dedicar este tempo. A sua voz importa. 💜
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
