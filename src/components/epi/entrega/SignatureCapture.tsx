import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eraser, CheckCircle, Info } from "lucide-react";

interface SignatureCaptureProps {
  onCapture: (signatureData: string) => void;
  colaboradorNome: string;
}

export function SignatureCapture({ onCapture, colaboradorNome }: SignatureCaptureProps) {
  const signatureRef = useRef<SignatureCanvas>(null);
  const [hasSignature, setHasSignature] = useState(false);

  const handleClear = () => {
    signatureRef.current?.clear();
    setHasSignature(false);
  };

  const handleConfirm = () => {
    if (signatureRef.current && !signatureRef.current.isEmpty()) {
      const signatureData = signatureRef.current.toDataURL("image/png");
      onCapture(signatureData);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold">Assinatura Digital</h3>
        <p className="text-sm text-muted-foreground">
          {colaboradorNome}, assine no campo abaixo usando o dedo ou mouse
        </p>
      </div>

      {/* Área de assinatura */}
      <Card className="mx-auto max-w-md overflow-hidden">
        <div className="border-b bg-muted/30 p-2 text-center text-xs text-muted-foreground">
          Área de assinatura
        </div>
        <div className="bg-white p-1">
          <SignatureCanvas
            ref={signatureRef}
            canvasProps={{
              className: "w-full touch-none",
              style: { width: "100%", height: 150 },
            }}
            backgroundColor="white"
            penColor="black"
            onEnd={() => setHasSignature(true)}
          />
        </div>
        <div className="border-t p-2">
          <div className="mx-auto h-px w-3/4 bg-muted-foreground/30" />
          <p className="mt-1 text-center text-xs text-muted-foreground">
            Assinatura do colaborador
          </p>
        </div>
      </Card>

      {/* Botões */}
      <div className="flex justify-center gap-3">
        <Button variant="outline" onClick={handleClear} disabled={!hasSignature}>
          <Eraser className="mr-2 h-4 w-4" />
          Limpar
        </Button>
        <Button onClick={handleConfirm} disabled={!hasSignature}>
          <CheckCircle className="mr-2 h-4 w-4" />
          Confirmar Assinatura
        </Button>
      </div>

      {/* Informação legal */}
      <Alert className="mx-auto max-w-md">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          <strong>Lei 14.063/2020:</strong> Esta assinatura eletrônica tem validade jurídica
          conforme a legislação brasileira de assinaturas digitais. Ao assinar, você confirma
          o recebimento do(s) EPI(s) em perfeito estado de conservação.
        </AlertDescription>
      </Alert>
    </div>
  );
}
