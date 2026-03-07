import { useState } from "react";
import { motion } from "framer-motion";
import {
  Flame, Battery, Sparkles, CheckCircle2, AlertTriangle,
  Brain, Users, Clock, Heart, Target, RotateCcw, HelpCircle,
  Meh, TrendingDown, MessageSquareWarning, Zap, ExternalLink
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

// ────────── tipos ──────────
type NivelRisco = 'baixo' | 'moderado' | 'alto' | 'critico';

interface FatorRisco {
  key: string;
  label: string;
  valor: number;
  descricao: string;
  icon: React.ElementType;
}

// ────────── configuração de nível ──────────
const NIVEL_CONFIG: Record<NivelRisco, { color: string; bgColor: string; borderColor: string; label: string; icon: string; badgeClass: string }> = {
  baixo:    { color: 'text-success',       bgColor: 'bg-success/10',       borderColor: 'border-success/40',       label: 'Baixo Risco',    icon: '✓',  badgeClass: 'bg-success/10 text-success border-success/30' },
  moderado: { color: 'text-warning',       bgColor: 'bg-warning/10',       borderColor: 'border-warning/40',       label: 'Atenção',        icon: '⚠',  badgeClass: 'bg-warning/10 text-warning border-warning/30' },
  alto:     { color: 'text-orange-500',    bgColor: 'bg-orange-500/10',    borderColor: 'border-orange-500/40',    label: 'Alto Risco',     icon: '🔥', badgeClass: 'bg-orange-500/10 text-orange-500 border-orange-500/30' },
  critico:  { color: 'text-destructive',   bgColor: 'bg-destructive/10',   borderColor: 'border-destructive/40',   label: 'Crítico',        icon: '🚨', badgeClass: 'bg-destructive/10 text-destructive border-destructive/30' },
};

// ────────── calcular nível a partir do score ──────────
function calcularNivel(score: number): NivelRisco {
  if (score < 25) return 'baixo';
  if (score < 50) return 'moderado';
  if (score < 75) return 'alto';
  return 'critico';
}

// ────────── dados de BURNOUT ──────────
const FATORES_BURNOUT: FatorRisco[] = [
  { key: 'sobrecargaCognitiva', label: 'Sobrecarga Cognitiva',    valor: 62, descricao: 'Excesso de tarefas e demandas mentais intensas',                    icon: Brain },
  { key: 'ritmoTrabalho',       label: 'Ritmo de Trabalho',       valor: 71, descricao: 'Pressão por velocidade e volume de produção',                         icon: Clock },
  { key: 'faltaPausas',         label: 'Falta de Pausas',         valor: 55, descricao: 'Ausência de intervalos adequados para recuperação',                   icon: AlertTriangle },
  { key: 'humorNegativo',       label: 'Humor Negativo',          valor: 44, descricao: 'Irritabilidade, negatividade e desgaste emocional',                   icon: TrendingDown },
  { key: 'denuncias',           label: 'Denúncias/Ocorrências',   valor: 30, descricao: 'Relatos de conflitos, pressão indevida ou ambiente hostil',            icon: MessageSquareWarning },
  { key: 'exigenciasEmocionais',label: 'Exigências Emocionais',   valor: 68, descricao: 'Necessidade de suprimir emoções no exercício das funções',            icon: Heart },
];

// ────────── dados de BOREOUT ──────────
const FATORES_BOREOUT: FatorRisco[] = [
  { key: 'baixoDesafio',   label: 'Baixo Desafio',          valor: 75, descricao: 'Tarefas excessivamente simples e sem estímulo intelectual',              icon: Target },
  { key: 'repetitividade', label: 'Repetitividade',         valor: 80, descricao: 'Ciclos repetitivos e monotonia nas atividades diárias',                  icon: RotateCcw },
  { key: 'faltaSentido',   label: 'Falta de Sentido',       valor: 60, descricao: 'Percepção de que o trabalho não tem propósito ou impacto',               icon: HelpCircle },
  { key: 'apatia',         label: 'Apatia Emocional',       valor: 55, descricao: 'Perda de entusiasmo, envolvimento e motivação com o trabalho',           icon: Meh },
  { key: 'desconexao',     label: 'Desconexão com Equipe',  valor: 48, descricao: 'Isolamento e falta de pertencimento ao grupo',                           icon: Users },
];

const SCORE_BURNOUT = Math.round(FATORES_BURNOUT.reduce((s, f) => s + f.valor, 0) / FATORES_BURNOUT.length);
const SCORE_BOREOUT = Math.round(FATORES_BOREOUT.reduce((s, f) => s + f.valor, 0) / FATORES_BOREOUT.length);

// ────────── componente de barra de fator ──────────
function FatorBar({ fator }: { fator: FatorRisco }) {
  const { valor } = fator;
  const Icon = fator.icon;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div>
            <span className="font-medium text-foreground">{fator.label}</span>
            <p className="text-xs text-muted-foreground leading-tight">{fator.descricao}</p>
          </div>
        </div>
        <span className={cn(
          "text-sm font-bold shrink-0 ml-3",
          valor >= 70 ? "text-destructive" : valor >= 45 ? "text-warning" : "text-success"
        )}>
          {valor}%
        </span>
      </div>
      <Progress
        value={valor}
        className={cn(
          "h-2",
          valor >= 70 ? "[&>div]:bg-destructive" :
          valor >= 45 ? "[&>div]:bg-warning" :
          "[&>div]:bg-success"
        )}
      />
    </div>
  );
}

