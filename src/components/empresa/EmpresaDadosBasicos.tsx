import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { EmpresaCadastro } from '@/types/empresa';

const ESTADOS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
  'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
];

interface Props {
  data: Partial<EmpresaCadastro>;
  onChange: (updates: Partial<EmpresaCadastro>) => void;
}

export function EmpresaDadosBasicos({ data, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Razão Social</Label>
          <Input
            placeholder="Razão Social completa"
            value={data.razao_social || ''}
            onChange={(e) => onChange({ razao_social: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Nome Fantasia</Label>
          <Input
            placeholder="Nome Fantasia"
            value={data.nome_fantasia || ''}
            onChange={(e) => onChange({ nome_fantasia: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>CNPJ</Label>
          <Input
            placeholder="00.000.000/0000-00"
            value={data.cnpj || ''}
            onChange={(e) => onChange({ cnpj: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Inscrição Estadual</Label>
          <Input
            placeholder="Inscrição Estadual"
            value={data.inscricao_estadual || ''}
            onChange={(e) => onChange({ inscricao_estadual: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Inscrição Municipal</Label>
          <Input
            placeholder="Inscrição Municipal"
            value={data.inscricao_municipal || ''}
            onChange={(e) => onChange({ inscricao_municipal: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Telefone</Label>
          <Input
            placeholder="(00) 0000-0000"
            value={data.telefone || ''}
            onChange={(e) => onChange({ telefone: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>E-mail</Label>
          <Input
            type="email"
            placeholder="contato@empresa.com"
            value={data.email || ''}
            onChange={(e) => onChange({ email: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Website</Label>
          <Input
            placeholder="https://www.empresa.com"
            value={data.website || ''}
            onChange={(e) => onChange({ website: e.target.value })}
          />
        </div>
      </div>

      <div className="border-t pt-4">
        <h4 className="text-sm font-medium text-muted-foreground mb-3">Endereço</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>CEP</Label>
            <Input
              placeholder="00000-000"
              value={data.cep || ''}
              onChange={(e) => onChange({ cep: e.target.value })}
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label>Endereço</Label>
            <Input
              placeholder="Rua, Avenida..."
              value={data.endereco || ''}
              onChange={(e) => onChange({ endereco: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Número</Label>
            <Input
              placeholder="Nº"
              value={data.numero || ''}
              onChange={(e) => onChange({ numero: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div className="space-y-2">
            <Label>Complemento</Label>
            <Input
              placeholder="Sala, Andar..."
              value={data.complemento || ''}
              onChange={(e) => onChange({ complemento: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Bairro</Label>
            <Input
              placeholder="Bairro"
              value={data.bairro || ''}
              onChange={(e) => onChange({ bairro: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input
              placeholder="Cidade"
              value={data.cidade || ''}
              onChange={(e) => onChange({ cidade: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select value={data.estado || ''} onValueChange={(v) => onChange({ estado: v })}>
              <SelectTrigger>
                <SelectValue placeholder="UF" />
              </SelectTrigger>
              <SelectContent>
                {ESTADOS.map((uf) => (
                  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Total de Colaboradores</Label>
        <Input
          type="number"
          placeholder="Quantidade total"
          value={data.total_colaboradores || ''}
          onChange={(e) => onChange({ total_colaboradores: parseInt(e.target.value) || 0 })}
        />
        <p className="text-xs text-muted-foreground">
          Utilizado para cálculos de obrigatoriedade (CIPA, PCD, Jovem Aprendiz)
        </p>
      </div>
    </div>
  );
}
