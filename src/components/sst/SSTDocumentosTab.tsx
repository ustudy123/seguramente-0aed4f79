import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  FileText, Loader2, Search, Eye, Trash2, Brain,
  CheckCircle2, AlertTriangle, Calendar, User, Building2,
  Download, ChevronRight
} from "lucide-react";
import { SSTDocumento, useSSTDocumentos } from "@/hooks/useSSTDocumentos";
import { SSTDocumentoRevisaoModal } from "./SSTDocumentoRevisaoModal";
import { SSTAnaliseIAModal } from "./SSTAnaliseIAModal";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function SSTDocumentosTab() {
  const { documentos, isLoading, deleteDocumento } = useSSTDocumentos();
  const [search, setSearch] = useState("");
  const [revisaoDoc, setRevisaoDoc] = useState<SSTDocumento | null>(null);
  const [analiseDoc, setAnaliseDoc] = useState<SSTDocumento | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [docToDelete, setDocToDelete] = useState<SSTDocumento | null>(null);

  const filtered = documentos.filter(d =>
    !search ||
    d.tipo.toLowerCase().includes(search.toLowerCase()) ||
    d.arquivo_nome?.toLowerCase().includes(search.toLowerCase()) ||
    d.empresa_emissora?.toLowerCase().includes(search.toLowerCase()) ||
    d.profissional_responsavel?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async () => {
    if (!docToDelete) return;
    setDeletingId(docToDelete.id);
    setDocToDelete(null);
    try {
      await deleteDocumento.mutateAsync(docToDelete);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (doc: SSTDocumento) => {
    if (!doc.arquivo_url) { toast.error("Arquivo não disponível"); return; }
    const { data } = await supabase.storage.from("documentos").createSignedUrl(doc.arquivo_url, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Não foi possível gerar o link de download");
  };

  const statusInfo = (doc: SSTDocumento) => {
    if (doc.data_vigencia) {
      const vig = new Date(doc.data_vigencia + "T12:00:00");
      const hoje = new Date();
      hoje.setHours(12, 0, 0, 0);
      const diff = Math.ceil((vig.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      if (diff < 0) return { label: "Vencido", variant: "destructive" as const, color: "text-destructive" };
      if (diff <= 60) return { label: `Vence em ${diff}d`, variant: "outline" as const, color: "text-amber-600" };
    }
    return { label: "Vigente", variant: "secondary" as const, color: "text-primary" };
  };

  return (
    <div className="space-y-4">
      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por tipo, arquivo, empresa ou responsável..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-14 text-center gap-3">
            <FileText className="w-12 h-12 text-muted-foreground/40" />
            <p className="font-medium text-foreground">
              {search ? "Nenhum documento encontrado" : "Nenhum documento importado ainda"}
            </p>
            <p className="text-sm text-muted-foreground max-w-xs">
              {search
                ? "Tente ajustar a busca"
                : "Use a aba Importação IA para importar seu primeiro documento SST"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((doc) => {
            const st = statusInfo(doc);
            const hasIA = !!doc.analise_ia;
            const score = hasIA ? (doc.analise_ia as any)?.score_qualidade?.geral : null;

            return (
              <Card key={doc.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Ícone */}
                    <div className={`p-2.5 rounded-xl flex-shrink-0 ${hasIA ? "bg-primary/10" : "bg-muted"}`}>
                      {hasIA
                        ? <Brain className="w-5 h-5 text-primary" />
                        : <FileText className="w-5 h-5 text-muted-foreground" />
                      }
                    </div>

                    {/* Info principal */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-foreground">{doc.tipo}</span>
                        <Badge variant={st.variant} className={`text-[11px] ${st.variant === "outline" ? "border-amber-400 " + st.color : ""}`}>
                          {st.label}
                        </Badge>
                        {hasIA && (
                          <Badge variant="outline" className="text-[11px] border-primary/40 text-primary bg-primary/5">
                            <Brain className="w-2.5 h-2.5 mr-1" />
                            IA extraída
                            {score !== null && <span className="ml-1 font-semibold">{score}%</span>}
                          </Badge>
                        )}
                      </div>

                      {/* Metadados */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {doc.arquivo_nome && (
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {doc.arquivo_nome}
                          </span>
                        )}
                        {doc.empresa_emissora && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {doc.empresa_emissora}
                          </span>
                        )}
                        {doc.profissional_responsavel && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {doc.profissional_responsavel}
                          </span>
                        )}
                        {doc.data_emissao && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Emissão: {format(new Date(doc.data_emissao + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        )}
                        {doc.data_vigencia && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Vigência: {format(new Date(doc.data_vigencia + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        )}
                      </div>

                      {/* Resumo rápido da IA */}
                      {hasIA && (
                        <div className="flex gap-3 mt-2 text-xs">
                          {(doc.analise_ia as any)?.inventario_riscos?.length > 0 && (
                            <span className="flex items-center gap-1 text-amber-600">
                              <AlertTriangle className="w-3 h-3" />
                              {(doc.analise_ia as any).inventario_riscos.length} riscos
                            </span>
                          )}
                          {(doc.analise_ia as any)?.plano_acao?.length > 0 && (
                            <span className="flex items-center gap-1 text-primary">
                              <CheckCircle2 className="w-3 h-3" />
                              {(doc.analise_ia as any).plano_acao.length} ações
                            </span>
                          )}
                          {(doc.analise_ia as any)?.responsaveis_tecnicos?.length > 0 && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <User className="w-3 h-3" />
                              {(doc.analise_ia as any).responsaveis_tecnicos.length} responsável(is)
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {hasIA && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1.5"
                          onClick={() => setRevisaoDoc(doc)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Revisar dados</span>
                          <ChevronRight className="w-3 h-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Análise IA narrativa"
                        onClick={() => setAnaliseDoc(doc)}
                      >
                        <Brain className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Baixar arquivo"
                        onClick={() => handleDownload(doc)}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        title="Excluir"
                        disabled={deletingId === doc.id}
                        onClick={() => setDocToDelete(doc)}
                      >
                        {deletingId === doc.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />
                        }
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modais */}
      <SSTDocumentoRevisaoModal
        open={!!revisaoDoc}
        onOpenChange={(open) => !open && setRevisaoDoc(null)}
        documento={revisaoDoc}
      />
      <SSTAnaliseIAModal
        open={!!analiseDoc}
        onOpenChange={(open) => !open && setAnaliseDoc(null)}
        documento={analiseDoc}
      />

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!docToDelete} onOpenChange={(open) => !open && setDocToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir o documento <strong>{docToDelete?.tipo}</strong>
              {docToDelete?.arquivo_nome ? ` — ${docToDelete.arquivo_nome}` : ""}. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
