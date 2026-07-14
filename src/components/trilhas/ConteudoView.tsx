import { ExternalLink, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getEmbedUrl, getYouTubeId } from "@/lib/embedVideo";
import { YouTubePlayer } from "./YouTubePlayer";
import type { TrilhaModuloConteudo } from "@/types/trilha";

interface ConteudoViewProps {
  item: TrilhaModuloConteudo;
  /** "muted" usa bg-muted (app interno); "gray" usa bg-gray-100 (páginas públicas) */
  surface?: "muted" | "gray";
  /** Quando definido, mostra o botão "marcar como concluído" para este conteúdo. */
  concluido?: boolean;
  onToggleConcluido?: () => void;
}

/** Renderiza um único conteúdo de módulo (vídeo, PDF, apresentação, link ou texto). */
export function ConteudoView({ item, surface = "muted", concluido, onToggleConcluido }: ConteudoViewProps) {
  const bg = surface === "gray" ? "bg-gray-100" : "bg-muted";
  const url = item.url?.trim();

  // Vídeo do YouTube com controle de conclusão → conclui sozinho ao terminar
  const ytId = item.tipo === "video" && url ? getYouTubeId(url) : null;
  const autoCompleteVideo = !!ytId && !!onToggleConcluido;

  return (
    <div className="space-y-2">
      {item.titulo && <p className="text-sm font-medium text-foreground">{item.titulo}</p>}

      {item.tipo === "video" && url && (
        <div className={`aspect-video ${bg} rounded-lg overflow-hidden`}>
          {autoCompleteVideo && ytId ? (
            <YouTubePlayer
              videoId={ytId}
              onEnded={() => { if (!concluido) onToggleConcluido?.(); }}
            />
          ) : (
            <iframe
              src={getEmbedUrl(url)}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
      )}

      {(item.tipo === "pdf" || item.tipo === "apresentacao") && url && (
        <div className="space-y-2">
          <div className={`aspect-[4/3] ${bg} rounded-lg overflow-hidden`}>
            <iframe src={getEmbedUrl(url)} className="w-full h-full" />
          </div>
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
            <ExternalLink className="w-3.5 h-3.5" />
            Abrir em nova aba
          </a>
        </div>
      )}

      {item.tipo === "link" && url && (
        <Button variant="outline" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4 mr-2" />
            {item.titulo || "Acessar conteúdo"}
          </a>
        </Button>
      )}

      {item.tipo === "texto" && item.texto && (
        <div className="prose prose-sm max-w-none text-foreground bg-muted/30 rounded-lg p-4 border border-border whitespace-pre-wrap">
          {item.texto}
        </div>
      )}

      {onToggleConcluido && (
        autoCompleteVideo ? (
          <div className={`inline-flex items-center gap-1.5 text-sm rounded-md px-2.5 py-1 border ${
            concluido ? "text-success border-success/30 bg-success/10" : "text-muted-foreground border-border"
          }`}>
            {concluido ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
            {concluido ? "Concluído" : "Assista o vídeo até o fim para concluir"}
          </div>
        ) : (
          <button
            type="button"
            onClick={onToggleConcluido}
            className={`inline-flex items-center gap-1.5 text-sm rounded-md px-2.5 py-1 border transition-colors ${
              concluido
                ? "text-success border-success/30 bg-success/10"
                : "text-muted-foreground border-border hover:text-foreground hover:bg-muted/40"
            }`}
          >
            {concluido ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
            {concluido ? "Concluído" : "Marcar como concluído"}
          </button>
        )
      )}
    </div>
  );
}
