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

  // Auto-cálculo Cota PCD: Percentual e Quantidade conforme Lei 8.213/91
  useEffect(() => {
    const updates: Partial<EmpresaCadastro> = {};
    
    // Se tem 100 ou mais colaboradores, a cota é obrigatória por lei
    if (totalColab >= 100 && !data.pcd_obrigatoria) {
      updates.pcd_obrigatoria = true;
    }

    if (data.pcd_obrigatoria || updates.pcd_obrigatoria) {
      // Determina percentual automático baseado na faixa de colaboradores
      let autoPct = data.pcd_percentual_exigido || 0;
      
      if (totalColab >= 100 && totalColab <= 200) autoPct = 2;
      else if (totalColab >= 201 && totalColab <= 500) autoPct = 3;
      else if (totalColab >= 501 && totalColab <= 1000) autoPct = 4;
      else if (totalColab > 1000) autoPct = 5;
      else if (totalColab < 100 && !data.pcd_percentual_exigido) autoPct = 2; // Default mínimo se marcado como obrigatório mas < 100

      if (autoPct !== data.pcd_percentual_exigido) {
        updates.pcd_percentual_exigido = autoPct;
      }

      const finalPct = updates.pcd_percentual_exigido !== undefined ? updates.pcd_percentual_exigido : (data.pcd_percentual_exigido || 0);
      
      if (totalColab > 0 && finalPct > 0) {
        const calculado = Math.ceil((totalColab * finalPct) / 100);
        if (calculado !== (data.pcd_quantidade_exigida || 0)) {
          updates.pcd_quantidade_exigida = calculado;
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      onChange(updates);
    }
  }, [totalColab, data.pcd_obrigatoria, data.pcd_percentual_exigido, data.pcd_quantidade_exigida, onChange]);

  // Removido auto-cálculo Jovem Aprendiz conforme solicitado pelo usuário.
  // A regra de Jovem Aprendiz é complexa e deve ser informada manualmente.
  /*
  useEffect(() => {
    if (totalColab > 0) {
      const minCalc = Math.ceil(totalColab * 0.05);
      const maxCalc = Math.ceil(totalColab * 0.15);
      const updates: Partial<EmpresaCadastro> = {};
      if (minCalc !== (data.aprendiz_quantidade_minima || 0)) updates.aprendiz_quantidade_minima = minCalc;
      if (maxCalc !== (data.aprendiz_quantidade_maxima || 0)) updates.aprendiz_quantidade_maxima = maxCalc;
      if (Object.keys(updates).length > 0) onChange(updates);
    }
  }, [totalColab]);
  */

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
                  readOnly={totalColab >= 100}
                  className={totalColab >= 100 ? 'bg-muted cursor-not-allowed' : ''}
                  onChange={(e) => onChange({ pcd_percentual_exigido: parseFloat(e.target.value) || null })}
                />
                {totalColab >= 100 && (
                  <p className="text-[10px] text-primary font-medium">
                    % Automático (Lei 8.213/91)
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Qtd. Exigida</Label>
                <Input
                  type="number"
                  value={data.pcd_quantidade_exigida || ''}
                  readOnly={totalColab > 0}
                  className={totalColab > 0 ? 'bg-muted cursor-not-allowed' : ''}
                  onChange={(e) => onChange({ pcd_quantidade_exigida: parseInt(e.target.value) || 0 })}
                />
                {totalColab > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    Calculado: {totalColab} × {data.pcd_percentual_exigido || 0}% = {data.pcd_quantidade_exigida || 0}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Qtd. Atual</Label>
                <Input
                  type="number"
                  min={0}
                  value={data.pcd_quantidade_atual ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    onChange({ pcd_quantidade_atual: v === '' ? 0 : (parseInt(v) || 0) });
                  }}
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

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={data.aprendiz_obrigatorio || false}
              onCheckedChange={(v) => onChange({ aprendiz_obrigatorio: v })}
            />
            <Label>Obrigatória</Label>
          </div>
          {data.aprendiz_obrigatorio && (
            <p className="text-xs text-muted-foreground">
              Empresas com 7+ empregados devem contratar aprendizes (5% a 15% das funções que exijam formação profissional)
            </p>
          )}
        </div>

        {data.aprendiz_obrigatorio && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Qtd. Mínima</Label>
                <Input
                  type="number"
                  min={0}
                  value={data.aprendiz_quantidade_minima ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    onChange({ aprendiz_quantidade_minima: v === '' ? 0 : (parseInt(v) || 0) });
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Qtd. Máxima</Label>
                <Input
                  type="number"
                  min={0}
                  value={data.aprendiz_quantidade_maxima ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    onChange({ aprendiz_quantidade_maxima: v === '' ? 0 : (parseInt(v) || 0) });
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Qtd. Atual</Label>
                <Input
                  type="number"
                  min={0}
                  value={data.aprendiz_quantidade_atual ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    onChange({ aprendiz_quantidade_atual: v === '' ? 0 : (parseInt(v) || 0) });
                  }}
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
          </>
        )}
      </section>
    </div>
  );
}
