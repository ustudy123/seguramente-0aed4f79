import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ShieldAlert, FlaskConical, BarChart3, ShieldCheck, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CampanhaPsicossocial, IPSClassificacao } from "@/types/psicossocial";
import { getIPSColor, getIPSBgColor, MINIMO_ANONIMATO_PADRAO } from "@/types/psicossocial";
import { RiscosPsicossociaisPanel } from "./RiscosPsicossociaisPanel";
import { InstrumentosVisualizacao } from "./InstrumentosVisualizacao";
import { IndicesDerivadosDashboard } from "./IndicesDerivadosDashboard";

const INDICES_INFO = [
  { codigo: 'IPS', nome: 'Índice Psicossocial YourEyes', desc: 'Score geral do ambiente organizacional (0-100). É o termômetro principal da saúde psicossocial da empresa.', color: 'bg-purple-100 text-purple-600', destaque: true },
  { codigo: 'IRP-S', nome: 'Risco Psicossocial', desc: 'Mede a exposição da equipe a fatores de risco como sobrecarga, conflito e falta de suporte.', color: 'bg-red-100 text-red-600', destaque: false },
  { codigo: 'IBO-S', nome: 'Burnout', desc: 'Detecta indícios de esgotamento profissional: exaustão emocional, despersonalização e baixa realização.', color: 'bg-orange-100 text-orange-600', destaque: false },
  { codigo: 'IBD-S', nome: 'Boreout', desc: 'Identifica falta de desafio e engajamento. Tão prejudicial quanto o Burnout para turnover e produtividade.', color: 'bg-slate-100 text-slate-600', destaque: false },
  { codigo: 'IREC-S', nome: 'Recuperação', desc: 'Avalia a capacidade dos colaboradores de se recuperarem fora do horário de trabalho.', color: 'bg-blue-100 text-blue-600', destaque: false },
  { codigo: 'ICOP-S', nome: 'Clareza Organizacional', desc: 'Mede se os colaboradores entendem claramente seus papéis, expectativas e direcionamento da empresa.', color: 'bg-emerald-100 text-emerald-600', destaque: false },
  { codigo: 'INOT-S', nome: 'Trabalho Noturno', desc: 'Avalia riscos específicos de equipes que trabalham no 3º turno ou em horários noturnos.', color: 'bg-indigo-100 text-indigo-600', destaque: false },
];

const IPS_FAIXAS = [
  { range: '80-100', label: 'Ambiente Saudável', acao: 'Manutenção e reconhecimento', cls: 'saudavel' as IPSClassificacao },
  { range: '65-79', label: 'Ambiente Estável', acao: 'Melhorias pontuais', cls: 'estavel' as IPSClassificacao },
  { range: '50-64', label: 'Atenção', acao: 'Monitoramento intensificado', cls: 'atencao' as IPSClassificacao },
  { range: '35-49', label: 'Risco Psicossocial', acao: 'Ações corretivas prioritárias', cls: 'risco' as IPSClassificacao },
  { range: '0-34', label: 'Risco Crítico', acao: 'Intervenção urgente NR-01', cls: 'critico' as IPSClassificacao },
];

const SUB_TABS = ["riscos", "instrumentos", "indices"] as const;
type SubTab = typeof SUB_TABS[number];

interface Props {
  campanhas: CampanhaPsicossocial[];
}

/**
 * Agrupa, sob "Metodologia", as três telas de referência metodológica
 * (Fatores de Riscos, Instrumentos e Índices) em sub-abas internas.
 * A sub-aba ativa é sincronizada com ?sub= para deep-link.
 */
export function MetodologiaPanel({ campanhas }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();

  const subAtiva: SubTab = useMemo(() => {
    const s = searchParams.get("sub");
    return (SUB_TABS.includes(s as SubTab) ? s : "riscos") as SubTab;
  }, [searchParams]);

  const handleSubChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", "metodologia");
    next.set("sub", value);
    setSearchParams(next, { replace: false });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-primary" />
          Metodologia
        </h2>
        <p className="text-sm text-muted-foreground">
          Base técnica da avaliação psicossocial — fatores de risco avaliados, instrumentos aplicados e índices derivados (NR-01 · ISO 45003 · COPSOQ III).
        </p>
      </div>

      <Tabs value={subAtiva} onValueChange={handleSubChange}>
        <TabsList className="grid w-full grid-cols-3 max-w-xl">
          <TabsTrigger value="riscos" className="gap-2">
            <ShieldAlert className="h-4 w-4" />
            <span className="hidden sm:inline">Fatores de Riscos</span>
            <span className="sm:hidden">Riscos</span>
          </TabsTrigger>
          <TabsTrigger value="instrumentos" className="gap-2">
            <FlaskConical className="h-4 w-4" />
            Instrumentos
          </TabsTrigger>
          <TabsTrigger value="indices" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Índices
          </TabsTrigger>
        </TabsList>

        <TabsContent value="riscos" className="mt-4">
          <RiscosPsicossociaisPanel />
        </TabsContent>

        <TabsContent value="instrumentos" className="mt-4">
          <InstrumentosVisualizacao />
        </TabsContent>

        <TabsContent value="indices" className="mt-4 space-y-4">
          <Card className="border-blue-200 bg-blue-50/40">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-blue-100">
                  <ShieldCheck className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">🔒 Regra de Anonimato Estatístico</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Os resultados só são apresentados quando houver <strong>mínimo de {MINIMO_ANONIMATO_PADRAO} respostas</strong> por questionário (ou 1 por entrevista guiada).
                    Com menos que o mínimo, a análise permanece bloqueada para garantir o anonimato estatístico (ISO 45003).
                    Em empresas pequenas, o sistema agrupa dados por Setor → Empresa automaticamente.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-purple-600" />
                O que cada índice significa?
              </CardTitle>
              <CardDescription>Passe o mouse sobre o ícone ℹ️ para entender cada índice</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {INDICES_INFO.map(({ codigo, nome, desc, color, destaque }) => (
                  <div key={codigo} className={cn("p-4 rounded-lg border", destaque && "border-purple-200 bg-purple-50/30")}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn("px-2 py-0.5 rounded text-xs font-bold", color)}>{codigo}</div>
                      {destaque && <Badge className="bg-purple-600 text-xs">Principal</Badge>}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground/50 cursor-help ml-auto" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs">{desc}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="font-medium text-sm">{nome}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Como interpretar o IPS?</CardTitle>
              <CardDescription>Cada faixa define um nível de ação necessário</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-5">
                {IPS_FAIXAS.map(({ range, label, acao, cls }) => (
                  <div key={range} className={cn("p-3 rounded-lg text-center space-y-1", getIPSBgColor(cls))}>
                    <p className={cn("text-lg font-bold", getIPSColor(cls))}>{range}</p>
                    <p className={cn("text-xs font-semibold", getIPSColor(cls))}>{label}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">{acao}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <IndicesDerivadosDashboard campanhas={campanhas} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
