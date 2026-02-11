import { useState } from "react";
import { Plus, Trash2, ExternalLink, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useAprendizado } from "@/hooks/useAprendizado";

const TIPO_LABELS: Record<string, string> = { tecnica: "Técnica", comportamental: "Comportamental", cognitiva: "Cognitiva" };
const TIPO_COLORS: Record<string, string> = { tecnica: "bg-blue-100 text-blue-800", comportamental: "bg-green-100 text-green-800", cognitiva: "bg-purple-100 text-purple-800" };
const CONTEUDO_LABELS: Record<string, string> = { manual: "Manual", pop: "POP", instrucao: "Instrução", video: "Vídeo", apresentacao: "Apresentação", documento: "Documento", link: "Link" };

interface CompetenciasSectionProps {
  cargoId: string;
}

export function CompetenciasSection({ cargoId }: CompetenciasSectionProps) {
  const {
    competencias, criarCompetencia, excluirCompetencia,
    competenciaRecursos, criarCompetenciaRecurso, excluirCompetenciaRecurso,
  } = useAprendizado(cargoId);

  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("tecnica");
  const [descricao, setDescricao] = useState("");

  const [recursoForm, setRecursoForm] = useState<{ compId: string; tipo: string; titulo: string; url: string } | null>(null);

  const handleCreate = async () => {
    if (!nome.trim()) return;
    await criarCompetencia({ nome, tipo, descricao: descricao || undefined });
    setNome(""); setDescricao(""); setShowForm(false);
  };

  const grouped = {
    tecnica: competencias.filter((c) => c.tipo === "tecnica"),
    comportamental: competencias.filter((c) => c.tipo === "comportamental"),
    cognitiva: competencias.filter((c) => c.tipo === "cognitiva"),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Competências ({competencias.length})</h3>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-1" /> Competência
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Nome *</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Atenção concentrada" />
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Descrição</Label>
                <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Breve descrição" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleCreate} disabled={!nome.trim()}>Salvar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {competencias.length === 0 && !showForm && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Nenhuma competência cadastrada.
        </div>
      )}

      {(["tecnica", "comportamental", "cognitiva"] as const).map((tipoKey) => {
        const items = grouped[tipoKey];
        if (items.length === 0) return null;
        return (
          <div key={tipoKey} className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <GraduationCap className="w-4 h-4" />
              {TIPO_LABELS[tipoKey]} ({items.length})
            </h4>
            {items.map((comp) => {
              const recursos = competenciaRecursos.filter((r) => r.competencia_id === comp.id);
              return (
                <Card key={comp.id} className="border-l-4" style={{ borderLeftColor: tipoKey === "tecnica" ? "var(--color-blue-500)" : tipoKey === "comportamental" ? "var(--color-green-500)" : "var(--color-purple-500)" }}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{comp.nome}</span>
                        <Badge className={`text-xs ${TIPO_COLORS[comp.tipo]}`}>{TIPO_LABELS[comp.tipo]}</Badge>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => excluirCompetencia(comp.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                    {comp.descricao && <p className="text-xs text-muted-foreground">{comp.descricao}</p>}

                    {/* Recursos */}
                    <div className="space-y-1">
                      {recursos.map((r) => (
                        <div key={r.id} className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1">
                          <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                            <Badge variant="outline" className="text-xs">{CONTEUDO_LABELS[r.tipo]}</Badge>
                            {r.titulo} <ExternalLink className="w-3 h-3" />
                          </a>
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => excluirCompetenciaRecurso(r.id)}>
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                      ))}
                      {recursoForm?.compId === comp.id ? (
                        <div className="flex gap-1 mt-1">
                          <Select value={recursoForm.tipo} onValueChange={(v) => setRecursoForm({ ...recursoForm, tipo: v })}>
                            <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(CONTEUDO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Input className="h-8 text-xs" placeholder="Título" value={recursoForm.titulo} onChange={(e) => setRecursoForm({ ...recursoForm, titulo: e.target.value })} />
                          <Input className="h-8 text-xs" placeholder="URL" value={recursoForm.url} onChange={(e) => setRecursoForm({ ...recursoForm, url: e.target.value })} />
                          <Button size="sm" className="h-8" onClick={async () => {
                            await criarCompetenciaRecurso({ competencia_id: comp.id, tipo: recursoForm.tipo, titulo: recursoForm.titulo, url: recursoForm.url });
                            setRecursoForm(null);
                          }} disabled={!recursoForm.titulo || !recursoForm.url}>OK</Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setRecursoForm({ compId: comp.id, tipo: "link", titulo: "", url: "" })}>
                          <Plus className="w-3 h-3 mr-1" /> Recurso
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
