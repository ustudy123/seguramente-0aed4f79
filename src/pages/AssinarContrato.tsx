import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabasePublic } from "@/lib/supabasePublic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertCircle, FileSignature, Shield, MapPin } from "lucide-react";
import { SignatureCapture } from "@/components/epi/entrega/SignatureCapture";
import { toast } from "sonner";

interface ContratoInfo {
  id: string;
  titulo: string;
  categoria: string;
  descricao_publica: string | null;
  corpo_html: string;
  versao: number;
  requer_cpf: boolean;
  requer_rg: boolean;
  requer_endereco: boolean;
  requer_telefone: boolean;
  requer_selfie: boolean;
  requer_geolocalizacao: boolean;
}

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export default function AssinarContrato() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [contrato, setContrato] = useState<ContratoInfo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [signatarioEmail, setSignatarioEmail] = useState<string>("");

  // Form
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [rg, setRg] = useState("");
  const [endereco, setEndereco] = useState("");
  const [aceito, setAceito] = useState(false);
  const [assinatura, setAssinatura] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [streamAtivo, setStreamAtivo] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) return;
      const { data, error } = await supabasePublic.rpc("obter_contrato_publico" as any, { _token: token });
      setLoading(false);
      if (error) { setErro("Erro ao carregar contrato"); return; }
      const result = data as any;
      if (result?.erro) {
        const map: Record<string, string> = {
          token_invalido: "Link inválido ou expirado.",
          ja_assinado: "Este contrato já foi assinado.",
          revogado: "Este link foi revogado.",
          expirado: "Este link expirou.",
          contrato_inativo: "Este contrato não está mais disponível.",
          limite_atingido: "Limite de assinaturas atingido.",
        };
        setErro(map[result.erro] || "Não foi possível abrir o contrato.");
        return;
      }
      setContrato(result.contrato);
      setSignatarioEmail(result.assinatura?.signatario_email || "");
      if (result.assinatura?.signatario_email) setEmail(result.assinatura.signatario_email);
      if (result.assinatura?.signatario_nome) setNome(result.assinatura.signatario_nome);
    })();
  }, [token]);

  const capturarGeo = () => {
    if (!navigator.geolocation) { toast.error("Geolocalização indisponível"); return; }
    navigator.geolocation.getCurrentPosition(
      p => { setGeo({ lat: p.coords.latitude, lng: p.coords.longitude }); toast.success("Localização capturada"); },
      () => toast.error("Não foi possível capturar localização")
    );
  };

  const iniciarCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (videoRef.current) { videoRef.current.srcObject = stream; setStreamAtivo(true); }
    } catch { toast.error("Não foi possível acessar a câmera"); }
  };

  const capturarSelfie = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    setSelfie(canvas.toDataURL("image/jpeg", 0.7));
    (videoRef.current.srcObject as MediaStream)?.getTracks().forEach(t => t.stop());
    setStreamAtivo(false);
    toast.success("Selfie capturada");
  };

  const handleEnviar = async () => {
    if (!contrato || !token) return;
    if (!aceito) { toast.error("Você precisa concordar com os termos"); return; }
    if (!nome.trim()) { toast.error("Informe seu nome"); return; }
    if (contrato.requer_cpf && !cpf.trim()) { toast.error("CPF obrigatório"); return; }
    if (contrato.requer_telefone && !telefone.trim()) { toast.error("Telefone obrigatório"); return; }
    if (contrato.requer_rg && !rg.trim()) { toast.error("RG obrigatório"); return; }
    if (contrato.requer_endereco && !endereco.trim()) { toast.error("Endereço obrigatório"); return; }
    if (contrato.requer_selfie && !selfie) { toast.error("Selfie obrigatória"); return; }
    if (contrato.requer_geolocalizacao && !geo) { toast.error("Capture sua localização"); return; }
    if (!assinatura) { toast.error("Assine no campo abaixo"); return; }

    setEnviando(true);
    try {
      const hash = await sha256(
        `${contrato.id}|${contrato.versao}|${contrato.corpo_html}|${nome}|${cpf}|${email}|${Date.now()}`
      );

      let ip: string | null = null;
      try {
        const r = await fetch("https://api.ipify.org?format=json");
        ip = (await r.json()).ip;
      } catch {}

      const { data, error } = await supabasePublic.rpc("registrar_assinatura_contrato" as any, {
        _token: token,
        _nome: nome,
        _cpf: cpf || null,
        _email: email || null,
        _telefone: telefone || null,
        _rg: rg || null,
        _endereco: endereco || null,
        _assinatura_imagem: assinatura,
        _selfie_imagem: selfie,
        _ip: ip,
        _user_agent: navigator.userAgent,
        _geo_lat: geo?.lat ?? null,
        _geo_lng: geo?.lng ?? null,
        _hash: hash,
      });
      if (error) throw error;
      const result = data as any;
      if (!result.ok) {
        toast.error(result.erro === "ja_assinado" ? "Contrato já foi assinado" : "Erro ao registrar assinatura");
        return;
      }
      setSucesso(true);
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar assinatura");
    } finally {
      setEnviando(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (erro) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="w-16 h-16 mx-auto text-destructive" />
            <h1 className="text-xl font-semibold">Não foi possível abrir o contrato</h1>
            <p className="text-muted-foreground">{erro}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (sucesso) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-500" />
            <h1 className="text-2xl font-semibold">Contrato assinado!</h1>
            <p className="text-muted-foreground">
              Sua assinatura foi registrada com sucesso e tem validade jurídica conforme Lei 14.063/2020.
            </p>
            <p className="text-xs text-muted-foreground">Você pode fechar esta janela.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!contrato) return null;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-3">
            <FileSignature className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">{contrato.titulo}</h1>
          {contrato.descricao_publica && (
            <p className="text-muted-foreground mt-2">{contrato.descricao_publica}</p>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Termos do contrato</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="prose prose-sm max-w-none max-h-[400px] overflow-y-auto border rounded p-4 bg-muted/30"
              dangerouslySetInnerHTML={{ __html: contrato.corpo_html }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Seus dados</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label>Nome completo *</Label>
                <Input value={nome} onChange={e => setNome(e.target.value)} />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={!!signatarioEmail} />
              </div>
              {contrato.requer_cpf && (
                <div>
                  <Label>CPF *</Label>
                  <Input value={cpf} onChange={e => setCpf(e.target.value)} />
                </div>
              )}
              {contrato.requer_telefone && (
                <div>
                  <Label>Telefone *</Label>
                  <Input value={telefone} onChange={e => setTelefone(e.target.value)} />
                </div>
              )}
              {contrato.requer_rg && (
                <div>
                  <Label>RG *</Label>
                  <Input value={rg} onChange={e => setRg(e.target.value)} />
                </div>
              )}
              {contrato.requer_endereco && (
                <div className="md:col-span-2">
                  <Label>Endereço completo *</Label>
                  <Input value={endereco} onChange={e => setEndereco(e.target.value)} />
                </div>
              )}
            </div>

            {contrato.requer_geolocalizacao && (
              <div>
                <Button type="button" variant="outline" size="sm" onClick={capturarGeo}>
                  <MapPin className="w-4 h-4 mr-2" />
                  {geo ? `Localização: ${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)}` : "Capturar localização *"}
                </Button>
              </div>
            )}

            {contrato.requer_selfie && (
              <div className="border rounded-lg p-4 space-y-3">
                <Label>Selfie ao vivo *</Label>
                {selfie ? (
                  <div className="space-y-2">
                    <img src={selfie} alt="selfie" className="max-w-xs rounded border" />
                    <Button size="sm" variant="outline" onClick={() => { setSelfie(null); iniciarCamera(); }}>Refazer</Button>
                  </div>
                ) : streamAtivo ? (
                  <div className="space-y-2">
                    <video ref={videoRef} autoPlay playsInline className="max-w-xs rounded border" />
                    <Button size="sm" onClick={capturarSelfie}>Capturar</Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={iniciarCamera}>Iniciar câmera</Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start gap-2">
              <Checkbox id="aceito" checked={aceito} onCheckedChange={v => setAceito(!!v)} />
              <Label htmlFor="aceito" className="text-sm leading-relaxed cursor-pointer">
                Li e concordo com todos os termos do contrato acima. Declaro que as informações
                fornecidas são verdadeiras e autorizo o registro desta assinatura eletrônica.
              </Label>
            </div>

            {!assinatura ? (
              <SignatureCapture onCapture={setAssinatura} colaboradorNome={nome || "Signatário"} />
            ) : (
              <div className="space-y-2">
                <Label>Sua assinatura</Label>
                <img src={assinatura} alt="assinatura" className="max-w-xs border rounded bg-white" />
                <Button size="sm" variant="outline" onClick={() => setAssinatura(null)}>Refazer assinatura</Button>
              </div>
            )}

            <Alert>
              <Shield className="h-4 w-4" />
              <AlertTitle>Validade jurídica</AlertTitle>
              <AlertDescription className="text-xs">
                Sua assinatura será registrada com IP, dispositivo, data/hora e hash criptográfico,
                conforme Lei 14.063/2020 e MP 2.200-2/2001.
              </AlertDescription>
            </Alert>

            <Button onClick={handleEnviar} disabled={enviando || !aceito || !assinatura} className="w-full" size="lg">
              {enviando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Registrando...</> : "Assinar contrato"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
