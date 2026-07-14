import { useEffect, useRef } from "react";

// Carrega a API do IFrame do YouTube uma única vez.
let apiPromise: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const w = window as any;
    if (w.YT?.Player) {
      resolve();
      return;
    }
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    if (!document.getElementById("youtube-iframe-api")) {
      const s = document.createElement("script");
      s.id = "youtube-iframe-api";
      s.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(s);
    }
  });
  return apiPromise;
}

interface YouTubePlayerProps {
  videoId: string;
  /** Chamado uma vez quando o vídeo chega ao fim. */
  onEnded?: () => void;
}

/**
 * Player do YouTube via IFrame API. Diferente de um <iframe> simples,
 * consegue detectar quando o vídeo termina (estado ENDED) e disparar onEnded.
 */
export function YouTubePlayer({ videoId, onEnded }: YouTubePlayerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const endedRef = useRef(false);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    let cancelled = false;
    let player: any = null;
    endedRef.current = false;

    loadYouTubeApi().then(() => {
      if (cancelled || !wrapper) return;
      const target = document.createElement("div");
      target.style.width = "100%";
      target.style.height = "100%";
      wrapper.appendChild(target);
      const YT = (window as any).YT;
      player = new YT.Player(target, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: { rel: 0 },
        events: {
          onStateChange: (e: any) => {
            // 0 = ENDED
            if (e.data === 0 && !endedRef.current) {
              endedRef.current = true;
              onEndedRef.current?.();
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      try {
        player?.destroy?.();
      } catch {
        /* noop */
      }
      if (wrapper) wrapper.innerHTML = "";
    };
  }, [videoId]);

  return <div ref={wrapperRef} className="w-full h-full" />;
}
