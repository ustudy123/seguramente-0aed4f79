import { useState, useEffect } from "react";
import {
  Wallet, TrendingDown, AlertTriangle, Settings2, Info, Loader2,
  ChevronDown, FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useFeriasFinanceiro } from "@/hooks/useFeriasFinanceiro";
import { formatBRL, type EncargosConfig } from "@/lib/feriasFinanceiro";
import { cn } from "@/lib/utils";

export function FeriasFinanceiro() {
  const fin = useFeriasFinanceiro();
  const [configOpen, setConfigOpen] = useState(false);

  const semDados = fin.provisoes.length === 0 && fin.fluxo.length === 0;

  const nomeMes = (yyyymm: string) => {
    const [y, m] = yyyymm.split("-");
    return new Date(Number(y), Number(m) - 1, 1)
      .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
  };

  return (
    <div className="space-y-4">
      {/* Aviso de estimativa — sempre visível */}
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-800">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          Estimativa gerencial para planejamento, calculada com a taxa de encargos
          parametrizada ({fin.taxaEncargosPct.toFixed(1)}%). Não substitui o fechamento
          contábil-fiscal — concilie com a folha antes de usar para provisão oficial.
          {fin.semSalario > 0 && (
            <> {fin.semSalario} colaborador(es) sem salário cadastrado ficaram de fora.</>
          )}
        </p>
      </div>

      {/* Botão de parametrização */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setConfigOpen(true)}>
          <Settings2 className="h-4 w-4" />
          Parâmetros de encargos
        </Button>
      </div>

      {fin.isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Calculando...
        </div>
      ) : semDados ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Wallet className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">Sem dados financeiros ainda</p>
            <p className="text-xs mt-1 max-w-sm mx-auto">
              A estimativa usa os saldos de férias e os salários cadastrados. Importe os
              saldos na aba Saldos e verifique o salário base nas admissões.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Cards principais */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <CardIndicador
              icone={<Wallet className="h-5 w-5" />}
              tom="neutro"
              titulo="Provisão de férias"
              valor={formatBRL(fin.provisaoTotal)}
              legenda="Passivo acumulado, com terço e encargos (competência)"
            />
            <CardIndicador
              icone={<TrendingDown className="h-5 w-5" />}
              tom="info"
              titulo="Desembolso projetado"
              valor={formatBRL(fin.desembolsoTotal)}
              legenda="Caixa líquido a sair, por data de pagamento"
            />
            <CardIndicador
              icone={<AlertTriangle className="h-5 w-5" />}
              tom={fin.passivoDobroTotal > 0 ? "alerta" : "neutro"}
              titulo="Passivo em dobro"
              valor={formatBRL(fin.passivoDobroTotal)}
              legenda={`${fin.passivos.length} período(s) vencido(s) — art. 137`}
            />
          </div>

          {/* Fluxo de desembolso 12 meses */}
          {fin.fluxo.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Fluxo de desembolso projetado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {fin.fluxo.map(f => {
                    const max = Math.max(...fin.fluxo.map(x => x.liquido), 1);
                    return (
                      <div key={f.mes} className="flex items-center gap-3">
                        <span className="text-xs w-16 shrink-0 text-muted-foreground">{nomeMes(f.mes)}</span>
                        <div className="flex-1 bg-muted/40 rounded h-6 relative overflow-hidden">
                          <div
                            className="h-full bg-sky-400/70 rounded"
                            style={{ width: `${(f.liquido / max) * 100}%` }}
                          />
                          <span className="absolute inset-y-0 left-2 flex items-center text-[11px] font-medium">
                            {formatBRL(f.liquido)}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground w-20 shrink-0 text-right">
                          {f.pessoas} pessoa{f.pessoas !== 1 ? "s" : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Passivo em dobro detalhado */}
          {fin.passivos.length > 0 && (
            <Card className="border-red-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-4 w-4" />
                  Férias vencidas com dobra exigível
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {fin.passivos.map(p => (
                  <div key={p.cpf + p.aquisitivoFim} className="flex items-center gap-3 text-xs border-t pt-1.5 first:border-0 first:pt-0">
                    <span className="flex-1 font-medium">{p.nome}</span>
                    <span className="text-muted-foreground">
                      venceu {new Date(p.limiteConcessivo).toLocaleDateString("pt-BR")} · {p.diasVencidos}d
                    </span>
                    <span className="font-semibold text-red-600 w-24 text-right">{formatBRL(p.valorDobra)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Memória de cálculo da provisão (conciliação contábil) */}
          <Collapsible>
            <Card>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="pb-2 flex-row items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Memória de cálculo da provisão ({fin.provisoes.length})
                  </CardTitle>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-muted-foreground border-b">
                        <tr className="text-left">
                          <th className="py-1.5 pr-2">Colaborador</th>
                          <th className="py-1.5 px-2 text-right">Rem.</th>
                          <th className="py-1.5 px-2 text-center">Dias</th>
                          <th className="py-1.5 px-2 text-right">Base + 1/3</th>
                          <th className="py-1.5 px-2 text-right">Encargos</th>
                          <th className="py-1.5 pl-2 text-right">Provisão</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fin.provisoes.map(p => (
                          <tr key={p.cpf} className="border-b last:border-0">
                            <td className="py-1.5 pr-2 font-medium">{p.nome}</td>
                            <td className="py-1.5 px-2 text-right">{formatBRL(p.remuneracaoMensal)}</td>
                            <td className="py-1.5 px-2 text-center">{p.diasDireitoAcumulados}</td>
                            <td className="py-1.5 px-2 text-right">{formatBRL(p.comTerco)}</td>
                            <td className="py-1.5 px-2 text-right text-muted-foreground">{formatBRL(p.encargos)}</td>
                            <td className="py-1.5 pl-2 text-right font-semibold">{formatBRL(p.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </>
      )}

      <ConfigEncargosDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        atual={fin.encargos}
        onSalvar={(c) => { fin.salvarEncargos.mutate(c); setConfigOpen(false); }}
        salvando={fin.salvarEncargos.isPending}
      />
    </div>
  );
}

function CardIndicador({ icone, titulo, valor, legenda, tom }: {
  icone: React.ReactNode; titulo: string; valor: string; legenda: string;
  tom: "neutro" | "info" | "alerta";
}) {
  return (
    <Card className={cn(
      tom === "alerta" && "border-red-200 bg-red-50/30",
      tom === "info" && "border-sky-200 bg-sky-50/30",
    )}>
      <CardContent className="pt-4">
        <div className={cn(
          "flex items-center gap-2 mb-1",
          tom === "alerta" ? "text-red-600" : tom === "info" ? "text-sky-600" : "text-muted-foreground",
        )}>
          {icone}
          <span className="text-xs font-medium">{titulo}</span>
        </div>
        <div className="text-2xl font-bold">{valor}</div>
        <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{legenda}</p>
      </CardContent>
    </Card>
  );
}

function ConfigEncargosDialog({ open, onOpenChange, atual, onSalvar, salvando }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  atual: EncargosConfig; onSalvar: (c: EncargosConfig) => void; salvando: boolean;
}) {
  const [cfg, setCfg] = useState<EncargosConfig>(atual);
  useEffect(() => { if (open) setCfg(atual); }, [open, atual]);

  const total = ((cfg.simplesDispensaPatronal ? 0 : cfg.inssPatronal) +
    cfg.ratFap + (cfg.simplesDispensaPatronal ? 0 : cfg.terceiros) + cfg.fgts);

  const campo = (label: string, key: keyof EncargosConfig, hint?: string, disabled?: boolean) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        <Input
          type="number" step="0.1" min="0"
          value={cfg[key] as number}
          disabled={disabled}
          onChange={e => setCfg({ ...cfg, [key]: Number(e.target.value) })}
          className="pr-7"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
      </div>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) setCfg(atual); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Parâmetros de encargos</DialogTitle>
          <DialogDescription>
            Compõem a taxa aplicada sobre férias + terço. Muda por regime tributário (seção 7.4).
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-lg border p-3 bg-amber-50/40">
          <div>
            <Label className="text-sm">Simples Nacional (Anexos I, II, III, V)</Label>
            <p className="text-[10px] text-muted-foreground">Dispensa patronal e terceiros. Anexo IV recolhe normal.</p>
          </div>
          <Switch
            checked={cfg.simplesDispensaPatronal}
            onCheckedChange={v => setCfg({ ...cfg, simplesDispensaPatronal: v })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {campo("INSS patronal", "inssPatronal", "Padrão 20%", cfg.simplesDispensaPatronal)}
          {campo("RAT × FAP", "ratFap", "1% a 3% conforme FAP")}
          {campo("Terceiros", "terceiros", "Até 5,8%", cfg.simplesDispensaPatronal)}
          {campo("FGTS", "fgts", "Padrão 8%")}
        </div>

        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
          <span className="text-sm font-medium">Taxa total de encargos</span>
          <Badge variant="secondary" className="text-sm">{total.toFixed(1)}%</Badge>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onSalvar(cfg)} disabled={salvando} className="gap-2">
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
