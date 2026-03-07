import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Upload, Brain, CheckCircle2, AlertCircle, FileText, Loader2,
  ChevronRight, Sparkles, FolderOpen, BarChart2, X
} from "lucide-react";
import { EtapaUpload } from "./EtapaUpload";
import { EtapaClassificacao } from "./EtapaClassificacao";
import { EtapaExtracao } from "./EtapaExtracao";
import { EtapaRevisao } from "./EtapaRevisao";
import { EtapaConsolidacao } from "./EtapaConsolidacao";

export type DadosExtraidos = {
  dados_gerais: Record<string, { valor: string | null; confianca: "alta" | "media" | "baixa" }>;
  estrutura_organizacional: {
    unidades: { nome: string; endereco?: string }[];
    setores: string[];
    departamentos: string[];
  };
  funcoes_atividades: { cargo: string; atividades: string[]; setor?: string }[];
  inventario_riscos: {
    setor: string; funcao: string; risco: string; tipo_risco: string;
    fonte_geradora?: string; intensidade?: string; tempo_exposicao?: string;
    metodologia?: string; danos?: string; controles_existentes?: string[];
    confianca: "alta" | "media" | "baixa";
  }[];
  plano_acao: {
    recomendacao: string; prioridade: "alta" | "media" | "baixa";
    prazo?: string; responsavel?: string; setor?: string;
    confianca: "alta" | "media" | "baixa";
  }[];
  responsaveis_tecnicos: {
    nome: string; formacao?: string; registro?: string;
    conselho?: string; funcao_no_doc?: string;
  }[];
  pendencias: { campo: string; motivo: string; severidade: "critica" | "media" | "baixa" }[];
  score_qualidade: {
    geral: number; dados_gerais: number; inventario: number;
    plano_acao: number; responsaveis: number;
  };
};

export type ImportacaoState = {
  etapa: 0 | 1 | 2 | 3 | 4 | 5; // 0=idle, 1=upload, 2=classificacao, 3=extracao, 4=revisao, 5=consolidado
  arquivo: File | null;
  textoExtraido: string;
  tipoDetectado: string;
  confiancaClassificacao: number;
  justificativaClassificacao: string;
  dadosExtraidos: DadosExtraidos | null;
  processando: boolean;
  erro: string | null;
};

const ETAPAS = [
  { num: 1, label: "Upload", icon: Upload },
  { num: 2, label: "Classificação", icon: Brain },
  { num: 3, label: "Extração", icon: FolderOpen },
  { num: 4, label: "Revisão", icon: FileText },
  { num: 5, label: "Consolidação", icon: CheckCircle2 },
];

const etapaAtualDescricao: Record<number, string> = {
  0: "Importe um documento SST para iniciar",
  1: "Envie o arquivo PDF ou DOCX do documento",
  2: "IA identificando tipo e estrutura do documento",
  3: "Extraindo e normalizando dados estruturados",
  4: "Revise e ajuste os dados extraídos",
  5: "Documento importado com sucesso",
};

export function ImportacaoInteligente() {
  const [state, setState] = useState<ImportacaoState>({
    etapa: 0,
    arquivo: null,
    textoExtraido: "",
    tipoDetectado: "",
    confiancaClassificacao: 0,
    justificativaClassificacao: "",
    dadosExtraidos: null,
    processando: false,
    erro: null,
  });

  const updateState = (partial: Partial<ImportacaoState>) =>
    setState(prev => ({ ...prev, ...partial }));

  const resetar = () => setState({
    etapa: 0, arquivo: null, textoExtraido: "", tipoDetectado: "",
    confiancaClassificacao: 0, justificativaClassificacao: "",
    dadosExtraidos: null, processando: false, erro: null,
  });

  const progressoPct = state.etapa === 0 ? 0 : Math.round(((state.etapa - 1) / 4) * 100);

  if (state.etapa === 0) {
    return (
      <div className="space-y-6">
        {/* Hero */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center">
            <div className="p-4 bg-primary/10 rounded-2xl mb-4">
              <Brain className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-xl font-bold mb-2">Importação Inteligente de Documentos SST</h2>
            <p className="text-muted-foreground text-sm max-w-lg mb-6">
              Envie qualquer documento SST (PGR, PCMSO, LTCAT, APR, Laudos) e a IA irá ler, 
              estruturar e normalizar automaticamente todas as informações — sem digitação manual.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-2xl mb-6">
              {[
                { icon: Brain, label: "Classifica automaticamente" },
                { icon: FolderOpen, label: "Extrai inventário de riscos" },
                { icon: BarChart2, label: "Score de qualidade" },
                { icon: Sparkles, label: "Plano de ação gerado" },
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-background border text-center">
                  <item.icon className="w-5 h-5 text-primary" />
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </div>
            <Button size="lg" onClick={() => updateState({ etapa: 1 })}>
              <Upload className="w-4 h-4 mr-2" />
              Iniciar Importação
            </Button>
          </CardContent>
        </Card>

        {/* Tipos suportados */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tipos de Documentos Suportados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {["PGR","PCMSO","LTCAT","PPP","APR","NR-12","AEP","AET",
                "Laudo de Insalubridade","Laudo de Periculosidade",
                "Avaliação Ambiental","Relatório de Medições","Relatório de Auditoria",
                "Parecer Técnico"].map(t => (
                <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Barra de progresso e etapas */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-foreground">{etapaAtualDescricao[state.etapa]}</p>
            {state.etapa > 0 && state.etapa < 5 && (
              <Button variant="ghost" size="sm" className="text-muted-foreground h-7 px-2" onClick={resetar}>
                <X className="w-3.5 h-3.5 mr-1" /> Cancelar
              </Button>
            )}
          </div>
          <Progress value={progressoPct} className="h-1.5 mb-4" />
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {ETAPAS.map((etapa, i) => {
              const isCompleted = state.etapa > etapa.num;
              const isCurrent = state.etapa === etapa.num;
              const Icon = etapa.icon;
              return (
                <div key={etapa.num} className="flex items-center gap-1 flex-shrink-0">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isCompleted ? "bg-primary/10 text-primary" :
                    isCurrent ? "bg-primary text-primary-foreground shadow-sm" :
                    "text-muted-foreground"
                  }`}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <Icon className="w-3.5 h-3.5" />
                    )}
                    {etapa.label}
                  </div>
                  {i < ETAPAS.length - 1 && (
                    <ChevronRight className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Erro global */}
      {state.erro && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-3 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">Erro na importação</p>
              <p className="text-xs text-muted-foreground">{state.erro}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => updateState({ erro: null })}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Etapa ativa */}
      {state.etapa === 1 && (
        <EtapaUpload state={state} updateState={updateState} />
      )}
      {state.etapa === 2 && (
        <EtapaClassificacao state={state} updateState={updateState} />
      )}
      {state.etapa === 3 && (
        <EtapaExtracao state={state} updateState={updateState} />
      )}
      {state.etapa === 4 && (
        <EtapaRevisao state={state} updateState={updateState} resetar={resetar} />
      )}
      {state.etapa === 5 && (
        <EtapaConsolidacao state={state} resetar={resetar} />
      )}
    </div>
  );
}
