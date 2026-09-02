import { useNavigate } from "react-router-dom";
import { useMeuPlano } from "@/hooks/useMeuPlano";
import { FEATURE_PLAN_NAME } from "@/lib/planFeatures";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Layers, Users, Check, Lock, Sparkles, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MeuPlano() {
  const navigate = useNavigate();
  const { plano, isLoading } = useMeuPlano();

  const vidas = plano?.vidas;
  const percent = vidas?.percent ?? null;
  const perto = percent !== null && percent >= 80 && percent < 100;
  const noLimite = percent !== null && percent >= 100;

  const barCor = noLimite
    ? "bg-red-500"
    : perto
    ? "bg-amber-500"
    : "bg-emerald-500";

  const disponiveis = plano?.modulos.filter((m) => m.disponivel) ?? [];
  const bloqueados = plano?.modulos.filter((m) => !m.disponivel) ?? [];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Meu Plano</h1>
          <p className="text-sm text-muted-foreground">Plano, uso e módulos da sua empresa</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : !plano?.plano ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            <Info className="w-5 h-5 mx-auto mb-2 opacity-60" />
            Ainda não há um plano definido para esta empresa. Fale com o suporte.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Plano atual */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="w-4 h-4" /> Plano atual
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{plano.plano.name}</p>
                {!plano.plano.is_public && (
                  <p className="text-xs text-muted-foreground mt-0.5">Plano interno</p>
                )}
              </div>
              <Sparkles className="w-8 h-8 text-primary/30" />
            </CardContent>
          </Card>

          {/* Vidas: uso × limite */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4" /> Colaboradores (vidas)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {vidas?.is_unlimited || vidas?.limit == null ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{vidas?.used ?? 0}</span>
                  <span className="text-sm text-muted-foreground">colaboradores ativos · limite ilimitado</span>
                </div>
              ) : (
                <>
                  <div className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold">{vidas.used}</span>
                      <span className="text-sm text-muted-foreground">de {vidas.limit} vidas</span>
                    </div>
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        noLimite ? "text-red-600" : perto ? "text-amber-600" : "text-emerald-600"
                      )}
                    >
                      {percent}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", barCor)}
                      style={{ width: `${Math.min(percent ?? 0, 100)}%` }}
                    />
                  </div>
                  {(perto || noLimite) && (
                    <div
                      className={cn(
                        "rounded-md border px-3 py-2 text-sm",
                        noLimite
                          ? "border-red-200 bg-red-50 text-red-800"
                          : "border-amber-200 bg-amber-50 text-amber-800"
                      )}
                    >
                      {noLimite
                        ? "Você atingiu o limite de vidas do seu plano. Faça upgrade para cadastrar mais colaboradores."
                        : `Você está usando ${percent}% do limite de vidas. Considere um upgrade antes de atingir o teto.`}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Módulos: disponíveis × bloqueados */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Check className="w-4 h-4" /> Módulos do seu plano
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {disponiveis.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Incluídos ({disponiveis.length})
                  </p>
                  {disponiveis.map((m) => (
                    <div key={m.key} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>{m.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {bloqueados.length > 0 && (
                <>
                  {disponiveis.length > 0 && <Separator />}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Disponíveis com upgrade ({bloqueados.length})
                    </p>
                    {bloqueados.map((m) => {
                      const planoDoModulo = FEATURE_PLAN_NAME[m.key];
                      return (
                        <div key={m.key} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Lock className="w-4 h-4 flex-shrink-0 opacity-60" />
                          <span className="flex-1">{m.name}</span>
                          {planoDoModulo && (
                            <Badge variant="outline" className="text-[11px] font-normal">
                              {planoDoModulo}
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground text-center px-4">
            Para mudar de plano ou liberar um módulo, fale com o suporte.
          </p>
        </>
      )}
    </div>
  );
}
