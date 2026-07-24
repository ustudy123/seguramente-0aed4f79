import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getSupabaseFunctionUrl } from "@/lib/supabaseFunctions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, FileText, AlertTriangle, PenLine } from "lucide-react";
import SignatureCanvas from "react-signature-canvas";
import { toast } from "sonner";
import { Toaster as Sonner } from "@/components/ui/sonner";

export default function PdiAssinatura() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [showSignPad, setShowSignPad] = useState(false);
  const [docHtml, setDocHtml] = useState<string | null>(null);
  const sigCanvasRef = useRef<SignatureCanvas>(null);

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${getSupabaseFunctionUrl("pdi-assinatura")}?token=${token}`,
        { headers: { "Content-Type": "application/json" } }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar");
      setData(json);
      if (json.status === "assinado") setSigned(true);
      
      // Fetch HTML content for document preview
      if (json.documento_url) {
        try {
          const docRes = await fetch(json.documento_url);
          const html = await docRes.text();
          setDocHtml(html);
        } catch (e) {
          console.error("Erro ao carregar documento HTML:", e);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async () => {
    if (!sigCanvasRef.current || sigCanvasRef.current.isEmpty()) {
      toast.error("Por favor, assine antes de confirmar.");
      return;
    }

    setSigning(true);
    try {
      const assinatura_base64 = sigCanvasRef.current.toDataURL("image/png");

      const res = await fetch(
        `${getSupabaseFunctionUrl("pdi-assinatura")}?token=${token}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assinatura_base64 }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao assinar");

      setSigned(true);
      toast.success("Assinatura registrada com sucesso!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Sonner />
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando documento...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Sonner />
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Link inválido</h2>
            <p className="text-gray-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Sonner />
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Documento Assinado!</h2>
            <p className="text-gray-600 mb-4">
              Sua assinatura foi registrada com sucesso para o PDI de <strong>{data?.pdi?.colaborador_nome}</strong>.
            </p>
            <Badge className="bg-green-100 text-green-700">
              Assinado como: {data?.signatario_nome} ({data?.signatario_papel})
            </Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <Sonner />
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-blue-600" />
              <div>
                <CardTitle className="text-lg">Plano de Desenvolvimento Individual</CardTitle>
                <p className="text-sm text-gray-500 mt-1">Assinatura digital solicitada</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Colaborador:</span>
                <p className="font-medium">{data?.pdi?.colaborador_nome}</p>
              </div>
              <div>
                <span className="text-gray-500">Cargo:</span>
                <p className="font-medium">{data?.pdi?.colaborador_cargo || "N/A"}</p>
              </div>
              <div>
                <span className="text-gray-500">PDI:</span>
                <p className="font-medium">{data?.pdi?.titulo}</p>
              </div>
              <div>
                <span className="text-gray-500">Período:</span>
                <p className="font-medium">{data?.pdi?.data_inicio} a {data?.pdi?.data_fim}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Document Preview */}
        {docHtml && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Visualizar Documento</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <iframe
                srcDoc={docHtml}
                className="w-full border-0 rounded-b-lg"
                style={{ height: "60vh" }}
                title="Documento PDI"
                sandbox="allow-same-origin"
              />
            </CardContent>
          </Card>
        )}

        {/* Signature */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <PenLine className="w-4 h-4" />
              Assinar como: {data?.signatario_nome} ({data?.signatario_papel})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!showSignPad ? (
              <Button onClick={() => setShowSignPad(true)} className="w-full gap-2">
                <PenLine className="w-4 h-4" /> Assinar Documento
              </Button>
            ) : (
              <>
                <p className="text-sm text-gray-500">Desenhe sua assinatura no campo abaixo:</p>
                <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-white">
                  <SignatureCanvas
                    ref={sigCanvasRef}
                    canvasProps={{
                      width: 500,
                      height: 200,
                      className: "w-full",
                      style: { width: "100%", height: "200px" },
                    }}
                    backgroundColor="white"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => sigCanvasRef.current?.clear()}
                  >
                    Limpar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSign}
                    disabled={signing}
                    className="flex-1 gap-2"
                  >
                    {signing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Confirmar Assinatura
                  </Button>
                </div>
                <p className="text-xs text-gray-400 text-center">
                  Ao assinar, você confirma que leu e está de acordo com o conteúdo deste PDI. 
                  Seu IP e data/hora serão registrados para fins de auditoria.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
