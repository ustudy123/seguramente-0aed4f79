import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Download, Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Loader2, PartyPopper } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { buscarCnpj } from '@/lib/brasilapi';
import { formatCnpj, validateCnpj, cleanCnpj } from '@/lib/cnpj';

const TEMPLATE_COLUMNS = [
  'Razão Social*',
  'Nome Fantasia',
  'CNPJ*',
  'Tipo de Unidade (Matriz/Filial)',
  'Inscrição Estadual',
  'Telefone',
  'E-mail',
  'CEP',
  'Endereço',
  'Número',
  'Bairro',
  'Cidade',
  'Estado',
  'CNAE Principal',
  'Descrição CNAE',
  'Grau de Risco (1-4)',
  'Total Colaboradores',
  'Jornada Padrão',
];

const EXAMPLE_ROW = [
  'Empresa Exemplo Ltda (EXEMPLO - PODE APAGAR)',
  'Exemplo',
  '00.000.000/0000-00',
  'Matriz',
  '123456789',
  '(11) 99999-9999',
  'exemplo@empresa.com',
  '01234-567',
  'Rua Exemplo',
  '123',
  'Centro',
  'São Paulo',
  'SP',
  '4120-4/00',
  'Construção de edifícios',
  '3',
  '10',
  '44h semanais',
];

const TEMPLATE_INSTRUCTIONS = [
  ['Campo', 'Obrigatório', 'Formato', 'Exemplo'],
  ['Razão Social*', 'Sim', 'Texto', 'Empresa ABC Ltda'],
  ['Nome Fantasia', 'Não', 'Texto', 'ABC'],
  ['CNPJ*', 'Sim', '00.000.000/0000-00', '12.345.678/0001-90'],
  ['Tipo de Unidade (Matriz/Filial)', 'Não', 'Matriz ou Filial', 'Matriz'],
  ['Inscrição Estadual', 'Não', 'Texto', '123456789'],
  ['Telefone', 'Não', '(00) 0000-0000', '(11) 3000-0000'],
  ['E-mail', 'Não', 'E-mail válido', 'contato@empresa.com'],
  ['CEP', 'Não', '00000-000', '01310-100'],
  ['Endereço', 'Não', 'Texto', 'Av. Paulista'],
  ['Número', 'Não', 'Texto', '1000'],
  ['Bairro', 'Não', 'Texto', 'Bela Vista'],
  ['Cidade', 'Não', 'Texto', 'São Paulo'],
  ['Estado', 'Não', 'UF (2 letras)', 'SP'],
  ['CNAE Principal', 'Não', 'Código CNAE', '4120-4/00'],
  ['Descrição CNAE', 'Não', 'Texto', 'Construção de edifícios'],
  ['Grau de Risco (1-4)', 'Não', '1, 2, 3 ou 4', '3'],
  ['Total Colaboradores', 'Não', 'Número inteiro', '150'],
  ['Jornada Padrão', 'Não', 'Texto', '44h semanais'],
];

