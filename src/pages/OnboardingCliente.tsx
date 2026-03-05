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

// ─── Diagnóstico Inicial de Implantação ──────────────────────────────────────

interface BlocoRespostas { [perguntaId: string]: boolean }

const BLOCOS_DIAGNOSTICO = [
  {
    id: 'estrutura',
    titulo: 'Estrutura Organizacional',
    descricao: 'Nível de organização estrutural da empresa',
    icon: '🏢',
    perguntas: [
      { id: 'e1', texto: 'A empresa possui departamentos definidos?' },
      { id: 'e2', texto: 'Existe responsável por cada setor?' },
      { id: 'e3', texto: 'Existem descrições de função formalizadas?' },
      { id: 'e4', texto: 'A empresa possui organograma definido?' },
    ],
    classificar: (positivas: number) =>
      positivas <= 1 ? 'Estrutura inicial' : positivas <= 3 ? 'Estrutura intermediária' : 'Estrutura organizada',
  },
  {
    id: 'gestao',
    titulo: 'Gestão de Pessoas',
    descricao: 'Maturidade na gestão de colaboradores',
    icon: '👥',
    perguntas: [
      { id: 'g1', texto: 'A empresa realiza avaliações periódicas de colaboradores?' },
      { id: 'g2', texto: 'Existe acompanhamento de clima organizacional?' },
      { id: 'g3', texto: 'Há políticas internas formalizadas?' },
      { id: 'g4', texto: 'Existem indicadores de gestão de pessoas?' },
    ],
    classificar: (positivas: number) =>
      positivas <= 1 ? 'Baixa maturidade' : positivas <= 3 ? 'Média maturidade' : 'Alta maturidade',
  },
  {
    id: 'sst',
    titulo: 'Saúde e Segurança do Trabalho',
    descricao: 'Nível de gestão em SST',
    icon: '🛡️',
    perguntas: [
      { id: 's1', texto: 'A empresa possui PGR ativo?' },
      { id: 's2', texto: 'Possui PCMSO vigente?' },
      { id: 's3', texto: 'Realiza treinamentos obrigatórios?' },
      { id: 's4', texto: 'Controla exames ocupacionais?' },
    ],
    classificar: (positivas: number) =>
      positivas <= 1 ? 'Básico' : positivas <= 3 ? 'Intermediário' : 'Estruturado',
  },
  {
    id: 'psicossocial',
    titulo: 'Riscos Psicossociais',
    descricao: 'Fatores que impactam saúde mental',
    icon: '🧠',
    perguntas: [
      { id: 'p1', texto: 'A empresa já realizou avaliação psicossocial?' },
      { id: 'p2', texto: 'Existem indicadores de absenteísmo?' },
      { id: 'p3', texto: 'Há registro de afastamentos por saúde mental?' },
      { id: 'p4', texto: 'Existe canal de escuta ou feedback organizacional?' },
    ],
    classificar: (positivas: number) =>
      positivas <= 1 ? 'Inicial' : positivas <= 3 ? 'Intermediário' : 'Avançado',
  },
];

function calcularIndice(respostas: BlocoRespostas): number {
  const total = Object.keys(respostas).length;
  if (total === 0) return 0;
  const positivas = Object.values(respostas).filter(Boolean).length;
  return Math.round((positivas / total) * 100);
}

