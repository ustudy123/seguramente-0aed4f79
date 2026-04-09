import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Heart, BookOpen, Users, Zap, Brain, Sparkles, Sun, ExternalLink, MessageCircle, TrendingUp, Clock, AlertTriangle, Award, Target, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EIXOS_CONFIG, type BemEstarEixo, type BemEstarResposta } from "@/hooks/useBemEstar";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useAuth } from "@/hooks/useAuth";

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

const HUMOR_EMOJI_MAP: Record<string, string> = {
  feliz: "😊", motivado: "🔥", calmo: "😌", grato: "🙏",
  neutro: "😐", cansado: "😩", ansioso: "😰", triste: "😢",
  frustrado: "😤", estressado: "🤯", exausto: "💤",
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
  const { user, profile } = useAuth();
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

  // Contextual data states
  const [humorHistory, setHumorHistory] = useState<any[]>([]);
  const [feedbackCount, setFeedbackCount] = useState<number>(0);
  const [showFuncaoConexao, setShowFuncaoConexao] = useState(false);

  // Fetch contextual data per axis
  useEffect(() => {
    if (!user?.id) return;

    if (eixo === "autoconhecimento") {
      // Fetch mood history
      fromTable("humor_diario")
        .select("humor, emoji, data, created_at" as any)
        .eq("user_id" as never, user.id as any)
        .order("data" as never, { ascending: false })
        .limit(14)
        .then(({ data }: any) => {
          if (data) setHumorHistory(data.reverse());
        });
    }

    if (eixo === "autonomia") {
      // Fetch positive feedback count
      fromTable("feedbacks")
        .select("id" as never, { count: "exact", head: true })
        .eq("destinatario_id" as never, user.id as any)
        .eq("categoria" as never, "reconhecimento" as any)
        .then(({ count }: any) => {
          setFeedbackCount(count || 0);
        });
    }
  }, [eixo, user?.id]);

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

  // Render contextual content per axis (above interaction)
  const renderContextualContent = () => {
    switch (eixo) {
      case "autoconhecimento":
        return humorHistory.length > 0 ? (
          <div className="mb-4">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Seu humor nos últimos dias
            </p>
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {humorHistory.map((h: any, i: number) => (
                <div key={i} className="flex flex-col items-center min-w-[36px]">
                  <span className="text-lg" title={h.humor}>
                    {HUMOR_EMOJI_MAP[h.humor] || h.emoji || "😐"}
                  </span>
                  <span className="text-[9px] text-muted-foreground mt-0.5">
                    {new Date(h.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
            <Separator className="mt-3" />
          </div>
        ) : null;

      case "sentido":
        return (
          <div className="mb-4">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs gap-2"
              onClick={() => setShowFuncaoConexao(!showFuncaoConexao)}
            >
              <Target className="w-3.5 h-3.5" />
              Quer ver como sua função se conecta com a empresa?
              <ExternalLink className="w-3 h-3 ml-auto" />
            </Button>
            <AnimatePresence>
              {showFuncaoConexao && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 p-3 bg-muted/30 rounded-lg border border-border/50 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">Sua função</Badge>
                      <span className="text-sm font-medium">{profile?.cargo || "—"}</span>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Objetivo da função</p>
                      <p className="text-sm">Garantir a execução e melhoria contínua dos processos da sua área.</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Impacto no time e clientes</p>
                      <p className="text-sm">Seu trabalho contribui diretamente para a qualidade e eficiência percebida por colegas e clientes.</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <Separator className="mt-3" />
          </div>
        );

      case "relacoes":
        return (
          <div className="mb-4">
            <div className="p-3 bg-muted/20 rounded-lg border border-border/30">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-2">
                <MessageCircle className="w-3.5 h-3.5" />
                Micro-ação sugerida (opcional)
              </p>
              <p className="text-sm mb-2">Que tal reconhecer alguém essa semana?</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => window.location.href = "/feedback-ocorrencias"}>
                  <Award className="w-3.5 h-3.5" />
                  Enviar feedback positivo
                </Button>
              </div>
            </div>
            <Separator className="mt-3" />
          </div>
        );

      case "autonomia":
        return (
          <div className="mb-4 space-y-2">
            <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg border border-border/30">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-warning" />
                <div>
                  <p className="text-xs text-muted-foreground">Feedbacks positivos recebidos</p>
                  <p className="text-lg font-semibold">{feedbackCount}</p>
                </div>
              </div>
            </div>
            <Separator />
          </div>
        );

      case "autorrealizacao":
        return (
          <div className="mb-4">
            <div className="p-3 bg-muted/20 rounded-lg border border-border/30 space-y-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                Desenvolvimento
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => window.location.href = "/aprendizado"}>
                  <BookOpen className="w-3.5 h-3.5" />
                  Ver trilhas disponíveis
                </Button>
                <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => window.location.href = "/aprendizado"}>
                  <Sparkles className="w-3.5 h-3.5" />
                  Competências da função
                </Button>
              </div>
            </div>
            <Separator className="mt-3" />
          </div>
        );

      case "atencao_plena":
        return (
          <div className="mb-4">
            <div className="p-3 bg-muted/20 rounded-lg border border-border/30 space-y-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Indicadores de ritmo (auto-observação)
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Jornadas longas recorrentes?</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Brain className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Poucas pausas durante o dia?</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Registros de trabalho fora do horário?</span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground italic">
                Reflita sobre esses pontos ao responder abaixo.
              </p>
            </div>
            <Separator className="mt-3" />
          </div>
        );

      default:
        return null;
    }
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

          {/* Contextual content per axis */}
          {renderContextualContent()}

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

                {/* Text + emoji field */}
                <div className="space-y-2 pt-2 border-t border-border/30">
                  <p className="text-sm font-medium">{EIXO_PERGUNTAS[eixo]}</p>
                  <Textarea
                    value={textoReflexao}
                    onChange={(e) => setTextoReflexao(e.target.value)}
                    placeholder="Pode ser um texto curto, um emoji 😊, ou nada..."
                    rows={2}
                    maxLength={280}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {textoReflexao.length}/280 — totalmente opcional
                    </span>
                    <div className="flex gap-1">
                      {["😊", "🙏", "🎉", "💪", "🌟"].map((emoji) => (
                        <button
                          key={emoji}
                          className="text-lg hover:scale-125 transition-transform"
                          onClick={() => setTextoReflexao((prev) => prev + emoji)}
                          type="button"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
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
                    <p className="text-xs text-muted-foreground mb-2">
                      <Lightbulb className="w-3.5 h-3.5 inline mr-1" />
                      Sugestões (opcionais):
                    </p>
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
