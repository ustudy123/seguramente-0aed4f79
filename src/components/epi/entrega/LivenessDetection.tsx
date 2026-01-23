import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle, Camera, AlertCircle, Loader2 } from "lucide-react";
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
  onComplete: (data: { actions: string[]; timestamps: string[] }) => void;
  onError?: (error: string) => void;
}

export function LivenessDetection({ onComplete, onError }: LivenessDetectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const [actions, setActions] = useState<LivenessAction[]>([]);
  const [currentActionIndex, setCurrentActionIndex] = useState(0);
  const [completedActions, setCompletedActions] = useState<string[]>([]);
  const [timestamps, setTimestamps] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Gerar 3 ações aleatórias
  useEffect(() => {
    const shuffled = [...ALL_ACTIONS].sort(() => Math.random() - 0.5);
    setActions(shuffled);
  }, []);

  // Iniciar câmera
  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
      
      setStream(mediaStream);
      setCameraReady(true);
      setCameraError(null);
    } catch (err) {
      const errorMessage = "Não foi possível acessar a câmera. Verifique as permissões.";
      setCameraError(errorMessage);
      onError?.(errorMessage);
    }
  }, [onError]);

  useEffect(() => {
    startCamera();
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Confirmar ação atual
  const handleConfirmAction = () => {
    if (isProcessing || currentActionIndex >= actions.length) return;
    
    setIsProcessing(true);
    const currentAction = actions[currentActionIndex];
    const timestamp = new Date().toISOString();
    
    setCompletedActions(prev => [...prev, currentAction.type]);
    setTimestamps(prev => [...prev, timestamp]);
    
    setTimeout(() => {
      setIsProcessing(false);
      
      if (currentActionIndex === actions.length - 1) {
        // Todas as ações completas
        const finalActions = [...completedActions, currentAction.type];
        const finalTimestamps = [...timestamps, timestamp];
        
        // Parar câmera
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        
        onComplete({
          actions: finalActions,
          timestamps: finalTimestamps,
        });
      } else {
        setCurrentActionIndex(prev => prev + 1);
      }
    }, 500);
  };

  const currentAction = actions[currentActionIndex];

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
        
        {!cameraReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        )}
      </div>

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
              <Button
                onClick={handleConfirmAction}
                disabled={!cameraReady || isProcessing}
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
    </div>
  );
}
