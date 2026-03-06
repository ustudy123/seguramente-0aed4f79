import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Brain, ArrowRight, ArrowLeft, CheckCircle2,
  Building2, AlertTriangle, Shield,
  FileText, Clock, Search, Award, Zap, Activity,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'choice' | 'auto-loading' | 'checklist' | 'result';

interface SystemData {
  totalColaboradores: number;
  totalSetores: number;
  temTurnoNoturno: boolean;
  temTurnoRevezamento: boolean;
  mediaHorasExtras: number; // minutos por semana
  totalAfastamentosSaudeMental: number;
  totalAfastamentos: number;
  totalCampanhasAnteriores: number;
  temEscalaIrregular: boolean;
  grauRisco: number; // 1-4
  // Condições especiais do cadastro da empresa
  possuiTerceiroTurno: boolean;
  trabalhoAltura: boolean;
  espacoConfinado: boolean;
  insalubridade: boolean;
  periculosidade: boolean;
  aposentadoriaEspecial: boolean;
  cnae: string | null;
}

interface ChecklistRespostas {
  experienciaPrevia: '' | 'nunca' | 'uma_vez' | 'periodicamente';
  objetivo: '' | 'diagnostico' | 'gestao_lideranca' | 'investigar_afastamentos' | 'auditoria' | 'pgr';
  sinaisRisco: '' | 'nenhum' | 'alguns' | 'varios';
  complexidade: string[]; // múltipla escolha
  tipoPredominante: '' | 'administrativo' | 'industrial' | 'saude' | 'educacao' | 'logistica' | 'comercial' | 'servicos';
}

interface InstrumentoScore {
  id: 'sipro' | 'copsoq' | 'hse' | 'proart';
  nome: string;
  descricao: string;
  score: number;
  motivos: string[];
  cor: string;
  bgCor: string;
  icone: string;
}

// ─── Scoring Engine ───────────────────────────────────────────────────────────

