import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  File, 
  FileText, 
  Image, 
  CheckCircle, 
  XCircle, 
  Clock,
  Trash2,
  Eye,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DocumentoAdmissao, DocumentoStatus } from '@/types/admissao';
import { cn } from '@/lib/utils';

interface DocumentUploadProps {
  documentos: DocumentoAdmissao[];
  onUpload: (documentoId: string, file: File) => void;
  onRemove: (documentoId: string) => void;
  onApprove?: (documentoId: string) => void;
  onReject?: (documentoId: string, motivo: string) => void;
  isAdmin?: boolean;
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
  isAdmin 
}: { 
  documento: DocumentoAdmissao;
  onUpload: (file: File) => void;
  onRemove: () => void;
  onApprove?: () => void;
  onReject?: (motivo: string) => void;
  isAdmin?: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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

  const getFileIcon = () => {
    if (documento.arquivo?.type.startsWith('image/')) return Image;
    return FileText;
  };

  const FileIcon = getFileIcon();

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
            {documento.arquivo ? (
              <FileIcon className={cn("h-5 w-5", STATUS_CONFIG[documento.status].color)} />
            ) : (
              <File className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-foreground">{documento.nome}</span>
              {documento.obrigatorio && (
                <Badge variant="outline" className="text-xs">Obrigatório</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusIcon className={cn("h-3 w-3", STATUS_CONFIG[documento.status].color)} />
              <span className={cn("text-xs", STATUS_CONFIG[documento.status].color)}>
                {STATUS_CONFIG[documento.status].label}
              </span>
              {documento.arquivo && (
                <span className="text-xs text-muted-foreground">
                  • {documento.arquivo.name}
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

          {documento.arquivo && documento.status !== 'rejeitado' && (
            <Button size="sm" variant="ghost">
              <Eye className="h-4 w-4" />
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
    </motion.div>
  );
}

export function DocumentUpload({ 
  documentos, 
  onUpload, 
  onRemove,
  onApprove,
  onReject,
  isAdmin = false 
}: DocumentUploadProps) {
  const documentosObrigatorios = documentos.filter(d => d.obrigatorio);
  const documentosOpcionais = documentos.filter(d => !d.obrigatorio);

  const enviadosObrigatorios = documentosObrigatorios.filter(d => d.status !== 'pendente').length;
  const aprovadosObrigatorios = documentosObrigatorios.filter(d => d.status === 'aprovado').length;

  return (
    <div className="space-y-6">
      {/* Progress header */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-foreground">Progresso dos Documentos</h3>
            <p className="text-sm text-muted-foreground">
              {aprovadosObrigatorios} de {documentosObrigatorios.length} documentos obrigatórios aprovados
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-primary">
              {Math.round((aprovadosObrigatorios / documentosObrigatorios.length) * 100)}%
            </span>
          </div>
        </div>
        <Progress 
          value={(aprovadosObrigatorios / documentosObrigatorios.length) * 100} 
          className="h-2"
        />
      </div>

      {/* Documentos Obrigatórios */}
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

      {/* Documentos Opcionais */}
      {documentosOpcionais.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <File className="h-4 w-4 text-muted-foreground" />
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
