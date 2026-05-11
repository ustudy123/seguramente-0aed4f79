import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Target,
  RefreshCw,
  Plus,
  Edit,
  Info,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { EmpresaCadastro, EmpresaObrigacao } from '@/types/empresa';
import { OBRIGACOES_TEMPLATES as templates } from '@/types/empresa';
import { useEmpresaCadastro } from '@/hooks/useEmpresaCadastro';

interface Props {
  cadastro: EmpresaCadastro | null;
  onTabChange?: (tab: string) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pendente: { label: 'Pendente', color: 'bg-muted text-muted-foreground', icon: Clock },
  conforme: { label: 'Conforme', color: 'bg-accent text-accent-foreground', icon: CheckCircle2 },
  nao_conforme: { label: 'Não Conforme', color: 'bg-destructive/10 text-destructive', icon: AlertTriangle },
  em_adequacao: { label: 'Em Adequação', color: 'bg-warning/10 text-warning', icon: RefreshCw },
  nao_aplicavel: { label: 'N/A', color: 'bg-secondary text-secondary-foreground', icon: CheckCircle2 },
};

const CRITICIDADE_COLOR: Record<string, string> = {
  baixa: 'border-l-muted-foreground',
  media: 'border-l-warning',
  alta: 'border-l-orange-500',
  critica: 'border-l-destructive',
};

