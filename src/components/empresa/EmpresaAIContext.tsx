import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Brain, Info } from 'lucide-react';
import type { EmpresaCadastro } from '@/types/empresa';

interface EmpresaAIContextProps {
  data: Partial<EmpresaCadastro>;
  onChange: (updates: Partial<EmpresaCadastro>) => void;
}

export function EmpresaAIContext({ data, onChange }: EmpresaAIContextProps) {
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
          <Label htmlFor="ai_context" className="flex items-center gap-2">
            Descrição do Contexto da Empresa
            <Info className="w-4 h-4 text-muted-foreground" />
          </Label>
          <Textarea
            id="ai_context"
            placeholder="Ex: Empresa focada em inovação no setor têxtil, com forte cultura de segurança e sustentabilidade. Atualmente revisando processos de NR-12 e buscando certificação ISO 45001. Referência interna: Manual de Conduta v2.0..."
            className="min-h-[300px] resize-y"
            value={data.ai_context || ''}
            onChange={(e) => onChange({ ai_context: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Dica: Inclua informações sobre o setor, porte, objetivos estratégicos, referências a documentos internos e qualquer detalhe que ajude a I.A. a entender melhor sua empresa.
          </p>
        </div>
      </div>
    </div>
  );
}