function calcularNivelIndice(indice: number): { label: string; cor: string; bg: string } {
  if (indice <= 25) return { label: 'Inicial', cor: 'text-destructive', bg: 'bg-destructive/10 border-destructive/20' };
  if (indice <= 50) return { label: 'Básico', cor: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/20' };
  if (indice <= 75) return { label: 'Estruturado', cor: 'text-blue-600', bg: 'bg-blue-500/10 border-blue-500/20' };
  return { label: 'Avançado', cor: 'text-primary', bg: 'bg-primary/10 border-primary/20' };
}

function gerarPrioridades(indice: number): { ordem: number; texto: string; rota?: string }[] {
  if (indice <= 25) return [
    { ordem: 1, texto: 'Cadastro de funções', rota: '/estrutura/cargos' },
    { ordem: 2, texto: 'Organização de departamentos', rota: '/estrutura/departamentos' },
    { ordem: 3, texto: 'Cadastro de colaboradores', rota: '/colaboradores' },
    { ordem: 4, texto: 'Estrutura organizacional', rota: '/estrutura' },
  ];
  if (indice <= 50) return [
    { ordem: 1, texto: 'Organograma organizacional', rota: '/estrutura/organograma' },
    { ordem: 2, texto: 'Responsáveis por setor', rota: '/estrutura/departamentos' },
    { ordem: 3, texto: 'Indicadores de gestão', rota: '/dashboard' },
  ];
  return [
    { ordem: 1, texto: 'Diagnóstico psicossocial organizacional', rota: '/psicossocial' },
    { ordem: 2, texto: 'Indicadores organizacionais', rota: '/dashboard' },
    { ordem: 3, texto: 'Monitoramento contínuo', rota: '/dashboard' },
  ];
}

// ─── Step: Diagnóstico ────────────────────────────────────────────────────────

function StepDiagnostico({ cliente, onConcluir }: { cliente: Cliente; onConcluir: () => void }) {
  const [fase, setFase] = useState<'intro' | 'blocos' | 'resultado'>('intro');
  const [blocoAtual, setBlocoAtual] = useState(0);
  const [respostas, setRespostas] = useState<BlocoRespostas>({});
  const [salvando, setSalvando] = useState(false);

  const bloco = BLOCOS_DIAGNOSTICO[blocoAtual];
  const totalPerguntas = BLOCOS_DIAGNOSTICO.reduce((acc, b) => acc + b.perguntas.length, 0);
  const perguntasRespondidas = Object.keys(respostas).length;
  const progresso = Math.round((perguntasRespondidas / totalPerguntas) * 100);

  // Calcular resultado por bloco
  const resultadosBlocos = BLOCOS_DIAGNOSTICO.map(b => {
    const positivas = b.perguntas.filter(p => respostas[p.id] === true).length;
    return { ...b, positivas, classificacao: b.classificar(positivas) };
  });

  const indice = calcularIndice(respostas);
  const nivelIndice = calcularNivelIndice(indice);
  const prioridades = gerarPrioridades(indice);

  const handleResposta = (perguntaId: string, valor: boolean) => {
    setRespostas(prev => ({ ...prev, [perguntaId]: valor }));
  };

  const blocoCompleto = bloco?.perguntas.every(p => respostas[p.id] !== undefined);
  const isUltimoBloco = blocoAtual === BLOCOS_DIAGNOSTICO.length - 1;

  const handleAvancar = () => {
    if (isUltimoBloco) {
      setFase('resultado');
    } else {
      setBlocoAtual(b => b + 1);
    }
  };

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      const resultado = {
        respostas,
        indice,
        nivel: nivelIndice.label,
        blocos: resultadosBlocos.map(b => ({ id: b.id, titulo: b.titulo, classificacao: b.classificacao, positivas: b.positivas })),
        prioridades,
        data: new Date().toISOString(),
      };
      await supabase
        .from('programa_validador_clientes')
        .update({
          diagnostico_iniciado: true,
          diagnostico_resultado: resultado as never,
        } as never)
        .eq('id', cliente.id);
      toast.success('Diagnóstico salvo com sucesso!');
      onConcluir();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar diagnóstico');
    } finally {
      setSalvando(false);
    }
  };

  // ── Intro ──
  if (fase === 'intro') {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-primary/5 border border-primary/15 rounded-xl space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold">Diagnóstico Inicial de Implantação</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Avaliação estratégica em 4 blocos para identificar o nível de maturidade organizacional
            e direcionar sua implantação de forma personalizada.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {BLOCOS_DIAGNOSTICO.map(b => (
            <div key={b.id} className="p-3 bg-muted/30 rounded-lg border border-border flex items-start gap-2">
              <span className="text-base">{b.icon}</span>
              <div>
                <p className="text-xs font-semibold">{b.titulo}</p>
                <p className="text-xs text-muted-foreground">{b.perguntas.length} perguntas</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { icon: <BarChart3 className="w-4 h-4" />, label: '4 blocos' },
            { icon: <Clock className="w-4 h-4" />, label: '~5 minutos' },
            { icon: <Rocket className="w-4 h-4" />, label: 'Plano automático' },
          ].map(item => (
            <div key={item.label} className="p-2 bg-muted/50 rounded-lg flex flex-col items-center gap-1">
              <span className="text-primary">{item.icon}</span>
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-2">
          <Button onClick={() => setFase('blocos')} className="w-full">
            <Rocket className="w-4 h-4 mr-2" />
            Iniciar Diagnóstico
          </Button>
          <Button variant="outline" onClick={onConcluir} className="w-full text-muted-foreground">
            Fazer isso depois
          </Button>
        </div>
      </div>
    );
  }

  // ── Blocos ──
  if (fase === 'blocos') {
    return (
      <div className="space-y-4">
        {/* Header bloco */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Bloco {blocoAtual + 1} de {BLOCOS_DIAGNOSTICO.length}</span>
            <span>{progresso}% concluído</span>
          </div>
          <Progress value={progresso} className="h-1.5" />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={blocoAtual}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">{bloco.icon}</span>
              <div>
                <p className="text-sm font-bold">{bloco.titulo}</p>
                <p className="text-xs text-muted-foreground">{bloco.descricao}</p>
              </div>
            </div>

            <div className="space-y-2">
              {bloco.perguntas.map(pergunta => {
                const resp = respostas[pergunta.id];
                return (
                  <div key={pergunta.id} className="p-3 rounded-xl border border-border bg-background space-y-2">
                    <p className="text-xs font-medium leading-snug">{pergunta.texto}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResposta(pergunta.id, true)}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                          resp === true
                            ? 'bg-primary/15 border-primary text-primary'
                            : 'border-border hover:border-primary/40 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        ✓ Sim
                      </button>
                      <button
                        onClick={() => handleResposta(pergunta.id, false)}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                          resp === false
                            ? 'bg-destructive/10 border-destructive/50 text-destructive'
                            : 'border-border hover:border-destructive/30 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        ✗ Não
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flex gap-2">
          {blocoAtual > 0 && (
            <Button variant="outline" size="sm" onClick={() => setBlocoAtual(b => b - 1)} className="text-muted-foreground">
              ← Voltar
            </Button>
          )}
          <Button
            onClick={handleAvancar}
            disabled={!blocoCompleto}
            className="flex-1"
          >
            {isUltimoBloco ? 'Ver Resultado' : 'Próximo Bloco'}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  // ── Resultado ──
  return (
    <div className="space-y-4">
      {/* Índice principal */}
      <div className={`p-5 rounded-xl border text-center space-y-2 ${nivelIndice.bg}`}>
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Diagnóstico Organizacional Concluído</p>
        <div className="flex items-center justify-center gap-2">
          <BarChart3 className={`w-6 h-6 ${nivelIndice.cor}`} />
          <p className={`text-xl font-black ${nivelIndice.cor}`}>{nivelIndice.label}</p>
        </div>
        <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold bg-background border ${nivelIndice.cor}`}>
          Índice de Maturidade: {indice}/100
        </div>
        <Progress value={indice} className="h-2 mt-1" />
      </div>

      {/* Resultados por bloco */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Resultados por Bloco</p>
        {resultadosBlocos.map(b => (
          <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background">
            <div className="flex items-center gap-2">
              <span className="text-sm">{b.icon}</span>
              <p className="text-xs font-medium">{b.titulo}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                b.positivas >= 3 ? 'bg-primary/10 text-primary' :
                b.positivas >= 2 ? 'bg-blue-500/10 text-blue-600' :
                b.positivas >= 1 ? 'bg-amber-500/10 text-amber-600' :
                'bg-destructive/10 text-destructive'
              }`}>
                {b.classificacao}
              </span>
              <span className="text-xs text-muted-foreground">{b.positivas}/{b.perguntas.length}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Plano de implantação */}
      <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-3">
        <p className="text-xs font-semibold">🗺️ Plano de Implantação Recomendado</p>
        <p className="text-xs text-muted-foreground">
          Com base no diagnóstico, recomendamos iniciar pelos seguintes módulos:
        </p>
        <div className="space-y-1.5">
          {prioridades.map(p => (
            <div key={p.ordem} className="flex items-center gap-2 text-xs">
              <span className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">
                {p.ordem}
              </span>
              <span className="font-medium">{p.texto}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <Button onClick={handleSalvar} disabled={salvando} className="w-full">
          {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
          {salvando ? 'Salvando...' : 'Salvar e Continuar'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => { setFase('blocos'); setBlocoAtual(0); }} className="text-muted-foreground">
          Refazer diagnóstico
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
                          desc: contratoAssinado ? 'Contrato assinado por todas as partes.' : 'Assinatura digital do contrato com todos os anexos jurídicos.',
                          done: contratoAssinado,
                          action: contratoAtivo && !contratoAssinado ? () => window.open(`${window.location.origin}/contrato-assinatura/${contratoAtivo.token}`, '_blank') : undefined,
                          actionLabel: 'Assinar agora',
                          downloadHtml: contratoAssinado && contratoAtivo?.html_assinado ? contratoAtivo.html_assinado : null,
                          downloadNome: 'Contrato-Programa-Validador-Assinado.html',
                        },
                        {
                          id: 'ata',
                          icon: <CheckCheck className="w-5 h-5" />,
                          title: 'Ata de Kickoff',
                          desc: ataAceita ? 'Ata assinada por todas as partes.' : ataLink ? 'Aguardando sua assinatura.' : 'Será disponibilizada pela equipe Seguramente.',
                          done: ataAceita,
                          action: ataLink && !ataAceita ? () => window.open(`${window.location.origin}/aceite-documento/${ataLink.token}`, '_blank') : undefined,
                          actionLabel: 'Assinar agora',
                          downloadHtml: ataAceita && ataLink ? (ataLink.html_assinado || ataLink.html_documento) : null,
                          downloadNome: 'Ata-Kickoff-Assinada.html',
                        },
                        {
                          id: 'empresa',
                          icon: <Building2 className="w-5 h-5" />,
                          title: 'Passo 1 — Cadastro da Empresa',
                          desc: 'Configure os dados básicos da sua empresa no sistema.',
                          done: !!cliente.cnpj,
                          action: () => setStepAtivo('empresa'),
                          actionLabel: 'Configurar',
                          downloadHtml: null,
                          downloadNome: '',
                        },
                        {
                          id: 'colaboradores',
                          icon: <Users className="w-5 h-5" />,
                          title: 'Passo 2 — Estrutura Organizacional',
                          desc: 'Importe ou cadastre colaboradores, departamentos e funções.',
                          done: false,
                          action: () => setStepAtivo('colaboradores'),
                          actionLabel: 'Configurar',
                          downloadHtml: null,
                          downloadNome: '',
                        },
                        {
                          id: 'diagnostico',
                          icon: <BarChart3 className="w-5 h-5" />,
                          title: 'Passo 3 — Diagnóstico Inicial',
                          desc: `Inicie o ${maturidade.modulo} para gerar os primeiros indicadores.`,
                          done: false,
                          action: () => setStepAtivo('diagnostico'),
                          actionLabel: 'Iniciar',
                          downloadHtml: null,
                          downloadNome: '',
                        },
                      ].map((step) => (
                        <div
                          key={step.id}
                          className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                            step.done
                              ? 'bg-primary/5 border-primary/20'
                              : 'bg-background border-border hover:border-primary/30 hover:bg-muted/20'
                          }`}
                        >
                          <div className={`p-2.5 rounded-lg shrink-0 ${step.done ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            {step.done ? <CheckCircle2 className="w-5 h-5" /> : step.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold ${step.done ? 'text-muted-foreground' : ''}`}>{step.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                          </div>
                          <div className="shrink-0 flex flex-col gap-1 items-end">
                            {!step.done && step.action && (
                              <Button size="sm" onClick={step.action}>
                                {step.actionLabel} <ChevronRight className="w-3 h-3 ml-1" />
                              </Button>
                            )}
                            {step.done && step.downloadHtml && (
                              <Button size="sm" variant="outline" onClick={() => downloadDoc(step.downloadHtml!, step.downloadNome)}>
                                <Download className="w-3 h-3 mr-1" /> Baixar
                              </Button>
                            )}
                            {step.done && !step.downloadHtml && <CheckCircle2 className="w-5 h-5 text-primary" />}
                          </div>
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
                      <StepDiagnostico cliente={cliente} onConcluir={() => navigate('/')} />
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
