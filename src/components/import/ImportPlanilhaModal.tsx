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
import * as XLSX from "xlsx";
import { toast } from "sonner";

interface ImportPlanilhaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  titulo?: string;
  descricao?: string;
}

type Etapa = "upload" | "preview" | "processando" | "resultado";

export function ImportPlanilhaModal({
  open,
  onOpenChange,
  onSuccess,
  titulo = "Importar Planilha",
  descricao = "Importe colaboradores e cargos a partir de uma planilha Excel ou CSV",
}: ImportPlanilhaModalProps) {
  const { lerArquivo, processarImportacao, isProcessing, progress } = useImportacaoPlanilha();
  
  const [etapa, setEtapa] = useState<Etapa>("upload");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [dados, setDados] = useState<DadosPlanilha[]>([]);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const resetar = () => {
    setEtapa("upload");
    setArquivo(null);
    setDados([]);
    setResultado(null);
    setErro(null);
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

    try {
      const dadosLidos = await lerArquivo(file);
      setDados(dadosLidos);
      setEtapa("preview");
    } catch (error: any) {
      setErro(error.message || "Erro ao ler arquivo");
      toast.error("Erro ao ler planilha: " + error.message);
    }
  }, [lerArquivo]);

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

  const templateData = [
    ["Nome", "CPF", "Sexo", "Data Nascimento", "SITUAÇÃO", "BR/PDH", "Nome cargo", "Departamento", "Nível"],
    ["João Silva", "123.456.789-00", "Masculino", "15/03/1990", "1", "Matriz", "Analista de RH", "Recursos Humanos", "Pleno"],
    ["Maria Santos", "987.654.321-00", "Feminino", "22/08/1985", "1", "Filial SP", "Gerente Financeiro", "Financeiro", "Gerente"],
    ["Pedro Oliveira", "111.222.333-44", "Masculino", "10/01/1995", "0", "Matriz", "Desenvolvedor", "TI", "Junior"],
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
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo");
    
    // Ajustar largura das colunas
    ws["!cols"] = [
      { wch: 25 }, // Nome
      { wch: 18 }, // CPF
      { wch: 12 }, // Sexo
      { wch: 16 }, // Data Nascimento
      { wch: 12 }, // SITUAÇÃO
      { wch: 12 }, // BR/PDH
      { wch: 20 }, // Nome cargo
      { wch: 20 }, // Departamento
      { wch: 12 }, // Nível
    ];
    
    XLSX.writeFile(wb, "modelo_importacao.xlsx");
  };

  const dadosValidos = dados.filter(d => d.erros.length === 0);
  const dadosComErros = dados.filter(d => d.erros.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
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

                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="font-medium text-sm mb-2">Colunas esperadas:</p>
                  <div className="flex flex-wrap gap-2">
                    {["Nome", "CPF", "Sexo", "Data Nascimento", "SITUAÇÃO", "BR/PDH", "Nome cargo", "Departamento", "Nível"].map(col => (
                      <Badge key={col} variant="secondary" className="text-xs">
                        {col}
                      </Badge>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Etapa: Preview */}
            {etapa === "preview" && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                {/* Arquivo selecionado */}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
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
                <div className="grid grid-cols-2 gap-4">
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

                {/* Preview da tabela */}
                <ScrollArea className="h-[300px] border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Linha</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>CPF</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead>Departamento</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dados.slice(0, 50).map((dado, idx) => (
                        <TableRow key={idx} className={dado.erros.length > 0 ? "bg-destructive/5" : ""}>
                          <TableCell className="font-mono text-xs">{dado.linha}</TableCell>
                          <TableCell className="font-medium">{dado.nome || "-"}</TableCell>
                          <TableCell className="font-mono text-xs">{dado.cpf || "-"}</TableCell>
                          <TableCell>{dado.cargo || "-"}</TableCell>
                          <TableCell>{dado.departamento || "-"}</TableCell>
                          <TableCell>
                            {dado.erros.length > 0 ? (
                              <Badge variant="destructive" className="text-xs">
                                {dado.erros[0]}
                              </Badge>
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
                  {dados.length > 50 && (
                    <p className="text-center text-sm text-muted-foreground py-2">
                      ... e mais {dados.length - 50} registros
                    </p>
                  )}
                </ScrollArea>

                {/* Ações */}
                <div className="flex justify-end gap-3">
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
