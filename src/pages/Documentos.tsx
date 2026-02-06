import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  FileText, 
  Upload, 
  Search,
  Folder,
  File,
  FileCheck,
  FileWarning,
  Download,
  MoreHorizontal,
  Eye,
  Trash2,
  Clock,
  Loader2,
  AlertCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useDocumentos, TIPOS_DOCUMENTO, type Documento } from "@/hooks/useDocumentos";
import { DocumentoUploadForm } from "@/components/documentos/DocumentoUploadForm";
import { ColaboradorFolderView } from "@/components/documentos/ColaboradorFolderView";
import { Users } from "lucide-react";

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

const Documentos = () => {
  const [searchParams] = useSearchParams();
  const colaboradorIdFromUrl = searchParams.get("colaborador");
  
  const [activeTab, setActiveTab] = useState(colaboradorIdFromUrl ? "colaboradores" : "todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoFilter, setTipoFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [documentoToDelete, setDocumentoToDelete] = useState<Documento | null>(null);
  const [uploadForColaboradorId, setUploadForColaboradorId] = useState<string | undefined>(undefined);

  const { 
    documentos, 
    isLoading, 
    stats, 
    tiposUnicos,
    deleteDocumento,
    deleting,
    getSignedUrl,
  } = useDocumentos();

  const handleOpenUpload = (colaboradorId?: string) => {
    setUploadForColaboradorId(colaboradorId);
    setShowUploadForm(true);
  };

  const handleCloseUpload = (open: boolean) => {
    setShowUploadForm(open);
    if (!open) {
      setUploadForColaboradorId(undefined);
    }
  };

  const filteredDocs = documentos.filter((doc) => {
    const matchesSearch = 
      doc.nome_original.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.colaborador_nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTipo = tipoFilter === "all" || doc.tipo === tipoFilter;
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    return matchesSearch && matchesTipo && matchesStatus;
  });

  // Agrupar por tipo para aba de categorias
  const categorias = tiposUnicos.map((tipo) => ({
    nome: tipo,
    count: documentos.filter((d) => d.tipo === tipo).length,
  }));

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const handleDownload = async (doc: Documento) => {
    const url = await getSignedUrl(doc.storage_path);
    if (url) {
      window.open(url, "_blank");
    }
  };

  const handleDelete = async () => {
    if (!documentoToDelete) return;
    await deleteDocumento(documentoToDelete);
    setDocumentoToDelete(null);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">Documentos</h1>
          <p className="text-muted-foreground">Gestão de arquivos e documentos</p>
        </div>
        <Button className="gradient-primary shadow-glow" onClick={() => handleOpenUpload()}>
          <Upload className="w-4 h-4 mr-2" />
          Upload de Documento
        </Button>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/10">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total de Documentos</p>
          </div>
        </div>
        <div className="bg-warning/5 border border-warning/20 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-warning/10">
            <Clock className="w-6 h-6 text-warning" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.vencendo}</p>
            <p className="text-sm text-muted-foreground">Vencendo em 30 dias</p>
          </div>
        </div>
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-destructive/10">
            <FileWarning className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.vencidos}</p>
            <p className="text-sm text-muted-foreground">Documentos Vencidos</p>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <TabsList className="bg-muted/50">
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="colaboradores" className="gap-1">
              <Users className="w-4 h-4" />
              Por Colaborador
            </TabsTrigger>
            <TabsTrigger value="categorias">Por Categoria</TabsTrigger>
          </TabsList>
        </motion.div>

        <TabsContent value="todos" className="space-y-4">
          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="bg-card rounded-xl border border-border p-4 shadow-sm"
          >
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar documento ou colaborador..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Tipos</SelectItem>
                  {TIPOS_DOCUMENTO.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="valido">Válido</SelectItem>
                  <SelectItem value="vencendo">Vencendo</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </motion.div>

          {/* Documents List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  {documentos.length === 0
                    ? "Nenhum documento cadastrado ainda."
                    : "Nenhum documento encontrado com os filtros aplicados."}
                </p>
                {documentos.length === 0 && (
                  <Button onClick={() => handleOpenUpload()}>
                    <Upload className="w-4 h-4 mr-2" />
                    Enviar Primeiro Documento
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredDocs.map((doc, index) => {
                  const config = statusConfig[doc.status];
                  return (
                    <motion.div
                      key={doc.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.3 + index * 0.05 }}
                      className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn("p-2 rounded-lg", config.style)}>
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{doc.nome_original}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{doc.colaborador_nome}</span>
                            <span>•</span>
                            <span>{doc.tipo}</span>
                            <span>•</span>
                            <span>{formatFileSize(doc.tamanho)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {doc.data_validade && (
                          <div className="text-right hidden md:block">
                            <p className="text-xs text-muted-foreground">Validade</p>
                            <p className="text-sm font-medium">
                              {new Date(doc.data_validade).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                        )}
                        <Badge className={cn("text-xs hidden sm:flex", config.style)}>
                          {config.label}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDownload(doc)}>
                              <Eye className="w-4 h-4 mr-2" />
                              Visualizar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownload(doc)}>
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => setDocumentoToDelete(doc)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </TabsContent>

        <TabsContent value="colaboradores">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <ColaboradorFolderView
              documentos={documentos}
              onUpload={handleOpenUpload}
              onDownload={handleDownload}
              onDelete={async (doc) => {
                await deleteDocumento(doc);
              }}
              deleting={deleting}
              initialColaboradorId={colaboradorIdFromUrl}
              getSignedUrl={getSignedUrl}
            />
          </motion.div>
        </TabsContent>

        <TabsContent value="categorias">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {categorias.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Folder className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Nenhuma categoria encontrada. Envie documentos para ver as categorias.
                </p>
              </div>
            ) : (
              categorias.map((cat, index) => (
                <motion.div
                  key={cat.nome}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group"
                  onClick={() => {
                    setTipoFilter(cat.nome);
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <File className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {cat.nome}
                      </h3>
                      <p className="text-sm text-muted-foreground">{cat.count} documentos</p>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Upload Form Modal */}
      <DocumentoUploadForm
        open={showUploadForm}
        onOpenChange={handleCloseUpload}
        preSelectedColaboradorId={uploadForColaboradorId}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!documentoToDelete} onOpenChange={() => setDocumentoToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              Excluir Documento
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o documento{" "}
              <span className="font-medium">{documentoToDelete?.nome_original}</span>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Documentos;
