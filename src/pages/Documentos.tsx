import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  FileText, 
  Upload, 
  Search,
  FolderTree,
  History,
  Settings,
  FolderPlus,
  Loader2,
  AlertCircle,
  Building2,
  RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

import { useDocumentoPastas } from "@/hooks/useDocumentoPastas";
import { useDocumentos } from "@/hooks/useDocumentos";
import { PastaTreeView } from "@/components/documentos/PastaTreeView";
import { PastaDocumentosList } from "@/components/documentos/PastaDocumentosList";
import { CreatePastaModal } from "@/components/documentos/CreatePastaModal";
import { DocumentoAuditLog } from "@/components/documentos/DocumentoAuditLog";
import { DocumentoUploadForm } from "@/components/documentos/DocumentoUploadForm";
import type { DocumentoPastaNode, DocumentoItem } from "@/types/documentoPasta";

const Documentos = () => {
  const [searchParams] = useSearchParams();
  const colaboradorIdFromUrl = searchParams.get("colaborador");
  
  const [activeTab, setActiveTab] = useState("arvore");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPasta, setSelectedPasta] = useState<DocumentoPastaNode | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadForPastaId, setUploadForPastaId] = useState<string | undefined>(undefined);
  const [showCreatePasta, setShowCreatePasta] = useState(false);
  const [createPastaParentId, setCreatePastaParentId] = useState<string | null>(null);
  const [createPastaParentNome, setCreatePastaParentNome] = useState<string | null>(null);
  const [pastaToDelete, setPastaToDelete] = useState<string | null>(null);
  const [dragContext, setDragContext] = useState<{
    documentoId: string;
    documentoNome: string;
    pastaOrigemId: string;
    pastaOrigemNome: string;
  } | null>(null);

  const {
    pastas,
    tree,
    auditLogs,
    loading,
    loadingAudit,
    createPasta,
    deletePasta,
    moveDocumento,
    movingDoc,
    initializeDefaultStructure,
    initializing,
    needsSync,
    syncColaboradores,
    syncing,
  } = useDocumentoPastas();

  const {
    documentos,
    isLoading: loadingDocs,
    stats,
    deleteDocumento,
    deleting,
    getSignedUrl,
  } = useDocumentos();

  // Abrir pasta de colaborador se especificado na URL
  useEffect(() => {
    if (colaboradorIdFromUrl && tree.length > 0) {
      const findPastaColaborador = (nodes: DocumentoPastaNode[]): DocumentoPastaNode | null => {
        for (const node of nodes) {
          if (node.colaborador_id === colaboradorIdFromUrl) return node;
          const found = findPastaColaborador(node.children);
          if (found) return found;
        }
        return null;
      };
      const pasta = findPastaColaborador(tree);
      if (pasta) setSelectedPasta(pasta);
    }
  }, [colaboradorIdFromUrl, tree]);

  // Auto-sync: criar pastas para colaboradores novos
  useEffect(() => {
    if (needsSync && !syncing) {
      syncColaboradores();
    }
  }, [needsSync, syncing, syncColaboradores]);

  const handleOpenUpload = useCallback((pastaId?: string) => {
    setUploadForPastaId(pastaId);
    setShowUploadForm(true);
  }, []);

  const handleCreateSubfolder = useCallback((parentId: string) => {
    const findPasta = (nodes: DocumentoPastaNode[]): DocumentoPastaNode | null => {
      for (const node of nodes) {
        if (node.id === parentId) return node;
        const found = findPasta(node.children);
        if (found) return found;
      }
      return null;
    };
    const parent = findPasta(tree);
    setCreatePastaParentId(parentId);
    setCreatePastaParentNome(parent?.nome || null);
    setShowCreatePasta(true);
  }, [tree]);

  const handleRenamePasta = useCallback((pasta: DocumentoPastaNode) => {
    // Para renomear, vamos abrir o modal de criação com dados pré-preenchidos
    toast.info("Função de renomear em desenvolvimento");
  }, []);

  const handleDeletePasta = useCallback((pastaId: string) => {
    setPastaToDelete(pastaId);
  }, []);

  const confirmDeletePasta = async () => {
    if (!pastaToDelete) return;
    try {
      await deletePasta(pastaToDelete);
      if (selectedPasta?.id === pastaToDelete) {
        setSelectedPasta(null);
      }
    } catch (error) {
      // Error handled in hook
    }
    setPastaToDelete(null);
  };

  const handleDropDocument = useCallback(async (documentoId: string, pastaDestinoId: string) => {
    if (!dragContext) return;
    
    const findPasta = (nodes: DocumentoPastaNode[]): DocumentoPastaNode | null => {
      for (const node of nodes) {
        if (node.id === pastaDestinoId) return node;
        const found = findPasta(node.children);
        if (found) return found;
      }
      return null;
    };
    
    const pastaDestino = findPasta(tree);
    
    await moveDocumento({
      documentoId,
      documentoNome: dragContext.documentoNome,
      pastaOrigemId: dragContext.pastaOrigemId,
      pastaOrigemNome: dragContext.pastaOrigemNome,
      pastaDestinoId,
      pastaDestinoNome: pastaDestino?.nome || null,
    });
    
    setDragContext(null);
  }, [dragContext, tree, moveDocumento]);

  const handleDragStart = useCallback((documentoId: string, documentoNome: string, pastaOrigemId: string, pastaOrigemNome: string) => {
    setDragContext({ documentoId, documentoNome, pastaOrigemId, pastaOrigemNome });
  }, []);

  const handleDownload = async (doc: DocumentoItem) => {
    try {
      // Documentos do tipo POP não são arquivos em storage — abrir no módulo de Aprendizado
      if (doc.storage_path.startsWith("pop://")) {
        toast.info("Este é um POP (Procedimento Operacional Padrão). Acesse pelo módulo Aprendizado & Papéis para visualizar e editar.");
        return;
      }

      const url = await getSignedUrl(doc.storage_path);
      if (!url) {
        toast.error("Não foi possível gerar o link do documento. Verifique se o arquivo ainda existe.");
        return;
      }
      // Usar fetch + blob para evitar bloqueio do browser (ERR_BLOCKED_BY_CLIENT)
      const response = await fetch(url);
      if (!response.ok) {
        toast.error("Erro ao baixar arquivo: " + response.statusText);
        return;
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = doc.nome_original || "documento";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.error("Erro ao baixar documento:", err);
      toast.error("Erro ao acessar documento: " + (err.message || "Erro desconhecido"));
    }
  };

  const handleDeleteDoc = async (doc: DocumentoItem) => {
    const fullDoc = documentos.find(d => d.id === doc.id);
    if (fullDoc) {
      await deleteDocumento(fullDoc);
    }
  };

  const handleCreatePasta = async (data: { nome: string; tipo: string; pasta_pai_id: string | null }) => {
    await createPasta({
      nome: data.nome,
      tipo: data.tipo as 'custom' | 'ano' | 'mes' | 'categoria',
      pasta_pai_id: data.pasta_pai_id,
    });
  };

  const handleInitialize = async () => {
    try {
      await initializeDefaultStructure();
    } catch (error) {
      // Error handled in hook
    }
  };

  const showEmptyState = !loading && pastas.length === 0;

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-4">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">Documentos</h1>
          <p className="text-muted-foreground">Gestão hierárquica de arquivos e prontuários</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowCreatePasta(true)}>
            <FolderPlus className="w-4 h-4 mr-2" />
            Nova Pasta
          </Button>
          <Button className="gradient-primary shadow-glow" onClick={() => handleOpenUpload()}>
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
        </div>
        <div className="bg-muted/50 border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-muted">
            <FolderTree className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{pastas.length}</p>
            <p className="text-xs text-muted-foreground">Pastas</p>
          </div>
        </div>
        <div className="bg-warning/5 border border-warning/20 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-warning/10">
            <AlertCircle className="w-5 h-5 text-warning" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{stats.vencendo}</p>
            <p className="text-xs text-muted-foreground">Vencendo</p>
          </div>
        </div>
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-destructive/10">
            <AlertCircle className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{stats.vencidos}</p>
            <p className="text-xs text-muted-foreground">Vencidos</p>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <TabsList className="bg-muted/50">
            <TabsTrigger value="arvore" className="gap-2">
              <FolderTree className="w-4 h-4" />
              Estrutura
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-2">
              <History className="w-4 h-4" />
              Auditoria
            </TabsTrigger>
          </TabsList>
        </motion.div>

        {/* Tree View Tab */}
        <TabsContent value="arvore" className="flex-1 mt-4">
          {showEmptyState ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center h-full bg-card rounded-xl border border-border p-12"
            >
              <Building2 className="w-16 h-16 text-muted-foreground/50 mb-6" />
              <h3 className="text-xl font-semibold mb-2">Estrutura de Pastas</h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Crie uma estrutura organizacional para seus documentos com pastas por unidade, 
                colaborador e período. Ideal para compliance e processos judiciais.
              </p>
              <Button
                size="lg"
                onClick={handleInitialize}
                disabled={initializing}
                className="gradient-primary shadow-glow"
              >
                {initializing ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <FolderPlus className="w-5 h-5 mr-2" />
                )}
                Criar Estrutura Padrão
              </Button>
              <p className="text-xs text-muted-foreground mt-4">
                Serão criadas pastas: Administrativo, Unidades, Colaboradores e Anos
              </p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 h-full"
            >
              <ResizablePanelGroup direction="horizontal" className="h-full rounded-xl border border-border">
                {/* Tree Panel */}
                <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
                  <div className="h-full flex flex-col bg-card">
                    {/* Search */}
                    <div className="p-3 border-b border-border">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar pasta..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-9 h-9"
                        />
                      </div>
                    </div>
                    
                    {/* Tree */}
                    <ScrollArea className="flex-1 p-2">
                      {loading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                      ) : (
                        <PastaTreeView
                          tree={tree}
                          selectedPastaId={selectedPasta?.id || null}
                          onSelectPasta={setSelectedPasta}
                          onCreateSubfolder={handleCreateSubfolder}
                          onRenamePasta={handleRenamePasta}
                          onDeletePasta={handleDeletePasta}
                          onDropDocument={handleDropDocument}
                        />
                      )}
                    </ScrollArea>
                  </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Documents Panel */}
                <ResizablePanel defaultSize={70}>
                  <div className="h-full p-4 bg-background">
                    <PastaDocumentosList
                      pasta={selectedPasta}
                      onUpload={handleOpenUpload}
                      onDownload={handleDownload}
                      onDelete={handleDeleteDoc}
                      deleting={deleting}
                      onDragStart={handleDragStart}
                    />
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </motion.div>
          )}
        </TabsContent>

        {/* Audit Tab */}
        <TabsContent value="historico" className="flex-1 mt-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="h-full bg-card rounded-xl border border-border p-6 overflow-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                Trilha de Auditoria
              </h3>
              <Badge variant="outline">{auditLogs.length} registros</Badge>
            </div>
            <DocumentoAuditLog logs={auditLogs} loading={loadingAudit} />
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <DocumentoUploadForm
        open={showUploadForm}
        onOpenChange={setShowUploadForm}
        preSelectedColaboradorId={undefined}
      />

      <CreatePastaModal
        open={showCreatePasta}
        onOpenChange={setShowCreatePasta}
        parentPastaId={createPastaParentId}
        parentPastaNome={createPastaParentNome}
        onCreate={handleCreatePasta}
        creating={false}
      />

      {/* Delete Pasta Confirmation */}
      <AlertDialog open={!!pastaToDelete} onOpenChange={() => setPastaToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              Excluir Pasta
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta pasta? Todas as subpastas também serão excluídas.
              Os documentos não serão excluídos, apenas ficarão sem pasta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeletePasta}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Documentos;
