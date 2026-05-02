import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, Upload, FileSpreadsheet, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';

const TEMPLATE_COLUMNS = [
  'Razão Social*',
  'Nome Fantasia',
  'CNPJ*',
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
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(null);
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    // Dados sheet
    const wsData = XLSX.utils.aoa_to_sheet([TEMPLATE_COLUMNS, EXAMPLE_ROW]);
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

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws);

      if (data.length === 0) {
        toast.error('Planilha vazia');
        return;
      }

      const errors: string[] = [];
      let success = 0;

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        
        // Pega os valores considerando que podem ou não ter o asterisco
        const rawRazaoSocial = row['Razão Social*'] || row['Razão Social'];
        const rawCnpj = row['CNPJ*'] || row['CNPJ'];

        // Pula a linha de exemplo se ela estiver presente
        if (rawRazaoSocial?.toString().includes('(EXEMPLO')) {
          continue;
        }

        const razaoSocial = rawRazaoSocial?.toString().trim();
        const cnpj = rawCnpj?.toString().trim();

        if (!razaoSocial) {
          errors.push(`Linha ${i + 2}: Razão Social é obrigatória`);
          continue;
        }
        if (!cnpj) {
          errors.push(`Linha ${i + 2}: CNPJ é obrigatório`);
          continue;
        }

        // For now, just count - actual import would create tenants
        success++;
      }

      setImportResult({ success, errors });

      if (success > 0) {
        toast.success(`${success} empresa(s) validada(s) com sucesso!`);
      }
      if (errors.length > 0) {
        toast.warning(`${errors.length} erro(s) encontrado(s)`);
      }

      toast.info(
        'Importação em modo de validação. Para criar as empresas, use o painel de Super Admin.'
      );
    } catch (err) {
      toast.error('Erro ao ler o arquivo');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  }, []);

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
                  <Upload className="w-4 h-4 mr-2" />
                  {importing ? 'Processando...' : 'Selecionar Arquivo'}
                </span>
              </Button>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Import Results */}
      {importResult && (
        <Card>
          <CardContent className="p-6 space-y-3">
            <h4 className="font-medium">Resultado da Validação</h4>
            
            {importResult.success > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-accent-foreground" />
                <span>{importResult.success} empresa(s) válida(s)</span>
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