export function EmpresaObrigacoesTab({ cadastro, onTabChange }: Props) {
  const navigate = useNavigate();
  const { obrigacoes, createObrigacao, updateObrigacao, deleteObrigacao, criarAcaoDeObrigacao } = useEmpresaCadastro(cadastro?.id);
  const [toDelete, setToDelete] = useState<EmpresaObrigacao | null>(null);
  const [confirmText, setConfirmText] = useState('');

  const handleToggleAtivo = (obrigacao: EmpresaObrigacao, ativo: boolean) => {
    updateObrigacao.mutate(
      { id: obrigacao.id, ativo },
      {
        onSuccess: () => toast.success(ativo ? 'Obrigação ativada' : 'Obrigação inativada'),
        onError: (e: Error) => toast.error('Erro: ' + e.message),
      }
    );
  };

  const handleConfirmDelete = () => {
    if (!toDelete) return;
    if (confirmText.trim().toUpperCase() !== 'EXCLUIR') {
      toast.error('Digite EXCLUIR para confirmar');
      return;
    }
    deleteObrigacao.mutate(toDelete.id, {
      onSuccess: () => {
        toast.success('Obrigação excluída');
        setToDelete(null);
        setConfirmText('');
      },
      onError: (e: Error) => toast.error('Erro: ' + e.message),
    });
  };

  // Detect obligations from cadastro data
  const obrigacoesDetectadas = useMemo(() => {
    if (!cadastro) return [];
    return templates.filter((t) => t.condicao(cadastro));
  }, [cadastro]);

  const obrigacoesNaoRegistradas = useMemo(() => {
    return obrigacoesDetectadas.filter(
      (t) => !obrigacoes.some((o) => o.origem_campo === t.origem_campo && o.titulo === t.titulo)
    );
  }, [obrigacoesDetectadas, obrigacoes]);

  const handleSyncObrigacoes = async () => {
    if (!cadastro) return;

    let count = 0;
    for (const template of obrigacoesNaoRegistradas) {
      await createObrigacao.mutateAsync({
        tenant_id: cadastro.tenant_id,
        empresa_id: cadastro.id,
        categoria: template.categoria,
        subcategoria: template.subcategoria,
        titulo: template.titulo,
        descricao: template.descricao,
        base_legal: template.base_legal,
        criticidade: template.criticidade,
        status: 'pendente',
        origem: 'cadastro_empresa',
        origem_campo: template.origem_campo,
        prazo_sugerido: null,
        responsavel_sugerido: null,
        acao_gerada_id: null,
        ativo: true,
      });
      count++;
    }

    if (count > 0) {
      toast.success(`${count} obrigação(ões) detectada(s) e registrada(s)!`);
    } else {
      toast.info('Nenhuma nova obrigação detectada.');
    }
  };

  const handleCriarAcao = (obrigacao: EmpresaObrigacao) => {
    criarAcaoDeObrigacao.mutate(obrigacao);
  };

  return (
    <div className="space-y-6">
      {/* Explicação do fluxo */}
      <div className="flex gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
        <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1.5 text-sm">
          <p className="font-medium text-foreground">Como tratar estas obrigações</p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            As obrigações abaixo são apontamentos legais identificados a partir do cadastro da empresa.
            Para cada item, clique em <strong>"Criar Ação"</strong> para gerar automaticamente um plano 5W2H no módulo{' '}
            <strong>Planejamento e Cultura → Plano de Ação</strong>. Lá você define <em>responsável, prazo, etapas e evidências</em>{' '}
            e acompanha o avanço até a conformidade. Quando a ação já existe, clique em <strong>"Abrir Ação"</strong> para ir
            direto ao plano correspondente.
          </p>
        </div>
      </div>

      {/* Sync bar */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div>
          <p className="text-sm font-medium">
            {obrigacoesDetectadas.length} obrigação(ões) detectada(s) no cadastro
          </p>
          {obrigacoesNaoRegistradas.length > 0 && (
            <p className="text-xs text-warning">
              {obrigacoesNaoRegistradas.length} ainda não registrada(s)
            </p>
          )}
        </div>
        <Button
          onClick={handleSyncObrigacoes}
          disabled={obrigacoesNaoRegistradas.length === 0 || createObrigacao.isPending}
          size="sm"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Gerar Obrigações
        </Button>
      </div>

      {/* Lista de obrigações */}
      {obrigacoes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Nenhuma obrigação registrada.</p>
          <p className="text-xs mt-1">
            Preencha o cadastro e clique em "Sincronizar" para detectar obrigações automaticamente.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {obrigacoes.map((obrigacao) => {
            const statusConf = STATUS_CONFIG[obrigacao.status] || STATUS_CONFIG.pendente;
            const StatusIcon = statusConf.icon;
            const isTac = obrigacao.subcategoria === 'tac';

            return (
              <Card
                key={obrigacao.id}
                className={`border-l-4 ${CRITICIDADE_COLOR[obrigacao.criticidade]} ${obrigacao.ativo === false ? 'opacity-60' : ''}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className={`font-medium text-sm ${obrigacao.ativo === false ? 'line-through' : ''}`}>{obrigacao.titulo}</h4>
                        <Badge variant="outline" className="text-xs">
                          {obrigacao.subcategoria?.toUpperCase()}
                        </Badge>
                        {obrigacao.ativo === false && (
                          <Badge variant="secondary" className="text-xs">Inativa</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{obrigacao.descricao}</p>
                      {obrigacao.base_legal && (
                        <p className="text-xs text-primary mt-1">📜 {obrigacao.base_legal}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50">
                        <Switch
                          checked={obrigacao.ativo !== false}
                          onCheckedChange={(checked) => handleToggleAtivo(obrigacao, checked)}
                          disabled={updateObrigacao.isPending}
                        />
                        <span className="text-xs text-muted-foreground">
                          {obrigacao.ativo !== false ? 'Ativa' : 'Inativa'}
                        </span>
                      </div>

                      <Badge className={`${statusConf.color} text-xs`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusConf.label}
                      </Badge>
                      
                      {isTac && onTabChange && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onTabChange('indicadores')}
                          className="text-xs h-8"
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Editar TAC
                        </Button>
                      )}

                      {!obrigacao.acao_gerada_id && obrigacao.status !== 'conforme' && obrigacao.status !== 'nao_aplicavel' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCriarAcao(obrigacao)}
                          disabled={criarAcaoDeObrigacao.isPending}
                          className="text-xs h-8"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Criar Ação
                        </Button>
                      )}
                      {obrigacao.acao_gerada_id && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => navigate(`/plano-acao/${obrigacao.acao_gerada_id}`)}
                          className="text-xs h-8"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Abrir Ação
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setToDelete(obrigacao); setConfirmText(''); }}
                        className="text-xs h-8 text-destructive hover:text-destructive"
                        title="Excluir obrigação"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}