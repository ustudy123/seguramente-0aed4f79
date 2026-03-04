import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertTriangle, MinusCircle, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocumentoPastaNode, DocumentoItem } from "@/types/documentoPasta";

// Mapa de documentos esperados por categoria raiz
const DOCS_ESPERADOS: Record<string, { categoria: string; docs: string[] }[]> = {
  "Governança e Administração": [
    {
      categoria: "Estrutura Organizacional",
      docs: ["Contrato Social", "Estatuto", "Alterações Contratuais", "Organograma", "Estrutura de Cargos"],
    },
    {
      categoria: "Direcionamento Estratégico",
      docs: ["Missão, Visão e Valores", "Política da Qualidade", "Política de SST", "Código de Conduta"],
    },
    {
      categoria: "Licenças e Autorizações",
      docs: ["Alvará de Funcionamento", "Licença Vigilância Sanitária", "Licença Corpo de Bombeiros"],
    },
    {
      categoria: "Certidões",
      docs: ["Certidão Federal", "Certidão Estadual", "Certidão Municipal", "Certidão FGTS", "Certidão INSS", "Certidão Trabalhista"],
    },
  ],
  "Processos Organizacionais": [
    { categoria: "Mapeamento de Processos", docs: ["Fluxogramas", "Cadeia de Valor"] },
    { categoria: "Procedimentos Operacionais", docs: ["POPs", "Instruções de Trabalho"] },
    { categoria: "Gestão da Qualidade", docs: ["Procedimentos de Qualidade", "Indicadores de Desempenho"] },
  ],
  "Gestão de Riscos": [
    { categoria: "Inventário de Riscos", docs: ["Riscos Operacionais", "Riscos de SST", "Riscos Psicossociais"] },
    { categoria: "Matriz de Riscos", docs: ["Classificação de Risco", "Probabilidade", "Severidade"] },
  ],
  "SST": [
    { categoria: "Programas Legais", docs: ["PGR", "PCMSO", "LTCAT"] },
    { categoria: "Treinamentos", docs: ["NR-01 — Disposições Gerais", "NR-05 — CIPA", "NR-06 — EPIs"] },
    { categoria: "Registros", docs: ["CAT — Comunicação de Acidente", "Investigação de Acidentes", "APR — Análise Preliminar de Risco"] },
  ],
  "Gestão Ambiental": [
    { categoria: "Licenciamento Ambiental", docs: ["Licença Prévia", "Licença de Instalação", "Licença de Operação"] },
    { categoria: "Planos Ambientais", docs: ["PGRS — Plano de Gerenciamento de Resíduos", "Plano de Emergência Ambiental"] },
  ],
  "Auditorias e Melhoria Contínua": [
    { categoria: "Auditorias Internas", docs: ["Relatórios", "Checklists", "Evidências"] },
    { categoria: "Planos de Ação", docs: ["Ações Corretivas", "Ações Preventivas"] },
  ],
};

type DocStatus = "existente" | "faltante" | "vencido" | "nao_aplicavel";

interface DocEntry {
  nome: string;
  status: DocStatus;
  pastaId?: string;
}

interface CategoriaResult {
  categoria: string;
  docs: DocEntry[];
  total: number;
  existentes: number;
  faltantes: number;
  vencidos: number;
  naoAplicaveis: number;
  pct: number;
}

interface SecaoResult {
  nome: string;
  categorias: CategoriaResult[];
  pct: number;
}

function flattenDocs(nodes: DocumentoPastaNode[]): { pasta: DocumentoPastaNode; docs: DocumentoItem[] }[] {
  const result: { pasta: DocumentoPastaNode; docs: DocumentoItem[] }[] = [];
  for (const node of nodes) {
    result.push({ pasta: node, docs: node.documentos || [] });
    if (node.children?.length) result.push(...flattenDocs(node.children));
  }
  return result;
}

