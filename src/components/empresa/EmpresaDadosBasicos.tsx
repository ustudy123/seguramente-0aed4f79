import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CepInput } from '@/components/ui/cep-input';
import { Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { formatCnpj, cleanCnpj, validateCnpj, buscarCnpj } from '@/lib/brasilapi';
import type { EnderecoData } from '@/lib/viacep';
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
  const [cnpjLoading, setCnpjLoading] = useState(false);

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = cleanCnpj(e.target.value);
    if (cleaned.length <= 14) {
      onChange({ cnpj: formatCnpj(cleaned) });
    }
  };

  const handleBuscarCnpj = useCallback(async () => {
    if (!data.cnpj || !validateCnpj(data.cnpj)) {
      toast.error('Digite um CNPJ válido com 14 dígitos.');
      return;
    }
    setCnpjLoading(true);
    try {
      const result = await buscarCnpj(data.cnpj);
      if (!result) {
        toast.error('CNPJ não encontrado na base da Receita Federal.');
        return;
      }
      onChange({
        razao_social: result.razao_social || data.razao_social,
        nome_fantasia: result.nome_fantasia || data.nome_fantasia,
        endereco: result.logradouro || data.endereco,
        numero: result.numero || data.numero,
        complemento: result.complemento || data.complemento,
        bairro: result.bairro || data.bairro,
        cidade: result.municipio || data.cidade,
        estado: result.uf || data.estado,
        cep: result.cep?.replace(/\D/g, '') || data.cep,
        email: result.email || data.email,
        telefone: result.telefone || data.telefone,
        cnae_principal: String(result.cnae_fiscal) || data.cnae_principal,
        cnae_descricao: result.cnae_fiscal_descricao || data.cnae_descricao,
        cnaes_secundarios: result.cnaes_secundarios?.map(c => ({
          codigo: String(c.codigo),
          descricao: c.descricao,
        })) ?? data.cnaes_secundarios,
      });
      toast.success('Dados do CNPJ carregados com sucesso!');
    } catch {
      toast.error('Erro ao buscar CNPJ.');
    } finally {
      setCnpjLoading(false);
    }
  }, [data, onChange]);

  const handleAddressFound = useCallback((endereco: EnderecoData) => {
    onChange({
      endereco: endereco.logradouro,
      bairro: endereco.bairro,
      cidade: endereco.cidade,
      estado: endereco.estado,
    });
    toast.success('Endereço preenchido automaticamente!');
  }, [onChange]);

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
          <div className="flex gap-2">
            <Input
              placeholder="00.000.000/0000-00"
              value={data.cnpj || ''}
              onChange={handleCnpjChange}
              maxLength={18}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleBuscarCnpj}
              disabled={cnpjLoading || !validateCnpj(data.cnpj || '')}
              title="Buscar dados na Receita Federal"
            >
              {cnpjLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Clique na lupa para preencher automaticamente
          </p>
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
            <CepInput
              value={data.cep || ''}
              onChange={(value) => onChange({ cep: value })}
              onAddressFound={handleAddressFound}
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
