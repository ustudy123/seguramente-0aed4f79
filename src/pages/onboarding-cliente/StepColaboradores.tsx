import { useState, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { parseSpreadsheet, importCollaborators, type ImportResult } from "@/utils/onboardingImport";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, ChevronRight, Users, LayoutGrid,
  Upload, ArrowRight, Sparkles, Loader2,
  Briefcase, Download
} from "lucide-react";
import type { Cliente } from "./types";

export function StepColaboradores({ cliente, onConcluir, onBack }: { cliente: Cliente; onConcluir: () => void; onBack?: () => void }) {
  const [modo, setModo] = useState<'escolha' | 'importar' | 'manual' | 'integracao' | 'done' | 'importing' | 'result'>('escolha');
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
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Sessão expirada"); return; }
      const { data: profileData } = await supabase.from('profiles').select('tenant_id').eq('user_id', user.id).maybeSingle();
      if (!profileData?.tenant_id) { toast.error("Tenant não identificado"); return; }
      
      setModo('importing');
      toast.info("Processando planilha...");
      const rows = await parseSpreadsheet(file);
      
      if (rows.length === 0) {
        toast.error("Nenhum colaborador encontrado na planilha. Verifique se as colunas 'Nome Completo' e 'CPF' estão preenchidas.");
        setModo('importar');
        return;
      }

      const result = await importCollaborators(rows, profileData.tenant_id);
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
  }, []);

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
          <p className="text-sm text-muted-foreground">
            Foram aceitos <span className="font-bold text-foreground">{importResult.colaboradores_criados}</span> colaboradores de <span className="font-bold text-foreground">{importResult.total}</span> registros na planilha.
          </p>
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
        <button onClick={() => setModo('escolha')} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          ← Voltar
        </button>
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
          className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all ${
            dragOver ? 'border-primary bg-primary/5' : 'border-muted/60'
          }`}
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
      {onBack && (
        <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">← Voltar</button>
      )}
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
