import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import SignatureCanvas from 'react-signature-canvas';
import { CheckCircle2, FileText, PenLine, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AssinaturaContrato() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const sigRef = useRef<SignatureCanvas>(null);
  const [etapa, setEtapa] = useState<'leitura' | 'assinatura' | 'concluido'>('leitura');
  const [nome, setNome] = useState('');

  const { data: contrato, isLoading, error } = useQuery({
    queryKey: ['contrato-publico', token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('programa_validador_contratos' as never)
        .select('*, programa_validador_clientes(nome_empresa, poc_nome, poc_email, onboarding_token)')
        .eq('token', token!)
        .single() as any;
      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });

  const assinarMutation = useMutation({
    mutationFn: async () => {
      if (!sigRef.current || sigRef.current.isEmpty()) {
        throw new Error('Por favor, assine o contrato antes de confirmar.');
      }
      const assinaturaImg = sigRef.current.toDataURL('image/png');
      const agora = new Date().toISOString();
      const dataFormatada = format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });

      const blocoAssinatura = `
        <div style="margin-top:60px;padding:20px;border-top:2px solid #000;font-family:Arial,sans-serif;">
          <p style="font-weight:bold;font-size:14px;">ASSINATURA ELETRÔNICA</p>
          <img src="${assinaturaImg}" style="max-width:300px;border-bottom:1px solid #333;display:block;" alt="Assinatura" />
          <p style="margin-top:8px;font-size:12px;"><strong>${nome || contrato?.programa_validador_clientes?.poc_nome || 'Signatário'}</strong></p>
          <p style="font-size:11px;color:#555;">Assinado digitalmente em ${dataFormatada}</p>
          <p style="font-size:10px;color:#888;">Token do contrato: ${token}</p>
        </div>
      `;

      const htmlFinal = (contrato.html_contrato || '') + blocoAssinatura;

      const { error } = await supabase
        .from('programa_validador_contratos' as never)
        .update({
          status: 'assinado',
          assinatura_img: assinaturaImg,
          assinado_em: agora,
          assinado_por: nome || contrato?.programa_validador_clientes?.poc_nome,
          html_assinado: htmlFinal,
        } as never)
        .eq('token', token!) as any;

      if (error) throw error;

      // Registrar no histórico
      await supabase.from('programa_validador_historico' as never).insert({
        cliente_id: contrato.cliente_id,
        tipo: 'contrato_assinado',
        titulo: 'Contrato assinado eletronicamente',
        descricao: `Assinado por: ${nome || contrato?.programa_validador_clientes?.poc_nome} em ${dataFormatada}`,
        autor: nome || contrato?.programa_validador_clientes?.poc_nome,
      } as never);
    },
    onSuccess: () => {
      setEtapa('concluido');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando contrato...</p>
      </div>
    );
  }

  if (error || !contrato) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-destructive opacity-60" />
            <h2 className="text-xl font-bold mb-2">Contrato não encontrado</h2>
            <p className="text-muted-foreground text-sm">O link pode ter expirado ou ser inválido.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (contrato.status === 'assinado') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-primary" />
            <h2 className="text-xl font-bold mb-2">Contrato já assinado</h2>
            <p className="text-muted-foreground text-sm">
              Este contrato já foi assinado em{' '}
              {contrato.assinado_em
                ? format(new Date(contrato.assinado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                : ''}
              {contrato.assinado_por ? ` por ${contrato.assinado_por}` : ''}.
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
            <h2 className="text-2xl font-bold mb-3">Contrato assinado!</h2>
            <p className="text-muted-foreground">
              Seu contrato de participação no <strong>Programa Validador Seguramente</strong> foi registrado com sucesso.
            </p>
            <p className="text-sm text-muted-foreground mt-3">
              Você receberá as instruções de acesso em breve.
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
          <h1 className="text-2xl font-bold">Contrato de Participação</h1>
          <p className="text-muted-foreground text-sm">Programa Validador Beta</p>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-center gap-4 text-sm">
          <div className={`flex items-center gap-1.5 ${etapa === 'leitura' ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${etapa === 'leitura' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>1</span>
            Leitura
          </div>
          <div className="h-px w-8 bg-border" />
          <div className={`flex items-center gap-1.5 ${etapa === 'assinatura' ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${etapa === 'assinatura' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>2</span>
            Assinatura
          </div>
        </div>

        {etapa === 'leitura' && (
          <Card>
            <CardContent className="p-0">
              <div
                className="prose prose-sm max-w-none p-6 max-h-[60vh] overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: contrato.html_contrato }}
              />
              <div className="p-4 border-t bg-muted/30 flex justify-end">
                <Button onClick={() => setEtapa('assinatura')}>
                  Li e compreendi o contrato
                  <PenLine className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {etapa === 'assinatura' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <PenLine className="w-4 h-4" />
                Assine abaixo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Seu nome completo</label>
                <input
                  type="text"
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm bg-background"
                  placeholder={contrato?.programa_validador_clientes?.poc_nome || 'Nome do signatário'}
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium">Assinatura</label>
                  <button
                    onClick={() => sigRef.current?.clear()}
                    className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Limpar
                  </button>
                </div>
                <div className="border-2 border-dashed rounded-lg overflow-hidden bg-white">
                  <SignatureCanvas
                    ref={sigRef}
                    canvasProps={{ className: 'w-full', height: 180 }}
                    backgroundColor="white"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Desenhe sua assinatura com o mouse ou dedo</p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setEtapa('leitura')}>
                  Voltar
                </Button>
                <Button
                  className="flex-1"
                  disabled={assinarMutation.isPending}
                  onClick={() => assinarMutation.mutate()}
                >
                  {assinarMutation.isPending ? 'Registrando...' : 'Confirmar Assinatura'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
