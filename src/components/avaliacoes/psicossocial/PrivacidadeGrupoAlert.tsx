/**
 * PrivacidadeGrupoAlert
 * ─────────────────────────────────────────────────────────────────────────────
 * GAP C — Alerta de privacidade por grupo (ISO 45003)
 *
 * Exibe:
 *  - Grupos disponíveis e seu nível de agrupamento
 *  - Grupos bloqueados com motivo
 *  - Badge de agrupamento automático quando ativado
 */

import { ShieldCheck, ShieldAlert, Lock, Info, ArrowUpCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ResultadoPrivacidade, GrupoAnalise } from "@/lib/psicossocial-privacy";
import { MINIMO_RESPONDENTES_GRUPO } from "@/lib/psicossocial-privacy";

interface PrivacidadeGrupoAlertProps {
  resultado: ResultadoPrivacidade;
  /** Modo compacto para uso em tabelas / listas */
  compact?: boolean;
  className?: string;
}

export function PrivacidadeGrupoAlert({
  resultado,
  compact = false,
  className,
}: PrivacidadeGrupoAlertProps) {
  const { gruposDisponiveis, gruposBloqueados, agrupamentoAutomaticoAtivado, resumoPrivacidade } = resultado;
  const totalBloqueados = gruposBloqueados.length;
  const totalDisponiveis = gruposDisponiveis.length;

  if (totalDisponiveis === 0 && totalBloqueados === 0) return null;

  // ── Modo compacto ──
  if (compact) {
    if (totalBloqueados === 0 && !agrupamentoAutomaticoAtivado) return null;
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("flex items-center gap-1.5 text-xs", className)}>
              {agrupamentoAutomaticoAtivado && (
                <Badge variant="outline" className="gap-1 text-amber-700 border-amber-300 bg-amber-50 text-[10px]">
                  <ArrowUpCircle className="h-3 w-3" />
                  Agrupamento automático
                </Badge>
              )}
              {totalBloqueados > 0 && (
                <Badge variant="outline" className="gap-1 text-red-700 border-red-300 bg-red-50 text-[10px]">
                  <Lock className="h-3 w-3" />
                  {totalBloqueados} grupo(s) bloqueado(s)
                </Badge>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">
            <p>{resumoPrivacidade}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // ── Modo completo ──
  const tudo_bloqueado = totalDisponiveis === 0;
  const parcialmente_bloqueado = totalBloqueados > 0 && totalDisponiveis > 0;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Alerta principal */}
      {tudo_bloqueado ? (
        <Alert variant="destructive" className="border-red-300 bg-red-50/60">
          <Lock className="h-4 w-4" />
          <AlertTitle className="text-sm font-semibold">
            Resultados bloqueados — Dados insuficientes para anonimato
          </AlertTitle>
          <AlertDescription className="text-xs mt-1 space-y-1">
            <p>
              Nenhum grupo atingiu o mínimo de <strong>{MINIMO_RESPONDENTES_GRUPO} respondentes</strong> necessário
              para garantir a confidencialidade individual (ISO 45003).
            </p>
            <p className="text-muted-foreground italic">
              "Se pode identificar alguém, não pode mostrar." — Princípio ISO 45003 / COPSOQ III
            </p>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {agrupamentoAutomaticoAtivado && (
            <Alert className="border-amber-300 bg-amber-50/60">
              <ArrowUpCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-sm font-semibold text-amber-800">
                Agrupamento automático ativado
              </AlertTitle>
              <AlertDescription className="text-xs text-amber-700 mt-1">
                Um ou mais grupos não atingiram {MINIMO_RESPONDENTES_GRUPO} respondentes.
                O sistema agrupou automaticamente em nível superior (setor ou empresa)
                para garantir o anonimato estatístico conforme ISO 45003.
              </AlertDescription>
            </Alert>
          )}

          {parcialmente_bloqueado && (
            <Alert className="border-orange-300 bg-orange-50/60">
              <ShieldAlert className="h-4 w-4 text-orange-600" />
              <AlertTitle className="text-sm font-semibold text-orange-800">
                {totalBloqueados} grupo(s) sem dados suficientes
              </AlertTitle>
              <AlertDescription className="text-xs text-orange-700 mt-1 space-y-1.5">
                <p>Os grupos abaixo não podem ser exibidos para preservar a confidencialidade:</p>
                <ul className="space-y-1">
                  {gruposBloqueados.map(g => (
                    <GrupoBloqueadoItem key={g.chave} grupo={g} />
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

      {/* Grupos bloqueados no modo tudo bloqueado */}
      {tudo_bloqueado && gruposBloqueados.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50/30 p-3 space-y-1.5">
          <p className="text-xs font-medium text-red-700 flex items-center gap-1.5">
            <Lock className="h-3 w-3" />
            Grupos bloqueados:
          </p>
          <ul className="space-y-1">
            {gruposBloqueados.map(g => (
              <GrupoBloqueadoItem key={g.chave} grupo={g} />
            ))}
          </ul>
        </div>
      )}

      {/* Grupos disponíveis — resumo */}
      {totalDisponiveis > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-3 space-y-1.5">
          <p className="text-xs font-medium text-emerald-700 flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3" />
            Grupos com análise disponível:
          </p>
          <ul className="space-y-1">
            {gruposDisponiveis.map(g => (
              <GrupoDisponivelItem key={g.chave} grupo={g} />
            ))}
          </ul>
        </div>
      )}

      {/* Nota normativa */}
      <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <Info className="h-3 w-3 mt-0.5 shrink-0" />
        <span>
          Regra de exibição mínima: <strong>{MINIMO_RESPONDENTES_GRUPO} respondentes por grupo</strong> — conforme ISO 45003 e COPSOQ III.
          Grupos abaixo do mínimo são automaticamente agrupados em nível superior.
        </span>
      </div>
    </div>
  );
}

function GrupoBloqueadoItem({ grupo }: { grupo: GrupoAnalise }) {
  return (
    <li className="flex items-center gap-2 text-xs">
      <Lock className="h-3 w-3 text-red-500 shrink-0" />
      <span className="font-medium">{grupo.label}</span>
      <span className="text-muted-foreground">
        — {grupo.respondentes} respondente(s) (mín. {MINIMO_RESPONDENTES_GRUPO})
      </span>
    </li>
  );
}

function GrupoDisponivelItem({ grupo }: { grupo: GrupoAnalise }) {
  const nivelLabels: Record<string, string> = {
    funcao: 'Função',
    setor: 'Setor',
    empresa: 'Empresa',
  };
  return (
    <li className="flex items-center gap-2 text-xs">
      <ShieldCheck className="h-3 w-3 text-emerald-600 shrink-0" />
      <span className="font-medium">{grupo.label}</span>
      <Badge variant="outline" className={cn(
        "text-[10px] px-1.5 py-0",
        grupo.agrupamentoAplicado
          ? "border-amber-300 text-amber-700 bg-amber-50"
          : "border-emerald-300 text-emerald-700 bg-emerald-50"
      )}>
        {grupo.agrupamentoAplicado ? (
          <><ArrowUpCircle className="h-2.5 w-2.5 mr-0.5" />{nivelLabels[grupo.nivel]}</>
        ) : nivelLabels[grupo.nivel]}
      </Badge>
      <span className="text-muted-foreground">{grupo.respondentes} resp.</span>
    </li>
  );
}
