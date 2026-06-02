import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CepInput } from '@/components/ui/cep-input';
import { CpfInput } from '@/components/ui/cpf-input';
import { Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { formatCnpj, cleanCnpj, validateCnpj } from '@/lib/cnpj';
import { buscarCnpj } from '@/lib/brasilapi';
import { formatCei, cleanCei, formatCaepf, cleanCaepf } from '@/lib/cei';
import type { EnderecoData } from '@/lib/viacep';
import { EmpresaHierarquiaFields } from './EmpresaHierarquiaFields';
import type { EmpresaCadastro } from '@/types/empresa';

const ESTADOS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
  'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
];

interface Props {
  data: Partial<EmpresaCadastro>;
  onChange: (updates: Partial<EmpresaCadastro>) => void;
  matrizes?: { id: string; razao_social: string | null; cnpj: string | null; grupo_economico_id?: string | null }[];
  currentEmpresaId?: string | null;
}

export function EmpresaDadosBasicos({ data, onChange, matrizes = [], currentEmpresaId }: Props) {
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const tipoPessoa = data.tipo_pessoa || 'pj';

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

  const handleCeiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = cleanCei(e.target.value);
    if (cleaned.length <= 12) {
      onChange({ cei: formatCei(cleaned) });
    }
  };

  const handleCaepfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = cleanCaepf(e.target.value);
    if (cleaned.length <= 15) {
      onChange({ caepf: formatCaepf(cleaned) });
    }
  };

  return (
    <div className="space-y-6">
      {/* Hierarquia e Grupo Econômico */}
      <EmpresaHierarquiaFields
        data={data}
        onChange={onChange}
        matrizes={matrizes}
        currentEmpresaId={currentEmpresaId}
      />

      {/* Tipo de Pessoa */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Tipo de Empregador *</Label>
          <Select
            value={tipoPessoa}
            onValueChange={(v) => onChange({
              tipo_pessoa: v as 'pf' | 'pj',
              ...(v === 'pf' ? { cnpj: null } : { cpf: null, cei: null, caepf: null }),
            })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pj">Pessoa Jurídica (CNPJ)</SelectItem>
              <SelectItem value="pf">Pessoa Física (CPF)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {tipoPessoa === 'pj' ? (
          <>
            <div className="space-y-2">
              <Label>CNPJ *</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="00.000.000/0000-00"
                  value={data.cnpj || ''}
                  onChange={handleCnpjChange}
                  maxLength={18}
                  disabled={false}
                  className=""
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
                Clique na lupa para buscar/atualizar dados na Receita Federal.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Inscrição Estadual</Label>
              <Input
                placeholder="Somente números"
                value={data.inscricao_estadual || ''}
                inputMode="numeric"
                maxLength={20}
                onChange={(e) => onChange({ inscricao_estadual: e.target.value.replace(/\D/g, '') })}
              />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label>CPF *</Label>
              <CpfInput
                value={data.cpf || ''}
                onChange={(value) => onChange({ cpf: value })}
                disabled={false}
                className=""
              />
            </div>
            <div className="space-y-2">
              <Label>CEI</Label>
              <Input
                placeholder="XX.XXX.XXXXX/XX"
                value={data.cei || ''}
                onChange={handleCeiChange}
                maxLength={15}
                inputMode="numeric"
              />
            </div>
          </>
        )}
      </div>

      {tipoPessoa === 'pf' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>CAEPF</Label>
            <Input
              placeholder="XXX.XXX.XXX/XXXX-XX"
              value={data.caepf || ''}
              onChange={handleCaepfChange}
              maxLength={20}
              inputMode="numeric"
            />
          </div>
        </div>
      )}

      {tipoPessoa === 'pj' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Inscrição Municipal</Label>
            <Input
              placeholder="Somente números"
              value={data.inscricao_municipal || ''}
              inputMode="numeric"
              maxLength={20}
              onChange={(e) => onChange({ inscricao_municipal: e.target.value.replace(/\D/g, '') })}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{tipoPessoa === 'pf' ? 'Nome Completo' : 'Razão Social'}</Label>
          <Input
            placeholder={tipoPessoa === 'pf' ? 'Nome completo' : 'Razão Social completa'}
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
          <Label>Telefone</Label>
          <PhoneInput
            value={data.telefone || ''}
            onChange={(v) => onChange({ telefone: v })}
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Total de Colaboradores</Label>
          <Input
            type="number"
            placeholder="Ex: 150"
            value={data.total_colaboradores || ''}
            onChange={(e) => onChange({ total_colaboradores: parseInt(e.target.value) || 0 })}
          />
          <p className="text-xs text-muted-foreground">
            Usado para CIPA, PCD e Jovem Aprendiz
          </p>
        </div>
      </div>
    </div>
  );
}
