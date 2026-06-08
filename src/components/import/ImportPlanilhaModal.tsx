import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  X,
  Download,
  Loader2,
  Wand2,
  Building2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useImportacaoPlanilha, DadosPlanilha, ResultadoImportacao } from "@/hooks/useImportacaoPlanilha";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { ColumnMappingStep } from "./ColumnMappingStep";
import * as XLSX from "xlsx";
import { toast } from "sonner";

interface ImportPlanilhaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  titulo?: string;
  descricao?: string;
}

type Etapa = "upload" | "mapeamento" | "preview" | "processando" | "resultado";

export function ImportPlanilhaModal({
  open,
  onOpenChange,
  onSuccess,
  titulo = "Importar Planilha",
  descricao = "Importe colaboradores e funções a partir de uma planilha Excel ou CSV",
}: ImportPlanilhaModalProps) {
  const { lerArquivo, lerArquivoHeaders, lerArquivoComMapeamento, processarImportacao, limparDados, isProcessing, progress } = useImportacaoPlanilha();
  const { empresaAtivaId, setEmpresaAtiva, empresas } = useEmpresaAtiva();
  
  
  const [etapa, setEtapa] = useState<Etapa>("upload");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [dados, setDados] = useState<DadosPlanilha[]>([]);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<any[][]>([]);
  const [usarMapeamento, setUsarMapeamento] = useState(false);
  const [previewFilter, setPreviewFilter] = useState<"todos" | "erros" | "validos">("todos");
  const [lendoArquivo, setLendoArquivo] = useState(false);

  const dadosComErros = dados.filter(d => d.erros.length > 0);
  const dadosValidos = dados.filter(d => d.erros.length === 0);
  const dadosFiltrados = previewFilter === "erros" ? dadosComErros : previewFilter === "validos" ? dadosValidos : dados;

  const resetar = () => {
    setEtapa("upload");
    setArquivo(null);
    setDados([]);
    setResultado(null);
    setErro(null);
    setFileHeaders([]);
    setSampleRows([]);
    setUsarMapeamento(false);
    setPreviewFilter("todos");
    setLendoArquivo(false);
    limparDados();
  };

  const fechar = () => {
    resetar();
    onOpenChange(false);
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setArquivo(file);
    setErro(null);
    setDados([]); // 🔴 LIMPA DADOS ANTIGOS IMEDIATAMENTE ao anexar novo arquivo
    setFileHeaders([]); // Limpa headers antigos
    setSampleRows([]); // Limpa samples antigos
    setLendoArquivo(true);

    try {
      // Try standard auto-detection first
      const dadosLidos = await lerArquivo(file);
      setDados(dadosLidos);
      setEtapa("preview");
    } catch (error: any) {
      // If auto-detection fails (missing columns), go to mapping step
      try {
        const { headers, sampleRows: samples } = await lerArquivoHeaders(file);
        setFileHeaders(headers);
        setSampleRows(samples);
        setUsarMapeamento(true);
        setEtapa("mapeamento");
        toast.info("Colunas não reconhecidas automaticamente. Mapeie as colunas do seu arquivo.");
      } catch (innerError: any) {
        setErro(innerError.message || "Erro ao ler arquivo");
        toast.error("Erro ao ler planilha: " + innerError.message);
      }
    } finally {
      setLendoArquivo(false);
    }
  }, [lerArquivo, lerArquivoHeaders]);

  const onDropParametrizado = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setArquivo(file);
    setErro(null);
    setDados([]); // 🔴 LIMPA DADOS ANTIGOS IMEDIATAMENTE ao anexar novo arquivo
    setFileHeaders([]); // Limpa headers antigos
    setSampleRows([]); // Limpa samples antigos
    setLendoArquivo(true);

    try {
      const { headers, sampleRows: samples } = await lerArquivoHeaders(file);
      setFileHeaders(headers);
      setSampleRows(samples);
      setUsarMapeamento(true);
      setEtapa("mapeamento");
    } catch (error: any) {
      setErro(error.message || "Erro ao ler arquivo");
      toast.error("Erro ao ler planilha: " + error.message);
    } finally {
      setLendoArquivo(false);
    }
  }, [lerArquivoHeaders]);

  const handleMapeamentoConfirm = async (mapping: Record<string, string>) => {
    if (!arquivo) return;
    setLendoArquivo(true);
    try {
      const dadosLidos = await lerArquivoComMapeamento(arquivo, mapping);
      setDados(dadosLidos);
      setEtapa("preview");
    } catch (error: any) {
      setErro(error.message || "Erro ao processar com mapeamento");
      toast.error("Erro ao processar: " + error.message);
    } finally {
      setLendoArquivo(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024, // 5MB
  });

  const handleImportar = async () => {
    setEtapa("processando");
    
    try {
      const result = await processarImportacao(dados);
      setResultado(result);
      setEtapa("resultado");
      
      if (result.erros.length === 0) {
        toast.success(`Importação concluída! ${result.colaboradoresInseridos} novos, ${result.colaboradoresAtualizados} atualizados.`);
      } else {
        toast.warning(`Importação concluída com ${result.erros.length} erros.`);
      }
      
      onSuccess?.();
    } catch (error: any) {
      setErro(error.message);
      setEtapa("preview");
      toast.error("Erro na importação: " + error.message);
    }
  };

  const REQUIRED_MARKER = " *";
  const COLS = [
    "CNPJ/CPF Empresa" + REQUIRED_MARKER,
    "Nome" + REQUIRED_MARKER, "CPF" + REQUIRED_MARKER, "Sexo", "Data Nascimento" + REQUIRED_MARKER, "Estado Civil", "Naturalidade", "Nacionalidade",
    "Nome Mãe", "Nome Pai", "RG", "PIS/PASEP",
    "E-mail", "Telefone", "Celular",
    "CEP", "Endereço", "Número", "Complemento", "Bairro", "Cidade", "Estado",
    "SITUAÇÃO (0=Inativo; 1=Ativo)", "Filial", "Cargo" + REQUIRED_MARKER, "Departamento" + REQUIRED_MARKER, "Nível",
    "CBO",
    "Tipo Contrato", "Data Admissão" + REQUIRED_MARKER, "Salário", "Centro de Custo", "Gestor Imediato",
    "Matrícula eSocial",
    "Banco", "Agência", "Conta", "Tipo Conta", "Chave PIX",
  ];

  const templateData = [
    COLS,
    [
      "12.345.678/0001-90",
      "João da Silva", "338.172.580-70", "Masculino", "15/03/1990", "Solteiro", "São Paulo", "Brasileiro",
      "Maria da Silva", "José da Silva", "12.345.678-9", "123.45678.12-3",
      "joao@empresa.com", "(11) 3000-0000", "(11) 99000-0000",
      "01310-100", "Av. Paulista", "1000", "Sala 10", "Bela Vista", "São Paulo", "SP",
      "1", "Sede", "Analista de RH", "Recursos Humanos", "Pleno",
      "2524-05",
      "CLT", "01/03/2024", "5000,00", "RH-01", "Carlos Souza",
      "00123456789",
      "341", "0001", "12345-6", "Corrente", "joao@empresa.com",
    ],
    [
      "123.456.789-00",
      "Ana Paula Padrão", "987.654.321-00", "Feminino", "22/08/1985", "Casado", "Rio de Janeiro", "Brasileira",
      "Joana Padrão", "", "98.765.432-1", "",
      "ana@empresa.com", "", "(21) 98000-0000",
      "", "", "", "", "", "", "",
      "1", "Filial SP", "Gerente Financeiro", "Financeiro", "Gerente",
      "",
      "CLT", "15/06/2020", "12000,00", "FIN-01", "",
      "",
      "", "", "", "", "",
    ],
  ];

  const downloadTemplateCSV = () => {
    const csvContent = templateData.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "modelo_importacao.csv";
    link.click();
  };

  const downloadTemplateXLSX = () => {
    const wsData = XLSX.utils.aoa_to_sheet(templateData);
    wsData["!cols"] = COLS.map(() => ({ wch: 22 }));

    const instrucoesData = [
      ["INSTRUÇÕES DE PREENCHIMENTO DA PLANILHA DE IMPORTAÇÃO"],
      [""],
      ["Esta planilha permite importar colaboradores em massa para o sistema."],
      ["Preencha a aba 'Dados' seguindo as orientações abaixo para cada coluna."],
      [""],
      ["═══════════════════════════════════════════════════════════════════════════"],
      [""],
      ["COLUNA", "OBRIGATÓRIO", "DESCRIÇÃO", "VALORES ACEITOS", "EXEMPLOS"],
      [""],
      ["CNPJ/CPF Empresa *", "SIM*", "Documento da empresa onde o colaborador será cadastrado. Aceita CNPJ (PJ) ou CPF (profissional liberal). *Pode ficar em branco se houver apenas uma empresa cadastrada — o sistema vincula automaticamente.", "CNPJ (14 dígitos) ou CPF (11 dígitos), com ou sem pontuação", "12.345.678/0001-90 ou 123.456.789-00"],
      ["Nome *", "SIM", "Nome completo do colaborador", "Texto livre", "Maria da Silva Santos"],
      ["CPF *", "SIM", "CPF do colaborador (com ou sem pontuação)", "11 dígitos numéricos", "123.456.789-00"],
      ["Sexo", "NÃO", "Gênero do colaborador", "Masculino, Feminino, M, F", "Masculino"],
      ["Data Nascimento *", "SIM", "Data de nascimento", "DD/MM/AAAA ou AAAA-MM-DD", "15/03/1990"],
      ["Estado Civil", "NÃO", "Estado civil", "Solteiro, Casado, Divorciado, Viúvo, União Estável", "Casado"],
      ["Naturalidade", "NÃO", "Cidade onde nasceu", "Texto livre", "São Paulo"],
      ["Nacionalidade", "NÃO", "Nacionalidade", "Texto livre", "Brasileiro"],
      ["Nome Mãe", "NÃO", "Nome completo da mãe", "Texto livre", "Maria da Silva"],
      ["Nome Pai", "NÃO", "Nome completo do pai", "Texto livre", "José da Silva"],
      ["RG", "NÃO", "Número do RG", "Texto livre", "12.345.678-9"],
      ["PIS/PASEP", "NÃO", "Número do PIS/NIS/NIT", "Texto livre", "123.45678.12-3"],
      ["E-mail", "NÃO", "E-mail do colaborador", "Endereço de e-mail válido", "joao@empresa.com"],
      ["Telefone", "NÃO", "Telefone fixo", "Formato livre", "(11) 3000-0000"],
      ["Celular", "NÃO", "Celular/WhatsApp", "Formato livre", "(11) 99000-0000"],
      ["CEP", "NÃO", "CEP do endereço", "Somente números ou 00000-000", "01310-100"],
      ["Endereço", "NÃO", "Logradouro", "Texto livre", "Av. Paulista"],
      ["Número", "NÃO", "Número do endereço", "Texto livre", "1000"],
      ["Complemento", "NÃO", "Complemento", "Texto livre", "Sala 10"],
      ["Bairro", "NÃO", "Bairro", "Texto livre", "Bela Vista"],
      ["Cidade", "NÃO", "Município", "Texto livre", "São Paulo"],
      ["Estado", "NÃO", "UF", "Sigla com 2 letras", "SP"],
      ["SITUAÇÃO", "NÃO", "Status do colaborador no sistema", "0 = Inativo (desligado), 1 = Ativo", "1"],
      ["Filial", "NÃO", "Estabelecimento/Unidade do colaborador", "Nome do estabelecimento cadastrado", "Sede"],
      ["Cargo *", "SIM", "Cargo do colaborador", "Nome do cargo", "Analista de RH"],
      ["Departamento *", "SIM", "Departamento/Setor", "Nome do departamento", "Recursos Humanos"],
      ["Nível", "NÃO", "Nível de senioridade", "Estagiário, Junior, Pleno, Senior, Especialista, Coordenador, Gerente, Diretor", "Pleno"],
      ["CBO", "NÃO", "Código CBO (Classificação Brasileira de Ocupações). Aceita formato com ou sem traço.", "6 dígitos: 000000 ou 0000-00", "2524-05 ou 252405"],
      ["Tipo Contrato", "NÃO", "Regime de contratação", "CLT, CLT – Experiência, Pró-labore (Sócio), Estagiário, Temporário, Autônomo, Intermitente, Aprendiz. ⚠️ PJ deve ser cadastrado em Terceiros.", "CLT"],
      ["Data Admissão *", "SIM", "Data de admissão", "DD/MM/AAAA ou AAAA-MM-DD", "01/03/2024"],
      ["Salário", "NÃO", "Salário base bruto", "Número (use . ou , como decimal)", "5000,00"],
      ["Centro de Custo", "NÃO", "Centro de custo", "Texto livre", "RH-01"],
      ["Gestor Imediato", "NÃO", "Nome do gestor direto", "Texto livre", "Carlos Souza"],
      ["Matrícula eSocial", "NÃO", "Matrícula do colaborador no eSocial", "Texto livre (até 30 caracteres)", "00123456789"],
      ["Banco", "NÃO", "Código ou nome do banco", "Texto livre", "341 ou Itaú"],
      ["Agência", "NÃO", "Número da agência", "Texto livre", "0001"],
      ["Conta", "NÃO", "Número da conta", "Texto livre", "12345-6"],
      ["Tipo Conta", "NÃO", "Tipo da conta bancária", "Corrente, Poupança", "Corrente"],
      ["Chave PIX", "NÃO", "Chave PIX", "CPF, e-mail, telefone ou chave aleatória", "joao@empresa.com"],
      [""],
      ["═══════════════════════════════════════════════════════════════════════════"],
      [""],
      ["OBSERVAÇÕES IMPORTANTES:"],
      [""],
      ["1. Colunas marcadas com * são OBRIGATÓRIAS. O registro será rejeitado se estiverem vazias."],
      ["2. O CNPJ/CPF Empresa vincula cada colaborador à empresa correta. Aceita CNPJ (PJ) ou CPF (profissional liberal). Se você tem apenas uma empresa cadastrada, pode deixar a coluna em branco."],
      ["3. CPFs duplicados serão atualizados (não criarão registros duplicados)."],
      ["4. Departamentos e Cargos não cadastrados serão criados automaticamente."],
      ["5. A primeira linha deve conter os cabeçalhos (não apagar)."],
      ["6. Linhas completamente vazias serão ignoradas."],
      ["7. Registros com erros serão listados ao final da importação."],
      ["5. Linhas completamente vazias serão ignoradas."],
      ["6. Registros com erros serão listados ao final da importação."],
      [""],
      ["═══════════════════════════════════════════════════════════════════════════"],
      [""],
      ["FORMATOS DE DATA ACEITOS:"],
      [""],
      ["Formato", "Exemplo"],
      ["DD/MM/AAAA", "15/03/1990"],
      ["DD-MM-AAAA", "15-03-1990"],
      ["AAAA-MM-DD", "1990-03-15"],
      ["AAAA/MM/DD", "1990/03/15"],
      [""],
      ["Em caso de dúvidas, entre em contato com o suporte."],
    ];

    const wsInstrucoes = XLSX.utils.aoa_to_sheet(instrucoesData);
    wsInstrucoes["!cols"] = [{ wch: 20 }, { wch: 14 }, { wch: 45 }, { wch: 50 }, { wch: 30 }];

    // Sheet de valores aceitos para referência
    const valoresData = [
      ["TIPOS DE CONTRATO ACEITOS"],
      [""],
      ["Valor", "Descrição"],
      ["CLT", "Contrato CLT prazo indeterminado"],
      ["CLT – Experiência", "Contrato CLT em período de experiência"],
      ["Pró-labore (Sócio)", "Remuneração de sócio/proprietário"],
      ["⚠️ Pessoa Jurídica (PJ)", "NÃO ACEITO — Cadastre no módulo Terceiros & SST"],
      ["Estagiário", "Contrato de estágio"],
      ["Temporário", "Contrato temporário (Lei 6.019)"],
      ["Autônomo", "Trabalhador autônomo/freelancer"],
      ["Intermitente", "CLT intermitente"],
      ["Aprendiz", "Jovem aprendiz"],
      [""],
      ["DICA: Copie o valor exato da coluna 'Valor' para a planilha de Dados."],
      ["O sistema também aceita variações como: clt, pj, estagio, temporario, autonomo, etc."],
    ];
    const wsValores = XLSX.utils.aoa_to_sheet(valoresData);
    wsValores["!cols"] = [{ wch: 25 }, { wch: 45 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsData, "Dados");
    XLSX.utils.book_append_sheet(wb, wsInstrucoes, "Instruções");
    XLSX.utils.book_append_sheet(wb, wsValores, "Valores Aceitos");
    
    XLSX.writeFile(wb, "modelo_importacao.xlsx");
  };


  return (
    <Dialog 
      open={open} 
      onOpenChange={(isOpen) => {
        if (!isOpen) resetar();
        onOpenChange(isOpen);
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Wrapper relative para overlay de "Lendo planilha…" — não pode ser na DialogContent pois sobrescreve o `fixed` do Radix */}
        <DialogHeader className="shrink-0">
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>

        {lendoArquivo && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
            <div className="flex flex-col items-center gap-4 p-8 rounded-xl bg-card border shadow-lg max-w-sm text-center">
              <div className="relative">
                <div className="p-4 rounded-full bg-primary/10">
                  <FileSpreadsheet className="w-8 h-8 text-primary" />
                </div>
                <Loader2 className="w-5 h-5 animate-spin text-primary absolute -top-1 -right-1" />
              </div>
              <div>
                <p className="font-medium text-foreground">Lendo planilha…</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Aguarde enquanto interpretamos o arquivo. Planilhas grandes podem levar alguns segundos.
                </p>
              </div>
              <Progress value={undefined} className="h-1.5 w-full animate-pulse" />
              {arquivo && (
                <p className="text-xs text-muted-foreground truncate max-w-full">{arquivo.name}</p>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0">
          <AnimatePresence mode="wait">
            {/* Etapa: Upload */}
            {etapa === "upload" && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <div
                  {...getRootProps()}
                  className={`
                    border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                    transition-colors duration-200
                    ${isDragActive 
                      ? "border-primary bg-primary/5" 
                      : "border-muted-foreground/25 hover:border-primary/50"
                    }
                  `}
                >
                  <input {...getInputProps()} />
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-4 rounded-full bg-primary/10">
                      <Upload className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {isDragActive ? "Solte o arquivo aqui" : "Arraste uma planilha ou clique para selecionar"}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Formatos aceitos: .xlsx, .xls, .csv (máx. 5MB)
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Inclua o CNPJ (PJ) ou CPF (profissional liberal) da empresa em cada linha. Se você tem apenas uma empresa cadastrada, pode deixar a coluna em branco.
                      </p>
                    </div>
                  </div>
                </div>

                {erro && (
                  <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-lg">
                    <AlertCircle className="w-4 h-4" />
                    {erro}
                  </div>
                )}

                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">Precisa de um modelo?</p>
                    <p className="text-xs text-muted-foreground">
                      Baixe nosso template com as colunas corretas
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={downloadTemplateCSV}>
                      <Download className="w-4 h-4 mr-2" />
                      CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={downloadTemplateXLSX}>
                      <Download className="w-4 h-4 mr-2" />
                      Excel (.xlsx)
                    </Button>
                  </div>
                </div>

                {/* Parametrizar arquivo */}
                <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <div>
                    <p className="font-medium text-sm flex items-center gap-2">
                      <Wand2 className="w-4 h-4 text-primary" />
                      Arquivo em outro formato?
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Importe qualquer planilha e mapeie as colunas manualmente
                    </p>
                  </div>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onDropParametrizado([file]);
                        e.target.value = "";
                      }}
                    />
                    <Button asChild variant="outline" size="sm">
                      <span>
                        <Wand2 className="w-4 h-4 mr-2" />
                        Parametrizar Arquivo
                      </span>
                    </Button>
                  </label>
                </div>

                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="font-medium text-sm mb-2">Colunas esperadas:</p>
                  <div className="flex flex-wrap gap-2">
                    {COLS.map(col => (
                      <Badge key={col} variant={col.includes("*") ? "default" : "secondary"} className="text-xs">
                        {col}
                      </Badge>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Etapa: Mapeamento */}
            {etapa === "mapeamento" && (
              <motion.div
                key="mapeamento"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col h-[60vh]"
              >
                <ColumnMappingStep
                  fileHeaders={fileHeaders}
                  sampleRows={sampleRows}
                  onConfirm={handleMapeamentoConfirm}
                  onBack={resetar}
                />
              </motion.div>
            )}

            {/* Etapa: Preview */}
            {etapa === "preview" && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col gap-4 h-full"
              >

                {/* Arquivo selecionado */}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg shrink-0">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-8 h-8 text-primary" />
                    <div>
                      <p className="font-medium text-sm">{arquivo?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {dados.length} registros encontrados
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={resetar}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* Resumo */}
                <div className="grid grid-cols-2 gap-4 shrink-0">
                  <div className="p-3 bg-success/10 border border-success/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-success" />
                      <span className="text-sm font-medium">{dadosValidos.length} registros válidos</span>
                    </div>
                  </div>
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-destructive" />
                      <span className="text-sm font-medium">{dadosComErros.length} com erros</span>
                    </div>
                  </div>
                </div>

                {/* Filtro de visualização */}
                {dadosComErros.length > 0 && (
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant={previewFilter === "todos" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPreviewFilter("todos")}
                    >
                      Todos ({dados.length})
                    </Button>
                    <Button
                      variant={previewFilter === "erros" ? "destructive" : "outline"}
                      size="sm"
                      onClick={() => setPreviewFilter("erros")}
                    >
                      Com erros ({dadosComErros.length})
                    </Button>
                    <Button
                      variant={previewFilter === "validos" ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setPreviewFilter("validos")}
                    >
                      Válidos ({dadosValidos.length})
                    </Button>
                  </div>
                )}

                {/* Preview da tabela */}
                <ScrollArea className="flex-1 border rounded-lg min-h-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Linha</TableHead>
                        <TableHead>CNPJ/CPF</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>CPF</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead>Setor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dadosFiltrados.map((dado, idx) => (
                        <TableRow key={idx} className={dado.erros.length > 0 ? "bg-destructive/5" : ""}>
                          <TableCell className="font-mono text-xs">{dado.linha}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {(() => {
                              const d = (dado.cnpjEmpresa || "").replace(/\D/g, "");
                              if (d.length === 14) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
                              if (d.length === 11) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
                              return d || "-";
                            })()}
                          </TableCell>
                          <TableCell className="font-medium">{dado.nome || "-"}</TableCell>
                          <TableCell className="font-mono text-xs">{dado.cpf || "-"}</TableCell>
                          <TableCell>{dado.cargo || "-"}</TableCell>
                          <TableCell>{dado.departamento || "-"}</TableCell>
                          <TableCell>
                            {dado.erros.length > 0 ? (
                              <div className="space-y-1">
                                {dado.erros.map((erro, ei) => (
                                  <Badge key={ei} variant="destructive" className="text-xs block w-fit">
                                    {erro}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                {dado.situacao === "concluido" ? "Ativo" : "Inativo"}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>

                {/* Ações — sempre visíveis no rodapé */}
                <div className="flex justify-end gap-3 pt-2 shrink-0 border-t">
                  <Button variant="outline" onClick={resetar}>
                    Voltar
                  </Button>
                  <Button onClick={handleImportar} disabled={dadosValidos.length === 0}>
                    Importar {dadosValidos.length} registros
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Etapa: Processando */}
            {etapa === "processando" && (
              <motion.div
                key="processando"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="py-12 space-y-6 text-center"
              >
                <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
                <div>
                  <p className="font-medium text-lg">Processando importação...</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Criando departamentos, cargos e colaboradores
                  </p>
                </div>
                <Progress value={progress} className="max-w-md mx-auto" />
                <p className="text-sm text-muted-foreground">{progress}%</p>
              </motion.div>
            )}

            {/* Etapa: Resultado */}
            {etapa === "resultado" && resultado && (
              <motion.div
                key="resultado"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="text-center py-4">
                  <div className="p-4 rounded-full bg-success/10 w-fit mx-auto mb-4">
                    <CheckCircle className="w-10 h-10 text-success" />
                  </div>
                  <h3 className="text-lg font-semibold">Importação Concluída!</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Foram processados {resultado.colaboradoresInseridos + resultado.colaboradoresAtualizados + resultado.erros.length} registros.
                    <br />
                    <span className="font-medium text-success">
                      {resultado.colaboradoresInseridos + resultado.colaboradoresAtualizados} registros aceitos
                    </span>
                    {resultado.erros.length > 0 && (
                      <> e <span className="font-medium text-destructive">{resultado.erros.length} rejeitados</span></>
                    )}.
                  </p>
                </div>

                {/* Estatísticas */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-primary">{resultado.departamentosCriados}</p>
                    <p className="text-xs text-muted-foreground">Departamentos criados</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-primary">{resultado.cargosCriados}</p>
                    <p className="text-xs text-muted-foreground">Cargos criados</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-success">{resultado.colaboradoresInseridos}</p>
                    <p className="text-xs text-muted-foreground">Novos colaboradores</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-info">{resultado.colaboradoresAtualizados}</p>
                    <p className="text-xs text-muted-foreground">Atualizados</p>
                  </div>
                </div>

                {/* Distribuição por empresa */}
                {resultado.distribuicaoEmpresas && resultado.distribuicaoEmpresas.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-primary" />
                      <p className="font-medium text-sm">
                        Colaboradores foram distribuídos em {resultado.distribuicaoEmpresas.length}{" "}
                        {resultado.distribuicaoEmpresas.length === 1 ? "empresa" : "empresas"}:
                      </p>
                    </div>
                    {resultado.distribuicaoEmpresas.length > 1 || (resultado.distribuicaoEmpresas[0] && resultado.distribuicaoEmpresas[0].empresaId !== empresaAtivaId) ? (
                      <div className="flex items-start gap-2 p-3 rounded-lg border border-info/30 bg-info/5 text-sm">
                        <Info className="w-4 h-4 mt-0.5 shrink-0 text-info" />
                        <p>
                          Para visualizar os colaboradores, troque a <strong>empresa ativa</strong> no
                          cabeçalho ou clique em uma empresa abaixo.
                        </p>
                      </div>
                    ) : null}
                    <ScrollArea className="max-h-[200px] border rounded-lg">
                      <div className="divide-y">
                        {resultado.distribuicaoEmpresas.map((emp) => {
                          const ativa = emp.empresaId === empresaAtivaId;
                          return (
                            <div
                              key={emp.empresaId}
                              className={`flex items-center justify-between gap-3 p-3 ${ativa ? "bg-primary/5" : ""}`}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{emp.razaoSocial}</p>
                                <p className="text-xs text-muted-foreground font-mono">{emp.cnpj}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge variant="secondary" className="text-xs">
                                  {emp.inseridos + emp.atualizados}{" "}
                                  {emp.inseridos + emp.atualizados === 1 ? "colab." : "colabs."}
                                </Badge>
                                {ativa ? (
                                  <Badge variant="outline" className="text-xs border-primary/40 text-primary">
                                    Ativa
                                  </Badge>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs"
                                    onClick={() => {
                                      const target = empresas.find((e) => e.id === emp.empresaId);
                                      if (target) {
                                        setEmpresaAtiva(target);
                                        toast.success(`Empresa ativa: ${target.razao_social}`);
                                      }
                                    }}
                                  >
                                    Ver
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Erros */}
                {resultado.erros.length > 0 && (
                  <div className="space-y-2">
                    <p className="font-medium text-sm text-destructive">
                      {resultado.erros.length} erros durante a importação:
                    </p>
                    <ScrollArea className="h-[150px] border border-destructive/20 rounded-lg p-3">
                      {resultado.erros.map((erro, idx) => (
                        <div key={idx} className="text-sm py-1">
                          <span className="font-mono text-xs text-muted-foreground">
                            Linha {erro.linha}:
                          </span>{" "}
                          {erro.mensagem}
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button onClick={fechar}>Fechar</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
