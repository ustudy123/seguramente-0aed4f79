import { motion } from 'framer-motion';
import { Clock, BookOpen, Play, Heart, Star, GraduationCap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useAcademia, AcademiaTreinamento } from '@/hooks/useAcademia';

interface Props {
  treinamento: AcademiaTreinamento;
  onClick: () => void;
}

const nivelMap: Record<string, { label: string; color: string }> = {
  iniciante: { label: 'Iniciante', color: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20' },
  intermediario: { label: 'Intermediário', color: 'bg-amber-500/15 text-amber-500 border-amber-500/20' },
  avancado: { label: 'Avançado', color: 'bg-rose-500/15 text-rose-500 border-rose-500/20' },
};

export function AcademiaTrainingCard({ treinamento, onClick }: Props) {
  const { toggleFavorito } = useAcademia();
  const nivel = nivelMap[treinamento.nivel] || nivelMap.iniciante;
  const hasProgress = (treinamento.progresso || 0) > 0;
  const isComplete = (treinamento.progresso || 0) >= 100;

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      className="group rounded-xl border border-border bg-card overflow-hidden hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer"
      onClick={onClick}
    >
      {/* Cover Image */}
      <div className="relative aspect-video bg-muted overflow-hidden">
        {treinamento.imagem_capa ? (
          <img src={treinamento.imagem_capa} alt={treinamento.titulo} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
            <GraduationCap className="w-12 h-12 text-primary/30" />
          </div>
        )}

        {/* Overlay badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
          <Badge variant="outline" className={`text-[10px] ${nivel.color} backdrop-blur-sm`}>
            {nivel.label}
          </Badge>
          {treinamento.destaque && (
            <Badge variant="outline" className="text-[10px] bg-amber-500/15 text-amber-500 border-amber-500/20 backdrop-blur-sm">
              <Star className="w-3 h-3 mr-0.5" /> Destaque
            </Badge>
          )}
        </div>

        {/* Favorite */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorito.mutate({ treinamentoId: treinamento.id, favoritado: !!treinamento.favoritado });
          }}
          className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-background/60 backdrop-blur-sm hover:bg-background/80 transition-colors"
        >
          <Heart className={`w-4 h-4 ${treinamento.favoritado ? 'fill-rose-500 text-rose-500' : 'text-muted-foreground'}`} />
        </button>

        {/* Progress bar at bottom of image */}
        {hasProgress && (
          <div className="absolute bottom-0 left-0 right-0 h-1">
            <div className={`h-full ${isComplete ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${treinamento.progresso}%` }} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 sm:p-4 space-y-3">
        {/* Category */}
        {treinamento.categoria && (
          <p className="text-[11px] font-medium text-primary uppercase tracking-wider">{treinamento.categoria.nome}</p>
        )}

        <h3 className="font-semibold text-foreground text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
          {treinamento.titulo}
        </h3>

        {treinamento.descricao_curta && (
          <p className="text-xs text-muted-foreground line-clamp-2">{treinamento.descricao_curta}</p>
        )}

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-2 text-[10px] sm:text-[11px] text-muted-foreground">
          {treinamento.instrutor && (
            <span className="truncate max-w-[160px]">{treinamento.instrutor}</span>
          )}
          {treinamento.duracao_estimada && (
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Clock className="w-3 h-3" /> {treinamento.duracao_estimada}
            </span>
          )}
          <span className="flex items-center gap-1 whitespace-nowrap">
            <BookOpen className="w-3 h-3" /> {treinamento.total_aulas || 0} aulas
          </span>
        </div>

        {/* Progress or CTA */}
        {hasProgress ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">{treinamento.progresso}% concluído</span>
              {isComplete && <Badge className="text-[10px] bg-emerald-500/15 text-emerald-500 border-emerald-500/20">Concluído ✓</Badge>}
            </div>
            <Progress value={treinamento.progresso} className="h-1.5" />
          </div>
        ) : (
          <Button size="sm" variant="outline" className="w-full text-xs h-8">
            <Play className="w-3 h-3 mr-1.5" /> Acessar
          </Button>
        )}
      </div>
    </motion.div>
  );
}
