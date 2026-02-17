import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2, Heart, BookOpen, Users, Zap, Brain, Sparkles, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EIXOS_CONFIG, type BemEstarEixo, type BemEstarResposta } from "@/hooks/useBemEstar";

interface EixoPanelProps {
  eixo: BemEstarEixo;
  respostas: BemEstarResposta[];
  onClose: () => void;
  onSalvarResposta: (dados: {
    eixo: BemEstarEixo;
    tipo: string;
    valor_numerico?: number;
    valor_texto?: string;
    opcao_selecionada?: string;
  }) => Promise<void>;
  onSalvarGratidao?: (dados: { conteudo: string }) => Promise<void>;
  salvando: boolean;
  getStatusLabel: (v: number) => string;
  getStatusColor: (v: number) => string;
}

const EIXO_ICONS: Record<BemEstarEixo, React.ElementType> = {
  autoconhecimento: Heart,
  sentido: BookOpen,
  relacoes: Users,
  autonomia: Zap,
  autorrealizacao: Sparkles,
  atencao_plena: Brain,
  gratidao: Sun,
};

const SLIDER_LABELS = ["", "Muito pouco", "Pouco", "Moderado", "Bastante", "Totalmente"];

const EIXO_PERGUNTAS: Record<BemEstarEixo, string> = {
  autoconhecimento: "O que mais influenciou seu humor no trabalho nos últimos dias?",
  sentido: "Hoje, meu trabalho faz sentido para mim.",
  relacoes: "Sinto que posso contar com as pessoas do meu time.",
  autonomia: "Tenho autonomia suficiente para executar meu trabalho.",
  autorrealizacao: "Sinto que estou evoluindo profissionalmente aqui.",
  atencao_plena: "Tenho conseguido manter um ritmo sustentável no trabalho.",
  gratidao: "Algo positivo que aconteceu essa semana no trabalho?",
};

const AUTOCONHECIMENTO_OPCOES = [
  "Tarefas", "Pessoas", "Ritmo", "Falta de clareza", "Algo pessoal", "Prefiro não responder"
];

const EIXO_TEXTOS_EDUCATIVOS: Record<BemEstarEixo, string> = {
  autoconhecimento: "Reconhecer o que influencia suas emoções é o primeiro passo para o equilíbrio.",
  sentido: "Pessoas tendem a se sentir melhor quando entendem por que fazem o que fazem.",
  relacoes: "Conexões de qualidade no trabalho impactam diretamente sua saúde emocional.",
  autonomia: "Sentir-se reconhecido e ter espaço para agir fortalece a motivação.",
  autorrealizacao: "A percepção de crescimento é uma das bases da satisfação profissional.",
  atencao_plena: "Excesso de estímulo e ritmo intenso afetam foco e bem-estar.",
  gratidao: "Registrar momentos positivos fortalece o oxigênio emocional da equipe.",
};

const SUGESTOES: Partial<Record<BemEstarEixo, string[]>> = {
  autonomia: ["Conversa com líder", "Material de comunicação assertiva"],
  autorrealizacao: ["Criar item no PDI", "Ver trilhas sugeridas"],
  atencao_plena: ["Ajustar pausas", "Conversar com líder", "Material de organização pessoal"],
  relacoes: ["Reconhecer alguém essa semana", "Iniciar conversa saudável"],
};

