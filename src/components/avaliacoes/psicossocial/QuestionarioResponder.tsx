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
import { HSE_DIMENSOES } from "@/data/instrumentos/hse";
import { PROART_DIMENSOES } from "@/data/instrumentos/proart";
import { SIPRO_DIMENSOES } from "@/data/instrumentos/sipro";
import type { DimensaoInstrumento } from "@/data/instrumentos/copsoq";
import type { InstrumentoPsicossocial } from "@/types/psicossocial";
import { BLOCOS_DINAMICOS } from "@/types/psicossocial";

// Escala para fatores de RISCO: Nunca = bom (😊), Sempre = ruim (😰)
const ESCALA_RISCO = [
  { valor: 0, label: 'Nunca',          emoji: '😊', cor: 'from-emerald-50 to-emerald-100/60 border-emerald-300 text-emerald-800 hover:from-emerald-100 hover:to-emerald-200/70', selecionado: 'from-emerald-400 to-emerald-500 border-emerald-600 text-white shadow-emerald-300/60' },
  { valor: 1, label: 'Raramente',      emoji: '🙂', cor: 'from-green-50 to-green-100/60 border-green-300 text-green-800 hover:from-green-100 hover:to-green-200/70',           selecionado: 'from-green-400 to-green-500 border-green-600 text-white shadow-green-300/60' },
  { valor: 2, label: 'Às vezes',       emoji: '😐', cor: 'from-amber-50 to-amber-100/60 border-amber-300 text-amber-800 hover:from-amber-100 hover:to-amber-200/70',           selecionado: 'from-amber-400 to-amber-500 border-amber-600 text-white shadow-amber-300/60' },
  { valor: 3, label: 'Frequentemente', emoji: '😟', cor: 'from-orange-50 to-orange-100/60 border-orange-300 text-orange-800 hover:from-orange-100 hover:to-orange-200/70',     selecionado: 'from-orange-400 to-orange-500 border-orange-600 text-white shadow-orange-300/60' },
  { valor: 4, label: 'Sempre',         emoji: '😰', cor: 'from-red-50 to-red-100/60 border-red-300 text-red-800 hover:from-red-100 hover:to-red-200/70',                       selecionado: 'from-red-400 to-red-500 border-red-600 text-white shadow-red-300/60' },
];

// Escala para fatores PROTETORES (invertida)
const ESCALA_PROTETOR = [
  { valor: 0, label: 'Nunca',          emoji: '😰', cor: 'from-red-50 to-red-100/60 border-red-300 text-red-800 hover:from-red-100 hover:to-red-200/70',                       selecionado: 'from-red-400 to-red-500 border-red-600 text-white shadow-red-300/60' },
  { valor: 1, label: 'Raramente',      emoji: '😟', cor: 'from-orange-50 to-orange-100/60 border-orange-300 text-orange-800 hover:from-orange-100 hover:to-orange-200/70',     selecionado: 'from-orange-400 to-orange-500 border-orange-600 text-white shadow-orange-300/60' },
  { valor: 2, label: 'Às vezes',       emoji: '😐', cor: 'from-amber-50 to-amber-100/60 border-amber-300 text-amber-800 hover:from-amber-100 hover:to-amber-200/70',           selecionado: 'from-amber-400 to-amber-500 border-amber-600 text-white shadow-amber-300/60' },
  { valor: 3, label: 'Frequentemente', emoji: '🙂', cor: 'from-green-50 to-green-100/60 border-green-300 text-green-800 hover:from-green-100 hover:to-green-200/70',           selecionado: 'from-green-400 to-green-500 border-green-600 text-white shadow-green-300/60' },
  { valor: 4, label: 'Sempre',         emoji: '😊', cor: 'from-emerald-50 to-emerald-100/60 border-emerald-300 text-emerald-800 hover:from-emerald-100 hover:to-emerald-200/70', selecionado: 'from-emerald-400 to-emerald-500 border-emerald-600 text-white shadow-emerald-300/60' },
];

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            <span className="font-semibold text-sm">{nomeCampanha || 'Avaliação Psicossocial'}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
          <Card className={cn(
            "border-2",
            dimensaoAtual?.tipo === 'risco' ? 'border-orange-200' : 'border-emerald-200'
          )}>
            <CardContent className="p-4 sm:pt-5 space-y-4 sm:space-y-5">
              {/* Cabeçalho da dimensão */}
              <div className="flex items-start gap-3">
                <div className={cn(
                  "shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                  dimensaoAtual?.tipo === 'risco' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'
                )}>
                  {dimAtual + 1}
                </div>
                <div>
                  <p className="font-semibold">{dimensaoAtual?.nome}</p>
                  <p className="text-sm text-muted-foreground">{dimensaoAtual?.descricao}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className={cn("text-xs",
                      dimensaoAtual?.tipo === 'risco' ? 'border-orange-300 text-orange-700' : 'border-emerald-300 text-emerald-700'
                    )}>
                      {dimensaoAtual?.tipo === 'risco' ? 'Fator de Risco' : 'Fator Protetor'}
                    </Badge>
                    {dimProgresso[dimAtual]?.respondidas > 0 && (
                      <Badge variant="secondary" className="text-xs">
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
                    <div key={pergunta.id} className="space-y-3">
                      <p className="text-sm font-medium leading-relaxed">
                        <span className="text-muted-foreground mr-1.5">{pi + 1}.</span>
                        {pergunta.texto}
                        {pergunta.invertida && (
                          <span title="Pergunta protetora">
                            <Shield className="inline h-3 w-3 text-emerald-500 ml-1.5" />
                          </span>
                        )}
                      </p>
                      <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
                        {(pergunta.invertida ? ESCALA_PROTETOR : ESCALA_RISCO).map(op => (
                          <button
                            key={op.valor}
                            onClick={() => onRespostaChange(pergunta.id, op.valor)}
                            className={cn(
                              "flex flex-col items-center gap-0.5 sm:gap-1 p-1.5 sm:p-2 rounded-lg border-2 transition-all text-center h-full justify-between",
                              respostaAtual === op.valor
                                ? `${op.cor} border-current ring-2 ring-current ring-offset-1 scale-[1.02] sm:scale-105`
                                : "border-border hover:border-current " + op.cor
                            )}
                          >
                            <span className="text-base sm:text-lg leading-none">{op.emoji}</span>
                            <span className="text-[8px] sm:text-[10px] font-medium leading-tight break-words w-full px-0.5">
                              {op.label}
                            </span>
                          </button>
                        ))}
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
