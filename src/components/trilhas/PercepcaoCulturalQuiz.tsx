import { useState } from "react";
import { motion } from "framer-motion";
import { Heart, Send, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { CulturaValoresModule } from "./CulturaValoresModule";

const PERGUNTAS_PERCEPCAO = [
  {
    chave: "acolhimento",
    texto: "Como você se sentiu ao chegar na empresa?",
    categoria: "cultura",
    opcoes: [
      "Muito acolhido(a) e bem-vindo(a)",
      "Bem recebido(a), mas um pouco perdido(a)",
      "Recebi as informações necessárias, mas faltou calor humano",
      "Não me senti especialmente acolhido(a)",
    ],
  },
  {
    chave: "valores_percebidos",
    texto: "Ao conhecer os valores da empresa, qual foi sua impressão?",
    categoria: "cultura",
    opcoes: [
      "Me identifico fortemente com esses valores",
      "Identifico-me com a maioria deles",
      "Alguns fazem sentido, outros ainda preciso entender melhor",
      "Ainda não consegui perceber esses valores na prática",
    ],
  },
  {
    chave: "clareza_papel",
    texto: "Quão claro está o seu papel e o que se espera de você?",
    categoria: "integracao",
    opcoes: [
      "Totalmente claro, sei exatamente o que preciso fazer",
      "Tenho uma boa noção, mas alguns detalhes ainda não estão claros",
      "Tenho dúvidas significativas sobre minhas responsabilidades",
      "Ainda estou tentando entender meu papel",
    ],
  },
  {
    chave: "sentido_trabalho",
    texto: "Você percebe um propósito claro no trabalho que vai realizar?",
    categoria: "cultura",
    opcoes: [
      "Sim, vejo muito sentido e propósito",
      "Consigo perceber, mas gostaria de entender melhor",
      "Ainda estou buscando entender o propósito",
      "Não percebi um propósito claro até agora",
    ],
  },
  {
    chave: "expectativa_crescimento",
    texto: "Como você vê suas possibilidades de crescimento aqui?",
    categoria: "engajamento",
    opcoes: [
      "Vejo muitas oportunidades de desenvolvimento",
      "Acredito que há boas possibilidades",
      "Ainda não tenho informações suficientes para opinar",
      "Estou preocupado(a) com a falta de perspectivas",
    ],
  },
  {
    chave: "observacao_livre",
    texto: "Tem algo que gostaria de compartilhar sobre sua chegada? (opcional)",
    categoria: "geral",
    tipo: "texto_livre",
  },
];

interface Props {
  trilhaId: string;
  processoId?: string;
  onComplete?: () => void;
}

export function PercepcaoCulturalQuiz({ trilhaId, processoId, onComplete }: Props) {
  const { tenantId, user, profile } = useAuth();
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [textoLivre, setTextoLivre] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState(0); // 0 = cultura view, 1 = perguntas

  const perguntasComOpcoes = PERGUNTAS_PERCEPCAO.filter(p => p.opcoes);
  const respondidas = Object.keys(respostas).length;
  const totalObrigatorias = perguntasComOpcoes.length;
  const todasRespondidas = respondidas >= totalObrigatorias;

  const handleSubmit = async () => {
    if (!tenantId || !todasRespondidas) return;
    setSubmitting(true);
    try {
      const inserts = PERGUNTAS_PERCEPCAO.map(p => ({
        tenant_id: tenantId,
        processo_id: processoId || null,
        colaborador_id: user?.id || profile?.nome_completo || "",
        colaborador_nome: profile?.nome_completo || user?.email || "",
        pergunta_chave: p.chave,
        pergunta_texto: p.texto,
        resposta: p.chave === "observacao_livre" ? (textoLivre || "—") : (respostas[p.chave] || "—"),
        categoria: p.categoria,
      }));

      const { error } = await supabase
        .from("onboarding_percepcao_cultural" as never)
        .insert(inserts as never);
      if (error) throw error;

      setSubmitted(true);
      toast.success("Obrigado por compartilhar sua percepção!");
      onComplete?.();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar respostas. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-success mb-3" />
        <h3 className="text-lg font-semibold text-foreground">Percepção registrada!</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Suas respostas ajudam a empresa a entender como melhorar o ambiente de trabalho. Obrigado!
        </p>
      </div>
    );
  }

  if (step === 0) {
    return (
      <div className="space-y-6">
        <CulturaValoresModule />
        <div className="flex justify-center pt-2">
          <Button onClick={() => setStep(1)} className="gap-2">
            <Heart className="w-4 h-4" />
            Compartilhar minha percepção
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-center mb-4">
        <Heart className="w-8 h-8 text-primary mx-auto mb-2" />
        <h3 className="text-lg font-semibold text-foreground">Como você percebe a empresa?</h3>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto">
          Não existe resposta certa ou errada. Queremos entender como você enxerga o ambiente desde o início.
        </p>
        <Badge variant="outline" className="mt-2 text-xs">
          {respondidas}/{totalObrigatorias} respondidas
        </Badge>
      </div>

      {perguntasComOpcoes.map((p, i) => (
        <motion.div
          key={p.chave}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <Card className="border-border">
            <CardContent className="p-5">
              <p className="text-sm font-medium text-foreground mb-3">
                {i + 1}. {p.texto}
              </p>
              <RadioGroup
                value={respostas[p.chave] || ""}
                onValueChange={(v) => setRespostas(prev => ({ ...prev, [p.chave]: v }))}
                className="space-y-2"
              >
                {p.opcoes!.map((opcao, j) => (
                  <div key={j} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-accent/50 transition-colors">
                    <RadioGroupItem value={opcao} id={`${p.chave}-${j}`} />
                    <Label htmlFor={`${p.chave}-${j}`} className="text-sm text-foreground cursor-pointer flex-1">
                      {opcao}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>
        </motion.div>
      ))}

      {/* Texto livre */}
      <Card className="border-border">
        <CardContent className="p-5">
          <p className="text-sm font-medium text-foreground mb-3">
            {perguntasComOpcoes.length + 1}. {PERGUNTAS_PERCEPCAO.find(p => p.chave === "observacao_livre")?.texto}
          </p>
          <Textarea
            value={textoLivre}
            onChange={(e) => setTextoLivre(e.target.value)}
            placeholder="Compartilhe livremente o que desejar..."
            rows={3}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={!todasRespondidas || submitting} className="gap-2">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Enviar percepção
        </Button>
      </div>
    </div>
  );
}
