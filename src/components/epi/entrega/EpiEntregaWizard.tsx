import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { LivenessDetection } from "./LivenessDetection";
import { PhotoCapture } from "./PhotoCapture";
import { SignatureCapture } from "./SignatureCapture";
import { EpiEntregaRecibo } from "./EpiEntregaRecibo";
import { useColaboradores } from "@/hooks/useColaboradores";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { Loader2, Download, ArrowLeft, ArrowRight, XCircle } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import type { EpiTipo } from "@/types/epi";

interface EpiEntregaWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  epiTipos: EpiTipo[];
  onSuccess: () => void;
}

type WizardStep = "form" | "liveness" | "photo" | "signature" | "complete";

interface FormData {
  colaboradorId: string;
  colaboradorNome: string;
  colaboradorCpf: string;
  colaboradorCargo: string;
  colaboradorDepartamento: string;
  epiTipoId: string;
  epiTipo: EpiTipo | null;
  quantidade: number;
  dataEntrega: string;
  dataValidade: string;
  observacoes: string;
}

export function EpiEntregaWizard({
  open,
  onOpenChange,
  epiTipos,
  onSuccess,
}: EpiEntregaWizardProps) {
  const { tenantId, user, profile } = useAuth();
  const { colaboradores } = useColaboradores();
  const reciboRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState<WizardStep>("form");
  const [isLoading, setIsLoading] = useState(false);
  const [showRecusaDialog, setShowRecusaDialog] = useState(false);

  // Form data
  const [formData, setFormData] = useState<FormData>({
    colaboradorId: "",
    colaboradorNome: "",
    colaboradorCpf: "",
    colaboradorCargo: "",
    colaboradorDepartamento: "",
    epiTipoId: "",
    epiTipo: null,
    quantidade: 1,
    dataEntrega: format(new Date(), "yyyy-MM-dd"),
    dataValidade: "",
    observacoes: "",
  });

  // Capture data
  const [livenessData, setLivenessData] = useState<{ actions: string[]; timestamps: string[] } | null>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [entregaResult, setEntregaResult] = useState<any>(null);

  const steps: WizardStep[] = ["form", "liveness", "photo", "signature", "complete"];
  const stepLabels = {
    form: "Formulário",
    liveness: "Verificação",
    photo: "Foto",
    signature: "Assinatura",
    complete: "Concluído",
  };

  const currentStepIndex = steps.indexOf(step);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const resetWizard = () => {
    setStep("form");
    setFormData({
      colaboradorId: "",
      colaboradorNome: "",
      colaboradorCpf: "",
      colaboradorCargo: "",
      colaboradorDepartamento: "",
      epiTipoId: "",
      epiTipo: null,
      quantidade: 1,
      dataEntrega: format(new Date(), "yyyy-MM-dd"),
      dataValidade: "",
      observacoes: "",
    });
    setLivenessData(null);
    setPhotoData(null);
    setSignatureData(null);
    setEntregaResult(null);
  };

  const handleClose = () => {
    resetWizard();
    onOpenChange(false);
  };

  // Upload base64 para storage
  const uploadToStorage = async (base64Data: string, fileName: string): Promise<string> => {
    const base64 = base64Data.split(",")[1];
    const byteArray = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    
    const { data, error } = await supabase.storage
      .from("epi-signatures")
      .upload(fileName, byteArray, { contentType: "image/png", upsert: true });
    
    if (error) throw error;
    
    const { data: urlData } = supabase.storage.from("epi-signatures").getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  // Salvar entrega
  const saveEntrega = async (status: "entregue" | "recusado" = "entregue") => {
    if (!tenantId) {
      toast.error("Tenant não identificado");
      return;
    }

    setIsLoading(true);

    try {
      let fotoUrl: string | undefined;
      let assinaturaUrl: string | undefined;
      const signedAt = new Date().toISOString();

      // Upload foto e assinatura se não for recusa
      if (status === "entregue" && photoData && signatureData) {
        const timestamp = Date.now();
        
        fotoUrl = await uploadToStorage(
          photoData,
          `${tenantId}/fotos/${timestamp}-${formData.colaboradorId}.png`
        );
        
        assinaturaUrl = await uploadToStorage(
          signatureData,
          `${tenantId}/assinaturas/${timestamp}-${formData.colaboradorId}.png`
        );
      }

      // Criar registro de entrega
      const { data, error } = await supabase
        .from("epi_entregas")
        .insert({
          tenant_id: tenantId,
          epi_id: formData.epiTipoId, // Usando epi_tipos como referência
          colaborador_nome: formData.colaboradorNome,
          colaborador_cpf: formData.colaboradorCpf,
          colaborador_cargo: formData.colaboradorCargo,
          colaborador_departamento: formData.colaboradorDepartamento,
          employee_id: formData.colaboradorId || null,
          quantidade: formData.quantidade,
          data_entrega: formData.dataEntrega,
          data_validade: formData.dataValidade || null,
          status: status === "recusado" ? "extraviado" : "ativa", // usando status existente
          foto_entrega_url: fotoUrl,
          assinatura_url: assinaturaUrl,
          signed_at: status === "entregue" ? signedAt : null,
          liveness_detected: livenessData !== null,
          liveness_data: livenessData || { actions: [], timestamps: [] },
          ip_address: "", // Seria preenchido via backend
          user_agent: navigator.userAgent,
          observacoes: status === "recusado" 
            ? `RECUSADO: Colaborador recusou assinar. ${formData.observacoes}`
            : formData.observacoes,
          entregue_por: user?.id,
          entregue_por_nome: profile?.nome_completo,
        })
        .select()
        .single();

      if (error) throw error;

      setEntregaResult({
        ...data,
        fotoUrl,
        assinaturaUrl,
        signedAt,
      });

      if (status === "entregue") {
        setStep("complete");
        toast.success("Entrega registrada com sucesso!");
      } else {
        toast.warning("Recusa registrada. Uma advertência foi criada.");
        handleClose();
      }

      onSuccess();
    } catch (error: any) {
      toast.error("Erro ao salvar entrega: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handlers de colaborador
  const handleColaboradorChange = (colaboradorId: string) => {
    const colaborador = colaboradores.find((c) => c.id === colaboradorId);
    if (colaborador) {
      setFormData((prev) => ({
        ...prev,
        colaboradorId,
        colaboradorNome: colaborador.nome_completo,
        colaboradorCpf: colaborador.cpf || "",
        colaboradorCargo: colaborador.cargo || "",
        colaboradorDepartamento: colaborador.departamento || "",
      }));
    }
  };

  // Handler de EPI
  const handleEpiChange = (epiTipoId: string) => {
    const tipo = epiTipos.find((t) => t.id === epiTipoId);
    if (tipo) {
      const dataValidade = tipo.validade_meses
        ? format(addDays(new Date(formData.dataEntrega), tipo.validade_meses * 30), "yyyy-MM-dd")
        : "";
      
      setFormData((prev) => ({
        ...prev,
        epiTipoId,
        epiTipo: tipo,
        dataValidade,
      }));
    }
  };

  // Gerar PDF
  const generatePDF = async () => {
    if (!reciboRef.current) return;

    try {
      const canvas = await html2canvas(reciboRef.current, { scale: 2, useCORS: true });
      const pdf = new jsPDF("p", "mm", "a4");
      const imgData = canvas.toDataURL("image/png");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`recibo-epi-${formData.colaboradorNome}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast.success("PDF gerado com sucesso!");
    } catch (error) {
      toast.error("Erro ao gerar PDF");
    }
  };

  const canProceedFromForm = 
    formData.colaboradorId && 
    formData.epiTipoId && 
    formData.quantidade > 0 && 
    formData.dataEntrega;

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova Entrega de EPI</DialogTitle>
          </DialogHeader>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="mb-2 flex justify-between text-xs text-muted-foreground">
              {steps.map((s, i) => (
                <span
                  key={s}
                  className={i <= currentStepIndex ? "font-medium text-primary" : ""}
                >
                  {stepLabels[s]}
                </span>
              ))}
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Step content */}
          <div className="min-h-[400px]">
            {step === "form" && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Colaborador *</Label>
                    <Select
                      value={formData.colaboradorId}
                      onValueChange={handleColaboradorChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o colaborador" />
                      </SelectTrigger>
                      <SelectContent>
                        {colaboradores.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome_completo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo de EPI *</Label>
                    <Select
                      value={formData.epiTipoId}
                      onValueChange={handleEpiChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o EPI" />
                      </SelectTrigger>
                      <SelectContent>
                        {epiTipos.filter(t => t.is_active !== false).map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.nome}
                            {t.ca_numero && ` (CA: ${t.ca_numero})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Quantidade *</Label>
                    <Input
                      type="number"
                      min={1}
                      value={formData.quantidade}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          quantidade: parseInt(e.target.value) || 1,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Data de Entrega *</Label>
                    <Input
                      type="date"
                      value={formData.dataEntrega}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        const tipo = formData.epiTipo;
                        const dataValidade = tipo?.validade_meses
                          ? format(addDays(new Date(newDate), tipo.validade_meses * 30), "yyyy-MM-dd")
                          : "";
                        setFormData((prev) => ({
                          ...prev,
                          dataEntrega: newDate,
                          dataValidade,
                        }));
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Data de Validade</Label>
                    <Input
                      type="date"
                      value={formData.dataValidade}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, dataValidade: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    placeholder="Observações sobre a entrega..."
                    value={formData.observacoes}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, observacoes: e.target.value }))
                    }
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    variant="destructive"
                    onClick={() => setShowRecusaDialog(true)}
                    disabled={!canProceedFromForm}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Colaborador Recusou
                  </Button>
                  <div className="flex-1" />
                  <Button
                    onClick={() => setStep("liveness")}
                    disabled={!canProceedFromForm}
                  >
                    Próximo
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === "liveness" && (
              <div className="space-y-4">
                <LivenessDetection
                  onComplete={(data) => {
                    setLivenessData(data);
                    setStep("photo");
                  }}
                />
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" onClick={() => setStep("form")}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar
                  </Button>
                </div>
              </div>
            )}

            {step === "photo" && (
              <div className="space-y-4">
                <PhotoCapture
                  onCapture={(data) => {
                    setPhotoData(data);
                    setStep("signature");
                  }}
                />
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" onClick={() => setStep("liveness")}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar
                  </Button>
                </div>
              </div>
            )}

            {step === "signature" && (
              <div className="space-y-4">
                <SignatureCapture
                  colaboradorNome={formData.colaboradorNome}
                  onCapture={(data) => {
                    setSignatureData(data);
                    saveEntrega("entregue");
                  }}
                />
                {isLoading && (
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando entrega...
                  </div>
                )}
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" onClick={() => setStep("photo")} disabled={isLoading}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar
                  </Button>
                </div>
              </div>
            )}

            {step === "complete" && (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <EpiEntregaRecibo
                    ref={reciboRef}
                    data={{
                      colaboradorNome: formData.colaboradorNome,
                      colaboradorCpf: formData.colaboradorCpf,
                      colaboradorCargo: formData.colaboradorCargo,
                      colaboradorDepartamento: formData.colaboradorDepartamento,
                      epiNome: formData.epiTipo?.nome || "",
                      epiCa: formData.epiTipo?.ca_numero || undefined,
                      epiFabricante: formData.epiTipo?.fabricante || undefined,
                      epiMarca: formData.epiTipo?.marca || undefined,
                      quantidade: formData.quantidade,
                      dataEntrega: formData.dataEntrega,
                      dataValidade: formData.dataValidade,
                      observacoes: formData.observacoes,
                      fotoUrl: entregaResult?.fotoUrl,
                      assinaturaUrl: entregaResult?.assinaturaUrl,
                      signedAt: entregaResult?.signedAt,
                      entregueporNome: profile?.nome_completo,
                    }}
                  />
                </div>

                <div className="flex justify-center gap-2">
                  <Button onClick={generatePDF}>
                    <Download className="mr-2 h-4 w-4" />
                    Baixar PDF
                  </Button>
                  <Button variant="outline" onClick={handleClose}>
                    Fechar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de recusa */}
      <AlertDialog open={showRecusaDialog} onOpenChange={setShowRecusaDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Recusa</AlertDialogTitle>
            <AlertDialogDescription>
              O colaborador <strong>{formData.colaboradorNome}</strong> está recusando
              assinar o recebimento do EPI. Isso será registrado como advertência no
              sistema de RH.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowRecusaDialog(false);
                saveEntrega("recusado");
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar Recusa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
