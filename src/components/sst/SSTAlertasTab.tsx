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

  const unique = achados.filter((a, i, arr) =>
    arr.findIndex(b => b.titulo === a.titulo) === i
  );

  const ordem = { critico: 0, alerta: 1, atencao: 2 };
  return unique.sort((a, b) => ordem[a.severidade] - ordem[b.severidade]).slice(0, 20);
}

// ── localStorage helpers ──────────────────────────────────────────────────────
const DISMISSED_KEY = "sst_achados_descartados";

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(set: Set<string>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
}

function achadoKey(docId: string, titulo: string): string {
  return `${docId}::${titulo}`;
}

interface Props {
  documentos: SSTDocumento[];
}

export function SSTAlertasTab({ documentos }: Props) {
  const navigate = useNavigate();
  const [selectedAchado, setSelectedAchado] = useState<SSTAchado | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<SSTDocumento | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed());
  const [showDismissed, setShowDismissed] = useState(false);

  const handleDismiss = useCallback((docId: string, achado: SSTAchado) => {
    const key = achadoKey(docId, achado.titulo);
    setDismissed(prev => {
      const next = new Set(prev);
      next.add(key);
      saveDismissed(next);
      return next;
    });
    toast("Achado descartado", {
      description: achado.titulo.substring(0, 60),
      action: {
        label: "Desfazer",
        onClick: () => {
          setDismissed(prev => {
            const next = new Set(prev);
            next.delete(key);
            saveDismissed(next);
            return next;
          });
        },
      },
    });
  }, []);

  const handleRestore = useCallback((docId: string, achado: SSTAchado) => {
    const key = achadoKey(docId, achado.titulo);
    setDismissed(prev => {
      const next = new Set(prev);
      next.delete(key);
      saveDismissed(next);
      return next;
    });
    toast.success("Achado restaurado.");
  }, []);

  const handleRestoreAll = () => {
    setDismissed(new Set());
    saveDismissed(new Set());
    toast.success("Todos os achados descartados foram restaurados.");
  };

  const docsAnalisados = useMemo((): DocComAchados[] => {
    return documentos
      .filter(d => d.analise_ia_status === "concluida" && d.analise_ia?.resultado)
      .map(doc => ({
        doc,
        achados: parseAchadosFromAnalise(doc.analise_ia),
      }))
      .filter(d => d.achados.length > 0);
  }, [documentos]);

  const docsAtivos = useMemo(() =>
    docsAnalisados.map(({ doc, achados }) => ({
      doc,
      achados: achados.filter(a => !dismissed.has(achadoKey(doc.id, a.titulo))),
      descartados: achados.filter(a => dismissed.has(achadoKey(doc.id, a.titulo))),
    })),
  [docsAnalisados, dismissed]);

  const totalDescartados = useMemo(() =>
    docsAtivos.reduce((acc, d) => acc + d.descartados.length, 0),
  [docsAtivos]);

  const totalAchados = docsAtivos.reduce((acc, d) => acc + d.achados.length, 0);
  const totalCriticos = docsAtivos.reduce((acc, d) =>
    acc + d.achados.filter(a => a.severidade === "critico").length, 0);
  const totalAlertas = docsAtivos.reduce((acc, d) =>
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
          <Button variant="outline" size="sm" onClick={() => navigate("/plano-acao")}>
            <ArrowRight className="w-4 h-4 mr-1" />
            Ver Plano de Ação
          </Button>
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
            <p className="text-xs text-muted-foreground mt-1">Achados Ativos</p>
          </CardContent>
        </Card>
      </div>

      {/* Info bar */}
      <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-muted-foreground">
            Clique em <strong className="text-foreground">Criar ação</strong> para gerar uma ação 5W2H com IA, ou em{" "}
            <strong className="text-foreground">✕</strong> para descartar achados irrelevantes.
          </p>
        </div>
        {totalDescartados > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="flex-shrink-0 text-muted-foreground gap-1 whitespace-nowrap"
            onClick={() => setShowDismissed(v => !v)}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {showDismissed ? "Ocultar" : `${totalDescartados} descartado${totalDescartados > 1 ? "s" : ""}`}
          </Button>
        )}
      </div>

      {/* Findings grouped by document */}
      {docsAtivos.map(({ doc, achados, descartados }) => {
        const isExpanded = expandedDocs.has(doc.id);
        const criticos = achados.filter(a => a.severidade === "critico").length;
        const alertas = achados.filter(a => a.severidade === "alerta").length;
        const hasActive = achados.length > 0;
        const hasDescartados = descartados.length > 0;

        if (!hasActive && !(showDismissed && hasDescartados)) return null;

        return (
          <Card key={doc.id} className={!hasActive ? "opacity-60" : ""}>
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
                <div className="flex items-center gap-2 flex-wrap">
                  {criticos > 0 && (
                    <Badge variant="destructive" className="text-xs">{criticos} crítico{criticos > 1 ? "s" : ""}</Badge>
                  )}
                  {alertas > 0 && (
                    <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">{alertas} alerta{alertas > 1 ? "s" : ""}</Badge>
                  )}
                  {hasActive && (
                    <Badge variant="secondary" className="text-xs">{achados.length} ativo{achados.length > 1 ? "s" : ""}</Badge>
                  )}
                  {hasDescartados && showDismissed && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">{descartados.length} descartado{descartados.length > 1 ? "s" : ""}</Badge>
                  )}
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
                  {/* Active achados */}
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
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            size="sm"
                            variant={achado.severidade === "critico" ? "default" : "outline"}
                            className="gap-1"
                            onClick={() => handleCriarAcao(achado, doc)}
                          >
                            <Sparkles className="w-3 h-3" />
                            Criar ação
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Descartar achado"
                            onClick={() => handleDismiss(doc.id, achado)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Dismissed achados */}
                  {showDismissed && hasDescartados && (
                    <>
                      {hasActive && <Separator className="my-1" />}
                      <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5 pt-1">
                        <Trash2 className="w-3 h-3" />
                        Descartados — clique em ↩ para restaurar
                      </p>
                      {descartados.map((achado, i) => {
                        const cfg = severidadeConfig[achado.severidade];
                        return (
                          <div
                            key={`d-${i}`}
                            className="flex items-start gap-3 p-3 rounded-lg border border-dashed bg-muted/20"
                          >
                            <div className="mt-0.5 flex-shrink-0 opacity-40">{cfg.icon}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-0.5 opacity-50">
                                <Badge variant="outline" className={`text-[10px] ${cfg.badgeClass}`}>
                                  {cfg.label}
                                </Badge>
                                {achado.norma && (
                                  <Badge variant="outline" className="text-[10px]">{achado.norma}</Badge>
                                )}
                              </div>
                              <p className="text-sm leading-snug line-through text-muted-foreground">{achado.titulo}</p>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 flex-shrink-0"
                              title="Restaurar achado"
                              onClick={() => handleRestore(doc.id, achado)}
                            >
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </>
                  )}
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
                  {hasActive
                    ? `Ver ${achados.length} achado${achados.length > 1 ? "s" : ""} ativo${achados.length > 1 ? "s" : ""}`
                    : `${descartados.length} descartado${descartados.length > 1 ? "s" : ""} — clique para ver`}
                </Button>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Footer actions */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch">
        {totalDescartados > 0 && (
          <Button variant="outline" size="sm" className="gap-2" onClick={handleRestoreAll}>
            <RotateCcw className="w-4 h-4" />
            Restaurar todos ({totalDescartados})
          </Button>
        )}
        <Card className="border-dashed flex-1">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Target className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Gerenciar ações de SST</p>
                <p className="text-xs text-muted-foreground">Ações criadas vão para o Plano de Ação com origem "Compliance SST"</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/plano-acao")}>
              <ArrowRight className="w-4 h-4 mr-1" />
              Plano de Ação
            </Button>
          </CardContent>
        </Card>
      </div>

      <SSTCriarAcaoModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        achado={selectedAchado}
        documento={selectedDoc}
      />
    </div>
  );
}
