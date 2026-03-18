import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FileText, Thermometer, Volume2, Sun, Armchair, Users } from "lucide-react";
import type { AEPDescricaoAtividade } from "@/types/aep";

interface AEPFormDescricaoProps {
  data: AEPDescricaoAtividade;
  onChange: (data: AEPDescricaoAtividade) => void;
}

export function AEPFormDescricao({ data, onChange }: AEPFormDescricaoProps) {
  const handleChange = (field: keyof AEPDescricaoAtividade, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-4">
      {/* 4. Descrição do Trabalho Real */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">4. Descrição do Trabalho Real</CardTitle>
            <Badge variant="outline" className="text-[10px] font-mono">NR-17 §17.1</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Descreva o trabalho <strong>real</strong> (o que o trabalhador efetivamente faz), não apenas o prescrito.
            O Manual de Aplicação NR-17 (MTE, 2002) orienta auditores a verificar o descompasso entre tarefa prescrita e real.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* 4.1 Tarefa e Atividade Real */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm flex items-center gap-2">
              4.1 Tarefa e Atividade Real
              <span className="text-xs text-muted-foreground font-normal">(auditores verificam descompasso tarefa prescrita vs. real)</span>
            </h4>
            <div className="space-y-2">
              <Label htmlFor="descricaoGeral">Descrição geral da atividade *</Label>
              <Textarea
                id="descricaoGeral"
                value={data.descricaoGeral}
                onChange={(e) => handleChange('descricaoGeral', e.target.value)}
                placeholder="Descreva como a atividade é realmente executada, incluindo dificuldades, incidentes comuns e regulações que o trabalhador faz..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sequenciaTarefas">Sequência de tarefas (trabalho real)</Label>
                <Textarea
                  id="sequenciaTarefas"
                  value={data.sequenciaTarefas}
                  onChange={(e) => handleChange('sequenciaTarefas', e.target.value)}
                  placeholder="Passo a passo do que o trabalhador faz na prática..."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="posturasAdotadas">Posturas adotadas (principais e prolongadas)</Label>
                <Textarea
                  id="posturasAdotadas"
                  value={data.posturasAdotadas}
                  onChange={(e) => handleChange('posturasAdotadas', e.target.value)}
                  placeholder="Sentado / em pé / inclinado / alternância... quanto tempo em cada postura?"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ferramentasUtilizadas">Ferramentas, máquinas e equipamentos</Label>
                <Input
                  id="ferramentasUtilizadas"
                  value={data.ferramentasUtilizadas}
                  onChange={(e) => handleChange('ferramentasUtilizadas', e.target.value)}
                  placeholder="Computador, painel de controle, ferramentas manuais..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ritmoRepetitividade">Ritmo e cadência (imposto ou livre?)</Label>
                <Input
                  id="ritmoRepetitividade"
                  value={data.ritmoRepetitividade}
                  onChange={(e) => handleChange('ritmoRepetitividade', e.target.value)}
                  placeholder="Ritmo imposto por máquina / cliente / meta? Ou trabalhador controla?"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="variabilidadeTarefa">Variabilidade e imprevistos frequentes</Label>
                <Input
                  id="variabilidadeTarefa"
                  value={data.variabilidadeTarefa}
                  onChange={(e) => handleChange('variabilidadeTarefa', e.target.value)}
                  placeholder="Interrupções, falhas de equipamento, demandas inesperadas..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="participacaoTrabalhadores">Trabalhadores consultados / participaram</Label>
                <Input
                  id="participacaoTrabalhadores"
                  value={data.participacaoTrabalhadores || ''}
                  onChange={(e) => handleChange('participacaoTrabalhadores', e.target.value)}
                  placeholder="Nomes, forma de participação (entrevista, observação, validação...)"
                />
              </div>
            </div>
          </div>

          {/* 4.2 Condições Ambientais — NR-17 §17.5 */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-destructive" />
              4.2 Condições Ambientais de Trabalho
              <Badge variant="outline" className="text-[10px] font-mono">NR-17 §17.5</Badge>
            </h4>
            <p className="text-xs text-muted-foreground">
              Para atividades com atenção constante: ruído ≤ 65 dB(A), temperatura efetiva 20–23°C,
              velocidade do ar ≤ 0,75 m/s, umidade relativa ≥ 40% (NBR 10.152, NBR 5413).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="espacoFisico">Espaço físico / layout do posto</Label>
                <Input
                  id="espacoFisico"
                  value={data.espacoFisico}
                  onChange={(e) => handleChange('espacoFisico', e.target.value)}
                  placeholder="Adequado / Restrito / Com obstáculos"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="iluminacao" className="flex items-center gap-1">
                  <Sun className="h-3 w-3 text-warning" />
                  Iluminação (ofuscamento, reflexos)
                </Label>
                <Input
                  id="iluminacao"
                  value={data.iluminacao}
                  onChange={(e) => handleChange('iluminacao', e.target.value)}
                  placeholder="Adequada / Ofuscamento / Reflexo na tela / Lux"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="temperatura" className="flex items-center gap-1">
                  <Thermometer className="h-3 w-3 text-destructive" />
                  Temperatura efetiva (alvo: 20–23°C)
                </Label>
                <Input
                  id="temperatura"
                  value={data.temperatura}
                  onChange={(e) => handleChange('temperatura', e.target.value)}
                  placeholder="Medição: __°C / Confortável / Quente / Frio"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ruido" className="flex items-center gap-1">
                  <Volume2 className="h-3 w-3 text-primary" />
                  Ruído (alvo: ≤ 65 dB(A) para conforto)
                </Label>
                <Input
                  id="ruido"
                  value={data.ruido}
                  onChange={(e) => handleChange('ruido', e.target.value)}
                  placeholder="Medição: __ dB(A) / Fonte principal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="umidadeVelocidadeAr">Umidade / velocidade do ar</Label>
                <Input
                  id="umidadeVelocidadeAr"
                  value={data.umidadeVelocidadeAr || ''}
                  onChange={(e) => handleChange('umidadeVelocidadeAr', e.target.value)}
                  placeholder="Umidade: _% (≥40%) / Ar: __ m/s (≤0,75)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="organizacaoPosto" className="flex items-center gap-1">
                  <Armchair className="h-3 w-3 text-secondary-foreground" />
                  Mobiliário / organização do posto
                </Label>
                <Input
                  id="organizacaoPosto"
                  value={data.organizacaoPosto}
                  onChange={(e) => handleChange('organizacaoPosto', e.target.value)}
                  placeholder="Cadeira regulável? Mesa ajustável? Alcance dos itens?"
                />
              </div>
            </div>
          </div>

          {/* 4.3 Organização do Trabalho — NR-17 §17.6 */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              4.3 Organização do Trabalho
              <Badge variant="outline" className="text-[10px] font-mono">NR-17 §17.6</Badge>
            </h4>
            <p className="text-xs text-muted-foreground">
              Item mais verificado pelos auditores. Inclui normas de produção, ritmo, pausas, prêmios de produtividade,
              jornada e conteúdo do trabalho. Para entrada eletrônica de dados: máx. 8.000 toques/hora.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="normasProducao">Normas de produção / cotas / metas</Label>
                <Input
                  id="normasProducao"
                  value={data.normasProducao || ''}
                  onChange={(e) => handleChange('normasProducao', e.target.value)}
                  placeholder="Há cotas de produção? Prêmios por produtividade?"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pausasDescanso">Pausas e intervalos de recuperação</Label>
                <Input
                  id="pausasDescanso"
                  value={data.pausasDescanso || ''}
                  onChange={(e) => handleChange('pausasDescanso', e.target.value)}
                  placeholder="Frequência, duração, fora do posto? (NR-17: 10min/50min para dados)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jornadaHorasExtras">Jornada e horas extras</Label>
                <Input
                  id="jornadaHorasExtras"
                  value={data.jornadaHorasExtras || ''}
                  onChange={(e) => handleChange('jornadaHorasExtras', e.target.value)}
                  placeholder="Turno, horas extras habituais, dupla jornada?"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modoOperatorio">Autonomia / modo operatório</Label>
                <Input
                  id="modoOperatorio"
                  value={data.modoOperatorio || ''}
                  onChange={(e) => handleChange('modoOperatorio', e.target.value)}
                  placeholder="Trabalhador pode escolher como executar? Ou é totalmente prescrito?"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="indicadoresSaude">Indicadores de saúde do grupo (absenteísmo, LER/DORT, queixas)</Label>
                <Input
                  id="indicadoresSaude"
                  value={data.indicadoresSaude || ''}
                  onChange={(e) => handleChange('indicadoresSaude', e.target.value)}
                  placeholder="Alto absenteísmo e rotatividade são indicadores indiretos de sobrecarga (Manual NR-17 §17.1)"
                />
              </div>
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
