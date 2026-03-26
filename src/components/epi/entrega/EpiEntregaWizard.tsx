import { useState, useRef, useMemo, useCallback, useEffect } from "react";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { useAfastamentosAtivos } from "@/hooks/useAfastamentosAtivos";
import { AfastadoBadge } from "@/components/shared/AfastadoBadge";
import { useAuth } from "@/hooks/useAuth";
import { useDocumentos } from "@/hooks/useDocumentos";
import { useEpiLocais } from "@/hooks/useEpiLocais";
import { useEpiConfig } from "@/hooks/useEpiConfig";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { Loader2, Download, ArrowLeft, ArrowRight, XCircle, Check, ChevronsUpDown, AlertCircle, User, MapPin } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import type { EpiTipo } from "@/types/epi";
import { cn } from "@/lib/utils";
import { useEpiTamanhos } from "@/hooks/useEpiTamanhos";

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
  localEstoqueId: string;
  quantidade: number;
  tamanho: string;
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
  const { colaboradores, isLoading: colaboradoresLoading } = useColaboradores();
  const { getAfastamento } = useAfastamentosAtivos();
  const { upload: uploadDocumento } = useDocumentos();
  const { locaisAtivos } = useEpiLocais();
  const { usarControleEstoque } = useEpiConfig();
  const { getTamanhosForTipo } = useEpiTamanhos();
  const reciboRef = useRef<HTMLDivElement>(null);
  const [colaboradorPopoverOpen, setColaboradorPopoverOpen] = useState(false);
  const [colaboradorSearch, setColaboradorSearch] = useState("");
  const [step, setStep] = useState<WizardStep>("form");
  
  // Filtrar colaboradores pelo termo de busca
  const filteredColaboradores = useMemo(() => {
    if (!colaboradorSearch) return colaboradores;
    const search = colaboradorSearch.toLowerCase();
    return colaboradores.filter(
      (c) =>
        c.nome_completo.toLowerCase().includes(search) ||
        c.cpf.includes(search)
    );
  }, [colaboradores, colaboradorSearch]);
  const [isLoading, setIsLoading] = useState(false);

  const [showRecusaDialog, setShowRecusaDialog] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    colaboradorId: "",
    colaboradorNome: "",
    colaboradorCpf: "",
    colaboradorCargo: "",
    colaboradorDepartamento: "",
    epiTipoId: "",
    epiTipo: null,
    localEstoqueId: "",
    quantidade: 1,
    tamanho: "",
    dataEntrega: format(new Date(), "yyyy-MM-dd"),
    dataValidade: "",
    observacoes: "",
  });

  // Capture data
  const [livenessData, setLivenessData] = useState<{ actions: string[]; timestamps: string[] } | null>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [entregaResult, setEntregaResult] = useState<any>(null);
  const [pdfArquivado, setPdfArquivado] = useState(false);

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
      localEstoqueId: "",
      quantidade: 1,
      tamanho: "",
      dataEntrega: format(new Date(), "yyyy-MM-dd"),
      dataValidade: "",
      observacoes: "",
    });
    setLivenessData(null);
    setPhotoData(null);
    setSignatureData(null);
    setEntregaResult(null);
    setPdfArquivado(false);
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
      // A tabela epi_entregas referencia `epis.id` (item de estoque),
      // então precisamos resolver o epi_id a partir do tipo selecionado (epi_tipos).
      let epiId: string;
      
      // Buscar EPI existente com estoque suficiente
      const { data: epiRow, error: epiError } = await supabase
        .from("epis")
        .select("id, quantidade_estoque")
        .eq("tipo_id", formData.epiTipoId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (epiError) throw epiError;
      
      if (epiRow?.id) {
        // EPI existe, usar o ID existente
        epiId = epiRow.id;
      } else {
        // Não existe EPI para este tipo, criar um automaticamente
        const { data: newEpi, error: createError } = await supabase
          .from("epis")
          .insert({
            tenant_id: tenantId,
            tipo_id: formData.epiTipoId,
            quantidade_estoque: 1000, // Estoque inicial padrão
            quantidade_minima: 10,
            status: "disponivel",
          })
          .select("id")
          .single();
        
        if (createError) throw createError;
        epiId = newEpi.id;
      }

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
          epi_id: epiId,
          colaborador_nome: formData.colaboradorNome,
          colaborador_cpf: formData.colaboradorCpf,
          colaborador_cargo: formData.colaboradorCargo,
          colaborador_departamento: formData.colaboradorDepartamento,
          employee_id: formData.colaboradorId || null,
          quantidade: formData.quantidade,
          data_entrega: formData.dataEntrega,
          data_validade: formData.dataValidade || null,
          status: status === "recusado" ? "extraviado" : "ativa",
          tamanho: formData.tamanho || null,
          foto_entrega_url: fotoUrl,
          assinatura_url: assinaturaUrl,
          signed_at: status === "entregue" ? signedAt : null,
          liveness_detected: livenessData !== null,
          liveness_data: livenessData || { actions: [], timestamps: [] },
          ip_address: "",
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

      // RF-EPI-EST-08: Se controle de estoque ativo e local selecionado, baixar estoque do local
      if (usarControleEstoque && formData.localEstoqueId && status === "entregue") {
        // Buscar saldo atual no local (considerando tamanho)
        let queryEstoque = supabase
          .from("epi_estoque_local")
          .select("id, quantidade")
          .eq("epi_id", epiId)
          .eq("local_estoque_id", formData.localEstoqueId)
          .eq("tenant_id", tenantId);

        if (formData.tamanho) {
          queryEstoque = queryEstoque.eq("tamanho", formData.tamanho);
        } else {
          queryEstoque = queryEstoque.is("tamanho", null);
        }

        const { data: estoqueLocal } = await queryEstoque.maybeSingle();

        if (estoqueLocal) {
          const novaQtd = Math.max(0, estoqueLocal.quantidade - formData.quantidade);
          await supabase
            .from("epi_estoque_local")
            .update({ quantidade: novaQtd })
            .eq("id", estoqueLocal.id);
        }

        // Registrar movimentação com local
        const { data: epiAtual } = await supabase
          .from("epis")
          .select("quantidade_estoque")
          .eq("id", epiId)
          .single();

        await supabase.from("epi_movimentacoes").insert({
          tenant_id: tenantId,
          epi_id: epiId,
          tipo: "saida",
          subtipo: "entrega",
          local_estoque_id: formData.localEstoqueId,
          quantidade: formData.quantidade,
          quantidade_anterior: (epiAtual?.quantidade_estoque || 0) + formData.quantidade,
          quantidade_atual: epiAtual?.quantidade_estoque || 0,
          motivo: `Entrega para ${formData.colaboradorNome}`,
          tamanho: formData.tamanho || null,
          realizado_por: user?.id,
          realizado_por_nome: profile?.nome_completo,
        });
      }

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

  // CT-13: Verificar se o CA do EPI selecionado está vencido
  const isCAVencido = useMemo(() => {
    if (!formData.epiTipo?.ca_validade) return false;
    return new Date(formData.epiTipo.ca_validade) < new Date();
  }, [formData.epiTipo]);

  // CT-32: Verificar se o EPI é irregular (sem CA cadastrado)
  const isEPIIrregular = useMemo(() => {
    if (!formData.epiTipo) return false;
    return !formData.epiTipo.ca_numero;
  }, [formData.epiTipo]);

  // CT-12: Verificar saldo de estoque disponível
  const [saldoDisponivel, setSaldoDisponivel] = useState<number | null>(null);
  const [verificandoSaldo, setVerificandoSaldo] = useState(false);

  useEffect(() => {
    const verificarSaldo = async () => {
      if (!formData.epiTipoId || !tenantId) {
        setSaldoDisponivel(null);
        return;
      }
      setVerificandoSaldo(true);
      try {
        const { data: epiRow } = await supabase
          .from("epis")
          .select("quantidade_estoque")
          .eq("tipo_id", formData.epiTipoId)
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        
        setSaldoDisponivel(epiRow?.quantidade_estoque ?? 0);
      } catch {
        setSaldoDisponivel(null);
      } finally {
        setVerificandoSaldo(false);
      }
    };
    verificarSaldo();
  }, [formData.epiTipoId, tenantId]);

  const isSaldoInsuficiente = saldoDisponivel !== null && formData.quantidade > saldoDisponivel;

  // Gerar PDF e retornar como Blob (para arquivamento)
  const generatePDFBlob = useCallback(async (): Promise<Blob | null> => {
    if (!reciboRef.current) return null;

    try {
      const canvas = await html2canvas(reciboRef.current, { scale: 2, useCORS: true });
      const pdf = new jsPDF("p", "mm", "a4");
      const imgData = canvas.toDataURL("image/png");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      return pdf.output("blob");
    } catch (error) {
      console.error("Erro ao gerar PDF blob:", error);
      return null;
    }
  }, []);

  // Gerar PDF e baixar localmente
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

  // Arquivar PDF no módulo de documentos
  const arquivarPDFDocumentos = useCallback(async () => {
    if (!reciboRef.current || !formData.colaboradorId) return;

    try {
      // Aguardar um momento para garantir que o recibo esteja renderizado
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      const pdfBlob = await generatePDFBlob();
      if (!pdfBlob) {
        console.warn("Não foi possível gerar o PDF para arquivamento");
        return;
      }

      const fileName = `Recibo EPI - ${formData.epiTipo?.nome || "EPI"} - ${format(new Date(formData.dataEntrega), "dd-MM-yyyy")}.pdf`;
      const file = new File([pdfBlob], fileName, { type: "application/pdf" });

      await uploadDocumento({
        file,
        colaboradorNome: formData.colaboradorNome,
        colaboradorCpf: formData.colaboradorCpf,
        colaboradorId: formData.colaboradorId,
        tipo: "Recibo de EPI",
        observacoes: `Entrega de ${formData.quantidade}x ${formData.epiTipo?.nome || "EPI"}${formData.epiTipo?.ca_numero ? ` (CA: ${formData.epiTipo.ca_numero})` : ""}. Assinado digitalmente.`,
      });

      toast.success("Recibo arquivado na pasta do colaborador!");
    } catch (error: any) {
      console.error("Erro ao arquivar PDF:", error);
      // Não exibir erro ao usuário - o documento pode ser gerado manualmente se necessário
    }
  }, [formData, generatePDFBlob, uploadDocumento]);

  // Arquivar PDF automaticamente quando o step muda para "complete"
  useEffect(() => {
    if (step === "complete" && entregaResult && !pdfArquivado) {
      setPdfArquivado(true);
      // Aguardar um pouco para o recibo renderizar antes de arquivar
      const timer = setTimeout(() => {
        arquivarPDFDocumentos();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [step, entregaResult, pdfArquivado, arquivarPDFDocumentos]);

  const selectedTamanhos = formData.epiTipoId ? getTamanhosForTipo(formData.epiTipoId) : [];
  const requiresTamanho = selectedTamanhos.length > 0;

  // CT-13/32/12: Bloquear avanço se CA vencido, EPI irregular ou saldo insuficiente
  const canProceedFromForm = 
    formData.colaboradorId && 
    formData.epiTipoId && 
    formData.quantidade > 0 && 
    formData.dataEntrega &&
    (!usarControleEstoque || formData.localEstoqueId) &&
    (!requiresTamanho || formData.tamanho) &&
    !isCAVencido &&
    !isEPIIrregular &&
    !isSaldoInsuficiente;

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
                {/* Alerta se não houver colaboradores */}
                {!colaboradoresLoading && colaboradores.length === 0 && (
                  <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                      <div>
                        <p className="font-medium text-destructive">Nenhum colaborador cadastrado</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Para registrar entregas de EPI, é necessário ter colaboradores com admissão concluída. 
                          Acesse o menu "Admissão" para cadastrar novos colaboradores.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Seleção de colaborador com busca */}
                <div className="space-y-2">
                  <Label>Colaborador *</Label>
                  <Popover open={colaboradorPopoverOpen} onOpenChange={setColaboradorPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={colaboradorPopoverOpen}
                        className="w-full justify-between font-normal"
                        disabled={colaboradores.length === 0}
                      >
                        {formData.colaboradorId ? (
                          <span className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {formData.colaboradorNome}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Buscar colaborador...</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput 
                          placeholder="Buscar por nome ou CPF..." 
                          value={colaboradorSearch}
                          onValueChange={setColaboradorSearch}
                        />
                        <CommandList>
                          <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                          <CommandGroup>
                            {filteredColaboradores.map((c) => (
                              <CommandItem
                                key={c.id}
                                value={c.id}
                                onSelect={() => {
                                  handleColaboradorChange(c.id);
                                  setColaboradorPopoverOpen(false);
                                  setColaboradorSearch("");
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formData.colaboradorId === c.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                    <span>{c.nome_completo}</span>
                                    <AfastadoBadge afastamento={getAfastamento({ cpf: c.cpf, nome: c.nome_completo })} compact />
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    CPF: {c.cpf} {c.cargo && `• ${c.cargo}`}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Dados do colaborador selecionado (somente leitura) */}
                {formData.colaboradorId && (
                  <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">Dados do Colaborador</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Nome Completo</Label>
                        <p className="text-sm font-medium">{formData.colaboradorNome}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">CPF</Label>
                        <p className="text-sm font-medium">{formData.colaboradorCpf}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Função</Label>
                        <p className="text-sm font-medium">{formData.colaboradorCargo || "—"}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Departamento</Label>
                        <p className="text-sm font-medium">{formData.colaboradorDepartamento || "—"}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Seleção de EPI */}
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

                {/* RF-EPI-EST-08: Seleção de Local de Estoque (se controle ativo) */}
                {usarControleEstoque && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      Local de Estoque {usarControleEstoque ? "*" : ""}
                    </Label>
                    <Select
                      value={formData.localEstoqueId}
                      onValueChange={(val) =>
                        setFormData((prev) => ({ ...prev, localEstoqueId: val }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o local de saída" />
                      </SelectTrigger>
                      <SelectContent>
                        {locaisAtivos.map((local) => (
                          <SelectItem key={local.id} value={local.id}>
                            {local.nome} {local.filial?.nome ? `(${local.filial.nome})` : ""}
                          </SelectItem>
                        ))}
                        {locaisAtivos.length === 0 && (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            Nenhum local cadastrado. Vá em Config para criar.
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Seleção de Tamanho (se EPI controla tamanho) */}
                {formData.epiTipoId && getTamanhosForTipo(formData.epiTipoId).length > 0 && (
                  <div className="space-y-2">
                    <Label>Tamanho *</Label>
                    <Select
                      value={formData.tamanho}
                      onValueChange={(val) =>
                        setFormData((prev) => ({ ...prev, tamanho: val }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tamanho" />
                      </SelectTrigger>
                      <SelectContent>
                        {getTamanhosForTipo(formData.epiTipoId).map((t) => (
                          <SelectItem key={t.id} value={t.tamanho}>
                            {t.tamanho}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

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
