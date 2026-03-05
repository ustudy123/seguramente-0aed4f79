import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2, Circle, Clock, ChevronRight, Building2, Users, LayoutGrid,
  FileText, Upload, ArrowRight, Sparkles, AlertCircle, Loader2, CheckCheck,
  BarChart3, Briefcase, Shield, Rocket, Star, ChevronDown, ChevronUp, Download
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Cliente {
  id: string;
  nome_empresa: string;
  cnpj: string | null;
  poc_nome: string | null;
  poc_email: string | null;
  poc_telefone: string | null;
  fase: string;
  segmento: string | null;
  quantidade_colaboradores: number | null;
  tipo_cliente: string;
  onboarding_token: string | null;
}

interface Contrato {
  id: string;
  token: string;
  status: 'pendente' | 'enviado' | 'assinado' | 'recusado';
  assinado_em: string | null;
  html_assinado: string | null;
}

interface DocumentoLink {
  id: string;
  tipo: string;
  token: string;
  status: 'pendente' | 'visualizado' | 'aceito' | 'recusado';
  aceito_em: string | null;
  html_assinado: string | null;
  html_documento: string | null;
}

interface OnboardingState {
  empresa_cadastrada: boolean;
  estrutura_cadastrada: boolean;
  colaboradores_cadastrados: boolean;
  diagnostico_iniciado: boolean;
  contrato_assinado: boolean;
  ata_aceita: boolean;
}

// ─── Fase Progress Bar ────────────────────────────────────────────────────────

const FASES = [
  { key: 'prospeccao', label: 'Prospecção' },
  { key: 'qualificacao', label: 'Qualificação' },
  { key: 'kickoff', label: 'Kickoff' },
  { key: 'configuracao', label: 'Configuração' },
  { key: 'ativo', label: 'Ativo' },
];