function findPastaByNome(nodes: DocumentoPastaNode[], nome: string): DocumentoPastaNode | undefined {
  for (const n of nodes) {
    if (n.nome.toLowerCase().includes(nome.toLowerCase())) return n;
    const found = findPastaByNome(n.children || [], nome);
    if (found) return found;
  }
}

function hasDocNome(pasta: DocumentoPastaNode | undefined, docNome: string): DocStatus {
  if (!pasta) return "faltante";
  // Buscar docs dentro desta pasta e subpastas
  const allDocs = flattenDocs([pasta]).flatMap(e => e.docs);
  const found = allDocs.find(d => d.nome_original.toLowerCase().includes(docNome.toLowerCase()));
  if (!found) return "faltante";
  if (found.status === "vencido") return "vencido";
  return "existente";
}

interface Props {
  tree: DocumentoPastaNode[];
  pastas: { nome: string }[];
}

export function MapaConformidade({ tree, pastas }: Props) {
  const [expandedSecoes, setExpandedSecoes] = useState<Set<string>>(new Set(Object.keys(DOCS_ESPERADOS)));
  const [filtroStatus, setFiltroStatus] = useState<DocStatus | "todos">("todos");

  const secoes: SecaoResult[] = useMemo(() => {
    return Object.entries(DOCS_ESPERADOS).map(([secaoNome, categorias]) => {
      const pastaSecao = findPastaByNome(tree, secaoNome);

      const cats: CategoriaResult[] = categorias.map(({ categoria, docs }) => {
        const pastaCat = pastaSecao ? findPastaByNome(pastaSecao.children || [], categoria) : undefined;

        const docEntries: DocEntry[] = docs.map(docNome => ({
          nome: docNome,
          status: hasDocNome(pastaCat, docNome),
          pastaId: pastaCat?.id,
        }));

        const existentes = docEntries.filter(d => d.status === "existente").length;
        const vencidos = docEntries.filter(d => d.status === "vencido").length;
        const faltantes = docEntries.filter(d => d.status === "faltante").length;
        const naoAplicaveis = docEntries.filter(d => d.status === "nao_aplicavel").length;
        const aplicaveis = docs.length - naoAplicaveis;
        const pct = aplicaveis > 0 ? Math.round(((existentes) / aplicaveis) * 100) : 0;

        return { categoria, docs: docEntries, total: docs.length, existentes, faltantes, vencidos, naoAplicaveis, pct };
      });

      const totalDocs = cats.reduce((s, c) => s + c.total, 0);
      const totalExist = cats.reduce((s, c) => s + c.existentes, 0);
      const totalNA = cats.reduce((s, c) => s + c.naoAplicaveis, 0);
      const pct = (totalDocs - totalNA) > 0 ? Math.round((totalExist / (totalDocs - totalNA)) * 100) : 0;

      return { nome: secaoNome, categorias: cats, pct };
    });
  }, [tree]);

  const totalGeral = useMemo(() => {
    const total = secoes.reduce((s, sec) => s + sec.categorias.reduce((ss, c) => ss + c.total, 0), 0);
    const exist = secoes.reduce((s, sec) => s + sec.categorias.reduce((ss, c) => ss + c.existentes, 0), 0);
    const na = secoes.reduce((s, sec) => s + sec.categorias.reduce((ss, c) => ss + c.naoAplicaveis, 0), 0);
    const venc = secoes.reduce((s, sec) => s + sec.categorias.reduce((ss, c) => ss + c.vencidos, 0), 0);
    const falt = secoes.reduce((s, sec) => s + sec.categorias.reduce((ss, c) => ss + c.faltantes, 0), 0);
    const pct = (total - na) > 0 ? Math.round((exist / (total - na)) * 100) : 0;
    return { total, exist, na, venc, falt, pct };
  }, [secoes]);

  const toggle = (nome: string) => {
    setExpandedSecoes(prev => {
      const next = new Set(prev);
      next.has(nome) ? next.delete(nome) : next.add(nome);
      return next;
    });
  };

  const statusIcon = (s: DocStatus) => {
    if (s === "existente") return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />;
    if (s === "vencido") return <AlertTriangle className="w-4 h-4 text-warning shrink-0" />;
    if (s === "nao_aplicavel") return <MinusCircle className="w-4 h-4 text-muted-foreground shrink-0" />;
    return <XCircle className="w-4 h-4 text-destructive shrink-0" />;
  };

  const pctColor = (pct: number) =>
    pct >= 80 ? "text-green-600" : pct >= 50 ? "text-warning" : "text-destructive";

  return (
    <div className="space-y-6">
      {/* Resumo geral */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Completude", value: `${totalGeral.pct}%`, color: "text-primary", bg: "bg-primary/5 border-primary/20" },
          { label: "Existentes", value: totalGeral.exist, color: "text-green-600", bg: "bg-green-500/5 border-green-500/20" },
          { label: "Faltantes", value: totalGeral.falt, color: "text-destructive", bg: "bg-destructive/5 border-destructive/20" },
          { label: "Vencidos", value: totalGeral.venc, color: "text-warning", bg: "bg-warning/5 border-warning/20" },
          { label: "Não Aplicáveis", value: totalGeral.na, color: "text-muted-foreground", bg: "bg-muted/50 border-border" },
        ].map(item => (
          <div key={item.label} className={cn("rounded-xl border p-4 text-center", item.bg)}>
            <p className={cn("text-2xl font-bold", item.color)}>{item.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Filtro */}
      <div className="flex gap-2 flex-wrap">
        {(["todos", "faltante", "vencido", "existente", "nao_aplicavel"] as const).map(f => (
          <Button
            key={f}
            variant={filtroStatus === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFiltroStatus(f)}
            className="text-xs h-7"
          >
            {f === "todos" ? "Todos" : f === "faltante" ? "Faltantes" : f === "vencido" ? "Vencidos" : f === "existente" ? "Existentes" : "N/A"}
          </Button>
        ))}
      </div>

      {/* Seções */}
      <ScrollArea className="h-[calc(100vh-420px)]">
        <div className="space-y-3 pr-2">
          {secoes.map(secao => (
            <div key={secao.nome} className="rounded-xl border bg-card overflow-hidden">
              {/* Header da seção */}
              <button
                onClick={() => toggle(secao.nome)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {expandedSecoes.has(secao.nome)
                    ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  <span className="font-semibold text-sm">{secao.nome}</span>
                  <Badge variant="outline" className={cn("text-xs font-bold", pctColor(secao.pct))}>
                    {secao.pct}%
                  </Badge>
                </div>
                <div className="w-32">
                  <Progress value={secao.pct} className="h-2" />
                </div>
              </button>

              {/* Categorias */}
              {expandedSecoes.has(secao.nome) && (
                <div className="border-t divide-y divide-border">
                  {secao.categorias.map(cat => {
                    const docsFiltrados = filtroStatus === "todos"
                      ? cat.docs
                      : cat.docs.filter(d => d.status === filtroStatus);

                    if (filtroStatus !== "todos" && docsFiltrados.length === 0) return null;

                    return (
                      <div key={cat.categoria} className="p-4 bg-muted/10">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-muted-foreground">{cat.categoria}</p>
                          <span className={cn("text-xs font-bold", pctColor(cat.pct))}>{cat.pct}%</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                          {docsFiltrados.map(doc => (
                            <div
                              key={doc.nome}
                              className={cn(
                                "flex items-center gap-2 p-2 rounded-lg text-xs border",
                                doc.status === "existente" && "bg-green-500/5 border-green-500/20",
                                doc.status === "vencido" && "bg-warning/5 border-warning/20",
                                doc.status === "faltante" && "bg-destructive/5 border-destructive/20",
                                doc.status === "nao_aplicavel" && "bg-muted/30 border-border opacity-60",
                              )}
                            >
                              {statusIcon(doc.status)}
                              <span className="truncate">{doc.nome}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
