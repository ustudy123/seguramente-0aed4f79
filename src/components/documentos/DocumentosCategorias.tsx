import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  FileCheck,
  FileWarning,
  Clock,
  AlertCircle,
  Upload,
  Download,
  Eye,
  Trash2,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  Briefcase,
  Heart,
  Shield,
  FileSignature,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { type Documento } from "@/hooks/useDocumentos";

// Definição das categorias de documentos obrigatórios
export const CATEGORIAS_DOCUMENTOS = [
  {
    id: "admissao",
    nome: "Admissão",
    icon: Briefcase,
    descricao: "Documentos do processo admissional",
    ordem: 1,
    documentos: [
      { tipo: "Ficha de Registro", obrigatorio: true, descricao: "Ficha de registro do empregado" },
      { tipo: "Contrato", obrigatorio: true, descricao: "Contrato de trabalho assinado" },
      { tipo: "CTPS", obrigatorio: true, descricao: "Carteira de Trabalho e Previdência Social" },
      { tipo: "RG", obrigatorio: true, descricao: "Documento de identidade" },
      { tipo: "CPF", obrigatorio: true, descricao: "Cadastro de Pessoa Física" },
      { tipo: "Comprovante de Residência", obrigatorio: true, descricao: "Comprovante atualizado" },
      { tipo: "Título de Eleitor", obrigatorio: false, descricao: "Título de eleitor" },
      { tipo: "Carteira de Reservista", obrigatorio: false, descricao: "Para homens maiores de 18 anos" },
      { tipo: "CNH", obrigatorio: false, descricao: "Carteira Nacional de Habilitação" },
      { tipo: "Certificado", obrigatorio: false, descricao: "Certificados de cursos e formações" },
    ],
  },
  {
    id: "saude",
    nome: "Saúde Ocupacional",
    icon: Heart,
    descricao: "ASOs e documentos de saúde",
    ordem: 2,
    documentos: [
      { tipo: "ASO", obrigatorio: true, descricao: "Atestado de Saúde Ocupacional (Admissional, Periódico, Demissional)" },
      { tipo: "Atestado", obrigatorio: false, descricao: "Atestados médicos diversos" },
    ],
  },
  {
    id: "seguranca",
    nome: "Segurança do Trabalho",
    icon: Shield,
    descricao: "EPIs, NRs e segurança",
    ordem: 3,
    documentos: [
      { tipo: "Recibo de EPI", obrigatorio: true, descricao: "Ficha de entrega de EPIs assinada" },
      { tipo: "Ordem de Serviço", obrigatorio: true, descricao: "Ordem de Serviço conforme NR-01" },
      { tipo: "Treinamento NR", obrigatorio: false, descricao: "Certificados de treinamentos de NRs" },
    ],
  },
  {
    id: "termos",
    nome: "Termos e Declarações",
    icon: FileSignature,
    descricao: "Termos legais e declarações",
    ordem: 4,
    documentos: [
      { tipo: "Termo de Confidencialidade", obrigatorio: false, descricao: "Termo de sigilo e confidencialidade" },
      { tipo: "Termo de Responsabilidade", obrigatorio: false, descricao: "Termos de responsabilidade diversos" },
      { tipo: "Termo de Uso de Imagem", obrigatorio: false, descricao: "Autorização de uso de imagem" },
      { tipo: "Declaração de Dependentes", obrigatorio: false, descricao: "Declaração para IR" },
      { tipo: "Vale Transporte", obrigatorio: false, descricao: "Opção pelo vale-transporte" },
    ],
  },
  {
    id: "outros",
    nome: "Outros Documentos",
    icon: ClipboardList,
    descricao: "Documentos diversos",
    ordem: 5,
    documentos: [
      { tipo: "Outros", obrigatorio: false, descricao: "Outros documentos" },
    ],
  },
] as const;

export type CategoriaDocumento = typeof CATEGORIAS_DOCUMENTOS[number];
export type TipoDocumentoCategoria = typeof CATEGORIAS_DOCUMENTOS[number]["documentos"][number];

// Status de preenchimento de cada documento
interface DocumentoStatus {
  tipo: string;
  obrigatorio: boolean;
  descricao: string;
  preenchido: boolean;
  documento?: Documento;
  status?: "valido" | "vencendo" | "vencido";
}

