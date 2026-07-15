import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  ChevronRight, ChevronDown, FileText, Plus, ArrowLeft, Loader2,
  Trash2, Pencil, X, FolderOpen,
} from "lucide-react";
import { useQaDocs } from "@/hooks/useQaDocs";
import {
  QA_TIPO_LABELS, QA_TIPO_DESCRICAO, QA_STATUS_LABELS,
  QA_PRIORIDADE_LABELS, QA_NIVEL_LABELS,
} from "@/types/qa";
import type {
  QaModuloNode, QaCasoTeste, QaPasso, QaCasoTipo,
  QaCasoStatus, QaPrioridade, QaNivel,
} from "@/types/qa";

const tipoBadge: Record<QaCasoTipo, string> = {
  feliz: "bg-emerald-100 text-emerald-800 border-emerald-200",
  alternativo: "bg-blue-100 text-blue-800 border-blue-200",
  negativo: "bg-orange-100 text-orange-800 border-orange-200",
  excecao: "bg-red-100 text-red-800 border-red-200",
};

const prioridadeBadge: Record<QaPrioridade, string> = {
  critica: "bg-red-100 text-red-800 border-red-200",
  alta: "bg-orange-100 text-orange-800 border-orange-200",
  media: "bg-amber-100 text-amber-800 border-amber-200",
  baixa: "bg-slate-100 text-slate-700 border-slate-200",
};

