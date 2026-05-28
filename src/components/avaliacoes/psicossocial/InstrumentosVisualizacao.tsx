import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  ChevronDown,
  ChevronUp,
  Shield,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Hash,
  Layers,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { COPSOQ_DIMENSOES, COPSOQ_TOTAL_PERGUNTAS, COPSOQ2BR_DIMENSOES, COPSOQ2BR_TOTAL_PERGUNTAS, HSE_DIMENSOES, HSE_TOTAL_PERGUNTAS, PROART_DIMENSOES, PROART_TOTAL_PERGUNTAS, SIPRO_DIMENSOES, SIPRO_TOTAL_PERGUNTAS } from "@/data/instrumentos";

function NormaBadge({ norma }: { norma: string }) {
  const colors: Record<string, string> = {
    'NR-01': 'bg-blue-100 text-blue-700 border-blue-200',
    'NR-17': 'bg-purple-100 text-purple-700 border-purple-200',
    'NR-35': 'bg-orange-100 text-orange-700 border-orange-200',
    'NR-33': 'bg-amber-100 text-amber-700 border-amber-200',
    'ISO 45003': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'ISO 45001': 'bg-teal-100 text-teal-700 border-teal-200',
  };
  return (
    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border", colors[norma] || 'bg-muted text-muted-foreground')}>
      {norma}
    </span>
  );
}

interface DimensaoCardProps {
  dimensao: {
    id: string;
    nome: string;
    descricao: string;
    tipo: 'risco' | 'protetor';
    normas: string[];
    perguntas: {
      id: string;
      texto: string;
      invertida?: boolean;
      normas?: string[];
      peso?: number;
    }[];
  };
  numero: number;
}

