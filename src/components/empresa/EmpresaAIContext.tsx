import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Brain, Info, Pencil, Save, X, FileText } from 'lucide-react';
import type { EmpresaCadastro } from '@/types/empresa';
import { toast } from 'sonner';

interface EmpresaAIContextProps {
  data: Partial<EmpresaCadastro>;
  onChange: (updates: Partial<EmpresaCadastro>) => void;
}

export function EmpresaAIContext({ data, onChange }: EmpresaAIContextProps) {
  const hasContent = !!(data.ai_context && data.ai_context.trim().length > 0);
  // Inicia em modo visualização se já houver conteúdo, ou em edição se vazio
  const [isEditing, setIsEditing] = useState(!hasContent);
  const [draft, setDraft] = useState(data.ai_context || '');

  // Sincroniza o draft quando o conteúdo externo muda (ex: troca de empresa)
  useEffect(() => {
    setDraft(data.ai_context || '');
    setIsEditing(!(data.ai_context && data.ai_context.trim().length > 0));
  }, [data.id]);

  const handleSave = () => {
    onChange({ ai_context: draft });
    setIsEditing(false);
    toast.success('Contexto salvo com sucesso!');
  };

  const handleCancel = () => {
    setDraft(data.ai_context || '');
    setIsEditing(false);
  };

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

      <div className="grid gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="ai_context" className="flex items-center gap-2">
              Descrição do Contexto da Empresa
              <Info className="w-4 h-4 text-muted-foreground" />
            </Label>
            {!isEditing && hasContent && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="gap-2"
              >
                <Pencil className="w-3.5 h-3.5" />
                Editar
              </Button>
            )}
          </div>

          {isEditing ? (
            <>
              <Textarea
                id="ai_context"
                placeholder="Ex: Empresa focada em inovação no setor têxtil, com forte cultura de segurança e sustentabilidade. Atualmente revisando processos de NR-12 e buscando certificação ISO 45001. Referência interna: Manual de Conduta v2.0..."
                className="min-h-[300px] resize-y"
                maxLength={3000}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoFocus
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Dica: Inclua informações sobre o setor, porte, objetivos estratégicos, referências a documentos internos e qualquer detalhe que ajude a I.A. a entender melhor sua empresa.
                </p>
                <span className={`text-xs shrink-0 ml-2 ${draft.length >= 2800 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {draft.length}/3.000
                </span>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                {hasContent && (
                  <Button type="button" variant="ghost" onClick={handleCancel} className="gap-2">
                    <X className="w-4 h-4" />
                    Cancelar
                  </Button>
                )}
                <Button type="button" onClick={handleSave} className="gap-2">
                  <Save className="w-4 h-4" />
                  Salvar Contexto
                </Button>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-border bg-muted/30 p-5 min-h-[200px]">
              {hasContent ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground border-b border-border/60 pb-2">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Contexto salvo · {data.ai_context!.length} caracteres</span>
                  </div>
                  <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {data.ai_context}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-8 text-muted-foreground">
                  <FileText className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">Nenhum contexto cadastrado ainda.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="mt-3 gap-2"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Adicionar Contexto
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