// ────────── painel de radar individual ──────────
interface RadarPanelProps {
  tipo: 'burnout' | 'boreout';
  score: number;
  nivel: NivelRisco;
  fatores: FatorRisco[];
  onGerarAcao: (tipo: 'burnout' | 'boreout', fatores: FatorRisco[], score: number, nivel: NivelRisco) => void;
  gerando: boolean;
}

function RadarPanel({ tipo, score, nivel, fatores, onGerarAcao, gerando }: RadarPanelProps) {
  const config = NIVEL_CONFIG[nivel];
  const isBurnout = tipo === 'burnout';
  const TipoIcon = isBurnout ? Flame : Battery;
  const titulo = isBurnout ? 'Radar de Burnout' : 'Radar de Boreout';
  const subtitulo = isBurnout
    ? 'Índice de Risco de Esgotamento Profissional'
    : 'Índice de Subcarga / Desengajamento';
  const dica: Record<NivelRisco, string> = isBurnout ? {
    critico:  'Ação imediata necessária. Revise carga, pausas e suporte emocional.',
    alto:     'Fatores de risco elevados. Intervenção recomendada a curto prazo.',
    moderado: 'Monitorar indicadores e promover pausas regulares e autonomia.',
    baixo:    'Ambiente saudável. Manter boas práticas preventivas.',
  } : {
    critico:  'Colaboradores em esgotamento por subcarga. Redesenhe funções urgentemente.',
    alto:     'Sinais claros de desengajamento. Considere rodízio e novos desafios.',
    moderado: 'Atenção à monotonia. Promova projetos e participação em decisões.',
    baixo:    'Equipe engajada. Continue promovendo desenvolvimento.',
  };

  const fatoresCriticos = fatores.filter(f => f.valor >= 70);
  const fatoresAtencao = fatores.filter(f => f.valor >= 45 && f.valor < 70);

  return (
    <Card className={cn("border-2 flex flex-col", config.borderColor)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <TipoIcon className={cn("h-5 w-5", config.color)} />
            {titulo}
          </CardTitle>
          <Badge className={cn("text-xs border", config.badgeClass)}>
            {config.icon} {config.label}
          </Badge>
        </div>
        <CardDescription>{subtitulo}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5 flex-1">
        {/* Score circular */}
        <div className="flex items-center gap-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
            className={cn(
              "flex items-center justify-center w-20 h-20 rounded-full border-4 shrink-0",
              config.borderColor, config.bgColor
            )}
          >
            <span className={cn("text-2xl font-bold", config.color)}>{score}%</span>
          </motion.div>

          <div className="flex-1 space-y-1.5">
            {fatoresCriticos.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span><strong>{fatoresCriticos.length}</strong> fator(es) crítico(s) detectado(s)</span>
              </div>
            )}
            {fatoresAtencao.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-warning">
                <Zap className="h-3.5 w-3.5 shrink-0" />
                <span><strong>{fatoresAtencao.length}</strong> fator(es) em atenção</span>
              </div>
            )}
            {nivel === 'baixo' && (
              <div className="flex items-center gap-1.5 text-xs text-success">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>Todos os indicadores saudáveis</span>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Fatores */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Fatores Avaliados ({fatores.length} critérios)
          </p>
          {fatores.map(fator => (
            <FatorBar key={fator.key} fator={fator} />
          ))}
        </div>

        <Separator />

        {/* Dica de nível */}
        <div className={cn("p-3 rounded-lg text-sm flex items-start gap-2", config.bgColor)}>
          <TipoIcon className={cn("h-4 w-4 shrink-0 mt-0.5", config.color)} />
          <p className={cn("font-medium leading-relaxed", config.color)}>{dica[nivel]}</p>
        </div>

        {/* Botão gerar ação IA */}
        <Button
          className="w-full gap-2"
          variant={nivel === 'baixo' ? 'outline' : 'default'}
          disabled={gerando}
          onClick={() => onGerarAcao(tipo, fatores, score, nivel)}
        >
          {gerando ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Gerando ação com IA…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Gerar Ação Preventiva com IA
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// ────────── componente principal ──────────
export function RadaresPsicossocialSection() {
  const { tenantId, user, profile } = useAuth();
  const navigate = useNavigate();
  const [gerandoBurnout, setGerandoBurnout] = useState(false);
  const [gerandoBoreout, setGerandoBoreout] = useState(false);
  const [acoesCriadas, setAcoesCriadas] = useState<string[]>([]);

  const nivelBurnout = calcularNivel(SCORE_BURNOUT);
  const nivelBoreout = calcularNivel(SCORE_BOREOUT);

  const handleGerarAcao = async (
    tipo: 'burnout' | 'boreout',
    fatores: FatorRisco[],
    score: number,
    nivel: NivelRisco
  ) => {
    if (!tenantId) return;
    const setGerando = tipo === 'burnout' ? setGerandoBurnout : setGerandoBoreout;
    setGerando(true);

    try {
      const fatoresCriticos = fatores.filter(f => f.valor >= 70).map(f => f.label);
      const fatoresAtencao = fatores.filter(f => f.valor >= 45 && f.valor < 70).map(f => f.label);

      const { data, error } = await supabase.functions.invoke('ai-psicossocial-analise', {
        body: {
          contexto: {
            campanha: `Diagnóstico Psicossocial — ${tipo === 'burnout' ? 'Burnout' : 'Boreout'}`,
            instrumento: tipo === 'burnout' ? 'burnout' : 'boreout',
            ips: 100 - score,
            classificacao: nivel === 'baixo' ? 'saudavel' : nivel === 'moderado' ? 'atencao' : nivel === 'alto' ? 'risco' : 'critico',
            dimensoes_criticas: fatoresCriticos,
            dimensoes_atencao: fatoresAtencao,
            tipo_radar: tipo,
            score_risco: score,
          },
          modo: 'plano_acao',
        },
      });

      if (error) throw error;

      const sugestao = data?.sugestao_acao;

      const prioridade = score >= 75 ? 'imediato' : score >= 50 ? 'urgente' : score >= 25 ? 'medio' : 'baixo';
      const tipoAcao = tipo === 'burnout' ? 'preventiva' : 'melhoria';

      const { data: acaoCreated, error: errAcao } = await supabase.from('plano_acoes').insert({
        tenant_id: tenantId,
        titulo: sugestao?.titulo || `Ação ${tipo === 'burnout' ? 'Burnout' : 'Boreout'} — Score ${score}%`,
        descricao: sugestao?.descricao || `Ação gerada a partir do diagnóstico de ${tipo} com score de risco ${score}%.`,
        porque: sugestao?.porque || `Score de ${tipo} em ${score}% — Nível: ${nivel}. Fatores críticos: ${fatoresCriticos.join(', ') || 'nenhum'}.`,
        onde: sugestao?.onde || 'Organização / Setores identificados',
        como: sugestao?.como || `Implementar ações específicas para reduzir os fatores de risco de ${tipo}.`,
        tipo: tipoAcao as any,
        prioridade: prioridade as any,
        origem_modulo: 'manual' as const,
        origem_descricao: `Radar ${tipo === 'burnout' ? 'Burnout' : 'Boreout'} — Psicossocial NR-01`,
        criado_por: user?.id,
        criado_por_nome: profile?.nome_completo || 'Sistema',
        exige_evidencia: false,
        codigo: '',
        progresso: 0,
        status: 'pendente' as const,
        tempo_gasto_minutos: 0,
      }).select('id').single();

      if (errAcao) throw errAcao;

      if (acaoCreated?.id) {
        setAcoesCriadas(prev => [...prev, acaoCreated.id]);
      }

      toast.success(`Ação de ${tipo === 'burnout' ? 'Burnout' : 'Boreout'} criada no Plano de Ação! 🎯`, {
        action: {
          label: 'Ver ações',
          onClick: () => navigate('/plano-acao'),
        },
      });
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao gerar ação: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho informativo */}
      <Card className="border-purple-200 bg-gradient-to-br from-purple-50/40 to-background">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-purple-100 shrink-0">
              <Brain className="h-5 w-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Diagnóstico de Burnout & Boreout</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Radares calculados a partir das respostas da campanha psicossocial mais recente.
                Os fatores abaixo são os critérios avaliados em cada dimensão.
                Use a IA para gerar ações preventivas integradas ao Plano de Ação.
              </p>
            </div>
            {acoesCriadas.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs shrink-0"
                onClick={() => navigate('/plano-acao')}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {acoesCriadas.length} ação(ões) criada(s)
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Legenda de cores */}
      <div className="flex flex-wrap gap-3">
        {[
          { nivel: 'baixo' as NivelRisco,    range: '0–24%',   label: 'Saudável' },
          { nivel: 'moderado' as NivelRisco, range: '25–49%',  label: 'Atenção' },
          { nivel: 'alto' as NivelRisco,     range: '50–74%',  label: 'Alto Risco' },
          { nivel: 'critico' as NivelRisco,  range: '75–100%', label: 'Crítico' },
        ].map(({ nivel, range, label }) => {
          const c = NIVEL_CONFIG[nivel];
          return (
            <div key={nivel} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border", c.badgeClass)}>
              <span>{c.icon}</span>
              <span>{range} — {label}</span>
            </div>
          );
        })}
      </div>

      {/* Grid de radares */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RadarPanel
          tipo="burnout"
          score={SCORE_BURNOUT}
          nivel={nivelBurnout}
          fatores={FATORES_BURNOUT}
          onGerarAcao={handleGerarAcao}
          gerando={gerandoBurnout}
        />
        <RadarPanel
          tipo="boreout"
          score={SCORE_BOREOUT}
          nivel={nivelBoreout}
          fatores={FATORES_BOREOUT}
          onGerarAcao={handleGerarAcao}
          gerando={gerandoBoreout}
        />
      </div>

      {/* Nota técnica */}
      <Card className="border-muted bg-muted/20">
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">
            <strong>Metodologia:</strong> Os scores de Burnout e Boreout são derivados das dimensões IBO-S e IBD-S do instrumento SIPRO
            (Índice Seguramente de Risco Psicossocial Organizacional). Os critérios avaliados incluem fatores ocupacionais,
            organizacionais e individuais conforme ISO 45003, NR-01 e NR-17. Disponível quando houver mínimo de 5 respostas na campanha.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
