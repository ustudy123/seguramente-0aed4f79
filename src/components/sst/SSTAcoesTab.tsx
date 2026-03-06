import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  ChevronDown,
  ChevronUp,
  Target,
  ArrowRight,
  Info,
  Sparkles,
  CalendarClock,
  ListChecks,
  Import,
} from "lucide-react";
import { SSTDocumento } from "@/hooks/useSSTDocumentos";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AcaoDocumento {
  numero?: string;
  descricao: string;
  responsavel?: string;
  prazo?: string;
  recurso?: string;
  origem: string; // doc tipo, e.g. "PGR", "PCMSO"
  docId: string;
}

interface DocComAcoes {
  doc: SSTDocumento;
  acoes: AcaoDocumento[];
}

/** Parse action plan / cronograma items from the AI analysis text */
function parseAcoesFromAnalise(doc: SSTDocumento): AcaoDocumento[] {
  const resultado: string = doc.analise_ia?.resultado || "";
  if (!resultado) return [];

  const acoes: AcaoDocumento[] = [];
  const linhas = resultado.split("\n");
  let inAcoesSection = false;

  for (const linha of linhas) {
    const l = linha.trim();

    // Detect section headers that indicate action plan / schedule
    if (
      /plano\s+de\s+a[çc][aã]o/i.test(l) ||
      /cronograma/i.test(l) ||
      /a[çc][oõ]es\s+(previstas|planejadas|recomendadas|corretivas|preventivas)/i.test(l) ||
      /medidas\s+(de\s+controle|preventivas|corretivas)/i.test(l) ||
      /programa\s+de\s+a[çc][oõ]es/i.test(l)
    ) {
      inAcoesSection = true;
      continue;
    }

    // Leave section on next major header (e.g., ##, bold title)
    if (inAcoesSection && (l.startsWith("##") || (l.startsWith("**") && l.endsWith("**") && l.length < 60 && !l.match(/^\*\*[-•]/))) ) {
      inAcoesSection = false;
    }

    if (!inAcoesSection) continue;

    // Match numbered or bulleted items
    const match = l.match(/^(?:\d+[.)]\s*|[-•*]\s*)(.+)/);
    if (match) {
      const texto = match[1].replace(/\*\*/g, "").trim();
      if (texto.length < 15) continue;

      // Try to extract prazo from text
      const prazoMatch = texto.match(/(?:prazo[:\s]+|até\s+)(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2}|\d+\s+(?:dias?|meses?|semanas?))/i);
      const respMatch = texto.match(/(?:responsável[:\s]+|resp[.:\s]+)([A-ZÀ-Ú][^,\n]{2,40})/i);

      acoes.push({
        descricao: texto.length > 160 ? texto.substring(0, 160) + "…" : texto,
        prazo: prazoMatch?.[1],
        responsavel: respMatch?.[1]?.trim(),
        origem: doc.tipo,
        docId: doc.id,
      });
    }
  }

  // Also scan for structured 5W2H blocks anywhere in the text
  const blocoMatches = [...resultado.matchAll(/\*\*O qu[eê][:\s]*\*\*\s*([^\n*]{10,120})/gi)];
  for (const m of blocoMatches) {
    const texto = m[1].trim();
    if (texto.length > 10 && !acoes.some(a => a.descricao.includes(texto.substring(0, 30)))) {
      acoes.push({
        descricao: texto,
        origem: doc.tipo,
        docId: doc.id,
      });
    }
  }

  const unique = acoes.filter((a, i, arr) => arr.findIndex(b => b.descricao === a.descricao) === i);
  return unique.slice(0, 30);
}

interface Props {
  documentos: SSTDocumento[];
}