function FaseProgress({ fase }: { fase: string }) {
  const currentIdx = FASES.findIndex(f => f.key === fase);
  
  return (
    <div className="w-full">
      <div className="flex items-center justify-between relative">
        {/* linha de conexão */}
        <div className="absolute left-0 right-0 top-4 h-0.5 bg-muted-foreground/20" />
        <div
          className="absolute left-0 top-4 h-0.5 bg-primary transition-all duration-700"
          style={{ width: `${Math.max(0, (currentIdx / (FASES.length - 1)) * 100)}%` }}
        />
        {FASES.map((f, i) => {
          const done = i < currentIdx;
          const current = i === currentIdx;
          return (
            <div key={f.key} className="flex flex-col items-center gap-1.5 relative z-10">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                done ? 'bg-primary text-primary-foreground' :
                current ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' :
                'bg-background border-2 border-muted-foreground/30 text-muted-foreground'
              }`}>
                {done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${
                current ? 'text-primary' : done ? 'text-muted-foreground' : 'text-muted-foreground/50'
              }`}>{f.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Checklist Item ───────────────────────────────────────────────────────────

function ChecklistItem({
  label, sublabel, done, pending, onClick, link
}: {
  label: string;
  sublabel?: string;
  done: boolean;
  pending?: boolean;
  onClick?: () => void;
  link?: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
        done ? 'bg-primary/5 border-primary/20' :
        pending ? 'bg-accent/30 border-accent animate-pulse' :
        'bg-muted/30 border-transparent hover:border-muted-foreground/20'
      } ${onClick ? 'cursor-pointer hover:bg-muted/50' : ''}`}
      onClick={onClick}
    >
      <div className="shrink-0">
        {done ? (
          <CheckCircle2 className="w-5 h-5 text-primary" />
        ) : pending ? (
          <Clock className="w-5 h-5 text-amber-500" />
        ) : (
          <Circle className="w-5 h-5 text-muted-foreground/40" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${done ? 'line-through text-muted-foreground' : ''}`}>{label}</p>
        {sublabel && <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>}
      </div>
      {link && !done && (
        <Button size="sm" variant="ghost" className="shrink-0 text-xs h-7"
          onClick={e => { e.stopPropagation(); window.open(link, '_blank'); }}>
          Acessar <ChevronRight className="w-3 h-3 ml-1" />
        </Button>
      )}
    </div>
  );
}

// ─── Maturidade ───────────────────────────────────────────────────────────────

function calcularNivelMaturidade(qtd: number | null): { nivel: number; label: string; cor: string; descricao: string; modulo: string } {
  const n = qtd || 0;
  if (n < 20) return {
    nivel: 1, label: 'Inicial', cor: 'text-amber-600',
    descricao: 'Implantação simplificada, foco em estrutura básica.',
    modulo: 'Diagnóstico Organizacional Simplificado'
  };
  if (n <= 100) return {
    nivel: 2, label: 'Estruturado', cor: 'text-blue-600',
    descricao: 'Implantação intermediária, incluindo diagnósticos.',
    modulo: 'Diagnóstico Psicossocial Organizacional'
  };
  return {
    nivel: 3, label: 'Avançado', cor: 'text-primary',
    descricao: 'Implantação completa com ativação rápida de módulos estratégicos.',
    modulo: 'Diagnóstico Completo de Gestão Organizacional'
  };
}

// ─── Step: Empresa ────────────────────────────────────────────────────────────

function StepEmpresa({ cliente, onConcluir }: { cliente: Cliente; onConcluir: () => void }) {
  const [form, setForm] = useState({
    razao_social: cliente.nome_empresa || '',
    cnpj: cliente.cnpj || '',
    cnae: '',
    quantidade_colaboradores: cliente.quantidade_colaboradores?.toString() || '',
    cidade: '',
    segmento: cliente.segmento || '',
    responsavel: cliente.poc_nome || '',
  });
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!form.razao_social || !form.cnpj) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    setSalvando(true);
    try {
      await supabase
        .from('programa_validador_clientes' as never)
        .update({
          nome_empresa: form.razao_social,
          cnpj: form.cnpj,
          segmento: form.segmento,
          quantidade_colaboradores: parseInt(form.quantidade_colaboradores) || null,
        } as never)
        .eq('id', cliente.id);
      toast.success("Dados salvos com sucesso!");
      onConcluir();
    } catch (e) {
      toast.error("Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4 p-4 bg-primary/5 rounded-xl border border-primary/10">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold">Vamos configurar sua empresa</p>
          <p className="text-xs text-muted-foreground mt-1">
            Para que o sistema gere os primeiros indicadores organizacionais, precisamos das informações básicas da empresa.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Label htmlFor="razao">Razão Social *</Label>
          <Input id="razao" value={form.razao_social} onChange={e => setForm(f => ({ ...f, razao_social: e.target.value }))} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="cnpj">CNPJ *</Label>
          <Input id="cnpj" value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} className="mt-1" placeholder="00.000.000/0000-00" />
        </div>
        <div>
          <Label htmlFor="cnae">CNAE</Label>
          <Input id="cnae" value={form.cnae} onChange={e => setForm(f => ({ ...f, cnae: e.target.value }))} className="mt-1" placeholder="Ex: 6201-5/01" />
        </div>
        <div>
          <Label htmlFor="qtd">Número de Colaboradores</Label>
          <Input id="qtd" type="number" value={form.quantidade_colaboradores} onChange={e => setForm(f => ({ ...f, quantidade_colaboradores: e.target.value }))} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="segmento">Segmento</Label>
          <Input id="segmento" value={form.segmento} onChange={e => setForm(f => ({ ...f, segmento: e.target.value }))} className="mt-1" placeholder="Ex: Construção Civil" />
        </div>
        <div>
          <Label htmlFor="cidade">Cidade</Label>
          <Input id="cidade" value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="resp">Responsável Principal</Label>
          <Input id="resp" value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} className="mt-1" />
        </div>
      </div>

      <Button onClick={salvar} disabled={salvando} className="w-full">
        {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCheck className="w-4 h-4 mr-2" />}
        Confirmar Dados da Empresa
      </Button>
    </div>
  );
}

// ─── Step: Colaboradores ──────────────────────────────────────────────────────

function StepColaboradores({ cliente, onConcluir }: { cliente: Cliente; onConcluir: () => void }) {
  const [modo, setModo] = useState<'escolha' | 'importar' | 'manual' | 'integracao' | 'done'>('escolha');
  const [dragOver, setDragOver] = useState(false);

  if (modo === 'done') {
    return (
      <div className="text-center py-8 space-y-3">
        <CheckCircle2 className="w-16 h-16 text-primary mx-auto" />
        <p className="text-lg font-semibold">Estrutura configurada!</p>
        <p className="text-sm text-muted-foreground">O sistema está preparando os indicadores iniciais.</p>
        <Button onClick={onConcluir}>Continuar <ArrowRight className="w-4 h-4 ml-2" /></Button>
      </div>
    );
  }

  if (modo === 'importar') {
    return (
      <div className="space-y-4">
        <button onClick={() => setModo('escolha')} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          ← Voltar
        </button>
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); toast.success("Planilha recebida! Processando..."); setTimeout(() => setModo('done'), 1500); }}
        className={`border-2 border-dashed rounded-xl p-10 text-center transition-all ${
            dragOver ? 'border-primary bg-primary/5' : 'border-muted/60 hover:border-primary/50'
          }`}
        >
          <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium text-sm">Arraste a planilha aqui</p>
          <p className="text-xs text-muted-foreground mt-1">ou clique para selecionar o arquivo</p>
          <p className="text-xs text-muted-foreground mt-3 bg-muted/50 rounded p-2 inline-block">
            Campos esperados: <strong>nome, CPF, função, departamento</strong>
          </p>
          <div className="mt-4">
            <Button variant="outline" size="sm">Selecionar arquivo</Button>
          </div>
        </div>
        <div className="bg-muted/30 rounded-lg p-3 space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase">O sistema irá automaticamente:</p>
          {['Criar funções a partir da coluna "função"', 'Criar departamentos a partir da coluna "departamento"', 'Cadastrar todos os colaboradores', 'Gerar estrutura organizacional inicial'].map(item => (
            <div key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="w-3 h-3 text-primary shrink-0" />
              {item}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (modo === 'manual') {
    return (
      <div className="space-y-4">
        <button onClick={() => setModo('escolha')} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          ← Voltar
        </button>
        <div className="bg-accent/30 border border-accent rounded-lg p-3 text-xs text-accent-foreground">
          <strong>Ordem obrigatória de cadastro:</strong> Para garantir a integridade dos dados, siga a sequência abaixo.
        </div>
        {[
          { icon: <Briefcase className="w-5 h-5" />, num: '1', title: 'Cadastro de Funções', desc: 'Crie as funções/cargos existentes na empresa', link: '/cadastros/cargos' },
          { icon: <LayoutGrid className="w-5 h-5" />, num: '2', title: 'Cadastro de Departamentos', desc: 'Crie os departamentos/setores', link: '/cadastros/departamentos' },
          { icon: <Users className="w-5 h-5" />, num: '3', title: 'Cadastro de Colaboradores', desc: 'Adicione os colaboradores com suas funções e departamentos', link: '/colaboradores' },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-muted/50 hover:border-primary/30 transition-all">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
              {item.num}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <Button size="sm" variant="outline" className="text-xs shrink-0" onClick={() => window.open(item.link, '_blank')}>
              Acessar <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        ))}
        <Button onClick={() => setModo('done')} className="w-full">
          Já cadastrei todos os colaboradores <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
        <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          Como deseja configurar a estrutura de colaboradores?
        </p>
      </div>
      {[
        {
          mode: 'importar' as const,
          icon: <Upload className="w-6 h-6" />,
          title: 'Importar planilha',
          desc: 'Recomendado. Reduza 80% do trabalho enviando uma planilha com seus colaboradores.',
          badge: 'Mais rápido'
        },
        {
          mode: 'integracao' as const,
          icon: <LayoutGrid className="w-6 h-6" />,
          title: 'Integrar sistema existente',
          desc: 'Conectar com seu sistema de RH ou folha de pagamento.',
          badge: null
        },
        {
          mode: 'manual' as const,
          icon: <Users className="w-6 h-6" />,
          title: 'Cadastrar manualmente',
          desc: 'Adicionar colaboradores um a um com orientação passo a passo.',
          badge: null
        },
      ].map(opt => (
        <button
          key={opt.mode}
          onClick={() => setModo(opt.mode)}
          className="w-full flex items-center gap-4 p-4 bg-background border border-border rounded-xl hover:border-primary/40 hover:bg-primary/3 transition-all text-left group"
        >
          <div className="p-2.5 bg-muted rounded-lg text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-all">
            {opt.icon}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">{opt.title}</p>
              {opt.badge && <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{opt.badge}</span>}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-all" />
        </button>
      ))}
    </div>
  );
}

// ─── Step: Diagnóstico ────────────────────────────────────────────────────────

function StepDiagnostico({ cliente, onConcluir }: { cliente: Cliente; onConcluir: () => void }) {
  const maturidade = calcularNivelMaturidade(cliente.quantidade_colaboradores);

  return (
    <div className="space-y-4">
      <div className="p-4 bg-primary/5 border border-primary/15 rounded-xl space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold">Análise do perfil da empresa</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Com base nos dados inseridos, o sistema identificou o nível de maturidade da sua organização:
        </p>
        <div className="flex items-center gap-3 bg-background rounded-lg p-3 border border-border">
          <div className="flex gap-1">
            {[1,2,3].map(n => (
              <Star key={n} className={`w-4 h-4 ${n <= maturidade.nivel ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/20'}`} />
            ))}
          </div>
          <div>
            <p className={`text-sm font-bold ${maturidade.cor}`}>Nível {maturidade.nivel} — {maturidade.label}</p>
            <p className="text-xs text-muted-foreground">{maturidade.descricao}</p>
          </div>
        </div>
      </div>

      <div className="p-4 border border-primary/20 rounded-xl bg-background space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Módulo recomendado para você</p>
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">{maturidade.modulo}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {maturidade.nivel === 1 && 'Mapeie comunicação, clima, organização e carga de trabalho da sua empresa.'}
              {maturidade.nivel === 2 && 'Identifique fatores de risco psicossocial alinhados à NR-1.'}
              {maturidade.nivel === 3 && 'Diagnóstico completo incluindo psicossocial, estrutura organizacional e indicadores de gestão.'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <Button onClick={onConcluir} className="w-full">
          <Rocket className="w-4 h-4 mr-2" />
          Iniciar {maturidade.modulo}
        </Button>
        <Button variant="outline" onClick={onConcluir} className="w-full text-muted-foreground">
          Fazer isso depois
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OnboardingCliente() {
  const { token } = useParams<{ token: string }>();
  const [stepAtivo, setStepAtivo] = useState<string | null>(null);

  // Buscar cliente pelo token de onboarding
  const { data: cliente, isLoading, error } = useQuery({
    queryKey: ['onboarding-cliente', token],
    queryFn: async (): Promise<Cliente | null> => {
      if (!token) return null;
      const { data, error } = await supabase
        .from('programa_validador_clientes' as never)
        .select('*')
        .eq('onboarding_token', token)
        .maybeSingle() as { data: Cliente | null; error: Error | null };
      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });

  // Buscar contratos
  const { data: contratos = [] } = useQuery({
    queryKey: ['onboarding-contratos', cliente?.id],
    queryFn: async (): Promise<Contrato[]> => {
      if (!cliente?.id) return [];
      const { data } = await supabase
        .from('programa_validador_contratos' as never)
        .select('id, token, status, assinado_em, html_assinado')
        .eq('cliente_id', cliente.id)
        .order('created_at', { ascending: false }) as { data: Contrato[] | null };
      return data || [];
    },
    enabled: !!cliente?.id,
    refetchInterval: 15000,
  });

  // Buscar doc links (ata kickoff)
  const { data: docLinks = [] } = useQuery({
    queryKey: ['onboarding-doclinks', cliente?.id],
    queryFn: async (): Promise<DocumentoLink[]> => {
      if (!cliente?.id) return [];
      const { data } = await supabase
        .from('programa_validador_documento_links' as never)
        .select('id, tipo, token, status, aceito_em, html_assinado, html_documento')
        .eq('cliente_id', cliente.id)
        .order('created_at', { ascending: false }) as { data: DocumentoLink[] | null };
      return data || [];
    },
    enabled: !!cliente?.id,
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando seu portal de implantação...</p>
        </div>
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center space-y-3">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold">Link inválido ou expirado</h2>
            <p className="text-sm text-muted-foreground">
              Este link de onboarding não é válido. Entre em contato com a equipe Seguramente.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calcular status
  const contratoAtivo = contratos[0];
  const ataLink = docLinks.find(d => d.tipo === 'ata_kickoff');
  const contratoAssinado = contratoAtivo?.status === 'assinado';
  const ataAceita = ataLink?.status === 'aceito';

  const maturidade = calcularNivelMaturidade(cliente.quantidade_colaboradores);

  const downloadDoc = (html: string, nomeArq: string) => {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArq;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Checklist items
  const checklistItems = [
    {
      id: 'contrato',
      label: cliente.tipo_cliente === 'pagante' ? 'Contrato de Licença de Uso' : 'Contrato Programa Validador',
      sublabel: contratoAssinado ? `Assinado em ${contratoAtivo?.assinado_em ? new Date(contratoAtivo.assinado_em).toLocaleDateString('pt-BR') : '-'}` : 'Assinatura digital obrigatória para prosseguir',
      done: contratoAssinado,
      pending: !!contratoAtivo && !contratoAssinado,
      link: contratoAtivo && !contratoAssinado ? `${window.location.origin}/contrato-assinatura/${contratoAtivo.token}` : undefined,
      downloadHtml: contratoAssinado && contratoAtivo?.html_assinado ? contratoAtivo.html_assinado : null,
      downloadNome: 'Contrato-Programa-Validador-Assinado.html',
    },
    {
      id: 'ata',
      label: 'Ata de Kickoff',
      sublabel: ataAceita ? `Assinada em ${ataLink?.aceito_em ? new Date(ataLink.aceito_em).toLocaleDateString('pt-BR') : '-'}` : ataLink ? 'Aguardando sua assinatura' : 'Será disponibilizada pela equipe Seguramente',
      done: ataAceita,
      pending: !!ataLink && !ataAceita,
      link: ataLink && !ataAceita ? `${window.location.origin}/aceite-documento/${ataLink.token}` : undefined,
      downloadHtml: ataAceita && ataLink ? (ataLink.html_assinado || ataLink.html_documento) : null,
      downloadNome: 'Ata-Kickoff-Assinada.html',
    },
    {
      id: 'empresa',
      label: 'Cadastro da Empresa',
      sublabel: 'Dados básicos para configuração do sistema',
      done: !!cliente.cnpj,
      pending: false,
      downloadHtml: null,
      downloadNome: '',
    },
    {
      id: 'colaboradores',
      label: 'Estrutura Organizacional',
      sublabel: 'Colaboradores, departamentos e funções',
      done: false,
      pending: false,
      downloadHtml: null,
      downloadNome: '',
    },
    {
      id: 'diagnostico',
      label: 'Diagnóstico Inicial',
      sublabel: maturidade.modulo,
      done: false,
      pending: false,
      downloadHtml: null,
      downloadNome: '',
    },
  ];

  const concluidos = checklistItems.filter(c => c.done).length;
  const progresso = Math.round((concluidos / checklistItems.length) * 100);

  // Determinar próximo passo
  const proximoPasso = checklistItems.find(c => !c.done);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/3">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Seguramente</p>
              <p className="text-xs text-muted-foreground">Portal de Implantação</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-foreground">{cliente.nome_empresa}</p>
            <p className="text-xs text-muted-foreground">{cliente.poc_nome}</p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Fase Progress */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold">Jornada de Implantação</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Acompanhe o progresso da sua implantação</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">{progresso}%</p>
              <p className="text-xs text-muted-foreground">concluído</p>
            </div>
          </div>
          <FaseProgress fase={cliente.fase} />
          <div className="mt-5">
            <Progress value={progresso} className="h-2" />
          </div>
        </Card>

        {/* Boas-vindas */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-primary/8 via-primary/5 to-transparent border border-primary/15 rounded-2xl p-5"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-bold">
                Bem-vindo ao Seguramente{cliente.poc_nome ? `, ${cliente.poc_nome.split(' ')[0]}` : ''}! 👋
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Vamos configurar a <strong>{cliente.nome_empresa}</strong> para que o sistema possa gerar os primeiros indicadores organizacionais.
                Siga o assistente de implantação abaixo.
              </p>
              {proximoPasso && (
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <ArrowRight className="w-4 h-4 text-primary" />
                  <span className="text-primary font-medium">Próximo: {proximoPasso.label}</span>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Checklist lateral */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Checklist de Implantação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {checklistItems.map(item => (
                  <div key={item.id}>
                    <ChecklistItem
                      label={item.label}
                      sublabel={item.sublabel}
                      done={item.done}
                      pending={item.pending}
                      link={item.link}
                      onClick={!item.done && ['empresa', 'colaboradores', 'diagnostico'].includes(item.id) ? () => setStepAtivo(item.id) : undefined}
                    />
                    {item.done && item.downloadHtml && (
                      <button
                        onClick={() => downloadDoc(item.downloadHtml!, item.downloadNome)}
                        className="ml-7 mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Download className="w-3 h-3" /> Baixar documento assinado
                      </button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Nível de maturidade */}
            <Card className="border-primary/10 bg-primary/3">
              <CardContent className="pt-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Perfil da Empresa</p>
                <div className="flex items-center gap-2">
                  {[1,2,3].map(n => (
                    <Star key={n} className={`w-4 h-4 ${n <= maturidade.nivel ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/20'}`} />
                  ))}
                  <span className={`text-sm font-bold ${maturidade.cor}`}>{maturidade.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{maturidade.descricao}</p>
              </CardContent>
            </Card>
          </div>

          {/* Área central – assistente */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <Rocket className="w-5 h-5 text-primary" />
                  Assistente de Implantação
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <AnimatePresence mode="wait">
                  {!stepAtivo && (
                    <motion.div
                      key="welcome"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-3"
                    >
                      {/* Passos disponíveis */}
                      {[
                        {
                          id: 'contrato',
                          icon: <FileText className="w-5 h-5" />,
                          title: cliente.tipo_cliente === 'pagante' ? 'Contrato de Licença de Uso' : 'Contrato Programa Validador',
                          desc: 'Assinatura digital do contrato com todos os anexos jurídicos.',
                          done: contratoAssinado,
                          action: contratoAtivo ? () => window.open(`${window.location.origin}/contrato-assinatura/${contratoAtivo.token}`, '_blank') : undefined,
                          actionLabel: 'Assinar agora',
                        },
                        {
                          id: 'ata',
                          icon: <CheckCheck className="w-5 h-5" />,
                          title: 'Ata de Kickoff',
                          desc: 'Confirme os termos do início do projeto.',
                          done: ataAceita,
                          action: ataLink ? () => window.open(`${window.location.origin}/aceite-documento/${ataLink.token}`, '_blank') : undefined,
                          actionLabel: 'Aceitar documento',
                        },
                        {
                          id: 'empresa',
                          icon: <Building2 className="w-5 h-5" />,
                          title: 'Passo 1 — Cadastro da Empresa',
                          desc: 'Configure os dados básicos da sua empresa no sistema.',
                          done: !!cliente.cnpj,
                          action: () => setStepAtivo('empresa'),
                          actionLabel: 'Configurar',
                        },
                        {
                          id: 'colaboradores',
                          icon: <Users className="w-5 h-5" />,
                          title: 'Passo 2 — Estrutura Organizacional',
                          desc: 'Importe ou cadastre colaboradores, departamentos e funções.',
                          done: false,
                          action: () => setStepAtivo('colaboradores'),
                          actionLabel: 'Configurar',
                        },
                        {
                          id: 'diagnostico',
                          icon: <BarChart3 className="w-5 h-5" />,
                          title: 'Passo 3 — Diagnóstico Inicial',
                          desc: `Inicie o ${maturidade.modulo} para gerar os primeiros indicadores.`,
                          done: false,
                          action: () => setStepAtivo('diagnostico'),
                          actionLabel: 'Iniciar',
                        },
                      ].map((step, i) => (
                        <div
                          key={step.id}
                          className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                            step.done
                              ? 'bg-primary/5 border-primary/20 opacity-70'
                              : 'bg-background border-border hover:border-primary/30 hover:bg-muted/20'
                          }`}
                        >
                          <div className={`p-2.5 rounded-lg shrink-0 ${step.done ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            {step.done ? <CheckCircle2 className="w-5 h-5" /> : step.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold ${step.done ? 'line-through text-muted-foreground' : ''}`}>{step.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                          </div>
                          {!step.done && step.action && (
                            <Button size="sm" onClick={step.action} className="shrink-0">
                              {step.actionLabel} <ChevronRight className="w-3 h-3 ml-1" />
                            </Button>
                          )}
                          {step.done && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
                        </div>
                      ))}
                    </motion.div>
                  )}

                  {stepAtivo === 'empresa' && (
                    <motion.div key="empresa" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <button onClick={() => setStepAtivo(null)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
                        ← Voltar ao assistente
                      </button>
                      <StepEmpresa cliente={cliente} onConcluir={() => { setStepAtivo(null); toast.success("Empresa cadastrada! ✓"); }} />
                    </motion.div>
                  )}

                  {stepAtivo === 'colaboradores' && (
                    <motion.div key="colaboradores" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <button onClick={() => setStepAtivo(null)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
                        ← Voltar ao assistente
                      </button>
                      <StepColaboradores cliente={cliente} onConcluir={() => setStepAtivo(null)} />
                    </motion.div>
                  )}

                  {stepAtivo === 'diagnostico' && (
                    <motion.div key="diagnostico" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <button onClick={() => setStepAtivo(null)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
                        ← Voltar ao assistente
                      </button>
                      <StepDiagnostico cliente={cliente} onConcluir={() => setStepAtivo(null)} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground">
            Dúvidas? Entre em contato com a equipe Seguramente.
            {cliente.poc_email && <> · <a href={`mailto:${cliente.poc_email}`} className="underline">{cliente.poc_email}</a></>}
          </p>
        </div>
      </div>
    </div>
  );
}
