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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { useAuth } from "@/hooks/useAuth";
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

export function IntegracaoErgonomiaAEP({ campanha, ips, dimensoesCriticas = [] }: IntegracaoErgonomiaAEPProps) {
  const { tenantId } = useTenant();
  const { empresaAtivaId } = useEmpresaAtiva();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [gerando, setGerando] = useState(false);
  const [gerado, setGerado] = useState(false);
  const [riscoId, setRiscoId] = useState<string | null>(null);

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
      // Buscar fatores psicossociais para descrever o risco
      const fatoresCriticos = dimensoesCriticas.length > 0
        ? dimensoesCriticas.join(", ")
        : "Fatores psicossociais identificados na avaliação";

      const severidade = cls === "critico" ? "alta" : cls === "risco" ? "moderada" : "baixa";
      const prioridadeLabel = cls === "critico" ? "crítico" : cls === "risco" ? "alto" : "médio";
      const acaoNr = cls === "critico" ? "Intervenção imediata" : "Implementar medidas preventivas";

      // Inserir risco ergonômico psicossocial
      const { data: risco, error } = await supabase
        .from("ergonomia_riscos")
        .insert({
          tenant_id: tenantId,
          empresa_id: empresaAtivaId || null,
          nome: `Risco Psicossocial — ${campanha.nome}`,
          descricao: `Risco psicossocial identificado na campanha "${campanha.nome}" com IPS ${ips} (${prioridadeLabel}). Fatores críticos: ${fatoresCriticos}.`,
          tipo: "ergonomico",
          nivel_risco: severidade as any,
          setor: "Toda a organização",
          cargo: "Todos os cargos",
          ativo: true,
          fonte: "psicossocial",
          data_identificacao: new Date().toISOString().split("T")[0],
          recomendacao: acaoNr,
          criado_por: user?.id,
          criado_por_nome: profile?.nome_completo || "Sistema",
        })
        .select("id")
        .single();

      if (error) throw error;

      setRiscoId(risco?.id || null);
      setGerado(true);
      toast.success("Risco Psicossocial registrado na AEP — Ergonomia!");
    } catch (err: any) {
      console.error(err);
      // Se a tabela não existir, mostrar mensagem informativa
      if (err.message?.includes("does not exist") || err.code === "42P01") {
        toast.info("Integração com Ergonomia disponível após configuração do módulo.");
      } else {
        toast.error("Erro ao gerar AEP: " + (err.message || ""));
      }
    } finally {
      setGerando(false);
    }
  };

  const prioridadeCor = {
    critico: "bg-red-100 border-red-200 text-red-800",
    risco: "bg-orange-100 border-orange-200 text-orange-800",
    atencao: "bg-amber-100 border-amber-200 text-amber-800",
  }[cls as "critico" | "risco" | "atencao"] || "";

  const prioridadeLabel = {
    critico: "Risco Crítico — AEP Necessária",
    risco: "Risco Alto — AEP Recomendada",
    atencao: "Atenção — AEP Sugerida",
  }[cls as "critico" | "risco" | "atencao"] || "";

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
          <AlertTriangle className={cn("h-4 w-4 shrink-0 mt-0.5", {
            "text-red-600": cls === "critico",
            "text-orange-600": cls === "risco",
            "text-amber-600": cls === "atencao",
          })} />
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
          <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-emerald-800">AEP gerada com sucesso!</p>
              <p className="text-xs text-emerald-700">Risco registrado no módulo de Ergonomia</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-xs border-emerald-300"
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
            variant={cls === "critico" ? "destructive" : "default"}
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
          <p>A AEP (Análise Ergonômica Preliminar) será registrada em <strong>Saúde & Segurança → Ergonomia</strong> com os fatores psicossociais identificados, permitindo a elaboração do LTAE e medidas de controle conforme NR-17.</p>
        </div>
      </CardContent>
    </Card>
  );
}
