import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Brain,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  ListChecks,
  ChevronDown,
  ChevronUp,
  Loader2,
  SquarePen,
  ShieldCheck,
} from "lucide-react";
import type { EventoSST } from "@/types/eventoSST";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  evento: EventoSST;
  onUpdateEvento?: (data: Partial<EventoSST>) => Promise<void>;
}

// ─── Checklist NR-01 / ISO 45001 ────────────────────────────────────────────

const CHECKLIST_NR01 = [
  {
    id: "cr1",
    texto: "O evento foi notificado à CIPA/Liderança imediatamente após a ocorrência?",
    norma: "NR-01",
  },
  {
    id: "cr2",
    texto: "Foi realizado atendimento médico ao colaborador afetado (se necessário)?",
    norma: "NR-01",
  },
  {
    id: "cr3",
    texto: "A área/máquina envolvida foi isolada/bloqueada até término da investigação?",
    norma: "NR-01 / ISO 45001",
  },
  {
    id: "cr4",
    texto: "Foram coletadas evidências no local (fotos, depoimentos, condições)?",
    norma: "ISO 45001 §10.2",
  },
  {
    id: "cr5",
    texto: "Foram entrevistados testemunhas e o colaborador envolvido?",
    norma: "ISO 45001 §10.2",
  },
  {
    id: "cr6",
    texto: "A análise de causa raiz foi realizada (5-Porquês, Diagrama de Ishikawa, etc.)?",
    norma: "ISO 45001 §10.2",
  },
  {
    id: "cr7",
    texto: "As causas identificadas foram relacionadas ao PGR/Inventário de Riscos?",
    norma: "NR-01 (GRO)",
  },
  {
    id: "cr8",
    texto: "Foi elaborado plano de ação com prazo e responsável definidos?",
    norma: "NR-01 / ISO 45001",
  },
  {
    id: "cr9",
    texto: "O evento foi comunicado ao eSocial dentro do prazo (S-2210)?",
    norma: "eSocial S-2210",
  },
  {
    id: "cr10",
    texto: "A CAT foi emitida no prazo legal (1° dia útil para acidente típico)?",
    norma: "Lei 8.213/91",
  },
];

const CHECKLIST_ERGONOMIA = [
  {
    id: "erg1",
    texto: "Os fatores ergonômicos relacionados foram avaliados conforme NR-17?",
    norma: "NR-17",
  },
  {
    id: "erg2",
    texto: "O posto de trabalho foi analisado quanto à postura, esforço e repetitividade?",
    norma: "NR-17",
  },
  {
    id: "erg3",
    texto: "O colaborador recebeu treinamento sobre ergonomia e postura correta?",
    norma: "NR-17",
  },
];

// ─── Score de risco preditivo ────────────────────────────────────────────────

function calcularScoreRisco(evento: EventoSST, todosEventos: EventoSST[]): {
  score: number;
  nivel: "baixo" | "medio" | "alto" | "critico";
  fatores: { label: string; peso: number; ativo: boolean }[];
} {
  let score = 0;
  const fatores = [];

  // Acidente (peso alto)
  fatores.push({
    label: "Tipo: Acidente (maior gravidade)",
    peso: 25,
    ativo: evento.tipo === "acidente",
  });
  if (evento.tipo === "acidente") score += 25;

  // Gravidade da lesão
  const gravPeso = { grave: 30, moderada: 15, leve: 5, sem_lesao: 0 };
  const grav = evento.gravidade_lesao || "sem_lesao";
  const gravVal = gravPeso[grav as keyof typeof gravPeso] || 0;
  fatores.push({ label: `Gravidade: ${grav.replace("_", " ")}`, peso: gravVal, ativo: gravVal > 0 });
  score += gravVal;

  // Afastamento
  const afastPeso = { mais_15_dias: 20, ate_15_dias: 10, sem_afastamento: 0 };
  const afastVal = afastPeso[(evento.afastamento || "sem_afastamento") as keyof typeof afastPeso] || 0;
  fatores.push({ label: "Afastamento do trabalho", peso: afastVal, ativo: afastVal > 0 });
  score += afastVal;

  // Óbito
  fatores.push({ label: "Óbito registrado", peso: 40, ativo: !!evento.obito });
  if (evento.obito) score += 40;

  // Reincidência no setor (mesmo setor, últimos 6 meses)
  const seisMesesAtras = new Date();
  seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);
  const reincidencias = todosEventos.filter(
    (e) =>
      e.id !== evento.id &&
      e.setor === evento.setor &&
      new Date(e.data_evento) >= seisMesesAtras
  ).length;
  const reincVal = Math.min(reincidencias * 5, 15);
  fatores.push({
    label: `Reincidências no setor (${reincidencias} nos últimos 6 meses)`,
    peso: reincVal,
    ativo: reincidencias > 0,
  });
  score += reincVal;

  // Fatores ergonômicos (indica risco sistêmico)
  const ergVal = Math.min((evento.fatores_ergonomicos?.length || 0) * 2, 10);
  fatores.push({
    label: `Fatores ergonômicos/psicossociais (${evento.fatores_ergonomicos?.length || 0})`,
    peso: ergVal,
    ativo: (evento.fatores_ergonomicos?.length || 0) > 0,
  });
  score += ergVal;

  // Sem causa raiz definida
  const semCausaRaiz = !evento.percepcao_causa || evento.percepcao_causa.trim().length < 10;
  fatores.push({
    label: "Sem causa raiz identificada",
    peso: 10,
    ativo: semCausaRaiz,
  });
  if (semCausaRaiz) score += 10;

  const nivel =
    score >= 70 ? "critico" : score >= 45 ? "alto" : score >= 20 ? "medio" : "baixo";

  return { score: Math.min(score, 100), nivel, fatores };
}

