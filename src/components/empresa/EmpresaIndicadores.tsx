import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingUp, FileWarning } from 'lucide-react';
import type { EmpresaCadastro } from '@/types/empresa';

interface Props {
  data: Partial<EmpresaCadastro>;
  onChange: (updates: Partial<EmpresaCadastro>) => void;
}

export function EmpresaIndicadores({ data, onChange }: Props) {
  const fapValor = data.fap_atual ?? 0;

  return (
    <div className="space-y-8">
      {/* FAP */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">FAP — Fator Acidentário de Prevenção</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>FAP Atual</Label>
            <Input
              type="number"
              step="0.0001"
              placeholder="Ex: 1.0000"
              value={data.fap_atual ?? ''}
              onChange={(e) => onChange({ fap_atual: parseFloat(e.target.value) || null })}
            />
          </div>
          <div className="space-y-2">
            <Label>Classificação</Label>
            <Input
              placeholder="Ex: Bônus / Malus"
              value={data.fap_classificacao || ''}
              onChange={(e) => onChange({ fap_classificacao: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            {fapValor > 0 && (
              <Badge
                variant={fapValor > 1.5 ? 'destructive' : fapValor > 1.0 ? 'secondary' : 'default'}
              >
                {fapValor > 1.5
                  ? 'FAP Elevado — Atenção'
                  : fapValor > 1.0
                  ? 'FAP Neutro'
                  : 'FAP Favorável'}
              </Badge>
            )}
          </div>
        </div>

        {fapValor > 1.5 && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <span className="text-sm text-destructive font-medium">
              FAP elevado indica alta acidentalidade — considere criar um plano de redução
            </span>
          </div>
        )}
      </section>

      {/* TAC */}
      <section className="space-y-4 border-t pt-6">
        <div className="flex items-center gap-2">
          <FileWarning className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">TAC — Termo de Ajustamento de Conduta</h3>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={data.tac_possui || false}
              onCheckedChange={(v) => onChange({ tac_possui: v })}
            />
            <Label>Possui TAC ativo?</Label>
          </div>
        </div>

        {data.tac_possui && (
          <div className="space-y-4 p-4 border rounded-lg bg-destructive/5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">
                TAC ativo — obrigações devem ser monitoradas com rigor
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Use a aba "Obrigações" para registrar as cláusulas do TAC e gerar ações de cumprimento.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
