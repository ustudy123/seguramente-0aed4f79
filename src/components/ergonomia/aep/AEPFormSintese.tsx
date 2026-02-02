import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Plus, X, AlertTriangle } from "lucide-react";
import type { AEPSinteseAvaliacao, ClassificacaoRisco, NecessidadeAET } from "@/types/aep";
import { CLASSIFICACAO_RISCO_LABELS } from "@/types/aep";
import { cn } from "@/lib/utils";

interface AEPFormSinteseProps {
  data: AEPSinteseAvaliacao;
  onChange: (data: AEPSinteseAvaliacao) => void;
}

const CLASSIFICACAO_COLORS: Record<ClassificacaoRisco, string> = {
  baixo: 'bg-success/10 text-success border-success/30',
  medio: 'bg-warning/10 text-warning border-warning/30',
  alto: 'bg-destructive/10 text-destructive border-destructive/30',
};

export function AEPFormSintese({ data, onChange }: AEPFormSinteseProps) {
  const [novoPontoCritico, setNovoPontoCritico] = useState('');

  const handleAddPontoCritico = () => {
    if (novoPontoCritico.trim()) {
      onChange({
        ...data,
        pontosCriticos: [...data.pontosCriticos, novoPontoCritico.trim()],
      });
      setNovoPontoCritico('');
    }
  };

  const handleRemovePontoCritico = (index: number) => {
    onChange({
      ...data,
      pontosCriticos: data.pontosCriticos.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-4">
      {/* 6. Síntese da Avaliação de Risco */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-primary" />
            6. Síntese da Avaliação de Risco
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 6.1 Classificação Geral */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm">6.1 Classificação Geral</h4>
            
            <RadioGroup
              value={data.classificacaoGeral}
              onValueChange={(value) => onChange({ ...data, classificacaoGeral: value as ClassificacaoRisco })}
              className="flex flex-col gap-3"
            >
              {(Object.entries(CLASSIFICACAO_RISCO_LABELS) as [ClassificacaoRisco, string][]).map(([key, label]) => (
                <div key={key} className="flex items-center space-x-3">
                  <RadioGroupItem value={key} id={`classificacao-${key}`} />
                  <Label 
                    htmlFor={`classificacao-${key}`}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer",
                      data.classificacaoGeral === key && CLASSIFICACAO_COLORS[key]
                    )}
                  >
                    <span className={cn(
                      "w-3 h-3 rounded-full",
                      key === 'baixo' && "bg-success",
                      key === 'medio' && "bg-warning",
                      key === 'alto' && "bg-destructive"
                    )} />
                    {label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* 6.2 Pontos Críticos Identificados */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm">6.2 Pontos Críticos Identificados</h4>
            
            <div className="flex gap-2">
              <Input
                value={novoPontoCritico}
                onChange={(e) => setNovoPontoCritico(e.target.value)}
                placeholder="Adicionar ponto crítico..."
                onKeyDown={(e) => e.key === 'Enter' && handleAddPontoCritico()}
              />
              <Button type="button" onClick={handleAddPontoCritico} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {data.pontosCriticos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {data.pontosCriticos.map((ponto, index) => (
                  <Badge key={index} variant="outline" className="gap-1 pr-1">
                    {ponto}
                    <button 
                      type="button"
                      onClick={() => handleRemovePontoCritico(index)}
                      className="ml-1 hover:bg-muted rounded p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 7. Necessidade de AET */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-warning" />
            7. Necessidade de AET
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Com base na análise preliminar:
          </p>
          
          <RadioGroup
            value={data.necessidadeAET}
            onValueChange={(value) => onChange({ ...data, necessidadeAET: value as NecessidadeAET })}
            className="flex flex-col gap-3"
          >
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="nao_indicado" id="aet-nao" />
              <Label htmlFor="aet-nao" className="cursor-pointer">
                ☐ Não há indicativo de necessidade de AET no momento
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="indicado" id="aet-sim" />
              <Label htmlFor="aet-sim" className="cursor-pointer">
                ☑ Há indicativo de necessidade de AET para aprofundamento
              </Label>
            </div>
          </RadioGroup>

          <div className="space-y-2">
            <Label htmlFor="justificativaAET">Justificativa</Label>
            <Textarea
              id="justificativaAET"
              value={data.justificativaAET}
              onChange={(e) => onChange({ ...data, justificativaAET: e.target.value })}
              placeholder="Descreva objetivamente a justificativa..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
