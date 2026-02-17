import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, ToggleLeft, ToggleRight, Layers } from 'lucide-react';
import { useGruposEconomicos, type GrupoEconomico } from '@/hooks/useGruposEconomicos';

export function GruposEconomicosManager() {
  const { grupos, isLoading, createGrupo, updateGrupo, deleteGrupo } = useGruposEconomicos();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGrupo, setEditingGrupo] = useState<GrupoEconomico | null>(null);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');

  const openNew = () => {
    setEditingGrupo(null);
    setNome('');
    setDescricao('');
    setDialogOpen(true);
  };

  const openEdit = (g: GrupoEconomico) => {
    setEditingGrupo(g);
    setNome(g.nome);
    setDescricao(g.descricao || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!nome.trim()) return;
    if (editingGrupo) {
      await updateGrupo.mutateAsync({ id: editingGrupo.id, nome, descricao: descricao || undefined });
    } else {
      await createGrupo.mutateAsync({ nome, descricao: descricao || undefined });
    }
    setDialogOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="w-6 h-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Grupos Econômicos
          </h3>
          <p className="text-sm text-muted-foreground">Gerencie holdings e conglomerados</p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="w-4 h-4 mr-1" />
          Novo Grupo
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grupos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Nenhum grupo econômico cadastrado
                </TableCell>
              </TableRow>
            ) : (
              grupos.map(g => (
                <TableRow key={g.id} className={!g.ativo ? 'opacity-60' : ''}>
                  <TableCell className="font-medium">{g.nome}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{g.descricao || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={g.ativo ? 'default' : 'secondary'}>
                      {g.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(g)} title="Editar">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => updateGrupo.mutate({ id: g.id, ativo: !g.ativo })}
                        title={g.ativo ? 'Inativar' : 'Ativar'}
                      >
                        {g.ativo ? <ToggleLeft className="w-4 h-4 text-muted-foreground" /> : <ToggleRight className="w-4 h-4 text-emerald-600" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteGrupo.mutate(g.id)} title="Excluir">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGrupo ? 'Editar Grupo Econômico' : 'Novo Grupo Econômico'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Grupo *</Label>
              <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Grupo Silva" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição opcional do grupo..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!nome.trim() || createGrupo.isPending || updateGrupo.isPending}>
              {editingGrupo ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
