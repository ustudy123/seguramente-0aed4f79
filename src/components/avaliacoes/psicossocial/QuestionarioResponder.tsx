import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Brain,
  Shield,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { COPSOQ_DIMENSOES } from "@/data/instrumentos/copsoq";
import { COPSOQ2BR_DIMENSOES } from "@/data/instrumentos/copsoq2br";
import { HSE_DIMENSOES } from "@/data/instrumentos/hse";
import { PROART_DIMENSOES } from "@/data/instrumentos/proart";
import { SIPRO_DIMENSOES } from "@/data/instrumentos/sipro";
import type { DimensaoInstrumento } from "@/data/instrumentos/copsoq";
import type { InstrumentoPsicossocial } from "@/types/psicossocial";
import { BLOCOS_DINAMICOS } from "@/types/psicossocial";

// Escala Likert — fatores de RISCO (0 = ideal, 4 = pior)
const ESCALA_RISCO = [
  { valor: 0, label: 'Nunca',          emoji: '😄', intensidade: 0 },
  { valor: 1, label: 'Raramente',      emoji: '🙂', intensidade: 1 },
  { valor: 2, label: 'Às vezes',       emoji: '😐', intensidade: 2 },
  { valor: 3, label: 'Frequentemente', emoji: '😟', intensidade: 3 },
  { valor: 4, label: 'Sempre',         emoji: '😣', intensidade: 4 },
];

// Escala Likert — fatores PROTETORES (invertida: 0 = pior, 4 = ideal)
const ESCALA_PROTETOR = [
  { valor: 0, label: 'Nunca',          emoji: '😣', intensidade: 4 },
  { valor: 1, label: 'Raramente',      emoji: '😟', intensidade: 3 },
  { valor: 2, label: 'Às vezes',       emoji: '😐', intensidade: 2 },
  { valor: 3, label: 'Frequentemente', emoji: '🙂', intensidade: 1 },
  { valor: 4, label: 'Sempre',         emoji: '😄', intensidade: 0 },
];

// Escala de auto-percepção de SAÚDE (item 17 COPSOQ): 0 = Excelente, 4 = Ruim
const ESCALA_SAUDE = [
  { valor: 0, label: 'Excelente',  emoji: '😄', intensidade: 0 },
  { valor: 1, label: 'Muito boa',  emoji: '🙂', intensidade: 1 },
  { valor: 2, label: 'Boa',        emoji: '😐', intensidade: 2 },
  { valor: 3, label: 'Razoável',   emoji: '😟', intensidade: 3 },
  { valor: 4, label: 'Ruim',       emoji: '😣', intensidade: 4 },
];

// IDs de perguntas com escala customizada
const ESCALAS_CUSTOMIZADAS: Record<string, typeof ESCALA_SAUDE> = {
  c2br_17: ESCALA_SAUDE,
};


// Mapeia intensidade (0 ideal → 4 pior) em estilos discretos quando selecionado
const ESTILO_INTENSIDADE: Record<number, { selBg: string; selBorder: string; selText: string; ring: string }> = {
  0: { selBg: 'bg-emerald-50',    selBorder: 'border-emerald-500', selText: 'text-emerald-900', ring: 'ring-emerald-200' },
  1: { selBg: 'bg-emerald-50/70', selBorder: 'border-emerald-400', selText: 'text-emerald-800', ring: 'ring-emerald-100' },
  2: { selBg: 'bg-amber-50',      selBorder: 'border-amber-500',   selText: 'text-amber-900',   ring: 'ring-amber-200' },
  3: { selBg: 'bg-orange-50',     selBorder: 'border-orange-500',  selText: 'text-orange-900',  ring: 'ring-orange-200' },
  4: { selBg: 'bg-rose-50',       selBorder: 'border-rose-500',    selText: 'text-rose-900',    ring: 'ring-rose-200' },
};

interface QuestionarioResponderProps {
  instrumento: InstrumentoPsicossocial;
  respostas: Record<string, number>;
  onRespostaChange: (perguntaId: string, valor: number) => void;
  onConcluir: () => void;
  nomeCampanha?: string;
  blocosDinamicos?: string[];
}

function getDimensoesCompletas(instrumento: InstrumentoPsicossocial, blocosDinamicos?: string[]): DimensaoInstrumento[] {
  let base: DimensaoInstrumento[];
  switch (instrumento) {
    case 'copsoq': base = COPSOQ_DIMENSOES; break;
    case 'copsoq2br': base = COPSOQ2BR_DIMENSOES; break;
    case 'hse': base = HSE_DIMENSOES; break;
    case 'proart': base = PROART_DIMENSOES; break;
    case 'sipro': base = SIPRO_DIMENSOES; break;
    default: base = [...COPSOQ_DIMENSOES, ...HSE_DIMENSOES];
  }

  if (blocosDinamicos && blocosDinamicos.length > 0) {
    const blocosCET = BLOCOS_DINAMICOS
      .filter(b => blocosDinamicos.includes(b.id))
      .map(b => ({
        id: b.id,
        nome: b.titulo,
        descricao: b.descricao,
        perguntas: b.perguntas.map(p => ({ id: p.id, texto: p.texto, invertida: p.invertida })),
      } as DimensaoInstrumento));
    return [...base, ...blocosCET];
  }

  return base;
}

