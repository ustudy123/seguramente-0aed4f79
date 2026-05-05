import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { SuperAdminRoute } from '@/components/admin/SuperAdminRoute';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Plus, Search, Users, Building2, Clock, CheckCircle2,
  XCircle, AlertCircle, ChevronRight, ArrowLeft, FileText,
  MessageSquare, Phone, Mail, Calendar, Shield,
  LayoutList, Columns, ChevronLeft, Send, ExternalLink, Download, Loader2, Printer,
} from 'lucide-react';
import { format } from 'date-fns';
import { formatCnpj, cleanCnpj, buscarCnpj } from '@/lib/brasilapi';
import { ptBR } from 'date-fns/locale';
import { AtaKickoffDialog } from '@/components/admin/AtaKickoffDialog';
import { Link } from 'react-router-dom';

// Imports refatorados
import type { Fase, TipoDoc, Cliente, Contrato, Documento, Historico, DocumentoLink } from './programa-validador/types';
import { FASES, DOCS_CONFIG_TESTER, DOCS_CONFIG_PAGANTE } from './programa-validador/constants';
import { gerarHtmlContrato, gerarHtmlDocumento } from './programa-validador/contractTemplates';
import { FaseBadge, DocStatusIcon, KanbanCard } from './programa-validador/components';

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProgramaValidador() {
  const { profile } = useAuthContext();
  const qc = useQueryClient();
  const [busca, setBusca] = useState('');
  const [faseFilter, setFaseFilter] = useState<Fase | 'todas'>('todas');
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [showNovoCliente, setShowNovoCliente] = useState(false);
  const [viewMode, setViewMode] = useState<'lista' | 'kanban'>('kanban');

  // ── Queries ──
  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['validador', 'clientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('programa_validador_clientes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Cliente[];
    },
  });

  const { data: documentos = [] } = useQuery({
    queryKey: ['validador', 'docs', clienteSelecionado?.id],
    enabled: !!clienteSelecionado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('programa_validador_documentos')
        .select('*')
        .eq('cliente_id', clienteSelecionado!.id);
      if (error) throw error;
      return data as Documento[];
    },
  });

  const { data: historico = [] } = useQuery({
    queryKey: ['validador', 'historico', clienteSelecionado?.id],
    enabled: !!clienteSelecionado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('programa_validador_historico')
        .select('*')
        .eq('cliente_id', clienteSelecionado!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Historico[];
    },
  });

  const { data: contratos = [] } = useQuery({
    queryKey: ['validador', 'contratos', clienteSelecionado?.id],
    enabled: !!clienteSelecionado,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('programa_validador_contratos' as any)
        .select('*')
        .eq('cliente_id', clienteSelecionado!.id)
        .order('created_at', { ascending: false }) as any;
      if (error) throw error;
      return (data || []) as Contrato[];
    },
  });

  // ── Mover fase (kanban) ──
  const moverFaseMutation = useMutation({
    mutationFn: async ({ id, fase }: { id: string; fase: Fase }) => {
      const clienteAtual = clientes.find(c => c.id === id);
      const { error } = await supabase
        .from('programa_validador_clientes')
        .update({ fase })
        .eq('id', id);
      if (error) throw error;
      await supabase.from('programa_validador_historico').insert({
        cliente_id: id,
        tipo: 'fase_alterada',
        titulo: `Fase alterada para "${FASES.find(f => f.value === fase)?.label}"`,
        autor: profile?.nome_completo || 'SuperAdmin',
      });
      if (clienteAtual?.fase === 'qualificacao' && fase === 'kickoff') {
        const html = gerarHtmlContrato(clienteAtual);
        await supabase.from('programa_validador_contratos' as any).insert({
          cliente_id: id,
          html_contrato: html,
          status: 'pendente',
        } as any);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['validador'] });
      toast.success('Fase atualizada!');
    },
    onError: () => toast.error('Erro ao mover cliente'),
  });

  // ── Stats por fase ──
  const porFase = FASES.reduce((acc, f) => {
    acc[f.value] = clientes.filter(c => c.fase === f.value).length;
    return acc;
  }, {} as Record<Fase, number>);

  const clientesFiltrados = clientes.filter(c => {
    const matchBusca = c.nome_empresa.toLowerCase().includes(busca.toLowerCase())
      || (c.poc_nome || '').toLowerCase().includes(busca.toLowerCase());
    const matchFase = faseFilter === 'todas' || c.fase === faseFilter;
    return matchBusca && matchFase;
  });

  if (clienteSelecionado) {
    return (
      <SuperAdminRoute>
        <DetalheCliente
          cliente={clienteSelecionado}
          documentos={documentos}
          historico={historico}
          contratos={contratos}
          onBack={() => setClienteSelecionado(null)}
          onClienteUpdated={(c) => {
            setClienteSelecionado(c);
            qc.invalidateQueries({ queryKey: ['validador'] });
          }}
        />
      </SuperAdminRoute>
    );
  }

  return (
    <SuperAdminRoute>
      <div className="min-h-screen bg-muted/40 p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin">
              <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Programa Validador</h1>
              <p className="text-sm text-muted-foreground">Pipeline de clientes na fase beta</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('lista')}
                className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${viewMode === 'lista' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
              >
                <LayoutList className="w-4 h-4" />
                Lista
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${viewMode === 'kanban' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
              >
                <Columns className="w-4 h-4" />
                Kanban
              </button>
            </div>
            <Dialog open={showNovoCliente} onOpenChange={setShowNovoCliente}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" />Novo Cliente</Button>
              </DialogTrigger>
              <NovoClienteDialog
                onSuccess={() => {
                  setShowNovoCliente(false);
                  qc.invalidateQueries({ queryKey: ['validador'] });
                }}
              />
            </Dialog>
          </div>
        </div>

        {/* KPI cards por fase */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {FASES.map(f => (
            <Card
              key={f.value}
              className={`cursor-pointer transition-all hover:shadow-md ${faseFilter === f.value ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setFaseFilter(faseFilter === f.value ? 'todas' : f.value)}
            >
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">{porFase[f.value] || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">{f.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Busca */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar empresa ou responsável..."
              className="pl-9"
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Carregando...</p>
        ) : viewMode === 'kanban' ? (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {FASES.filter(f => faseFilter === 'todas' || f.value === faseFilter).map(fase => {
                const cards = clientesFiltrados.filter(c => c.fase === fase.value);
                return (
                  <div
                    key={fase.value}
                    className={`w-60 rounded-xl ${fase.border} ${fase.bgKanban} flex flex-col transition-all`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      (e.currentTarget as HTMLElement).classList.add('ring-2', 'ring-primary', 'ring-offset-2');
                    }}
                    onDragLeave={(e) => {
                      (e.currentTarget as HTMLElement).classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      (e.currentTarget as HTMLElement).classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
                      const clienteId = e.dataTransfer.getData('application/cliente-id');
                      if (clienteId) {
                        const cliente = clientes.find(c => c.id === clienteId);
                        if (cliente && cliente.fase !== fase.value) {
                          moverFaseMutation.mutate({ id: clienteId, fase: fase.value });
                        }
                      }
                    }}
                  >
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span className="text-sm font-semibold">{fase.label}</span>
                      <span className="text-xs text-muted-foreground bg-background/60 rounded-full px-2 py-0.5">{cards.length}</span>
                    </div>
                    <div className="flex-1 p-2 space-y-2 min-h-[120px]">
                      {cards.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center pt-4 opacity-60">Vazio</p>
                      ) : (
                        cards.map(c => (
                          <KanbanCard
                            key={c.id}
                            cliente={c}
                            faseAtual={c.fase}
                            onOpen={() => setClienteSelecionado(c)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            {clientesFiltrados.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>Nenhum cliente encontrado</p>
              </div>
            ) : (
              clientesFiltrados.map(c => (
                <Card
                  key={c.id}
                  className="cursor-pointer hover:shadow-md transition-all"
                  onClick={() => setClienteSelecionado(c)}
                >
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{c.nome_empresa}</p>
                        <p className="text-sm text-muted-foreground">
                          {c.poc_nome && `Contato: ${c.poc_nome}`}
                          {c.poc_nome && c.segmento && ' · '}
                          {c.segmento}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {c.data_inicio_piloto && (
                        <span className="text-xs text-muted-foreground hidden sm:block">
                          Início: {format(new Date(c.data_inicio_piloto), 'dd/MM/yyyy')}
                        </span>
                      )}
                      <FaseBadge fase={c.fase} />
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </SuperAdminRoute>
  );
}

// ─── Detalhe do cliente ───────────────────────────────────────────────────────

function DetalheCliente({
  cliente, documentos, historico, contratos, onBack, onClienteUpdated,
}: {
  cliente: Cliente;
  documentos: Documento[];
  historico: Historico[];
  contratos: Contrato[];
  onBack: () => void;
  onClienteUpdated: (c: Cliente) => void;
}) {
  const qc = useQueryClient();
  const { profile } = useAuthContext();
  const [nota, setNota] = useState('');
  const [editandoFase, setEditandoFase] = useState(false);
  const [showGerarContrato, setShowGerarContrato] = useState(false);
  const [gerandoDoc, setGerandoDoc] = useState<TipoDoc | null>(null);
  const [showAtaDialog, setShowAtaDialog] = useState(false);

  const { data: docLinks = [] } = useQuery({
    queryKey: ['validador', 'doc-links', cliente.id],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('programa_validador_documento_links' as any)
        .select('*')
        .eq('cliente_id', cliente.id)
        .order('created_at', { ascending: false }) as any;
      if (error) throw error;
      return (data || []) as DocumentoLink[];
    },
  });

  const atualizarFaseMutation = useMutation({
    mutationFn: async (fase: Fase) => {
      const { data, error } = await supabase
        .from('programa_validador_clientes')
        .update({ fase })
        .eq('id', cliente.id)
        .select()
        .single();
      if (error) throw error;

      await supabase.from('programa_validador_historico').insert({
        cliente_id: cliente.id,
        tipo: 'fase_alterada',
        titulo: `Fase alterada para "${FASES.find(f => f.value === fase)?.label}"`,
        autor: profile?.nome_completo || 'SuperAdmin',
      });

      if (cliente.fase === 'qualificacao' && fase === 'kickoff') {
        const html = gerarHtmlContrato({ ...cliente, fase });
        await supabase.from('programa_validador_contratos' as any).insert({
          cliente_id: cliente.id,
          html_contrato: html,
          status: 'pendente',
        } as any);
      }
      return data;
    },
    onSuccess: (data) => {
      onClienteUpdated(data as Cliente);
      setEditandoFase(false);
      toast.success('Fase atualizada');
      qc.invalidateQueries({ queryKey: ['validador'] });
    },
  });

  const gerarContratoMutation = useMutation({
    mutationFn: async () => {
      const html = gerarHtmlContrato(cliente);
      const { data, error } = await supabase
        .from('programa_validador_contratos' as any)
        .insert({ cliente_id: cliente.id, html_contrato: html, status: 'pendente' } as any)
        .select()
        .single() as any;
      if (error) throw error;
      await supabase.from('programa_validador_historico' as any).insert({
        cliente_id: cliente.id,
        tipo: 'contrato_gerado',
        titulo: 'Contrato gerado para assinatura eletrônica',
        autor: profile?.nome_completo || 'SuperAdmin',
      } as any);
      return data;
    },
    onSuccess: () => {
      toast.success('Contrato gerado! Copie o link e envie para o cliente.');
      setShowGerarContrato(false);
      qc.invalidateQueries({ queryKey: ['validador', 'contratos', cliente.id] });
      qc.invalidateQueries({ queryKey: ['validador', 'historico', cliente.id] });
    },
    onError: (err: Error) => toast.error('Erro ao gerar contrato: ' + err.message),
  });

  const gerarDocLinkMutation = useMutation({
    mutationFn: async ({ tipo, htmlOverride }: { tipo: TipoDoc; htmlOverride?: string }) => {
      const html = htmlOverride ?? gerarHtmlDocumento(tipo, cliente);
      const docExistente = documentos.find(d => d.tipo === tipo);
      const { data, error } = await supabase
        .from('programa_validador_documento_links' as any)
        .insert({
          cliente_id: cliente.id,
          documento_id: docExistente?.id || null,
          tipo,
          html_documento: html,
          status: 'pendente',
        } as any)
        .select()
        .single() as any;
      if (error) throw error;
      await atualizarDocMutation.mutateAsync({ tipo, status: 'enviado' });
      await supabase.from('programa_validador_historico' as any).insert({
        cliente_id: cliente.id,
        tipo: 'documento_gerado',
        titulo: `Link de aceite gerado: ${(cliente.tipo_cliente === 'pagante' ? DOCS_CONFIG_PAGANTE : DOCS_CONFIG_TESTER).find(d => d.tipo === tipo)?.label}`,
        autor: profile?.nome_completo || 'SuperAdmin',
      } as any);
      return data;
    },
    onSuccess: (data) => {
      const customDomain = "https://youreyes.com.br";
      const baseUrl = window.location.hostname.includes("lovable.app") || window.location.hostname === "localhost"
        ? window.location.origin 
        : customDomain;
      const url = `${baseUrl}/aceite-documento/${data.token}`;
      navigator.clipboard.writeText(url).then(() => {
        toast.success('Link de aceite copiado para a área de transferência!');
      });
      setGerandoDoc(null);
      qc.invalidateQueries({ queryKey: ['validador', 'doc-links', cliente.id] });
      qc.invalidateQueries({ queryKey: ['validador', 'docs', cliente.id] });
      qc.invalidateQueries({ queryKey: ['validador', 'historico', cliente.id] });
    },
    onError: (err: Error) => toast.error('Erro ao gerar link: ' + err.message),
  });

  const copiarLink = (token: string) => {
    const customDomain = "https://youreyes.com.br";
    const baseUrl = window.location.hostname.includes("lovable.app") || window.location.hostname === "localhost"
      ? window.location.origin 
      : customDomain;
    const url = `${baseUrl}/contrato-assinatura/${token}`;
    navigator.clipboard.writeText(url).then(() => toast.success('Link copiado!'));
  };

  const abrirContrato = (token: string) => {
    window.open(`${window.location.origin}/contrato-assinatura/${token}`, '_blank');
  };

  const adicionarNotaMutation = useMutation({
    mutationFn: async () => {
      await supabase.from('programa_validador_historico').insert({
        cliente_id: cliente.id,
        tipo: 'nota',
        titulo: nota,
        autor: profile?.nome_completo || 'SuperAdmin',
      });
    },
    onSuccess: () => {
      setNota('');
      toast.success('Nota adicionada');
      qc.invalidateQueries({ queryKey: ['validador', 'historico', cliente.id] });
    },
  });

  const atualizarDocMutation = useMutation({
    mutationFn: async ({ tipo, status }: { tipo: TipoDoc; status: Documento['status'] }) => {
      const existente = documentos.find(d => d.tipo === tipo);
      if (existente) {
        await supabase
          .from('programa_validador_documentos')
          .update({
            status,
            enviado_em: status === 'enviado' ? new Date().toISOString() : existente.enviado_em,
            aceito_em: status === 'aceito' ? new Date().toISOString() : existente.aceito_em,
          })
          .eq('id', existente.id);
      } else {
        await supabase.from('programa_validador_documentos').insert({
          cliente_id: cliente.id,
          tipo,
          status,
          enviado_em: status === 'enviado' ? new Date().toISOString() : null,
          aceito_em: status === 'aceito' ? new Date().toISOString() : null,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['validador', 'docs', cliente.id] });
    },
  });

  const contratoAssinado = contratos[0]?.status === 'assinado';
  const docAceitos = documentos.filter(d => d.status === 'aceito' && d.tipo !== 'contrato_programa_validador').length
    + (contratoAssinado ? 1 : 0);
  const docsConfig = cliente.tipo_cliente === 'pagante' ? DOCS_CONFIG_PAGANTE : DOCS_CONFIG_TESTER;
  const totalDocs = docsConfig.length;

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{cliente.nome_empresa}</h1>
            <FaseBadge fase={cliente.fase} />
            <Badge variant="outline" className={`text-xs ${cliente.tipo_cliente === 'pagante' ? 'border-primary text-primary' : 'border-accent text-accent-foreground'}`}>
              {cliente.tipo_cliente === 'pagante' ? '💼 Pagante' : '🧪 Tester'}
            </Badge>
            {cliente.aceita_beta && (
              <Badge variant="outline" className="text-xs">
                <Shield className="w-3 h-3 mr-1" />Beta aceito
              </Badge>
            )}
          </div>
          {cliente.segmento && <p className="text-sm text-muted-foreground">{cliente.segmento}</p>}
        </div>
        {(cliente as any).onboarding_token && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
            onClick={() => {
              const url = `${window.location.origin}/onboarding-cliente/${(cliente as any).onboarding_token}`;
              navigator.clipboard.writeText(url);
              toast.success("Link do portal copiado!");
            }}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Portal do Cliente
          </Button>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Coluna principal */}
        <div className="md:col-span-2 space-y-6">

          {/* Alterar fase */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                Fase do Pipeline
                <Button variant="ghost" size="sm" onClick={() => setEditandoFase(!editandoFase)}>
                  {editandoFase ? 'Cancelar' : 'Alterar'}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {editandoFase ? (
                <div className="flex flex-wrap gap-2">
                  {FASES.map(f => (
                    <button
                      key={f.value}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                        cliente.fase === f.value
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:bg-muted'
                      }`}
                      onClick={() => atualizarFaseMutation.mutate(f.value)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <FaseBadge fase={cliente.fase} />
                  {cliente.data_inicio_piloto && (
                    <span className="text-sm text-muted-foreground">
                      Piloto: {format(new Date(cliente.data_inicio_piloto), 'dd/MM/yyyy')}
                      {cliente.data_fim_piloto && ` → ${format(new Date(cliente.data_fim_piloto), 'dd/MM/yyyy')}`}
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contrato de Participação */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Contrato de Participação
                </span>
                <Button variant="outline" size="sm" onClick={() => setShowGerarContrato(true)}>
                  <Plus className="w-3 h-3 mr-1" />
                  Gerar novo
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contratos.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nenhum contrato gerado</p>
                  <p className="text-xs mt-1">O contrato é gerado automaticamente ao mover de Qualificação → Kickoff</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {contratos.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="flex items-center gap-2">
                          {c.status === 'assinado' ? (
                            <CheckCircle2 className="w-4 h-4 text-primary" />
                          ) : c.status === 'enviado' ? (
                            <Clock className="w-4 h-4 text-accent-foreground" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span className="text-sm font-medium capitalize">{c.status}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Gerado em {format(new Date(c.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                          {c.assinado_em && ` · Assinado em ${format(new Date(c.assinado_em), 'dd/MM/yyyy', { locale: ptBR })}`}
                          {c.assinado_por && ` por ${c.assinado_por}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {c.status !== 'assinado' && (
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => copiarLink(c.token)}>
                            <Send className="w-3 h-3 mr-1" />Copiar link
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 text-xs" title="Baixar contrato"
                          onClick={() => {
                            const html = c.html_assinado || c.html_contrato;
                            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `contrato-${cliente.nome_empresa.replace(/\s+/g, '-').toLowerCase()}.html`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                        >
                          <Download className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" title="Imprimir contrato"
                          onClick={() => {
                            const html = c.html_assinado || c.html_contrato;
                            const win = window.open('', '_blank');
                            if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 500); }
                          }}
                        >
                          <Printer className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" title="Abrir contrato" onClick={() => abrirContrato(c.token)}>
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showGerarContrato && (
                <div className="mt-4 p-4 border rounded-lg bg-muted/30 space-y-3">
                  <p className="text-sm font-medium">Gerar contrato para <strong>{cliente.nome_empresa}</strong>?</p>
                  <p className="text-xs text-muted-foreground">
                    Será gerado um link único para assinatura eletrônica.
                    {!cliente.representante && ' Você pode adicionar o nome do representante no cadastro da empresa para incluir no contrato.'}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowGerarContrato(false)}>Cancelar</Button>
                    <Button size="sm" disabled={gerarContratoMutation.isPending} onClick={() => gerarContratoMutation.mutate()}>
                      {gerarContratoMutation.isPending ? 'Gerando...' : 'Confirmar'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documentos e Aceites */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Documentos e Aceites
                </span>
                <span className="text-sm font-normal text-muted-foreground">
                  {docAceitos}/{totalDocs} concluídos
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {docsConfig.map(({ tipo, label, descricao, itens }) => {
                const isContrato = tipo === 'contrato_programa_validador';
                const contratoAtivo = isContrato ? contratos[0] : null;
                const doc = documentos.find(d => d.tipo === tipo);
                const status = isContrato
                  ? (contratoAtivo?.status === 'assinado' ? 'aceito' : contratoAtivo ? 'enviado' : 'pendente')
                  : (doc?.status || 'pendente');
                const linkAtivo = docLinks.find(l => l.tipo === tipo && l.status !== 'recusado');
                const isGerando = gerandoDoc === tipo && gerarDocLinkMutation.isPending;

                return (
                  <div key={tipo} className={`rounded-lg border p-4 space-y-3 ${
                    status === 'aceito' || status === 'enviado' ? 'border-primary/30 bg-primary/5' : 'border-border'
                  }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          status === 'aceito' ? 'bg-primary/15' : status === 'enviado' ? 'bg-accent/20' : 'bg-muted'
                        }`}>
                          <DocStatusIcon status={status} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm">{label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{descricao}</p>
                          {(isContrato ? contratoAtivo?.assinado_em : doc?.aceito_em) && (
                            <p className="text-xs text-primary mt-1">
                              ✓ Assinado em {format(new Date((isContrato ? contratoAtivo?.assinado_em : doc?.aceito_em)!), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              {isContrato && contratoAtivo?.assinado_por ? ` por ${contratoAtivo.assinado_por}` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {status !== 'aceito' && (
                          isContrato ? null : linkAtivo ? (
                            <Button variant="outline" size="sm" className="h-7 text-xs"
                              onClick={() => {
                                const url = `${window.location.origin}/aceite-documento/${linkAtivo.token}`;
                                navigator.clipboard.writeText(url).then(() => toast.success('Link copiado!'));
                              }}
                            >
                              <Send className="w-3 h-3 mr-1" />Copiar link
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={isGerando}
                              onClick={() => {
                                setGerandoDoc(tipo);
                                if (tipo === 'ata_kickoff') { setShowAtaDialog(true); }
                                else { gerarDocLinkMutation.mutate({ tipo }); }
                              }}
                            >
                              {isGerando ? (
                                <span className="flex items-center gap-1">
                                  <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                                  Gerando...
                                </span>
                              ) : (
                                <><FileText className="w-3 h-3 mr-1" />Gerar link</>
                              )}
                            </Button>
                          )
                        )}
                        <Select value={status} onValueChange={(v) => atualizarDocMutation.mutate({ tipo, status: v as Documento['status'] })}>
                          <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendente">Pendente</SelectItem>
                            <SelectItem value="enviado">Enviado</SelectItem>
                            <SelectItem value="aceito">Aceito</SelectItem>
                            <SelectItem value="recusado">Recusado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {itens && (
                      <div className="ml-11 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Conteúdo incluído:</p>
                        {itens.map(item => (
                          <div key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <CheckCircle2 className="w-3 h-3 text-primary shrink-0" />
                            <span>{item}</span>
                          </div>
                        ))}
                        <p className="text-xs text-muted-foreground mt-2 italic">
                          Uma única assinatura digital cobre todos os itens acima.
                        </p>
                      </div>
                    )}

                    {linkAtivo && status !== 'aceito' && !isContrato && (
                      <div className="ml-11 flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          linkAtivo.status === 'aceito' ? 'bg-primary/10 text-primary' :
                          linkAtivo.status === 'visualizado' ? 'bg-accent/50 text-accent-foreground' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {linkAtivo.status === 'aceito' ? '✓ Aceito' :
                           linkAtivo.status === 'visualizado' ? '👁 Visualizado' :
                           '⏳ Aguardando aceite'}
                        </span>
                        <button
                          className="text-xs text-muted-foreground hover:text-foreground underline"
                          onClick={() => window.open(`${window.location.origin}/aceite-documento/${linkAtivo.token}`, '_blank')}
                        >
                          Ver documento
                        </button>
                      </div>
                    )}

                    {isContrato && contratos.length > 0 && (
                      <div className="ml-11">
                        {contratos.slice(0, 1).map(c => (
                          <div key={c.id} className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              c.status === 'assinado' ? 'bg-primary/10 text-primary' :
                              c.status === 'enviado' ? 'bg-accent/50 text-accent-foreground' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {c.status === 'assinado' ? '✓ Assinado' :
                               c.status === 'enviado' ? '⏳ Aguardando assinatura' :
                               '⏳ Pendente'}
                            </span>
                            {c.status !== 'assinado' && (
                              <button className="text-xs text-muted-foreground hover:text-foreground underline" onClick={() => copiarLink(c.token)}>
                                Copiar link
                              </button>
                            )}
                            <button className="text-xs text-muted-foreground hover:text-foreground underline" onClick={() => abrirContrato(c.token)}>
                              Ver contrato
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Linha do tempo */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Histórico
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Adicionar nota..."
                  className="min-h-[60px] resize-none text-sm"
                  value={nota}
                  onChange={e => setNota(e.target.value)}
                />
                <Button
                  size="sm"
                  disabled={!nota.trim() || adicionarNotaMutation.isPending}
                  onClick={() => adicionarNotaMutation.mutate()}
                  className="self-end"
                >
                  Salvar
                </Button>
              </div>
              <Separator />
              {historico.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum registro ainda</p>
              ) : (
                historico.map(h => (
                  <div key={h.id} className="flex gap-3 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                    <div>
                      <p className="font-medium">{h.titulo}</p>
                      {h.descricao && <p className="text-muted-foreground">{h.descricao}</p>}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {h.autor && `${h.autor} · `}
                        {format(new Date(h.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna lateral */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Responsável / Contato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {cliente.poc_nome && (
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span>{cliente.poc_nome}</span>
                  {cliente.poc_cargo && <span className="text-muted-foreground">· {cliente.poc_cargo}</span>}
                </div>
              )}
              {cliente.poc_email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <a href={`mailto:${cliente.poc_email}`} className="text-primary hover:underline">{cliente.poc_email}</a>
                </div>
              )}
              {cliente.poc_telefone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <a href={`https://wa.me/55${cliente.poc_telefone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                    {cliente.poc_telefone}
                    <span className="text-xs text-muted-foreground">(WhatsApp)</span>
                  </a>
                </div>
              )}
              {(cliente as any).activation_token && (
                <div className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-1.5">
                  <p className="text-xs font-semibold text-primary flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" /> Link de Ativação do Cliente
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                      {window.location.origin}/ativar-conta?token={(cliente as any).activation_token}
                    </code>
                    <button className="text-xs text-primary hover:underline whitespace-nowrap"
                      onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/ativar-conta?token=${(cliente as any).activation_token}`); toast.success('Link copiado!'); }}
                    >
                      Copiar
                    </button>
                  </div>
                  {(cliente as any).conta_ativada && (
                    <p className="text-xs text-primary font-medium">✓ Conta ativada</p>
                  )}
                </div>
              )}
              {!cliente.poc_nome && !cliente.poc_email && (
                <p className="text-muted-foreground">Nenhum contato cadastrado</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Empresa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {cliente.cnpj && <p><span className="text-muted-foreground">CNPJ:</span> {cliente.cnpj}</p>}
              {cliente.tamanho_empresa && <p><span className="text-muted-foreground">Porte:</span> {cliente.tamanho_empresa}</p>}
              {cliente.quantidade_colaboradores && <p><span className="text-muted-foreground">Colaboradores:</span> {cliente.quantidade_colaboradores}</p>}
              {cliente.responsavel_seguramente && <p><span className="text-muted-foreground">Resp. YourEyes:</span> {cliente.responsavel_seguramente}</p>}
              {cliente.endereco && <p><span className="text-muted-foreground">Endereço:</span> {cliente.endereco}</p>}
              {cliente.representante && <p><span className="text-muted-foreground">Representante:</span> {cliente.representante}</p>}
            </CardContent>
          </Card>

          {cliente.tipo_cliente === 'pagante' && (
            <Card className="border-primary/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-primary uppercase tracking-wide">💼 Dados Comerciais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {cliente.plano && <p><span className="text-muted-foreground">Plano:</span> <strong>{cliente.plano}</strong></p>}
                {cliente.valor_mensal && <p><span className="text-muted-foreground">Mensalidade:</span> <strong>{cliente.valor_mensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></p>}
                {cliente.dia_vencimento && <p><span className="text-muted-foreground">Vencimento:</span> dia {cliente.dia_vencimento}</p>}
                {cliente.data_contrato && <p><span className="text-muted-foreground">Contrato:</span> {format(new Date(cliente.data_contrato), 'dd/MM/yyyy')}</p>}
                {cliente.data_vigencia_fim && <p><span className="text-muted-foreground">Vigência até:</span> {format(new Date(cliente.data_vigencia_fim), 'dd/MM/yyyy')}</p>}
              </CardContent>
            </Card>
          )}

          {cliente.observacoes && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Observações do Cadastro</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {cliente.observacoes.split(' | ').map((item, i) => (
                    <p key={i} className="text-sm text-muted-foreground">
                      {item.includes(':') ? (
                        <>
                          <span className="font-medium text-foreground">{item.split(':')[0]}:</span>
                          {item.split(':').slice(1).join(':')}
                        </>
                      ) : item}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-3 text-xs text-muted-foreground">
              <p>Criado em {format(new Date(cliente.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <AtaKickoffDialog
        open={showAtaDialog}
        onClose={() => { setShowAtaDialog(false); setGerandoDoc(null); }}
        onEnviar={(html) => {
          gerarDocLinkMutation.mutate({ tipo: 'ata_kickoff', htmlOverride: html });
          setShowAtaDialog(false);
        }}
        isLoading={gerarDocLinkMutation.isPending}
        nomeEmpresa={cliente.nome_empresa}
        pocNome={cliente.poc_nome}
        responsavelSeguramente={cliente.responsavel_seguramente}
      />
    </div>
  );
}

// ─── Dialog novo cliente ──────────────────────────────────────────────────────

function NovoClienteDialog({ onSuccess }: { onSuccess: () => void }) {
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [form, setForm] = useState({
    nome_empresa: '',
    cnpj: '',
    poc_nome: '',
    poc_email: '',
    poc_telefone: '',
    poc_cargo: '',
    fase: 'prospeccao' as Fase,
    segmento: '',
    tamanho_empresa: '',
    quantidade_colaboradores: '',
    responsavel_seguramente: '',
    data_inicio_piloto: '',
    data_fim_piloto: '',
    observacoes: '',
    tipo_cliente: 'tester' as 'tester' | 'pagante',
    endereco: '',
    representante: '',
    cidade_foro: '',
    valor_mensal: '',
    dia_vencimento: '',
    plano: '',
    data_contrato: '',
    data_vigencia_fim: '',
  });

  const criarMutation = useMutation({
    mutationFn: async () => {
      const slugBase = form.nome_empresa
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50);
      const slugUnique = `${slugBase}-${Date.now().toString(36)}`;

      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          nome: form.nome_empresa,
          slug: slugUnique,
          plano: form.tipo_cliente === 'pagante' ? 'professional' : 'free',
          ativo: true,
        })
        .select('id')
        .single();
      if (tenantError) throw tenantError;

      const tenantId = tenant.id;

      const { data: empresa, error: empresaError } = await supabase
        .from('empresa_cadastro')
        .insert({
          tenant_id: tenantId,
          razao_social: form.nome_empresa,
          cnpj: form.cnpj || null,
          endereco: form.endereco || null,
          email: form.poc_email || null,
          telefone: form.poc_telefone || null,
          total_colaboradores: form.quantidade_colaboradores ? parseInt(form.quantidade_colaboradores) : 0,
          tipo_pessoa: 'pj',
          ativo: true,
        } as any)
        .select('id')
        .single();
      if (empresaError) throw empresaError;

      const { error } = await supabase.from('programa_validador_clientes').insert({
        nome_empresa: form.nome_empresa,
        cnpj: form.cnpj || null,
        poc_nome: form.poc_nome || null,
        poc_email: form.poc_email || null,
        poc_telefone: form.poc_telefone || null,
        poc_cargo: form.poc_cargo || null,
        fase: form.fase,
        segmento: form.segmento || null,
        tamanho_empresa: (form.tamanho_empresa as any) || null,
        quantidade_colaboradores: form.quantidade_colaboradores ? parseInt(form.quantidade_colaboradores) : null,
        responsavel_seguramente: form.responsavel_seguramente || null,
        data_inicio_piloto: form.data_inicio_piloto || null,
        data_fim_piloto: form.data_fim_piloto || null,
        observacoes: form.observacoes || null,
        tipo_cliente: form.tipo_cliente,
        endereco: form.endereco || null,
        representante: form.representante || null,
        cidade_foro: form.cidade_foro || null,
        valor_mensal: form.tipo_cliente === 'pagante' && form.valor_mensal ? parseFloat(form.valor_mensal) : null,
        activation_token: crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, ''),
        activation_token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        dia_vencimento: form.tipo_cliente === 'pagante' && form.dia_vencimento ? parseInt(form.dia_vencimento) : null,
        plano: form.tipo_cliente === 'pagante' ? form.plano || null : null,
        data_contrato: form.tipo_cliente === 'pagante' ? form.data_contrato || null : null,
        data_vigencia_fim: form.tipo_cliente === 'pagante' ? form.data_vigencia_fim || null : null,
        tenant_id: tenantId,
        empresa_cadastro_id: empresa.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Cliente adicionado! Empresa criada automaticamente no módulo de Estrutura Organizacional.');
      onSuccess();
    },
    onError: (err: any) => toast.error('Erro ao salvar cliente: ' + err.message),
  });

  const isPagante = form.tipo_cliente === 'pagante';

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Novo Cliente</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Tipo de Cliente *</Label>
          <div className="flex gap-3 mt-1">
            {(['tester', 'pagante'] as const).map(t => (
              <button key={t} type="button" onClick={() => setForm(p => ({ ...p, tipo_cliente: t }))}
                className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-all ${
                  form.tipo_cliente === t
                    ? t === 'pagante' ? 'border-primary bg-primary text-primary-foreground' : 'border-accent bg-accent/20 text-accent-foreground'
                    : 'border-border hover:bg-muted'
                }`}
              >
                {t === 'tester' ? '🧪 Tester (Programa Validador)' : '💼 Pagante (Cliente Ativo)'}
              </button>
            ))}
          </div>
          {isPagante && (
            <p className="text-xs text-muted-foreground mt-1">
              Clientes pagantes recebem o <strong>Contrato de Licença de Uso</strong> com Termos, Privacidade e SLA.
            </p>
          )}
        </div>

        <div className="col-span-2">
          <Label>CNPJ</Label>
          <div className="flex gap-2 mt-1">
            <Input placeholder="00.000.000/0000-00" value={form.cnpj}
              onChange={e => {
                const cleaned = e.target.value.replace(/\D/g, '');
                if (cleaned.length <= 14) { setForm(p => ({ ...p, cnpj: formatCnpj(cleaned) })); }
              }}
              maxLength={18}
            />
            <Button type="button" variant="outline" size="icon"
              disabled={cnpjLoading || cleanCnpj(form.cnpj).length !== 14}
              title="Buscar dados na Receita Federal"
              onClick={async () => {
                setCnpjLoading(true);
                try {
                  const result = await buscarCnpj(form.cnpj);
                  if (!result) { toast.error('CNPJ não encontrado.'); return; }
                  setForm(p => ({
                    ...p,
                    nome_empresa: result.razao_social || p.nome_empresa,
                    endereco: [result.logradouro, result.numero, result.bairro, result.municipio, result.uf].filter(Boolean).join(', '),
                    cidade_foro: result.municipio || p.cidade_foro,
                    poc_email: result.email || p.poc_email,
                  }));
                  toast.success('Dados preenchidos automaticamente!');
                } finally { setCnpjLoading(false); }
              }}
            >
              {cnpjLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Clique na lupa para preencher automaticamente pela Receita Federal</p>
        </div>

        <div className="col-span-2">
          <Label>Nome da Empresa *</Label>
          <Input value={form.nome_empresa} onChange={e => setForm(p => ({ ...p, nome_empresa: e.target.value }))} />
        </div>
        <div>
          <Label>Fase</Label>
          <Select value={form.fase} onValueChange={v => setForm(p => ({ ...p, fase: v as Fase }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FASES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Separator className="col-span-2" />
        <div><Label>Responsável - Nome</Label><Input value={form.poc_nome} onChange={e => setForm(p => ({ ...p, poc_nome: e.target.value }))} /></div>
        <div><Label>Responsável - Cargo</Label><Input value={form.poc_cargo} onChange={e => setForm(p => ({ ...p, poc_cargo: e.target.value }))} /></div>
        <div><Label>Responsável - E-mail</Label><Input type="email" value={form.poc_email} onChange={e => setForm(p => ({ ...p, poc_email: e.target.value }))} /></div>
        <div><Label>Responsável - Telefone</Label><Input value={form.poc_telefone} onChange={e => setForm(p => ({ ...p, poc_telefone: e.target.value }))} /></div>

        <Separator className="col-span-2" />
        <div><Label>Segmento</Label><Input value={form.segmento} onChange={e => setForm(p => ({ ...p, segmento: e.target.value }))} /></div>
        <div>
          <Label>Porte</Label>
          <Select value={form.tamanho_empresa} onValueChange={v => setForm(p => ({ ...p, tamanho_empresa: v }))}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="micro">Micro</SelectItem>
              <SelectItem value="pequena">Pequena</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="grande">Grande</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Qtd. Colaboradores</Label><Input type="number" value={form.quantidade_colaboradores} onChange={e => setForm(p => ({ ...p, quantidade_colaboradores: e.target.value }))} /></div>
        <div><Label>Responsável YourEyes</Label><Input value={form.responsavel_seguramente} onChange={e => setForm(p => ({ ...p, responsavel_seguramente: e.target.value }))} /></div>

        <div className="col-span-2">
          <Label>Endereço (para contrato)</Label>
          <Input value={form.endereco} onChange={e => setForm(p => ({ ...p, endereco: e.target.value }))} placeholder="Rua, nº, Cidade — Estado" />
        </div>
        <div><Label>Representante Legal</Label><Input value={form.representante} onChange={e => setForm(p => ({ ...p, representante: e.target.value }))} placeholder="Nome completo" /></div>
        <div><Label>Cidade para Foro</Label><Input value={form.cidade_foro} onChange={e => setForm(p => ({ ...p, cidade_foro: e.target.value }))} placeholder="Ex: São Paulo" /></div>

        <div><Label>{isPagante ? 'Início do Contrato' : 'Início do Piloto'}</Label><Input type="date" value={form.data_inicio_piloto} onChange={e => setForm(p => ({ ...p, data_inicio_piloto: e.target.value }))} /></div>
        <div><Label>{isPagante ? 'Fim da Vigência' : 'Fim do Piloto'}</Label><Input type="date" value={form.data_fim_piloto} onChange={e => setForm(p => ({ ...p, data_fim_piloto: e.target.value }))} /></div>

        {isPagante && (
          <>
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wide">💼 Dados Comerciais</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            </div>
            <div><Label>Plano</Label><Input value={form.plano} onChange={e => setForm(p => ({ ...p, plano: e.target.value }))} placeholder="Ex: Profissional, Enterprise..." /></div>
            <div><Label>Valor Mensal (R$)</Label><Input type="number" step="0.01" value={form.valor_mensal} onChange={e => setForm(p => ({ ...p, valor_mensal: e.target.value }))} placeholder="Ex: 299.90" /></div>
            <div><Label>Dia de Vencimento</Label><Input type="number" min="1" max="31" value={form.dia_vencimento} onChange={e => setForm(p => ({ ...p, dia_vencimento: e.target.value }))} placeholder="Ex: 10" /></div>
            <div><Label>Data de Assinatura do Contrato</Label><Input type="date" value={form.data_contrato} onChange={e => setForm(p => ({ ...p, data_contrato: e.target.value }))} /></div>
          </>
        )}

        <div className="col-span-2">
          <Label>Observações</Label>
          <Textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} rows={3} />
        </div>
        <div className="col-span-2 flex justify-end">
          <Button disabled={!form.nome_empresa || criarMutation.isPending} onClick={() => criarMutation.mutate()}>
            {criarMutation.isPending ? 'Salvando...' : 'Criar Cliente'}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}
