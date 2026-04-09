import { useState } from "react";
import {
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Sparkles,
  Info,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useTenant } from "@/hooks/useTenant";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { toast } from "sonner";
import type { CampanhaPsicossocial } from "@/types/psicossocial";
import { calcularIPSClassificacao } from "@/types/psicossocial";
import { useNavigate } from "react-router-dom";

interface IntegracaoErgonomiaAEPProps {
  campanha: CampanhaPsicossocial;
  ips: number | undefined;
  dimensoesCriticas?: string[];
}

const MINIMO_ANONIMATO = 5;

type ErgonomiaEixo = "cognitivo" | "fisico" | "organizacional";
type RiscoSeveridade = "baixo" | "medio" | "alto" | "critico";

export function IntegracaoErgonomiaAEP({ campanha, ips, dimensoesCriticas = [] }: IntegracaoErgonomiaAEPProps) {
  // All hooks at top level - before any conditional returns
  const { tenantId } = useTenant();
  const { empresaAtivaId } = useEmpresaAtiva();
  const navigate = useNavigate();
  const [gerando, setGerando] = useState(false);
  const [gerado, setGerado] = useState(false);

  if (!ips || (campanha.total_respostas || 0) < MINIMO_ANONIMATO) return null;

  const cls = calcularIPSClassificacao(ips);
  const isRiscoRelevante = ["atencao", "risco", "critico"].includes(cls);

  if (!isRiscoRelevante) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/30">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-800">Integração com Ergonomia</p>
              <p className="text-xs text-emerald-700">
                IPS {ips} — Nível saudável/estável. Não há indicação de geração de AEP no momento.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleGerarAEP = async () => {
    if (!tenantId) return;
    setGerando(true);
    try {
      const fatoresCriticos = dimensoesCriticas.length > 0
        ? dimensoesCriticas.join(", ")
        : "Fatores psicossociais identificados na avaliação";

      const severidade: RiscoSeveridade = cls === "critico" ? "critico" : cls === "risco" ? "alto" : "medio";
      const probabilidade: RiscoSeveridade = cls === "critico" ? "critico" : cls === "risco" ? "alto" : "medio";
      const eixo: ErgonomiaEixo = "organizacional";

      // Use supabase as any to bypass strict type for insert
      const { error } = await fromTable("ergonomia_riscos")
        .insert({
          tenant_id: tenantId,
          empresa_id: empresaAtivaId || null,
          titulo: `Risco Psicossocial — ${campanha.nome}`,
          descricao: `Risco psicossocial identificado na campanha "${campanha.nome}" com IPS ${ips}. Fatores críticos: ${fatoresCriticos}.`,
          eixo,
          probabilidade,
          severidade,
          setor: "Toda a organização",
          cargo: "Todos os cargos",
          ativo: true,
          fonte: "psicossocial",
          medidas_recomendadas: [
            "Realizar intervenção organizacional conforme plano de ação psicossocial",
            "Revisar carga de trabalho e condições organizacionais",
            "Implementar programa de apoio psicossocial",
          ],
        });

      if (error) throw error;

      setGerado(true);
      toast.success("Risco Psicossocial registrado na AEP — Ergonomia!");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao gerar AEP: " + (err.message || ""));
    } finally {
      setGerando(false);
    }
  };

  const prioridadeCor = cls === "critico"
    ? "border-red-200 bg-red-50/30"
    : cls === "risco"
    ? "border-orange-200 bg-orange-50/30"
    : "border-amber-200 bg-amber-50/30";

  const prioridadeLabel = cls === "critico"
    ? "Risco Crítico — AEP Necessária"
    : cls === "risco"
    ? "Risco Alto — AEP Recomendada"
    : "Atenção — AEP Sugerida";

  const iconCor = cls === "critico"
    ? "text-red-600"
    : cls === "risco"
    ? "text-orange-600"
    : "text-amber-600";

  return (
    <Card className={cn("border", prioridadeCor)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Wrench className="h-4 w-4" />
          Integração com Ergonomia — AEP
        </CardTitle>
        <CardDescription className="text-xs">
          Análise Ergonômica Preliminar (NR-17) — Fatores Psicossociais
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className={cn("h-4 w-4 shrink-0 mt-0.5", iconCor)} />
          <div className="text-sm">
            <p className="font-medium">{prioridadeLabel}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              IPS {ips} — {dimensoesCriticas.length > 0
                ? `Dimensões críticas: ${dimensoesCriticas.slice(0, 3).join(", ")}${dimensoesCriticas.length > 3 ? ` e mais ${dimensoesCriticas.length - 3}` : ""}`
                : "Risco psicossocial identificado na avaliação organizacional"}
            </p>
          </div>
        </div>

        {gerado ? (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-200 bg-emerald-50">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-emerald-800">AEP gerada com sucesso!</p>
              <p className="text-xs text-emerald-700">Risco registrado no módulo de Ergonomia</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-xs"
              onClick={() => navigate("/ergonomia")}
            >
              <ExternalLink className="h-3 w-3" />
              Ver
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleGerarAEP}
            disabled={gerando}
            size="sm"
            className="w-full gap-2"
          >
            {gerando ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando AEP...</>
            ) : (
              <><Sparkles className="h-3.5 w-3.5" /> Gerar AEP no módulo de Ergonomia</>
            )}
          </Button>
        )}

        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <p>A AEP será registrada em <strong>Saúde & Segurança → Ergonomia</strong> com os fatores psicossociais identificados, permitindo elaboração de medidas de controle conforme NR-17.</p>
        </div>
      </CardContent>
    </Card>
  );
}
