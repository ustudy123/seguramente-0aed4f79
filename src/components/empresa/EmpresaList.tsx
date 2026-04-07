import { useState, useMemo } from 'react';
import { Building2, Search, Filter, Download, Plus, ToggleLeft, ToggleRight, Edit, Eye, CheckSquare, Square, AlertTriangle, Layers, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import type { EmpresaCadastro } from '@/types/empresa';
import type { GrupoEconomico } from '@/hooks/useGruposEconomicos';

interface EmpresaListProps {
  empresas: (EmpresaCadastro & { ativo: boolean })[];
  isLoading: boolean;
  onEdit: (id: string) => void;
  onNew: () => void;
  onToggleAtivo: (id: string, ativo: boolean) => void;
  grupos?: GrupoEconomico[];
}

export function EmpresaList({ empresas, isLoading, onEdit, onNew, onToggleAtivo, grupos = [] }: EmpresaListProps) {
  const [search, setSearch] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroUF, setFiltroUF] = useState<string>('todos');
  const [filtroGrauRisco, setFiltroGrauRisco] = useState<string>('todos');
  const [filtroGrupo, setFiltroGrupo] = useState<string>('todos');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Stats
  const stats = useMemo(() => {
    const total = empresas.length;
    const ativas = empresas.filter(e => e.ativo).length;
    const inativas = total - ativas;
    const grauAlto = empresas.filter(e => (e.grau_risco ?? 0) >= 3 && e.ativo).length;
    return { total, ativas, inativas, grauAlto };
  }, [empresas]);

  // UFs disponíveis
  const ufs = useMemo(() => {
    const set = new Set(empresas.map(e => e.estado).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [empresas]);

  // Filtros
  const filtered = useMemo(() => {
    return empresas.filter(e => {
      if (filtroStatus === 'ativas' && !e.ativo) return false;
      if (filtroStatus === 'inativas' && e.ativo) return false;
      if (filtroUF !== 'todos' && e.estado !== filtroUF) return false;
      if (filtroGrauRisco !== 'todos' && String(e.grau_risco) !== filtroGrauRisco) return false;
      if (filtroGrupo !== 'todos') {
        if (filtroGrupo === '_sem_grupo') {
          if (e.grupo_economico_id) return false;
        } else {
          if (e.grupo_economico_id !== filtroGrupo) return false;
        }
      }
      if (search) {
        const q = search.toLowerCase();
        const doc = e.tipo_pessoa === 'pf' ? e.cpf : e.cnpj;
        return (
          e.razao_social?.toLowerCase().includes(q) ||
          e.nome_fantasia?.toLowerCase().includes(q) ||
          doc?.toLowerCase().includes(q) ||
          e.cidade?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [empresas, search, filtroStatus, filtroUF, filtroGrauRisco, filtroGrupo]);

  // Helper: get filiais for a matriz
  const getFiliais = (matrizId: string) =>
    empresas.filter(e => e.matriz_id === matrizId);

  // Helper: get grupo name
  const getGrupoNome = (grupoId: string | null) => {
    if (!grupoId) return null;
    return grupos.find(g => g.id === grupoId)?.nome || null;
  };

  // Selection
  const allSelected = filtered.length > 0 && filtered.every(e => selectedIds.has(e.id));
  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(e => e.id)));
    }
  };
  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  // Ações em lote
  const handleBatchToggle = (ativo: boolean) => {
    selectedIds.forEach(id => onToggleAtivo(id, ativo));
    setSelectedIds(new Set());
    toast.success(`${selectedIds.size} empresa(s) ${ativo ? 'ativada(s)' : 'inativada(s)'}`);
  };

  // Export
  const handleExport = () => {
    const rows = filtered.map(e => ({
      'Razão Social': e.razao_social || '',
      'Nome Fantasia': e.nome_fantasia || '',
      'Tipo Pessoa': e.tipo_pessoa === 'pf' ? 'PF' : 'PJ',
      'CNPJ/CPF': (e.tipo_pessoa === 'pf' ? e.cpf : e.cnpj) || '',
      'CNAE': e.cnae_principal || '',
      'Grau de Risco': e.grau_risco ?? '',
      'Cidade': e.cidade || '',
      'UF': e.estado || '',
      'Status': e.ativo ? 'Ativa' : 'Inativa',
      'Total Colaboradores': e.total_colaboradores ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Empresas');
    XLSX.writeFile(wb, 'empresas.xlsx');
    toast.success('Exportação concluída!');
  };

  const grauRiscoBadge = (grau: number | null) => {
    if (!grau) return <span className="text-muted-foreground text-xs">—</span>;
    const colors: Record<number, string> = {
      1: 'bg-emerald-100 text-emerald-700',
      2: 'bg-blue-100 text-blue-700',
      3: 'bg-amber-100 text-amber-700',
      4: 'bg-red-100 text-red-700',
    };
    return <Badge className={colors[grau] || ''}>{grau}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <ToggleRight className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.ativas}</p>
              <p className="text-xs text-muted-foreground">Ativas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <ToggleLeft className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.inativas}</p>
              <p className="text-xs text-muted-foreground">Inativas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.grauAlto}</p>
              <p className="text-xs text-muted-foreground">GR ≥ 3</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center flex-1">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar razão social, CNPJ/CPF..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativas">Ativas</SelectItem>
              <SelectItem value="inativas">Inativas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroUF} onValueChange={setFiltroUF}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="UF" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos UF</SelectItem>
              {ufs.map(uf => (
                <SelectItem key={uf} value={uf}>{uf}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroGrauRisco} onValueChange={setFiltroGrauRisco}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Grau Risco" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos GR</SelectItem>
              <SelectItem value="1">GR 1</SelectItem>
              <SelectItem value="2">GR 2</SelectItem>
              <SelectItem value="3">GR 3</SelectItem>
              <SelectItem value="4">GR 4</SelectItem>
            </SelectContent>
          </Select>
          {grupos.length > 0 && (
            <Select value={filtroGrupo} onValueChange={setFiltroGrupo}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Grupo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Grupos</SelectItem>
                <SelectItem value="_sem_grupo">Sem grupo</SelectItem>
                {grupos.filter(g => g.ativo).map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1" />
            Exportar
          </Button>
          <Button size="sm" onClick={onNew}>
            <Plus className="w-4 h-4 mr-1" />
            Nova Empresa
          </Button>
        </div>
      </div>

      {/* Batch actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
          <span className="text-sm font-medium">{selectedIds.size} selecionada(s)</span>
          <Button variant="outline" size="sm" onClick={() => handleBatchToggle(true)} className="text-success hover:text-success hover:bg-success/10 border-success/30">
            <ToggleRight className="w-4 h-4 mr-1" />
            Ativar
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleBatchToggle(false)} className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30">
            <ToggleLeft className="w-4 h-4 mr-1" />
            Inativar
          </Button>
        </div>
      )}

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              </TableHead>
              <TableHead>Razão Social</TableHead>
              <TableHead>CNPJ/CPF</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Grupo</TableHead>
              <TableHead>CNAE</TableHead>
              <TableHead className="text-center">GR</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                  {empresas.length === 0 ? 'Nenhuma empresa cadastrada' : 'Nenhuma empresa encontrada com os filtros atuais'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(emp => (
                <TableRow key={emp.id} className={!emp.ativo ? 'opacity-60' : ''}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(emp.id)}
                      onCheckedChange={() => toggleOne(emp.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{emp.razao_social || '(sem razão social)'}</p>
                      {emp.nome_fantasia && (
                        <p className="text-xs text-muted-foreground">{emp.nome_fantasia}</p>
                      )}
                      {emp.cidade && emp.estado && (
                        <p className="text-xs text-muted-foreground">{emp.cidade}/{emp.estado}</p>
                      )}
                      {/* Show filiais count for matrizes */}
                      {emp.tipo_unidade === 'matriz' && (() => {
                        const filiais = getFiliais(emp.id);
                        return filiais.length > 0 ? (
                          <p className="text-xs text-primary mt-0.5">
                            <GitBranch className="w-3 h-3 inline mr-0.5" />
                            {filiais.length} filial(is)
                          </p>
                        ) : null;
                      })()}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-mono">
                    {emp.tipo_pessoa === 'pf' ? emp.cpf || '—' : emp.cnpj || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={emp.tipo_unidade === 'matriz' ? 'default' : 'outline'} className="text-xs">
                      {emp.tipo_unidade === 'matriz' ? 'Matriz' : 'Filial'}
                    </Badge>
                    {emp.tipo_unidade === 'filial' && emp.matriz_id && (() => {
                      const matriz = empresas.find(e => e.id === emp.matriz_id);
                      return matriz ? (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[120px]">
                          → {matriz.razao_social || matriz.cnpj}
                        </p>
                      ) : null;
                    })()}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const nome = getGrupoNome(emp.grupo_economico_id);
                      return nome ? (
                        <Badge variant="outline" className="text-xs">
                          <Layers className="w-3 h-3 mr-1" />
                          {nome}
                        </Badge>
                      ) : <span className="text-xs text-muted-foreground">—</span>;
                    })()}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">{emp.cnae_principal || '—'}</p>
                      {emp.cnae_descricao && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{emp.cnae_descricao}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">{grauRiscoBadge(emp.grau_risco)}</TableCell>
                  <TableCell>
                    <Badge className={emp.ativo ? "bg-success/10 text-success border-success/30" : "bg-destructive/10 text-destructive border-destructive/30"}>
                      {emp.ativo ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => onEdit(emp.id)} title="Editar">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onToggleAtivo(emp.id, !emp.ativo)}
                        title={emp.ativo ? 'Desativar Empresa' : 'Ativar Empresa'}
                        className={emp.ativo 
                          ? "text-success bg-success/10 hover:text-destructive hover:bg-destructive/10" 
                          : "text-destructive bg-destructive/10 hover:text-success hover:bg-success/10"
                        }
                      >
                        {emp.ativo ? (
                          <ToggleRight className="w-5 h-5" />
                        ) : (
                          <ToggleLeft className="w-5 h-5" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