export function SSTAcoesTab({ documentos }: Props) {
  const navigate = useNavigate();
  const { tenantId, user, profile } = useAuth();
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const [importando, setImportando] = useState<Set<string>>(new Set());

  const docsComAcoes = useMemo((): DocComAcoes[] => {
    return documentos
      .filter(d => d.analise_ia_status === "concluida" && d.analise_ia?.resultado)
      .map(doc => ({ doc, acoes: parseAcoesFromAnalise(doc) }))
      .filter(d => d.acoes.length > 0);
  }, [documentos]);

  const totalAcoes = docsComAcoes.reduce((acc, d) => acc + d.acoes.length, 0);

  const toggleDoc = (id: string) => {
    setExpandedDocs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleImportar = async (acao: AcaoDocumento, doc: SSTDocumento) => {
    if (!tenantId || !user) return;
    const key = `${acao.docId}::${acao.descricao.substring(0, 20)}`;
    setImportando(prev => new Set(prev).add(key));

    try {
      const prazoDate = new Date();
      prazoDate.setDate(prazoDate.getDate() + 90);

      const { error } = await supabase.from("plano_acoes").insert({
        tenant_id: tenantId,
        titulo: acao.descricao.substring(0, 100),
        descricao: acao.descricao,
        onde: acao.responsavel ? undefined : undefined,
        prazo: acao.prazo
          ? acao.prazo
          : prazoDate.toISOString().split("T")[0],
        responsavel_nome: acao.responsavel || profile?.nome_completo || user.email || "A definir",
        prioridade: "medio",
        status: "pendente",
        origem_modulo: "compliance_sst",
        origem_descricao: `Importado do ${doc.tipo} — ${doc.empresa_emissora || doc.arquivo_nome}`,
        criado_por: user.id,
        criado_por_nome: profile?.nome_completo || user.email,
      } as never);

      if (error) throw error;

      toast.success("Ação importada para o Plano de Ação!", {
        action: { label: "Ver Plano", onClick: () => navigate("/plano-acao") },
      });
    } catch (err: any) {
      toast.error("Erro ao importar ação: " + err.message);
    } finally {
      setImportando(prev => { const next = new Set(prev); next.delete(key); return next; });
    }
  };

  if (documentos.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="w-12 h-12 text-muted-foreground/50 mb-4" />
          <p className="font-medium mb-1">Nenhum documento carregado</p>
          <p className="text-sm text-muted-foreground">
            Envie documentos SST e execute a análise IA para importar os planos de ação e cronogramas contidos neles.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (docsComAcoes.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 bg-primary/10 rounded-2xl mb-4">
            <ListChecks className="w-10 h-10 text-primary" />
          </div>
          <p className="font-semibold mb-1">Nenhum plano de ação identificado</p>
          <p className="text-sm text-muted-foreground max-w-sm mb-4">
            Execute a <strong>Análise IA</strong> nos documentos. O sistema identificará automaticamente cronogramas e planos de ação presentes no PGR, PCMSO e outros documentos.
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
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{docsComAcoes.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Docs com Ações</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{totalAcoes}</p>
            <p className="text-xs text-muted-foreground mt-1">Ações Identificadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Legend */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
        <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-muted-foreground">
            As ações abaixo foram <strong className="text-foreground">extraídas na íntegra</strong> das seções de{" "}
            <strong className="text-foreground">Plano de Ação / Cronograma</strong> presentes nos documentos analisados pela IA.
            Clique em <strong className="text-foreground">Importar</strong> para enviá-las ao módulo Plano de Ação.
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant="outline" className="text-xs gap-1">
              <FileText className="w-3 h-3" /> Origem gravada no Plano de Ação
            </Badge>
            <Badge variant="outline" className="text-xs gap-1">
              <CalendarClock className="w-3 h-3" /> Prazo extraído quando disponível
            </Badge>
          </div>
        </div>
      </div>

      {/* Docs with action plans */}
      {docsComAcoes.map(({ doc, acoes }) => {
        const isExpanded = expandedDocs.has(doc.id);
        return (
          <Card key={doc.id}>
            <CardHeader className="pb-3 cursor-pointer" onClick={() => toggleDoc(doc.id)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {doc.tipo}
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        Origem
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {doc.empresa_emissora || doc.profissional_responsavel || doc.arquivo_nome}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {acoes.length} ação{acoes.length > 1 ? "ões" : ""}
                  </Badge>
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
                  {acoes.map((acao, i) => {
                    const key = `${acao.docId}::${acao.descricao.substring(0, 20)}`;
                    const loading = importando.has(key);
                    return (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-3 rounded-lg border bg-background"
                      >
                        <div className="mt-0.5 flex-shrink-0">
                          <Sparkles className="w-4 h-4 text-primary/60" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/30">
                              {acao.origem}
                            </Badge>
                            {acao.prazo && (
                              <Badge variant="outline" className="text-[10px] gap-1">
                                <CalendarClock className="w-3 h-3" />
                                {acao.prazo}
                              </Badge>
                            )}
                            {acao.responsavel && (
                              <Badge variant="outline" className="text-[10px]">
                                {acao.responsavel}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm leading-snug">{acao.descricao}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 flex-shrink-0"
                          disabled={loading}
                          onClick={() => handleImportar(acao, doc)}
                        >
                          <Import className="w-3 h-3" />
                          {loading ? "Importando…" : "Importar"}
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
                  Ver {acoes.length} ação{acoes.length > 1 ? "ões" : ""} identificada{acoes.length > 1 ? "s" : ""}
                </Button>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Footer */}
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Target className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Gerenciar todas as ações de SST</p>
              <p className="text-xs text-muted-foreground">
                Ações importadas ficam no Plano de Ação com origem "Compliance SST"
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/plano-acao")}>
            <ArrowRight className="w-4 h-4 mr-1" />
            Plano de Ação
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
