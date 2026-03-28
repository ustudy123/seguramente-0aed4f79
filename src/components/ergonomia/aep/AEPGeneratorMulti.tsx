import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { 
  FileText, 
  ChevronRight, 
  ChevronLeft, 
  Eye, 
  Download,
  Save,
  Loader2,
  Sparkles,
  Building2,
  Camera,
  Brain,
  ClipboardCheck,
  FileCheck,
  PenLine
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { arquivarDocumento } from "@/utils/arquivarDocumento";

import { AEPConfigInicial } from "./AEPConfigInicial";
import { AEPEvidenciaForm } from "./AEPEvidenciaForm";
import { AEPEvidenciasList } from "./AEPEvidenciasList";
import { AEPRevisaoFuncao } from "./AEPRevisaoFuncao";
import { AEPFormSintese } from "./AEPFormSintese";
import { AEPFormAssinaturas } from "./AEPFormAssinaturas";
import { AEPDocumentoPreviewMulti } from "./AEPDocumentoPreviewMulti";
import { useAEPMulti } from "@/hooks/useAEPMulti";
import { AEP_MULTI_STEPS, AEPDocumentoMulti } from "@/types/aep-multi";

const STEP_ICONS = [Building2, Camera, Brain, ClipboardCheck, FileCheck, PenLine];

interface AEPGeneratorMultiProps {
  onSave?: (documento: AEPDocumentoMulti) => Promise<void>;
}

export function AEPGeneratorMulti({ onSave }: AEPGeneratorMultiProps) {
  const {
    state,
    stats,
    goToStep,
    nextStep,
    prevStep,
    updateEmpresa,
    addSituacao,
    removeSituacao,
    duplicateSituacao,
    updateSituacao,
    addEvidencia,
    removeEvidencia,
    analyzeAllEvidencias,
    generateAvaliacoes,
    updateAvaliacao,
    updateSinteseGeral,
    setAcoesConsolidadas,
    updateAssinaturas,
  } = useAEPMulti();

  const { tenantId, user, profile } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();
  const [showPreview, setShowPreview] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // Validation for each step
  const canProceed = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(state.empresa.nome && state.empresa.responsavelLevantamento && state.situacoes.length > 0);
      case 2:
        return state.evidencias.length > 0;
      case 3:
        return state.evidencias.every(e => e.analisadaPorIA);
      case 4:
        return state.avaliacoes.length > 0;
      case 5:
        return !!state.sinteseGeral;
      case 6:
        return !!state.assinaturas.responsavelAvaliacao;
      default:
        return true;
    }
  };

  const handleNext = async () => {
    if (state.step === 2 && state.evidencias.some(e => !e.analisadaPorIA)) {
      await analyzeAllEvidencias();
      generateAvaliacoes();
      nextStep();
    } else if (state.step === 3) {
      generateAvaliacoes();
      nextStep();
    } else {
      nextStep();
    }
  };

  const handleGeneratePDF = async () => {
    if (!previewRef.current) return;
    
    setIsGeneratingPDF(true);
    
    try {
      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const fileName = `AEP_${state.empresa.nome || 'documento'}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
      toast.success("PDF gerado com sucesso!");

      // Auto-archive to Documentos module
      if (tenantId && user) {
        const blob = pdf.output("blob");
        await arquivarDocumento({
          tenantId,
          empresaId: empresaAtivaId,
          userId: user.id,
          userNome: profile?.nome_completo || "Sistema",
          file: blob,
          fileName,
          tipo: "AEP - Avaliação Ergonômica Preliminar",
          observacoes: `AEP gerada para ${state.empresa.nome || "empresa"}`,
          pastaCategoria: "Ergonomia",
        });
      }
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleSave = async () => {
    if (!onSave) return;
    
    setIsSaving(true);
    try {
      const documento: AEPDocumentoMulti = {
        empresa: state.empresa,
        situacoes: state.situacoes,
        avaliacoes: state.avaliacoes,
        sinteseGeral: state.sinteseGeral,
        acoesConsolidadas: state.acoesConsolidadas,
        assinaturas: state.assinaturas
      };
      await onSave(documento);
      toast.success("Documento salvo com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar documento");
    } finally {
      setIsSaving(false);
    }
  };

  const renderStep = () => {
    switch (state.step) {
      case 1:
        return (
          <AEPConfigInicial
            empresa={state.empresa}
            situacoes={state.situacoes}
            onUpdateEmpresa={updateEmpresa}
            onAddSituacao={addSituacao}
            onRemoveSituacao={removeSituacao}
            onDuplicateSituacao={duplicateSituacao}
            onUpdateSituacao={updateSituacao}
          />
        );
      case 2:
        return (
          <div className="space-y-6">
            <AEPEvidenciaForm
              situacoes={state.situacoes}
              onAddEvidencia={addEvidencia}
            />
            <AEPEvidenciasList
              evidencias={state.evidencias}
              onRemoveEvidencia={removeEvidencia}
            />
          </div>
        );
      case 3:
        return (
          <Card>
            <CardContent className="py-8">
              <div className="text-center space-y-4">
                {state.isAnalyzing ? (
                  <>
                    <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                    <h3 className="text-xl font-semibold">Analisando evidências com IA...</h3>
                    <p className="text-muted-foreground">
                      Processando {stats.totalEvidencias} evidência(s) de {stats.totalFuncoes} função(ões)
                    </p>
                    <Progress 
                      value={(stats.evidenciasAnalisadas / stats.totalEvidencias) * 100} 
                      className="max-w-md mx-auto"
                    />
                  </>
                ) : stats.evidenciasAnalisadas === stats.totalEvidencias && stats.totalEvidencias > 0 ? (
                  <>
                    <Sparkles className="h-12 w-12 mx-auto text-success" />
                    <h3 className="text-xl font-semibold text-success">Análise Concluída!</h3>
                    <p className="text-muted-foreground">
                      {stats.totalEvidencias} evidência(s) analisada(s) em {stats.totalFuncoes} função(ões)
                    </p>
                    <div className="flex justify-center gap-4 mt-4">
                      <Badge variant="secondary">{stats.totalSetores} setor(es)</Badge>
                      <Badge variant="secondary">{stats.totalFuncoes} função(ões)</Badge>
                    </div>
                  </>
                ) : (
                  <>
                    <Brain className="h-12 w-12 mx-auto text-primary" />
                    <h3 className="text-xl font-semibold">Pronto para Análise</h3>
                    <p className="text-muted-foreground">
                      {stats.totalEvidencias - stats.evidenciasAnalisadas} evidência(s) pendente(s) de análise
                    </p>
                    <Button onClick={analyzeAllEvidencias} className="gap-2 mt-4">
                      <Sparkles className="h-4 w-4" />
                      Analisar com IA
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );
      case 4:
        return (
          <AEPRevisaoFuncao
            avaliacoes={state.avaliacoes}
            onUpdateAvaliacao={updateAvaliacao}
          />
        );
      case 5:
        return (
          <AEPFormSintese
            data={state.sinteseGeral || {
              classificacaoGeral: 'baixo',
              pontosCriticos: [],
              necessidadeAET: 'nao_indicado',
              justificativaAET: ''
            }}
            onChange={updateSinteseGeral}
          />
        );
      case 6:
        return (
          <AEPFormAssinaturas
            data={state.assinaturas}
            onChange={updateAssinaturas}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">AEP por Situação de Trabalho</h2>
          <Badge variant="outline">NR-17</Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <Dialog open={showPreview} onOpenChange={setShowPreview}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2" disabled={state.step < 5}>
                <Eye className="h-4 w-4" />
                Visualizar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>Pré-visualização do Documento AEP</span>
                  <Button 
                    onClick={handleGeneratePDF} 
                    disabled={isGeneratingPDF}
                    className="gap-2"
                  >
                    {isGeneratingPDF ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Exportar PDF
                  </Button>
                </DialogTitle>
              </DialogHeader>
              <ScrollArea className="h-[70vh]">
                <AEPDocumentoPreviewMulti 
                  ref={previewRef} 
                  empresa={state.empresa}
                  avaliacoes={state.avaliacoes}
                  sinteseGeral={state.sinteseGeral}
                  acoesConsolidadas={state.acoesConsolidadas}
                  assinaturas={state.assinaturas}
                />
              </ScrollArea>
            </DialogContent>
          </Dialog>

          {onSave && (
            <Button onClick={handleSave} disabled={isSaving || state.step < 6} className="gap-2">
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar
            </Button>
          )}
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {AEP_MULTI_STEPS.map((step, index) => {
          const StepIcon = STEP_ICONS[index];
          return (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => goToStep(step.id)}
                disabled={step.id > state.step + 1}
                className={`flex flex-col items-center ${
                  step.id === state.step 
                    ? 'text-primary' 
                    : step.id < state.step 
                      ? 'text-success' 
                      : 'text-muted-foreground'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 ${
                  step.id === state.step 
                    ? 'bg-primary text-primary-foreground' 
                    : step.id < state.step 
                      ? 'bg-success text-success-foreground' 
                      : 'bg-muted'
                }`}>
                  <StepIcon className="h-5 w-5" />
                </div>
                <span className="text-xs font-medium">{step.title}</span>
                <span className="text-xs text-muted-foreground hidden md:block">{step.description}</span>
              </button>
              {index < AEP_MULTI_STEPS.length - 1 && (
                <div className={`w-8 md:w-16 h-0.5 mx-2 ${
                  step.id < state.step ? 'bg-success' : 'bg-muted'
                }`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Stats bar */}
      {(state.situacoes.length > 0 || state.evidencias.length > 0) && (
        <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg flex-wrap">
          <Badge variant="outline" className="gap-1">
            <ClipboardCheck className="h-3 w-3" />
            {stats.totalSituacoes} situação(ões) de trabalho
          </Badge>
          {state.evidencias.length > 0 && (
            <>
              <Badge variant="outline" className="gap-1">
                <Camera className="h-3 w-3" />
                {stats.totalEvidencias} evidência(s)
              </Badge>
              {stats.evidenciasAnalisadas > 0 && (
                <Badge variant="default" className="gap-1 bg-success">
                  <Sparkles className="h-3 w-3" />
                  {stats.evidenciasAnalisadas} analisada(s)
                </Badge>
              )}
            </>
          )}
        </div>
      )}

      {/* Form Content */}
      <motion.div
        key={state.step}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.2 }}
      >
        {renderStep()}
      </motion.div>

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-4 border-t">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={state.step === 1}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>
        
        <div className="flex gap-2">
          {state.step === AEP_MULTI_STEPS.length ? (
            <Button onClick={() => setShowPreview(true)} className="gap-2">
              <Eye className="h-4 w-4" />
              Visualizar e Exportar
            </Button>
          ) : (
            <Button 
              onClick={handleNext} 
              disabled={!canProceed(state.step) || state.isAnalyzing}
              className="gap-2"
            >
              {state.isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  Próximo
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