function calcularScores(sys: SystemData, c: ChecklistRespostas): InstrumentoScore[] {
  let sipro = 0, copsoq = 0, hse = 0, proart = 0;
  const motivosSipro: string[] = [];
  const motivosCopsoq: string[] = [];
  const motivosHse: string[] = [];
  const motivosProart: string[] = [];

  // --- Tamanho da empresa ---
  if (sys.totalColaboradores <= 100) {
    sipro += 30;
    motivosSipro.push(`empresa com ${sys.totalColaboradores} colaboradores`);
  } else if (sys.totalColaboradores <= 500) {
    sipro += 15; copsoq += 20;
    motivosCopsoq.push("empresa de médio porte (100-500 colaboradores)");
  } else {
    copsoq += 30;
    motivosCopsoq.push("empresa de grande porte (500+ colaboradores)");
  }

  // --- Experiência prévia ---
  if (c.experienciaPrevia === 'nunca') {
    sipro += 25;
    motivosSipro.push("primeira avaliação psicossocial");
  } else if (c.experienciaPrevia === 'uma_vez') {
    sipro += 15; copsoq += 10;
  } else if (c.experienciaPrevia === 'periodicamente') {
    copsoq += 15; proart += 10;
    motivosCopsoq.push("empresa com histórico de avaliações periódicas");
  }

  // --- Objetivo ---
  if (c.objetivo === 'diagnostico' || c.objetivo === 'pgr') {
    sipro += 25;
    motivosSipro.push(c.objetivo === 'pgr' ? "integração ao PGR" : "objetivo de diagnóstico inicial");
  } else if (c.objetivo === 'gestao_lideranca') {
    hse += 35;
    motivosHse.push("foco em gestão e liderança organizacional");
  } else if (c.objetivo === 'investigar_afastamentos') {
    proart += 30; sipro += 10;
    motivosProart.push("investigação de aumento de afastamentos");
  } else if (c.objetivo === 'auditoria') {
    copsoq += 20;
    motivosCopsoq.push("referência internacional para auditoria");
  }

  // --- Sinais de risco ---
  if (c.sinaisRisco === 'varios') {
    proart += 25; sipro += 10;
    motivosProart.push("múltiplos sinais de risco psicossocial identificados");
  } else if (c.sinaisRisco === 'alguns') {
    sipro += 10; copsoq += 10;
  } else {
    sipro += 15;
    motivosSipro.push("ambiente sem sinais críticos de risco");
  }

  // --- Complexidade organizacional ---
  const complexidade = c.complexidade.length;
  if (complexidade >= 4) {
    copsoq += 20;
    motivosCopsoq.push("alta complexidade organizacional");
  } else if (complexidade >= 2) {
    sipro += 10; copsoq += 10;
  } else {
    sipro += 15;
  }

  if (c.complexidade.includes('turno_noturno') || c.complexidade.includes('turnos')) {
    sipro += 10;
    motivosSipro.push("trabalho em turnos — dimensão Ritmo Biológico inclusa");
  }
  if (c.complexidade.includes('alta_pressao')) {
    proart += 15; copsoq += 10;
    motivosProart.push("trabalho sob alta pressão identificado");
  }

  // --- Tipo de trabalho ---
  if (c.tipoPredominante === 'saude' || c.tipoPredominante === 'educacao') {
    proart += 15; copsoq += 10;
    motivosProart.push(`trabalho em ${c.tipoPredominante === 'saude' ? 'saúde' : 'educação'} — alta demanda emocional`);
  } else if (c.tipoPredominante === 'industrial' || c.tipoPredominante === 'logistica') {
    sipro += 15;
    motivosSipro.push(`setor ${c.tipoPredominante} — foco em condições de trabalho físico-cognitivas`);
  } else {
    sipro += 5; hse += 5;
  }

  // --- Dados automáticos do sistema ---
  if (sys.totalAfastamentosSaudeMental > 5) {
    proart += 20;
    motivosProart.push(`${sys.totalAfastamentosSaudeMental} afastamentos por saúde mental registrados`);
  } else if (sys.totalAfastamentosSaudeMental > 0) {
    sipro += 10;
    motivosSipro.push("afastamentos por saúde mental detectados no sistema");
  }

  if (sys.temTurnoNoturno || sys.temTurnoRevezamento) {
    sipro += 15;
    motivosSipro.push("turnos noturnos/revezamento — Ritmo Biológico e Recuperação coberto");
  }

  if (sys.mediaHorasExtras > 120) { // > 2h extras/semana em média
    sipro += 10; proart += 10;
    motivosSipro.push("excesso de horas extras detectado");
  }

  if (sys.grauRisco >= 3) {
    proart += 10; sipro += 10;
    motivosSipro.push(`empresa grau de risco ${sys.grauRisco} (NR-04)`);
  }

  if (sys.totalCampanhasAnteriores === 0) {
    sipro += 20;
    motivosSipro.push("nenhuma campanha psicossocial anterior no sistema");
  }

  // Boost autoral Seguramente
  sipro += 5;
  motivosSipro.push("instrumento validado e integrado ao Seguramente");

  const total = (s: number) => Math.min(100, Math.round(s));

  const result: InstrumentoScore[] = [
    {
      id: 'sipro' as const,
      nome: 'SIPRO',
      descricao: 'Instrumento autoral Seguramente — alinhado à NR-01, NR-17, ISO 45001 e ISO 45003. Diagnóstico multidimensional com 52 itens e cálculo integrado ao sistema.',
      score: total(sipro),
      motivos: motivosSipro.filter(Boolean).slice(0, 4),
      cor: 'text-purple-700',
      bgCor: 'bg-purple-50 border-purple-200',
      icone: '⭐',
    },
    {
      id: 'copsoq' as const,
      nome: 'COPSOQ III',
      descricao: 'Instrumento psicossocial mais utilizado internacionalmente, com base científica robusta e ampla cobertura de fatores organizacionais.',
      score: total(copsoq),
      motivos: motivosCopsoq.filter(Boolean).slice(0, 4),
      cor: 'text-blue-700',
      bgCor: 'bg-blue-50 border-blue-200',
      icone: '🌍',
    },
    {
      id: 'hse' as const,
      nome: 'HSE Management Standards',
      descricao: 'Focado em fatores organizacionais de estresse relacionados à gestão, liderança e mudanças organizacionais.',
      score: total(hse),
      motivos: motivosHse.filter(Boolean).slice(0, 4),
      cor: 'text-emerald-700',
      bgCor: 'bg-emerald-50 border-emerald-200',
      icone: '🏛️',
    },
    {
      id: 'proart' as const,
      nome: 'PROART',
      descricao: 'Instrumento aprofundado para investigação detalhada de sofrimento e danos relacionados ao trabalho. Indicado quando há sinais críticos.',
      score: total(proart),
      motivos: motivosProart.filter(Boolean).slice(0, 4),
      cor: 'text-amber-700',
      bgCor: 'bg-amber-50 border-amber-200',
      icone: '🔬',
    },
  ];
  return result.sort((a, b) => b.score - a.score);
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AssistenteSelecaoInstrumentoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectInstrumento: (instrumento: string, manual: boolean) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AssistenteSelecaoInstrumento({
  open, onOpenChange, onSelectInstrumento,
}: AssistenteSelecaoInstrumentoProps) {
  const { user } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();
  const [step, setStep] = useState<Step>('choice');
  const [sysData, setSysData] = useState<SystemData | null>(null);
  const [respostas, setRespostas] = useState<ChecklistRespostas>({
    experienciaPrevia: '',
    objetivo: '',
    sinaisRisco: '',
    complexidade: [],
    tipoPredominante: '',
  });
  const [scores, setScores] = useState<InstrumentoScore[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep('choice');
      setCurrentQuestion(0);
      setRespostas({ experienciaPrevia: '', objetivo: '', sinaisRisco: '', complexidade: [], tipoPredominante: '' });
      setScores([]);
    }
  }, [open]);

  // Load system data
  const loadSystemData = async () => {
    setStep('auto-loading');
    try {
      const tenantId = user
        ? (await supabase.from('profiles').select('tenant_id').eq('user_id', user.id).single()).data?.tenant_id
        : null;

      // Queries paralelas — filtrando por empresa ativa quando disponível
      const empresaFilter = empresaAtivaId ? { empresa_id: empresaAtivaId } : {};

      const [campanhasRes, afastamentosRes, escalasRes, empresaRes, colaboradoresRes, setoresRes] =
        await Promise.allSettled([
          // Campanhas psicossociais anteriores
          tenantId
            ? (supabase as any).from('psicossocial_campanhas').select('id', { count: 'exact' }).eq('tenant_id', tenantId)
            : Promise.resolve({ data: [], count: 0 }),

          // Afastamentos filtrados pela empresa ativa
          tenantId
            ? supabase.from('afastamentos')
                .select('motivo_principal, nexo_trabalho')
                .eq('tenant_id', tenantId)
                .match(empresaFilter)
            : Promise.resolve({ data: [] }),

          // Escalas de ponto
          tenantId
            ? supabase.from('ponto_escalas').select('turno, jornada_diaria_minutos').eq('tenant_id', tenantId)
            : Promise.resolve({ data: [] }),

          // Dados da empresa ativa (grau de risco)
          tenantId && empresaAtivaId
            ? supabase.from('empresa_cadastro').select('grau_risco, total_colaboradores').eq('id', empresaAtivaId).single()
            : tenantId
              ? supabase.from('empresa_cadastro').select('grau_risco, total_colaboradores').eq('tenant_id', tenantId).limit(1).single()
              : Promise.resolve({ data: null }),

          // Contagem real de colaboradores ativos (admissoes com status ativo/concluido)
          tenantId
            ? supabase.from('admissoes')
                .select('id', { count: 'exact', head: true })
                .eq('tenant_id', tenantId)
                .not('status', 'eq', 'desligado')
                .match(empresaFilter)
            : Promise.resolve({ count: 0, data: [] }),

          // Contagem de setores/departamentos
          tenantId
            ? supabase.from('departamentos')
                .select('id', { count: 'exact', head: true })
                .eq('tenant_id', tenantId)
                .eq('ativo', true)
                .match(empresaAtivaId ? { empresa_id: empresaAtivaId } : {})
            : Promise.resolve({ count: 0, data: [] }),
        ]);

      const campanhas = campanhasRes.status === 'fulfilled' ? ((campanhasRes.value as any).data || []) : [];
      const afastamentos = afastamentosRes.status === 'fulfilled' ? (afastamentosRes.value.data || []) : [];
      const escalas = escalasRes.status === 'fulfilled' ? (escalasRes.value.data || []) : [];
      const empresa = empresaRes.status === 'fulfilled' ? (empresaRes.value as any).data : null;
      const totalColabCount = colaboradoresRes.status === 'fulfilled' ? ((colaboradoresRes.value as any).count ?? 0) : 0;
      const totalSetoresCount = setoresRes.status === 'fulfilled' ? ((setoresRes.value as any).count ?? 0) : 0;

      const afastSaudeMental = afastamentos.filter((a: any) =>
        a.motivo_principal === 'f' || a.nexo_trabalho === 'sim'
      ).length;

      const temNoturno = escalas.some((e: any) => e.turno === 'noturno' || e.turno === 'terceiro');
      const temRevezamento = escalas.some((e: any) => e.turno === 'revezamento' || e.turno === 'irregular');

      // Colaboradores: preferir contagem real, fallback ao campo do cadastro
      const totalColaboradores = totalColabCount > 0
        ? totalColabCount
        : (empresa?.total_colaboradores ?? 0);

      setSysData({
        totalColaboradores,
        totalSetores: totalSetoresCount,
        temTurnoNoturno: temNoturno,
        temTurnoRevezamento: temRevezamento,
        mediaHorasExtras: 0,
        totalAfastamentosSaudeMental: afastSaudeMental,
        totalAfastamentos: afastamentos.length,
        totalCampanhasAnteriores: campanhas.length,
        temEscalaIrregular: temRevezamento,
        grauRisco: empresa?.grau_risco ?? 2,
      });
    } catch {
      setSysData({
        totalColaboradores: 0, totalSetores: 0, temTurnoNoturno: false,
        temTurnoRevezamento: false, mediaHorasExtras: 0, totalAfastamentosSaudeMental: 0,
        totalAfastamentos: 0, totalCampanhasAnteriores: 0, temEscalaIrregular: false, grauRisco: 2,
      });
    }
    setStep('checklist');
  };

  const isChecklistComplete =
    respostas.experienciaPrevia !== '' &&
    respostas.objetivo !== '' &&
    respostas.sinaisRisco !== '' &&
    respostas.tipoPredominante !== '';

  const handleCalcular = () => {
    if (!sysData) return;
    const calculado = calcularScores(sysData, respostas);
    setScores(calculado);
    setStep('result');
  };

  const handleConfirm = (instrumento: string) => {
    onSelectInstrumento(instrumento, false);
    onOpenChange(false);
  };

  const questions = [
    {
      id: 'experienciaPrevia',
      label: 'Experiência prévia',
      pergunta: 'Sua empresa já realizou avaliação psicossocial antes?',
      icon: <Clock className="h-5 w-5 text-purple-600" />,
      opcoes: [
        { value: 'nunca', label: 'Nunca realizou', desc: 'Primeira avaliação' },
        { value: 'uma_vez', label: 'Já realizou uma vez', desc: 'Experiência inicial' },
        { value: 'periodicamente', label: 'Realiza periodicamente', desc: 'Processo maduro' },
      ],
    },
    {
      id: 'objetivo',
      label: 'Objetivo',
      pergunta: 'Qual o principal objetivo desta avaliação?',
      icon: <Search className="h-5 w-5 text-blue-600" />,
      opcoes: [
        { value: 'diagnostico', label: 'Diagnóstico inicial', desc: 'Mapear o cenário atual' },
        { value: 'gestao_lideranca', label: 'Gestão e liderança', desc: 'Melhorar gestão de pessoas' },
        { value: 'investigar_afastamentos', label: 'Investigar afastamentos', desc: 'Entender aumento de afastamentos' },
        { value: 'auditoria', label: 'Auditoria / fiscalização', desc: 'Atender exigência legal' },
        { value: 'pgr', label: 'PGR / NR-01', desc: 'Avaliação periódica do PGR' },
      ],
    },
    {
      id: 'sinaisRisco',
      label: 'Sinais de risco',
      pergunta: 'Nos últimos 12 meses, quantos sinais de risco você identificou?',
      icon: <AlertTriangle className="h-5 w-5 text-amber-600" />,
      opcoes: [
        { value: 'nenhum', label: 'Nenhum sinal', desc: 'Ambiente aparentemente estável' },
        { value: 'alguns', label: 'Alguns sinais', desc: 'Indícios pontuais' },
        { value: 'varios', label: 'Vários sinais', desc: 'Afastamentos, conflitos, denúncias, turnover' },
      ],
    },
    {
      id: 'tipoPredominante',
      label: 'Tipo de trabalho',
      pergunta: 'Qual o tipo predominante de trabalho na empresa?',
      icon: <Building2 className="h-5 w-5 text-emerald-600" />,
      opcoes: [
        { value: 'administrativo', label: 'Administrativo', desc: 'Escritório, backoffice' },
        { value: 'industrial', label: 'Industrial', desc: 'Produção, manufatura' },
        { value: 'saude', label: 'Saúde', desc: 'Hospitalar, clínicas' },
        { value: 'logistica', label: 'Logística', desc: 'Transporte, armazém' },
        { value: 'comercial', label: 'Comercial', desc: 'Varejo, vendas' },
        { value: 'servicos', label: 'Serviços', desc: 'TI, consultoria, outros' },
      ],
    },
  ];

  const currentQ = questions[currentQuestion];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* ── CHOICE ── */}
        <AnimatePresence mode="wait">
          {step === 'choice' && (
            <motion.div key="choice" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <DialogHeader className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2.5 rounded-xl bg-purple-100">
                    <Sparkles className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl">Nova Campanha Psicossocial</DialogTitle>
                    <DialogDescription>Como deseja escolher o instrumento de avaliação?</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Assistente Inteligente */}
                <button
                  onClick={loadSystemData}
                  className="group text-left p-5 rounded-xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-background hover:border-purple-400 hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-purple-100 group-hover:bg-purple-200 transition-colors">
                      <Sparkles className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Assistente Inteligente</p>
                      <Badge className="bg-purple-600 text-xs mt-0.5">Recomendado</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    O sistema analisa dados da sua empresa e faz perguntas guiadas para recomendar o instrumento mais adequado.
                  </p>
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-purple-600 font-medium">
                    <Zap className="h-3.5 w-3.5" />
                    Leva menos de 2 minutos
                  </div>
                </button>

                {/* Escolha manual */}
                <button
                  onClick={() => { onSelectInstrumento('sipro', true); onOpenChange(false); }}
                  className="group text-left p-5 rounded-xl border-2 border-border hover:border-foreground/30 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-muted group-hover:bg-muted/80 transition-colors">
                      <Brain className="h-5 w-5 text-foreground/60" />
                    </div>
                    <p className="font-semibold text-sm">Escolher manualmente</p>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Você já sabe qual instrumento usar e prefere configurar a campanha diretamente.
                  </p>
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                    <FileText className="h-3.5 w-3.5" />
                    Acesso direto ao formulário
                  </div>
                </button>
              </div>

              {/* Normas */}
              <div className="mt-5 flex flex-wrap gap-2">
                {['NR-01', 'NR-17', 'ISO 45001', 'ISO 45003'].map(n => (
                  <Badge key={n} variant="outline" className="text-xs text-muted-foreground">{n}</Badge>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── LOADING ── */}
          {step === 'auto-loading' && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin" />
                <Brain className="absolute inset-0 m-auto h-6 w-6 text-purple-600" />
              </div>
              <div className="text-center">
                <p className="font-semibold">Analisando dados da empresa</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Lendo colaboradores, escalas, afastamentos e histórico...
                </p>
              </div>
            </motion.div>
          )}

          {/* ── CHECKLIST ── */}
          {step === 'checklist' && sysData && (
            <motion.div key="checklist" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <DialogHeader className="mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  <DialogTitle>Assistente de Seleção</DialogTitle>
                </div>
                <DialogDescription>
                  Pergunta {currentQuestion + 1} de {questions.length}
                </DialogDescription>
              </DialogHeader>

              {/* Progress bar */}
              <div className="w-full bg-muted rounded-full h-1.5 mb-5">
                <motion.div
                  className="bg-purple-600 h-1.5 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Dados automáticos detectados */}
              {currentQuestion === 0 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="mb-5 p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" />
                    Dados detectados automaticamente
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 text-xs text-blue-800">
                    <span>👥 {sysData.totalColaboradores} colaboradores</span>
                    <span>📋 {sysData.totalCampanhasAnteriores} campanhas anteriores</span>
                    {sysData.temTurnoNoturno && <span>🌙 Turno noturno detectado</span>}
                    {sysData.temTurnoRevezamento && <span>🔄 Revezamento detectado</span>}
                    {sysData.totalAfastamentosSaudeMental > 0 && (
                      <span>⚠️ {sysData.totalAfastamentosSaudeMental} afastamentos saúde mental</span>
                    )}
                    <span>🏷️ Grau de risco {sysData.grauRisco}</span>
                  </div>
                </motion.div>
              )}

              {/* Pergunta atual */}
              <AnimatePresence mode="wait">
                <motion.div key={currentQuestion}
                  initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }}>
                  <div className="flex items-center gap-2 mb-4">
                    {currentQ.icon}
                    <h3 className="font-semibold text-base">{currentQ.pergunta}</h3>
                  </div>

                  {currentQ.id === 'complexidade' ? (
                    /* Multi-select */
                    <div className="grid gap-2 sm:grid-cols-2">
                      {[
                        { value: 'multi_departamentos', label: 'Mais de 3 departamentos' },
                        { value: 'multi_unidades', label: 'Múltiplas unidades' },
                        { value: 'turnos', label: 'Turnos de trabalho' },
                        { value: 'turno_noturno', label: 'Trabalho noturno' },
                        { value: 'alta_pressao', label: 'Alta pressão / metas' },
                      ].map(op => {
                        const sel = respostas.complexidade.includes(op.value);
                        return (
                          <button key={op.value}
                            onClick={() => setRespostas(r => ({
                              ...r,
                              complexidade: sel
                                ? r.complexidade.filter(v => v !== op.value)
                                : [...r.complexidade, op.value],
                            }))}
                            className={cn(
                              "p-3 rounded-lg border text-left text-sm transition-all",
                              sel ? "border-purple-400 bg-purple-50 font-medium text-purple-800" : "border-border hover:border-purple-200"
                            )}>
                            <span>{sel ? '✓ ' : ''}{op.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    /* Single-select */
                    <div className="grid gap-2 sm:grid-cols-2">
                      {currentQ.opcoes?.map(op => {
                        const sel = (respostas as any)[currentQ.id] === op.value;
                        return (
                          <button key={op.value}
                            onClick={() => setRespostas(r => ({ ...r, [currentQ.id]: op.value }))}
                            className={cn(
                              "p-3 rounded-lg border text-left transition-all",
                              sel ? "border-purple-400 bg-purple-50" : "border-border hover:border-purple-200"
                            )}>
                            <p className={cn("font-medium text-sm", sel && "text-purple-800")}>{op.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{op.desc}</p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Navigation */}
              <div className="flex items-center justify-between mt-6">
                <Button variant="ghost" size="sm"
                  onClick={() => currentQuestion > 0 ? setCurrentQuestion(q => q - 1) : setStep('choice')}
                  className="gap-1.5">
                  <ArrowLeft className="h-4 w-4" /> Voltar
                </Button>
                {currentQuestion < questions.length - 1 ? (
                  <Button size="sm" onClick={() => setCurrentQuestion(q => q + 1)} className="gap-1.5">
                    Próximo <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button size="sm" onClick={handleCalcular}
                    disabled={!isChecklistComplete}
                    className="gap-1.5 bg-purple-600 hover:bg-purple-700">
                    <Sparkles className="h-4 w-4" /> Ver Recomendação
                  </Button>
                )}
              </div>
            </motion.div>
          )}

          {/* ── RESULT ── */}
          {step === 'result' && scores.length > 0 && (
            <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <DialogHeader className="mb-5">
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-purple-600" />
                  <DialogTitle>Recomendação do Assistente</DialogTitle>
                </div>
                <DialogDescription>
                  Baseada na análise organizacional realizada pelo Assistente Seguramente
                </DialogDescription>
              </DialogHeader>

              {/* Principal */}
              <div className={cn("rounded-xl border-2 p-5 mb-4", scores[0].bgCor)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{scores[0].icone}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className={cn("font-bold text-lg", scores[0].cor)}>{scores[0].nome}</h3>
                        <Badge className="bg-purple-600 text-xs">Mais indicado</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{scores[0].descricao}</p>
                    </div>
                  </div>
                  <div className={cn("text-2xl font-bold", scores[0].cor)}>{scores[0].score}%</div>
                </div>

                <div className="mb-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">Motivos da recomendação:</p>
                  <ul className="space-y-1">
                    {scores[0].motivos.map((m, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Normas */}
                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-black/10">
                  {['NR-01', 'NR-17', 'ISO 45003'].map(n => (
                    <Badge key={n} variant="outline" className="text-xs">{n}</Badge>
                  ))}
                  <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300">
                    <Shield className="h-3 w-3 mr-1" />Recomendação baseada em evidências
                  </Badge>
                </div>
              </div>

              {/* Alternativas */}
              {scores.slice(1).map(s => (
                <div key={s.id} className={cn("rounded-lg border p-3.5 mb-2 opacity-80 hover:opacity-100 transition-opacity", s.bgCor)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>{s.icone}</span>
                      <div>
                        <p className={cn("font-semibold text-sm", s.cor)}>{s.nome}</p>
                        {s.motivos[0] && <p className="text-xs text-muted-foreground">{s.motivos[0]}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm font-bold", s.cor)}>{s.score}%</span>
                      <Button variant="outline" size="sm" className="text-xs h-7"
                        onClick={() => handleConfirm(s.id)}>
                        Usar este
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <Button className="flex-1 bg-purple-600 hover:bg-purple-700 gap-2"
                  onClick={() => handleConfirm(scores[0].id)}>
                  <CheckCircle2 className="h-4 w-4" />
                  Usar {scores[0].nome}
                </Button>
                <Button variant="outline" size="sm"
                  onClick={() => { onSelectInstrumento('sipro', true); onOpenChange(false); }}
                  className="gap-1.5 text-xs">
                  <Brain className="h-3.5 w-3.5" /> Escolher outro
                </Button>
              </div>

              <p className="text-center text-xs text-muted-foreground mt-3">
                A decisão e o motivo da recomendação serão registrados para fins de auditoria.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
