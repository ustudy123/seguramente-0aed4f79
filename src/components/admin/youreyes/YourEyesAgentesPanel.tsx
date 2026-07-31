import { useState } from 'react';
import {
  Bot, Plus, Play, Edit, Trash2, MoreVertical, Loader2, CalendarClock,
  CheckCircle2, XCircle, AlertTriangle, FileText, Clock,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { descreverAgendamento, getModuloLabel } from '@/lib/youreyes-modulos';
import { useYourEyes, YourEyesAgente } from '@/hooks/useYourEyes';
import { AgenteFormDialog } from './AgenteFormDialog';

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge variant="outline" className="text-[10px]">Nunca executado</Badge>;
  switch (status) {
    case 'sucesso':
      return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]"><CheckCircle2 className="w-3 h-3 mr-1" />Sucesso</Badge>;
    case 'atencao':
      return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]"><AlertTriangle className="w-3 h-3 mr-1" />Atenção</Badge>;
    case 'falha':
      return <Badge variant="destructive" className="text-[10px]"><XCircle className="w-3 h-3 mr-1" />Falha</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
  }
}

export function YourEyesAgentesPanel() {
  const {
    agentes, documentos, isLoading,
    alternarAgente, excluirAgente, executarAgente, executandoAgenteId,
  } = useYourEyes();

  const [showForm, setShowForm] = useState(false);
  const [agenteEditando, setAgenteEditando] = useState<YourEyesAgente | null>(null);
  const [agenteExcluindo, setAgenteExcluindo] = useState<YourEyesAgente | null>(null);

  const handleExecutar = async (agente: YourEyesAgente) => {
    toast.info(`${agente.emoji} ${agente.nome} iniciou a execução dos testes...`);
    try {
      const result = await executarAgente(agente.id);
      if (result?.status === 'sucesso') toast.success(`${agente.nome}: execução concluída com sucesso (score ${result.score ?? '—'})`);
      else if (result?.status === 'atencao') toast.warning(`${agente.nome}: execução concluída com pontos de atenção (score ${result.score ?? '—'})`);
      else toast.error(`${agente.nome}: execução detectou falhas`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao executar agente');
    }
  };

  const handleAlternar = async (agente: YourEyesAgente) => {
    try {
      await alternarAgente({ id: agente.id, ativo: !agente.ativo });
      toast.success(agente.ativo ? `${agente.nome} pausado` : `${agente.nome} ativado — agendamento retomado`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao alterar agente');
    }
  };

  const handleExcluir = async () => {
    if (!agenteExcluindo) return;
    try {
      await excluirAgente(agenteExcluindo.id);
      toast.success('Agente removido da equipe');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao excluir agente');
    } finally {
      setAgenteExcluindo(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {agentes.length === 0
            ? 'Monte sua equipe de agentes de teste'
            : `${agentes.filter((a) => a.ativo).length} de ${agentes.length} agente(s) ativo(s)`}
        </p>
        <Button
          size="sm"
          onClick={() => { setAgenteEditando(null); setShowForm(true); }}
          disabled={documentos.length === 0}
          title={documentos.length === 0 ? 'Crie primeiro um documento de teste na aba Documentação' : undefined}
        >
          <Plus className="w-4 h-4 mr-2" />Novo Agente
        </Button>
      </div>

      {documentos.length === 0 && (
        <div className="border border-dashed rounded-lg p-4 text-sm text-muted-foreground flex items-center gap-3">
          <FileText className="w-5 h-5 shrink-0" />
          <span>
            O primeiro passo é criar a <strong>documentação de teste</strong> na aba "Documentação".
            Todo agente nasce a partir de um ou mais documentos de teste.
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />Carregando equipe...
        </div>
      ) : agentes.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Bot className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nenhum agente na equipe ainda</p>
          <p className="text-sm">Crie a documentação de teste e depois monte o primeiro agente.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agentes.map((agente) => {
            const executando = executandoAgenteId === agente.id;
            const docsDoAgente = documentos.filter((d) => agente.documento_ids?.includes(d.id));
            return (
              <Card key={agente.id} className={`relative transition-opacity ${!agente.ativo ? 'opacity-60' : ''}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-2xl shrink-0">
                      {agente.emoji || '🤖'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{agente.nome}</p>
                      <p className="text-xs text-muted-foreground truncate">{getModuloLabel(agente.modulo)}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setAgenteEditando(agente); setShowForm(true); }}>
                          <Edit className="w-4 h-4 mr-2" />Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setAgenteExcluindo(agente)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {agente.descricao && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{agente.descricao}</p>
                  )}

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                      {descreverAgendamento(agente)}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                      {docsDoAgente.length} documento(s) de teste
                    </div>
                    {agente.ativo && agente.proxima_execucao && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        Próxima: {format(new Date(agente.proxima_execucao), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={agente.ultimo_status} />
                      {agente.ultima_execucao && (
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(agente.ultima_execucao), 'dd/MM HH:mm', { locale: ptBR })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Switch
                        checked={agente.ativo}
                        onCheckedChange={() => handleAlternar(agente)}
                        aria-label={agente.ativo ? 'Pausar agente' : 'Ativar agente'}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        disabled={executando}
                        onClick={() => handleExecutar(agente)}
                      >
                        {executando
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Play className="w-3.5 h-3.5" />}
                        <span className="ml-1.5">{executando ? 'Executando...' : 'Executar'}</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AgenteFormDialog open={showForm} onOpenChange={setShowForm} agente={agenteEditando} />

      <AlertDialog open={!!agenteExcluindo} onOpenChange={(v) => !v && setAgenteExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agente?</AlertDialogTitle>
            <AlertDialogDescription>
              O agente "{agenteExcluindo?.nome}" e todo o seu histórico de execuções serão removidos.
              A documentação de teste vinculada NÃO será excluída.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleExcluir}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
