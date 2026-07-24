import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, FileText, AlertTriangle, PenLine, Calendar, User, Building2 } from "lucide-react";
import SignatureCanvas from "react-signature-canvas";
import { toast } from "sonner";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { getSupabaseFunctionUrl } from "@/lib/supabaseFunctions";

const FUNCTION_URL = getSupabaseFunctionUrl("ferias-assinatura");

export default function FeriasAssinatura() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [showSignPad, setShowSignPad] = useState(false);
  const sigCanvasRef = useRef<SignatureCanvas>(null);
  const [docHtml, setDocHtml] = useState<string | null>(null);

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  // Busca o conteúdo do documento e injeta via srcDoc. Documentos antigos
  // foram salvos no storage com Content-Type errado (text/plain), e o iframe
  // por src respeita esse header — por isso apareciam com o HTML cru e os
  // acentos quebrados. Buscando o texto e forçando via srcDoc, o navegador
  // renderiza como HTML independentemente de como o arquivo foi salvo.
  useEffect(() => {
    const url = data?.documento_url;
    if (!url) { setDocHtml(null); return; }
    let ativo = true;
    (async () => {
      try {
        const res = await fetch(url);
        let texto = await res.text();
        // Garante charset mesmo se o arquivo antigo não declarava.
        if (!/<meta[^>]+charset/i.test(texto)) {
          texto = texto.replace(
            /<head(\s[^>]*)?>/i,
            (m) => `${m}<meta charset="utf-8">`
          );
          if (!/<head/i.test(texto)) {
            texto = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${texto}</body></html>`;
          }
        }
        if (ativo) setDocHtml(texto);
      } catch {
        if (ativo) setDocHtml(null); // cai no fallback por src
      }
    })();
    return () => { ativo = false; };
  }, [data?.documento_url]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${FUNCTION_URL}?token=${token}`, {
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar");
      setData(json);
      if (json.status === "assinado") setSigned(true);
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
      const assinatura_imagem = sigCanvasRef.current.toDataURL("image/png");

      const res = await fetch(`${FUNCTION_URL}?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assinatura_imagem }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao assinar");

      setSigned(true);
      toast.success("Aviso de férias assinado com sucesso!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSigning(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Sonner />
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando aviso de férias...</p>
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
            <h2 className="text-xl font-bold text-gray-900 mb-2">Aviso de Férias Assinado!</h2>
            <p className="text-gray-600 mb-4">
              A assinatura de <strong>{data?.colaborador_nome}</strong> foi registrada com sucesso.
            </p>
            <Badge className="bg-green-100 text-green-700">Assinatura concluída</Badge>
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
                <CardTitle className="text-lg">
                  {data?.tipo_documento === "recibo" ? "Recibo de Férias" : "Aviso de Férias"}
                </CardTitle>
                <p className="text-sm text-gray-500 mt-1">Assinatura digital do colaborador</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-start gap-2">
                <User className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <span className="text-gray-500">Colaborador</span>
                  <p className="font-medium">{data?.colaborador_nome}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Building2 className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <span className="text-gray-500">Departamento</span>
                  <p className="font-medium">{data?.departamento || "—"}</p>
                </div>
              </div>
              {data?.cargo && (
                <div className="flex items-start gap-2">
                  <User className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <span className="text-gray-500">Cargo</span>
                    <p className="font-medium">{data.cargo}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <span className="text-gray-500">Período de Férias</span>
                  <p className="font-medium">{formatDate(data?.data_inicio)} a {formatDate(data?.data_fim)}</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 text-sm space-y-1">
              <p><strong>Dias de férias:</strong> {data?.dias_ferias} dias</p>
              {data?.abono_pecuniario && (
                <p><strong>Abono pecuniário:</strong> {data?.dias_abono} dias</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Document Preview */}
        {data?.documento_url && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Documento do Aviso</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {docHtml ? (
                <iframe
                  srcDoc={docHtml}
                  className="w-full border-0 rounded-b-lg"
                  style={{ height: "60vh" }}
                  title="Aviso de Férias"
                  sandbox="allow-same-origin"
                />
              ) : (
                <iframe
                  src={data.documento_url}
                  className="w-full border-0 rounded-b-lg"
                  style={{ height: "60vh" }}
                  title="Aviso de Férias"
                  sandbox="allow-same-origin"
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* Signature */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <PenLine className="w-4 h-4" />
              Assinatura do Colaborador
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!showSignPad ? (
              <Button onClick={() => setShowSignPad(true)} className="w-full gap-2">
                <PenLine className="w-4 h-4" /> Assinar Aviso de Férias
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
                  <Button variant="outline" size="sm" onClick={() => sigCanvasRef.current?.clear()}>
                    Limpar
                  </Button>
                  <Button size="sm" onClick={handleSign} disabled={signing} className="flex-1 gap-2">
                    {signing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Confirmar Assinatura
                  </Button>
                </div>
                <p className="text-xs text-gray-400 text-center">
                  Ao assinar, você confirma ciência do aviso de férias. Seu IP e data/hora serão registrados para auditoria.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
