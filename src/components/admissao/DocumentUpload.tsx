import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  File as FileIcon2, 
  FileText, 
  Image, 
  CheckCircle, 
  XCircle, 
  Clock,
  Trash2,
  Eye,
  AlertCircle,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DocumentoStatus } from '@/types/admissao';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Extended document type that includes urlPreview
export interface DocumentoAdmissaoExtended {
  id: string;
  nome: string;
  tipo: string;
  obrigatorio: boolean;
  status: DocumentoStatus;
  arquivo?: File;
  arquivo_url?: string;
  arquivo_nome?: string;
  urlPreview?: string;
  dataEnvio?: Date;
  observacao?: string;
}

interface DocumentUploadProps {
  documentos: DocumentoAdmissaoExtended[];
  onUpload: (documentoId: string, file: File) => void;
  onRemove: (documentoId: string) => void;
  onApprove?: (documentoId: string) => void;
  onReject?: (documentoId: string, motivo: string) => void;
  onToggleObrigatorio?: (documentoId: string, obrigatorio: boolean) => void;
  isAdmin?: boolean;
  editableObrigatorio?: boolean;
}

const STATUS_CONFIG: Record<DocumentoStatus, { icon: React.ElementType; color: string; label: string }> = {
  pendente: { icon: Clock, color: 'text-muted-foreground', label: 'Pendente' },
  enviado: { icon: Upload, color: 'text-info', label: 'Enviado' },
  aprovado: { icon: CheckCircle, color: 'text-success', label: 'Aprovado' },
  rejeitado: { icon: XCircle, color: 'text-destructive', label: 'Rejeitado' },
};

