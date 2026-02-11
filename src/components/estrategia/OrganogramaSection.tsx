import { useState } from "react";
import { Plus, Trash2, Users, User, Building2, ChevronRight, ChevronDown, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEstrategia } from "@/hooks/useEstrategia";
import { useCargos, useDepartamentos } from "@/hooks/useCadastros";
import type { EstrategiaOrganograma } from "@/types/estrategia";

function buildTree(nodes: EstrategiaOrganograma[]): EstrategiaOrganograma[] {
  const map = new Map<string, EstrategiaOrganograma>();
  const roots: EstrategiaOrganograma[] = [];
  nodes.forEach((n) => map.set(n.id, { ...n, children: [] }));
  nodes.forEach((n) => {
    const node = map.get(n.id)!;
    if (n.parent_id && map.has(n.parent_id)) {
      map.get(n.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function OrgNode({ node, level, onDelete }: { node: EstrategiaOrganograma; level: number; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className={level > 0 ? "ml-6 border-l-2 border-muted pl-4" : ""}>
      <div className="flex items-center gap-2 py-2 group">
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : (
          <div className="w-4" />
        )}
        <div className="flex items-center gap-2 flex-1 bg-card border rounded-lg px-3 py-2 shadow-sm">
          {node.tipo === "departamento" ? (
            <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
          ) : (
            <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{node.titulo}</p>
            {node.nome_ocupante && <p className="text-xs text-muted-foreground">{node.nome_ocupante}</p>}
          </div>
          <Badge variant="outline" className="text-[10px]">{node.tipo}</Badge>
          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive" onClick={() => onDelete(node.id)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <OrgNode key={child.id} node={child} level={level + 1} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

export function OrganogramaSection() {
  const { organograma, loadingOrganograma, createOrgNode, deleteOrgNode } = useEstrategia();
  const { cargos } = useCargos();
  const { departamentos } = useDepartamentos();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ titulo: "", nome_ocupante: "", parent_id: "", tipo: "funcao" });

  const tree = buildTree(organograma);

  const handleCreate = () => {
    if (!form.titulo.trim()) return;
    createOrgNode.mutate(
      { titulo: form.titulo, nome_ocupante: form.nome_ocupante || undefined, parent_id: form.parent_id || undefined, tipo: form.tipo },
      { onSuccess: () => { setShowNew(false); setForm({ titulo: "", nome_ocupante: "", parent_id: "", tipo: "funcao" }); } },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Organograma
          </h3>
          <p className="text-sm text-muted-foreground">Estrutura hierárquica visual da empresa</p>
        </div>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Nova Posição</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Posição no Organograma</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Título / Cargo</Label>
                <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Diretor de RH" />
              </div>
              <div className="space-y-1">
                <Label>Ocupante (opcional)</Label>
                <Input value={form.nome_ocupante} onChange={(e) => setForm({ ...form, nome_ocupante: e.target.value })} placeholder="Nome da pessoa" />
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="funcao">Função</SelectItem>
                    <SelectItem value="departamento">Departamento</SelectItem>
                    <SelectItem value="diretoria">Diretoria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {organograma.length > 0 && (
                <div className="space-y-1">
                  <Label>Superior (opcional)</Label>
                  <Select value={form.parent_id} onValueChange={(v) => setForm({ ...form, parent_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Raiz (sem superior)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Raiz (sem superior)</SelectItem>
                      {organograma.map((n) => <SelectItem key={n.id} value={n.id}>{n.titulo}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button onClick={handleCreate} disabled={createOrgNode.isPending} className="w-full">Adicionar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loadingOrganograma ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : tree.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Users className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Organograma vazio</p>
            <p className="text-xs text-muted-foreground mt-1">Adicione posições para construir a hierarquia</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4">
            {tree.map((node) => (
              <OrgNode key={node.id} node={node} level={0} onDelete={(id) => deleteOrgNode.mutate(id)} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
