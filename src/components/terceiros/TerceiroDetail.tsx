import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft, Users, FileText, Plus, Trash2, AlertTriangle, CheckCircle, Clock, XCircle,
  GraduationCap, Eye, Download, ExternalLink, Loader2,
} from "lucide-react";
import type { Terceiro, TerceiroDocumento, TerceiroTrabalhador, TerceiroTreinamento } from "@/types/terceiros";
import { useTerceiros } from "@/hooks/useTerceiros";
import { TrabalhadorForm } from "./TrabalhadorForm";
import { DocumentoUploadForm } from "./DocumentoUploadForm";
import { TreinamentoForm } from "./TreinamentoForm";
import { format } from "date-fns";
import { formatCnpj } from "@/lib/brasilapi";
import { formatCpf } from "@/lib/cpf";
import { toast } from "sonner";

const statusIcon = (s: string) => {
  switch (s) {
    case "valido": return <CheckCircle className="w-4 h-4 text-green-500" />;
    case "a_vencer": return <Clock className="w-4 h-4 text-yellow-500" />;
    case "vencido": return <XCircle className="w-4 h-4 text-destructive" />;
    default: return <AlertTriangle className="w-4 h-4 text-muted-foreground" />;
  }
};

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    liberado: "bg-green-100 text-green-800",
    restrito: "bg-yellow-100 text-yellow-800",
    bloqueado: "bg-red-100 text-red-800",
  };
  return <Badge className={map[s] || ""}>{s}</Badge>;
};

interface Props {
  terceiro: Terceiro;
  onBack: () => void;
}

