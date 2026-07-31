import { useMemo, useState } from 'react';
import {
  CheckCircle2, XCircle, AlertTriangle, Loader2, Eye, History, Hand, CalendarClock,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useYourEyes, YourEyesExecucao } from '@/hooks/useYourEyes';

function ExecucaoStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'executando':
      return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Executando</Badge>;
    case 'sucesso':
      return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"><CheckCircle2 className="w-3 h-3 mr-1" />Sucesso</Badge>;
    case 'atencao':
      return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20"><AlertTriangle className="w-3 h-3 mr-1" />Atenção</Badge>;
    case 'falha':
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Falha</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

const PASSO_ICONE: Record<string, JSX.Element> = {
  ok: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />,
  falha: <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />,
  atencao: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />,
  manual: <Hand className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />,
};

export function YourEyesExecucoesPanel() {
  const { execucoes, agentes, isLoadingExecucoes } = useYourEyes();
  const [detalhe, setDetalhe] = useState<YourEyesExecucao | null>(null);

  const agentesPorId = useMemo(
    () => new Map(agentes.map((a) => [a.id, a])),
    [agentes]
  );

  const agenteDetalhe = detalhe ? agentesPorId.get(detalhe.agente_id) : null;

  return (
    <Card>
      <CardContent className="pt-6">
        {isLoadingExecucoes ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />Carregando histórico...
          </div>
        ) : execucoes.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <History className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhuma execução registrada</p>
            <p className="text-sm">As execuções manuais e agendadas dos agentes aparecerão aqui.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agente</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Score</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {execucoes.map((ex) => {
                const agente = agentesPorId.get(ex.agente_id);
                const duracao = ex.finalizado_em
                  ? Math.round((new Date(ex.finalizado_em).getTime() - new Date(ex.iniciado_em).getTime()) / 1000)
                  : null;
                return (
                  <TableRow key={ex.id}>
                    <TableCell className="font-medium">
                      <span className="mr-1.5">{agente?.emoji || '🤖'}</span>
                      {agente?.nome || 'Agente removido'}
                    </TableCell>
                    <TableCell>
                      {ex.origem === 'agendada'
                        ? <Badge variant="outline" className="text-[10px]"><CalendarClock className="w-3 h-3 mr-1" />Agendada</Badge>
                        : <Badge variant="secondary" className="text-[10px]"><Hand className="w-3 h-3 mr-1" />Manual</Badge>}
                    </TableCell>
                    <TableCell><ExecucaoStatusBadge status={ex.status} /></TableCell>
                    <TableCell className="text-center">
                      {ex.score !== null ? (
                        <span className={`font-semibold ${ex.score >= 80 ? 'text-emerald-600' : ex.score >= 50 ? 'text-amber-600' : 'text-destructive'}`}>
                          {ex.score}
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(ex.iniciado_em), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-xs">{duracao !== null ? `${duracao}s` : '—'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => setDetalhe(ex)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Detalhe da execução */}
      <Dialog open={!!detalhe} onOpenChange={(v) => !v && setDetalhe(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-xl">{agenteDetalhe?.emoji || '🤖'}</span>
              {agenteDetalhe?.nome || 'Execução'}
            </DialogTitle>
            <DialogDescription>
              {detalhe && format(new Date(detalhe.iniciado_em), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
              {detalhe && ` · ${detalhe.origem === 'agendada' ? 'execução agendada' : 'execução manual'}`}
            </DialogDescription>
          </DialogHeader>

          {detalhe && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <ExecucaoStatusBadge status={detalhe.status} />
                {detalhe.score !== null && (
                  <Badge variant="outline">Score: {detalhe.score}/100</Badge>
                )}
                {detalhe.resultado?.varredura && (
                  <span className="text-xs text-muted-foreground">
                    Varredura: {detalhe.resultado.varredura.criticos} crítico(s), {detalhe.resultado.varredura.altos} alto(s)
                  </span>
                )}
              </div>

              {detalhe.resumo && (
                <div className="border rounded-md p-3 bg-muted/30 prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{detalhe.resumo}</ReactMarkdown>
                </div>
              )}

              {(detalhe.resultado?.passos?.length || 0) > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Passos do roteiro</p>
                  <div className="space-y-1.5">
                    {detalhe.resultado!.passos!.map((passo, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm border rounded-md p-2.5">
                        {PASSO_ICONE[passo.status] || PASSO_ICONE.manual}
                        <div className="min-w-0">
                          <p className="font-medium">{passo.titulo}</p>
                          {passo.detalhes && <p className="text-xs text-muted-foreground">{passo.detalhes}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Passos marcados como "manual" exigem verificação humana na interface — o agente não inventa resultados para eles.
                  </p>
                </div>
              )}

              {(detalhe.resultado?.recomendacoes?.length || 0) > 0 && (
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold">Recomendações</p>
                  <ul className="list-disc ml-5 text-sm space-y-1">
                    {detalhe.resultado!.recomendacoes!.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