function DocumentItem({ 
  documento, 
  onUpload, 
  onRemove,
  onApprove,
  onReject,
  onToggleObrigatorio,
  isAdmin,
  editableObrigatorio 
}: { 
  documento: DocumentoAdmissaoExtended;
  onUpload: (file: File) => void;
  onRemove: () => void;
  onApprove?: () => void;
  onReject?: (motivo: string) => void;
  onToggleObrigatorio?: (obrigatorio: boolean) => void;
  isAdmin?: boolean;
  editableObrigatorio?: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const StatusIcon = STATUS_CONFIG[documento.status].icon;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) simulateUpload(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) simulateUpload(file);
  };

  const simulateUpload = (file: File) => {
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          onUpload(file);
          return 100;
        }
        return prev + 10;
      });
    }, 100);
  };

  const hasFile = documento.arquivo || documento.arquivo_url || documento.urlPreview || documento.arquivo_nome;

  const getFileIcon = () => {
    const fileName = documento.arquivo?.name || documento.arquivo_nome || documento.arquivo_url || '';
    if (documento.arquivo?.type?.startsWith('image/')) return Image;
    if (fileName.match(/\.(jpg|jpeg|png|gif|webp)/i)) return Image;
    return FileText;
  };

  const FileIcon = getFileIcon();
  
  const getFileName = () => {
    if (documento.arquivo) return documento.arquivo.name;
    if (documento.arquivo_nome) return documento.arquivo_nome;
    if (documento.arquivo_url) {
      const urlParts = documento.arquivo_url.split('/');
      return urlParts[urlParts.length - 1].split('-').slice(1).join('-') || 'Arquivo enviado';
    }
    return '';
  };

  const handleViewDocument = useCallback(async () => {
    // For local File objects (not yet uploaded to storage)
    if (documento.arquivo instanceof File) {
      const localUrl = URL.createObjectURL(documento.arquivo);
      const isImage = documento.arquivo.type.startsWith('image/');
      const isPdf = documento.arquivo.type === 'application/pdf';
      
      if (isImage || isPdf) {
        setPreviewUrl(localUrl);
        setPreviewOpen(true);
      } else {
        window.open(localUrl, '_blank');
      }
      return;
    }
    
    const filePath = documento.arquivo_url || documento.urlPreview;
    
    if (!filePath) {
      console.error('No file path available for document:', documento.nome);
      toast.error('Arquivo não encontrado. O documento pode não ter sido salvo corretamente.');
      return;
    }
    
    // If it's already a full URL, check if it's previewable
    if (filePath.startsWith('http')) {
      const isImage = filePath.match(/\.(jpg|jpeg|png|gif|webp)/i);
      const isPdf = filePath.toLowerCase().endsWith('.pdf');
      
      if (isImage || isPdf) {
        setPreviewUrl(filePath);
        setPreviewOpen(true);
      } else {
        window.open(filePath, '_blank');
      }
      return;
    }
    
    // Generate signed URL for private bucket
    setLoadingPreview(true);
    try {
      const { data, error } = await supabase.storage
        .from('documentos')
        .createSignedUrl(filePath, 3600);
      
      if (error) {
        console.error('Error creating signed URL:', error);
        toast.error('Erro ao gerar link de visualização.');
        return;
      }
      
      const fileName = documento.arquivo_nome || documento.arquivo_url || '';
      const isImage = fileName.match(/\.(jpg|jpeg|png|gif|webp)/i);
      const isPdf = fileName.toLowerCase().endsWith('.pdf');
      
      if (isImage || isPdf) {
        setPreviewUrl(data.signedUrl);
        setPreviewOpen(true);
      } else {
        window.open(data.signedUrl, '_blank');
      }
    } finally {
      setLoadingPreview(false);
    }
  }, [documento]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-lg border-2 border-dashed p-4 transition-all",
        isDragging ? "border-primary bg-primary/5" : "border-border",
        documento.status === 'aprovado' && "border-success/30 bg-success/5",
        documento.status === 'rejeitado' && "border-destructive/30 bg-destructive/5"
      )}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            documento.status === 'pendente' ? "bg-muted" : 
            documento.status === 'enviado' ? "bg-info/10" :
            documento.status === 'aprovado' ? "bg-success/10" : "bg-destructive/10"
          )}>
            {hasFile ? (
              <FileIcon className={cn("h-5 w-5", STATUS_CONFIG[documento.status].color)} />
            ) : (
              <FileIcon2 className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              {editableObrigatorio ? (
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id={`obrigatorio-${documento.id}`}
                    checked={documento.obrigatorio}
                    onCheckedChange={(checked) => onToggleObrigatorio?.(checked === true)}
                  />
                  <label 
                    htmlFor={`obrigatorio-${documento.id}`}
                    className="font-medium text-sm text-foreground cursor-pointer"
                  >
                    {documento.nome}
                  </label>
                </div>
              ) : (
                <span className="font-medium text-sm text-foreground">{documento.nome}</span>
              )}
              {documento.obrigatorio && !editableObrigatorio && (
                <Badge variant="outline" className="text-xs">Obrigatório</Badge>
              )}
              {!documento.obrigatorio && !editableObrigatorio && (
                <Badge variant="secondary" className="text-xs">Opcional</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusIcon className={cn("h-3 w-3", STATUS_CONFIG[documento.status].color)} />
              <span className={cn("text-xs", STATUS_CONFIG[documento.status].color)}>
                {STATUS_CONFIG[documento.status].label}
              </span>
              {hasFile && (
                <span className="text-xs text-muted-foreground">
                  • {getFileName()}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {documento.status === 'pendente' && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              />
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-1" />
                Enviar
              </Button>
            </>
          )}

          {documento.status === 'enviado' && isAdmin && (
            <>
              <Button size="sm" variant="outline" onClick={onApprove}>
                <CheckCircle className="h-4 w-4 mr-1" />
                Aprovar
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="text-destructive hover:text-destructive"
                onClick={() => onReject?.('Documento ilegível ou incorreto')}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Rejeitar
              </Button>
            </>
          )}

          {hasFile && documento.status !== 'rejeitado' && (
            <Button 
              size="sm" 
              variant="ghost"
              onClick={handleViewDocument}
              disabled={loadingPreview}
            >
              {loadingPreview ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          )}

          {(documento.status === 'enviado' || documento.status === 'rejeitado') && !isAdmin && (
            <Button 
              size="sm" 
              variant="ghost" 
              className="text-destructive hover:text-destructive"
              onClick={onRemove}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {uploadProgress > 0 && uploadProgress < 100 && (
        <div className="mt-3">
          <Progress value={uploadProgress} className="h-1" />
          <p className="text-xs text-muted-foreground mt-1">Enviando... {uploadProgress}%</p>
        </div>
      )}

      {documento.observacao && (
        <div className="mt-3 p-2 rounded bg-destructive/10 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
          <p className="text-xs text-destructive">{documento.observacao}</p>
        </div>
      )}

      {/* Image Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileIcon className="h-5 w-5" />
              {documento.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 flex flex-col items-center gap-4 overflow-hidden">
            {previewUrl && (
              <>
                {previewUrl.toLowerCase().includes('.pdf') || (documento.arquivo?.type === 'application/pdf') ? (
                  <iframe 
                    src={`${previewUrl}#toolbar=0`} 
                    className="w-full h-full rounded-lg border border-border"
                    title={documento.nome}
                  />
                ) : (
                  <img 
                    src={previewUrl} 
                    alt={documento.nome} 
                    className="max-h-full object-contain rounded-lg"
                  />
                )}
              </>
            )}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => previewUrl && window.open(previewUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir em nova aba
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

export function DocumentUpload({ 
  documentos, 
  onUpload, 
  onRemove,
  onApprove,
  onReject,
  onToggleObrigatorio,
  isAdmin = false,
  editableObrigatorio = false
}: DocumentUploadProps) {
  const documentosObrigatorios = documentos.filter(d => d.obrigatorio);
  const documentosOpcionais = documentos.filter(d => !d.obrigatorio);

  const aprovadosObrigatorios = documentosObrigatorios.filter(d => d.status === 'aprovado').length;
  const totalObrigatorios = documentosObrigatorios.length;

  // Calculate percentage safely to avoid division by zero
  const progressPercent = totalObrigatorios > 0 
    ? Math.round((aprovadosObrigatorios / totalObrigatorios) * 100) 
    : 0;

  // If editable mode, show all documents in a single list with checkboxes
  if (editableObrigatorio) {
    return (
      <div className="space-y-6">
        <div className="bg-muted/50 rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-foreground text-sm">Configurar Documentos</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Marque a caixa para tornar o documento obrigatório. Documentos obrigatórios precisam ser enviados para concluir a admissão.
          </p>
        </div>
        
        <div className="space-y-3">
          <AnimatePresence>
            {documentos.map(doc => (
              <DocumentItem
                key={doc.id}
                documento={doc}
                onUpload={(file) => onUpload(doc.id, file)}
                onRemove={() => onRemove(doc.id)}
                onApprove={() => onApprove?.(doc.id)}
                onReject={(motivo) => onReject?.(doc.id, motivo)}
                onToggleObrigatorio={(obrigatorio) => onToggleObrigatorio?.(doc.id, obrigatorio)}
                isAdmin={isAdmin}
                editableObrigatorio={editableObrigatorio}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress header */}
      {totalObrigatorios > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-foreground">Progresso dos Documentos</h3>
              <p className="text-sm text-muted-foreground">
                {aprovadosObrigatorios} de {totalObrigatorios} documentos obrigatórios aprovados
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-primary">
                {progressPercent}%
              </span>
            </div>
          </div>
          <Progress 
            value={progressPercent} 
            className="h-2"
          />
        </div>
      )}

      {/* Documentos Obrigatórios */}
      {documentosObrigatorios.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-warning" />
            Documentos Obrigatórios ({documentosObrigatorios.length})
          </h4>
          <div className="space-y-3">
            <AnimatePresence>
              {documentosObrigatorios.map(doc => (
                <DocumentItem
                  key={doc.id}
                  documento={doc}
                  onUpload={(file) => onUpload(doc.id, file)}
                  onRemove={() => onRemove(doc.id)}
                  onApprove={() => onApprove?.(doc.id)}
                  onReject={(motivo) => onReject?.(doc.id, motivo)}
                  isAdmin={isAdmin}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Documentos Opcionais */}
      {documentosOpcionais.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <FileIcon2 className="h-4 w-4 text-muted-foreground" />
            Documentos Opcionais ({documentosOpcionais.length})
          </h4>
          <div className="space-y-3">
            <AnimatePresence>
              {documentosOpcionais.map(doc => (
                <DocumentItem
                  key={doc.id}
                  documento={doc}
                  onUpload={(file) => onUpload(doc.id, file)}
                  onRemove={() => onRemove(doc.id)}
                  onApprove={() => onApprove?.(doc.id)}
                  onReject={(motivo) => onReject?.(doc.id, motivo)}
                  isAdmin={isAdmin}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
