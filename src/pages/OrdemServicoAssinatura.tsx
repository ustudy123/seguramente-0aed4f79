import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertTriangle, MapPin, Camera } from "lucide-react";
import { supabasePublic } from "@/lib/supabasePublic";
import { PontoSelfieCapture } from "@/components/ponto/PontoSelfieCapture";
import { useGeolocation } from "@/hooks/useGeolocation";
import { toast } from "sonner";
import { format } from "date-fns";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function OrdemServicoAssinatura() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [os, setOs] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [showSelfie, setShowSelfie] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [assinada, setAssinada] = useState(false);
  const { coords, loading: geoLoading, getLocation } = useGeolocation();

  useEffect(() => {
    document.title = "Ordem de Serviço — Assinatura";
    if (!token) return;
    (async () => {
      try {
        const { data, error } = await supabasePublic.rpc("obter_ordem_servico_publica", { p_token: token });
        if (error) throw error;
        const d: any = data;
        if (d?.erro) {
          setErro(d.erro === "token_expirado" ? "Este link expirou." : "Link inválido.");
        } else {
          setOs(d);
          if (d?.status === "assinada") setAssinada(true);
        }
      } catch (e: any) {
        setErro(e.message);
      } finally {
        setLoading(false);
      }
    })();
    getLocation();
  }, [token]);

  async function uploadSelfie(blob: Blob): Promise<string | null> {
    try {
      const fileName = `os/${token}_${Date.now()}.jpg`;
      const formData = new FormData();
      formData.append("file", blob, fileName);
      // Usar fetch direto para o storage público
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/atestados/${fileName}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${ANON}`, apikey: ANON },
        body: blob,
      });
      if (!res.ok) return null;
      return fileName;
    } catch {
      return null;
    }
  }

  async function handleSelfieCapturada(blob: Blob) {
    setShowSelfie(false);
    setEnviando(true);
    try {
      const selfieUrl = await uploadSelfie(blob);
      const { data, error } = await supabasePublic.rpc("assinar_ordem_servico_publica", {
        p_token: token,
        p_selfie_url: selfieUrl,
        p_geo: coords ? { lat: coords.lat, lng: coords.lng, acc: coords.accuracy } : null,
        p_ip: null,
      });
      if (error) throw error;
      const d: any = data;
      if (d?.sucesso) {
        toast.success("Ordem de Serviço assinada!");
        setAssinada(true);
      } else {
        toast.error("Erro: " + (d?.erro || "desconhecido"));
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setEnviando(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (erro) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto text-destructive mb-3" />
            <p className="font-semibold">{erro}</p>
            <p className="text-sm text-muted-foreground mt-2">Solicite um novo link ao seu RH.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-6 px-3">
      <div className="max-w-3xl mx-auto space-y-4">
        <Card>
          <CardHeader className="bg-primary/5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-lg">{os?.numero}</CardTitle>
              <Badge variant={assinada ? "default" : "secondary"}>
                {assinada ? "Assinada" : "Aguardando assinatura"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Função: {os?.cargo} — Setor: {os?.setor} — Vigência: {os?.data_vigencia ? format(new Date(os.data_vigencia), "dd/MM/yyyy") : "—"}
            </p>
          </CardHeader>
          <CardContent className="pt-4">
            <div
              className="prose prose-sm max-w-none border rounded p-4 bg-background"
              dangerouslySetInnerHTML={{ __html: os?.conteudo_html || "" }}
            />
          </CardContent>
        </Card>

        {assinada ? (
          <Card>
            <CardContent className="py-6 text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto text-primary mb-3" />
              <p className="font-semibold">Você já assinou esta Ordem de Serviço.</p>
              <p className="text-sm text-muted-foreground mt-1">Uma cópia foi arquivada no seu prontuário.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-5 space-y-3">
              <p className="text-sm font-medium">Para assinar, confirme sua identidade com selfie e localização:</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="w-3.5 h-3.5" />
                {geoLoading ? "Capturando localização..." : coords ? `Localização capturada (±${Math.round(coords.accuracy)}m)` : "Sem localização"}
              </div>
              <Button
                size="lg"
                className="w-full"
                disabled={enviando || !coords}
                onClick={() => setShowSelfie(true)}
              >
                {enviando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</> : <><Camera className="w-4 h-4 mr-2" /> Capturar selfie e assinar</>}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                Ao assinar, declaro ciência dos riscos, EPIs, procedimentos e penalidades descritos acima (NR-1, art. 157 CLT).
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <PontoSelfieCapture
        open={showSelfie}
        onOpenChange={setShowSelfie}
        onCapture={handleSelfieCapturada}
      />
    </div>
  );
}
