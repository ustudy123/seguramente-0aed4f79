import { CheckCircle2, ClipboardCheck, Copy, Download, Mail, MessageCircle, Share2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Admissao, DOCUMENTOS_OBRIGATORIOS } from '@/types/admissao';
import { cn } from '@/lib/utils';

interface DocumentChecklistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  admissao: Admissao;
}

export function DocumentChecklistModal({ open, onOpenChange, admissao }: DocumentChecklistModalProps) {
  const nomeColaborador = admissao.dadosPessoais?.nomeCompleto || 'Colaborador';
  
  // Combina os documentos obrigatórios padrão com os que já estão na admissão
  // se houver algum personalizado, mas prioriza a lista de DOCUMENTOS_OBRIGATORIOS
  const documentos = DOCUMENTOS_OBRIGATORIOS.map(doc => {
    const enviado = admissao.documentos?.find(d => d.nome === doc.nome && d.status === 'aprovado');
    return {
      ...doc,
      concluido: !!enviado
    };
  });

  const total = documentos.length;
  const concluidos = documentos.filter(d => d.concluido).length;

  const generateText = () => {
    let text = `*Checklist de Documentos para Admissão - YourEyes*\n\n`;
    text += `*Colaborador:* ${nomeColaborador}\n`;
    text += `*Cargo:* ${admissao.dadosProfissionais?.cargo || 'Não definido'}\n\n`;
    text += `Olá, por favor, providencie os seguintes documentos para sua admissão:\n\n`;
    
    documentos.forEach(doc => {
      text += `${doc.concluido ? '✅' : '⬜'} ${doc.nome}${doc.obrigatorio ? ' (Obrigatório)' : ' (Opcional)'}\n`;
    });
    
    text += `\nCaso tenha alguma dúvida, entre em contato conosco.\n\n_Gerado pelo YourEyes - Gestão de RH_`;
    return text;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateText());
    toast.success('Checklist copiado para a área de transferência!');
  };

  const handleDownload = () => {
    const text = generateText().replace(/\*/g, '');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `checklist_admissao_${nomeColaborador.replace(/\s+/g, '_').toLowerCase()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Arquivo baixado com sucesso!');
  };

  const handleSendWhatsApp = () => {
    const text = encodeURIComponent(generateText());
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleSendEmail = () => {
    const subject = encodeURIComponent(`Checklist de Documentos para Admissão - ${nomeColaborador}`);
    const body = encodeURIComponent(generateText().replace(/\*/g, ''));
    window.location.href = `mailto:${admissao.dadosContato?.email || ''}?subject=${subject}&body=${body}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            <DialogTitle>Checklist de Documentos</DialogTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Acompanhe ou envie a lista de documentos necessários para a admissão de <span className="font-semibold text-foreground">{nomeColaborador}</span>.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Progresso</span>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-none">
                {concluidos}/{total} documentos
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              {Math.round((concluidos / total) * 100)}% concluído
            </span>
          </div>

          <div className="border rounded-lg overflow-hidden bg-muted/30">
            <div className="max-h-[300px] overflow-y-auto p-4 space-y-3">
              {documentos.map((doc, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className={cn(
                    "mt-0.5 rounded-full p-0.5",
                    doc.concluido ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
                  )}>
                    {doc.concluido ? <CheckCircle2 className="h-3.5 w-3.5" /> : <div className="h-3.5 w-3.5 border-2 border-current rounded-full" />}
                  </div>
                  <div className="flex-1">
                    <p className={cn("text-sm font-medium", doc.concluido && "text-muted-foreground line-through")}>
                      {doc.nome}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {doc.obrigatorio ? 'Obrigatório' : 'Opcional'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
              <Copy className="h-4 w-4" />
              Copiar Texto
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload} className="gap-2">
              <Download className="h-4 w-4" />
              Baixar Documento
            </Button>
            <Button variant="outline" size="sm" onClick={handleSendWhatsApp} className="gap-2 hover:bg-success/10 hover:text-success hover:border-success/30">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </Button>
            <Button variant="outline" size="sm" onClick={handleSendEmail} className="gap-2 hover:bg-primary/10 hover:text-primary hover:border-primary/30">
              <Mail className="h-4 w-4" />
              E-mail
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
