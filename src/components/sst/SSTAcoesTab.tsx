import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  AlertCircle,
  Sparkles,
  FileText,
  ChevronDown,
  ChevronUp,
  Target,
  ArrowRight,
  Info,
  X,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { SSTDocumento } from "@/hooks/useSSTDocumentos";
import { SSTCriarAcaoModal } from "./SSTCriarAcaoModal";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface SSTAchado {
  titulo: string;
  descricao: string;
  norma?: string;
  severidade: "critico" | "alerta" | "atencao";
}

interface DocComAchados {
  doc: SSTDocumento;
  achados: SSTAchado[];
}

function parseAchadosFromAnalise(analise: any): SSTAchado[] {
  if (!analise) return [];
  const resultado: string = analise.resultado || "";
  if (!resultado) return [];

  const achados: SSTAchado[] = [];

  // Extract critical alerts
  const secoes = [
    { pattern: /🔴\s*ALERTA[S]? CRÍTICO[S]?.*?(?=🟠|🟡|##|$)/gsi, severidade: "critico" as const },
    { pattern: /##\s*(?:🔴|CRÍTICO)[^\n]*\n([\s\S]*?)(?=##|$)/gi, severidade: "critico" as const },
    { pattern: /🟠\s*ALERTA[S]? TÉCNICO[S]?.*?(?=🟡|##|$)/gsi, severidade: "alerta" as const },
    { pattern: /##\s*(?:🟠|ALERTA TÉCNICO)[^\n]*\n([\s\S]*?)(?=##|$)/gi, severidade: "alerta" as const },
    { pattern: /🟡\s*PONTO[S]? DE ATENÇÃO.*?(?=##|$)/gsi, severidade: "atencao" as const },
  ];

  // Try to extract bullet points from the analysis
  const linhas = resultado.split("\n");
  let currentSeveridade: "critico" | "alerta" | "atencao" = "atencao";

  for (const linha of linhas) {
    const l = linha.trim();

    if (l.includes("🔴") || l.toLowerCase().includes("crítico") || l.toLowerCase().includes("critico")) {
      currentSeveridade = "critico";
    } else if (l.includes("🟠") || l.toLowerCase().includes("alerta técnico") || l.toLowerCase().includes("alerta tecnico")) {
      currentSeveridade = "alerta";
    } else if (l.includes("🟡") || l.toLowerCase().includes("atenção") || l.toLowerCase().includes("atencao")) {
      currentSeveridade = "atencao";
    }

    // Lines with bullet content containing NR references
    const bulletMatch = l.match(/^[-•*]\s+(.+)/);
    if (bulletMatch) {
      const texto = bulletMatch[1].trim();
      if (texto.length > 20) {
        const normaMatch = texto.match(/(NR[-\s]?\d+|LINACH|eSocial S-\d+)/i);
        achados.push({
          titulo: texto.length > 80 ? texto.substring(0, 80) + "…" : texto,
          descricao: texto,
          norma: normaMatch ? normaMatch[0] : undefined,
          severidade: currentSeveridade,
        });
      }
    }
  }

  // Deduplicate and limit to 20 most relevant
  const unique = achados.filter((a, i, arr) =>
    arr.findIndex(b => b.titulo === a.titulo) === i
  );

  // Sort: critico first, then alerta, then atencao
  const ordem = { critico: 0, alerta: 1, atencao: 2 };
  return unique.sort((a, b) => ordem[a.severidade] - ordem[b.severidade]).slice(0, 20);
}

interface Props {
  documentos: SSTDocumento[];
}

export function SSTAcoesTab({ documentos }: Props) {
  const navigate = useNavigate();
  const [selectedAchado, setSelectedAchado] = useState<SSTAchado | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<SSTDocumento | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());

  const docsAnalisados = useMemo((): DocComAchados[] => {
    return documentos
      .filter(d => d.analise_ia_status === "concluida" && d.analise_ia?.resultado)
      .map(doc => ({
        doc,
        achados: parseAchadosFromAnalise(doc.analise_ia),
      }))
      .filter(d => d.achados.length > 0);
  }, [documentos]);

  const totalAchados = docsAnalisados.reduce((acc, d) => acc + d.achados.length, 0);
  const totalCriticos = docsAnalisados.reduce((acc, d) =>
    acc + d.achados.filter(a => a.severidade === "critico").length, 0);
  const totalAlertas = docsAnalisados.reduce((acc, d) =>
    acc + d.achados.filter(a => a.severidade === "alerta").length, 0);

  const toggleDoc = (id: string) => {
    setExpandedDocs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCriarAcao = (achado: SSTAchado, doc: SSTDocumento) => {
    setSelectedAchado(achado);
    setSelectedDoc(doc);
    setModalOpen(true);
  };

  const severidadeConfig = {
    critico: {
      label: "🔴 Crítico",
      badgeClass: "bg-destructive/10 text-destructive border-destructive/30",
      icon: <AlertTriangle className="w-4 h-4 text-destructive" />,
      cardClass: "border-destructive/30",
    },
    alerta: {
      label: "🟠 Alerta Técnico",
      badgeClass: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-700",
      icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
      cardClass: "border-amber-200 dark:border-amber-800",
    },
    atencao: {
      label: "🟡 Atenção",
      badgeClass: "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-700",
      icon: <AlertCircle className="w-4 h-4 text-yellow-500" />,
      cardClass: "",
    },
  };

  if (documentos.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="w-12 h-12 text-muted-foreground/50 mb-4" />
          <p className="font-medium mb-1">Nenhum documento carregado</p>
          <p className="text-sm text-muted-foreground">
            Envie documentos SST e execute a análise IA para identificar não-conformidades e gerar ações.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (docsAnalisados.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 bg-primary/10 rounded-2xl mb-4">
            <Sparkles className="w-10 h-10 text-primary" />
          </div>
          <p className="font-semibold mb-1">Nenhuma análise IA concluída</p>
          <p className="text-sm text-muted-foreground max-w-sm mb-4">
            Acesse a aba <strong>Documentos</strong>, selecione um documento e execute a <strong>Análise IA</strong> para identificar automaticamente não-conformidades e gerar ações.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/plano-acao")}>
              <ArrowRight className="w-4 h-4 mr-1" />
              Ver Plano de Ação
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-destructive/30">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-destructive">{totalCriticos}</p>
            <p className="text-xs text-muted-foreground mt-1">Críticos</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 dark:border-amber-800">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{totalAlertas}</p>
            <p className="text-xs text-muted-foreground mt-1">Alertas Técnicos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{totalAchados}</p>
            <p className="text-xs text-muted-foreground mt-1">Total de Achados</p>
          </CardContent>
        </Card>
      </div>

      {/* Info */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
        <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <p className="text-muted-foreground">
          Achados extraídos automaticamente das análises de IA. Clique em{" "}
          <strong className="text-foreground">Criar ação</strong> para gerar uma ação 5W2H no Plano de Ação com sugestões específicas da IA.
        </p>
      </div>

      {/* Findings grouped by document */}
      {docsAnalisados.map(({ doc, achados }) => {
        const isExpanded = expandedDocs.has(doc.id);
        const criticos = achados.filter(a => a.severidade === "critico").length;
        const alertas = achados.filter(a => a.severidade === "alerta").length;

        return (
          <Card key={doc.id}>
            <CardHeader
              className="pb-3 cursor-pointer"
              onClick={() => toggleDoc(doc.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{doc.tipo}</CardTitle>
                    <CardDescription className="text-xs">
                      {doc.empresa_emissora || doc.profissional_responsavel || doc.arquivo_nome}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {criticos > 0 && (
                    <Badge variant="destructive" className="text-xs">{criticos} crítico{criticos > 1 ? "s" : ""}</Badge>
                  )}
                  {alertas > 0 && (
                    <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">{alertas} alerta{alertas > 1 ? "s" : ""}</Badge>
                  )}
                  <Badge variant="secondary" className="text-xs">{achados.length} achado{achados.length > 1 ? "s" : ""}</Badge>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <>
                <Separator />
                <CardContent className="pt-4 space-y-3">
                  {achados.map((achado, i) => {
                    const cfg = severidadeConfig[achado.severidade];
                    return (
                      <div
                        key={i}
                        className={`flex items-start gap-3 p-3 rounded-lg border ${cfg.cardClass} bg-background`}
                      >
                        <div className="mt-0.5 flex-shrink-0">{cfg.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <Badge variant="outline" className={`text-[10px] ${cfg.badgeClass}`}>
                              {cfg.label}
                            </Badge>
                            {achado.norma && (
                              <Badge variant="outline" className="text-[10px]">{achado.norma}</Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium leading-snug">{achado.titulo}</p>
                          {achado.descricao !== achado.titulo && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{achado.descricao}</p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant={achado.severidade === "critico" ? "default" : "outline"}
                          className="flex-shrink-0 gap-1"
                          onClick={() => handleCriarAcao(achado, doc)}
                        >
                          <Sparkles className="w-3 h-3" />
                          Criar ação
                        </Button>
                      </div>
                    );
                  })}
                </CardContent>
              </>
            )}

            {!isExpanded && (
              <CardContent className="pt-0 pb-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-muted-foreground"
                  onClick={() => toggleDoc(doc.id)}
                >
                  <ChevronDown className="w-4 h-4 mr-1" />
                  Ver {achados.length} achado{achados.length > 1 ? "s" : ""}
                </Button>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Link to Plano de Ação */}
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Target className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Gerenciar todas as ações de SST</p>
              <p className="text-xs text-muted-foreground">As ações criadas são gerenciadas no Plano de Ação com origem "Compliance SST"</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/plano-acao")}>
            <ArrowRight className="w-4 h-4 mr-1" />
            Ir para Plano de Ação
          </Button>
        </CardContent>
      </Card>

      <SSTCriarAcaoModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        achado={selectedAchado}
        documento={selectedDoc}
      />
    </div>
  );
}
