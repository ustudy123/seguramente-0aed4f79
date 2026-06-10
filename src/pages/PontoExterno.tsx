import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, MapPin, LogIn, LogOut, CheckCircle2, AlertCircle, Loader2, Shield, FileEdit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabasePublic } from "@/lib/supabasePublic";
import { useGeolocation } from "@/hooks/useGeolocation";
import { PontoSelfieCapture } from "@/components/ponto/PontoSelfieCapture";
import { SolicitarAjusteModal } from "@/components/ponto/SolicitarAjusteModal";
import { PontoPWASetup } from "@/components/ponto/PontoPWASetup";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ColaboradorData {
  colaborador_nome: string;
  colaborador_cpf_parcial: string;
  tenant_id: string;
  colaborador_id: string;
  colaborador_cpf: string;
}

interface RegistroResult {
  success: boolean;
  colaborador_nome: string;
  tipo_marcacao: string;
  hora: string;
  data: string;
}

const TIPO_LABELS: Record<"entrada" | "saida", { label: string; icon: React.ReactNode; color: string }> = {
  entrada: { label: "Entrada", icon: <LogIn className="w-5 h-5" />, color: "bg-emerald-500 hover:bg-emerald-600" },
  saida: { label: "Saída", icon: <LogOut className="w-5 h-5" />, color: "bg-rose-500 hover:bg-rose-600" },
};

const traduzirErroPonto = (mensagem?: string | null) => {
  const texto = (mensagem || "").trim();

  if (!texto) return "Não foi possível registrar o ponto agora. Tente novamente em instantes.";
  if (texto.includes('column "origem"')) return "Não foi possível concluir o registro de ponto agora. Tente novamente em instantes.";
  if (texto.includes("Link inválido") || texto.includes("expirado")) return "Link inválido ou expirado.";
  if (/tipo inválido/i.test(texto)) return "Use apenas Entrada ou Saída.";
  if (/Aguarde pelo menos 10 minutos/i.test(texto)) {
    return "Sua marcação anterior já foi registrada com sucesso ✓ Por segurança, aguarde alguns minutos antes da próxima batida.";
  }

  return texto;
};

