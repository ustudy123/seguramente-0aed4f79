import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Clock, HardHat, AlertTriangle } from 'lucide-react';
import type { EmpresaCadastro } from '@/types/empresa';

interface Props {
  data: Partial<EmpresaCadastro>;
  onChange: (updates: Partial<EmpresaCadastro>) => void;
}

const CONDICOES_ESPECIAIS = [
  { key: 'trabalho_altura' as const, label: 'Trabalho em Altura', nr: 'NR-35', icon: '🏗️' },
  { key: 'espaco_confinado' as const, label: 'Espaço Confinado', nr: 'NR-33', icon: '⚠️' },
  { key: 'insalubridade' as const, label: 'Insalubridade', nr: 'NR-15', icon: '☢️' },
  { key: 'periculosidade' as const, label: 'Periculosidade', nr: 'NR-16', icon: '⚡' },
  { key: 'aposentadoria_especial' as const, label: 'Aposentadoria Especial', nr: 'Lei 8.213/91', icon: '📋' },
];

export function EmpresaJornadaCondicoes({ data, onChange }: Props) {
  const condicoesAtivas = CONDICOES_ESPECIAIS.filter((c) => data[c.key]);

  return (
    <div className="space-y-8">
      {/* Jornada e Turnos */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Jornada e Turnos</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Jornada Padrão</Label>
            <Input
              placeholder="Ex: 44h semanais, 8h diárias"
              value={data.jornada_padrao || ''}
              onChange={(e) => onChange({ jornada_padrao: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={data.possui_terceiro_turno || false}
              onCheckedChange={(v) => onChange({ possui_terceiro_turno: v })}
            />
            <Label>Possui 3º Turno (Noturno)</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={data.possui_escalas_especiais || false}
              onCheckedChange={(v) => onChange({ possui_escalas_especiais: v })}
            />
            <Label>Escalas Especiais</Label>
          </div>
        </div>

        {data.possui_terceiro_turno && (
          <div className="flex items-center gap-2 p-3 bg-warning/10 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <span className="text-sm font-medium">
              3º turno requer avaliações específicas de saúde e ergonomia (NR-17)
            </span>
          </div>
        )}
      </section>

      {/* Condições Especiais */}
      <section className="space-y-4 border-t pt-6">
        <div className="flex items-center gap-2">
          <HardHat className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Condições Especiais de Trabalho</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CONDICOES_ESPECIAIS.map((condicao) => (
            <div
              key={condicao.key}
              className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                data[condicao.key]
                  ? 'bg-warning/5 border-warning/30'
                  : 'bg-card border-border'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{condicao.icon}</span>
                <div>
                  <span className="text-sm font-medium">{condicao.label}</span>
                  <p className="text-xs text-muted-foreground">{condicao.nr}</p>
                </div>
              </div>
              <Switch
                checked={data[condicao.key] || false}
                onCheckedChange={(v) => onChange({ [condicao.key]: v })}
              />
            </div>
          ))}
        </div>

        {condicoesAtivas.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg">
            <span className="text-xs text-muted-foreground w-full mb-1">
              Condições ativas — podem gerar obrigações de treinamento e laudos:
            </span>
            {condicoesAtivas.map((c) => (
              <Badge key={c.key} variant="secondary" className="text-xs">
                {c.icon} {c.label}
              </Badge>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
