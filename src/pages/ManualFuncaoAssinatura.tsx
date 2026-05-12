import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle2, AlertTriangle, MapPin, ShieldCheck, FileText } from "lucide-react";
import { supabasePublic } from "@/lib/supabasePublic";
import { PontoSelfieCapture } from "@/components/ponto/PontoSelfieCapture";
import { useGeolocation } from "@/hooks/useGeolocation";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function ManualFuncaoAssinatura() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<any>(null);
  const [enviando, setEnviando] = useState(false);
  const [assinada, setAssinada] = useState(false);
  const [aceite, setAceite] = useState(false);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);

  const { latitude, longitude, accuracy, loading: geoLoading, capturarLocalizacao } = useGeolocation();

  useEffect(() => {
    document.title = "Manual da Função — Assinatura";
    if (!token) return;
    (async () => {
      try {
        const { data, error } = await supabasePublic.rpc("obter_assinatura_manual_publica", { p_token: token });
        if (error) throw error;
        const d: any = data;
        if (d?.erro) {
          if (d.erro === "aguardando_colaborador") {
            setErro(`Aguardando o colaborador ${d.colaborador} assinar primeiro.`);
          } else {
            setErro(d.erro === "token_expirado" ? "Este link expirou." : "Link inválido.");
          }
        } else {
          setDados(d);
          if (d?.ja_assinou) setAssinada(true);
          if (d?.tipo_assinante === "colaborador") setNome(d?.colaborador_nome || "");
          else setNome(d?.gestor_nome || "");
        }
      } catch (e: any) {
        setErro(e.message);
      } finally {
        setLoading(false);
      }
    })();
    capturarLocalizacao().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function uploadSelfie(file: File): Promise<string | null> {
    try {
      const fileName = `manual-funcao/${token}_${Date.now()}.jpg`;
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/atestados/${fileName}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${ANON}`, apikey: ANON, "Content-Type": file.type || "image/jpeg" },
        body: file,
      });
      if (!res.ok) return null;
      return fileName;
    } catch {
      return null;
    }
  }

  async function handleAssinar() {
    if (!aceite) { toast.error("Confirme o aceite do termo."); return; }
    if (!nome.trim()) { toast.error("Informe seu nome completo."); return; }
    if (!cpf.replace(/\D/g, "")) { toast.error("Informe seu CPF."); return; }
    if (!selfieFile) { toast.error("Capture sua selfie."); return; }
    if (!latitude || !longitude) { toast.error("Localização obrigatória. Ative o GPS."); return; }
    setEnviando(true);
    try {
      const selfieUrl = await uploadSelfie(selfieFile);
      const { data, error } = await supabasePublic.rpc("assinar_manual_funcao_publica", {
        p_token: token,
        p_nome: nome,
        p_cpf: cpf,
        p_selfie_url: selfieUrl,
        p_geo: { lat: latitude, lng: longitude, acc: accuracy },
        p_ip: null,
      });
      if (error) throw error;
      const d: any = data;
      if (d?.sucesso) {
        toast.success(d.concluido ? "Manual concluído e arquivado!" : "Assinatura registrada!");
        setAssinada(true);
        // Trigger archiving when both signed
        if (d.concluido && d.assinatura_id) {
          try {
            await supabasePublic.functions.invoke("manual-funcao-assinatura-finalizar", {
              body: { assinatura_id: d.assinatura_id },
            });
          } catch { /* ignore — server-side archival will retry */ }
        }
      } else {
        const msg = d?.erro === "cpf_divergente"
          ? "CPF informado não confere com o cadastro."
          : d?.erro === "ja_assinada"
          ? "Este link já foi utilizado."
          : (d?.erro || "Erro desconhecido");
        toast.error(msg);
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

  const papel = dados?.tipo_assinante === "colaborador" ? "Colaborador(a)" : "Gestor(a) Imediato(a)";

  return (
    <div className="min-h-screen bg-muted/30 py-6 px-3">
      <div className="max-w-3xl mx-auto space-y-4">
        <Card>
          <CardHeader className="bg-primary/5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                {dados?.manual_titulo || "Manual da Função"}
              </CardTitle>
              <Badge variant={assinada ? "default" : "secondary"}>
                {assinada ? "Assinado" : `Aguardando assinatura — ${papel}`}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Função: {dados?.cargo} — Colaborador: {dados?.colaborador_nome}
            </p>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="text-xs font-medium text-muted-foreground uppercase">Manual da Função</div>
            <div
              className="prose prose-sm max-w-none border rounded p-4 bg-background max-h-[420px] overflow-auto"
              dangerouslySetInnerHTML={{ __html: dados?.manual_html || "" }}
            />
            <div className="text-xs font-medium text-muted-foreground uppercase pt-2">Termo de Ciência</div>
            <div
              className="prose prose-sm max-w-none border rounded p-4 bg-amber-50/30"
              dangerouslySetInnerHTML={{ __html: dados?.termo_html || "" }}
            />
          </CardContent>
        </Card>

        {assinada ? (
          <Card>
            <CardContent className="py-6 text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto text-primary mb-3" />
              <p className="font-semibold">Assinatura registrada com sucesso.</p>
              <p className="text-sm text-muted-foreground mt-1">
                {dados?.tipo_assinante === "colaborador" && !dados?.assinatura_gestor && dados?.gestor_nome
                  ? "Aguardando assinatura do gestor imediato para conclusão."
                  : "Uma cópia foi arquivada na pasta do colaborador no módulo Documentos."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-5 space-y-4">
              <p className="text-sm font-medium flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                Assinatura Digital — {papel}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nome completo</Label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">CPF</Label>
                  <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
                </div>
              </div>

              <PontoSelfieCapture
                selfieFile={selfieFile}
                selfiePreview={selfiePreview}
                onChange={(f, p) => { setSelfieFile(f); setSelfiePreview(p); }}
              />

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="w-3.5 h-3.5" />
                {geoLoading ? "Capturando localização..." : (latitude && longitude) ? `Localização capturada (±${Math.round(accuracy || 0)}m)` : "Sem localização — clique para capturar"}
                {(!latitude || !longitude) && (
                  <Button size="sm" variant="link" className="h-auto p-0 text-xs" onClick={() => capturarLocalizacao().catch(() => {})}>
                    Capturar GPS
                  </Button>
                )}
              </div>

              <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
                <Checkbox checked={aceite} onCheckedChange={(v) => setAceite(!!v)} className="mt-0.5" />
                <span>
                  Declaro que li e compreendi o Manual da Função e o Termo de Ciência, Acordo e Comprometimento acima,
                  e <strong>concordo</strong> com seus termos. Esta assinatura tem validade jurídica conforme MP 2.200-2/2001 e Lei nº 14.063/2020.
                </span>
              </label>

              <Button
                size="lg"
                className="w-full"
                disabled={enviando || !aceite || !selfieFile || !latitude || !longitude}
                onClick={handleAssinar}
              >
                {enviando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</> : <><CheckCircle2 className="w-4 h-4 mr-2" /> Assinar Manual</>}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
