import { useState, useCallback, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { parseSpreadsheet, importCollaborators, type ImportResult } from "@/utils/onboardingImport";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2, ChevronRight, Building2, Users, LayoutGrid,
  Upload, ArrowRight, Sparkles, Loader2, CheckCheck,
  BarChart3, Briefcase, Shield, Rocket, Clock, Download
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

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

function gerarPrioridades(indice: number): { ordem: number; texto: string }[] {
  if (indice <= 25) return [
    { ordem: 1, texto: 'Cadastro de funções' },
    { ordem: 2, texto: 'Organização de departamentos' },
    { ordem: 3, texto: 'Cadastro de colaboradores' },
    { ordem: 4, texto: 'Estrutura organizacional' },
  ];
  if (indice <= 50) return [
    { ordem: 1, texto: 'Organograma organizacional' },
    { ordem: 2, texto: 'Responsáveis por setor' },
    { ordem: 3, texto: 'Indicadores de gestão' },
  ];
  return [
    { ordem: 1, texto: 'Diagnóstico psicossocial organizacional' },
    { ordem: 2, texto: 'Indicadores organizacionais' },
    { ordem: 3, texto: 'Monitoramento contínuo' },
  ];
}

// ─── Step: Estrutura Organizacional ──────────────────────────────────────────

function StepColaboradores({ onConcluir, onBack }: { onConcluir: () => void; onBack?: () => void }) {
  const { profile } = useAuthContext();
  const [modo, setModo] = useState<'escolha' | 'importar' | 'manual' | 'done' | 'importing' | 'result'>('escolha');
  const [dragOver, setDragOver] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = useCallback(() => {
    const headers = ['Nome Completo', 'CPF', 'E-mail', 'Telefone', 'Data Nascimento', 'Cargo/Função', 'Departamento', 'Data Admissão', 'Salário', 'Centro de Custo', 'Gestor Imediato'];
    const exemplo = ['Maria Silva', '123.456.789-00', 'maria@empresa.com', '(11) 99999-0000', '15/03/1990', 'Analista de RH', 'Recursos Humanos', '01/02/2024', '5000', 'RH-001', 'João Santos'];
    const ws = XLSX.utils.aoa_to_sheet([headers, exemplo]);
    ws['!cols'] = headers.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Colaboradores');
    const wsInstrucoes = XLSX.utils.aoa_to_sheet([
      ['INSTRUÇÕES DE PREENCHIMENTO'], [''],
      ['Campo', 'Obrigatório', 'Formato', 'Exemplo'],
      ['Nome Completo', 'Sim', 'Texto', 'Maria Silva'],
      ['CPF', 'Sim', '000.000.000-00', '123.456.789-00'],
      ['E-mail', 'Não', 'email@dominio.com', 'maria@empresa.com'],
      ['Telefone', 'Não', '(00) 00000-0000', '(11) 99999-0000'],
      ['Data Nascimento', 'Não', 'DD/MM/AAAA', '15/03/1990'],
      ['Cargo/Função', 'Sim', 'Texto', 'Analista de RH'],
      ['Departamento', 'Sim', 'Texto', 'Recursos Humanos'],
      ['Data Admissão', 'Não', 'DD/MM/AAAA', '01/02/2024'],
      ['Salário', 'Não', 'Número', '5000'],
      ['Centro de Custo', 'Não', 'Texto', 'RH-001'],
      ['Gestor Imediato', 'Não', 'Texto', 'João Santos'],
    ]);
    wsInstrucoes['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 22 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, wsInstrucoes, 'Instruções');
    XLSX.writeFile(wb, 'modelo_colaboradores.xlsx');
    toast.success("Planilha modelo baixada!");
  }, []);

  const handleFileProcess = useCallback(async (file: File) => {
    const tenantId = (profile as any)?.tenant_id;
    if (!tenantId) {
      toast.error("Tenant não identificado. Faça login novamente.");
      return;
    }

    try {
      setModo('importing');
      toast.info("Processando planilha...");
      const rows = await parseSpreadsheet(file);
      
      if (rows.length === 0) {
        toast.error("Nenhum colaborador encontrado na planilha. Verifique se as colunas 'Nome Completo' e 'CPF' estão preenchidas.");
        setModo('importar');
        return;
      }

      const result = await importCollaborators(rows, tenantId);
      setImportResult(result);
      setModo('result');

      if (result.colaboradores_criados > 0) {
        toast.success(`${result.colaboradores_criados} colaborador(es) importado(s) com sucesso!`);
      }
      if (result.erros.length > 0) {
        toast.warning(`${result.erros.length} erro(s) durante a importação.`);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar planilha");
      setModo('importar');
    }
  }, [profile]);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileProcess(file);
  }, [handleFileProcess]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileProcess(file);
  }, [handleFileProcess]);

  if (modo === 'done' || (modo === 'result' && importResult && importResult.erros.length === 0)) {
    return (
      <div className="text-center py-8 space-y-3">
        <CheckCircle2 className="w-16 h-16 text-primary mx-auto" />
        <p className="text-lg font-semibold">Estrutura configurada!</p>
        {importResult && (
          <div className="text-sm text-muted-foreground space-y-1">
            <p>{importResult.colaboradores_criados} colaborador(es) cadastrado(s)</p>
            <p>{importResult.departamentos_criados} departamento(s) criado(s)</p>
            <p>{importResult.cargos_criados} cargo(s)/função(ões) criado(s)</p>
          </div>
        )}
        <p className="text-sm text-muted-foreground">O sistema está preparando os indicadores iniciais.</p>
        <Button onClick={onConcluir}>Continuar <ArrowRight className="w-4 h-4 ml-2" /></Button>
      </div>
    );
  }

  if (modo === 'result' && importResult) {
    return (
      <div className="space-y-4">
        <div className="text-center py-4 space-y-2">
          <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
          <p className="text-lg font-semibold">Importação concluída</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-primary/5 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-primary">{importResult.colaboradores_criados}</p>
            <p className="text-xs text-muted-foreground">Colaboradores</p>
          </div>
          <div className="bg-primary/5 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-primary">{importResult.departamentos_criados}</p>
            <p className="text-xs text-muted-foreground">Departamentos</p>
          </div>
          <div className="bg-primary/5 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-primary">{importResult.cargos_criados}</p>
            <p className="text-xs text-muted-foreground">Cargos</p>
          </div>
        </div>
        {importResult.erros.length > 0 && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 space-y-1">
            <p className="text-xs font-semibold text-destructive">Erros ({importResult.erros.length}):</p>
            {importResult.erros.slice(0, 5).map((err, i) => (
              <p key={i} className="text-xs text-destructive/80">• {err}</p>
            ))}
            {importResult.erros.length > 5 && (
              <p className="text-xs text-destructive/60">... e mais {importResult.erros.length - 5} erro(s)</p>
            )}
          </div>
        )}
        <Button onClick={onConcluir} className="w-full">
          Continuar <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    );
  }

  if (modo === 'importing') {
    return (
      <div className="text-center py-12 space-y-4">
        <Loader2 className="w-12 h-12 text-primary mx-auto animate-spin" />
        <p className="text-lg font-semibold">Importando colaboradores...</p>
        <p className="text-sm text-muted-foreground">Criando departamentos, cargos e cadastros. Aguarde...</p>
      </div>
    );
  }

  if (modo === 'importar') {
    return (
      <div className="space-y-4">
        <button onClick={() => setModo('escolha')} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">← Voltar</button>
        <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/10">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">Precisa de um modelo?</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="text-xs gap-1.5">
            <Download className="w-3 h-3" />
            Baixar planilha modelo
          </Button>
        </div>
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
          className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all ${dragOver ? 'border-primary bg-primary/5' : 'border-muted/60'}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            onChange={handleFileSelect}
          />
          <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium text-sm">Arraste a planilha aqui</p>
          <p className="text-xs text-muted-foreground mt-1">ou clique para selecionar o arquivo</p>
          <p className="text-xs text-muted-foreground mt-3 bg-muted/50 rounded p-2 inline-block">
            Campos esperados: <strong>Nome Completo, CPF, Cargo/Função, Departamento</strong>
          </p>
        </div>
      </div>
    );
  }

  if (modo === 'manual') {
    return (
      <div className="space-y-4">
        <button onClick={() => setModo('escolha')} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">← Voltar</button>
        <div className="bg-accent/30 border border-accent rounded-lg p-3 text-xs text-accent-foreground">
          <strong>Ordem obrigatória de cadastro:</strong> Para garantir a integridade dos dados, siga a sequência abaixo.
        </div>
        {[
          { icon: <Briefcase className="w-5 h-5" />, num: '1', title: 'Cadastro de Funções', desc: 'Crie as funções/cargos existentes na empresa', link: '/cadastros/cargos' },
          { icon: <LayoutGrid className="w-5 h-5" />, num: '2', title: 'Cadastro de Departamentos', desc: 'Crie os departamentos/setores', link: '/cadastros/departamentos' },
          { icon: <Users className="w-5 h-5" />, num: '3', title: 'Cadastro de Colaboradores', desc: 'Adicione os colaboradores com suas funções e departamentos', link: '/colaboradores' },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-muted/50 hover:border-primary/30 transition-all">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">{item.num}</div>
            <div className="flex-1">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <Button size="sm" variant="outline" className="text-xs shrink-0" onClick={() => window.open(item.link, '_self')}>
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
      {onBack && (
        <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">← Voltar</button>
      )}
      <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
        <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">Como deseja configurar a estrutura de colaboradores?</p>
      </div>
      {[
        { mode: 'importar' as const, icon: <Upload className="w-6 h-6" />, title: 'Importar planilha', desc: 'Recomendado. Reduza 80% do trabalho enviando uma planilha com seus colaboradores.', badge: 'Mais rápido' },
        { mode: 'manual' as const, icon: <Users className="w-6 h-6" />, title: 'Cadastrar manualmente', desc: 'Adicionar colaboradores um a um com orientação passo a passo.', badge: null },
      ].map(opt => (
        <button
          key={opt.mode}
          onClick={() => setModo(opt.mode)}
          className="w-full flex items-center gap-4 p-4 bg-background border border-border rounded-xl hover:border-primary/40 transition-all text-left group"
        >
          <div className="p-2.5 bg-muted rounded-lg text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-all">{opt.icon}</div>
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

function StepDiagnostico({ onConcluir }: { onConcluir: () => void }) {
  const [fase, setFase] = useState<'intro' | 'blocos' | 'resultado'>('intro');
  const [blocoAtual, setBlocoAtual] = useState(0);
  const [respostas, setRespostas] = useState<BlocoRespostas>({});

  const bloco = BLOCOS_DIAGNOSTICO[blocoAtual];
  const totalPerguntas = BLOCOS_DIAGNOSTICO.reduce((acc, b) => acc + b.perguntas.length, 0);
  const perguntasRespondidas = Object.keys(respostas).length;
  const progresso = Math.round((perguntasRespondidas / totalPerguntas) * 100);

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
    if (isUltimoBloco) setFase('resultado');
    else setBlocoAtual(b => b + 1);
  };

  if (fase === 'intro') {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-primary/5 border border-primary/15 rounded-xl space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold">Diagnóstico Inicial de Implantação</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Avaliação em 4 blocos para identificar o nível de maturidade organizacional e direcionar sua implantação.
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
        <Button onClick={() => setFase('blocos')} className="w-full">
          <Rocket className="w-4 h-4 mr-2" /> Iniciar Diagnóstico
        </Button>
        <Button variant="outline" onClick={onConcluir} className="w-full text-muted-foreground">Fazer isso depois</Button>
      </div>
    );
  }

  if (fase === 'blocos') {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Bloco {blocoAtual + 1} de {BLOCOS_DIAGNOSTICO.length}</span>
            <span>{progresso}% concluído</span>
          </div>
          <Progress value={progresso} className="h-1.5" />
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={blocoAtual} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-3">
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
                      <button onClick={() => handleResposta(pergunta.id, true)}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${resp === true ? 'bg-primary/15 border-primary text-primary' : 'border-border hover:border-primary/40 text-muted-foreground hover:text-foreground'}`}>
                        ✓ Sim
                      </button>
                      <button onClick={() => handleResposta(pergunta.id, false)}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${resp === false ? 'bg-destructive/10 border-destructive/50 text-destructive' : 'border-border hover:border-destructive/30 text-muted-foreground hover:text-foreground'}`}>
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
          {blocoAtual > 0 && <Button variant="outline" size="sm" onClick={() => setBlocoAtual(b => b - 1)} className="text-muted-foreground">← Voltar</Button>}
          <Button onClick={handleAvancar} disabled={!blocoCompleto} className="flex-1">
            {isUltimoBloco ? 'Ver Resultado' : 'Próximo Bloco'} <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  // Resultado
  return (
    <div className="space-y-4">
      <div className={`p-5 rounded-xl border text-center space-y-2 ${nivelIndice.bg}`}>
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Diagnóstico Concluído</p>
        <div className="flex items-center justify-center gap-2">
          <BarChart3 className={`w-6 h-6 ${nivelIndice.cor}`} />
          <p className={`text-xl font-black ${nivelIndice.cor}`}>{nivelIndice.label}</p>
        </div>
        <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold bg-background border ${nivelIndice.cor}`}>
          Índice de Maturidade: {indice}/100
        </div>
        <Progress value={indice} className="h-2 mt-1" />
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Resultados por Bloco</p>
        {resultadosBlocos.map(b => (
          <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background">
            <div className="flex items-center gap-2">
              <span className="text-sm">{b.icon}</span>
              <p className="text-xs font-medium">{b.titulo}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${b.positivas >= 3 ? 'bg-primary/10 text-primary' : b.positivas >= 2 ? 'bg-blue-500/10 text-blue-600' : b.positivas >= 1 ? 'bg-amber-500/10 text-amber-600' : 'bg-destructive/10 text-destructive'}`}>
                {b.classificacao}
              </span>
              <span className="text-xs text-muted-foreground">{b.positivas}/{b.perguntas.length}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-3">
        <p className="text-xs font-semibold">🗺️ Plano de Implantação Recomendado</p>
        <div className="space-y-1.5">
          {prioridades.map(p => (
            <div key={p.ordem} className="flex items-center gap-2 text-xs">
              <span className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">{p.ordem}</span>
              <span className="font-medium">{p.texto}</span>
            </div>
          ))}
        </div>
      </div>
      <Button onClick={onConcluir} className="w-full">
        <CheckCircle2 className="w-4 h-4 mr-2" /> Concluir Onboarding
      </Button>
      <Button variant="ghost" size="sm" onClick={() => { setFase('blocos'); setBlocoAtual(0); }} className="w-full text-muted-foreground">Refazer diagnóstico</Button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OnboardingProtegido() {
  const { profile, user, refetch } = useAuthContext();
  const navigate = useNavigate();
  const [stepAtivo, setStepAtivo] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [stepsCompletos, setStepsCompletos] = useState<Set<string>>(new Set());

  const profileData = profile as any;
  const nomeUsuario = profileData?.nome_completo?.split(' ')[0] || '';

  const marcarStepCompleto = (stepId: string) => {
    setStepsCompletos(prev => {
      const next = new Set(prev);
      next.add(stepId);
      return next;
    });
    setStepAtivo(null);
  };

  const handleConcluirOnboarding = async () => {
    if (!user) return;
    setSalvando(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ onboarding_concluido: true } as any)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Onboarding concluído! Bem-vindo ao Seguramente! 🎉');
      refetch();
      navigate('/');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao finalizar onboarding');
    } finally {
      setSalvando(false);
    }
  };

  // Auto-concluir quando ambos os passos forem finalizados
  const allSteps = ['colaboradores', 'diagnostico'];
  const todosCompletos = allSteps.every(s => stepsCompletos.has(s));

  useEffect(() => {
    if (todosCompletos && !salvando) {
      handleConcluirOnboarding();
    }
  }, [todosCompletos]);

  // Already completed
  if (profileData?.onboarding_concluido) {
    navigate('/');
    return null;
  }

  const steps = [
    { id: 'colaboradores', label: 'Estrutura Organizacional', sublabel: 'Departamentos, funções e colaboradores', icon: <Users className="w-5 h-5" /> },
    { id: 'diagnostico', label: 'Diagnóstico Inicial', sublabel: 'Avaliação de maturidade organizacional', icon: <BarChart3 className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/3">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Seguramente</p>
              <p className="text-xs text-muted-foreground">Configuração Inicial</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Boas-vindas */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-primary/8 via-primary/5 to-transparent border border-primary/15 rounded-2xl p-5">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-bold">
                Bem-vindo ao Seguramente{nomeUsuario ? `, ${nomeUsuario}` : ''}! 👋
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Vamos configurar sua empresa para que o sistema gere os primeiros indicadores. São poucos passos e leva apenas alguns minutos.
              </p>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CheckCheck className="w-4 h-4 text-primary" />
                  Passos do Onboarding
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {steps.map(step => (
                  <div
                    key={step.id}
                    onClick={() => setStepAtivo(step.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                      stepAtivo === step.id ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-transparent hover:border-muted-foreground/20'
                    }`}
                  >
                    <div className="shrink-0 text-muted-foreground">{step.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{step.label}</p>
                      <p className="text-xs text-muted-foreground">{step.sublabel}</p>
                    </div>
                  </div>
                ))}

                <div className="pt-3 border-t border-border">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleConcluirOnboarding}
                    disabled={salvando}
                  >
                    {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Concluir e acessar o sistema
                  </Button>
                  <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                    Você pode concluir os passos depois, se preferir.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main content */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <Rocket className="w-5 h-5 text-primary" />
                  Assistente de Configuração
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <AnimatePresence mode="wait">
                  {!stepAtivo && (
                    <motion.div key="welcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                      <div className="text-center py-8 space-y-3">
                        <Rocket className="w-12 h-12 text-primary mx-auto" />
                        <h2 className="text-lg font-bold">Selecione um passo</h2>
                        <p className="text-sm text-muted-foreground">Clique em um dos passos ao lado para começar a configuração.</p>
                      </div>
                    </motion.div>
                  )}

                  {stepAtivo === 'colaboradores' && (
                    <motion.div key="colaboradores" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <StepColaboradores onConcluir={() => setStepAtivo(null)} onBack={() => setStepAtivo(null)} />
                    </motion.div>
                  )}

                  {stepAtivo === 'diagnostico' && (
                    <motion.div key="diagnostico" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <button onClick={() => setStepAtivo(null)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">← Voltar</button>
                      <StepDiagnostico onConcluir={handleConcluirOnboarding} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
