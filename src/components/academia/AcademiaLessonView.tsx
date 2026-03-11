import { useMemo } from 'react';
import { ArrowLeft, CheckCircle2, ChevronRight, Play, FileText, ExternalLink, Download, Clock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAcademia } from '@/hooks/useAcademia';
import { Loader2 } from 'lucide-react';

interface Props {
  aulaId: string;
  treinamentoId: string;
  onBack: () => void;
}

function getEmbedUrl(url: string): string | null {
  if (!url) return null;
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`;
  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  // Loom
  const loomMatch = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
  if (loomMatch) return `https://www.loom.com/embed/${loomMatch[1]}`;
  // Bunny
  if (url.includes('iframe.mediadelivery.net') || url.includes('bunny')) return url;
  // Generic iframe
  return url;
}

export function AcademiaLessonView({ aulaId, treinamentoId, onBack }: Props) {
  const { getTreinamentoDetail, completarAula, checkAndAwardBadge } = useAcademia();
  const { data: treino, isLoading } = getTreinamentoDetail(treinamentoId);

  const allAulas = useMemo(() => treino?.modulos?.flatMap(m => m.aulas || []) || [], [treino]);
  const currentIndex = allAulas.findIndex(a => a.id === aulaId);
  const aula = allAulas[currentIndex];
  const nextAula = allAulas[currentIndex + 1];
  const prevAula = currentIndex > 0 ? allAulas[currentIndex - 1] : null;

  if (isLoading || !treino) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!aula) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Aula não encontrada.</p>
        <Button variant="outline" onClick={onBack} className="mt-4">Voltar</Button>
      </div>
    );
  }

  const embedUrl = aula.video_url ? getEmbedUrl(aula.video_url) : null;

  const handleComplete = async () => {
    await completarAula.mutateAsync({ aulaId: aula.id, treinamentoId });
    await checkAndAwardBadge(treinamentoId, treino.titulo);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar ao treinamento
        </Button>
        <div className="text-xs text-muted-foreground">
          Aula {currentIndex + 1} de {allAulas.length}
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{treino.titulo}</span>
          <span>{treino.progresso}%</span>
        </div>
        <Progress value={treino.progresso} className="h-1.5" />
      </div>

      {/* Video Player */}
      {aula.tipo === 'video' && embedUrl && (
        <div className="relative aspect-video rounded-xl overflow-hidden border border-border bg-black">
          <iframe
            src={embedUrl}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {/* Content area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-foreground">{aula.titulo}</h1>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                  {aula.duracao && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {aula.duracao}</span>}
                  {aula.obrigatoria && <Badge variant="outline" className="text-[10px]">Obrigatória</Badge>}
                </div>
              </div>
              {aula.concluida ? (
                <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Concluída
                </Badge>
              ) : (
                <Button size="sm" onClick={handleComplete} disabled={completarAula.isPending}>
                  {completarAula.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Zap className="w-4 h-4 mr-1" />}
                  Marcar como concluída
                </Button>
              )}
            </div>

            {aula.descricao && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{aula.descricao}</p>
            )}

            {/* Text content */}
            {aula.tipo === 'texto' && aula.conteudo_texto && (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div dangerouslySetInnerHTML={{ __html: aula.conteudo_texto.replace(/\n/g, '<br/>') }} />
              </div>
            )}

            {/* External link */}
            {aula.tipo === 'link' && aula.link_externo && (
              <a href={aula.link_externo} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-primary hover:underline text-sm">
                <ExternalLink className="w-4 h-4" /> Acessar conteúdo externo
              </a>
            )}

            {/* Supplementary material */}
            {aula.material_complementar && aula.material_complementar.length > 0 && (
              <div className="pt-3 border-t border-border">
                <h3 className="text-sm font-medium text-foreground mb-2">Material complementar</h3>
                <div className="space-y-2">
                  {aula.material_complementar.map((mat: any, i: number) => (
                    <a key={i} href={mat.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm"
                    >
                      <Download className="w-4 h-4 text-muted-foreground" />
                      <span className="text-foreground">{mat.nome || mat.url}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            {prevAula ? (
              <Button variant="outline" size="sm" onClick={() => onBack()}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Anterior
              </Button>
            ) : <div />}
            {nextAula && (
              <Button size="sm" onClick={onBack}>
                Próxima aula <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>

        {/* Sidebar: lesson list */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-3 border-b border-border bg-muted/30">
            <p className="text-sm font-medium text-foreground">Aulas do treinamento</p>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            {treino.modulos?.map(modulo => (
              <div key={modulo.id}>
                <div className="px-3 py-2 bg-muted/20 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {modulo.nome}
                </div>
                {modulo.aulas?.map(a => (
                  <button
                    key={a.id}
                    onClick={() => { /* Navigate handled by parent */ }}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted/20 transition-colors border-b border-border/30 ${a.id === aulaId ? 'bg-primary/10 border-l-2 border-l-primary' : ''}`}
                  >
                    {a.concluida ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    ) : a.id === aulaId ? (
                      <Play className="w-4 h-4 text-primary flex-shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-muted-foreground/30 flex-shrink-0" />
                    )}
                    <span className={`truncate ${a.id === aulaId ? 'text-primary font-medium' : a.concluida ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {a.titulo}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
