import { motion } from "framer-motion";
import {
  FileCheck,
  Download,
  Star,
  Calendar,
  Loader2,
  GraduationCap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useGamificacao, Certificado } from "@/hooks/useGamificacao";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";

function gerarCertificadoHTML(cert: Certificado, empresaNome?: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Certificado - ${cert.trilha_nome}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Playfair+Display:wght@700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f1f5f9; padding: 2rem; }
  .cert { width: 800px; background: white; border: 3px solid #0f172a; padding: 60px; position: relative; }
  .cert::before { content: ''; position: absolute; top: 8px; left: 8px; right: 8px; bottom: 8px; border: 1px solid #cbd5e1; pointer-events: none; }
  .header { text-align: center; margin-bottom: 40px; }
  .header h1 { font-family: 'Playfair Display', serif; font-size: 36px; color: #0f172a; letter-spacing: 4px; text-transform: uppercase; }
  .header .sub { font-size: 12px; color: #64748b; margin-top: 8px; letter-spacing: 2px; text-transform: uppercase; }
  .body { text-align: center; margin: 40px 0; }
  .body .name { font-size: 28px; font-weight: 700; color: #0f172a; border-bottom: 2px solid #0f172a; display: inline-block; padding-bottom: 4px; margin-bottom: 16px; }
  .body p { font-size: 14px; color: #475569; line-height: 1.8; }
  .body .trilha { font-weight: 600; color: #0f172a; }
  .footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 50px; }
  .footer .col { text-align: center; }
  .footer .label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
  .footer .value { font-size: 13px; color: #0f172a; font-weight: 600; margin-top: 4px; }
  .footer .line { width: 160px; border-top: 1px solid #cbd5e1; margin-bottom: 8px; }
  @media print { body { background: white; padding: 0; } .cert { border: none; } .cert::before { display: none; } }
</style>
</head>
<body>
<div class="cert">
  <div class="header">
    <h1>Certificado</h1>
    <div class="sub">de conclusão de trilha de desenvolvimento</div>
  </div>
  <div class="body">
    <div class="name">${cert.colaborador_nome}</div>
    <p>Concluiu com êxito a trilha de desenvolvimento</p>
    <p class="trilha" style="font-size: 20px; margin: 12px 0;">"${cert.trilha_nome}"</p>
    <p>obtendo <strong>${cert.pontos_obtidos} pontos</strong> no processo de aprendizagem.</p>
  </div>
  <div class="footer">
    <div class="col">
      <div class="line"></div>
      <div class="value">${format(new Date(cert.data_conclusao), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</div>
      <div class="label">Data de conclusão</div>
    </div>
    <div class="col">
      <div class="line"></div>
      <div class="value">${cert.codigo}</div>
      <div class="label">Código de autenticação</div>
    </div>
    <div class="col">
      <div class="line"></div>
      <div class="value">${empresaNome || "YourEyes"}</div>
      <div class="label">Empresa</div>
    </div>
  </div>
</div>
</body>
</html>`;
}

export function CertificadosList() {
  const { meusCertificados, loadingCertificados } = useGamificacao();
  const { profile } = useAuth();

  const handleDownload = (cert: Certificado) => {
    const html = gerarCertificadoHTML(cert, profile?.tenant_id ? undefined : undefined);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (w) {
      w.onload = () => {
        setTimeout(() => w.print(), 500);
      };
    }
  };

  if (loadingCertificados) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (meusCertificados.length === 0) {
    return (
      <div className="text-center py-16 bg-card rounded-xl border border-border">
        <GraduationCap className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" strokeWidth={1.5} />
        <p className="text-muted-foreground mb-1">Nenhum certificado emitido</p>
        <p className="text-xs text-muted-foreground">Complete trilhas para receber certificados!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {meusCertificados.map((cert, i) => (
        <motion.div
          key={cert.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.08 }}
        >
          <Card className="border-border hover:shadow-md transition-all">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-primary/10">
                    <FileCheck className="w-5 h-5 text-primary" strokeWidth={1.75} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">{cert.trilha_nome}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Código: {cert.codigo}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleDownload(cert)}>
                  <Download className="w-4 h-4 mr-1" />
                  Imprimir
                </Button>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{format(new Date(cert.data_conclusao), "dd/MM/yyyy")}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5" />
                  <span>{cert.pontos_obtidos} pontos</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
