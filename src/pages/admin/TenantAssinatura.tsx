import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CreditCard, CalendarClock, Info, Building2 } from "lucide-react";

const TRIAL_PADRAO_DIAS = 7;

function formatarData(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function TenantAssinatura() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tenants } = useSuperAdmin();

  const tenant = tenants.find((t) => t.id === id);

  // Estado local apenas — esta tela ainda não persiste nada.
  const [trialDias, setTrialDias] = useState<number>(TRIAL_PADRAO_DIAS);
  const [pago, setPago] = useState(false);

  // O trial conta a partir da criação da empresa.
  const inicio = tenant?.created_at ? new Date(tenant.created_at) : null;
  const vencimento = inicio ? new Date(inicio.getTime() + trialDias * 86400000) : null;

  const hoje = new Date();
  const diasRestantes = vencimento
    ? Math.ceil((vencimento.getTime() - hoje.getTime()) / 86400000)
    : 0;
  const vencido = !pago && diasRestantes <= 0;

  const situacao = pago
    ? { label: "Pago", cor: "bg-emerald-100 text-emerald-800 border-emerald-200" }
    : vencido
    ? { label: "Trial vencido", cor: "bg-red-100 text-red-800 border-red-200" }
    : { label: `Em trial · ${diasRestantes} dia${diasRestantes === 1 ? "" : "s"} restante${diasRestantes === 1 ? "" : "s"}`,
        cor: "bg-amber-100 text-amber-800 border-amber-200" };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold truncate">
            {tenant?.nome || <Skeleton className="h-6 w-48" />}
          </h1>
          <p className="text-sm text-muted-foreground">Assinatura e período de teste</p>
        </div>
      </div>

      {/* Esta tela ainda não faz nada. Dizer isso é mais honesto do que
          deixar o superadmin achar que configurou. */}
      <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
        <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-blue-900">Prévia visual — nada é salvo ainda.</p>
          <p className="text-blue-800 text-xs mt-0.5">
            Os controles abaixo mostram como a configuração vai funcionar. Eles não gravam,
            não bloqueiam o acesso da empresa e não cobram nada. A plataforma de pagamento
            ainda será definida.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> Situação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Situação atual</p>
              <p className="text-xs text-muted-foreground">
                Calculada a partir da data de criação e dos dias de teste.
              </p>
            </div>
            <Badge variant="outline" className={situacao.cor}>{situacao.label}</Badge>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="pago" className="text-sm font-medium">Pagamento confirmado</Label>
              <p className="text-xs text-muted-foreground">
                Marcar manualmente enquanto não há integração com a plataforma de pagamento.
              </p>
            </div>
            <Switch id="pago" checked={pago} onCheckedChange={setPago} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="w-4 h-4" /> Período de teste
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dias">Dias de teste</Label>
              <Input
                id="dias"
                type="number"
                min={0}
                max={365}
                value={trialDias}
                onChange={(e) => setTrialDias(Math.max(0, Number(e.target.value) || 0))}
              />
              <p className="text-xs text-muted-foreground mt-1">Padrão: {TRIAL_PADRAO_DIAS} dias.</p>
            </div>
            <div>
              <Label>Vence em</Label>
              <div className="h-10 flex items-center rounded-md border border-input bg-muted/40 px-3 text-sm">
                {vencimento ? formatarData(vencimento) : "—"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {inicio ? `Contado a partir de ${formatarData(inicio)}.` : "Sem data de criação."}
              </p>
            </div>
          </div>

          {vencido && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              Com esta configuração, a empresa já estaria com o teste vencido — é neste ponto que
              o checkout apareceria e o acesso ficaria bloqueado.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Empresa
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1.5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Plano</span>
            <span className="capitalize">{tenant?.plano || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Criada em</span>
            <span>{inicio ? formatarData(inicio) : "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <span>{tenant?.ativo ? "Ativa" : "Inativa"}</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate("/admin")}>Voltar</Button>
        <Button disabled title="Ainda não implementado — a tela é apenas visual">
          Salvar
        </Button>
      </div>
    </div>
  );
}
