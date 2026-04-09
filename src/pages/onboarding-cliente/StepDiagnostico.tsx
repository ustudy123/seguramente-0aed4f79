import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2, ChevronRight, Sparkles, Loader2,
  BarChart3, Clock, Rocket
} from "lucide-react";
import type { Cliente, BlocoRespostas } from "./types";
import { BLOCOS_DIAGNOSTICO } from "./constants";
import { calcularIndice, calcularNivelIndice, gerarPrioridades } from "./utils";

export function StepDiagnostico({ cliente, onConcluir }: { cliente: Cliente; onConcluir: () => void }) {
  const [fase, setFase] = useState<'intro' | 'blocos' | 'resultado'>('intro');
  const [blocoAtual, setBlocoAtual] = useState(0);
  const [respostas, setRespostas] = useState<BlocoRespostas>({});
  const [salvando, setSalvando] = useState(false);

  const bloco = BLOCOS_DIAGNOSTICO[blocoAtual];
  const totalPerguntas = BLOCOS_DIAGNOSTICO.reduce((acc, b) => acc + b.perguntas.length, 0);
  const perguntasRespondidas = Object.keys(respostas).length;
  const progresso = Math.round((perguntasRespondidas / totalPerguntas) * 100);

  const resultadosBlocos = BLOCOS_DIAGNOSTICO.map(b => {
    const positivas = b.perguntas.filter(p => respostas[p.id] === true).length;
    return { ...b, positivas, classificacao: b.classificar(positivas) };
  });

  const indice = calcularIndice(respostas);
  const nivelIndice = calcularNivelIndice(indice);
  const prioridades = gerarPrioridades(indice);

  const handleResposta = (perguntaId: string, valor: boolean) => {
    setRespostas(prev => ({ ...prev, [perguntaId]: valor }));
  };

  const blocoCompleto = bloco?.perguntas.every(p => respostas[p.id] !== undefined);
  const isUltimoBloco = blocoAtual === BLOCOS_DIAGNOSTICO.length - 1;

  const handleAvancar = () => {
    if (isUltimoBloco) {
      setFase('resultado');
    } else {
      setBlocoAtual(b => b + 1);
    }
  };

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      const resultado = {
        respostas,
        indice,
        nivel: nivelIndice.label,
        blocos: resultadosBlocos.map(b => ({ id: b.id, titulo: b.titulo, classificacao: b.classificacao, positivas: b.positivas })),
        prioridades,
        data: new Date().toISOString(),
      };
      await supabase
        .from('programa_validador_clientes')
        .update({
          diagnostico_iniciado: true,
          diagnostico_resultado: resultado as never,
        } as any)
        .eq('id', cliente.id);
      toast.success('Diagnóstico salvo com sucesso!');
      onConcluir();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar diagnóstico');
    } finally {
      setSalvando(false);
    }
  };

  if (fase === 'intro') {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-primary/5 border border-primary/15 rounded-xl space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold">Diagnóstico Inicial de Implantação</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Avaliação estratégica em 4 blocos para identificar o nível de maturidade organizacional
            e direcionar sua implantação de forma personalizada.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {BLOCOS_DIAGNOSTICO.map(b => (
            <div key={b.id} className="p-3 bg-muted/30 rounded-lg border border-border flex items-start gap-2">
              <span className="text-base">{b.icon}</span>
              <div>
                <p className="text-xs font-semibold">{b.titulo}</p>
                <p className="text-xs text-muted-foreground">{b.perguntas.length} perguntas</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { icon: <BarChart3 className="w-4 h-4" />, label: '4 blocos' },
            { icon: <Clock className="w-4 h-4" />, label: '~5 minutos' },
            { icon: <Rocket className="w-4 h-4" />, label: 'Plano automático' },
          ].map(item => (
            <div key={item.label} className="p-2 bg-muted/50 rounded-lg flex flex-col items-center gap-1">
              <span className="text-primary">{item.icon}</span>
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-2">
          <Button onClick={() => setFase('blocos')} className="w-full">
            <Rocket className="w-4 h-4 mr-2" />
            Iniciar Diagnóstico
          </Button>
          <Button variant="outline" onClick={onConcluir} className="w-full text-muted-foreground">
            Fazer isso depois
          </Button>
        </div>
      </div>
    );
  }

  if (fase === 'blocos') {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Bloco {blocoAtual + 1} de {BLOCOS_DIAGNOSTICO.length}</span>
            <span>{progresso}% concluído</span>
          </div>
          <Progress value={progresso} className="h-1.5" />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={blocoAtual}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">{bloco.icon}</span>
              <div>
                <p className="text-sm font-bold">{bloco.titulo}</p>
                <p className="text-xs text-muted-foreground">{bloco.descricao}</p>
              </div>
            </div>

            <div className="space-y-2">
              {bloco.perguntas.map(pergunta => {
                const resp = respostas[pergunta.id];
                return (
                  <div key={pergunta.id} className="p-3 rounded-xl border border-border bg-background space-y-2">
                    <p className="text-xs font-medium leading-snug">{pergunta.texto}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResposta(pergunta.id, true)}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                          resp === true
                            ? 'bg-primary/15 border-primary text-primary'
                            : 'border-border hover:border-primary/40 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        ✓ Sim
                      </button>
                      <button
                        onClick={() => handleResposta(pergunta.id, false)}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                          resp === false
                            ? 'bg-destructive/10 border-destructive/50 text-destructive'
                            : 'border-border hover:border-destructive/30 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        ✗ Não
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flex gap-2">
          {blocoAtual > 0 && (
            <Button variant="outline" size="sm" onClick={() => setBlocoAtual(b => b - 1)} className="text-muted-foreground">
              ← Voltar
            </Button>
          )}
          <Button
            onClick={handleAvancar}
            disabled={!blocoCompleto}
            className="flex-1"
          >
            {isUltimoBloco ? 'Ver Resultado' : 'Próximo Bloco'}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  // Resultado
  return (
    <div className="space-y-4">
      <div className={`p-5 rounded-xl border text-center space-y-2 ${nivelIndice.bg}`}>
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Diagnóstico Organizacional Concluído</p>
        <div className="flex items-center justify-center gap-2">
          <BarChart3 className={`w-6 h-6 ${nivelIndice.cor}`} />
          <p className={`text-xl font-black ${nivelIndice.cor}`}>{nivelIndice.label}</p>
        </div>
        <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold bg-background border ${nivelIndice.cor}`}>
          Índice de Maturidade: {indice}/100
        </div>
        <Progress value={indice} className="h-2 mt-1" />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Resultados por Bloco</p>
        {resultadosBlocos.map(b => (
          <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background">
            <div className="flex items-center gap-2">
              <span className="text-sm">{b.icon}</span>
              <p className="text-xs font-medium">{b.titulo}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                b.positivas >= 3 ? 'bg-primary/10 text-primary' :
                b.positivas >= 2 ? 'bg-blue-500/10 text-blue-600' :
                b.positivas >= 1 ? 'bg-amber-500/10 text-amber-600' :
                'bg-destructive/10 text-destructive'
              }`}>
                {b.classificacao}
              </span>
              <span className="text-xs text-muted-foreground">{b.positivas}/{b.perguntas.length}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-3">
        <p className="text-xs font-semibold">🗺️ Plano de Implantação Recomendado</p>
        <p className="text-xs text-muted-foreground">
          Com base no diagnóstico, recomendamos iniciar pelos seguintes módulos:
        </p>
        <div className="space-y-1.5">
          {prioridades.map(p => (
            <div key={p.ordem} className="flex items-center gap-2 text-xs">
              <span className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">
                {p.ordem}
              </span>
              <span className="font-medium">{p.texto}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <Button onClick={handleSalvar} disabled={salvando} className="w-full">
          {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
          {salvando ? 'Salvando...' : 'Salvar e Continuar'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => { setFase('blocos'); setBlocoAtual(0); }} className="text-muted-foreground">
          Refazer diagnóstico
        </Button>
      </div>
    </div>
  );
}