export function TerceiroDetail({ terceiro, onBack }: Props) {
  const {
    useTrabalhadores, createTrabalhador, deleteTrabalhador,
    useDocumentos, uploadDocumento, deleteDocumento,
    useTreinamentos, createTreinamento, deleteTreinamento,
    getDownloadUrl,
  } = useTerceiros();

  const { data: trabalhadores = [] } = useTrabalhadores(terceiro.id);
  const { data: docsEmpresa = [] } = useDocumentos(terceiro.id);

  const [showTrabForm, setShowTrabForm] = useState(false);
  const [showDocForm, setShowDocForm] = useState(false);
  const [selectedTrab, setSelectedTrab] = useState<TerceiroTrabalhador | null>(null);
  const [showTrabDocForm, setShowTrabDocForm] = useState(false);
  const [showTreinForm, setShowTreinForm] = useState(false);
  const [viewer, setViewer] = useState<{ url: string; nome: string; tipo: string } | null>(null);
  const [loadingView, setLoadingView] = useState(false);

  useEffect(() => {
    return () => {
      if (viewer?.url?.startsWith("blob:")) {
        URL.revokeObjectURL(viewer.url);
      }
    };
  }, [viewer]);

  const handleViewFile = async (path: string, nome = "Documento") => {
    try {
      setLoadingView(true);
      const url = await getDownloadUrl(path);
      if (url) {
        const ext = (path.split(".").pop() || "").toLowerCase();
        const tipo = ["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(ext)
          ? "image"
          : ext === "pdf"
          ? "pdf"
          : "other";
        if (viewer?.url?.startsWith("blob:")) {
          URL.revokeObjectURL(viewer.url);
        }
        setViewer({ url, nome, tipo });
      }
    } catch (error) {
      console.error("Erro ao abrir arquivo:", error);
      toast.error("Não foi possível abrir o arquivo.");
    } finally {
      setLoadingView(false);
    }
  };

  const isCpf = terceiro.cnpj?.length === 11;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold">{terceiro.razao_social}</h2>
          <p className="text-sm text-muted-foreground">{isCpf ? 'CPF' : 'CNPJ'}: {isCpf ? formatCpf(terceiro.cnpj) : formatCnpj(terceiro.cnpj)}</p>
        </div>
        {statusBadge(terceiro.status)}
        {terceiro.atividade_risco && (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="w-3 h-3" /> Atividade de Risco
          </Badge>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{trabalhadores.length}</p>
            <p className="text-xs text-muted-foreground">Trabalhadores</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{docsEmpresa.length}</p>
            <p className="text-xs text-muted-foreground">Documentos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">
              {docsEmpresa.filter((d) => d.status === "a_vencer").length}
            </p>
            <p className="text-xs text-muted-foreground">A Vencer</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-destructive">
              {docsEmpresa.filter((d) => d.status === "vencido").length}
            </p>
            <p className="text-xs text-muted-foreground">Vencidos</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="trabalhadores">
        <TabsList>
          <TabsTrigger value="trabalhadores"><Users className="w-4 h-4 mr-1" /> Trabalhadores</TabsTrigger>
          <TabsTrigger value="documentos"><FileText className="w-4 h-4 mr-1" /> Documentos da Empresa</TabsTrigger>
        </TabsList>

        {/* ── Trabalhadores ── */}
        <TabsContent value="trabalhadores" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowTrabForm(true)}>
              <Plus className="w-4 h-4 mr-1" /> Novo Trabalhador
            </Button>
          </div>
          {trabalhadores.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum trabalhador cadastrado.</p>
          ) : (
            <div className="space-y-3">
              {trabalhadores.map((t) => (
                <TrabalhadorCard
                  key={t.id}
                  trabalhador={t}
                  terceiroId={terceiro.id}
                  onDelete={() => deleteTrabalhador.mutate(t.id)}
                  onUploadDoc={() => { setSelectedTrab(t); setShowTrabDocForm(true); }}
                  onAddTrein={() => { setSelectedTrab(t); setShowTreinForm(true); }}
                  onViewDoc={handleViewFile}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Documentos Empresa ── */}
        <TabsContent value="documentos" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowDocForm(true)}>
              <Plus className="w-4 h-4 mr-1" /> Upload Documento
            </Button>
          </div>
          <DocumentosTable 
            docs={docsEmpresa} 
            onDelete={(d) => deleteDocumento.mutate(d)} 
            onView={(d) => d.arquivo_url && handleViewFile(d.arquivo_url, d.nome || d.tipo)}
          />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <TrabalhadorForm
        open={showTrabForm}
        onOpenChange={setShowTrabForm}
        terceiroId={terceiro.id}
        onSubmit={async (data) => { await createTrabalhador.mutateAsync(data); }}
        isPending={createTrabalhador.isPending}
      />
      <DocumentoUploadForm
        open={showDocForm}
        onOpenChange={setShowDocForm}
        terceiroId={terceiro.id}
        onSubmit={async (p) => { await uploadDocumento.mutateAsync(p); }}
        isPending={uploadDocumento.isPending}
      />
      {selectedTrab && (
        <>
          <DocumentoUploadForm
            open={showTrabDocForm}
            onOpenChange={setShowTrabDocForm}
            terceiroId={terceiro.id}
            trabalhadorId={selectedTrab.id}
            onSubmit={async (p) => { await uploadDocumento.mutateAsync(p); }}
            isPending={uploadDocumento.isPending}
          />
          <TreinamentoForm
            open={showTreinForm}
            onOpenChange={setShowTreinForm}
            terceiroId={terceiro.id}
            trabalhadorId={selectedTrab.id}
            onSubmit={async (p) => { await createTreinamento.mutateAsync(p); }}
            isPending={createTreinamento.isPending}
          />
        </>
      )}

      {/* Visualizador de Documentos In-App */}
      <Dialog open={!!viewer} onOpenChange={(o) => {
        if (!o) {
          if (viewer?.url?.startsWith("blob:")) {
            URL.revokeObjectURL(viewer.url);
          }
          setViewer(null);
        }
      }}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-4 border-b flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-base truncate pr-4">{viewer?.nome}</DialogTitle>
            {viewer && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => window.open(viewer.url, "_blank")}>
                  <ExternalLink className="w-4 h-4 mr-1" /> Nova aba
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={viewer.url} download={viewer.nome}>
                    <Download className="w-4 h-4 mr-1" /> Baixar
                  </a>
                </Button>
              </div>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-hidden bg-muted/30">
            {viewer?.tipo === "image" ? (
              <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
                <img src={viewer.url} alt={viewer.nome} className="max-w-full max-h-full object-contain" />
              </div>
            ) : viewer?.tipo === "pdf" ? (
              <iframe src={viewer.url} title={viewer.nome} className="w-full h-full border-0" />
            ) : viewer ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 gap-3">
                <FileText className="w-12 h-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Pré-visualização não suportada para este formato. Use os botões acima para baixar ou abrir em nova aba.
                </p>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {loadingView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/50 pointer-events-none">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──

function TrabalhadorCard({
  trabalhador: t,
  terceiroId,
  onDelete,
  onUploadDoc,
  onAddTrein,
  onViewDoc,
}: {
  trabalhador: TerceiroTrabalhador;
  terceiroId: string;
  onDelete: () => void;
  onUploadDoc: () => void;
  onAddTrein: () => void;
  onViewDoc: (path: string, nome?: string) => void;
}) {
  const { useDocumentos, useTreinamentos, deleteDocumento, deleteTreinamento } = useTerceiros();
  const { data: docs = [] } = useDocumentos(terceiroId, t.id);
  const { data: treins = [] } = useTreinamentos(t.id);
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">{t.nome}</CardTitle>
            {statusBadge(t.status)}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{t.funcao}</span>
            {t.atividades_risco && t.atividades_risco.length > 0 && (
              <Badge variant="destructive" className="text-xs gap-1">
                <AlertTriangle className="w-3 h-3" /> Risco
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-4">
          {t.atividades_risco && t.atividades_risco.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {t.atividades_risco.map((a) => (
                <Badge key={a} variant="outline" className="text-xs">{a}</Badge>
              ))}
            </div>
          )}

          {/* Docs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium flex items-center gap-1"><FileText className="w-4 h-4" /> Documentos</h4>
              <Button size="sm" variant="outline" onClick={onUploadDoc}><Plus className="w-3 h-3 mr-1" /> Doc</Button>
            </div>
            {docs.length > 0 ? (
              <DocumentosTable 
                docs={docs} 
                onDelete={(d) => deleteDocumento.mutate(d)} 
                compact 
                onView={(d) => d.arquivo_url && onViewDoc(d.arquivo_url, d.nome || d.tipo)}
              />
            ) : (
              <p className="text-xs text-muted-foreground">Nenhum documento.</p>
            )}
          </div>

          {/* Treinamentos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium flex items-center gap-1"><GraduationCap className="w-4 h-4" /> Treinamentos</h4>
              <Button size="sm" variant="outline" onClick={onAddTrein}><Plus className="w-3 h-3 mr-1" /> Treinamento</Button>
            </div>
            {treins.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Realização</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {treins.map((tr) => (
                    <TableRow key={tr.id}>
                      <TableCell className="text-sm">{tr.tipo}</TableCell>
                      <TableCell className="text-sm">{tr.data_realizacao ? format(new Date(tr.data_realizacao), "dd/MM/yyyy") : "—"}</TableCell>
                      <TableCell className="text-sm">{tr.data_validade ? format(new Date(tr.data_validade), "dd/MM/yyyy") : "—"}</TableCell>
                      <TableCell>{statusIcon(tr.status)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => deleteTreinamento.mutate(tr)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhum treinamento.</p>
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="ghost" size="sm" className="text-destructive" onClick={onDelete}>
              <Trash2 className="w-4 h-4 mr-1" /> Remover Trabalhador
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function DocumentosTable({ 
  docs, 
  onDelete, 
  compact,
  onView,
}: { 
  docs: TerceiroDocumento[]; 
  onDelete: (d: TerceiroDocumento) => void; 
  compact?: boolean;
  onView?: (d: TerceiroDocumento) => void;
}) {
  if (docs.length === 0) return <p className="text-center text-muted-foreground py-4">Nenhum documento.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tipo</TableHead>
          {!compact && <TableHead>Nome</TableHead>}
          <TableHead>Emissão</TableHead>
          <TableHead>Validade</TableHead>
          <TableHead>Status</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {docs.map((d) => (
          <TableRow key={d.id}>
            <TableCell className="text-sm font-medium">{d.tipo}</TableCell>
            {!compact && <TableCell className="text-sm">{d.nome}</TableCell>}
            <TableCell className="text-sm">{d.data_emissao ? format(new Date(d.data_emissao), "dd/MM/yyyy") : "—"}</TableCell>
            <TableCell className="text-sm">{d.data_validade ? format(new Date(d.data_validade), "dd/MM/yyyy") : "—"}</TableCell>
            <TableCell>{statusIcon(d.status)}</TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1">
                {d.arquivo_url && (
                  <Button variant="ghost" size="icon" onClick={() => onView?.(d)} title="Visualizar">
                    <Eye className="w-4 h-4 text-primary" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => onDelete(d)} title="Remover">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
