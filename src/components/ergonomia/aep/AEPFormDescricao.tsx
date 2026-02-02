import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText } from "lucide-react";
import type { AEPDescricaoAtividade } from "@/types/aep";

interface AEPFormDescricaoProps {
  data: AEPDescricaoAtividade;
  onChange: (data: AEPDescricaoAtividade) => void;
}

export function AEPFormDescricao({ data, onChange }: AEPFormDescricaoProps) {
  const handleChange = (field: keyof AEPDescricaoAtividade, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-primary" />
          4. Descrição da Atividade (Trabalho Real)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 4.1 Descrição Geral */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm">4.1 Descrição Geral</h4>
          
          <div className="space-y-2">
            <Label htmlFor="descricaoGeral">Descrição geral da atividade *</Label>
            <Textarea
              id="descricaoGeral"
              value={data.descricaoGeral}
              onChange={(e) => handleChange('descricaoGeral', e.target.value)}
              placeholder="Descreva como a atividade é realmente executada..."
              rows={3}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sequenciaTarefas">Sequência de tarefas</Label>
              <Textarea
                id="sequenciaTarefas"
                value={data.sequenciaTarefas}
                onChange={(e) => handleChange('sequenciaTarefas', e.target.value)}
                placeholder="Descreva a sequência de tarefas..."
                rows={2}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="posturasAdotadas">Posturas adotadas</Label>
              <Textarea
                id="posturasAdotadas"
                value={data.posturasAdotadas}
                onChange={(e) => handleChange('posturasAdotadas', e.target.value)}
                placeholder="Descreva as posturas principais..."
                rows={2}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="ferramentasUtilizadas">Ferramentas utilizadas</Label>
              <Input
                id="ferramentasUtilizadas"
                value={data.ferramentasUtilizadas}
                onChange={(e) => handleChange('ferramentasUtilizadas', e.target.value)}
                placeholder="Ferramentas e equipamentos"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="ritmoRepetitividade">Ritmo e repetitividade</Label>
              <Input
                id="ritmoRepetitividade"
                value={data.ritmoRepetitividade}
                onChange={(e) => handleChange('ritmoRepetitividade', e.target.value)}
                placeholder="Descreva o ritmo de trabalho"
              />
            </div>
            
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="variabilidadeTarefa">Variabilidade da tarefa</Label>
              <Input
                id="variabilidadeTarefa"
                value={data.variabilidadeTarefa}
                onChange={(e) => handleChange('variabilidadeTarefa', e.target.value)}
                placeholder="Existe variabilidade nas tarefas?"
              />
            </div>
          </div>
        </div>

        {/* 4.2 Condições do Ambiente */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm">4.2 Condições do Ambiente de Trabalho</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="espacoFisico">Espaço físico</Label>
              <Input
                id="espacoFisico"
                value={data.espacoFisico}
                onChange={(e) => handleChange('espacoFisico', e.target.value)}
                placeholder="Adequado / Inadequado"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="iluminacao">Iluminação</Label>
              <Input
                id="iluminacao"
                value={data.iluminacao}
                onChange={(e) => handleChange('iluminacao', e.target.value)}
                placeholder="Adequada / Inadequada"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="temperatura">Temperatura</Label>
              <Input
                id="temperatura"
                value={data.temperatura}
                onChange={(e) => handleChange('temperatura', e.target.value)}
                placeholder="Adequada / Inadequada"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="ruido">Ruído</Label>
              <Input
                id="ruido"
                value={data.ruido}
                onChange={(e) => handleChange('ruido', e.target.value)}
                placeholder="Adequado / Inadequado"
              />
            </div>
            
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="organizacaoPosto">Organização do posto</Label>
              <Input
                id="organizacaoPosto"
                value={data.organizacaoPosto}
                onChange={(e) => handleChange('organizacaoPosto', e.target.value)}
                placeholder="Descreva a organização do posto de trabalho"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