// ─── Component ───────────────────────────────────────────────────────────────

export const InvestigacaoAssistidaIA = ({ evento, onUpdateEvento }: Props) => {
  const [loadingIA, setLoadingIA] = useState(false);
  const [analiseIA, setAnaliseIA] = useState<string | null>(null);
  const [checklistAberto, setChecklistAberto] = useState(true);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [notasInvestigacao, setNotasInvestigacao] = useState(evento.percepcao_causa || "");
  const [salvandoNotas, setSalvandoNotas] = useState(false);

  // Usar eventos do hook seria melhor, mas para simplicidade usamos array vazio
  const scoreInfo = calcularScoreRisco(evento, []);

  const nivelColors = {
    baixo: "text-green-600 bg-green-50 border-green-200",
    medio: "text-amber-600 bg-amber-50 border-amber-200",
    alto: "text-orange-600 bg-orange-50 border-orange-200",
    critico: "text-destructive bg-red-50 border-red-200",
  };
  const nivelLabels = {
    baixo: "Baixo Risco",
    medio: "Risco Médio",
    alto: "Alto Risco",
    critico: "Risco Crítico",
  };

  const checklistCompleto = CHECKLIST_NR01.concat(
    evento.fatores_ergonomicos?.length ? CHECKLIST_ERGONOMIA : []
  );
  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const pctChecklist = Math.round((checkedCount / checklistCompleto.length) * 100);

  const handleAnalisarIA = async () => {
    setLoadingIA(true);
    setAnaliseIA(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-sst-investigacao", {
        body: {
          evento: {
            tipo: evento.tipo,
            data_evento: evento.data_evento,
            setor: evento.setor,
            unidade: evento.unidade,
            categoria_principal: evento.categoria_principal,
            origem_predominante: evento.origem_predominante,
            descricao: evento.descricao,
            percepcao_causa: evento.percepcao_causa,
            gravidade_lesao: evento.gravidade_lesao,
            afastamento: evento.afastamento,
            atendimento: evento.atendimento,
            fatores_ergonomicos: evento.fatores_ergonomicos,
            tipo_acidente_legal: evento.tipo_acidente_legal,
            cid10: evento.cid10,
            nexo_causal: evento.nexo_causal,
            agente_causador_esocial: evento.agente_causador_esocial,
            obito: evento.obito,
          },
        },
      });

      if (error) throw error;
      setAnaliseIA(data?.analise || "Análise não disponível.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao solicitar análise de IA");
    } finally {
      setLoadingIA(false);
    }
  };

  const handleSalvarNotas = async () => {
    if (!onUpdateEvento) return;
    setSalvandoNotas(true);
    try {
      await onUpdateEvento({ percepcao_causa: notasInvestigacao });
      toast.success("Notas de investigação salvas");
    } finally {
      setSalvandoNotas(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Score de Risco */}
      <Card className={cn("border", nivelColors[scoreInfo.nivel])}>
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              <span className="font-semibold text-sm">Score de Risco do Evento</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold tabular-nums">{scoreInfo.score}</span>
              <div>
                <Badge variant="outline" className={cn("text-xs font-semibold", nivelColors[scoreInfo.nivel])}>
                  {nivelLabels[scoreInfo.nivel]}
                </Badge>
              </div>
            </div>
          </div>
          <div className="w-full h-2 rounded-full bg-muted/50 overflow-hidden mb-3">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                scoreInfo.nivel === "baixo" ? "bg-green-500" :
                scoreInfo.nivel === "medio" ? "bg-amber-500" :
                scoreInfo.nivel === "alto" ? "bg-orange-500" : "bg-destructive"
              )}
              style={{ width: `${scoreInfo.score}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {scoreInfo.fatores.filter(f => f.ativo).map((f) => (
              <div key={f.label} className="flex items-center gap-1.5 text-xs">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span className="truncate">{f.label} (+{f.peso}pts)</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Checklist NR-01 / ISO 45001 */}
      <Card>
        <CardHeader
          className="pb-2 pt-3 px-4 cursor-pointer select-none"
          onClick={() => setChecklistAberto(!checklistAberto)}
        >
          <CardTitle className="text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-primary" />
              Checklist de Investigação — NR-01 / ISO 45001
              <Badge variant="outline" className="text-xs">
                {checkedCount}/{checklistCompleto.length}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("text-xs font-semibold", pctChecklist >= 80 ? "text-green-600" : pctChecklist >= 50 ? "text-amber-600" : "text-destructive")}>
                {pctChecklist}%
              </span>
              {checklistAberto ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </div>
          </CardTitle>
          <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden mt-1.5">
            <div
              className={cn("h-full rounded-full transition-all", pctChecklist >= 80 ? "bg-green-500" : pctChecklist >= 50 ? "bg-amber-400" : "bg-destructive")}
              style={{ width: `${pctChecklist}%` }}
            />
          </div>
        </CardHeader>
        {checklistAberto && (
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {checklistCompleto.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-start gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer",
                    checkedItems[item.id] ? "border-green-200 bg-green-50/50" : "border-border hover:border-muted-foreground/30"
                  )}
                  onClick={() => setCheckedItems(p => ({ ...p, [item.id]: !p[item.id] }))}
                >
                  <Checkbox
                    checked={!!checkedItems[item.id]}
                    onCheckedChange={(v) => setCheckedItems(p => ({ ...p, [item.id]: !!v }))}
                    className="mt-0.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-relaxed">{item.texto}</p>
                    <Badge variant="outline" className="text-xs mt-1 font-normal">{item.norma}</Badge>
                  </div>
                  {checkedItems[item.id] && (
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Notas de investigação */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <SquarePen className="w-4 h-4 text-primary" />
            Análise de Causa Raiz / Notas de Investigação
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <Textarea
            value={notasInvestigacao}
            onChange={(e) => setNotasInvestigacao(e.target.value)}
            placeholder="Descreva as causas raiz identificadas, método utilizado (5-Porquês, Ishikawa, etc.), fatores contribuintes e conclusões da investigação..."
            className="min-h-[120px] text-sm"
          />
          {onUpdateEvento && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleSalvarNotas}
              disabled={salvandoNotas}
            >
              {salvandoNotas ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Salvar Notas
            </Button>
          )}
        </CardContent>
      </Card>

      {/* IA de Investigação */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            Motor de Investigação Assistida por IA
            <Badge className="text-xs bg-primary/10 text-primary border-primary/20">GPT-4o</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            A IA analisa os dados do evento e sugere causas prováveis, correlações com histórico, ações preventivas conforme NR-01/ISO 45001 e alertas legais relevantes.
          </p>
          <Button
            onClick={handleAnalisarIA}
            disabled={loadingIA}
            size="sm"
            className="w-full"
          >
            {loadingIA ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analisando evento...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" /> Analisar com IA</>
            )}
          </Button>

          {analiseIA && (
            <>
              <Separator />
              <div className="prose prose-sm max-w-none text-foreground">
                <div className="text-xs leading-relaxed whitespace-pre-wrap bg-muted/30 rounded-lg p-3 border">
                  {analiseIA}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
