import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Layers, Building2, GitBranch, Plus } from 'lucide-react';
import { useGruposEconomicos } from '@/hooks/useGruposEconomicos';
import type { EmpresaCadastro } from '@/types/empresa';

interface Props {
  data: Partial<EmpresaCadastro & { grupo_economico_id?: string | null; tipo_unidade?: string; matriz_id?: string | null }>;
  onChange: (updates: Partial<EmpresaCadastro & { grupo_economico_id?: string | null; tipo_unidade?: string; matriz_id?: string | null }>) => void;
  matrizes: { id: string; razao_social: string | null; cnpj: string | null; grupo_economico_id?: string | null }[];
  currentEmpresaId?: string | null;
}

export function EmpresaHierarquiaFields({ data, onChange, matrizes, currentEmpresaId }: Props) {
  const { grupos, createGrupo } = useGruposEconomicos();
  const [novoGrupoOpen, setNovoGrupoOpen] = useState(false);
  const [novoGrupoNome, setNovoGrupoNome] = useState('');
  const [novoGrupoDescricao, setNovoGrupoDescricao] = useState('');

  const handleCreateGrupo = async () => {
    if (!novoGrupoNome.trim()) return;
    const result = await createGrupo.mutateAsync({ nome: novoGrupoNome, descricao: novoGrupoDescricao || undefined });
    if (result?.id) {
      onChange({ grupo_economico_id: result.id });
    }
    setNovoGrupoNome('');
    setNovoGrupoDescricao('');
    setNovoGrupoOpen(false);
  };

  // Auto-fill grupo when selecting a matriz that has one
  useEffect(() => {
    if (data.tipo_unidade === 'filial' && data.matriz_id) {
      const matriz = matrizes.find(m => m.id === data.matriz_id);
      if (matriz?.grupo_economico_id && !data.grupo_economico_id) {
        onChange({ grupo_economico_id: matriz.grupo_economico_id });
      }
    }
  }, [data.matriz_id, data.tipo_unidade]);

  const matrizesDisponiveis = matrizes.filter(m =>
    m.id !== currentEmpresaId && (!data.tipo_unidade || data.tipo_unidade !== 'matriz')
  );

  return (
    <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
      <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
        <GitBranch className="w-4 h-4 text-primary" />
        Hierarquia e Grupo Econômico
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Grupo Econômico */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            Grupo Econômico
          </Label>
          <Select
            value={data.grupo_economico_id || '_none'}
            onValueChange={v => {
              if (v === '_new') {
                setNovoGrupoOpen(true);
                return;
              }
              onChange({ grupo_economico_id: v === '_none' ? null : v });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Nenhum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">Nenhum</SelectItem>
              {grupos.filter(g => g.ativo).map(g => (
                <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>
              ))}
              <Separator className="my-1" />
              <SelectItem value="_new">
                <span className="flex items-center gap-1.5 text-primary font-medium">
                  <Plus className="w-3.5 h-3.5" />
                  Incluir novo grupo
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Opcional. Agrupa empresas do mesmo dono/holding.</p>
        </div>

        {/* Tipo Unidade */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            Tipo de Unidade
          </Label>
          <Select
            value={data.tipo_unidade || 'matriz'}
            onValueChange={v => {
              const updates: any = { tipo_unidade: v };
              if (v === 'matriz') updates.matriz_id = null;
              onChange(updates);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="matriz">Matriz</SelectItem>
              <SelectItem value="filial">Filial</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Matriz de Referência (só para filiais) */}
        {data.tipo_unidade === 'filial' && (
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              Matriz de Referência *
            </Label>
            <Select
              value={data.matriz_id || '_none'}
              onValueChange={v => onChange({ matriz_id: v === '_none' ? null : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a matriz" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Selecione...</SelectItem>
                {matrizesDisponiveis.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.razao_social || m.cnpj || m.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Empresa detentora do CNPJ base.</p>
          </div>
        )}
      </div>

      {/* Dialog para criar novo grupo econômico */}
      <Dialog open={novoGrupoOpen} onOpenChange={setNovoGrupoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Grupo Econômico</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Grupo *</Label>
              <Input value={novoGrupoNome} onChange={e => setNovoGrupoNome(e.target.value)} placeholder="Ex: Grupo Silva" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={novoGrupoDescricao} onChange={e => setNovoGrupoDescricao(e.target.value)} placeholder="Descrição opcional..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoGrupoOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateGrupo} disabled={!novoGrupoNome.trim() || createGrupo.isPending}>
              Criar Grupo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
