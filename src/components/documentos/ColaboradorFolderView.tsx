import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import JSZip from "jszip";
import {
  FolderOpen,
  User,
  FileText,
  Clock,
  FileWarning,
  ArrowLeft,
  Upload,
  Search,
  Download,
  FolderDown,
  MoreHorizontal,
  Eye,
  Trash2,
  Loader2,
  AlertCircle,
  FileCheck,
  LayoutGrid,
  List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { cn } from "@/lib/utils";
import { type Documento } from "@/hooks/useDocumentos";
import { useColaboradores } from "@/hooks/useColaboradores";
import { toast } from "sonner";
import { DocumentosCategorias } from "./DocumentosCategorias";
import { formatDateBR } from "@/lib/dataLocal";

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

interface ColaboradorFolder {
  id: string;
  nome: string;
  cargo: string;
  departamento: string | null;
  documentos: Documento[];
  vencendo: number;
  vencidos: number;
}

interface ColaboradorFolderViewProps {
  documentos: Documento[];
  onUpload: (colaboradorId?: string) => void;
  onDownload: (doc: Documento) => void;
  onDelete: (doc: Documento) => void;
  deleting: boolean;
  initialColaboradorId?: string | null;
  getSignedUrl: (storagePath: string) => Promise<string | null>;
}

export function ColaboradorFolderView({
  documentos,
  onUpload,
  onDownload,
  onDelete,
  deleting,
  initialColaboradorId,
  getSignedUrl,
}: ColaboradorFolderViewProps) {
  const { colaboradores } = useColaboradores();
  const [selectedFolder, setSelectedFolder] = useState<ColaboradorFolder | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [documentoToDelete, setDocumentoToDelete] = useState<Documento | null>(null);
  const [initialFolderOpened, setInitialFolderOpened] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);

  // Função para baixar pasta como ZIP
  const handleDownloadZip = async () => {
    if (!selectedFolder || selectedFolder.documentos.length === 0) return;
    
    setDownloadingZip(true);
    const zip = new JSZip();
    
    try {
      // Baixar cada arquivo e adicionar ao ZIP
      const downloadPromises = selectedFolder.documentos.map(async (doc) => {
        try {
          const url = await getSignedUrl(doc.storage_path);
          if (!url) return;
          
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Erro ao baixar ${doc.nome_original}`);
          
          const blob = await response.blob();
          zip.file(doc.nome_original, blob);
        } catch (error) {
          console.error(`Erro ao baixar ${doc.nome_original}:`, error);
        }
      });
      
      await Promise.all(downloadPromises);
      
      // Gerar e baixar o ZIP
      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `${selectedFolder.nome.replace(/[^a-zA-Z0-9]/g, "_")}_documentos.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      
      toast.success("Download concluído", {
        description: `${selectedFolder.documentos.length} documento(s) baixado(s) com sucesso.`
      });
    } catch (error) {
      console.error("Erro ao criar ZIP:", error);
      toast.error("Erro ao criar arquivo ZIP");
    } finally {
      setDownloadingZip(false);
    }
  };
  // Agrupar documentos por colaborador
  const pastas = useMemo(() => {
    const agrupados = new Map<string, ColaboradorFolder>();

    // Criar pastas para todos os colaboradores (mesmo sem documentos)
    colaboradores.forEach((colab) => {
      agrupados.set(colab.id, {
        id: colab.id,
        nome: colab.nome_completo,
        cargo: colab.cargo,
        departamento: colab.departamento,
        documentos: [],
        vencendo: 0,
        vencidos: 0,
      });
    });

    // Adicionar documentos às pastas
    documentos.forEach((doc) => {
      const key = doc.colaborador_id || "sem-colaborador";
      
      if (!agrupados.has(key)) {
        agrupados.set(key, {
          id: key,
          nome: doc.colaborador_nome,
          cargo: "",
          departamento: null,
          documentos: [],
          vencendo: 0,
          vencidos: 0,
        });
      }
      
      const pasta = agrupados.get(key)!;
      pasta.documentos.push(doc);
      if (doc.status === "vencendo") pasta.vencendo++;
      if (doc.status === "vencido") pasta.vencidos++;
    });

    return Array.from(agrupados.values()).sort((a, b) => 
      a.nome.localeCompare(b.nome, "pt-BR")
    );
  }, [documentos, colaboradores]);

  // Abrir pasta inicial se especificado via URL
  useEffect(() => {
    if (initialColaboradorId && pastas.length > 0 && !initialFolderOpened) {
      const pasta = pastas.find(p => p.id === initialColaboradorId);
      if (pasta) {
        setSelectedFolder(pasta);
        setInitialFolderOpened(true);
      }
    }
  }, [initialColaboradorId, pastas, initialFolderOpened]);
  const pastasFiltradas = useMemo(() => {
    if (!searchTerm) return pastas;
    return pastas.filter(
      (p) =>
        p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.cargo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.departamento && p.departamento.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [pastas, searchTerm]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const handleDelete = async () => {
    if (!documentoToDelete) return;
    onDelete(documentoToDelete);
    setDocumentoToDelete(null);
  };

  // Visualização interna da pasta
  if (selectedFolder) {
    return (
      <div className="space-y-4">
        {/* Header da pasta */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedFolder(null)}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10">
                <FolderOpen className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {selectedFolder.nome}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {selectedFolder.cargo}
                  {selectedFolder.departamento && ` • ${selectedFolder.departamento}`}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedFolder.documentos.length > 0 && (
              <Button 
                variant="outline" 
                onClick={handleDownloadZip}
                disabled={downloadingZip}
              >
                {downloadingZip ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FolderDown className="w-4 h-4 mr-2" />
                )}
                Baixar Pasta (.zip)
              </Button>
            )}
            <Button onClick={() => onUpload(selectedFolder.id)}>
              <Upload className="w-4 h-4 mr-2" />
              Novo Documento
            </Button>
          </div>
        </motion.div>

        {/* Tabs: Estruturado vs Todos */}
        <Tabs defaultValue="estruturado" className="w-full">
          <TabsList className="grid w-full max-w-xs grid-cols-2">
            <TabsTrigger value="estruturado" className="flex items-center gap-2">
              <LayoutGrid className="w-4 h-4" />
              Estruturado
            </TabsTrigger>
            <TabsTrigger value="todos" className="flex items-center gap-2">
              <List className="w-4 h-4" />
              Todos ({selectedFolder.documentos.length})
            </TabsTrigger>
          </TabsList>

          {/* Aba Estruturado - por categorias */}
          <TabsContent value="estruturado" className="mt-4">
            <DocumentosCategorias
              documentos={selectedFolder.documentos}
              onUpload={(tipo) => onUpload(selectedFolder.id)}
              onDownload={onDownload}
              onDelete={setDocumentoToDelete}
            />
          </TabsContent>

          {/* Aba Todos - lista simples */}
          <TabsContent value="todos" className="mt-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
            >
              {selectedFolder.documentos.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Nenhum documento nesta pasta ainda.
                  </p>
                  <Button onClick={() => onUpload(selectedFolder.id)}>
                    <Upload className="w-4 h-4 mr-2" />
                    Enviar Primeiro Documento
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {selectedFolder.documentos.map((doc, index) => {
                    const config = statusConfig[doc.status];
                    return (
                      <motion.div
                        key={doc.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn("p-2 rounded-lg", config.style)}>
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              {doc.nome_original}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
                                {formatDateBR(doc.data_validade)}
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
                              <DropdownMenuItem onClick={() => onDownload(doc)}>
                                <Eye className="w-4 h-4 mr-2" />
                                Visualizar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onDownload(doc)}>
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
        </Tabs>

        {/* Delete Confirmation */}
        <AlertDialog
          open={!!documentoToDelete}
          onOpenChange={() => setDocumentoToDelete(null)}
        >
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
  }

  // Visualização de pastas (grid)
  return (
    <div className="space-y-4">
      {/* Busca */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar colaborador..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Grid de pastas */}
      {pastasFiltradas.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {colaboradores.length === 0
              ? "Nenhum colaborador cadastrado. Cadastre colaboradores para criar pastas de documentos."
              : "Nenhum colaborador encontrado com a busca."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {pastasFiltradas.map((pasta, index) => (
            <motion.div
              key={pasta.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.03 }}
              onClick={() => setSelectedFolder(pasta)}
              className={cn(
                "bg-card rounded-xl border border-border p-5 shadow-sm cursor-pointer transition-all group",
                "hover:shadow-md hover:border-primary/30",
                pasta.vencidos > 0 && "border-destructive/30",
                pasta.vencendo > 0 && !pasta.vencidos && "border-warning/30"
              )}
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <FolderOpen className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                    {pasta.nome}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {pasta.cargo || "Sem cargo"}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs">
                      {pasta.documentos.length} doc{pasta.documentos.length !== 1 && "s"}
                    </Badge>
                    {pasta.vencendo > 0 && (
                      <Badge className="text-xs bg-warning/10 text-warning border-warning/20">
                        {pasta.vencendo} vencendo
                      </Badge>
                    )}
                    {pasta.vencidos > 0 && (
                      <Badge className="text-xs bg-destructive/10 text-destructive border-destructive/20">
                        {pasta.vencidos} vencido{pasta.vencidos !== 1 && "s"}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
