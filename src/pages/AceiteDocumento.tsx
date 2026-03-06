import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { CheckCircle2, FileText, ThumbsDown, AlertCircle, PenLine, RotateCcw, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import SignatureCanvas from 'react-signature-canvas';

export default function AceiteDocumento() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const sigRef = useRef<SignatureCanvas>(null);
  const [nome, setNome] = useState('');
  const [motivo, setMotivo] = useState('');
  const [confirmandoRecusa, setConfirmandoRecusa] = useState(false);
  const [etapa, setEtapa] = useState<'leitura' | 'assinatura' | 'recusado'>('leitura');

  const { data: link, isLoading, error } = useQuery({
    queryKey: ['doc-link', token],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .rpc('buscar_documento_link_por_token', { p_token: token! });
      if (error) throw error;
      const row = rows?.[0];
      if (!row) throw new Error('Documento não encontrado');
      // Map RPC result to the shape the component expects
      return {
        ...row,
        programa_validador_clientes: {
          nome_empresa: row.cliente_nome_empresa,
          poc_nome: row.cliente_poc_nome,
          poc_email: row.cliente_poc_email,
          onboarding_token: row.cliente_onboarding_token,
          tenant_id: row.cliente_tenant_id,
        },
      };
    },
    enabled: !!token,
  });

  const aceitarMutation = useMutation({
    mutationFn: async () => {
      if (sigRef.current && sigRef.current.isEmpty()) {
        throw new Error('Por favor, assine o documento antes de confirmar.');
      }

      const agora = new Date().toISOString();
      const dataFormatada = format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
      const signatario = nome || link?.programa_validador_clientes?.poc_nome || 'Signatário';

      // Gerar HTML assinado injetando bloco de assinatura
      let htmlAssinado = link?.html_documento || '';
      if (sigRef.current && !sigRef.current.isEmpty()) {
        const assinaturaImg = sigRef.current.toDataURL('image/png');
        const blocoAssinatura = `
          <div style="margin-top:60px;padding:20px;border-top:2px solid #333;font-family:'Times New Roman',serif;">
            <p style="font-weight:bold;font-size:13pt;text-transform:uppercase;">Assinatura Eletrônica</p>
            <img src="${assinaturaImg}" style="max-width:300px;border-bottom:1px solid #333;display:block;margin:12px 0;" alt="Assinatura" />
            <p style="font-size:12pt;font-weight:bold;">${signatario}</p>
            <p style="font-size:11pt;color:#555;">Assinado digitalmente em ${dataFormatada}</p>
            <p style="font-size:10pt;color:#888;">Token do documento: ${token}</p>
          </div>`;
        htmlAssinado = (htmlAssinado || '').replace(/<\/body>/, blocoAssinatura + '</body>');
        if (!htmlAssinado.includes(blocoAssinatura)) htmlAssinado += blocoAssinatura;
      }

      const { error } = await supabase
        .rpc('atualizar_documento_link_por_token', {
          p_token: token!,
          p_status: 'aceito',
          p_html_assinado: htmlAssinado,
          p_assinante_nome: signatario,
        });
      if (error) throw error;

      // Atualizar documento vinculado
      if ((link as any)?.documento_id) {
        await supabase
          .from('programa_validador_documentos')
          .update({ status: 'aceito', aceito_em: agora })
          .eq('id', (link as any).documento_id);
      } else {
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
        titulo: `Ata de Kickoff assinada eletronicamente`,
        descricao: `Assinado por: ${signatario} em ${dataFormatada}`,
        autor: signatario,
      } as never);
    },
    onSuccess: async () => {
      // Salvar no módulo de Documentos da empresa (tenant do cliente)
      try {
        const tenantId = link?.programa_validador_clientes?.tenant_id;
        const nomeEmpresa = link?.programa_validador_clientes?.nome_empresa || 'Empresa';
        if (tenantId) {
          // Buscar pasta raiz "Governança e Administração"
          const { data: govPasta } = await supabase
            .from('documento_pastas')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('nome', 'Governança e Administração')
            .is('pasta_pai_id', null)
            .maybeSingle();

          // Buscar "Estrutura Organizacional" dentro de Governança
          let pastaDestino: { id: string } | null = null;
          if (govPasta?.id) {
            const { data: estOrgPasta } = await supabase
              .from('documento_pastas')
              .select('id')
              .eq('tenant_id', tenantId)
              .eq('nome', 'Estrutura Organizacional')
              .eq('pasta_pai_id', govPasta.id)
              .maybeSingle();
            pastaDestino = estOrgPasta;
          }

          if (!pastaDestino && govPasta?.id) pastaDestino = govPasta;
          if (!pastaDestino) {
            const { data: fallback } = await supabase
              .from('documento_pastas')
              .insert({ tenant_id: tenantId, nome: 'Contratos', tipo: 'categoria', icone: 'FileText' })
              .select('id').single();
            pastaDestino = fallback;
          }

          if (pastaDestino?.id) {
            const { data: updatedLink } = await supabase
              .from('programa_validador_documento_links' as never)
              .select('html_assinado, html_documento')
              .eq('token', token!)
              .single() as any;

            const htmlFinal = updatedLink?.html_assinado || link?.html_documento || '';
            const nomeArq = `Ata-Kickoff-${nomeEmpresa.replace(/\s+/g, '-')}-Assinada.html`;
            const storagePath = `programa-validador/${tenantId}/atas/${nomeArq}`;

            const blob = new Blob([htmlFinal], { type: 'text/html' });
            await supabase.storage.from('documentos').upload(storagePath, blob, { contentType: 'text/html', upsert: true });

            const { data: docExistente } = await supabase
              .from('documentos').select('id').eq('tenant_id', tenantId).eq('storage_path', storagePath).maybeSingle();

            if (!docExistente) {
              await supabase.from('documentos').insert({
                tenant_id: tenantId,
                pasta_id: pastaDestino.id,
                nome_arquivo: nomeArq,
                nome_original: nomeArq,
                storage_path: storagePath,
                mime_type: 'text/html',
                tamanho: blob.size,
                tipo: 'ata_kickoff',
                status: 'ativo',
                colaborador_nome: nomeEmpresa,
                versao_atual: 1,
                total_versoes: 1,
              });
            }
          }
        }
      } catch (e) {
        console.error('Erro ao salvar ata no módulo de documentos:', e);
      }

      const onboardingToken = link?.programa_validador_clientes?.onboarding_token;
      toast.success('Ata assinada com sucesso!');
      if (onboardingToken) {
        navigate(`/onboarding-cliente/${onboardingToken}`);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const recusarMutation = useMutation({
    mutationFn: async () => {
      const agora = new Date().toISOString();
      const { error } = await supabase
        .rpc('atualizar_documento_link_por_token', {
          p_token: token!,
          p_status: 'recusado',
        });
      if (error) throw error;

      await supabase.from('programa_validador_historico' as never).insert({
        cliente_id: link.cliente_id,
        tipo: 'documento_recusado',
        titulo: `Ata de Kickoff recusada`,
        descricao: `Motivo: ${motivo || 'Não informado'}`,
        autor: link?.programa_validador_clientes?.poc_nome || 'Destinatário',
      } as never);
    },
    onSuccess: () => setEtapa('recusado'),
    onError: (err: Error) => toast.error(err.message),
  });

  const downloadDocumento = (html: string, nomeArq: string) => {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArq;
    a.click();
    URL.revokeObjectURL(url);
  };

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

  // Já assinado — mostrar confirmação + botão de download
  if (link.status === 'aceito') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle2 className="w-14 h-14 mx-auto text-primary" />
            <div>
              <h2 className="text-xl font-bold mb-1">Ata já assinada</h2>
              <p className="text-muted-foreground text-sm">
                Assinada em{' '}
                {link.aceito_em ? format(new Date(link.aceito_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : ''}
                {(link as any)?.aceito_por ? ` por ${(link as any).aceito_por}` : ''}.
              </p>
            </div>
            {(link.html_assinado || link.html_documento) && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => downloadDocumento(
                  link.html_assinado || link.html_documento,
                  'Ata-Kickoff-Assinada.html'
                )}
              >
                <Download className="w-4 h-4 mr-2" />
                Baixar Ata Assinada
              </Button>
            )}
            {link?.programa_validador_clientes?.onboarding_token && (
              <Button
                variant="ghost"
                className="w-full text-sm"
                onClick={() => navigate(`/onboarding-cliente/${link.programa_validador_clientes.onboarding_token}`)}
              >
                ← Voltar ao portal
              </Button>
            )}
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
            {link?.programa_validador_clientes?.onboarding_token && (
              <Button
                variant="ghost"
                className="w-full mt-4 text-sm"
                onClick={() => navigate(`/onboarding-cliente/${link.programa_validador_clientes.onboarding_token}`)}
              >
                ← Voltar ao portal
              </Button>
            )}
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
          <h1 className="text-2xl font-bold">Ata de Kickoff</h1>
          <p className="text-muted-foreground text-sm">
            {link?.programa_validador_clientes?.nome_empresa} · Programa Validador Beta
          </p>
        </div>

        {/* Etapa leitura */}
        {etapa === 'leitura' && (
          <Card>
            <CardContent className="p-0">
              <div
                className="prose prose-sm max-w-none p-6 max-h-[60vh] overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: link.html_documento }}
              />
              <div className="p-4 border-t bg-muted/30 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Leia o documento completo acima e, se estiver de acordo, prossiga para assinar.
                </p>
                {confirmandoRecusa ? (
                  <div className="space-y-3 p-3 border border-destructive/30 rounded-lg bg-destructive/5">
                    <p className="text-sm font-medium text-destructive">Confirmar recusa da Ata?</p>
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
                    <Button variant="outline" className="flex-1" onClick={() => setConfirmandoRecusa(true)}>
                      <ThumbsDown className="w-4 h-4 mr-2" />
                      Recusar
                    </Button>
                    <Button className="flex-1" onClick={() => setEtapa('assinatura')}>
                      <PenLine className="w-4 h-4 mr-2" />
                      Prosseguir para Assinar
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Etapa assinatura */}
        {etapa === 'assinatura' && (
          <Card>
            <CardContent className="p-6 space-y-5">
              <button
                onClick={() => setEtapa('leitura')}
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                ← Voltar para leitura
              </button>

              <div>
                <label className="text-sm font-medium block mb-1">Seu nome completo</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                  placeholder={link?.programa_validador_clientes?.poc_nome || 'Nome do responsável'}
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium">Assinatura</label>
                  <button
                    type="button"
                    onClick={() => sigRef.current?.clear()}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Limpar
                  </button>
                </div>
                <div className="border-2 border-dashed border-border rounded-lg bg-muted/20 overflow-hidden">
                  <SignatureCanvas
                    ref={sigRef}
                    canvasProps={{
                      width: 600,
                      height: 180,
                      className: 'w-full',
                      style: { touchAction: 'none' },
                    }}
                    backgroundColor="transparent"
                    penColor="#1a1a1a"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Assine com o mouse ou dedo na área acima
                </p>
              </div>

              <Button
                className="w-full"
                disabled={aceitarMutation.isPending}
                onClick={() => aceitarMutation.mutate()}
              >
                {aceitarMutation.isPending ? (
                  'Registrando assinatura...'
                ) : (
                  <>
                    <PenLine className="w-4 h-4 mr-2" />
                    Assinar e Confirmar Ata de Kickoff
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
