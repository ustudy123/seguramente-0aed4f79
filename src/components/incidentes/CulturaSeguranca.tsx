import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Trophy,
  Star,
  TrendingUp,
  Award,
  Users,
  ThumbsUp,
  AlertCircle,
  Flame,
  ShieldCheck,
} from "lucide-react";
import type { EventoSST } from "@/types/eventoSST";
import { cn } from "@/lib/utils";
import { format, subMonths, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  eventos: EventoSST[];
}

interface SetorScore {
  setor: string;
  nearMiss: number;
  acidentes: number;
  ratio: number;
  score: number;
  nivel: "bronze" | "prata" | "ouro" | "diamante";
  badge: string;
  emoji: string;
}

function calcularNivel(score: number): { nivel: SetorScore["nivel"]; badge: string; emoji: string } {
  if (score >= 85) return { nivel: "diamante", badge: "Diamante — Cultura Exemplar", emoji: "💎" };
  if (score >= 65) return { nivel: "ouro", badge: "Ouro — Cultura Madura", emoji: "🥇" };
  if (score >= 40) return { nivel: "prata", badge: "Prata — Em Desenvolvimento", emoji: "🥈" };
  return { nivel: "bronze", badge: "Bronze — Iniciante", emoji: "🥉" };
}

export const CulturaSeguranca = ({ eventos }: Props) => {
  const tresM = subMonths(new Date(), 3);

  // Métricas globais de cultura
  const nearMissTotal = eventos.filter((e) => e.tipo === "incidente").length;
  const acidentesTotal = eventos.filter((e) => e.tipo === "acidente").length;
  const ratioBird = acidentesTotal > 0 ? nearMissTotal / acidentesTotal : nearMissTotal;

  const eventosRecentes = eventos.filter((e) => isAfter(new Date(e.data_evento), tresM));
  const nearMissRecentes = eventosRecentes.filter((e) => e.tipo === "incidente").length;
  const acidentesRecentes = eventosRecentes.filter((e) => e.tipo === "acidente").length;

  // % com causa raiz definida
  const comCausaRaiz = eventos.filter(
    (e) => e.percepcao_causa && e.percepcao_causa.trim().length > 10
  ).length;
  const pctCausaRaiz = eventos.length > 0 ? (comCausaRaiz / eventos.length) * 100 : 0;

  // Score global de cultura (0-100)
  const scoreGlobal = useMemo(() => {
    let s = 0;
    // Relação near miss / acidente (max 40 pts)
    const ratioScore = Math.min((ratioBird / 300) * 40, 40);
    s += ratioScore;
    // % causa raiz definida (max 30 pts)
    s += pctCausaRaiz * 0.3;
    // Frequência de reporte (max 20 pts) — mais eventos registrados = mais cultura
    s += Math.min(nearMissTotal * 2, 20);
    // Sem óbitos (10 pts)
    const obitos = eventos.filter((e) => e.obito).length;
    if (obitos === 0) s += 10;
    return Math.min(Math.round(s), 100);
  }, [ratioBird, pctCausaRaiz, nearMissTotal, eventos]);

  const nivelGlobal = calcularNivel(scoreGlobal);

  // Ranking por setor
  const setores = [...new Set(eventos.map((e) => e.setor).filter(Boolean))] as string[];
  const rankingSetores: SetorScore[] = setores
    .map((setor) => {
      const evtsSetor = eventos.filter((e) => e.setor === setor);
      const nm = evtsSetor.filter((e) => e.tipo === "incidente").length;
      const ac = evtsSetor.filter((e) => e.tipo === "acidente").length;
      const ratio = ac > 0 ? nm / ac : nm * 5; // Near miss sem acidente = bom sinal
      let score = 0;
      score += Math.min((ratio / 30) * 50, 50); // ratio contribui até 50 pts
      score += Math.min(nm * 3, 30); // volume de near miss reportados
      score += ac === 0 ? 20 : Math.max(0, 20 - ac * 4); // penaliza acidentes
      score = Math.min(Math.round(score), 100);
      const nivel = calcularNivel(score);
      return { setor, nearMiss: nm, acidentes: ac, ratio, score, ...nivel };
    })
    .sort((a, b) => b.score - a.score);

  // Top reportadores de near miss (por nome do criado_por)
  const reportadores: Record<string, number> = {};
  eventos
    .filter((e) => e.tipo === "incidente" && e.criado_por_nome)
    .forEach((e) => {
      const nome = e.criado_por_nome!;
      reportadores[nome] = (reportadores[nome] || 0) + 1;
    });
  const topReportadores = Object.entries(reportadores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const nivelColors = {
    bronze: "text-amber-700 bg-amber-50 border-amber-200",
    prata: "text-slate-600 bg-slate-50 border-slate-200",
    ouro: "text-yellow-700 bg-yellow-50 border-yellow-200",
    diamante: "text-blue-600 bg-blue-50 border-blue-200",
  };

  const nivelBarColors = {
    bronze: "bg-amber-500",
    prata: "bg-slate-400",
    ouro: "bg-yellow-500",
    diamante: "bg-blue-500",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-base">Cultura de Segurança</h3>
        <Badge variant="outline" className="text-xs">Gamificação & Engajamento</Badge>
      </div>

      {/* Score Global */}
      <Card className={cn("border-2", nivelColors[nivelGlobal.nivel])}>
        <CardContent className="pt-4 pb-4 px-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Nível Global de Cultura SST</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-5xl">{nivelGlobal.emoji}</span>
                <div>
                  <p className="font-bold text-lg leading-tight">{nivelGlobal.badge}</p>
                  <p className="text-xs text-muted-foreground">Score: {scoreGlobal}/100</p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold tabular-nums">{scoreGlobal}</p>
              <p className="text-xs text-muted-foreground">pontos</p>
            </div>
          </div>
          <div className="w-full h-3 rounded-full bg-muted/50 overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", nivelBarColors[nivelGlobal.nivel])}
              style={{ width: `${scoreGlobal}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>🥉 Bronze (0)</span>
            <span>🥈 Prata (40)</span>
            <span>🥇 Ouro (65)</span>
            <span>💎 Diamante (85)</span>
          </div>
        </CardContent>
      </Card>

      {/* Indicadores de engajamento */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-3 pb-3 px-3 text-center">
            <AlertCircle className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold tabular-nums">{nearMissTotal}</p>
            <p className="text-xs text-muted-foreground">Near Miss reportados</p>
            <Badge variant="outline" className="text-xs mt-1">{nearMissRecentes} nos últ. 3m</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-3 pb-3 px-3 text-center">
            <TrendingUp className="w-5 h-5 text-amber-500 mx-auto mb-1" />
            <p className={cn("text-2xl font-bold tabular-nums", ratioBird >= 300 ? "text-green-600" : ratioBird >= 30 ? "text-amber-600" : "text-destructive")}>
              {ratioBird.toFixed(0)}:1
            </p>
            <p className="text-xs text-muted-foreground">Near miss / Acidente</p>
            <Badge variant="outline" className="text-xs mt-1">Meta Bird: 300:1</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-3 pb-3 px-3 text-center">
            <ShieldCheck className="w-5 h-5 text-green-500 mx-auto mb-1" />
            <p className="text-2xl font-bold tabular-nums">{pctCausaRaiz.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">Com causa raiz</p>
            <Badge variant="outline" className={cn("text-xs mt-1", pctCausaRaiz >= 80 ? "text-green-600" : "text-amber-600")}>
              Meta: 80%
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-3 pb-3 px-3 text-center">
            <Users className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <p className="text-2xl font-bold tabular-nums">{topReportadores.length}</p>
            <p className="text-xs text-muted-foreground">Contribuidores ativos</p>
            <Badge variant="outline" className="text-xs mt-1">Near miss</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Ranking de setores */}
      {rankingSetores.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" />
              Ranking de Cultura por Setor
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {rankingSetores.slice(0, 8).map((s, i) => {
              const cfg = nivelColors[s.nivel];
              const barCfg = nivelBarColors[s.nivel];
              return (
                <div key={s.setor} className="flex items-center gap-3">
                  <span className="text-lg w-7 text-center">{s.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-medium truncate">{s.setor}</span>
                      <div className="flex items-center gap-1.5 ml-2">
                        <span className="text-xs text-muted-foreground tabular-nums">{s.nearMiss} NM / {s.acidentes} AC</span>
                        <Badge variant="outline" className={cn("text-xs", cfg)}>{s.score}pts</Badge>
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-muted/50 overflow-hidden">
                      <div className={cn("h-full rounded-full", barCfg)} style={{ width: `${s.score}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Top Reportadores */}
      {topReportadores.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Award className="w-4 h-4 text-yellow-500" />
              Top Reportadores de Near Miss
              <Badge variant="outline" className="text-xs font-normal">Herois da Prevenção 🦺</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {topReportadores.map(([nome, count], i) => (
              <div key={nome} className={cn("flex items-center gap-3 p-2 rounded-lg", i === 0 ? "bg-yellow-50 border border-yellow-200" : i === 1 ? "bg-slate-50 border border-slate-200" : "border border-border")}>
                <span className="text-xl">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "⭐"}</span>
                <span className="flex-1 text-sm font-medium">{nome}</span>
                <Badge variant={i === 0 ? "default" : "secondary"} className="text-xs tabular-nums">
                  {count} relato{count !== 1 ? "s" : ""}
                </Badge>
              </div>
            ))}
            <p className="text-xs text-muted-foreground pt-1">
              💡 Cada near miss reportado é uma oportunidade de evitar o próximo acidente. Reconheça quem reporta!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Mensagem motivacional */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-3 pb-3 px-4">
          <div className="flex items-start gap-3">
            <Flame className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-primary">
                {ratioBird < 30
                  ? "Ação urgente: a subnotificação de near miss indica que a cultura de segurança precisa ser fortalecida."
                  : ratioBird < 100
                  ? "Bom início! Continue incentivando o reporte de quase-acidentes. A meta é 300:1."
                  : ratioBird < 300
                  ? "Cultura em desenvolvimento. O time está engajado — mantenha o reconhecimento positivo."
                  : "Parabéns! Sua organização demonstra cultura de segurança madura. Seja referência para o setor."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
