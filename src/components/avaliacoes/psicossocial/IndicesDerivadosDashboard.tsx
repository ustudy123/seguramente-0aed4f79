import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ShieldAlert,
  Moon,
  Flame,
  Battery,
  Eye,
  BrainCircuit,
  Lock,
  TrendingDown,
  TrendingUp,
  Minus,
  Filter,
  Info,
  HelpCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { CampanhaPsicossocial } from "@/types/psicossocial";

const MINIMO_ANONIMATO = 5;

interface IndiceConfig {
  codigo: string;
  nome: string;
  nomeCompleto: string;
  descricao: string;
  oQueMede: string;
  comoLer: string;
  baseNorma: string;
  exemplos: string[];
  icon: React.ElementType;
  /** Campo no objeto campanha */
  campo: keyof CampanhaPsicossocial;
  /** true = escala de risco (maior = pior), false = escala de proteção (maior = melhor) */
  invertido: boolean;
}

const INDICES: IndiceConfig[] = [
  {
    codigo: "IRP-S",
    nome: "Risco Psicossocial",
    nomeCompleto: "Índice de Risco Psicossocial — SIPRO",
    descricao: "Exposição geral a fatores de risco",
    oQueMede:
      "Resumo único da exposição da equipe a fatores psicossociais (demanda, controle, suporte, reconhecimento, conflito, equilíbrio). É o 'IPS invertido': quanto mais alto, pior.",
    comoLer:
      "0–24 favorável · 25–49 atenção · 50–74 moderado · 75–100 elevado. Acima de 50 já indica que medidas de controle precisam entrar no PGR (NR-1).",
    baseNorma: "NR-01 (GRO/PGR) · ISO 45003 · COPSOQ III",
    exemplos: [
      "Triagem geral do clima de risco da unidade",
      "Comparar setores ou turnos",
      "Acompanhar evolução entre campanhas",
    ],
    icon: ShieldAlert,
    campo: "irps_score",
    invertido: true,
  },
  {
    codigo: "IBO-S",
    nome: "Burnout",
    nomeCompleto: "Índice de Burnout — Esgotamento Profissional",
    descricao: "Esgotamento emocional e exaustão pelo trabalho",
    oQueMede:
      "Sinais de exaustão emocional, sensação de estar esgotado pela manhã, cansaço crônico ligado ao trabalho — combina demanda emocional alta + baixa recuperação.",
    comoLer:
      "Elevado (≥75) sugere afastamentos prováveis, queda de produtividade e risco de CAT por transtorno mental relacionado ao trabalho (CID F43).",
    baseNorma: "CID-11 QD85 · ISO 45003 · NR-01",
    exemplos: [
      "Equipes com pico sazonal (fechamento, safra)",
      "Áreas de atendimento e cuidado (saúde, call center)",
      "Times com liderança sob pressão",
    ],
    icon: Flame,
    campo: "ibo_score",
    invertido: true,
  },
  {
    codigo: "IBD-S",
    nome: "Boreout",
    nomeCompleto: "Índice de Boreout — Tédio e Subcarga",
    descricao: "Desengajamento por subcarga e falta de sentido",
    oQueMede:
      "O oposto do burnout: tédio crônico, subutilização de competências, falta de desafio e de sentido. Gera presenteísmo, erros e turnover silencioso.",
    comoLer:
      "Elevado (≥75) indica funções mal desenhadas, baixa autonomia ou alocação errada — atue revendo escopo, metas e rotação de tarefas.",
    baseNorma: "ISO 45003 (carga inadequada) · NR-17",
    exemplos: [
      "Cargo sem desafio para o nível de senioridade",
      "Tarefas repetitivas sem propósito comunicado",
      "Pessoas 'esquecidas' em áreas de baixa demanda",
    ],
    icon: Battery,
    campo: "ibd_score",
    invertido: true,
  },
  {
    codigo: "IREC-S",
    nome: "Recuperação",
    nomeCompleto: "Índice de Recuperação Pós-Trabalho",
    descricao: "Capacidade de desligar e descansar fora do trabalho",
    oQueMede:
      "Mede se o trabalhador consegue 'desligar' nos intervalos, no fim do dia e nas folgas. Baixa recuperação acumula fadiga e antecipa burnout.",
    comoLer:
      "Elevado (≥75) = baixa recuperação. Verifique jornada, hiperconexão (e-mails fora do expediente), insônia e DSR (descanso semanal remunerado).",
    baseNorma: "CLT art. 66/67 · ISO 45003 · NR-17",
    exemplos: [
      "Times com comunicação 24/7",
      "Plantões e escalas 12x36",
      "Lideranças que não tiram férias",
    ],
    icon: Eye,
    campo: "irec_score",
    invertido: true,
  },
  {
    codigo: "ICOP-S",
    nome: "Clareza Organizacional",
    nomeCompleto: "Índice de Clareza Organizacional e de Papéis",
    descricao: "Clareza de papéis, metas e direcionamento",
    oQueMede:
      "Mede o quanto a pessoa entende o que se espera dela, quais as prioridades, a quem reportar e como será avaliada. Ambiguidade gera estresse e conflito.",
    comoLer:
      "Elevado (≥75) = papéis confusos. Atue com Manual de Função, OS NR-1, descrição de cargo, reuniões 1:1 e metas SMART.",
    baseNorma: "NR-01 (informação ao trabalhador) · ISO 45003",
    exemplos: [
      "Reestruturações recentes sem comunicação",
      "Vários líderes pedindo coisas conflitantes",
      "Cargos novos sem descrição formal",
    ],
    icon: BrainCircuit,
    campo: "icop_score",
    invertido: true,
  },
  {
    codigo: "INOT-S",
    nome: "Trabalho Noturno",
    nomeCompleto: "Índice de Risco do Trabalho Noturno / 3º Turno",
    descricao: "Risco específico do trabalho noturno e turnos rotativos",
    oQueMede:
      "Risco adicional ligado a turnos noturnos e rotativos: privação de sono, desregulação do ciclo circadiano, isolamento social e maior risco metabólico/cardiovascular.",
    comoLer:
      "Só aparece quando há respondentes em jornada noturna. Elevado exige PCMSO específico, pausas e revisão de escala (CLT art. 73).",
    baseNorma: "CLT art. 73 · NR-15 Anexo · ISO 45003",
    exemplos: [
      "Operação industrial 24h",
      "Hospitais e segurança patrimonial",
      "Logística e transporte de carga",
    ],
    icon: Moon,
    campo: "inot_score",
    invertido: true,
  },
];

