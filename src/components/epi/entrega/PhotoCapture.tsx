import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, RefreshCw, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface PhotoCaptureProps {
  onCapture: (photoData: string) => void;
  onError?: (error: string) => void;
}

export function PhotoCapture({ onCapture, onError }: PhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  // Iniciar câmera
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      
      // Parar stream anterior se existir
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      
      streamRef.current = mediaStream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      
      setStream(mediaStream);
      setCameraReady(true);
      setCapturedPhoto(null);
    } catch (err) {
      const errorMessage = "Não foi possível acessar a câmera. Verifique as permissões.";
      setCameraError(errorMessage);
      onError?.(errorMessage);
    }
  }, [onError]);

  useEffect(() => {
    startCamera();
    
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [startCamera]);

  // Capturar foto
  const capturePhoto = () => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Espelhar a imagem horizontalmente para ficar como selfie
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    
    const photoData = canvas.toDataURL("image/jpeg", 0.8);
    setCapturedPhoto(photoData);
    
    // Parar câmera após captura
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setCameraReady(false);
  };

  // Tirar nova foto
  const retakePhoto = () => {
    setCapturedPhoto(null);
    startCamera();
  };

  // Confirmar foto
  const confirmPhoto = () => {
    if (capturedPhoto) {
      onCapture(capturedPhoto);
    }
  };

  if (cameraError && !capturedPhoto) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-muted-foreground">{cameraError}</p>
          <Button onClick={startCamera}>Tentar Novamente</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold">Captura de Foto</h3>
        <p className="text-sm text-muted-foreground">
          {capturedPhoto
            ? "Verifique a foto e confirme ou tire novamente"
            : "Posicione o rosto no centro da tela"}
        </p>
      </div>

      {/* Área de visualização */}
      <div className="relative mx-auto overflow-hidden rounded-xl bg-black" style={{ maxWidth: 400 }}>
        {capturedPhoto ? (
          <img
            src={capturedPhoto}
            alt="Foto capturada"
            className="aspect-video w-full object-cover"
          />
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="aspect-video w-full transform scale-x-[-1]"
            />
            
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
            )}
            
            {/* Guia facial */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-48 w-36 rounded-full border-2 border-dashed border-white/50" />
            </div>
          </>
        )}
      </div>

      {/* Botões de ação */}
      <div className="flex justify-center gap-3">
        {capturedPhoto ? (
          <>
            <Button variant="outline" onClick={retakePhoto}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Tirar Novamente
            </Button>
            <Button onClick={confirmPhoto}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Confirmar Foto
            </Button>
          </>
        ) : (
          <Button onClick={capturePhoto} disabled={!cameraReady} size="lg">
            <Camera className="mr-2 h-4 w-4" />
            Capturar Foto
          </Button>
        )}
      </div>
    </div>
  );
}
