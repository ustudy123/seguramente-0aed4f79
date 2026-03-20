import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, TrendingDown, TrendingUp, Calculator, DollarSign, AlertTriangle } from "lucide-react";
import type { EventoSST } from "@/types/eventoSST";

interface Props {
  eventos: EventoSST[];
}

const InfoTooltip = ({ text }: { text: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help inline-block ml-1" />
    </TooltipTrigger>
    <TooltipContent className="max-w-xs text-xs">{text}</TooltipContent>
  </Tooltip>
);

export const SimuladorFAP = ({ eventos }: Props) => {
  const [totalFolha, setTotalFolha] = useState(500000);
  const [ratBase, setRatBase] = useState(3);
  const [reducaoAfastamentos, setReducaoAfastamentos] = useState(0);
  const [eliminacaoGraves, setEliminacaoGraves] = useState(false);

  const acidentes = eventos.filter(e => e.tipo === "acidente");
  const acidentesComAfastamento = acidentes.filter(e => e.afastamento && e.afastamento !== "sem_afastamento");
  const acidentesGraves = acidentes.filter(e => e.gravidade_lesao === "grave" || e.obito);
  const incidentes = eventos.filter(e => e.tipo === "incidente");

  // Simulação simplificada do FAP (índice entre 0.5 e 2.0)
  // Fórmula aproximada baseada nos componentes do NTEP
  const calcularFAP = (afastamentosCount: number, gravesCount: number, obitusCount: number) => {
    // Componentes: Frequência (40%), Gravidade (40%), Custo (20%)
    const freqScore = Math.min(afastamentosCount / Math.max(acidentes.length, 1), 1);
    const gravScore = Math.min(gravesCount / Math.max(acidentes.length, 1) * 2, 1);
    const obitScore = obitusCount * 0.5;

    const rawFAP = 0.5 + (freqScore * 0.4 + gravScore * 0.4 + obitScore * 0.2) * 1.5;
    return Math.min(Math.max(rawFAP, 0.5), 2.0);
  };

  const obitusCount = acidentes.filter(e => e.obito).length;
  const afastSim = Math.max(0, acidentesComAfastamento.length - Math.round(acidentesComAfastamento.length * reducaoAfastamentos / 100));
  const gravesSim = eliminacaoGraves ? 0 : acidentesGraves.length;

  const fapAtual = calcularFAP(acidentesComAfastamento.length, acidentesGraves.length, obitusCount);
  const fapSimulado = calcularFAP(afastSim, gravesSim, eliminacaoGraves ? 0 : obitusCount);

  const contributionAtual = totalFolha * 12 * (ratBase / 100) * fapAtual;
  const contributionSim = totalFolha * 12 * (ratBase / 100) * fapSimulado;
  const economia = contributionAtual - contributionSim;

  const getFapStatus = (fap: number) => {
    if (fap < 0.8) return { label: "Bônus Máximo", color: "text-green-600", bg: "bg-green-50 border-green-200", icon: TrendingDown };
    if (fap < 1.0) return { label: "Bônus FAP", color: "text-green-500", bg: "bg-green-50/50 border-green-100", icon: TrendingDown };
    if (fap === 1.0) return { label: "Neutro", color: "text-muted-foreground", bg: "bg-muted/30 border-border", icon: TrendingDown };
    if (fap < 1.5) return { label: "Malus FAP", color: "text-orange-600", bg: "bg-orange-50 border-orange-200", icon: TrendingUp };
    return { label: "Malus Máximo", color: "text-destructive", bg: "bg-red-50 border-red-200", icon: AlertTriangle };
  };

  const statusAtual = getFapStatus(fapAtual);
  const statusSim = getFapStatus(fapSimulado);
  const StatusIconAtual = statusAtual.icon;
  const StatusIconSim = statusSim.icon;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Calculator className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-base">Simulador de FAP e Impacto Previdenciário</h3>
        <Badge variant="outline" className="text-xs">Lei 10.666/03 · Decreto 3.048/99</Badge>
      </div>

      <Card className="bg-muted/30">
        <CardContent className="pt-4 pb-3 px-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            O <strong>FAP (Fator Acidentário de Prevenção)</strong> é calculado anualmente pelo INSS e ajusta a alíquota do RAT entre 0,5 e 2,0×.
            Empresas com bom histórico pagam <span className="text-green-600 font-medium">menos</span>; com muitos acidentes, pagam <span className="text-destructive font-medium">mais</span>.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">
                Folha de Pagamento Mensal (R$)
                <InfoTooltip text="Base de cálculo para a contribuição RAT/FAP" />
              </Label>
              <Input
                type="number"
                value={totalFolha}
                onChange={e => setTotalFolha(Number(e.target.value))}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                RAT Base (%)
                <InfoTooltip text="Alíquota RAT conforme CNAE: GR1=1%, GR2=2%, GR3=3%, GR4/5=4%" />
              </Label>
              <Input
                type="number"
                value={ratBase}
                min={1}
                max={6}
                step={0.5}
                onChange={e => setRatBase(Number(e.target.value))}
                className="text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Situação atual */}
      <div className="grid grid-cols-2 gap-3">
        <Card className={`border ${statusAtual.bg}`}>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <StatusIconAtual className={`w-4 h-4 ${statusAtual.color}`} />
              <span className="text-xs font-medium text-muted-foreground">Situação Atual</span>
            </div>
            <p className={`text-4xl font-bold tabular-nums ${statusAtual.color}`}>{fapAtual.toFixed(2)}</p>
            <Badge variant="outline" className={`mt-1 text-xs ${statusAtual.color}`}>{statusAtual.label}</Badge>
            <div className="mt-2 pt-2 border-t">
              <p className="text-xs text-muted-foreground">Contribuição anual estimada</p>
              <p className="text-lg font-bold tabular-nums">
                R$ {contributionAtual.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className={`border ${statusSim.bg}`}>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <StatusIconSim className={`w-4 h-4 ${statusSim.color}`} />
              <span className="text-xs font-medium text-muted-foreground">Cenário Simulado</span>
            </div>
            <p className={`text-4xl font-bold tabular-nums ${statusSim.color}`}>{fapSimulado.toFixed(2)}</p>
            <Badge variant="outline" className={`mt-1 text-xs ${statusSim.color}`}>{statusSim.label}</Badge>
            <div className="mt-2 pt-2 border-t">
              <p className="text-xs text-muted-foreground">Contribuição anual estimada</p>
              <p className="text-lg font-bold tabular-nums">
                R$ {contributionSim.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {economia > 0 && (
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
          <CardContent className="pt-3 pb-3 px-4 flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-700">Economia Projetada</p>
              <p className="text-2xl font-bold text-green-600 tabular-nums">
                R$ {economia.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/ano
              </p>
              <p className="text-xs text-green-600/80 mt-0.5">
                Redução de {((1 - fapSimulado / fapAtual) * 100).toFixed(1)}% no FAP
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cenários de simulação */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm">Simular Cenários de Melhoria</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">
                Reduzir afastamentos em <span className="font-bold text-primary">{reducaoAfastamentos}%</span>
              </Label>
              <span className="text-xs text-muted-foreground">
                {acidentesComAfastamento.length} → {afastSim} afastamentos
              </span>
            </div>
            <Slider
              value={[reducaoAfastamentos]}
              onValueChange={([v]) => setReducaoAfastamentos(v)}
              min={0}
              max={100}
              step={10}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
            </div>
          </div>

          <div
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
              eliminacaoGraves ? "border-green-400 bg-green-50 dark:bg-green-950/30" : "border-border hover:border-muted-foreground/30"
            }`}
            onClick={() => setEliminacaoGraves(!eliminacaoGraves)}
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              eliminacaoGraves ? "bg-green-500 border-green-500" : "border-muted-foreground/40"
            }`}>
              {eliminacaoGraves && <span className="text-white text-xs">✓</span>}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Eliminar acidentes graves e óbitos</p>
              <p className="text-xs text-muted-foreground">
                {acidentesGraves.length} acidente{acidentesGraves.length !== 1 ? "s" : ""} grave{acidentesGraves.length !== 1 ? "s" : ""} + {obitusCount} óbito{obitusCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alertas legais */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-1 pt-3 px-4">
          <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Riscos Previdenciários Identificados</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-2">
          {eventos.filter(e => e.tipo === "acidente" && !e.cat_emitida).length > 0 && (
            <div className="flex items-start gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <span>
                <strong>{eventos.filter(e => e.tipo === "acidente" && !e.cat_emitida).length} acidente(s)</strong> sem CAT emitida — risco de NTEP retroativo e autuação fiscal.
              </span>
            </div>
          )}
          {acidentesComAfastamento.filter(e => e.afastamento === "mais_15_dias").length > 0 && (
            <div className="flex items-start gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
              <span>
                <strong>{acidentesComAfastamento.filter(e => e.afastamento === "mais_15_dias").length} acidente(s)</strong> com afastamento &gt;15 dias — geração de benefício B91 e estabilidade de 12 meses após alta.
              </span>
            </div>
          )}
          {obitusCount > 0 && (
            <div className="flex items-start gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <span>
                <strong>{obitusCount} óbito(s) registrado(s)</strong> — impacto máximo no FAP + obrigatoriedade de CAT comunicação de óbito (prazo: 1 dia útil).
              </span>
            </div>
          )}
          {acidentesComAfastamento.length === 0 && obitusCount === 0 && (
            <p className="text-sm text-green-600">✓ Nenhum risco previdenciário crítico identificado no período</p>
          )}
          <p className="text-xs text-muted-foreground mt-1 pt-1 border-t">
            * Simulação estimativa. O FAP real é calculado anualmente pelo INSS com base nos dados do NTEP/CNAE.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
