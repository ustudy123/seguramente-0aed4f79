import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle, AlertCircle, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface LivenessAction {
  type: "blink" | "turn_left" | "turn_right";
  label: string;
  instruction: string;
}

const ALL_ACTIONS: LivenessAction[] = [
  { type: "blink", label: "Piscar", instruction: "Pisque os olhos" },
  { type: "turn_left", label: "Esquerda", instruction: "Vire a cabeça para a esquerda" },
  { type: "turn_right", label: "Direita", instruction: "Vire a cabeça para a direita" },
];

interface LivenessDetectionProps {
  onComplete: (data: { actions: string[]; timestamps: string[]; frames?: string[] }) => void;
  onError?: (error: string) => void;
}

export function LivenessDetection({ onComplete, onError }: LivenessDetectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const detectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceDetectorSupported, setFaceDetectorSupported] = useState<boolean | null>(null);

  const [actions, setActions] = useState<LivenessAction[]>([]);
  const [currentActionIndex, setCurrentActionIndex] = useState(0);
  const [completedActions, setCompletedActions] = useState<string[]>([]);
  const [timestamps, setTimestamps] = useState<string[]>([]);
  const [capturedFrames, setCapturedFrames] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Gerar 3 ações aleatórias
  useEffect(() => {
    const shuffled = [...ALL_ACTIONS].sort(() => Math.random() - 0.5);
    setActions(shuffled);
  }, []);

  // Inicializar FaceDetector
  useEffect(() => {
    const initDetector = async () => {
      try {
        if ("FaceDetector" in window) {
          const detector = new (window as any).FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
          detectorRef.current = detector;
          setFaceDetectorSupported(true);
        } else {
          setFaceDetectorSupported(false);
        }
      } catch {
        setFaceDetectorSupported(false);
      }
    };
    initDetector();
  }, []);

  // Detecção contínua de rosto
  const startFaceDetection = useCallback(() => {
    if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);

    detectionIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || !detectorRef.current) return;
      if (videoRef.current.readyState < 2) return;

      try {
        const faces = await detectorRef.current.detect(videoRef.current);
        setFaceDetected(faces.length > 0);
      } catch {
        // Silently ignore detection errors
      }
    }, 500);
  }, []);

  // Capturar frame do vídeo
  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.7);
  }, []);

  // Iniciar câmera
  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setCameraReady(true);
      setCameraError(null);

      if (detectorRef.current) {
        startFaceDetection();
      }
    } catch {
      const errorMessage = "Não foi possível acessar a câmera. Verifique as permissões.";
      setCameraError(errorMessage);
      onError?.(errorMessage);
    }
  }, [onError, startFaceDetection]);

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, [startCamera]);

  // Confirmar ação atual
  const handleConfirmAction = () => {
    if (isProcessing || currentActionIndex >= actions.length) return;

    // Se FaceDetector é suportado, exigir rosto
    if (faceDetectorSupported && !faceDetected) return;

    setIsProcessing(true);
    const currentAction = actions[currentActionIndex];
    const timestamp = new Date().toISOString();
    const frame = captureFrame();

    setCompletedActions(prev => [...prev, currentAction.type]);
    setTimestamps(prev => [...prev, timestamp]);
    if (frame) setCapturedFrames(prev => [...prev, frame]);

    setTimeout(() => {
      setIsProcessing(false);

      if (currentActionIndex === actions.length - 1) {
        const finalActions = [...completedActions, currentAction.type];
        const finalTimestamps = [...timestamps, timestamp];
        const finalFrames = frame ? [...capturedFrames, frame] : capturedFrames;

        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
        if (detectionIntervalRef.current) {
          clearInterval(detectionIntervalRef.current);
        }

        onComplete({
          actions: finalActions,
          timestamps: finalTimestamps,
          frames: finalFrames,
        });
      } else {
        setCurrentActionIndex(prev => prev + 1);
      }
    }, 500);
  };

  const currentAction = actions[currentActionIndex];
  const canConfirm = cameraReady && !isProcessing && (faceDetectorSupported ? faceDetected : true);

  if (cameraError) {
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
        <h3 className="text-lg font-semibold">Verificação de Presença</h3>
        <p className="text-sm text-muted-foreground">
          Complete as ações abaixo para verificar sua presença
        </p>
      </div>

      {/* Indicador de progresso */}
      <div className="flex justify-center gap-2">
        {actions.map((_, index) => (
          <div
            key={index}
            className={`h-2 w-8 rounded-full transition-colors ${
              index < currentActionIndex
                ? "bg-green-500"
                : index === currentActionIndex
                ? "bg-primary"
                : "bg-muted"
            }`}
          />
        ))}
      </div>

      {/* Vídeo da câmera */}
      <div className="relative mx-auto overflow-hidden rounded-xl bg-black" style={{ maxWidth: 400 }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="aspect-video w-full transform scale-x-[-1]"
        />

        {/* Indicador de detecção de rosto */}
        {cameraReady && faceDetectorSupported && (
          <div className={`absolute top-2 right-2 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            faceDetected
              ? "bg-green-500/90 text-white"
              : "bg-red-500/90 text-white animate-pulse"
          }`}>
            {faceDetected ? (
              <>
                <ShieldCheck className="h-3.5 w-3.5" />
                Rosto detectado
              </>
            ) : (
              <>
                <ShieldAlert className="h-3.5 w-3.5" />
                Nenhum rosto
              </>
            )}
          </div>
        )}

        {!cameraReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        )}
      </div>

      {/* Aviso se FaceDetector não suportado */}
      {faceDetectorSupported === false && (
        <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-700 dark:text-amber-400 mx-auto max-w-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Detecção facial não suportada neste navegador. Frames serão capturados como evidência.</span>
        </div>
      )}

      {/* Instrução atual */}
      <AnimatePresence mode="wait">
        {currentAction && (
          <motion.div
            key={currentAction.type}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center"
          >
            <Card className="mx-auto max-w-sm p-6">
              <p className="mb-4 text-xl font-medium">{currentAction.instruction}</p>

              {faceDetectorSupported && !faceDetected && cameraReady && (
                <p className="mb-3 text-sm text-destructive font-medium">
                  Posicione seu rosto na câmera para continuar
                </p>
              )}

              <Button
                onClick={handleConfirmAction}
                disabled={!canConfirm}
                size="lg"
                className="w-full"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Ação Realizada
                  </>
                )}
              </Button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ações completadas */}
      {completedActions.length > 0 && (
        <div className="flex justify-center gap-2">
          {completedActions.map((action, index) => (
            <div
              key={index}
              className="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-sm text-green-700 dark:bg-green-900 dark:text-green-300"
            >
              <CheckCircle className="h-3 w-3" />
              {ALL_ACTIONS.find(a => a.type === action)?.label}
            </div>
          ))}
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
