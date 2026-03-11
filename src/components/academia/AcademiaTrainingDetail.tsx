import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Clock, BookOpen, Play, Heart, ChevronDown, CheckCircle2, Lock, GraduationCap, Zap, FileText, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAcademia } from '@/hooks/useAcademia';
import { Loader2 } from 'lucide-react';

interface Props {
  treinamentoId: string;
  onBack: () => void;
  onOpenAula: (aulaId: string, treinamentoId: string) => void;
}

const nivelLabel: Record<string, string> = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
};

export function AcademiaTrainingDetail({ treinamentoId, onBack, onOpenAula }: Props) {
  const { getTreinamentoDetail, toggleFavorito } = useAcademia();
  const { data: treino, isLoading } = getTreinamentoDetail(treinamentoId);
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});

  const toggleModule = (id: string) => setOpenModules(prev => ({ ...prev, [id]: !prev[id] }));

  if (isLoading || !treino) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Find first incomplete lesson
  const firstIncomplete = treino.modulos?.flatMap(m => m.aulas || []).find(a => !a.concluida);

  return (
    <div className="space-y-6">
      {/* Back */}
      <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
        <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar
      </Button>

      {/* Hero Banner */}
      <div className="relative rounded-xl overflow-hidden border border-border">
        <div className="aspect-[3/1] bg-gradient-to-br from-primary/20 via-primary/5 to-transparent">
          {(treino.banner || treino.imagem_capa) && (
            <img src={treino.banner || treino.imagem_capa!} alt={treino.titulo} className="w-full h-full object-cover opacity-40" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-6 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {treino.categoria && (
              <Badge variant="outline" className="text-[11px] bg-primary/15 text-primary border-primary/20">{treino.categoria.nome}</Badge>
            )}
            <Badge variant="outline" className="text-[11px]">{nivelLabel[treino.nivel] || treino.nivel}</Badge>
          </div>
          <h1 className="text-2xl font-bold text-foreground">{treino.titulo}</h1>
          {treino.subtitulo && <p className="text-muted-foreground text-sm">{treino.subtitulo}</p>}

          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            {treino.instrutor && <span>{treino.instrutor}</span>}
            {treino.duracao_estimada && (
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {treino.duracao_estimada}</span>
            )}
            <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> {treino.total_modulos} módulos · {treino.total_aulas} aulas</span>
          </div>

          <div className="flex items-center gap-3 pt-1">
            {treino.progresso !== undefined && treino.progresso > 0 ? (
              <div className="flex-1 max-w-xs space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{treino.progresso}% concluído</span>
                  {treino.progresso >= 100 && <span className="text-emerald-500 font-medium">Concluído ✓</span>}
                </div>
                <Progress value={treino.progresso} className="h-2" />
              </div>
            ) : null}
            {firstIncomplete && (
              <Button size="sm" onClick={() => onOpenAula(firstIncomplete.id, treinamentoId)}>
                <Play className="w-4 h-4 mr-1.5" />
                {treino.progresso && treino.progresso > 0 ? 'Continuar' : 'Iniciar'}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => toggleFavorito.mutate({ treinamentoId, favoritado: !!treino.favoritado })}
            >
              <Heart className={`w-4 h-4 ${treino.favoritado ? 'fill-rose-500 text-rose-500' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Description */}
      {treino.descricao_completa && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold text-foreground mb-2">Sobre este treinamento</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{treino.descricao_completa}</p>
        </div>
      )}

      {/* Modules & Lessons */}
      <div className="space-y-3">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          Conteúdo programático
        </h2>

        {treino.modulos?.map((modulo, mIdx) => {
          const isOpen = openModules[modulo.id] !== false; // default open
          const aulasCount = modulo.aulas?.length || 0;
          const concluidas = modulo.aulas?.filter(a => a.concluida).length || 0;

          return (
            <div key={modulo.id} className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                onClick={() => toggleModule(modulo.id)}
                className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary flex-shrink-0">
                  {mIdx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground">{modulo.nome}</p>
                  <p className="text-[11px] text-muted-foreground">{concluidas}/{aulasCount} aulas concluídas</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-border">
                      {modulo.aulas?.map((aula, aIdx) => (
                        <button
                          key={aula.id}
                          onClick={() => onOpenAula(aula.id, treinamentoId)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors text-left border-b border-border/50 last:border-0"
                        >
                          {aula.concluida ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${aula.concluida ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                              {aula.titulo}
                            </p>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                              {aula.tipo === 'video' && <span className="flex items-center gap-0.5"><Play className="w-3 h-3" /> Vídeo</span>}
                              {aula.tipo === 'texto' && <span className="flex items-center gap-0.5"><FileText className="w-3 h-3" /> Texto</span>}
                              {aula.tipo === 'link' && <span className="flex items-center gap-0.5"><ExternalLink className="w-3 h-3" /> Link</span>}
                              {aula.duracao && <span>· {aula.duracao}</span>}
                              {aula.obrigatoria && <Badge variant="outline" className="text-[9px] h-4">Obrigatória</Badge>}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