const PontoExterno = () => {
  const { token } = useParams<{ token: string }>();
  const geo = useGeolocation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [colaborador, setColaborador] = useState<ColaboradorData | null>(null);
  const [registrando, setRegistrando] = useState(false);
  const [resultado, setResultado] = useState<RegistroResult | null>(null);

  // Selfie
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [ajusteOpen, setAjusteOpen] = useState(false);

  // Clock
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (token) return;

    try {
      const savedPath = window.localStorage.getItem("ponto-pwa-path");
      const savedToken = window.localStorage.getItem("ponto-pwa-token");
      const fallbackPath = savedToken ? `/ponto-externo/${savedToken}` : null;
      const targetPath = savedPath || fallbackPath;

      if (targetPath && targetPath !== window.location.pathname) {
        window.location.replace(targetPath);
        return;
      }
    } catch {
      // Se não conseguir ler o storage, mantém o fluxo normal da página.
    }

    if (standalone) {
      setError("Abra novamente o link original de ponto para atualizar o atalho deste colaborador.");
      setLoading(false);
    }
  }, [token]);

  // Load collaborator data
  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabasePublic.rpc("buscar_ponto_link_por_token", { p_token: token });
      if (error || !data) {
        setError("Link inválido ou expirado.");
        setLoading(false);
        return;
      }
      const result = data as any;
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      setColaborador(result);
      setLoading(false);
    })();
  }, [token]);

  // Próximo tipo a registrar (decidido pelo backend)
  const [proximoTipo, setProximoTipo] = useState<"entrada" | "saida">("entrada");

  const carregarProximoTipo = useCallback(async () => {
    if (!token) return;
    const { data } = await supabasePublic.rpc("proximo_tipo_marcacao_externo", { p_token: token });
    const r = data as any;
    if (r?.proximo_tipo === "saida" || r?.proximo_tipo === "entrada") {
      setProximoTipo(r.proximo_tipo);
    }
  }, [token]);

  // Auto-capture geolocation + carrega próximo tipo
  useEffect(() => {
    if (colaborador) {
      geo.capturarLocalizacao();
      carregarProximoTipo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colaborador]);

  const handleRegistrar = useCallback(async () => {
    if (!token || !colaborador) return;
    setError(null);
    setRegistrando(true);
    try {
      // Sobe a selfie (se capturada) e obtém a URL pública — mesmo padrão do kiosk interno
      let selfieUrl: string | null = null;
      let selfieNome: string | null = null;
      if (selfieFile) {
        const fileName = `externo/${colaborador.colaborador_id}/${Date.now()}_${proximoTipo}.jpg`;
        const { data: uploadData, error: uploadError } = await supabasePublic.storage
          .from("ponto-selfies")
          .upload(fileName, selfieFile, { contentType: "image/jpeg" });
        if (!uploadError && uploadData) {
          const { data: urlData } = supabasePublic.storage.from("ponto-selfies").getPublicUrl(uploadData.path);
          selfieUrl = urlData.publicUrl;
          selfieNome = selfieFile.name || `selfie_${proximoTipo}.jpg`;
        }
        // Se o upload falhar, o registro segue sem selfie — registrar o ponto é prioridade
      }

      const { data, error } = await supabasePublic.rpc("registrar_ponto_externo", {
        p_token: token,
        p_tipo_marcacao: proximoTipo,
        p_latitude: geo.latitude,
        p_longitude: geo.longitude,
        p_endereco: geo.endereco,
        p_selfie_url: selfieUrl,
        p_selfie_nome: selfieNome,
      });
      if (error) {
        setError(traduzirErroPonto(error.message));
        setRegistrando(false);
        return;
      }
      const result = data as any;
      if (result.error) {
        setError(traduzirErroPonto(result.error));
        setRegistrando(false);
        return;
      }
      setResultado(result);
      carregarProximoTipo();
    } catch (e: any) {
      setError(traduzirErroPonto(e.message));
    }
    setRegistrando(false);
  }, [token, colaborador, geo.latitude, geo.longitude, geo.endereco, selfieFile, proximoTipo]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !colaborador) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <h2 className="text-xl font-bold">Link Inválido</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (resultado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <Card className="w-full max-w-md">
            <CardContent className="pt-6 text-center space-y-4">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
              <h2 className="text-xl font-bold">Ponto Registrado!</h2>
              <div className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">Colaborador:</span> <strong>{resultado.colaborador_nome}</strong></p>
                <p><span className="text-muted-foreground">Tipo:</span> <Badge>{TIPO_LABELS[resultado.tipo_marcacao]?.label || resultado.tipo_marcacao}</Badge></p>
                <p><span className="text-muted-foreground">Hora:</span> <strong className="font-mono text-lg">{resultado.hora?.substring(0, 5)}</strong></p>
                <p><span className="text-muted-foreground">Data:</span> {resultado.data}</p>
              </div>
              {/* Location captured silently for RH only */}
              <div className="pt-2">
                <Badge variant="outline" className="text-xs">
                  <Shield className="w-3 h-3 mr-1" /> Registro auditável • Link externo
                </Badge>
              </div>
              <Button variant="outline" onClick={() => { setResultado(null); setError(null); setSelfieFile(null); setSelfiePreview(null); carregarProximoTipo(); }} className="w-full mt-4">
                Registrar outra marcação
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 flex flex-col items-center justify-start pt-8 gap-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
          <Clock className="w-6 h-6 text-primary" /> Registro de Ponto
        </h1>
        <p className="text-slate-400 text-sm">Registre sua marcação de forma segura</p>
      </motion.div>

      {/* Clock */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
        className="text-center">
        <div className="text-5xl font-mono font-bold text-white tracking-wider">
          {format(currentTime, "HH:mm:ss")}
        </div>
        <p className="text-slate-400 text-sm mt-1">
          {format(currentTime, "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </p>
      </motion.div>

      {/* Collaborator Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="w-full max-w-md">
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="text-center">
              <h3 className="font-semibold text-lg">{colaborador?.colaborador_nome}</h3>
              <p className="text-xs text-muted-foreground font-mono">{colaborador?.colaborador_cpf_parcial}</p>
            </div>

            {/* Geolocation captured silently for RH only */}

            {/* Selfie */}
            <PontoSelfieCapture
              selfieFile={selfieFile}
              selfiePreview={selfiePreview}
              onChange={(file, preview) => { setSelfieFile(file); setSelfiePreview(preview); }}
            />

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded-md">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
                <Button variant="ghost" size="sm" className="ml-auto text-xs h-6" onClick={() => setError(null)}>OK</Button>
              </div>
            )}

            {/* Botão único: tipo decidido automaticamente */}
            {(() => {
              const cfg = TIPO_LABELS[proximoTipo];
              return (
                <Button
                  className={`${cfg.color} text-white h-16 w-full flex items-center justify-center gap-2 text-base font-semibold`}
                  disabled={registrando}
                  onClick={handleRegistrar}
                >
                  {registrando ? <Loader2 className="w-5 h-5 animate-spin" /> : cfg.icon}
                  Registrar {cfg.label}
                </Button>
              );
            })()}

            {/* Solicitar Ajuste */}
            <Button
              variant="outline"
              className="w-full mt-2 h-10 text-xs"
              onClick={() => setAjusteOpen(true)}
            >
              <FileEdit className="w-4 h-4 mr-2" /> Solicitar Ajuste de Ponto
            </Button>

            {/* Instalar como app (PWA) - só fora do preview/iframe */}
            <PontoPWASetup token={token} />
          </CardContent>
        </Card>
      </motion.div>

      <p className="text-slate-500 text-[10px] text-center max-w-xs">
        Registro via link externo • Geolocalização e horário capturados automaticamente • Dados protegidos
      </p>

      {colaborador && (
        <SolicitarAjusteModal
          open={ajusteOpen}
          onOpenChange={setAjusteOpen}
          token={token!}
          colaboradorNome={colaborador.colaborador_nome}
        />
      )}
    </div>
  );
};

export default PontoExterno;
