import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { 
  FileText, 
  ChevronRight, 
  ChevronLeft, 
  Eye, 
  Download,
  Save,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { arquivarDocumento } from "@/utils/arquivarDocumento";

import { AEPFormIdentificacao } from "./AEPFormIdentificacao";
import { AEPFormDescricao } from "./AEPFormDescricao";
import { AEPFormRiscos } from "./AEPFormRiscos";
import { AEPFormSintese } from "./AEPFormSintese";
import { AEPFormAcoes } from "./AEPFormAcoes";
import { AEPFormAssinaturas } from "./AEPFormAssinaturas";
import { AEPDocumentoPreview } from "./AEPDocumentoPreview";
import { AEPAssistenteIA } from "./AEPAssistenteIA";

import type { AEPDocumento, AEPDescricaoAtividade, AEPRiscosFisicos, AEPRiscosCognitivos, AEPAcaoRecomendada } from "@/types/aep";
import { getDefaultAEPDocumento } from "@/types/aep";

const STEPS = [
  { id: 1, title: "Identificação", description: "Dados da empresa e avaliação" },
  { id: 2, title: "Descrição", description: "Atividade e ambiente" },
  { id: 3, title: "Riscos", description: "Físicos e cognitivos" },
  { id: 4, title: "Síntese", description: "Avaliação e AET" },
  { id: 5, title: "Ações", description: "Recomendações" },
  { id: 6, title: "Assinaturas", description: "Conclusão" },
];

interface AEPGeneratorProps {
  onSave?: (documento: AEPDocumento) => Promise<void>;
  initialData?: AEPDocumento;
}

export function AEPGenerator({ onSave, initialData }: AEPGeneratorProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [documento, setDocumento] = useState<AEPDocumento>(
    initialData || getDefaultAEPDocumento() as AEPDocumento
  );
  const [showPreview, setShowPreview] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
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

      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
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

      const fileName = `AEP_${documento.identificacao.empresa || 'documento'}_${documento.identificacao.funcao || 'funcao'}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
      toast.success("PDF gerado com sucesso!");
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
      await onSave(documento);
      toast.success("Documento salvo com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar documento");
    } finally {
      setIsSaving(false);
    }
  };

  // Handlers para atualização parcial via IA
  const handleUpdateDescricao = (updates: Partial<AEPDescricaoAtividade>) => {
    setDocumento(prev => ({
      ...prev,
      descricaoAtividade: { ...prev.descricaoAtividade, ...updates }
    }));
  };

  const handleUpdateRiscosFisicos = (updates: Partial<AEPRiscosFisicos>) => {
    setDocumento(prev => ({
      ...prev,
      riscosFisicos: { ...prev.riscosFisicos, ...updates }
    }));
  };

  const handleUpdateRiscosCognitivos = (updates: Partial<AEPRiscosCognitivos>) => {
    setDocumento(prev => ({
      ...prev,
      riscosCognitivos: { ...prev.riscosCognitivos, ...updates }
    }));
  };

  const handleAddAcoes = (novasAcoes: AEPAcaoRecomendada[]) => {
    setDocumento(prev => ({
      ...prev,
      acoesRecomendadas: [...prev.acoesRecomendadas, ...novasAcoes]
    }));
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <AEPFormIdentificacao
            data={documento.identificacao}
            onChange={(identificacao) => setDocumento({ ...documento, identificacao })}
          />
        );
      case 2:
        return (
          <AEPFormDescricao
            data={documento.descricaoAtividade}
            onChange={(descricaoAtividade) => setDocumento({ ...documento, descricaoAtividade })}
          />
        );
      case 3:
        return (
          <AEPFormRiscos
            riscosFisicos={documento.riscosFisicos}
            riscosCognitivos={documento.riscosCognitivos}
            onChangeRiscosFisicos={(riscosFisicos) => setDocumento({ ...documento, riscosFisicos })}
            onChangeRiscosCognitivos={(riscosCognitivos) => setDocumento({ ...documento, riscosCognitivos })}
          />
        );
      case 4:
        return (
          <AEPFormSintese
            data={documento.sinteseAvaliacao}
            onChange={(sinteseAvaliacao) => setDocumento({ ...documento, sinteseAvaliacao })}
          />
        );
      case 5:
        return (
          <AEPFormAcoes
            acoes={documento.acoesRecomendadas}
            onChange={(acoesRecomendadas) => setDocumento({ ...documento, acoesRecomendadas })}
          />
        );
      case 6:
        return (
          <AEPFormAssinaturas
            data={documento.assinaturas}
            onChange={(assinaturas) => setDocumento({ ...documento, assinaturas })}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header com Steps */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Gerar AEP - Análise Ergonômica Preliminar</h2>
        </div>
        
        <div className="flex items-center gap-2">
          <Dialog open={showPreview} onOpenChange={setShowPreview}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
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
                <AEPDocumentoPreview ref={previewRef} documento={documento} />
              </ScrollArea>
            </DialogContent>
          </Dialog>

          {onSave && (
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
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
        {STEPS.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <button
              onClick={() => setCurrentStep(step.id)}
              className={`flex flex-col items-center ${
                step.id === currentStep 
                  ? 'text-primary' 
                  : step.id < currentStep 
                    ? 'text-success' 
                    : 'text-muted-foreground'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium mb-1 ${
                step.id === currentStep 
                  ? 'bg-primary text-primary-foreground' 
                  : step.id < currentStep 
                    ? 'bg-success text-success-foreground' 
                    : 'bg-muted'
              }`}>
                {step.id}
              </div>
              <span className="text-xs font-medium">{step.title}</span>
              <span className="text-xs text-muted-foreground hidden md:block">{step.description}</span>
            </button>
            {index < STEPS.length - 1 && (
              <div className={`w-8 md:w-16 h-0.5 mx-2 ${
                step.id < currentStep ? 'bg-success' : 'bg-muted'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* AI Assistant */}
      <AEPAssistenteIA
        currentStep={currentStep}
        descricaoAtividade={documento.descricaoAtividade}
        riscosFisicos={documento.riscosFisicos}
        riscosCognitivos={documento.riscosCognitivos}
        acoesRecomendadas={documento.acoesRecomendadas}
        onUpdateDescricao={handleUpdateDescricao}
        onUpdateRiscosFisicos={handleUpdateRiscosFisicos}
        onUpdateRiscosCognitivos={handleUpdateRiscosCognitivos}
        onAddAcoes={handleAddAcoes}
      />

      {/* Form Content */}
      <motion.div
        key={currentStep}
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
          onClick={handlePrevious}
          disabled={currentStep === 1}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>
        
        <div className="flex gap-2">
          {currentStep === STEPS.length ? (
            <Button onClick={() => setShowPreview(true)} className="gap-2">
              <Eye className="h-4 w-4" />
              Visualizar e Exportar
            </Button>
          ) : (
            <Button onClick={handleNext} className="gap-2">
              Próximo
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
