import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, TrendingUp, FileWarning, Plus, Trash2 } from 'lucide-react';
import type { EmpresaCadastro, TacDetalhe } from '@/types/empresa';

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
              onChange={(e) => {
                const v = e.target.value;
                if (v === '') return onChange({ fap_atual: null });
                const n = parseFloat(v);
                onChange({ fap_atual: isNaN(n) ? null : n });
              }}
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

            <div className="space-y-3">
              {(data.tac_detalhes || []).length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  Nenhum TAC cadastrado. Clique em "Adicionar TAC" para incluir um identificador.
                </p>
              )}

              {(data.tac_detalhes || []).map((tac, idx) => {
                const list = data.tac_detalhes || [];
                const updateAt = (patch: Partial<TacDetalhe>) => {
                  const next = list.map((t, i) => (i === idx ? { ...t, ...patch } : t));
                  onChange({ tac_detalhes: next });
                };
                const removeAt = () => {
                  const next = list.filter((_, i) => i !== idx);
                  onChange({ tac_detalhes: next });
                };
                return (
                  <div key={idx} className="p-3 border rounded-md bg-background space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">TAC #{idx + 1}</Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={removeAt}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Nº / Identificador *</Label>
                        <Input
                          placeholder="Ex.: TAC 123/2024"
                          value={tac.numero || ''}
                          onChange={(e) => updateAt({ numero: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Órgão Emissor</Label>
                        <Input
                          placeholder="Ex.: MPT, MTE"
                          value={tac.orgao_emissor || ''}
                          onChange={(e) => updateAt({ orgao_emissor: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Data de Assinatura</Label>
                        <Input
                          type="date"
                          value={tac.data_assinatura || ''}
                          onChange={(e) => updateAt({ data_assinatura: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <Label className="text-xs">Obrigações / Cláusulas</Label>
                        <Textarea
                          placeholder="Resumo das obrigações..."
                          rows={2}
                          value={tac.obrigacoes || ''}
                          onChange={(e) => updateAt({ obrigacoes: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Prazo</Label>
                        <Input
                          placeholder="Ex.: 12 meses"
                          value={tac.prazo || ''}
                          onChange={(e) => updateAt({ prazo: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <Label className="text-xs">Penalidades em caso de descumprimento</Label>
                        <Input
                          placeholder="Ex.: Multa de R$ 50.000 por cláusula"
                          value={tac.penalidades || ''}
                          onChange={(e) => updateAt({ penalidades: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Status</Label>
                        <Input
                          placeholder="Ex.: Em cumprimento"
                          value={tac.status || ''}
                          onChange={(e) => updateAt({ status: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const novo: TacDetalhe = {
                    numero: '',
                    orgao_emissor: '',
                    data_assinatura: '',
                    obrigacoes: '',
                    prazo: '',
                    penalidades: '',
                    status: 'Em cumprimento',
                  };
                  onChange({ tac_detalhes: [...(data.tac_detalhes || []), novo] });
                }}
              >
                <Plus className="w-4 h-4 mr-1" />
                Adicionar TAC
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Use a aba "Obrigações" para registrar as cláusulas de cada TAC e gerar ações de cumprimento.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
