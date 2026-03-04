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
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';

// ─── Types ───────────────────────────────────────────────────────────────────

type Fase =
  | 'prospeccao'
  | 'qualificacao'
  | 'kickoff'
  | 'ativo'
  | 'suspenso'
  | 'encerrado';

type TipoDoc =
  | 'contrato_piloto'
  | 'dpa_lgpd'
  | 'anexo_operacional'
  | 'faq_seguranca'
  | 'resumo_beta'
  | 'politica_privacidade'
  | 'termos_uso'
  | 'ata_kickoff';

interface Cliente {
  id: string;
  nome_empresa: string;
  cnpj: string | null;
  poc_nome: string | null;
  poc_email: string | null;
  poc_telefone: string | null;
  poc_cargo: string | null;
  fase: Fase;
  data_inicio_piloto: string | null;
  data_fim_piloto: string | null;
  segmento: string | null;
  tamanho_empresa: string | null;
  quantidade_colaboradores: number | null;
  aceita_beta: boolean;
  observacoes: string | null;
  responsavel_seguramente: string | null;
  created_at: string;
}

interface Documento {
  id: string;
  cliente_id: string;
  tipo: TipoDoc;
  status: 'pendente' | 'enviado' | 'aceito' | 'recusado';
  enviado_em: string | null;
  aceito_em: string | null;
  versao: string | null;
  observacao: string | null;
}

