import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Upload, FileText, Download, Paperclip, X, Check } from "lucide-react";
import { HubProcessoDocumento } from "@/hooks/useHubProcessos";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const TIPOS_DOCUMENTO = [
  { value: "ficha_registro", label: "Ficha de Registro" },
  { value: "contrato", label: "Contrato / Aditivo" },
  { value: "aviso_ferias", label: "Aviso de Férias" },
  { value: "recibo_ferias", label: "Recibo de Férias" },
  { value: "advertencia", label: "Advertência" },
  { value: "aviso_previo", label: "Aviso Prévio" },
  { value: "trct", label: "TRCT / Rescisão" },
  { value: "espelho_ponto", label: "Espelho de Ponto" },
  { value: "relatorio_folha", label: "Relatório de Folha" },
  { value: "holerite", label: "Holerite" },
  { value: "guia_comprovante", label: "Guia / Comprovante" },
  { value: "aso", label: "ASO / Atestado de Saúde" },
  { value: "documento_pessoal", label: "Documento Pessoal" },
  { value: "comprovante_residencia", label: "Comprovante de Residência" },
  { value: "outros", label: "Outros" },
];

interface Props {
  processoId: string;
  documentos: HubProcessoDocumento[];
  onRefresh: () => void;
}

export function HubDocumentosTab({ processoId, documentos, onRefresh }: Props) {
  const { user, profile } = useAuthContext();
  const tenantId = profile?.tenant_id;
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [tipoDoc, setTipoDoc] = useState("outros");
  const [nomeDoc, setNomeDoc] = useState("");
  const [requerAssinatura, setRequerAssinatura] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fileSelected, setFileSelected] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFileSelected(f);
      if (!nomeDoc) setNomeDoc(f.name.replace(/\.[^.]+$/, ""));
    }
  };

  const handleUpload = async () => {
    if (!fileSelected || !tenantId || !processoId) return;
    setUploading(true);
    try {
      // Upload ao storage
      const ext = fileSelected.name.split(".").pop();
      const path = `hub-processos/${tenantId}/${processoId}/${Date.now()}.${ext}`;
      const { error: storageErr } = await supabase.storage
        .from("documentos")
        .upload(path, fileSelected, { upsert: false });
      if (storageErr) { toast.error("Erro no upload: " + storageErr.message); return; }

      const { data: urlData } = supabase.storage.from("documentos").getPublicUrl(path);

      // Registrar documento
      const { error: dbErr } = await supabase.from("hub_processo_documentos").insert({
        tenant_id: tenantId,
        processo_id: processoId,
        tipo: tipoDoc as any,
        nome: nomeDoc || fileSelected.name,
        origem: "upload_manual",
        arquivo_url: urlData.publicUrl,
        arquivo_nome: fileSelected.name,
        arquivo_tamanho: fileSelected.size,
        versao: 1,
        status: "recebido",
        requer_assinatura: requerAssinatura,
        enviado_por: profile?.nome_completo || user?.email,
      } as any);
      if (dbErr) { toast.error(dbErr.message); return; }

      toast.success("Documento anexado com sucesso!");
      setFileSelected(null);
      setNomeDoc("");
      setTipoDoc("outros");
      setRequerAssinatura(false);
      setDialogOpen(false);
      if (fileRef.current) fileRef.current.value = "";
      onRefresh();
    } finally {
      setUploading(false);
    }
  };

  const docStatusColor: Record<string, string> = {
    pendente: "bg-amber-100 text-amber-800",
    recebido: "bg-blue-100 text-blue-800",
    aprovado: "bg-green-100 text-green-800",
    rejeitado: "bg-destructive/20 text-destructive",
  };

  return (
    <div className="space-y-3">
      {/* Botão de upload */}
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Paperclip className="w-4 h-4" /> Anexar Documento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Anexar Documento ao Dossiê</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-sm">Tipo do Documento *</Label>
                <Select value={tipoDoc} onValueChange={setTipoDoc}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_DOCUMENTO.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm">Nome / Descrição</Label>
                <Input
                  value={nomeDoc}
                  onChange={e => setNomeDoc(e.target.value)}
                  placeholder="Ex: Ficha de Registro — João Silva"
                  className="mt-1"
                />
              </div>

              {/* Drop zone */}
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xls,.xlsx" />
                {fileSelected ? (
                  <div className="flex items-center gap-2 justify-center text-sm">
                    <FileText className="w-5 h-5 text-primary" />
                    <span className="font-medium truncate max-w-[200px]">{fileSelected.name}</span>
                    <button onClick={e => { e.stopPropagation(); setFileSelected(null); if (fileRef.current) fileRef.current.value = ""; }}>
                      <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Clique para selecionar ou arraste o arquivo</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, Word, Excel, Imagens — até 50MB</p>
                  </>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={requerAssinatura}
                  onChange={e => setRequerAssinatura(e.target.checked)}
                  className="rounded"
                />
                Este documento requer assinatura
              </label>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1 gap-2"
                  disabled={!fileSelected || uploading}
                  onClick={handleUpload}
                >
                  <Upload className="w-4 h-4" />
                  {uploading ? "Enviando..." : "Anexar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de documentos */}
      {documentos.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum documento anexado</p>
          <p className="text-xs mt-1">Use o botão acima para anexar documentos ao dossiê</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documentos.map(doc => (
            <Card key={doc.id}>
              <CardContent className="py-3 px-4">
                <div className="flex items-start gap-3">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.nome}</p>
                    <div className="flex gap-2 text-xs text-muted-foreground flex-wrap mt-0.5">
                      <span>{TIPOS_DOCUMENTO.find(t => t.value === doc.tipo)?.label || doc.tipo}</span>
                      <span>v{doc.versao}</span>
                      <span className="capitalize">{doc.origem?.replace(/_/g, " ")}</span>
                      {doc.arquivo_tamanho && (
                        <span>{(doc.arquivo_tamanho / 1024).toFixed(0)} KB</span>
                      )}
                      <span className="text-muted-foreground/70">
                        {format(parseISO(doc.created_at), "dd/MM/yy", { locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge className={`text-xs ${docStatusColor[doc.status] || "bg-muted text-muted-foreground"}`}>
                        {doc.status}
                      </Badge>
                      {doc.requer_assinatura && (
                        <Badge className="text-xs bg-yellow-100 text-yellow-800 gap-1">
                          {doc.assinatura_status === "assinado" ? (
                            <><Check className="w-2.5 h-2.5" /> Assinado</>
                          ) : (
                            <>✍ Aguarda assinatura</>
                          )}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {doc.arquivo_url && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
                      <a href={doc.arquivo_url} target="_blank" rel="noopener noreferrer">
                        <Download className="w-4 h-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
