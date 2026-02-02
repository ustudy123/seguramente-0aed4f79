import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PenTool } from "lucide-react";
import type { AEPAssinatura } from "@/types/aep";

interface AEPFormAssinaturasProps {
  data: AEPAssinatura;
  onChange: (data: AEPAssinatura) => void;
}

export function AEPFormAssinaturas({ data, onChange }: AEPFormAssinaturasProps) {
  const handleChange = (field: keyof AEPAssinatura, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-4">
      {/* 9. Relação com Documentos Legais */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">9. Relação com Documentos Legais</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Esta AEP deve ser considerada em conjunto com:
          </p>
          <ul className="text-sm text-muted-foreground mt-2 space-y-1">
            <li>• PGR vigente</li>
            <li>• PCMSO vigente</li>
            <li>• LTCAT (quando aplicável)</li>
          </ul>
          <p className="text-sm text-muted-foreground mt-2">
            Eventuais inconsistências devem ser tratadas no Módulo Compliance SST.
          </p>
        </CardContent>
      </Card>

      {/* 10. Conclusão */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">10. Conclusão</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            A presente Análise Ergonômica Preliminar atende aos requisitos da NR-17 e do Manual de Aplicação, 
            constituindo instrumento válido de identificação inicial de riscos ergonômicos e apoio à gestão preventiva.
          </p>
        </CardContent>
      </Card>

      {/* 11. Responsabilidades e Observações Finais */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">11. Responsabilidades e Observações Finais</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• Este documento não substitui laudos técnicos específicos quando exigidos, nem a atuação de profissional legalmente habilitado.</li>
            <li>• A empresa é responsável por implementar e monitorar as ações recomendadas.</li>
          </ul>
        </CardContent>
      </Card>

      {/* 12. Assinaturas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <PenTool className="h-5 w-5 text-primary" />
            12. Assinaturas (Opcional)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Responsável pela Avaliação</h4>
            
            <div className="space-y-2">
              <Label htmlFor="responsavelAvaliacao">Nome</Label>
              <Input
                id="responsavelAvaliacao"
                value={data.responsavelAvaliacao}
                onChange={(e) => handleChange('responsavelAvaliacao', e.target.value)}
                placeholder="Nome do responsável"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dataAssinatura">Data</Label>
              <Input
                id="dataAssinatura"
                type="date"
                value={data.dataAssinatura}
                onChange={(e) => handleChange('dataAssinatura', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-sm">Profissional Validador</h4>
            
            <div className="space-y-2">
              <Label htmlFor="profissionalValidador">Nome</Label>
              <Input
                id="profissionalValidador"
                value={data.profissionalValidador || ''}
                onChange={(e) => handleChange('profissionalValidador', e.target.value)}
                placeholder="Nome do profissional"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="registroProfissional">Registro Profissional</Label>
              <Input
                id="registroProfissional"
                value={data.registroProfissional || ''}
                onChange={(e) => handleChange('registroProfissional', e.target.value)}
                placeholder="CREA, CRM, etc."
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
