import { useState, useEffect } from "react";
import { 
  Link as LinkIcon, 
  QrCode, 
  Copy, 
  Download, 
  CheckCircle2,
  ExternalLink,
  Shield,
  RefreshCw,
  FileText,
  Loader2
} from "lucide-react";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { gerarRelatorioCampanhaPsicossocial } from "@/utils/gerarRelatorioCampanhaPsicossocial";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { toast } from "sonner";
import QRCode from "qrcode";
import type { CampanhaPsicossocial } from "@/types/psicossocial";

interface DistribuicaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campanha: CampanhaPsicossocial;
}

export function DistribuicaoModal({ open, onOpenChange, campanha }: DistribuicaoModalProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [tokenPublico, setTokenPublico] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(false);
  const [copied, setCopied] = useState(false);
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false);
  const { empresaAtiva } = useEmpresaAtiva();

  // Usa a URL do ambiente ou a URL publicada (preferencialmente o novo domínio)
  const baseUrl = window.location.origin;
  const linkGeral = tokenPublico ? `${baseUrl}/questionario/${tokenPublico}` : null;

  const handleGerarRelatorio = async () => {
    if (!linkGeral || !empresaAtiva) {
      toast.error("Aguarde o link carregar");
      return;
    }
    setGerandoRelatorio(true);
    try {
      await gerarRelatorioCampanhaPsicossocial({
        empresaNome:
          (empresaAtiva as any).razao_social ||
          (empresaAtiva as any).nome_fantasia ||
          "Empresa",
        empresaCnpj: (empresaAtiva as any).cnpj || "",
        campanhaNome: campanha.nome,
        linkPublico: linkGeral,
        instrumento: campanha.instrumento || "SIPRO",
      });
      toast.success("Documento gerado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar documento. Tente novamente.");
    } finally {
      setGerandoRelatorio(false);
    }
  };

  // Busca ou gera o token público da campanha
  const carregarToken = async () => {
    setLoadingToken(true);
    try {
      const { data, error } = await fromTable("questionario_psicossocial_campanhas")
        .select("id, token_publico")
        .eq("id", campanha.id)
        .single() as { data: { id: string; token_publico: string | null } | null; error: any };

      if (error) throw error;

      let token = data?.token_publico;

      if (!token) {
        // Gera token único para a campanha
        token = Array.from(crypto.getRandomValues(new Uint8Array(12)))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');

        const { error: updateError } = await fromTable("questionario_psicossocial_campanhas")
          .update({ token_publico: token } as any)
          .eq("id", campanha.id);

        if (updateError) throw updateError;
      }

      setTokenPublico(token);
    } catch (err: any) {
      toast.error("Erro ao carregar link da campanha");
      console.error(err);
    } finally {
      setLoadingToken(false);
    }
  };

  // Gera QR Code a partir do link geral
  useEffect(() => {
    if (!linkGeral) return;
    QRCode.toDataURL(linkGeral, { 
      width: 240,
      margin: 2
    })
      .then(setQrCodeUrl)
      .catch(console.error);
  }, [linkGeral]);

  useEffect(() => {
    if (open) {
      carregarToken();
    }
  }, [open, campanha.id]);

  const handleCopy = () => {
    if (!linkGeral) return;
    navigator.clipboard.writeText(linkGeral);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadQR = () => {
    if (!qrCodeUrl) return;
    const a = document.createElement("a");
    a.download = `qrcode-${campanha.nome.replace(/\s+/g, "-").toLowerCase()}.png`;
    a.href = qrCodeUrl;
    a.click();
    toast.success("QR Code baixado!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-primary" />
            Distribuir Questionário
          </DialogTitle>
          <DialogDescription>
            Link único de acesso anônimo — Campanha: <strong>{campanha.nome}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Aviso de anonimato */}
        <Alert className="border-primary/30 bg-primary/5">
          <Shield className="h-4 w-4 text-primary" />
          <AlertDescription className="text-sm">
            <strong>Anonimato garantido.</strong> Este é um link único para toda a campanha. 
            Não é possível identificar quem respondeu. Compartilhe com todos os colaboradores.
          </AlertDescription>
        </Alert>

        {/* Link geral */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={linkGeral || (loadingToken ? "Carregando..." : "—")}
              readOnly
              className="font-mono text-xs bg-muted"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
              disabled={!linkGeral}
              title="Copiar link"
            >
              {copied
                ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                : <Copy className="h-4 w-4" />
              }
            </Button>
          </div>

          {/* Ações */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleDownloadQR}
              disabled={!qrCodeUrl}
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar QR Code
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => linkGeral && window.open(linkGeral, "_blank")}
              disabled={!linkGeral}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir link
            </Button>
          </div>

          {/* Gerar documento para a empresa */}
          <Button
            variant="default"
            className="w-full"
            onClick={handleGerarRelatorio}
            disabled={!linkGeral || gerandoRelatorio || campanha.status !== "ativa"}
          >
            {gerandoRelatorio ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando documento...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Gerar Documento da Empresa (PDF)
              </>
            )}
          </Button>
        </div>

        {/* QR Code */}
        {qrCodeUrl ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <img
              src={qrCodeUrl}
              alt="QR Code da campanha"
              className="rounded-xl border p-2 bg-white w-44 h-44"
            />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <QrCode className="h-3.5 w-3.5" />
              <span>Qualquer colaborador pode escanear e responder anonimamente</span>
            </div>
          </div>
        ) : loadingToken ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span className="text-sm">Gerando link...</span>
          </div>
        ) : null}

        {/* Status da campanha */}
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-xs text-muted-foreground">Status da campanha</span>
          <Badge variant={campanha.status === 'ativa' ? 'default' : 'secondary'}>
            {campanha.status === 'ativa' ? 'Ativa' : campanha.status === 'rascunho' ? 'Rascunho' : 'Encerrada'}
          </Badge>
        </div>

        {campanha.status !== 'ativa' && (
          <p className="text-xs text-destructive/80 text-center">
            ⚠️ Ative a campanha para que os colaboradores possam acessar o questionário.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