function DimensaoCard({ dimensao, numero }: DimensaoCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={cn(
      "transition-all duration-200",
      dimensao.tipo === 'risco'
        ? "border-orange-200/60 hover:border-orange-300"
        : "border-emerald-200/60 hover:border-emerald-300"
    )}>
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={cn(
              "shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
              dimensao.tipo === 'risco' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'
            )}>
              {numero}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-sm">{dimensao.nome}</CardTitle>
                <Badge
                  variant="outline"
                  className={cn("text-xs shrink-0",
                    dimensao.tipo === 'risco'
                      ? 'border-orange-300 text-orange-700'
                      : 'border-emerald-300 text-emerald-700'
                  )}
                >
                  {dimensao.tipo === 'risco' ? (
                    <><AlertTriangle className="h-3 w-3 mr-1" />Fator de Risco</>
                  ) : (
                    <><Shield className="h-3 w-3 mr-1" />Fator Protetor</>
                  )}
                </Badge>
              </div>
              <CardDescription className="text-xs mt-0.5">{dimensao.descricao}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="secondary" className="text-xs">{dimensao.perguntas.length} itens</Badge>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <CardContent className="pt-0 pb-4">
              <div className="flex flex-wrap gap-1 mb-3">
                {dimensao.normas.map(n => <NormaBadge key={n} norma={n} />)}
              </div>
              <div className="space-y-2">
                {dimensao.perguntas.map((p, i) => (
                  <div key={p.id} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/40 group">
                    <span className="shrink-0 w-5 h-5 rounded bg-background border text-xs flex items-center justify-center font-medium text-muted-foreground">
                      {i + 1}
                    </span>
                    <p className="text-sm text-foreground leading-relaxed flex-1">{p.texto}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      {p.invertida && (
                        <span title="Pergunta protetora — maior valor = melhor">
                          <Shield className="h-3 w-3 text-emerald-500" />
                        </span>
                      )}
                      {(p.peso ?? 1) > 1 && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-300 text-amber-700">
                          ×{p.peso}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export function InstrumentosVisualizacao() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-purple-600" />
            Instrumentos de Avaliação
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Perguntas validadas internacionalmente — adaptadas para NR-01, NR-17 e ISO 45003
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="gap-1">
            <Layers className="h-3 w-3" />
            {COPSOQ_TOTAL_PERGUNTAS + COPSOQ2BR_TOTAL_PERGUNTAS + HSE_TOTAL_PERGUNTAS + PROART_TOTAL_PERGUNTAS + SIPRO_TOTAL_PERGUNTAS} perguntas total
          </Badge>
        </div>
      </div>

      {/* Legenda */}
      <Card className="bg-muted/30">
        <CardContent className="pt-4 pb-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
              <span className="text-muted-foreground"><strong>Fator de Risco</strong>: maior resposta = mais exposição</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-500 shrink-0" />
              <span className="text-muted-foreground"><strong>Fator Protetor</strong>: maior resposta = melhor condição</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-3 w-3 text-emerald-500 shrink-0" />
              <span className="text-muted-foreground"><strong>Ícone</strong>: pergunta com pontuação invertida</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-300 text-amber-700">×2</Badge>
              <span className="text-muted-foreground"><strong>Peso duplo</strong>: pergunta com maior impacto no IPS</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="sipro">
        <TabsList className="w-full sm:w-auto flex-wrap h-auto gap-1">
          <TabsTrigger value="sipro" className="gap-2">
            <Sparkles className="h-4 w-4" />
            SIPRO
            <Badge variant="secondary" className="text-xs ml-1">{SIPRO_TOTAL_PERGUNTAS}</Badge>
          </TabsTrigger>
          <TabsTrigger value="copsoq" className="gap-2">
            <Brain className="h-4 w-4" />
            COPSOQ III
            <Badge variant="secondary" className="text-xs ml-1">{COPSOQ_TOTAL_PERGUNTAS}</Badge>
          </TabsTrigger>
          <TabsTrigger value="copsoq2br" className="gap-2">
            <Brain className="h-4 w-4" />
            COPSOQ II-Br
            <Badge variant="secondary" className="text-xs ml-1">{COPSOQ2BR_TOTAL_PERGUNTAS}</Badge>
          </TabsTrigger>
          <TabsTrigger value="hse" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            HSE Management Standards
            <Badge variant="secondary" className="text-xs ml-1">{HSE_TOTAL_PERGUNTAS}</Badge>
          </TabsTrigger>
          <TabsTrigger value="proart" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            PROART
            <Badge variant="secondary" className="text-xs ml-1">{PROART_TOTAL_PERGUNTAS}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* COPSOQ */}
        <TabsContent value="copsoq" className="mt-4 space-y-3">
          <Card className="bg-purple-50/40 border-purple-200">
            <CardContent className="pt-4 pb-3">
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-purple-600" />
                  <span><strong>{COPSOQ_DIMENSOES.length}</strong> dimensões psicossociais</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span><strong>{COPSOQ_DIMENSOES.filter(d => d.tipo === 'risco').length}</strong> fatores de risco</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-500" />
                  <span><strong>{COPSOQ_DIMENSOES.filter(d => d.tipo === 'protetor').length}</strong> fatores protetores</span>
                </div>
                <span className="text-muted-foreground">Copenhagen Psychosocial Questionnaire · Versão brasileira adaptada · NR-01, NR-17, ISO 45003</span>
              </div>
            </CardContent>
          </Card>
          <div className="space-y-2">
            {COPSOQ_DIMENSOES.map((dim, i) => (
              <DimensaoCard key={dim.id} dimensao={dim} numero={i + 1} />
            ))}
          </div>
        </TabsContent>

        {/* HSE */}
        <TabsContent value="hse" className="mt-4 space-y-3">
          <Card className="bg-blue-50/40 border-blue-200">
            <CardContent className="pt-4 pb-3">
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-blue-600" />
                  <span><strong>{HSE_DIMENSOES.length}</strong> dimensões — 7 padrões HSE</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span><strong>{HSE_DIMENSOES.filter(d => d.tipo === 'risco').length}</strong> fatores de risco</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-500" />
                  <span><strong>{HSE_DIMENSOES.filter(d => d.tipo === 'protetor').length}</strong> fatores protetores</span>
                </div>
                <span className="text-muted-foreground">Health & Safety Executive UK · Gestão organizacional · Demanda, Controle, Suporte, Relacionamentos, Função, Mudanças</span>
              </div>
            </CardContent>
          </Card>
          <div className="space-y-2">
            {HSE_DIMENSOES.map((dim, i) => (
              <DimensaoCard key={dim.id} dimensao={dim} numero={i + 1} />
            ))}
          </div>
        </TabsContent>

        {/* PROART */}
        <TabsContent value="proart" className="mt-4 space-y-3">
          <Card className="bg-amber-50/40 border-amber-200">
            <CardContent className="pt-4 pb-3">
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-amber-600" />
                  <span><strong>{PROART_DIMENSOES.length}</strong> dimensões — Protocolo brasileiro</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span><strong>{PROART_DIMENSOES.filter(d => d.tipo === 'risco').length}</strong> fatores de risco</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-500" />
                  <span><strong>{PROART_DIMENSOES.filter(d => d.tipo === 'protetor').length}</strong> fatores protetores</span>
                </div>
                <span className="text-muted-foreground">Protocolo de Avaliação dos Riscos Psicossociais · Mendes & Ferreira (2007) · NR-01, ISO 45003</span>
              </div>
            </CardContent>
          </Card>
          <div className="space-y-2">
            {PROART_DIMENSOES.map((dim, i) => (
              <DimensaoCard key={dim.id} dimensao={dim} numero={i + 1} />
            ))}
          </div>
        </TabsContent>

        {/* COPSOQ II-Br */}
        <TabsContent value="copsoq2br" className="mt-4 space-y-3">
          <Card className="bg-indigo-50/40 border-indigo-200">
            <CardContent className="pt-4 pb-3">
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-indigo-600" />
                  <span><strong>{COPSOQ2BR_DIMENSOES.length}</strong> dimensões — Versão Curta Brasileira</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span><strong>{COPSOQ2BR_DIMENSOES.filter(d => d.tipo === 'risco').length}</strong> fatores de risco</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-500" />
                  <span><strong>{COPSOQ2BR_DIMENSOES.filter(d => d.tipo === 'protetor').length}</strong> fatores protetores</span>
                </div>
                <span className="text-muted-foreground">COPSOQ II-Br · Gonçalves et al. (2021) · 40 itens · Sem adaptação YourEyes — instrumento puro</span>
              </div>
            </CardContent>
          </Card>
          <div className="space-y-2">
            {COPSOQ2BR_DIMENSOES.map((dim, i) => (
              <DimensaoCard key={dim.id} dimensao={dim} numero={i + 1} />
            ))}
          </div>
        </TabsContent>

        {/* SIPRO */}
        <TabsContent value="sipro" className="mt-4 space-y-3">
          <Card className="bg-violet-50/40 border-violet-200">
            <CardContent className="pt-4 pb-3">
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-violet-600" />
                  <span><strong>Instrumento autoral YourEyes</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-violet-600" />
                  <span><strong>{SIPRO_DIMENSOES.length}</strong> dimensões · 5 grupos</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span><strong>{SIPRO_DIMENSOES.filter(d => d.tipo === 'risco').length}</strong> fatores de risco</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-500" />
                  <span><strong>{SIPRO_DIMENSOES.filter(d => d.tipo === 'protetor').length}</strong> fatores protetores</span>
                </div>
                <span className="text-muted-foreground">SIPRO · NR-01 · ISO 45001 · ISO 45003 · Cronobiologia · Ergonomia Cognitiva · Gera IRP-S</span>
              </div>
            </CardContent>
          </Card>
          <div className="space-y-2">
            {SIPRO_DIMENSOES.map((dim, i) => (
              <DimensaoCard key={dim.id} dimensao={dim} numero={i + 1} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
