import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { BarChart3, Plus, X, AlertTriangle, CheckCircle2, ClipboardList } from "lucide-react";
import type { AEPSinteseAvaliacao, ClassificacaoRisco, NecessidadeAET } from "@/types/aep";
import { CLASSIFICACAO_RISCO_LABELS } from "@/types/aep";
import { cn } from "@/lib/utils";

interface AEPFormSinteseProps {
  data: AEPSinteseAvaliacao;
  onChange: (data: AEPSinteseAvaliacao) => void;
}

const CLASSIFICACAO_COLORS: Record<ClassificacaoRisco, string> = {
  baixo: 'bg-success/10 text-success border-success/30',
  medio: 'bg-warning/10 text-warning border-warning/30',
  alto: 'bg-destructive/10 text-destructive border-destructive/30',
};

// Checklist de conformidade NR-17 baseado no Manual de Aplicação (MTE/2002)
// Itens 17.2 a 17.6 que auditores fiscais verificam obrigatoriamente
const CHECKLIST_NR17 = [
  {
    id: 'levantamento_cargas',
    item: '17.2',
    texto: 'Levantamento/transporte de cargas não compromete saúde ou segurança',
    tooltip: 'Verificar se há uso de auxílio mecânico, registros de lombalgia, distância e frequência do esforço (NIOSH)'
  },
  {
    id: 'mobiliario_regulavel',
    item: '17.3',
    texto: 'Mobiliário possui regulagens para diferentes características antropométricas',
    tooltip: 'Altura do assento 37–47cm, apoio lombar, área de fácil alcance visual e manual, alternância de postura possível'
  },
  {
    id: 'assento_adequado',
    item: '17.3.2',
    texto: 'Assento permite alternância de postura e não é "anatômico" fixador de posição',
    tooltip: 'Profundidade adequada, inclinação ~5° para trás, suporte lombar, sem compressão poplítea'
  },
  {
    id: 'equipamentos_adequados',
    item: '17.4',
    texto: 'Equipamentos são adequados às características psicofisiológicas e à natureza da tarefa',
    tooltip: 'Posicionamento de painéis/comandos na zona de alcance, sem abdução excessiva de membros superiores'
  },
  {
    id: 'ruido_conforto',
    item: '17.5.2a',
    texto: 'Nível de ruído ≤ 65 dB(A) / NC ≤ 60 dB (atividades com atenção constante)',
    tooltip: 'NBR 10.152 — Não se confunde com insalubridade (NR-15). Foco no conforto e desempenho cognitivo'
  },
  {
    id: 'temperatura_conforto',
    item: '17.5.2b-d',
    texto: 'Temperatura efetiva 20–23°C, velocidade ar ≤ 0,75 m/s, umidade relativa ≥ 40%',
    tooltip: 'Medição no tórax do trabalhador. Sistema de ar-condicionado com manutenção conforme ANVISA RE 176/2000'
  },
  {
    id: 'iluminacao',
    item: '17.5.3',
    texto: 'Iluminação sem ofuscamento, reflexos, sombras ou contraste excessivo (NBR 5413)',
    tooltip: 'Evitar reflexos na tela. Janelas fora do campo visual direto. Sem cintilamento ou lâmpadas queimadas'
  },
  {
    id: 'ritmo_imposto',
    item: '17.6.2a',
    texto: 'Ritmo de trabalho não é imposto por máquina/esteira de forma que impeça regulação pelo trabalhador',
    tooltip: 'Prêmios de produtividade, cotas e cadências fixas são fatores de risco. Trabalhador deve poder regular seu ritmo biológico'
  },
  {
    id: 'pausas_previstas',
    item: '17.6.3',
    texto: 'Pausas de recuperação estão previstas na jornada (mínimo 10 min a cada 50 min em trabalho com dados)',
    tooltip: 'Para entrada de dados: máx 8.000 toques/hora, pausas fora do posto, mínimo 10 min a cada 50 min contínuos'
  },
  {
    id: 'trabalhadores_consultados',
    item: '17.1 / 17.6.1',
    texto: 'Trabalhadores foram consultados e participaram da avaliação das condições de trabalho',
    tooltip: 'NR-17 exige participação dos trabalhadores tanto no diagnóstico quanto na validação das soluções propostas'
  },
  {
    id: 'tarefa_real_descrita',
    item: '17.1',
    texto: 'Análise descreve o trabalho REAL (não apenas o prescrito), incluindo dificuldades enfrentadas',
    tooltip: 'Auditores verificam se a AEP reflete o que o trabalhador realmente faz, não apenas o que está no POP/procedimento'
  },
  {
    id: 'acoes_cronograma',
    item: 'Manual §9-10',
    texto: 'Recomendações incluem medidas concretas de melhoria com cronograma de implementação',
    tooltip: 'Diagnóstico sem proposta de modificação é inválido para fiscalização. Auditores exigem projeto de modificações + prazos'
  },
];