type Semaforo = "saudavel" | "atencao" | "moderado" | "elevado";

function classificar(score: number): Semaforo {
  if (score <= 24) return "saudavel";
  if (score <= 49) return "atencao";
  if (score <= 74) return "moderado";
  return "elevado";
}

const SEMAFORO_CONFIG: Record<Semaforo, { label: string; bg: string; text: string; dot: string }> = {
  saudavel: { label: "Favorável", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  atencao:  { label: "Atenção",   bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-500"   },
  moderado: { label: "Moderado",  bg: "bg-orange-50",  text: "text-orange-700",  dot: "bg-orange-500"  },
  elevado:  { label: "Elevado",   bg: "bg-red-50",     text: "text-red-700",     dot: "bg-red-500"     },
};

interface Props {
  campanhas: CampanhaPsicossocial[];
}

export function IndicesDerivadosDashboard({ campanhas }: Props) {
  const [filtroCampanha, setFiltroCampanha] = useState<string>(campanhas.length === 1 ? campanhas[0].id : "recente");

  useEffect(() => {
    if (campanhas.length === 1) {
      setFiltroCampanha(campanhas[0].id);
    } else if (filtroCampanha !== "recente" && !campanhas.some(c => c.id === filtroCampanha)) {
      setFiltroCampanha("recente");
    }
  }, [campanhas, filtroCampanha]);

  const validas = useMemo(() => {
    return campanhas.filter(
      (c) => (c.total_respostas || 0) >= MINIMO_ANONIMATO
    ).sort((a, b) => new Date(b.data_fim || b.created_at).getTime() - new Date(a.data_fim || a.created_at).getTime());
  }, [campanhas]);

  const dados = useMemo(() => {
    if (validas.length === 0) return null;

    let atual: CampanhaPsicossocial;
    let anterior: CampanhaPsicossocial | null = null;

    if (filtroCampanha === "recente") {
      // Priorizar campanhas encerradas, senão pegar a mais recente
      const encerradas = validas.filter(c => c.status === "encerrada");
      atual = encerradas.length > 0 ? encerradas[0] : validas[0];
      
      const indexAtual = validas.findIndex(c => c.id === atual.id);
      anterior = validas.length > indexAtual + 1 ? validas[indexAtual + 1] : null;
    } else {
      atual = validas.find(c => c.id === filtroCampanha) || validas[0];
      const indexAtual = validas.findIndex(c => c.id === atual.id);
      anterior = validas.length > indexAtual + 1 ? validas[indexAtual + 1] : null;
    }

    return INDICES.map((idx) => {
      const rawAtual = (atual[idx.campo] as number | null) ?? null;
      const rawAnterior = anterior ? ((anterior[idx.campo] as number | null) ?? null) : null;

      // Os scores no banco são PROTETIVOS (alto = saudável). Para os cards que
      // exibem escala de RISCO (invertido = true), convertemos: risco = 100 - score.
      const scoreAtual = rawAtual != null && idx.invertido ? Math.max(0, 100 - rawAtual) : rawAtual;
      const scoreAnterior = rawAnterior != null && idx.invertido ? Math.max(0, 100 - rawAnterior) : rawAnterior;

      let tendencia: "up" | "down" | "stable" | null = null;
      if (scoreAtual != null && scoreAnterior != null) {
        const diff = scoreAtual - scoreAnterior;
        if (Math.abs(diff) < 3) tendencia = "stable";
        else if (idx.invertido) {
          // Escala de risco: subiu = piorou, desceu = melhorou
          tendencia = diff > 0 ? "up" : "down";
        } else {
          tendencia = diff > 0 ? "down" : "up";
        }
      }

      return {
        ...idx,
        score: scoreAtual,
        scoreAnterior,
        classificacao: scoreAtual != null ? classificar(scoreAtual) : null,
        tendencia,
      };
    });
  }, [campanhas, validas, filtroCampanha]);

  if (!dados) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
          <div className="p-3 rounded-full bg-muted">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Os índices derivados serão exibidos após a primeira campanha encerrada com mín. {MINIMO_ANONIMATO} respostas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-purple-600" />
          <h3 className="font-semibold text-base">Índices Derivados SIPRO</h3>
          <Badge variant="outline" className="text-xs">
            {filtroCampanha === "recente" ? "Última campanha analisada" : "Campanha selecionada"}
          </Badge>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="O que são os índices derivados"
                className="inline-flex items-center justify-center rounded-full p-1 text-muted-foreground hover:text-purple-700 hover:bg-purple-50 transition-colors"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[360px] text-sm" align="start">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-purple-600" />
                  <p className="font-semibold">O que são os Índices Derivados SIPRO?</p>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  São <strong>6 indicadores secundários</strong> calculados a partir das respostas do
                  questionário psicossocial. Cada um mede uma <strong>dimensão específica de risco</strong>
                  {" "}(burnout, boreout, recuperação, clareza, trabalho noturno) e o <strong>IRP-S</strong>{" "}
                  consolida tudo em um número único.
                </p>
                <div className="rounded-md bg-muted/50 p-2 text-xs space-y-1">
                  <p className="font-medium">Escala de risco (0–100):</p>
                  <p>· <span className="text-emerald-700 font-medium">0–24 Favorável</span> — situação saudável</p>
                  <p>· <span className="text-amber-700 font-medium">25–49 Atenção</span> — monitorar</p>
                  <p>· <span className="text-orange-700 font-medium">50–74 Moderado</span> — entrar no PGR</p>
                  <p>· <span className="text-red-700 font-medium">75–100 Elevado</span> — ação prioritária</p>
                </div>
                <p className="text-xs text-muted-foreground italic">
                  Clique no <HelpCircle className="inline h-3 w-3" /> de cada card para ver
                  o que ele mede, como ler e exemplos práticos.
                </p>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {validas.length > 0 && (
          <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-md border border-purple-100">
            <Filter className="h-3 w-3 text-muted-foreground ml-1" />
            <Select value={filtroCampanha} onValueChange={setFiltroCampanha}>
              <SelectTrigger className="w-[180px] h-7 text-[10px] border-none bg-transparent focus:ring-0">
                <SelectValue placeholder="Escolher Campanha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recente">Mais Recente</SelectItem>
                {validas.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {dados.map((item, i) => {
          const Icon = item.icon;
          const sem = item.classificacao ? SEMAFORO_CONFIG[item.classificacao] : null;

          return (
            <motion.div
              key={item.codigo}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <Card className={cn(
                "relative overflow-hidden transition-shadow hover:shadow-md",
                sem?.bg || "bg-muted/30"
              )}>
                <CardHeader className="pb-1 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className={cn("text-xs font-bold", sem?.text)}>
                      {item.codigo}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Icon className={cn("h-4 w-4", sem?.text || "text-muted-foreground")} />
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Saiba mais sobre ${item.codigo}`}
                            className="inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground/70 hover:text-foreground hover:bg-background/60 transition-colors"
                          >
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[340px] text-sm" align="end">
                          <div className="space-y-2.5">
                            <div>
                              <p className="font-semibold leading-tight">{item.nomeCompleto}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">{item.baseNorma}</p>
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">O que mede</p>
                              <p className="text-xs leading-relaxed mt-0.5">{item.oQueMede}</p>
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Como ler</p>
                              <p className="text-xs leading-relaxed mt-0.5">{item.comoLer}</p>
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Quando aparece elevado</p>
                              <ul className="text-xs leading-relaxed mt-0.5 space-y-0.5 list-disc pl-4 text-muted-foreground">
                                {item.exemplos.map((e, idx) => <li key={idx}>{e}</li>)}
                              </ul>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-1">
                  {item.score != null ? (
                    <>
                      <div className="flex items-end gap-1.5">
                        <span className={cn("text-3xl font-bold tabular-nums", sem?.text)}>
                          {Math.round(item.score)}
                        </span>
                        <span className="text-xs text-muted-foreground mb-1">/100</span>
                      </div>

                      <div className="flex items-center gap-1.5 mt-1.5">
                        <div className={cn("h-2 w-2 rounded-full", sem?.dot)} />
                        <span className={cn("text-xs font-medium", sem?.text)}>
                          {sem?.label}
                        </span>

                        {item.tendencia && (
                          <span className="ml-auto flex items-center gap-0.5 text-xs text-muted-foreground">
                            {item.tendencia === "up" && (
                              <TrendingUp className="h-3 w-3 text-red-500" />
                            )}
                            {item.tendencia === "down" && (
                              <TrendingDown className="h-3 w-3 text-emerald-500" />
                            )}
                            {item.tendencia === "stable" && (
                              <Minus className="h-3 w-3 text-muted-foreground" />
                            )}
                          </span>
                        )}
                      </div>

                      {/* Barra visual */}
                      <div className="mt-2 h-1.5 w-full rounded-full bg-background/60">
                        <div
                          className={cn("h-full rounded-full transition-all", sem?.dot)}
                          style={{ width: `${Math.min(item.score, 100)}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">Sem dados</p>
                  )}

                  <p className="text-[11px] text-muted-foreground mt-2 leading-tight">
                    {item.descricao}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="font-medium">Escala de risco:</span>
        {Object.entries(SEMAFORO_CONFIG).map(([key, cfg]) => (
          <span key={key} className="flex items-center gap-1">
            <div className={cn("h-2 w-2 rounded-full", cfg.dot)} />
            {cfg.label}
          </span>
        ))}
        <span className="ml-auto flex items-center gap-2">
          <TrendingDown className="h-3 w-3 text-emerald-500" /> Melhorou
          <TrendingUp className="h-3 w-3 text-red-500" /> Piorou
        </span>
      </div>
    </div>
  );
}
