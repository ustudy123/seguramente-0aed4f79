import { useState, useRef, useCallback } from "react";
import { Camera, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PontoSelfieCaptureProps {
  selfieFile: File | null;
  selfiePreview: string | null;
  onChange: (file: File | null, preview: string | null) => void;
}

export function PontoSelfieCapture({ selfieFile, selfiePreview, onChange }: PontoSelfieCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      setStream(mediaStream);
      setIsCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = mediaStream;
      }, 100);
    } catch {
      setError("Não foi possível acessar a câmera. Verifique as permissões.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
    setIsCameraOpen(false);
  }, [stream]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      blob => {
        if (!blob) return;
        const file = new File([blob], `ponto-selfie-${Date.now()}.jpg`, { type: "image/jpeg" });
        const preview = URL.createObjectURL(blob);
        onChange(file, preview);
        stopCamera();
      },
      "image/jpeg",
      0.85
    );
  }, [onChange, stopCamera]);

  const retake = useCallback(() => {
    if (selfiePreview) URL.revokeObjectURL(selfiePreview);
    onChange(null, null);
    startCamera();
  }, [selfiePreview, onChange, startCamera]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm text-foreground">📸 Selfie de Verificação</h4>
        <Badge variant={selfieFile ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
          {selfieFile ? "✓ Capturada" : "Opcional"}
        </Badge>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded-md">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {selfiePreview ? (
        <div className="space-y-2">
          <div className="relative rounded-lg overflow-hidden border">
            <img src={selfiePreview} alt="Selfie de ponto" className="w-full max-h-[200px] object-cover" />
            <div className="absolute top-2 right-2">
              <CheckCircle2 className="h-5 w-5 text-green-500 drop-shadow" />
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={retake} className="w-full text-xs">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Tirar novamente
          </Button>
        </div>
      ) : isCameraOpen ? (
        <div className="space-y-2">
          <div className="relative rounded-lg overflow-hidden border bg-black">
            <video ref={videoRef} autoPlay playsInline muted className="w-full max-h-[200px] object-cover" style={{ transform: "scaleX(-1)" }} />
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={capturePhoto} className="flex-1 text-xs">
              <Camera className="h-3.5 w-3.5 mr-1.5" />
              Capturar
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={stopCamera} className="text-xs">
              Cancelar
            </Button>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      ) : (
        <Button type="button" variant="outline" onClick={startCamera} className="w-full text-xs">
          <Camera className="h-4 w-4 mr-1.5" />
          Abrir câmera para selfie
        </Button>
      )}
    </div>
  );
}
