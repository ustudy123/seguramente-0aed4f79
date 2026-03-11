import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  FileText,
  Scale,
  Award,
  CheckCircle,
  Clock,
  AlertTriangle,
  History,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { FeriasSolicitacao } from "@/hooks/useFerias";
import { calcularPeriodoFerias } from "@/lib/feriasPeriodo";

interface FeriasGovernancaProps {
  solicitacoes: FeriasSolicitacao[];
  colaboradores: any[];
}

export function FeriasGovernanca({ solicitacoes, colaboradores }: FeriasGovernancaProps) {
  // Diligence metrics
  const diligencia = useMemo(() => {
    const total = colaboradores.length;
    const comFerias = new Set(
      solicitacoes
        .filter((s) => ["aprovado", "em_gozo", "concluido"].includes(s.status))
        .map((s) => s.colaborador_nome)
    ).size;

    let vencidas = 0;
    colaboradores.forEach((c) => {
      const diasUsados = solicitacoes
        .filter((f) => f.colaborador_nome === c.nome_completo && ["aprovado", "em_gozo", "concluido"].includes(f.status))
        .reduce((sum, f) => sum + f.dias_solicitados, 0);
      const periodo = calcularPeriodoFerias(c.data_admissao || null, diasUsados);
      if (periodo?.statusVencimento === "vencido") vencidas++;
    });

    const avisosGerados = solicitacoes.filter((s) => s.aviso_gerado).length;
    const recibosGerados = solicitacoes.filter((s) => s.recibo_gerado).length;
    const assinados = solicitacoes.filter((s) => s.assinatura_status === "assinado").length;
    const comINR = solicitacoes.filter((s) => s.inr_score_momento != null).length;
    const preventivas = solicitacoes.filter((s) => s.acao_preventiva).length;

    // Score de diligência 0-100
    const maxScore = total > 0 ? total : 1;
    const fatorCobertura = total > 0 ? (comFerias / total) * 25 : 25;
    const fatorVencidas = total > 0 ? Math.max(0, 25 - (vencidas / total) * 25) : 25;
    const fatorDocumentos = solicitacoes.length > 0 ? ((avisosGerados + recibosGerados) / (solicitacoes.length * 2)) * 25 : 25;
    const fatorINR = solicitacoes.length > 0 ? (comINR / solicitacoes.length) * 25 : 0;
    const score = Math.round(fatorCobertura + fatorVencidas + fatorDocumentos + fatorINR);

    return {
      total,
      comFerias,
      vencidas,
      avisosGerados,
      recibosGerados,
      assinados,
      comINR,
      preventivas,
      score: Math.min(100, score),
      nivel: score >= 80 ? "excelente" : score >= 60 ? "bom" : score >= 40 ? "regular" : "critico",
    };
  }, [solicitacoes, colaboradores]);

  const nivelConfig = {
    excelente: { label: "Excelente", color: "text-success", bg: "bg-success/10" },
    bom: { label: "Bom", color: "text-info", bg: "bg-info/10" },
    regular: { label: "Regular", color: "text-warning", bg: "bg-warning/10" },
    critico: { label: "Crítico", color: "text-destructive", bg: "bg-destructive/10" },
  };

  const cfg = nivelConfig[diligencia.nivel];

  // Evidence items
  const evidencias = [
    {
      label: "Cobertura de férias",
      valor: `${diligencia.comFerias}/${diligencia.total}`,
      status: diligencia.comFerias > 0 ? "ok" : "pendente",
      desc: "Colaboradores com férias concedidas no período",
    },
    {
      label: "Férias vencidas",
      valor: diligencia.vencidas.toString(),
      status: diligencia.vencidas === 0 ? "ok" : "alerta",
      desc: "Períodos concessivos expirados (Art. 137, CLT)",
    },
    {
      label: "Avisos de férias gerados",
      valor: diligencia.avisosGerados.toString(),
      status: diligencia.avisosGerados > 0 ? "ok" : "pendente",
      desc: "Documentos formais de comunicação",
    },
    {
      label: "Recibos gerados",
      valor: diligencia.recibosGerados.toString(),
      status: diligencia.recibosGerados > 0 ? "ok" : "pendente",
      desc: "Comprovantes de pagamento de férias",
    },
    {
      label: "Assinaturas digitais",
      valor: diligencia.assinados.toString(),
      status: diligencia.assinados > 0 ? "ok" : "pendente",
      desc: "Documentos assinados pelo colaborador",
    },
    {
      label: "INR™ registrado na solicitação",
      valor: diligencia.comINR.toString(),
      status: diligencia.comINR > 0 ? "ok" : "info",
      desc: "Score de necessidade de recuperação capturado",
    },
    {
      label: "Ações preventivas geradas",
      valor: diligencia.preventivas.toString(),
      status: diligencia.preventivas > 0 ? "ok" : "info",
      desc: "Férias como instrumento de prevenção de fadiga",
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <ShieldCheck className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Governança & Diligência</h2>
          <p className="text-xs text-muted-foreground">
            Evidências de que a empresa avalia, ajusta, registra e atua preventivamente
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Score de Maturidade */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-sm">Selo de Maturidade — Férias</h3>
          </div>
          <div className="text-center space-y-3">
            <div className="relative inline-flex items-center justify-center w-28 h-28">
              <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
                <circle
                  cx="60" cy="60" r="50" fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="10"
                  strokeDasharray={`${(diligencia.score / 100) * 314} 314`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-2xl font-bold text-foreground">{diligencia.score}</span>
            </div>
            <Badge className={cn("text-xs", cfg.bg, cfg.color)}>
              {cfg.label}
            </Badge>
            <p className="text-[11px] text-muted-foreground">
              Score composto: cobertura, conformidade, documentação e inteligência
            </p>
          </div>
        </div>

        {/* Checklist de Evidências */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border shadow-sm">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Checklist de Diligência</h3>
            <Badge variant="outline" className="ml-auto text-[10px]">
              {evidencias.filter((e) => e.status === "ok").length}/{evidencias.length} conformes
            </Badge>
          </div>
          <div className="divide-y divide-border">
            {evidencias.map((ev) => (
              <div key={ev.label} className="p-4 flex items-center gap-4">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  ev.status === "ok" && "bg-success/10",
                  ev.status === "alerta" && "bg-destructive/10",
                  ev.status === "pendente" && "bg-muted",
                  ev.status === "info" && "bg-info/10",
                )}>
                  {ev.status === "ok" && <CheckCircle className="w-4 h-4 text-success" />}
                  {ev.status === "alerta" && <AlertTriangle className="w-4 h-4 text-destructive" />}
                  {ev.status === "pendente" && <Clock className="w-4 h-4 text-muted-foreground" />}
                  {ev.status === "info" && <TrendingUp className="w-4 h-4 text-info" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{ev.label}</p>
                    <span className="text-sm font-bold text-foreground">{ev.valor}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{ev.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legal context */}
      <div className="bg-muted/30 border border-border rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-sm">Impacto Jurídico e Estratégico</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted-foreground">
          <div className="space-y-1">
            <p className="font-medium text-foreground">Para Auditoria</p>
            <p>Registros completos de solicitação, aprovação, documentos gerados e assinaturas.</p>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-foreground">Para o Jurídico</p>
            <p>Evidência de conformidade CLT, análise de risco (INR™) e ações preventivas documentadas.</p>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-foreground">Para a Alta Gestão</p>
            <p>Férias como ferramenta de organização do trabalho, com impacto financeiro e de saúde mensuráveis.</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