export function AEPFormSintese({ data, onChange }: AEPFormSinteseProps) {
  const [novoPontoCritico, setNovoPontoCritico] = useState('');

  const handleAddPontoCritico = () => {
    if (novoPontoCritico.trim()) {
      onChange({
        ...data,
        pontosCriticos: [...data.pontosCriticos, novoPontoCritico.trim()],
      });
      setNovoPontoCritico('');
    }
  };

  const handleRemovePontoCritico = (index: number) => {
    onChange({
      ...data,
      pontosCriticos: data.pontosCriticos.filter((_, i) => i !== index),
    });
  };

  const handleChecklistToggle = (itemId: string, checked: boolean) => {
    const atual = data.checklistNR17 || {};
    onChange({ ...data, checklistNR17: { ...atual, [itemId]: checked } });
  };

  const checklistNR17 = data.checklistNR17 || {};
  const totalChecked = CHECKLIST_NR17.filter(i => checklistNR17[i.id]).length;
  const totalItems = CHECKLIST_NR17.length;
  const pctConformidade = Math.round((totalChecked / totalItems) * 100);

  return (
    <div className="space-y-4">
      {/* 6. Síntese da Avaliação de Risco */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-primary" />
            6. Síntese da Avaliação de Risco
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 6.1 Classificação Geral */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm">6.1 Classificação Geral do Risco Ergonômico</h4>
            <RadioGroup
              value={data.classificacaoGeral}
              onValueChange={(value) => onChange({ ...data, classificacaoGeral: value as ClassificacaoRisco })}
              className="flex flex-col gap-3"
            >
              {(Object.entries(CLASSIFICACAO_RISCO_LABELS) as [ClassificacaoRisco, string][]).map(([key, label]) => (
                <div key={key} className="flex items-center space-x-3">
                  <RadioGroupItem value={key} id={`classificacao-${key}`} />
                  <Label
                    htmlFor={`classificacao-${key}`}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer",
                      data.classificacaoGeral === key && CLASSIFICACAO_COLORS[key]
                    )}
                  >
                    <span className={cn(
                      "w-3 h-3 rounded-full",
                      key === 'baixo' && "bg-success",
                      key === 'medio' && "bg-warning",
                      key === 'alto' && "bg-destructive"
                    )} />
                    {label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* 6.2 Pontos Críticos */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm">6.2 Pontos Críticos Identificados</h4>
            <div className="flex gap-2">
              <Input
                value={novoPontoCritico}
                onChange={(e) => setNovoPontoCritico(e.target.value)}
                placeholder="Adicionar ponto crítico..."
                onKeyDown={(e) => e.key === 'Enter' && handleAddPontoCritico()}
              />
              <Button type="button" onClick={handleAddPontoCritico} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {data.pontosCriticos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {data.pontosCriticos.map((ponto, index) => (
                  <Badge key={index} variant="outline" className="gap-1 pr-1">
                    {ponto}
                    <button
                      type="button"
                      onClick={() => handleRemovePontoCritico(index)}
                      className="ml-1 hover:bg-muted rounded p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 7. Checklist NR-17 — itens verificados pelo Auditor Fiscal */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardList className="h-5 w-5 text-primary" />
              7. Checklist de Conformidade NR-17
            </CardTitle>
            <div className="text-right shrink-0">
              <div className={cn(
                "text-lg font-bold",
                pctConformidade >= 80 ? "text-success" : pctConformidade >= 50 ? "text-warning" : "text-destructive"
              )}>
                {pctConformidade}%
              </div>
              <div className="text-xs text-muted-foreground">{totalChecked}/{totalItems} itens</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Itens verificados pelos auditores fiscais do trabalho segundo o Manual de Aplicação da NR-17 (MTE, 2002).
            Marque os itens que estão em conformidade na situação avaliada.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {CHECKLIST_NR17.map((item) => {
            const checked = !!checklistNR17[item.id];
            return (
              <div
                key={item.id}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-md border transition-colors",
                  checked ? "bg-success/5 border-success/30" : "bg-muted/30 border-border/50"
                )}
              >
                <Checkbox
                  id={`nr17-${item.id}`}
                  checked={checked}
                  onCheckedChange={(val) => handleChecklistToggle(item.id, !!val)}
                  className="mt-0.5 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <Label
                    htmlFor={`nr17-${item.id}`}
                    className="cursor-pointer flex items-start gap-2 flex-wrap"
                  >
                    <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0 font-mono">
                      {item.item}
                    </Badge>
                    <span className={cn("text-sm", checked && "text-success font-medium")}>
                      {item.texto}
                    </span>
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">{item.tooltip}</p>
                </div>
                {checked && <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />}
              </div>
            );
          })}

          {pctConformidade < 80 && (
            <div className="flex items-start gap-2 p-3 rounded-md border border-warning/40 bg-warning/5 mt-3">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <p className="text-xs text-warning">
                <strong>Conformidade abaixo de 80%.</strong> Itens não marcados representam potenciais não conformidades
                auditáveis. Registre as ações corretivas no Plano de Ação vinculado a esta AEP.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 8. Necessidade de AET */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-warning" />
            8. Necessidade de AET
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Com base na análise preliminar e no checklist NR-17:
          </p>
          <RadioGroup
            value={data.necessidadeAET}
            onValueChange={(value) => onChange({ ...data, necessidadeAET: value as NecessidadeAET })}
            className="flex flex-col gap-3"
          >
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="nao_indicado" id="aet-nao" />
              <Label htmlFor="aet-nao" className="cursor-pointer">
                Não há indicativo de necessidade de AET no momento
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="indicado" id="aet-sim" />
              <Label htmlFor="aet-sim" className="cursor-pointer">
                Há indicativo de necessidade de AET para aprofundamento
              </Label>
            </div>
          </RadioGroup>

          <div className="space-y-2">
            <Label htmlFor="justificativaAET">Justificativa</Label>
            <Textarea
              id="justificativaAET"
              value={data.justificativaAET}
              onChange={(e) => onChange({ ...data, justificativaAET: e.target.value })}
              placeholder="Descreva objetivamente a justificativa para a decisão acima..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