// ── Árvore ──────────────────────────────────────────
function TreeNode({
  node, nivel, selecionadoId, onSelecionar, contagem,
}: {
  node: QaModuloNode; nivel: number; selecionadoId: string | null;
  onSelecionar: (n: QaModuloNode) => void; contagem: Record<string, number>;
}) {
  const [aberto, setAberto] = useState(nivel === 0);
  const temFilhos = node.filhos.length > 0;
  const ativo = selecionadoId === node.id;
  const qtd = contagem[node.id] || 0;

  return (
    <div>
      <div
        className={`flex items-center gap-1 rounded-md px-2 py-1.5 cursor-pointer text-sm transition-colors ${
          ativo ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
        }`}
        style={{ paddingLeft: `${nivel * 12 + 8}px` }}
        onClick={() => { onSelecionar(node); if (temFilhos) setAberto((a) => !a); }}
      >
        {temFilhos ? (
          aberto ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        {node.icone && <span className="shrink-0">{node.icone}</span>}
        <span className="truncate flex-1">{node.label}</span>
        {qtd > 0 && (
          <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-1.5 shrink-0">{qtd}</span>
        )}
      </div>
      {temFilhos && aberto && (
        <div>
          {node.filhos.map((f) => (
            <TreeNode key={f.id} node={f} nivel={nivel + 1} selecionadoId={selecionadoId}
                      onSelecionar={onSelecionar} contagem={contagem} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Editor de caso ──────────────────────────────────
const casoVazio = (moduloId: string): Partial<QaCasoTeste> => ({
  modulo_id: moduloId, titulo: "", tipo: "feliz", prioridade: "media",
  status: "rascunho", nivel: "api", passos: [],
});

function CasoEditor({
  aberto, caso, moduloId, onFechar, onSalvar, salvando,
}: {
  aberto: boolean; caso: Partial<QaCasoTeste> | null; moduloId: string;
  onFechar: () => void; salvando: boolean;
  onSalvar: (c: Partial<QaCasoTeste> & { modulo_id: string; titulo: string }) => void;
}) {
  const [form, setForm] = useState<Partial<QaCasoTeste>>(caso || casoVazio(moduloId));

  // Recarrega o form quando abre com outro caso
  const [ultimoId, setUltimoId] = useState<string | undefined>(caso?.id);
  if (aberto && caso?.id !== ultimoId) {
    setUltimoId(caso?.id);
    setForm(caso || casoVazio(moduloId));
  }

  const set = <K extends keyof QaCasoTeste>(k: K, v: QaCasoTeste[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const passos: QaPasso[] = form.passos || [];
  const addPasso = () =>
    set("passos", [...passos, { ordem: passos.length + 1, acao: "", resultado_esperado: "" }]);
  const updPasso = (i: number, patch: Partial<QaPasso>) =>
    set("passos", passos.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const delPasso = (i: number) =>
    set("passos", passos.filter((_, idx) => idx !== i).map((p, idx) => ({ ...p, ordem: idx + 1 })));

  const salvar = () => {
    if (!form.titulo?.trim()) return;
    onSalvar({ ...form, modulo_id: moduloId, titulo: form.titulo.trim() } as Partial<QaCasoTeste> & { modulo_id: string; titulo: string });
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? "Editar caso de teste" : "Novo caso de teste"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_140px] gap-3">
            <div>
              <Label>Título *</Label>
              <Input value={form.titulo || ""} onChange={(e) => set("titulo", e.target.value)}
                     placeholder="Ex: Inclusão retroativa de entrada mantém a sequência do dia" />
            </div>
            <div>
              <Label>Código</Label>
              <Input value={form.codigo || ""} onChange={(e) => set("codigo", e.target.value)} placeholder="PONTO-001" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => set("tipo", v as QaCasoTipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(QA_TIPO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {QA_TIPO_DESCRICAO[(form.tipo || "feliz") as QaCasoTipo]}
              </p>
            </div>
            <div>
              <Label>Nível de execução</Label>
              <Select value={form.nivel} onValueChange={(v) => set("nivel", v as QaNivel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(QA_NIVEL_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {form.nivel === "e2e" ? "Exige browser (Playwright)." : "Roda por edge function."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Prioridade</Label>
              <Select value={form.prioridade} onValueChange={(v) => set("prioridade", v as QaPrioridade)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(QA_PRIORIDADE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v as QaCasoStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(QA_STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Objetivo</Label>
            <Textarea value={form.objetivo || ""} onChange={(e) => set("objetivo", e.target.value)} rows={2}
                      placeholder="O que este caso verifica e por que importa." />
          </div>

          <div>
            <Label>Pré-condições</Label>
            <Textarea value={form.pre_condicoes || ""} onChange={(e) => set("pre_condicoes", e.target.value)} rows={2}
                      placeholder="Estado necessário antes de começar (dados, usuário, permissões)." />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Passos</Label>
              <Button type="button" variant="ghost" size="sm" onClick={addPasso} className="h-7 text-primary">
                <Plus className="w-4 h-4 mr-1" /> Adicionar passo
              </Button>
            </div>
            {passos.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Descreva a sequência de ações. Cada passo vira uma verificação do agente.
              </p>
            ) : (
              <div className="space-y-2">
                {passos.map((p, i) => (
                  <div key={i} className="rounded-md border border-border p-2 space-y-2 bg-muted/20">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground shrink-0 w-5">{i + 1}.</span>
                      <Input className="h-8" value={p.acao} placeholder="Ação: o que é feito"
                             onChange={(e) => updPasso(i, { acao: e.target.value })} />
                      <button type="button" onClick={() => delPasso(i)}
                              className="text-muted-foreground hover:text-destructive shrink-0" title="Remover passo">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <Input className="h-8 ml-7 w-[calc(100%-1.75rem)]" value={p.resultado_esperado}
                           placeholder="Resultado esperado: o que deve acontecer"
                           onChange={(e) => updPasso(i, { resultado_esperado: e.target.value })} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Resultado esperado (geral)</Label>
            <Textarea value={form.resultado_esperado || ""} onChange={(e) => set("resultado_esperado", e.target.value)} rows={2}
                      placeholder="Estado final correto do sistema ao fim do caso." />
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea value={form.observacoes || ""} onChange={(e) => set("observacoes", e.target.value)} rows={2}
                      placeholder="Contexto, bug de origem, referência de regra." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button onClick={salvar} disabled={!form.titulo?.trim() || salvando}>
            {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {form.id ? "Salvar caso" : "Criar caso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Página ──────────────────────────────────────────
export default function QADocs() {
  const navigate = useNavigate();
  const [modulo, setModulo] = useState<QaModuloNode | null>(null);
  const [editorAberto, setEditorAberto] = useState(false);
  const [casoAtivo, setCasoAtivo] = useState<Partial<QaCasoTeste> | null>(null);

  const { arvore, casos, contagem, carregandoArvore, carregandoCasos, salvarCaso, salvando, excluirCaso } =
    useQaDocs(modulo?.id);

  const abrirNovo = () => { setCasoAtivo(null); setEditorAberto(true); };
  const abrirEdicao = (c: QaCasoTeste) => { setCasoAtivo(c); setEditorAberto(true); };

  const handleSalvar = async (c: Partial<QaCasoTeste> & { modulo_id: string; titulo: string }) => {
    await salvarCaso(c);
    setEditorAberto(false);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/qa")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> QA
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Documentação de testes</h1>
          <p className="text-sm text-muted-foreground">
            Os casos de teste vêm antes do agente. É desta documentação que o agente é criado.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* Árvore */}
        <Card className="h-fit">
          <CardContent className="p-2">
            {carregandoArvore ? (
              <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando diretório...
              </div>
            ) : arvore.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                Diretório vazio. Rode a migration do diretório de testes para criar a árvore de módulos.
              </p>
            ) : (
              arvore.map((n) => (
                <TreeNode key={n.id} node={n} nivel={0} selecionadoId={modulo?.id ?? null}
                          onSelecionar={setModulo} contagem={contagem} />
              ))
            )}
          </CardContent>
        </Card>

        {/* Casos */}
        <Card>
          <CardContent className="p-4">
            {!modulo ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FolderOpen className="w-10 h-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Escolha um módulo à esquerda para ver e escrever os casos de teste dele.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-semibold flex items-center gap-2">
                      {modulo.icone} {modulo.label}
                    </h2>
                    <p className="text-xs text-muted-foreground font-mono">{modulo.path}</p>
                  </div>
                  <Button size="sm" onClick={abrirNovo}>
                    <Plus className="w-4 h-4 mr-1" /> Novo caso
                  </Button>
                </div>

                {carregandoCasos ? (
                  <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Carregando casos...
                  </div>
                ) : casos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileText className="w-10 h-10 text-muted-foreground/50 mb-3" />
                    <p className="text-sm font-medium">Nenhum caso documentado aqui ainda.</p>
                    <p className="text-sm text-muted-foreground mt-1 max-w-md">
                      Comece pelo caminho feliz e depois cubra os caminhos negativos e as exceções —
                      é neles que os bugs costumam se esconder.
                    </p>
                    <Button size="sm" variant="outline" className="mt-4" onClick={abrirNovo}>
                      <Plus className="w-4 h-4 mr-1" /> Escrever o primeiro caso
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {casos.map((c) => (
                      <div key={c.id} className="rounded-md border border-border p-3 hover:bg-muted/30 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {c.codigo && <span className="text-xs font-mono text-muted-foreground">{c.codigo}</span>}
                              <span className="font-medium text-sm">{c.titulo}</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              <Badge variant="outline" className={`text-[10px] ${tipoBadge[c.tipo]}`}>
                                {QA_TIPO_LABELS[c.tipo]}
                              </Badge>
                              <Badge variant="outline" className={`text-[10px] ${prioridadeBadge[c.prioridade]}`}>
                                {QA_PRIORIDADE_LABELS[c.prioridade]}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">{QA_NIVEL_LABELS[c.nivel]}</Badge>
                              <Badge variant="outline" className="text-[10px]">{QA_STATUS_LABELS[c.status]}</Badge>
                              {(c.passos?.length || 0) > 0 && (
                                <span className="text-[10px] text-muted-foreground">
                                  {c.passos.length} passo{c.passos.length > 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => abrirEdicao(c)} className="text-muted-foreground hover:text-foreground p-1" title="Editar">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => { if (confirm(`Excluir o caso "${c.titulo}"?`)) excluirCaso(c.id); }}
                              className="text-muted-foreground hover:text-destructive p-1" title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {modulo && (
        <CasoEditor
          aberto={editorAberto}
          caso={casoAtivo}
          moduloId={modulo.id}
          onFechar={() => setEditorAberto(false)}
          onSalvar={handleSalvar}
          salvando={salvando}
        />
      )}
    </div>
  );
}