interface Historico {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  autor: string | null;
  created_at: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const FASES: { value: Fase; label: string; color: string }[] = [
  { value: 'prospeccao', label: 'Prospecção', color: 'bg-muted text-muted-foreground' },
  { value: 'qualificacao', label: 'Qualificação', color: 'bg-accent text-accent-foreground' },
  { value: 'kickoff', label: 'Kickoff', color: 'bg-secondary text-secondary-foreground' },
  { value: 'ativo', label: 'Ativo', color: 'bg-primary/15 text-primary' },
  { value: 'suspenso', label: 'Suspenso', color: 'bg-muted text-muted-foreground border border-border' },
  { value: 'encerrado', label: 'Encerrado', color: 'bg-destructive/10 text-destructive' },
];

const DOCS_CONFIG: { tipo: TipoDoc; label: string }[] = [
  { tipo: 'contrato_piloto', label: 'Contrato Piloto' }, // keep
  { tipo: 'dpa_lgpd', label: 'DPA / Anexo LGPD' },
  { tipo: 'anexo_operacional', label: 'Anexo Operacional' },
  { tipo: 'faq_seguranca', label: 'FAQ Segurança' },
  { tipo: 'resumo_beta', label: 'Resumo Beta' },
  { tipo: 'politica_privacidade', label: 'Política de Privacidade' },
  { tipo: 'termos_uso', label: 'Termos de Uso' },
  { tipo: 'ata_kickoff', label: 'Ata de Kickoff' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function FaseBadge({ fase }: { fase: Fase }) {
  const cfg = FASES.find(f => f.value === fase)!;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>;
}

function DocStatusIcon({ status }: { status: Documento['status'] }) {
  if (status === 'aceito') return <CheckCircle2 className="w-4 h-4 text-primary" />;
  if (status === 'recusado') return <XCircle className="w-4 h-4 text-destructive" />;
  if (status === 'enviado') return <Clock className="w-4 h-4 text-accent-foreground" />;
  return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProgramaValidador() {
  const { user, profile } = useAuthContext();
  const qc = useQueryClient();
  const [busca, setBusca] = useState('');
  const [faseFilter, setFaseFilter] = useState<Fase | 'todas'>('todas');
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [showNovoCliente, setShowNovoCliente] = useState(false);

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
      <div className="min-h-screen bg-background p-6 space-y-6">
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

        {/* Filtros */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar empresa ou POC..."
              className="pl-9"
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>
        </div>

        {/* Pipeline Kanban simplificado */}
        <div className="grid gap-3">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : clientesFiltrados.length === 0 ? (
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
                        {c.poc_nome && `POC: ${c.poc_nome}`}
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
      </div>
    </SuperAdminRoute>
  );
}

// ─── Detalhe do cliente ───────────────────────────────────────────────────────

function DetalheCliente({
  cliente, documentos, historico, onBack, onClienteUpdated,
}: {
  cliente: Cliente;
  documentos: Documento[];
  historico: Historico[];
  onBack: () => void;
  onClienteUpdated: (c: Cliente) => void;
}) {
  const qc = useQueryClient();
  const { profile } = useAuthContext();
  const [nota, setNota] = useState('');
  const [editandoFase, setEditandoFase] = useState(false);

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
      return data;
    },
    onSuccess: (data) => {
      onClienteUpdated(data as Cliente);
      setEditandoFase(false);
      toast.success('Fase atualizada');
      qc.invalidateQueries({ queryKey: ['validador'] });
    },
  });

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

  const docAceitos = documentos.filter(d => d.status === 'aceito').length;
  const totalDocs = DOCS_CONFIG.length;

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{cliente.nome_empresa}</h1>
            <FaseBadge fase={cliente.fase} />
            {cliente.aceita_beta && (
              <Badge variant="outline" className="text-xs">
                <Shield className="w-3 h-3 mr-1" />Beta aceito
              </Badge>
            )}
          </div>
          {cliente.segmento && <p className="text-sm text-muted-foreground">{cliente.segmento}</p>}
        </div>
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

          {/* Checklist de documentos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Documentos e Aceites
                </span>
                <span className="text-sm font-normal text-muted-foreground">
                  {docAceitos}/{totalDocs} aceitos
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {DOCS_CONFIG.map(({ tipo, label }) => {
                const doc = documentos.find(d => d.tipo === tipo);
                const status = doc?.status || 'pendente';
                return (
                  <div key={tipo} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-2">
                      <DocStatusIcon status={status} />
                      <span className="text-sm">{label}</span>
                      {doc?.aceito_em && (
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(doc.aceito_em), 'dd/MM/yy', { locale: ptBR })}
                        </span>
                      )}
                    </div>
                    <Select
                      value={status}
                      onValueChange={(v) => atualizarDocMutation.mutate({ tipo, status: v as Documento['status'] })}
                    >
                      <SelectTrigger className="h-7 w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="enviado">Enviado</SelectItem>
                        <SelectItem value="aceito">Aceito</SelectItem>
                        <SelectItem value="recusado">Recusado</SelectItem>
                      </SelectContent>
                    </Select>
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
              {/* Nova nota */}
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
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">POC / Contato</CardTitle>
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
                  <span>{cliente.poc_telefone}</span>
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
              {cliente.tamanho_empresa && (
                <p><span className="text-muted-foreground">Porte:</span> {cliente.tamanho_empresa}</p>
              )}
              {cliente.quantidade_colaboradores && (
                <p><span className="text-muted-foreground">Colaboradores:</span> {cliente.quantidade_colaboradores}</p>
              )}
              {cliente.responsavel_seguramente && (
                <p><span className="text-muted-foreground">Resp. Seguramente:</span> {cliente.responsavel_seguramente}</p>
              )}
            </CardContent>
          </Card>

          {cliente.observacoes && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Observações</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{cliente.observacoes}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-3 text-xs text-muted-foreground">
              Criado em {format(new Date(cliente.created_at), "dd/MM/yyyy", { locale: ptBR })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Dialog novo cliente ──────────────────────────────────────────────────────

function NovoClienteDialog({ onSuccess }: { onSuccess: () => void }) {
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
  });

  const criarMutation = useMutation({
    mutationFn: async () => {
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
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Cliente adicionado ao programa validador!');
      onSuccess();
    },
    onError: () => toast.error('Erro ao salvar cliente'),
  });

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Novo Cliente Validador</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Nome da Empresa *</Label>
          <Input value={form.nome_empresa} onChange={e => setForm(p => ({ ...p, nome_empresa: e.target.value }))} />
        </div>
        <div>
          <Label>CNPJ</Label>
          <Input value={form.cnpj} onChange={e => setForm(p => ({ ...p, cnpj: e.target.value }))} />
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
        <div>
          <Label>POC - Nome</Label>
          <Input value={form.poc_nome} onChange={e => setForm(p => ({ ...p, poc_nome: e.target.value }))} />
        </div>
        <div>
          <Label>POC - Cargo</Label>
          <Input value={form.poc_cargo} onChange={e => setForm(p => ({ ...p, poc_cargo: e.target.value }))} />
        </div>
        <div>
          <Label>POC - E-mail</Label>
          <Input type="email" value={form.poc_email} onChange={e => setForm(p => ({ ...p, poc_email: e.target.value }))} />
        </div>
        <div>
          <Label>POC - Telefone</Label>
          <Input value={form.poc_telefone} onChange={e => setForm(p => ({ ...p, poc_telefone: e.target.value }))} />
        </div>
        <Separator className="col-span-2" />
        <div>
          <Label>Segmento</Label>
          <Input value={form.segmento} onChange={e => setForm(p => ({ ...p, segmento: e.target.value }))} />
        </div>
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
        <div>
          <Label>Qtd. Colaboradores</Label>
          <Input type="number" value={form.quantidade_colaboradores} onChange={e => setForm(p => ({ ...p, quantidade_colaboradores: e.target.value }))} />
        </div>
        <div>
          <Label>Responsável Seguramente</Label>
          <Input value={form.responsavel_seguramente} onChange={e => setForm(p => ({ ...p, responsavel_seguramente: e.target.value }))} />
        </div>
        <div>
          <Label>Início do Piloto</Label>
          <Input type="date" value={form.data_inicio_piloto} onChange={e => setForm(p => ({ ...p, data_inicio_piloto: e.target.value }))} />
        </div>
        <div>
          <Label>Fim do Piloto</Label>
          <Input type="date" value={form.data_fim_piloto} onChange={e => setForm(p => ({ ...p, data_fim_piloto: e.target.value }))} />
        </div>
        <div className="col-span-2">
          <Label>Observações</Label>
          <Textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} rows={3} />
        </div>
        <div className="col-span-2 flex justify-end">
          <Button
            disabled={!form.nome_empresa || criarMutation.isPending}
            onClick={() => criarMutation.mutate()}
          >
            {criarMutation.isPending ? 'Salvando...' : 'Criar Cliente'}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}
