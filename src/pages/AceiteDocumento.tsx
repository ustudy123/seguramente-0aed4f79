import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { CheckCircle2, FileText, ThumbsUp, ThumbsDown, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AceiteDocumento() {
  const { token } = useParams<{ token: string }>();
  const [etapa, setEtapa] = useState<'leitura' | 'concluido' | 'recusado'>('leitura');
  const [nome, setNome] = useState('');
  const [motivo, setMotivo] = useState('');
  const [confirmandoRecusa, setConfirmandoRecusa] = useState(false);

  const { data: link, isLoading, error } = useQuery({
    queryKey: ['doc-link', token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('programa_validador_documento_links' as never)
        .select('*, programa_validador_clientes(nome_empresa, poc_nome, poc_email)')
        .eq('token', token!)
        .single() as any;
      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });

  const aceitarMutation = useMutation({
    mutationFn: async () => {
      const agora = new Date().toISOString();
      const { error } = await supabase
        .from('programa_validador_documento_links' as never)
        .update({
          status: 'aceito',
          aceito_em: agora,
          aceito_por: nome || link?.programa_validador_clientes?.poc_nome || 'Signatário',
        } as never)
        .eq('token', token!) as any;
      if (error) throw error;

      // Atualizar status do documento vinculado
      if (link?.documento_id) {
        await supabase
          .from('programa_validador_documentos')
          .update({ status: 'aceito', aceito_em: agora })
          .eq('id', link.documento_id);
      } else {
        // Upsert documento
        const { data: existing } = await supabase
          .from('programa_validador_documentos')
          .select('id')
          .eq('cliente_id', link.cliente_id)
          .eq('tipo', link.tipo)
          .single();
        if (existing) {
          await supabase
            .from('programa_validador_documentos')
            .update({ status: 'aceito', aceito_em: agora })
            .eq('id', existing.id);
        } else {
          await supabase.from('programa_validador_documentos').insert({
            cliente_id: link.cliente_id,
            tipo: link.tipo,
            status: 'aceito',
            enviado_em: agora,
            aceito_em: agora,
          });
        }
      }

      // Histórico
      await supabase.from('programa_validador_historico' as never).insert({
        cliente_id: link.cliente_id,
        tipo: 'documento_aceito',
        titulo: `Documento aceito eletronicamente`,
        descricao: `Tipo: ${link.tipo} | Aceito por: ${nome || link?.programa_validador_clientes?.poc_nome}`,
        autor: nome || link?.programa_validador_clientes?.poc_nome,
      } as never);
    },
    onSuccess: () => setEtapa('concluido'),
    onError: (err: Error) => toast.error(err.message),
  });

  const recusarMutation = useMutation({
    mutationFn: async () => {
      const agora = new Date().toISOString();
      const { error } = await supabase
        .from('programa_validador_documento_links' as never)
        .update({
          status: 'recusado',
          recusado_em: agora,
          motivo_recusa: motivo || 'Não informado',
        } as never)
        .eq('token', token!) as any;
      if (error) throw error;

      await supabase.from('programa_validador_historico' as never).insert({
        cliente_id: link.cliente_id,
        tipo: 'documento_recusado',
        titulo: `Documento recusado`,
        descricao: `Tipo: ${link.tipo} | Motivo: ${motivo || 'Não informado'}`,
        autor: link?.programa_validador_clientes?.poc_nome || 'Destinatário',
      } as never);
    },
    onSuccess: () => setEtapa('recusado'),
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando documento...</p>
      </div>
    );
  }

  if (error || !link) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive opacity-60" />
            <h2 className="text-xl font-bold mb-2">Link inválido</h2>
            <p className="text-muted-foreground text-sm">Este link pode ter expirado ou ser inválido.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (link.status === 'aceito') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-primary" />
            <h2 className="text-xl font-bold mb-2">Documento já aceito</h2>
            <p className="text-muted-foreground text-sm">
              Este documento foi aceito em{' '}
              {link.aceito_em ? format(new Date(link.aceito_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : ''}
              {link.aceito_por ? ` por ${link.aceito_por}` : ''}.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (etapa === 'concluido') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-6 text-primary" />
            <h2 className="text-2xl font-bold mb-3">Documento aceito!</h2>
            <p className="text-muted-foreground">
              Obrigado. Seu aceite foi registrado com sucesso no <strong>Programa Validador Seguramente</strong>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (etapa === 'recusado') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <ThumbsDown className="w-16 h-16 mx-auto mb-6 text-destructive" />
            <h2 className="text-2xl font-bold mb-3">Recusa registrada</h2>
            <p className="text-muted-foreground">
              Sua recusa foi registrada. Nossa equipe entrará em contato em breve.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            <span className="font-semibold text-primary">Seguramente</span>
          </div>
          <h1 className="text-2xl font-bold">Documento para Aceite</h1>
          <p className="text-muted-foreground text-sm">Programa Validador Beta</p>
        </div>

        {/* Documento */}
        <Card>
          <CardContent className="p-0">
            <div
              className="prose prose-sm max-w-none p-6 max-h-[60vh] overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: link.html_documento }}
            />
            <div className="p-4 border-t bg-muted/30 space-y-4">
              <div>
                <label className="text-sm font-medium">Seu nome completo</label>
                <input
                  type="text"
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm bg-background"
                  placeholder={link?.programa_validador_clientes?.poc_nome || 'Nome do responsável'}
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                />
              </div>

              {confirmandoRecusa ? (
                <div className="space-y-3 p-3 border border-destructive/30 rounded-lg bg-destructive/5">
                  <p className="text-sm font-medium text-destructive">Confirmar recusa do documento?</p>
                  <textarea
                    className="w-full px-3 py-2 border rounded-md text-sm bg-background resize-none"
                    placeholder="Motivo da recusa (opcional)..."
                    rows={3}
                    value={motivo}
                    onChange={e => setMotivo(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setConfirmandoRecusa(false)}>Cancelar</Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={recusarMutation.isPending}
                      onClick={() => recusarMutation.mutate()}
                    >
                      {recusarMutation.isPending ? 'Registrando...' : 'Confirmar Recusa'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setConfirmandoRecusa(true)}
                  >
                    <ThumbsDown className="w-4 h-4 mr-2" />
                    Recusar
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={aceitarMutation.isPending}
                    onClick={() => aceitarMutation.mutate()}
                  >
                    {aceitarMutation.isPending ? 'Registrando...' : (
                      <>
                        <ThumbsUp className="w-4 h-4 mr-2" />
                        Aceitar Documento
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
