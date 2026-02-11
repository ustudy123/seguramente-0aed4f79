import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, Link2, Wrench, Users, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAprendizado } from "@/hooks/useAprendizado";
import type { FuncaoAtividade } from "@/types/aprendizado";

interface AtividadesSectionProps {
  cargoId: string;
}

const FREQ_LABELS: Record<string, string> = { diaria: "Diária", semanal: "Semanal", mensal: "Mensal", eventual: "Eventual" };
const COMPL_LABELS: Record<string, string> = { baixa: "Baixa", media: "Média", alta: "Alta" };
const CLASS_LABELS: Record<string, string> = { rotineira: "Rotineira", critica: "Crítica", excepcional: "Excepcional" };
const TIPO_CONTEUDO_LABELS: Record<string, string> = { manual: "Manual", pop: "POP", instrucao: "Instrução", video: "Vídeo", apresentacao: "Apresentação", documento: "Documento", link: "Link" };
const TIPO_FERRAMENTA_LABELS: Record<string, string> = { sistema: "Sistema", software: "Software", planilha: "Planilha", equipamento: "Equipamento" };

export function AtividadesSection({ cargoId }: AtividadesSectionProps) {
  const {
    atividades, criarAtividade, excluirAtividade, criandoAtividade,
    responsabilidades, salvarResponsabilidade,
    conteudos, criarConteudo, excluirConteudo,
    ferramentas, criarFerramenta, excluirFerramenta,
  } = useAprendizado(cargoId);

  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [frequencia, setFrequencia] = useState("diaria");
  const [complexidade, setComplexidade] = useState("media");
  const [classificacao, setClassificacao] = useState("rotineira");

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Sub-forms state
  const [conteudoForm, setConteudoForm] = useState<{ atividadeId: string; tipo: string; titulo: string; url: string } | null>(null);
  const [ferramentaForm, setFerramentaForm] = useState<{ atividadeId: string; nome: string; tipo: string; url_manual: string } | null>(null);
  const [respForm, setRespForm] = useState<{ atividadeId: string; responsavel: string; interfaces: string; consequencia: string } | null>(null);

  const handleCreate = async () => {
    if (!nome.trim()) return;
    await criarAtividade({ nome, descricao: descricao || undefined, frequencia: frequencia as any, complexidade: complexidade as any, classificacao: classificacao as any });
    setNome(""); setDescricao(""); setShowForm(false);
  };

  const complColor: Record<string, string> = { baixa: "bg-green-100 text-green-800", media: "bg-yellow-100 text-yellow-800", alta: "bg-red-100 text-red-800" };
  const classColor: Record<string, string> = { rotineira: "bg-blue-100 text-blue-800", critica: "bg-red-100 text-red-800", excepcional: "bg-purple-100 text-purple-800" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Atividades ({atividades.length})</h3>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-1" /> Atividade
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nome *</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da atividade" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label>Frequência</Label>
                  <Select value={frequencia} onValueChange={setFrequencia}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(FREQ_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Complexidade</Label>
                  <Select value={complexidade} onValueChange={setComplexidade}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(COMPL_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Classificação</Label>
                  <Select value={classificacao} onValueChange={setClassificacao}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CLASS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="O que é feito no dia a dia" rows={2} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleCreate} disabled={criandoAtividade || !nome.trim()}>Salvar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {atividades.length === 0 && !showForm && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Nenhuma atividade cadastrada. Clique em "+ Atividade" para começar.
        </div>
      )}

      {atividades.map((at) => {
        const atConteudos = conteudos.filter((c) => c.atividade_id === at.id);
        const atFerramentas = ferramentas.filter((f) => f.atividade_id === at.id);
        const atResp = responsabilidades.find((r) => r.atividade_id === at.id);
        const isExpanded = expandedId === at.id;

        return (
          <Collapsible key={at.id} open={isExpanded} onOpenChange={() => setExpandedId(isExpanded ? null : at.id)}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="p-4 cursor-pointer hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <CardTitle className="text-sm">{at.nome}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{FREQ_LABELS[at.frequencia]}</Badge>
                      <Badge className={`text-xs ${complColor[at.complexidade]}`}>{COMPL_LABELS[at.complexidade]}</Badge>
                      <Badge className={`text-xs ${classColor[at.classificacao]}`}>{CLASS_LABELS[at.classificacao]}</Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); excluirAtividade(at.id); }}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="p-4 pt-0 space-y-4 border-t">
                  {at.descricao && <p className="text-sm text-muted-foreground">{at.descricao}</p>}

                  {/* Responsabilidades */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Users className="w-4 h-4" /> Responsabilidades
                    </div>
                    {respForm?.atividadeId === at.id ? (
                      <div className="grid grid-cols-3 gap-2">
                        <Input placeholder="Responsável direto" value={respForm.responsavel} onChange={(e) => setRespForm({ ...respForm, responsavel: e.target.value })} />
                        <Input placeholder="Interfaces" value={respForm.interfaces} onChange={(e) => setRespForm({ ...respForm, interfaces: e.target.value })} />
                        <div className="flex gap-1">
                          <Input placeholder="Consequência de erro" value={respForm.consequencia} onChange={(e) => setRespForm({ ...respForm, consequencia: e.target.value })} />
                          <Button size="sm" onClick={async () => {
                            await salvarResponsabilidade({ atividade_id: at.id, responsavel_direto: respForm.responsavel, interfaces: respForm.interfaces, consequencia_erro: respForm.consequencia });
                            setRespForm(null);
                          }}>OK</Button>
                        </div>
                      </div>
                    ) : atResp ? (
                      <div className="text-xs bg-muted/50 rounded-lg p-2 grid grid-cols-3 gap-2 cursor-pointer" onClick={() => setRespForm({ atividadeId: at.id, responsavel: atResp.responsavel_direto || "", interfaces: atResp.interfaces || "", consequencia: atResp.consequencia_erro || "" })}>
                        <span><strong>Responsável:</strong> {atResp.responsavel_direto || "—"}</span>
                        <span><strong>Interfaces:</strong> {atResp.interfaces || "—"}</span>
                        <span><strong>Consequência:</strong> {atResp.consequencia_erro || "—"}</span>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setRespForm({ atividadeId: at.id, responsavel: "", interfaces: "", consequencia: "" })}>
                        <Plus className="w-3 h-3 mr-1" /> Definir
                      </Button>
                    )}
                  </div>

                  {/* Conteúdos */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-medium"><Link2 className="w-4 h-4" /> Conteúdos ({atConteudos.length})</span>
                      <Button variant="ghost" size="sm" onClick={() => setConteudoForm({ atividadeId: at.id, tipo: "link", titulo: "", url: "" })}>
                        <Plus className="w-3 h-3 mr-1" /> Adicionar
                      </Button>
                    </div>
                    {conteudoForm?.atividadeId === at.id && (
                      <div className="flex gap-2">
                        <Select value={conteudoForm.tipo} onValueChange={(v) => setConteudoForm({ ...conteudoForm, tipo: v })}>
                          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(TIPO_CONTEUDO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input placeholder="Título" value={conteudoForm.titulo} onChange={(e) => setConteudoForm({ ...conteudoForm, titulo: e.target.value })} />
                        <Input placeholder="URL" value={conteudoForm.url} onChange={(e) => setConteudoForm({ ...conteudoForm, url: e.target.value })} />
                        <Button size="sm" onClick={async () => {
                          await criarConteudo({ atividade_id: at.id, tipo: conteudoForm.tipo, titulo: conteudoForm.titulo, url: conteudoForm.url });
                          setConteudoForm(null);
                        }} disabled={!conteudoForm.titulo || !conteudoForm.url}>OK</Button>
                        <Button variant="ghost" size="sm" onClick={() => setConteudoForm(null)}>✕</Button>
                      </div>
                    )}
                    {atConteudos.map((c) => (
                      <div key={c.id} className="flex items-center justify-between text-xs bg-muted/30 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{TIPO_CONTEUDO_LABELS[c.tipo]}</Badge>
                          <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                            {c.titulo} <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => excluirConteudo(c.id)}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Ferramentas */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-medium"><Wrench className="w-4 h-4" /> Ferramentas ({atFerramentas.length})</span>
                      <Button variant="ghost" size="sm" onClick={() => setFerramentaForm({ atividadeId: at.id, nome: "", tipo: "sistema", url_manual: "" })}>
                        <Plus className="w-3 h-3 mr-1" /> Adicionar
                      </Button>
                    </div>
                    {ferramentaForm?.atividadeId === at.id && (
                      <div className="flex gap-2">
                        <Select value={ferramentaForm.tipo} onValueChange={(v) => setFerramentaForm({ ...ferramentaForm, tipo: v })}>
                          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(TIPO_FERRAMENTA_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input placeholder="Nome" value={ferramentaForm.nome} onChange={(e) => setFerramentaForm({ ...ferramentaForm, nome: e.target.value })} />
                        <Input placeholder="URL do manual" value={ferramentaForm.url_manual} onChange={(e) => setFerramentaForm({ ...ferramentaForm, url_manual: e.target.value })} />
                        <Button size="sm" onClick={async () => {
                          await criarFerramenta({ atividade_id: at.id, nome: ferramentaForm.nome, tipo: ferramentaForm.tipo, url_manual: ferramentaForm.url_manual || undefined });
                          setFerramentaForm(null);
                        }} disabled={!ferramentaForm.nome}>OK</Button>
                        <Button variant="ghost" size="sm" onClick={() => setFerramentaForm(null)}>✕</Button>
                      </div>
                    )}
                    {atFerramentas.map((f) => (
                      <div key={f.id} className="flex items-center justify-between text-xs bg-muted/30 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{TIPO_FERRAMENTA_LABELS[f.tipo]}</Badge>
                          <span>{f.nome}</span>
                          {f.url_manual && (
                            <a href={f.url_manual} target="_blank" rel="noopener noreferrer" className="text-primary">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => excluirFerramenta(f.id)}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
}