export function EixoPanel({
  eixo,
  respostas,
  onClose,
  onSalvarResposta,
  onSalvarGratidao,
  salvando,
  getStatusLabel,
  getStatusColor,
}: EixoPanelProps) {
  const config = EIXOS_CONFIG[eixo];
  const Icon = EIXO_ICONS[eixo];
  const respostasEixo = respostas.filter((r) => r.eixo === eixo);
  const ultimasRespostas = respostasEixo.filter((r) => r.valor_numerico != null).slice(0, 5);
  const media =
    ultimasRespostas.length > 0
      ? ultimasRespostas.reduce((s, r) => s + (r.valor_numerico || 0), 0) / ultimasRespostas.length
      : 0;

  const [sliderValue, setSliderValue] = useState<number>(3);
  const [textoReflexao, setTextoReflexao] = useState("");
  const [opcaoSelecionada, setOpcaoSelecionada] = useState<string | null>(null);
  const [respondido, setRespondido] = useState(false);

  const handleSliderSubmit = async () => {
    await onSalvarResposta({ eixo, tipo: "slider", valor_numerico: sliderValue });
    setRespondido(true);
  };

  const handleAutoconhecimentoSubmit = async () => {
    await onSalvarResposta({ eixo, tipo: "slider", valor_numerico: sliderValue, opcao_selecionada: opcaoSelecionada || undefined });
    setRespondido(true);
  };

  const handleGratidaoComSliderSubmit = async () => {
    await onSalvarResposta({ eixo, tipo: "slider", valor_numerico: sliderValue });
    if (textoReflexao.trim() && onSalvarGratidao) {
      await onSalvarGratidao({ conteudo: textoReflexao });
    }
    setTextoReflexao("");
    setRespondido(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="w-full"
    >
      <Card className="border-2" style={{ borderColor: config.cor + "40" }}>
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: config.cor + "20" }}
              >
                <Icon className="w-5 h-5" style={{ color: config.cor }} />
              </div>
              <div>
                <h3 className="font-semibold">{config.label}</h3>
                <p className="text-sm text-muted-foreground">{config.descricao}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Status */}
          {media > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="outline" className={getStatusColor(media)}>
                {getStatusLabel(media)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                baseado nas últimas {ultimasRespostas.length} reflexões
              </span>
            </div>
          )}

          {/* Educational text */}
          <div className="bg-muted/30 rounded-lg p-3 mb-5 border border-border/50">
            <p className="text-sm text-muted-foreground italic">
              "{EIXO_TEXTOS_EDUCATIVOS[eixo]}"
            </p>
          </div>

          {/* Interaction area */}
          <AnimatePresence mode="wait">
            {respondido ? (
              <motion.div
                key="thanks"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-6"
              >
                <p className="text-lg">💚</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Obrigado pela reflexão. Ela é só sua.
                </p>
              </motion.div>
            ) : eixo === "autoconhecimento" ? (
              <motion.div key="auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                {/* Slider for radar measurement */}
                <div className="space-y-3">
                  <p className="text-sm font-medium">Como você avalia sua consciência emocional hoje?</p>
                  <div className="px-2">
                    <Slider
                      value={[sliderValue]}
                      onValueChange={([v]) => setSliderValue(v)}
                      min={1}
                      max={5}
                      step={1}
                    />
                    <div className="flex justify-between mt-1">
                      {SLIDER_LABELS.slice(1).map((l, i) => (
                        <span
                          key={i}
                          className={`text-[10px] ${sliderValue === i + 1 ? "text-foreground font-medium" : "text-muted-foreground"}`}
                        >
                          {l}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Multiple choice question */}
                <div className="space-y-2 pt-2 border-t border-border/30">
                  <p className="text-sm font-medium">{EIXO_PERGUNTAS[eixo]}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {AUTOCONHECIMENTO_OPCOES.map((op) => (
                      <Button
                        key={op}
                        variant={opcaoSelecionada === op ? "default" : "outline"}
                        size="sm"
                        onClick={() => setOpcaoSelecionada(op)}
                        disabled={salvando}
                        className="text-xs"
                      >
                        {op}
                      </Button>
                    ))}
                  </div>
                </div>

                <Button size="sm" onClick={handleAutoconhecimentoSubmit} disabled={salvando} className="w-full">
                  {salvando ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Registrar percepção
                </Button>
              </motion.div>
            ) : eixo === "gratidao" ? (
              <motion.div key="grat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                {/* Slider for radar measurement */}
                <div className="space-y-3">
                  <p className="text-sm font-medium">Quanto você se sentiu grato no trabalho essa semana?</p>
                  <div className="px-2">
                    <Slider
                      value={[sliderValue]}
                      onValueChange={([v]) => setSliderValue(v)}
                      min={1}
                      max={5}
                      step={1}
                    />
                    <div className="flex justify-between mt-1">
                      {SLIDER_LABELS.slice(1).map((l, i) => (
                        <span
                          key={i}
                          className={`text-[10px] ${sliderValue === i + 1 ? "text-foreground font-medium" : "text-muted-foreground"}`}
                        >
                          {l}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Text field */}
                <div className="space-y-2 pt-2 border-t border-border/30">
                  <p className="text-sm font-medium">{EIXO_PERGUNTAS[eixo]}</p>
                  <Textarea
                    value={textoReflexao}
                    onChange={(e) => setTextoReflexao(e.target.value)}
                    placeholder="Pode ser um texto curto, um emoji, ou nada..."
                    rows={2}
                    maxLength={280}
                  />
                  <span className="text-xs text-muted-foreground">
                    {textoReflexao.length}/280 — totalmente opcional
                  </span>
                </div>

                <Button size="sm" onClick={handleGratidaoComSliderSubmit} disabled={salvando} className="w-full">
                  {salvando ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Registrar percepção
                </Button>
              </motion.div>
            ) : (
              <motion.div key="slider" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <p className="text-sm font-medium">{EIXO_PERGUNTAS[eixo]}</p>
                <div className="px-2">
                  <Slider
                    value={[sliderValue]}
                    onValueChange={([v]) => setSliderValue(v)}
                    min={1}
                    max={5}
                    step={1}
                  />
                  <div className="flex justify-between mt-1">
                    {SLIDER_LABELS.slice(1).map((l, i) => (
                      <span
                        key={i}
                        className={`text-[10px] ${sliderValue === i + 1 ? "text-foreground font-medium" : "text-muted-foreground"}`}
                      >
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
                <Button size="sm" onClick={handleSliderSubmit} disabled={salvando} className="w-full">
                  {salvando ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Registrar percepção
                </Button>

                {/* Suggestions for low scores */}
                {sliderValue <= 2 && SUGESTOES[eixo] && (
                  <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
                    <p className="text-xs text-muted-foreground mb-2">Sugestões (opcionais):</p>
                    <div className="flex flex-wrap gap-2">
                      {SUGESTOES[eixo]!.map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs cursor-pointer hover:bg-secondary/80">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Privacy notice */}
          <div className="mt-4 pt-3 border-t border-border/30">
            <p className="text-[11px] text-muted-foreground text-center">
              🔒 Suas reflexões são pessoais e não são compartilhadas individualmente.
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
