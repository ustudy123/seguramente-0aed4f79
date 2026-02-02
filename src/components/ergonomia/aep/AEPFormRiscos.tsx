import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dumbbell, Brain } from "lucide-react";
import type { AEPRiscosFisicos, AEPRiscosCognitivos, NivelRisco } from "@/types/aep";
import { FATORES_FISICOS_LABELS, FATORES_COGNITIVOS_LABELS, NIVEL_RISCO_LABELS } from "@/types/aep";

interface AEPFormRiscosProps {
  riscosFisicos: AEPRiscosFisicos;
  riscosCognitivos: AEPRiscosCognitivos;
  onChangeRiscosFisicos: (data: AEPRiscosFisicos) => void;
  onChangeRiscosCognitivos: (data: AEPRiscosCognitivos) => void;
}

export function AEPFormRiscos({ 
  riscosFisicos, 
  riscosCognitivos, 
  onChangeRiscosFisicos, 
  onChangeRiscosCognitivos 
}: AEPFormRiscosProps) {
  
  const handleFisicoChange = (
    field: keyof Omit<AEPRiscosFisicos, 'usoAuxilioMecanico'>, 
    subField: 'observacao' | 'nivelRisco', 
    value: string
  ) => {
    onChangeRiscosFisicos({
      ...riscosFisicos,
      [field]: {
        ...riscosFisicos[field],
        [subField]: value,
      },
    });
  };

  const handleAuxilioMecanicoChange = (field: 'usado' | 'observacao', value: boolean | string) => {
    onChangeRiscosFisicos({
      ...riscosFisicos,
      usoAuxilioMecanico: {
        ...riscosFisicos.usoAuxilioMecanico,
        [field]: value,
      },
    });
  };

  const handleCognitivoChange = (
    field: keyof AEPRiscosCognitivos, 
    subField: 'observacao' | 'nivelRisco', 
    value: string
  ) => {
    onChangeRiscosCognitivos({
      ...riscosCognitivos,
      [field]: {
        ...riscosCognitivos[field],
        [subField]: value,
      },
    });
  };

  const fisicoFields = [
    'postura',
    'movimentosRepetitivos',
    'forcaFisica',
    'levantamentoCargas',
    'empurrarPuxar',
    'esforcoMuscularLocalizado',
    'frequenciaEsforco',
  ] as const;

  const cognitivoFields = [
    'ritmoImposto',
    'pressaoTempoMetas',
    'atencaoContinua',
    'sobrecargaMental',
    'subcargaBoreout',
    'autonomia',
    'pausas',
    'jornada',
    'climaRelacional',
    'sentidoTrabalho',
  ] as const;

  return (
    <div className="space-y-4">
      {/* 5.1 Eixo Físico */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Dumbbell className="h-5 w-5 text-blue-600" />
            5.1 Eixo Físico
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-medium">Fator Avaliado</th>
                  <th className="text-left py-2 px-2 font-medium">Observação</th>
                  <th className="text-left py-2 px-2 font-medium w-40">Nível de Risco</th>
                </tr>
              </thead>
              <tbody>
                {fisicoFields.map((field) => (
                  <tr key={field} className="border-b">
                    <td className="py-2 px-2 font-medium">
                      {FATORES_FISICOS_LABELS[field]}
                    </td>
                    <td className="py-2 px-2">
                      <Input
                        value={riscosFisicos[field].observacao}
                        onChange={(e) => handleFisicoChange(field, 'observacao', e.target.value)}
                        placeholder="Observação..."
                        className="h-8"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <Select
                        value={riscosFisicos[field].nivelRisco}
                        onValueChange={(value) => handleFisicoChange(field, 'nivelRisco', value)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(NIVEL_RISCO_LABELS).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
                <tr className="border-b">
                  <td className="py-2 px-2 font-medium">Uso de auxílio mecânico</td>
                  <td className="py-2 px-2">
                    <Input
                      value={riscosFisicos.usoAuxilioMecanico.observacao}
                      onChange={(e) => handleAuxilioMecanicoChange('observacao', e.target.value)}
                      placeholder="Observação..."
                      className="h-8"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={riscosFisicos.usoAuxilioMecanico.usado}
                        onCheckedChange={(checked) => handleAuxilioMecanicoChange('usado', checked)}
                      />
                      <span className="text-sm">{riscosFisicos.usoAuxilioMecanico.usado ? 'Sim' : 'Não'}</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 5.2 Eixo Cognitivo e Organizacional */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-purple-600" />
            5.2 Eixo Cognitivo e Organizacional
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            📌 Indicadores utilizados: registros de humor (quando aplicável), observações organizacionais, 
            questionários fundamentados (ex.: COPSOQ adaptado), registros de ocorrência e dados de jornada.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-medium">Fator Avaliado</th>
                  <th className="text-left py-2 px-2 font-medium">Observação</th>
                  <th className="text-left py-2 px-2 font-medium w-40">Nível de Risco</th>
                </tr>
              </thead>
              <tbody>
                {cognitivoFields.map((field) => (
                  <tr key={field} className="border-b">
                    <td className="py-2 px-2 font-medium">
                      {FATORES_COGNITIVOS_LABELS[field]}
                    </td>
                    <td className="py-2 px-2">
                      <Input
                        value={riscosCognitivos[field].observacao}
                        onChange={(e) => handleCognitivoChange(field, 'observacao', e.target.value)}
                        placeholder="Observação..."
                        className="h-8"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <Select
                        value={riscosCognitivos[field].nivelRisco}
                        onValueChange={(value) => handleCognitivoChange(field, 'nivelRisco', value as NivelRisco)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(NIVEL_RISCO_LABELS).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