export function EmpresaImportExport() {
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: string[]; duplicadas: string[] } | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number; etapa: string; empresaAtual?: string }>({ current: 0, total: 0, etapa: '' });
  const [showCompletion, setShowCompletion] = useState(false);
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    // Pre-aloca 500 linhas para que a coluna C fique pré-formatada como texto
    // mesmo nas células ainda vazias. Sem isso, ao digitar um CNPJ longo
    // (ex.: 09766240000125), o Excel converte para notação científica
    // (9,76624E+12) porque o formato da célula vazia ainda é "Geral".
    const PRE_ALLOC_ROWS = 500;
    const wsData = XLSX.utils.aoa_to_sheet([TEMPLATE_COLUMNS, EXAMPLE_ROW]);

    // Marca TODAS as células da coluna C (preenchidas + vazias) como texto.
    for (let R = 0; R <= PRE_ALLOC_ROWS; R++) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: 2 }); // coluna C
      const existing = wsData[cellAddress];
      if (existing) {
        existing.t = 's';
        existing.z = '@';
        if (existing.v != null) existing.v = String(existing.v);
      } else {
        // Cria célula vazia já formatada como texto.
        // Sem o campo `v`, o Excel descarta a célula ao salvar,
        // então usamos string vazia para preservar a formatação.
        wsData[cellAddress] = { t: 's', v: '', z: '@' };
      }
    }

    // Atualiza o range da planilha para incluir as linhas pré-alocadas.
    wsData['!ref'] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: PRE_ALLOC_ROWS, c: TEMPLATE_COLUMNS.length - 1 },
    });

    // Define a coluna C com formato texto e largura adequada.
    wsData['!cols'] = wsData['!cols'] || [];
    wsData['!cols'][2] = { wch: 22 };

    XLSX.utils.book_append_sheet(wb, wsData, 'Dados');

    // Instruções sheet
    const wsInstr = XLSX.utils.aoa_to_sheet(TEMPLATE_INSTRUCTIONS);
    XLSX.utils.book_append_sheet(wb, wsInstr, 'Instruções');

    XLSX.writeFile(wb, 'modelo_cadastro_empresas.xlsx');
    toast.success('Modelo baixado com sucesso!');
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);
    setShowCompletion(false);
    setProgress({ current: 0, total: 0, etapa: 'Lendo arquivo...' });
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws);

      if (data.length === 0) {
        toast.error('Planilha vazia');
        return;
      }

      if (!tenantId) {
        toast.error('Tenant não identificado. Recarregue a página.');
        return;
      }

      const errors: string[] = [];
      const duplicadas: string[] = [];
      let success = 0;

      setProgress({ current: 0, total: data.length, etapa: 'Verificando duplicidades...' });

      // Busca CNPJs já existentes no tenant para validar duplicidade
      const { data: existentes } = await supabase
        .from('empresa_cadastro')
        .select('id, cnpj, razao_social')
        .eq('tenant_id', tenantId);

      const mapaExistentes = new Map<string, { id: string; razao_social: string }>();
      (existentes || []).forEach((e: any) => {
        const c = (e.cnpj || '').replace(/\D/g, '');
        if (c.length === 14) mapaExistentes.set(c, { id: e.id, razao_social: e.razao_social });
      });
      const cnpjsExistentes = new Set(mapaExistentes.keys());

      // Pendências a registrar (duplicados detectados)
      const pendenciasParaRegistrar: any[] = [];

      // Set para rastrear CNPJs duplicados dentro da própria planilha
      const cnpjsNaPlanilha = new Set<string>();

      for (let i = 0; i < data.length; i++) {
        const row = data[i];

        // Pega os valores considerando que podem ou não ter o asterisco
        const rawRazaoSocial = row['Razão Social*'] || row['Razão Social'];
        const rawCnpj = row['CNPJ*'] || row['CNPJ'];

        setProgress({
          current: i + 1,
          total: data.length,
          etapa: `Processando ${i + 1} de ${data.length}`,
          empresaAtual: rawRazaoSocial?.toString().trim() || rawCnpj?.toString().trim() || `Linha ${i + 2}`,
        });

        // Pula a linha de exemplo se ela estiver presente
        if (rawRazaoSocial?.toString().includes('(EXEMPLO')) {
          continue;
        }

        // Pula linhas totalmente vazias (acontece quando o template
        // pré-aloca células de texto vazias na coluna C — o XLSX devolve
        // essas linhas como objetos sem dados úteis).
        const isRowEmpty = Object.values(row).every((v) => {
          if (v === null || v === undefined) return true;
          return v.toString().trim() === '';
        });
        if (isRowEmpty) {
          continue;
        }

        const razaoSocialInput = rawRazaoSocial?.toString().trim();
        const cnpjInput = rawCnpj?.toString().trim();

        if (!cnpjInput) {
          errors.push(`Linha ${i + 2}: CNPJ é obrigatório`);
          continue;
        }

        const cnpjLimpo = cleanCnpj(cnpjInput);
        if (!validateCnpj(cnpjLimpo)) {
          errors.push(`Linha ${i + 2}: CNPJ inválido (${cnpjInput})`);
          continue;
        }

        const cnpjFormatado = formatCnpj(cnpjLimpo);

        // Valida duplicidade: já existe no banco
        if (cnpjsExistentes.has(cnpjLimpo)) {
          const existente = mapaExistentes.get(cnpjLimpo);
          duplicadas.push(`Linha ${i + 2}: CNPJ ${cnpjFormatado} já cadastrado no sistema`);
          pendenciasParaRegistrar.push({
            tenant_id: tenantId,
            cnpj: cnpjFormatado,
            razao_social_planilha: razaoSocialInput || null,
            razao_social_existente: existente?.razao_social || null,
            empresa_existente_id: existente?.id || null,
            linha_planilha: i + 2,
            arquivo_nome: file.name,
            motivo: 'cnpj_duplicado',
            status: 'pendente',
            importado_por: user?.id || null,
            importado_por_nome: user?.email || null,
          });
          continue;
        }
        // Valida duplicidade: aparece duas vezes na mesma planilha
        if (cnpjsNaPlanilha.has(cnpjLimpo)) {
          duplicadas.push(`Linha ${i + 2}: CNPJ ${cnpjFormatado} duplicado na planilha`);
          pendenciasParaRegistrar.push({
            tenant_id: tenantId,
            cnpj: cnpjFormatado,
            razao_social_planilha: razaoSocialInput || null,
            razao_social_existente: null,
            empresa_existente_id: null,
            linha_planilha: i + 2,
            arquivo_nome: file.name,
            motivo: 'cnpj_repetido_planilha',
            status: 'pendente',
            importado_por: user?.id || null,
            importado_por_nome: user?.email || null,
          });
          continue;
        }
        cnpjsNaPlanilha.add(cnpjLimpo);

        // Tenta buscar informações extras do CNPJ para enriquecer ou preencher vazios
        let infoApi = null;
        try {
          // Busca apenas se faltar informações básicas ou para validar
          infoApi = await buscarCnpj(cnpjLimpo);
        } catch (e) {
          console.error(`Erro ao buscar CNPJ ${cnpjLimpo}:`, e);
        }

        const razaoSocial = razaoSocialInput || infoApi?.razao_social || 'Empresa sem Razão Social';
        const nomeFantasia = row['Nome Fantasia']?.toString().trim() || infoApi?.nome_fantasia || null;
        
        const grauRiscoRaw = row['Grau de Risco (1-4)']?.toString().trim();
        const grauRisco = grauRiscoRaw ? parseInt(grauRiscoRaw, 10) : null;
        const totalColabRaw = row['Total Colaboradores']?.toString().trim();
        const totalColab = totalColabRaw ? parseInt(totalColabRaw, 10) : null;

        // Determina tipo de unidade: padrão 'filial' se não informado
        const tipoUnidadeRaw = row['Tipo de Unidade (Matriz/Filial)']?.toString().trim().toLowerCase();
        const tipoUnidade: 'matriz' | 'filial' = tipoUnidadeRaw === 'matriz' ? 'matriz' : 'filial';

        const payload: Record<string, unknown> = {
          tenant_id: tenantId,
          tipo_pessoa: 'pj',
          razao_social: razaoSocial,
          nome_fantasia: nomeFantasia,
          cnpj: cnpjFormatado,
          tipo_unidade: tipoUnidade,
          inscricao_estadual: row['Inscrição Estadual']?.toString().trim() || null,
          telefone: row['Telefone']?.toString().trim() || infoApi?.telefone || null,
          // Respeita a planilha: se o e-mail foi removido propositalmente, não enriquecer via BrasilAPI
          email: row['E-mail']?.toString().trim() || null,
          cep: row['CEP']?.toString().trim().replace(/\D/g, '') || infoApi?.cep || null,
          endereco: row['Endereço']?.toString().trim() || infoApi?.logradouro || null,
          numero: row['Número']?.toString().trim() || infoApi?.numero || null,
          bairro: row['Bairro']?.toString().trim() || infoApi?.bairro || null,
          cidade: row['Cidade']?.toString().trim() || infoApi?.municipio || null,
          estado: row['Estado']?.toString().trim().toUpperCase() || infoApi?.uf || null,
          cnae_principal: row['CNAE Principal']?.toString().trim() || (infoApi?.cnae_fiscal ? String(infoApi.cnae_fiscal) : null),
          cnae_descricao: row['Descrição CNAE']?.toString().trim() || infoApi?.cnae_fiscal_descricao || null,
          grau_risco: grauRisco && !isNaN(grauRisco) ? grauRisco : null,
          total_colaboradores: totalColab && !isNaN(totalColab) ? totalColab : null,
          jornada_padrao: row['Jornada Padrão']?.toString().trim() || null,
          atualizado_por: user?.email || null,
        };

        const { error } = await supabase
          .from('empresa_cadastro')
          .insert(payload as any);

        if (error) {
          errors.push(`Linha ${i + 2} (${razaoSocial}): ${error.message}`);
          continue;
        }

        success++;
      }

      // Persiste pendências de duplicidade (para aparecerem no dashboard de pendências)
      if (pendenciasParaRegistrar.length > 0) {
        const { error: pendErr } = await (supabase as any)
          .from('empresa_import_pendencias')
          .insert(pendenciasParaRegistrar);
        if (pendErr) console.error('Erro ao registrar pendências de importação:', pendErr);
        else queryClient.invalidateQueries({ queryKey: ['pendencias-dashboard'] });
      }

      setProgress({ current: data.length, total: data.length, etapa: 'Concluído' });
      setImportResult({ success, errors, duplicadas });
      setShowCompletion(true);

      if (success > 0) {
        toast.success(`${success} empresa(s) importada(s) com sucesso!`);
        queryClient.invalidateQueries({ queryKey: ['empresa_cadastro_list'] });
        queryClient.invalidateQueries({ queryKey: ['empresa_cadastro_list_ativa'] });
      }
      if (duplicadas.length > 0) {
        toast.warning(`${duplicadas.length} empresa(s) ignorada(s) por já existirem (CNPJ duplicado)`, {
          duration: 6000,
        });
      }
      if (errors.length > 0) {
        toast.warning(`${errors.length} erro(s) encontrado(s)`);
      }
      if (success === 0 && errors.length === 0 && duplicadas.length === 0) {
        toast.info('Nenhuma linha válida encontrada na planilha.');
      }
    } catch (err) {
      console.error('Erro na importação:', err);
      toast.error('Erro ao ler o arquivo');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  }, [tenantId, user?.email, queryClient]);

  return (
    <div className="space-y-6">
      {/* Download Template */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-accent/50">
              <FileSpreadsheet className="w-8 h-8 text-accent-foreground" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium">Modelo de Importação</h4>
              <p className="text-sm text-muted-foreground">
                Baixe o arquivo Excel com o formato correto para importação
              </p>
            </div>
            <Button onClick={handleDownloadTemplate} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Baixar Modelo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Upload */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium">Importar Empresas</h4>
              <p className="text-sm text-muted-foreground">
                Selecione um arquivo Excel (.xlsx) ou CSV com os dados das empresas
              </p>
            </div>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileUpload}
                disabled={importing}
              />
              <Button asChild variant="default" disabled={importing}>
                <span>
                  {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  {importing ? 'Processando...' : 'Selecionar Arquivo'}
                </span>
              </Button>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Progresso da importação */}
      {importing && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
              <div className="flex-1">
                <h4 className="font-medium text-sm">{progress.etapa || 'Processando...'}</h4>
                {progress.empresaAtual && (
                  <p className="text-xs text-muted-foreground truncate">
                    {progress.empresaAtual}
                  </p>
                )}
              </div>
              <span className="text-sm font-semibold tabular-nums">
                {progress.total > 0 ? `${progress.current}/${progress.total}` : '...'}
              </span>
            </div>
            <Progress
              value={progress.total > 0 ? (progress.current / progress.total) * 100 : 5}
            />
            <p className="text-xs text-muted-foreground">
              Não feche esta janela enquanto a importação estiver em andamento.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Banner de conclusão */}
      {showCompletion && importResult && !importing && (
        <Card className="border-emerald-500/40 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/10 animate-in fade-in slide-in-from-top-2">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-emerald-500/15">
                <PartyPopper className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1 space-y-1">
                <h4 className="font-semibold text-lg text-emerald-900 dark:text-emerald-100">
                  {importResult.success > 0
                    ? 'Importação concluída com sucesso!'
                    : 'Importação finalizada'}
                </h4>
                <p className="text-sm text-emerald-800/80 dark:text-emerald-200/80">
                  {importResult.success > 0 && (
                    <>
                      <strong>{importResult.success}</strong> empresa(s) cadastrada(s).{' '}
                    </>
                  )}
                  {importResult.duplicadas.length > 0 && (
                    <>{importResult.duplicadas.length} ignorada(s) por duplicidade. </>
                  )}
                  {importResult.errors.length > 0 && (
                    <>{importResult.errors.length} com erro(s) — veja detalhes abaixo.</>
                  )}
                  {importResult.success === 0 && importResult.duplicadas.length === 0 && importResult.errors.length === 0 && (
                    <>Nenhuma linha válida foi encontrada na planilha.</>
                  )}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowCompletion(false)}>
                Fechar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Results */}
      {importResult && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-1">
              <h4 className="font-medium text-lg">Resultado da Importação</h4>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {importResult.success} empresa(s) aceita(s)
                </span>
                {" "}com sucesso.
                {(importResult.duplicadas.length > 0 || importResult.errors.length > 0) && (
                  <>
                    {" "}Foram ignoradas/rejeitadas{" "}
                    <span className="font-medium text-warning">
                      {importResult.duplicadas.length + importResult.errors.length}
                    </span>
                    {" "}linhas.
                  </>
                )}
              </p>
            </div>
            
            <div className="space-y-3 pt-2 border-t">
            
            {importResult.success > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-accent-foreground" />
                <span>{importResult.success} empresa(s) válida(s)</span>
              </div>
            )}

            {importResult.duplicadas.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-warning">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{importResult.duplicadas.length} empresa(s) ignorada(s) (já cadastradas):</span>
                </div>
                <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
                  {importResult.duplicadas.map((d, i) => (
                    <li key={i} className="text-warning">{d}</li>
                  ))}
                </ul>
              </div>
            )}

            {importResult.errors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{importResult.errors.length} erro(s):</span>
                </div>
                <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
                  {importResult.errors.map((err, i) => (
                    <li key={i} className="text-destructive">{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
        </Card>
      )}
    </div>
  );
}
