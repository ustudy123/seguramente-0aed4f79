import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2 } from "lucide-react";
import type { AEPIdentificacao } from "@/types/aep";
import { formatCnpj, cleanCnpj } from "@/lib/brasilapi";

interface AEPFormIdentificacaoProps {
  data: AEPIdentificacao;
  onChange: (data: AEPIdentificacao) => void;
}

export function AEPFormIdentificacao({ data, onChange }: AEPFormIdentificacaoProps) {
  const handleChange = (field: keyof AEPIdentificacao, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="h-5 w-5 text-primary" />
          1. Identificação
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="empresa">Empresa *</Label>
          <Input
            id="empresa"
            value={data.empresa}
            onChange={(e) => handleChange('empresa', e.target.value)}
            placeholder="Nome da empresa"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="cnpj">CNPJ *</Label>
          <Input
            id="cnpj"
            value={data.cnpj}
            onChange={(e) => handleChange('cnpj', e.target.value)}
            placeholder="00.000.000/0000-00"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="unidade">Unidade / Local *</Label>
          <Input
            id="unidade"
            value={data.unidade}
            onChange={(e) => handleChange('unidade', e.target.value)}
            placeholder="Filial ou unidade"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="setor">Setor Avaliado *</Label>
          <Input
            id="setor"
            value={data.setor}
            onChange={(e) => handleChange('setor', e.target.value)}
            placeholder="Setor ou departamento"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="funcao">Função Avaliada *</Label>
          <Input
            id="funcao"
            value={data.funcao}
            onChange={(e) => handleChange('funcao', e.target.value)}
            placeholder="Cargo/função avaliada"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="dataAvaliacao">Data da Avaliação *</Label>
          <Input
            id="dataAvaliacao"
            type="date"
            value={data.dataAvaliacao}
            onChange={(e) => handleChange('dataAvaliacao', e.target.value)}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="responsavelLevantamento">Responsável pelo Levantamento *</Label>
          <Input
            id="responsavelLevantamento"
            value={data.responsavelLevantamento}
            onChange={(e) => handleChange('responsavelLevantamento', e.target.value)}
            placeholder="Nome do responsável"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="profissionalValidador">Profissional Validador</Label>
          <Input
            id="profissionalValidador"
            value={data.profissionalValidador || ''}
            onChange={(e) => handleChange('profissionalValidador', e.target.value)}
            placeholder="(se houver)"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="versao">Versão do Documento</Label>
          <Input
            id="versao"
            value={data.versao}
            onChange={(e) => handleChange('versao', e.target.value)}
            placeholder="1.0"
          />
        </div>
      </CardContent>
    </Card>
  );
}