interface CategoriaStatus {
  categoria: CategoriaDocumento;
  documentos: DocumentoStatus[];
  totalObrigatorios: number;
  preenchidosObrigatorios: number;
  total: number;
  preenchidos: number;
  percentual: number;
  temVencidos: boolean;
  temVencendo: boolean;
}

const statusConfig = {
  valido: {
    label: "Válido",
    icon: FileCheck,
    style: "bg-success/10 text-success border-success/20",
  },
  vencendo: {
    label: "Vencendo",
    icon: Clock,
    style: "bg-warning/10 text-warning border-warning/20",
  },
  vencido: {
    label: "Vencido",
    icon: FileWarning,
    style: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

interface DocumentosCategoriasProps {
  documentos: Documento[];
  onUpload: (tipo?: string) => void;
  onDownload: (doc: Documento) => void;
  onDelete: (doc: Documento) => void;
}

export function DocumentosCategorias({
  documentos,
  onUpload,
  onDownload,
  onDelete,
}: DocumentosCategoriasProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["admissao", "saude", "seguranca"]) // Expandir principais por padrão
  );

  // Calcular status de cada categoria
  const categoriasStatus = useMemo((): CategoriaStatus[] => {
    return CATEGORIAS_DOCUMENTOS.map((categoria) => {
      const documentosStatus: DocumentoStatus[] = categoria.documentos.map((docDef) => {
        // Encontrar documento correspondente (pode haver múltiplos do mesmo tipo)
        const docEncontrado = documentos.find((d) => d.tipo === docDef.tipo);
        
        return {
          tipo: docDef.tipo,
          obrigatorio: docDef.obrigatorio,
          descricao: docDef.descricao,
          preenchido: !!docEncontrado,
          documento: docEncontrado,
          status: docEncontrado?.status,
        };
      });

      // Adicionar documentos do colaborador que não estão na lista de categorias
      const tiposCategoria = categoria.documentos.map((d) => d.tipo);
      const docsExtras = documentos.filter(
        (d) => 
          !CATEGORIAS_DOCUMENTOS.flatMap((c) => c.documentos.map((doc) => doc.tipo)).includes(d.tipo) &&
          categoria.id === "outros"
      );

      docsExtras.forEach((doc) => {
        if (!documentosStatus.find((ds) => ds.documento?.id === doc.id)) {
          documentosStatus.push({
            tipo: doc.tipo,
            obrigatorio: false,
            descricao: doc.observacoes || "Documento adicional",
            preenchido: true,
            documento: doc,
            status: doc.status,
          });
        }
      });

      const totalObrigatorios = documentosStatus.filter((d) => d.obrigatorio).length;
      const preenchidosObrigatorios = documentosStatus.filter((d) => d.obrigatorio && d.preenchido).length;
      const total = documentosStatus.length;
      const preenchidos = documentosStatus.filter((d) => d.preenchido).length;
      const percentual = totalObrigatorios > 0 ? (preenchidosObrigatorios / totalObrigatorios) * 100 : 100;
      const temVencidos = documentosStatus.some((d) => d.status === "vencido");
      const temVencendo = documentosStatus.some((d) => d.status === "vencendo");

      return {
        categoria,
        documentos: documentosStatus,
        totalObrigatorios,
        preenchidosObrigatorios,
        total,
        preenchidos,
        percentual,
        temVencidos,
        temVencendo,
      };
    });
  }, [documentos]);

  // Resumo geral
  const resumo = useMemo(() => {
    const totalObrigatorios = categoriasStatus.reduce((acc, c) => acc + c.totalObrigatorios, 0);
    const preenchidosObrigatorios = categoriasStatus.reduce((acc, c) => acc + c.preenchidosObrigatorios, 0);
    const percentual = totalObrigatorios > 0 ? (preenchidosObrigatorios / totalObrigatorios) * 100 : 100;
    const completo = preenchidosObrigatorios === totalObrigatorios;

    return { totalObrigatorios, preenchidosObrigatorios, percentual, completo };
  }, [categoriasStatus]);

  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="space-y-4">
      {/* Resumo Geral */}
      <div className="bg-card rounded-xl border p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <span className="font-medium">Prontuário Digital</span>
          </div>
          <div className="flex items-center gap-2">
            {resumo.completo ? (
              <Badge className="bg-success/10 text-success border-success/20">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Completo
              </Badge>
            ) : (
              <Badge className="bg-warning/10 text-warning border-warning/20">
                <AlertCircle className="w-3 h-3 mr-1" />
                {resumo.preenchidosObrigatorios}/{resumo.totalObrigatorios} obrigatórios
              </Badge>
            )}
          </div>
        </div>
        <Progress value={resumo.percentual} className="h-2" />
        <p className="text-xs text-muted-foreground mt-2">
          {resumo.preenchidosObrigatorios} de {resumo.totalObrigatorios} documentos obrigatórios preenchidos
        </p>
      </div>

      {/* Categorias */}
      <div className="space-y-2">
        {categoriasStatus.map((catStatus, index) => {
          const { categoria, documentos: docs, percentual, temVencidos, temVencendo, preenchidosObrigatorios, totalObrigatorios } = catStatus;
          const Icon = categoria.icon;
          const isExpanded = expandedCategories.has(categoria.id);

          return (
            <motion.div
              key={categoria.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "bg-card rounded-xl border overflow-hidden",
                temVencidos && "border-destructive/30",
                temVencendo && !temVencidos && "border-warning/30"
              )}
            >
              {/* Header da categoria */}
              <button
                onClick={() => toggleCategory(categoria.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    percentual === 100 ? "bg-success/10 text-success" : "bg-primary/10 text-primary"
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-medium">{categoria.nome}</h3>
                    <p className="text-xs text-muted-foreground">{categoria.descricao}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {totalObrigatorios > 0 && (
                    <div className="hidden sm:flex items-center gap-2">
                      <Progress value={percentual} className="w-20 h-2" />
                      <span className="text-xs text-muted-foreground w-12">
                        {preenchidosObrigatorios}/{totalObrigatorios}
                      </span>
                    </div>
                  )}
                  {temVencidos && (
                    <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs">
                      Vencido
                    </Badge>
                  )}
                  {temVencendo && !temVencidos && (
                    <Badge className="bg-warning/10 text-warning border-warning/20 text-xs">
                      Vencendo
                    </Badge>
                  )}
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Lista de documentos */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t divide-y">
                      {docs.map((docStatus) => (
                        <div
                          key={docStatus.tipo + (docStatus.documento?.id || "")}
                          className="flex items-center justify-between p-3 px-4 hover:bg-muted/20 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {docStatus.preenchido ? (
                              <div className={cn("p-1.5 rounded-md", statusConfig[docStatus.status || "valido"].style)}>
                                <FileCheck className="w-4 h-4" />
                              </div>
                            ) : (
                              <div className={cn(
                                "p-1.5 rounded-md",
                                docStatus.obrigatorio 
                                  ? "bg-destructive/10 text-destructive" 
                                  : "bg-muted text-muted-foreground"
                              )}>
                                <XCircle className="w-4 h-4" />
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{docStatus.tipo}</span>
                                {docStatus.obrigatorio && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                                    Obrigatório
                                  </Badge>
                                )}
                              </div>
                              {docStatus.preenchido && docStatus.documento ? (
                                <p className="text-xs text-muted-foreground">
                                  {docStatus.documento.nome_original} • {formatFileSize(docStatus.documento.tamanho)}
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground">{docStatus.descricao}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {docStatus.preenchido && docStatus.documento && docStatus.status && (
                              <Badge className={cn("text-xs hidden sm:flex", statusConfig[docStatus.status].style)}>
                                {statusConfig[docStatus.status].label}
                              </Badge>
                            )}

                            {docStatus.preenchido && docStatus.documento ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => onDownload(docStatus.documento!)}>
                                    <Eye className="w-4 h-4 mr-2" />
                                    Visualizar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => onDownload(docStatus.documento!)}>
                                    <Download className="w-4 h-4 mr-2" />
                                    Download
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => onDelete(docStatus.documento!)}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onUpload(docStatus.tipo)}
                                className="text-xs h-7"
                              >
                                <Upload className="w-3 h-3 mr-1" />
                                Enviar
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