export function QuestionarioResponder({
  instrumento,
  respostas,
  onRespostaChange,
  onConcluir,
  nomeCampanha,
  blocosDinamicos,
}: QuestionarioResponderProps) {
  const dimensoes = getDimensoesCompletas(instrumento, blocosDinamicos);
  // Escala é escolhida por dimensão (protetor vs risco) — ver getEscalaDimensao()
  const [dimAtual, setDimAtual] = useState(0);
  const [tempoInicio] = useState(Date.now());
  const [tempoDecorrido, setTempoDecorrido] = useState(0);
  const [animDir, setAnimDir] = useState<'forward' | 'backward'>('forward');

  useEffect(() => {
    const interval = setInterval(() => {
      setTempoDecorrido(Math.floor((Date.now() - tempoInicio) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [tempoInicio]);

  // Scroll para o topo ao mudar de dimensão (UX mobile)
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Instantâneo + dupla chamada (alguns navegadores mobile ignoram smooth quando o conteúdo ainda está re-renderizando)
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      requestAnimationFrame(() => window.scrollTo(0, 0));
    }
  }, [dimAtual]);

  const totalPerguntas = dimensoes.reduce((acc, d) => acc + d.perguntas.length, 0);
  const respostasDadas = Object.keys(respostas).length;
  const progresso = Math.round((respostasDadas / totalPerguntas) * 100);

  const dimensaoAtual = dimensoes[dimAtual];
  const perguntasDimAtual = dimensaoAtual?.perguntas ?? [];
  const todasRespondidas = perguntasDimAtual.every(p => respostas[p.id] !== undefined);

  // Progresso por dimensão
  const dimProgresso = dimensoes.map(d => ({
    id: d.id,
    nome: d.nome,
    total: d.perguntas.length,
    respondidas: d.perguntas.filter(p => respostas[p.id] !== undefined).length,
  }));

  const formatTempo = (seg: number) => {
    const m = Math.floor(seg / 60);
    const s = seg % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const irProximo = () => {
    if (dimAtual < dimensoes.length - 1) {
      setAnimDir('forward');
      setDimAtual(d => d + 1);
    }
  };

  const irAnterior = () => {
    if (dimAtual > 0) {
      setAnimDir('backward');
      setDimAtual(d => d - 1);
    }
  };

  const todasDimensoesRespondidas = dimensoes.every(d =>
    d.perguntas.every(p => respostas[p.id] !== undefined)
  );

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header do questionário */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Brain className="h-5 w-5 text-purple-600 shrink-0" />
            <span className="font-semibold text-sm truncate" title={nomeCampanha || 'Avaliação Psicossocial'}>
              {nomeCampanha || 'Avaliação Psicossocial'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 pt-0.5">
            <Clock className="h-3.5 w-3.5" />
            {formatTempo(tempoDecorrido)}
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{respostasDadas} de {totalPerguntas} questões respondidas</span>
            <span>{progresso}%</span>
          </div>
          <Progress value={progresso} className="h-2" />
        </div>
      </div>

      {/* Navegação por dimensões - Pills */}
      <div className="flex gap-1.5 flex-wrap overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {dimProgresso.map((dim, i) => {
          const completa = dim.respondidas === dim.total;
          const parcial = dim.respondidas > 0 && !completa;
          const atual = i === dimAtual;
          return (
            <button
              key={dim.id}
              onClick={() => {
                setAnimDir(i > dimAtual ? 'forward' : 'backward');
                setDimAtual(i);
              }}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium transition-all border shrink-0",
                atual && "ring-2 ring-primary ring-offset-1",
                completa && "bg-emerald-100 border-emerald-300 text-emerald-700",
                parcial && "bg-amber-100 border-amber-300 text-amber-700",
                !completa && !parcial && "bg-muted border-border text-muted-foreground hover:bg-muted/80"
              )}
            >
              {completa ? <CheckCircle2 className="h-3 w-3 inline mr-1" /> : null}
              {i + 1}
            </button>
          );
        })}
      </div>

      {/* Dimensão atual */}
      <AnimatePresence mode="wait">
        <motion.div
          key={dimAtual}
          initial={{ opacity: 0, x: animDir === 'forward' ? 40 : -40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: animDir === 'forward' ? -40 : 40 }}
          transition={{ duration: 0.22 }}
        >
          <Card className="border border-border shadow-sm">
            <CardContent className="p-5 sm:p-6 space-y-5">
              {/* Cabeçalho da dimensão */}
              <div className="flex items-start gap-3 pb-4 border-b border-border">
                <div className={cn(
                  "shrink-0 w-9 h-9 rounded-md flex items-center justify-center text-sm font-semibold border",
                  dimensaoAtual?.tipo === 'risco'
                    ? 'bg-orange-50 text-orange-700 border-orange-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                )}>
                  {String(dimAtual + 1).padStart(2, '0')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-[15px] leading-tight">{dimensaoAtual?.nome}</p>
                  {dimensaoAtual?.descricao && (
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{dimensaoAtual?.descricao}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <Badge variant="outline" className={cn(
                      "text-[10px] font-medium uppercase tracking-wide px-1.5 py-0",
                      dimensaoAtual?.tipo === 'risco'
                        ? 'border-orange-200 text-orange-700 bg-orange-50/50'
                        : 'border-emerald-200 text-emerald-700 bg-emerald-50/50'
                    )}>
                      {dimensaoAtual?.tipo === 'risco' ? 'Fator de Risco' : 'Fator Protetor'}
                    </Badge>
                    {dimProgresso[dimAtual]?.respondidas > 0 && (
                      <Badge variant="secondary" className="text-[10px] font-medium px-1.5 py-0">
                        {dimProgresso[dimAtual]?.respondidas}/{dimProgresso[dimAtual]?.total}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Perguntas */}
              <div className="space-y-6">
                {perguntasDimAtual.map((pergunta, pi) => {
                  const respostaAtual = respostas[pergunta.id];
                  return (
                    <div key={pergunta.id} className="space-y-3 py-4 border-b border-border/60 last:border-b-0">
                      <p className="text-sm sm:text-[15px] leading-relaxed text-foreground flex gap-2.5">
                        <span className="text-muted-foreground font-mono text-xs pt-0.5 shrink-0 w-5 text-right">{pi + 1}.</span>
                        <span className="flex-1">
                          {pergunta.texto}
                          {pergunta.invertida && (
                            <Shield className="inline h-3 w-3 text-emerald-600 ml-1.5 -mt-0.5" />
                          )}
                        </span>
                      </p>
                      <div className="pl-7">
                        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                          {(pergunta.invertida ? ESCALA_PROTETOR : ESCALA_RISCO).map(op => {
                            const ativo = respostaAtual === op.valor;
                            const estilo = ESTILO_INTENSIDADE[op.intensidade];
                            return (
                              <button
                                key={op.valor}
                                onClick={() => onRespostaChange(pergunta.id, op.valor)}
                                className={cn(
                                  "group relative flex flex-col items-center justify-center gap-1.5 sm:gap-2 px-0.5 sm:px-1 py-2.5 sm:py-3.5 rounded-lg border transition-all text-center h-full min-w-0 overflow-hidden",
                                  ativo
                                    ? `${estilo.selBg} ${estilo.selBorder} ${estilo.selText} border-2 ring-4 ${estilo.ring}`
                                    : "bg-background border-border hover:border-foreground/30 hover:bg-muted/40"
                                )}
                              >
                                <span
                                  className={cn(
                                    "text-2xl sm:text-4xl leading-none transition-transform duration-200 select-none",
                                    ativo ? "scale-110" : "grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-105"
                                  )}
                                  style={{ fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif' }}
                                >
                                  {op.emoji}
                                </span>
                                <span className={cn(
                                  "text-[9px] sm:text-[11px] font-medium leading-tight tracking-tight w-full break-words hyphens-auto",
                                  ativo ? "" : "text-muted-foreground"
                                )}>
                                  {op.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Navegação */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center justify-between w-full sm:w-auto sm:gap-4 order-2 sm:order-1">
          <Button
            variant="outline"
            onClick={irAnterior}
            disabled={dimAtual === 0}
            className="gap-2 text-xs sm:text-sm h-9 sm:h-10"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>

          <span className="text-xs sm:text-sm text-muted-foreground sm:hidden">
            Dimensão {dimAtual + 1} de {dimensoes.length}
          </span>
        </div>

        <span className="hidden sm:inline text-sm text-muted-foreground order-2">
          Dimensão {dimAtual + 1} de {dimensoes.length}
        </span>

        {dimAtual < dimensoes.length - 1 ? (
          <Button
            onClick={irProximo}
            disabled={!todasRespondidas}
            className="gap-2 w-full sm:w-auto order-1 sm:order-3 text-xs sm:text-sm h-9 sm:h-10"
            title={!todasRespondidas ? "Responda todas as questões desta dimensão antes de avançar" : ""}
          >
            Próxima
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={onConcluir}
            disabled={!todasDimensoesRespondidas}
            className="gap-2 w-full sm:w-auto order-1 sm:order-3 bg-emerald-600 hover:bg-emerald-700 text-xs sm:text-sm h-9 sm:h-10"
            title={!todasDimensoesRespondidas ? "Responda todas as questões antes de enviar" : ""}
          >
            <CheckCircle2 className="h-4 w-4" />
            Enviar Respostas
          </Button>
        )}
      </div>

      {!todasRespondidas && dimAtual < dimensoes.length - 1 && (
        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          Responda todas as {perguntasDimAtual.length} questões desta dimensão para avançar.
        </div>
      )}

      {/* Aviso de anonimato */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg">
        <Shield className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
        Suas respostas são anônimas e utilizadas apenas para análise organizacional agregada.
      </div>
    </div>
  );
}
