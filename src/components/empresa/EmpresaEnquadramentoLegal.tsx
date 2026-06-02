import { useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Shield, Users } from 'lucide-react';
import { getGrauRiscoByCnae } from '@/lib/cnaeGrauRisco';
import { toast } from 'sonner';
import type { EmpresaCadastro } from '@/types/empresa';
interface Props {
  data: Partial<EmpresaCadastro>;
  onChange: (updates: Partial<EmpresaCadastro>) => void;
}
export function EmpresaEnquadramentoLegal({
  data,
  onChange
}: Props) {
  const grauRisco = data.grau_risco_ajustado || data.grau_risco || 0;
  const prevCnaeRef = useRef<string | undefined>(undefined);

  // Auto-fill grau de risco when CNAE changes or is loaded for the first time
  useEffect(() => {
    if (!data.cnae_principal) return;
    
    const cnaeChanged = data.cnae_principal !== prevCnaeRef.current;
    const grauMissing = !data.grau_risco;
    
    if (cnaeChanged || grauMissing) {
      prevCnaeRef.current = data.cnae_principal;
      const gr = getGrauRiscoByCnae(data.cnae_principal);
      if (gr && gr !== data.grau_risco) {
        onChange({ grau_risco: gr });
        toast.info(`Grau de Risco ${gr} identificado automaticamente pelo CNAE.`);
      }
    }
  }, [data.cnae_principal, data.grau_risco]);
  return <div className="space-y-8">
      {/* CNAE e Grau de Risco */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">CNAE e Grau de Risco (NR-04)</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>CNAE Principal</Label>
            <Input placeholder="Ex: 4120-4/00" value={data.cnae_principal || ''} onChange={e => onChange({
            cnae_principal: e.target.value
          })} />
          </div>
          <div className="space-y-2">
            <Label>Descrição do CNAE</Label>
            <Input placeholder="Descrição da atividade" value={data.cnae_descricao || ''} onChange={e => onChange({
            cnae_descricao: e.target.value
          })} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Grau de Risco</Label>
            <Select value={String(data.grau_risco || '')} onValueChange={v => onChange({
            grau_risco: parseInt(v)
          })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 - Risco Mínimo</SelectItem>
                <SelectItem value="2">2 - Risco Menor</SelectItem>
                <SelectItem value="3">3 - Risco Médio</SelectItem>
                <SelectItem value="4">4 - Risco Grave</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-end">
            {grauRisco >= 3 && <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Risco elevado - obrigações adicionais
              </Badge>}
          </div>
        </div>

        {data.grau_risco_ajustado && data.grau_risco_ajustado !== data.grau_risco && <div className="space-y-2">
            <Label>Justificativa do ajuste</Label>
            <Textarea placeholder="Justifique o ajuste do grau de risco..." value={data.grau_risco_justificativa || ''} onChange={e => onChange({
          grau_risco_justificativa: e.target.value
        })} />
          </div>}
      </section>

      {/* SESMT */}
      <section className="space-y-4 border-t pt-6">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">SESMT (NR-04)</h3>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={data.sesmt_obrigatorio || false} onCheckedChange={v => onChange({
            sesmt_obrigatorio: v
          })} />
            <Label>SESMT Obrigatório</Label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Situação</Label>
            <Select value={data.sesmt_situacao || 'inexistente'} disabled={!data.sesmt_obrigatorio} onValueChange={v => onChange({
            sesmt_situacao: v as EmpresaCadastro['sesmt_situacao']
          })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="proprio">Próprio</SelectItem>
                <SelectItem value="terceirizado">Terceirizado</SelectItem>
                <SelectItem value="inexistente">Inexistente</SelectItem>
              </SelectContent>
            </Select>
            {!data.sesmt_obrigatorio && (
              <p className="text-xs text-muted-foreground">Habilite "SESMT Obrigatório" para definir a situação.</p>
            )}
          </div>
        </div>

        {data.sesmt_obrigatorio && data.sesmt_situacao === 'inexistente' && <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <span className="text-sm text-destructive font-medium">
              SESMT é obrigatório mas não está constituído — Alerta Crítico
            </span>
          </div>}
      </section>

      {/* CIPA */}
      <section className="space-y-4 border-t pt-6">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">CIPA (NR-05)</h3>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={data.cipa_obrigatoria || false} onCheckedChange={v => onChange({
            cipa_obrigatoria: v
          })} />
            <Label>CIPA Obrigatória</Label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Situação</Label>
            <Select value={data.cipa_situacao || 'nao_constituida'} onValueChange={v => onChange({
            cipa_situacao: v as EmpresaCadastro['cipa_situacao']
          })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nao_constituida">Não Constituída</SelectItem>
                <SelectItem value="em_implantacao">Em Implantação</SelectItem>
                <SelectItem value="ativa">Ativa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Início do Mandato</Label>
            <Input type="date" value={data.cipa_data_mandato_inicio || ''} onChange={e => onChange({
            cipa_data_mandato_inicio: e.target.value
          })} />
          </div>
          <div className="space-y-2">
            <Label>Fim do Mandato</Label>
            <Input type="date" value={data.cipa_data_mandato_fim || ''} onChange={e => onChange({
            cipa_data_mandato_fim: e.target.value
          })} />
          </div>
        </div>

        {data.cipa_obrigatoria && data.cipa_situacao === 'nao_constituida' && <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <span className="text-sm text-destructive font-medium">
              CIPA obrigatória não constituída — Ação necessária
            </span>
          </div>}
      </section>
    </div>;
}