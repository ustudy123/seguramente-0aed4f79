import { useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Toaster as Sonner } from "@/components/ui/sonner";
import SignatureCanvas from "react-signature-canvas";
import { CheckCircle2, FileText, Loader2, PenLine, RotateCcw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getSupabaseFunctionUrl } from "@/lib/supabaseFunctions";

const FUNCTION_URL = getSupabaseFunctionUrl("experiencia-assinatura");

export default function ExperienciaAssinatura() {
  const { token } = useParams<{ token: string }>();
  const sigRef = useRef<SignatureCanvas>(null);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [etapa, setEtapa] = useState<"leitura" | "assinatura">("leitura");

  const { data, isLoading, error } = useQuery({
    queryKey: ["experiencia-assinatura", token],
    queryFn: async () => {
      const res = await fetch(`${FUNCTION_URL}?token=${token}`, {
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(err.error || `Erro ${res.status}`);
      }
      return res.json();
    },
    enabled: !!token,
  });

  const handleSign = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast.error("Desenhe sua assinatura antes de confirmar.");
      return;
    }

    setSigning(true);
    try {
      const assinatura_base64 = sigRef.current.toDataURL("image/png");
      const res = await fetch(`${FUNCTION_URL}?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assinatura_base64 }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro" }));
        throw new Error(err.error);
      }

      setSigned(true);
      toast.success("Assinatura registrada com sucesso!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSigning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Sonner />
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Sonner />
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-red-400" />
            <h2 className="text-xl font-bold mb-2">Link inválido ou expirado</h2>
            <p className="text-gray-500 text-sm">{(error as Error)?.message || "Não foi possível carregar o documento."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (signed || data.status === "assinado") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Sonner />
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500" />
            <h2 className="text-xl font-bold mb-2">Documento Assinado!</h2>
            <p className="text-gray-600 mb-4">
              Assinatura registrada com sucesso para <strong>{data.colaborador_nome}</strong>.
            </p>
            <Badge className="bg-green-100 text-green-700">Assinatura concluída</Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  const TIPO_LABELS: Record<string, string> = {
    contrato: "Contrato de Experiência",
    prorrogacao: "Termo de Prorrogação",
    efetivacao: "Termo de Efetivação",
    rescisao: "Termo de Rescisão",
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <Sonner />
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            <span className="font-semibold text-blue-600">YourEyes</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {TIPO_LABELS[data.tipo_documento] || "Documento de Experiência"}
          </h1>
          <p className="text-gray-500 text-sm">
            Assinatura digital solicitada para <strong>{data.signatario_nome}</strong> ({data.signatario_papel})
          </p>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-center gap-4 text-sm">
          <div className={`flex items-center gap-1.5 ${etapa === "leitura" ? "text-blue-600 font-medium" : "text-gray-400"}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${etapa === "leitura" ? "bg-blue-600 text-white" : "bg-gray-200"}`}>1</span>
            Leitura
          </div>
          <div className="h-px w-8 bg-gray-300" />
          <div className={`flex items-center gap-1.5 ${etapa === "assinatura" ? "text-blue-600 font-medium" : "text-gray-400"}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${etapa === "assinatura" ? "bg-blue-600 text-white" : "bg-gray-200"}`}>2</span>
            Assinatura
          </div>
        </div>

        {/* Info card */}
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="py-3 px-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Colaborador</p>
                <p className="font-medium text-gray-900">{data.colaborador_nome}</p>
              </div>
              <div>
                <p className="text-gray-500">Cargo</p>
                <p className="font-medium text-gray-900">{data.cargo || "—"}</p>
              </div>
              <div>
                <p className="text-gray-500">Admissão</p>
                <p className="font-medium text-gray-900">
                  {data.data_admissao ? new Date(data.data_admissao + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {etapa === "leitura" && (
          <Card>
            <CardContent className="p-0">
              {data.documento_html ? (
                <div className="border rounded-lg overflow-hidden" style={{ height: "55vh" }}>
                  <iframe
                    srcDoc={data.documento_html}
                    className="w-full h-full"
                    title="Documento"
                    sandbox="allow-same-origin"
                  />
                </div>
              ) : data.documento_url ? (
                <div className="border rounded-lg overflow-hidden" style={{ height: "55vh" }}>
                  <iframe
                    src={data.documento_url}
                    className="w-full h-full"
                    title="Documento"
                  />
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>Documento não disponível para visualização.</p>
                </div>
              )}
              <div className="p-4 border-t bg-gray-50 flex justify-end">
                <Button onClick={() => setEtapa("assinatura")} className="bg-blue-600 hover:bg-blue-700">
                  Li e compreendi o documento
                  <PenLine className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {etapa === "assinatura" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <PenLine className="w-4 h-4" />
                Assine abaixo — {data.signatario_nome}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">Assinatura</label>
                  <button
                    onClick={() => sigRef.current?.clear()}
                    className="text-xs text-gray-400 flex items-center gap-1 hover:text-gray-700"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Limpar
                  </button>
                </div>
                <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-white">
                  <SignatureCanvas
                    ref={sigRef}
                    canvasProps={{ className: "w-full", height: 180 }}
                    backgroundColor="white"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Desenhe sua assinatura com o mouse ou dedo</p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setEtapa("leitura")}>
                  Voltar
                </Button>
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  disabled={signing}
                  onClick={handleSign}
                >
                  {signing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Registrando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Confirmar Assinatura
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
