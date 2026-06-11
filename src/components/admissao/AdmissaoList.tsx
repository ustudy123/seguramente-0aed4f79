import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, Plus, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AdmissaoCard } from './AdmissaoCard';
import { Admissao, AdmissaoStatus, STATUS_LABELS } from '@/types/admissao';

interface AdmissaoListProps {
  admissoes: Admissao[];
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onApprove?: (id: string) => void;
  canApprove?: boolean;
}

export function AdmissaoList({ admissoes, onView, onEdit, onDelete, onNew, onApprove, canApprove }: AdmissaoListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [departamentoFilter, setDepartamentoFilter] = useState<string>('todos');

  const departamentos = [
    ...new Set(
      admissoes
        .map((a) => a.dadosProfissionais?.departamento)
        .filter((dep): dep is string => typeof dep === 'string' && dep.trim().length > 0)
    ),
  ];

  const filteredAdmissoes = admissoes.filter(admissao => {
    const nomeCompleto = admissao.dadosPessoais?.nomeCompleto || '';
    const cargo = admissao.dadosProfissionais?.cargo || '';
    const cpf = admissao.dadosPessoais?.cpf || '';
    const departamento = admissao.dadosProfissionais?.departamento || '';

    const matchesSearch = nomeCompleto
      .toLowerCase()
      .includes(searchTerm.toLowerCase()) ||
      cargo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cpf.includes(searchTerm);

    const matchesStatus = statusFilter === 'todos' || admissao.status === statusFilter;
    const matchesDepartamento = departamentoFilter === 'todos' || 
      departamento === departamentoFilter;

    return matchesSearch && matchesStatus && matchesDepartamento;
  });

  const statusCounts = {
    todos: admissoes.length,
    rascunho: admissoes.filter(a => a.status === 'rascunho').length,
    aguardando_documentos: admissoes.filter(a => a.status === 'aguardando_documentos').length,
    em_analise: admissoes.filter(a => a.status === 'em_analise').length,
    aprovado: admissoes.filter(a => a.status === 'aprovado').length,
    reprovado: admissoes.filter(a => a.status === 'reprovado').length,
    concluido: admissoes.filter(a => a.status === 'concluido').length,
  };

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, função ou CPF..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">
                Todos os status ({statusCounts.todos})
              </SelectItem>
              {(Object.keys(STATUS_LABELS) as AdmissaoStatus[]).map(status => (
                <SelectItem key={status} value={status}>
                  {STATUS_LABELS[status]} ({statusCounts[status]})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={departamentoFilter} onValueChange={setDepartamentoFilter}>
            <SelectTrigger className="w-[180px]">
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os departamentos</SelectItem>
              {departamentos.map((dep) => (
                <SelectItem key={dep} value={dep}>
                  {dep}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={onNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Admissão
          </Button>
        </div>
      </div>

      {/* Active filters */}
      {(statusFilter !== 'todos' || departamentoFilter !== 'todos' || searchTerm) && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground">Filtros ativos:</span>
          {searchTerm && (
            <Badge variant="secondary" className="gap-1">
              Busca: {searchTerm}
              <button onClick={() => setSearchTerm('')} className="ml-1 hover:text-foreground">×</button>
            </Badge>
          )}
          {statusFilter !== 'todos' && (
            <Badge variant="secondary" className="gap-1">
              Status: {STATUS_LABELS[statusFilter as AdmissaoStatus]}
              <button onClick={() => setStatusFilter('todos')} className="ml-1 hover:text-foreground">×</button>
            </Badge>
          )}
          {departamentoFilter !== 'todos' && (
            <Badge variant="secondary" className="gap-1">
              Dept: {departamentoFilter}
              <button onClick={() => setDepartamentoFilter('todos')} className="ml-1 hover:text-foreground">×</button>
            </Badge>
          )}
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('todos');
              setDepartamentoFilter('todos');
            }}
          >
            Limpar todos
          </Button>
        </div>
      )}

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Exibindo {filteredAdmissoes.length} de {admissoes.length} admissões
      </div>

      {/* Grid of cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredAdmissoes.map((admissao, index) => (
            <motion.div
              key={admissao.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: index * 0.05 }}
            >
              <AdmissaoCard
                admissao={admissao}
                onView={onView}
                onEdit={onEdit}
                onDelete={onDelete}
                onApprove={onApprove}
                canApprove={canApprove}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filteredAdmissoes.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Search className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma admissão encontrada</h3>
          <p className="text-muted-foreground mb-4">Tente ajustar os filtros ou criar uma nova admissão.</p>
          <Button onClick={onNew}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Admissão
          </Button>
        </motion.div>
      )}
    </div>
  );
}
