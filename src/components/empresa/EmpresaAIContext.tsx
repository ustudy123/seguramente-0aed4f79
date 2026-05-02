import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Brain, Info, Pencil, Save, X, FileText, Maximize2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { EmpresaCadastro } from '@/types/empresa';
import { toast } from 'sonner';

interface EmpresaAIContextProps {
  data: Partial<EmpresaCadastro>;
  onChange: (updates: Partial<EmpresaCadastro>) => void;
}

export function EmpresaAIContext({ data, onChange }: EmpresaAIContextProps) {
  const hasContent = !!(data.ai_context && data.ai_context.trim().length > 0);
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(data.ai_context || '');

  // Sincroniza o draft quando o conteúdo externo muda (ex: troca de empresa)
  useEffect(() => {
    setDraft(data.ai_context || '');
    setIsEditing(false);
    setIsOpen(false);
  }, [data.id]);

  const openView = () => {
    setDraft(data.ai_context || '');
    setIsEditing(false);
    setIsOpen(true);
  };

  const openEdit = () => {
    setDraft(data.ai_context || '');
    setIsEditing(true);
    setIsOpen(true);
  };

  const handleSave = () => {
    onChange({ ai_context: draft });
    setIsEditing(false);
    toast.success('Contexto salvo com sucesso!');
  };

  const handleCancel = () => {
    setDraft(data.ai_context || '');
    if (hasContent) {
      setIsEditing(false);
    } else {
      setIsOpen(false);
    }
  };

  const preview = (data.ai_context || '').slice(0, 180);

  return (
    <div className="space-y-6">
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
        <div className="bg-primary/10 rounded-full p-2 mt-0.5 shrink-0">
          <Brain className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            Contexto para Inteligência Artificial
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            As informações fornecidas aqui serão utilizadas por todas as ferramentas de I.A. do sistema.
            Ao fornecer detalhes sobre a cultura, objetivos, documentos de referência e contexto específico da empresa,
            você garante sugestões e análises muito mais precisas e personalizadas, evitando respostas genéricas.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          Descrição do Contexto da Empresa
          <Info className="w-4 h-4 text-muted-foreground" />
        </Label>

        {hasContent ? (
          <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-background p-5 shadow-sm">
            <div className="absolute -right-12 -top-12 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
            <div className="relative">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-2">
                  <div className="bg-primary/15 rounded-md p-1.5">
                    <Brain className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-foreground">Contexto Salvo</span>
                    <span className="text-xs text-muted-foreground">{data.ai_context!.length} caracteres registrados</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button type="button" variant="outline" size="sm" onClick={openEdit} className="gap-2 bg-background/70 backdrop-blur">
                    <Pencil className="w-3.5 h-3.5" />
                    Editar
                  </Button>
                  <Button type="button" size="sm" onClick={openView} className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md">
                    <Maximize2 className="w-3.5 h-3.5" />
                    Abrir Contexto
                  </Button>
                </div>
              </div>
              <p className="text-sm text-foreground/80 line-clamp-2 leading-relaxed">
                {preview}{(data.ai_context || '').length > 180 ? '…' : ''}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 flex flex-col items-center justify-center text-center text-muted-foreground">
            <FileText className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm mb-3">Nenhum contexto cadastrado ainda.</p>
            <Button type="button" variant="outline" size="sm" onClick={openEdit} className="gap-2">
              <Pencil className="w-3.5 h-3.5" />
              Adicionar Contexto
            </Button>
          </div>
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              Contexto para Inteligência Artificial
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Edite o contexto da empresa que será utilizado pelas ferramentas de I.A.'
                : 'Visualização completa do contexto cadastrado.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-2">
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  placeholder="Ex: Empresa focada em inovação no setor têxtil, com forte cultura de segurança e sustentabilidade..."
                  className="min-h-[400px] resize-y"
                  maxLength={3000}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  autoFocus
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Dica: Inclua informações sobre o setor, porte, objetivos estratégicos e referências internas.
                  </p>
                  <span className={`text-xs shrink-0 ml-2 ${draft.length >= 2800 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {draft.length}/3.000
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-muted/30 p-5">
                <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {data.ai_context}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            {isEditing ? (
              <>
                <Button type="button" variant="ghost" onClick={handleCancel} className="gap-2">
                  <X className="w-4 h-4" />
                  Cancelar
                </Button>
                <Button type="button" onClick={handleSave} className="gap-2">
                  <Save className="w-4 h-4" />
                  Salvar Contexto
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => setIsEditing(true)} className="gap-2">
                  <Pencil className="w-4 h-4" />
                  Editar
                </Button>
                <Button type="button" onClick={() => setIsOpen(false)}>
                  Fechar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
