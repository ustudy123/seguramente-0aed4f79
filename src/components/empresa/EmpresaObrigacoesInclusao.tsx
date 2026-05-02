import { useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, UserCheck, GraduationCap, Info } from 'lucide-react';
import type { EmpresaCadastro } from '@/types/empresa';

interface Props {
  data: Partial<EmpresaCadastro>;
  onChange: (updates: Partial<EmpresaCadastro>) => void;
}

export function EmpresaObrigacoesInclusao({ data, onChange }: Props) {
  const totalColab = data.total_colaboradores || 0;
  const pctPCD = data.pcd_percentual_exigido || 0;

  // Auto-cálculo Cota PCD: total_colaboradores * % / 100 (arredondado para cima)
  useEffect(() => {
    if (!data.pcd_obrigatoria) return;
    if (totalColab > 0 && pctPCD > 0) {
      const calculado = Math.ceil((totalColab * pctPCD) / 100);
      if (calculado !== (data.pcd_quantidade_exigida || 0)) {
        onChange({ pcd_quantidade_exigida: calculado });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalColab, pctPCD, data.pcd_obrigatoria]);

  // Auto-cálculo Jovem Aprendiz: 5% mínimo e 15% máximo sobre total de colaboradores
  useEffect(() => {
    if (totalColab > 0) {
      const minCalc = Math.ceil(totalColab * 0.05);
      const maxCalc = Math.ceil(totalColab * 0.15);
      const updates: Partial<EmpresaCadastro> = {};
      if (minCalc !== (data.aprendiz_quantidade_minima || 0)) updates.aprendiz_quantidade_minima = minCalc;
      if (maxCalc !== (data.aprendiz_quantidade_maxima || 0)) updates.aprendiz_quantidade_maxima = maxCalc;
      if (Object.keys(updates).length > 0) onChange(updates);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalColab]);

  const pcdPercentual = data.pcd_quantidade_exigida
    ? ((data.pcd_quantidade_atual || 0) / data.pcd_quantidade_exigida) * 100
    : 0;

  const aprendizPercentual = data.aprendiz_quantidade_minima
    ? ((data.aprendiz_quantidade_atual || 0) / data.aprendiz_quantidade_minima) * 100
    : 0;

  return (
    <div className="space-y-8">
      {/* Cota PCD */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Cota PCD (Lei 8.213/91)</h3>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={data.pcd_obrigatoria || false}
              onCheckedChange={(v) => onChange({ pcd_obrigatoria: v })}
            />
            <Label>Obrigatória</Label>
          </div>
          {data.pcd_obrigatoria && (
            <p className="text-xs text-muted-foreground">
              Empresas com 100+ empregados devem destinar 2% a 5% dos cargos para PCD
            </p>
          )}
        </div>

        {data.pcd_obrigatoria && (
          <>
            {totalColab === 0 && (
              <div className="flex items-center gap-2 p-3 bg-info/10 border border-info/30 rounded-lg">
                <Info className="w-4 h-4 text-info shrink-0" />
                <span className="text-xs">
                  Preencha <strong>Total de Colaboradores</strong> na aba <strong>Dados</strong> para o cálculo automático da cota.
                </span>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>% Exigido</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="2.00"
                  value={data.pcd_percentual_exigido || ''}
                  onChange={(e) => onChange({ pcd_percentual_exigido: parseFloat(e.target.value) || null })}
                />
              </div>
              <div className="space-y-2">
                <Label>Qtd. Exigida</Label>
                <Input
                  type="number"
                  value={data.pcd_quantidade_exigida || ''}
                  readOnly={totalColab > 0 && pctPCD > 0}
                  className={totalColab > 0 && pctPCD > 0 ? 'bg-muted cursor-not-allowed' : ''}
                  onChange={(e) => onChange({ pcd_quantidade_exigida: parseInt(e.target.value) || 0 })}
                />
                {totalColab > 0 && pctPCD > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    Calculado: {totalColab} × {pctPCD}% = {data.pcd_quantidade_exigida || 0}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Qtd. Atual</Label>
                <Input
                  type="number"
                  value={data.pcd_quantidade_atual || ''}
                  onChange={(e) => onChange({ pcd_quantidade_atual: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex flex-col justify-end gap-1">
                <Badge variant={pcdPercentual >= 100 ? 'default' : 'destructive'}>
                  {pcdPercentual >= 100 ? 'Conforme' : 'Déficit'}
                </Badge>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progresso</span>
                <span>{Math.round(pcdPercentual)}%</span>
              </div>
              <Progress value={Math.min(pcdPercentual, 100)} />
            </div>

            {pcdPercentual < 100 && (
              <div className="flex items-center gap-2 p-3 bg-warning/10 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <span className="text-sm font-medium">
                  Déficit de {(data.pcd_quantidade_exigida || 0) - (data.pcd_quantidade_atual || 0)} PCD(s)
                </span>
              </div>
            )}
          </>
        )}
      </section>

      {/* Jovem Aprendiz */}
      <section className="space-y-4 border-t pt-6">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Jovem Aprendiz (CLT Art. 429)</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Qtd. Mínima</Label>
            <Input
              type="number"
              value={data.aprendiz_quantidade_minima || ''}
              onChange={(e) => onChange({ aprendiz_quantidade_minima: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-2">
            <Label>Qtd. Máxima</Label>
            <Input
              type="number"
              value={data.aprendiz_quantidade_maxima || ''}
              onChange={(e) => onChange({ aprendiz_quantidade_maxima: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-2">
            <Label>Qtd. Atual</Label>
            <Input
              type="number"
              value={data.aprendiz_quantidade_atual || ''}
              onChange={(e) => onChange({ aprendiz_quantidade_atual: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className="flex flex-col justify-end gap-1">
            {(data.aprendiz_quantidade_minima || 0) > 0 && (
              <Badge variant={aprendizPercentual >= 100 ? 'default' : 'destructive'}>
                {aprendizPercentual >= 100 ? 'Conforme' : 'Abaixo da cota'}
              </Badge>
            )}
          </div>
        </div>

        {(data.aprendiz_quantidade_minima || 0) > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progresso</span>
              <span>{Math.round(aprendizPercentual)}%</span>
            </div>
            <Progress value={Math.min(aprendizPercentual, 100)} />
          </div>
        )}
      </section>
    </div>
  );
}
