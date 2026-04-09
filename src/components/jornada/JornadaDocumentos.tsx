import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import { Upload, FileText, Download, Trash2, Plus, Calendar, Building } from "lucide-react";
import { format } from "date-fns";

interface Documento {
  id: string;
  nome: string;
  arquivo_url: string;
  arquivo_nome: string;
  arquivo_tamanho: number;
  tipo: string;
  vinculo_tipo: string | null;
  vinculo_valor: string | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  observacoes: string | null;
  enviado_por: string | null;
  created_at: string;
}

export function JornadaDocumentos() {
  const { tenantId } = useTenant();
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    nome: "",
    tipo: "espelho_ponto",
    vinculo_tipo: "empresa",
    vinculo_valor: "",
    periodo_inicio: "",
    periodo_fim: "",
    observacoes: "",
  });

  const fetchDocumentos = async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await supabase
      .from("jornada_documentos")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    setDocumentos((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchDocumentos(); }, [tenantId]);

  const onDrop = useCallback((files: File[]) => {
    if (files[0]) {
      setFile(files[0]);
      if (!form.nome) setForm(prev => ({ ...prev, nome: files[0].name.replace(/\.[^.]+$/, "") }));
    }
  }, [form.nome]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
  });

  const handleUpload = async () => {
    if (!file || !tenantId || !form.nome) {
      toast.error("Preencha o nome e selecione um arquivo");
      return;
    }
    setUploading(true);
    try {
      const path = `${tenantId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("jornada-documentos")
        .upload(path, file);
      if (uploadErr) throw uploadErr;

      const { error: insertErr } = await supabase
        .from("jornada_documentos")
        .insert({
          tenant_id: tenantId,
          nome: form.nome,
          arquivo_url: path,
          arquivo_nome: file.name,
          arquivo_tamanho: file.size,
          tipo: form.tipo,
          vinculo_tipo: form.vinculo_tipo || null,
          vinculo_valor: form.vinculo_valor || null,
          periodo_inicio: form.periodo_inicio || null,
          periodo_fim: form.periodo_fim || null,
          observacoes: form.observacoes || null,
        });
      if (insertErr) throw insertErr;

      toast.success("Documento enviado com sucesso");
      setDialogOpen(false);
      setFile(null);
      setForm({ nome: "", tipo: "espelho_ponto", vinculo_tipo: "empresa", vinculo_valor: "", periodo_inicio: "", periodo_fim: "", observacoes: "" });
      fetchDocumentos();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: Documento) => {
    const { data, error } = await supabase.storage
      .from("jornada-documentos")
      .createSignedUrl(doc.arquivo_url, 60);
    if (error) { toast.error("Erro ao gerar link"); return; }
    // Blob download to avoid browser blocks
    const response = await fetch(data.signedUrl);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.arquivo_nome;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (doc: Documento) => {
    const confirmed = await confirm({ title: "Excluir documento", description: "Excluir este documento?", confirmLabel: "Excluir" });
    if (!confirmed) return;
    await supabase.storage.from("jornada-documentos").remove([doc.arquivo_url]);
    await supabase.from("jornada_documentos").delete().eq("id", doc.id);
    toast.success("Documento excluído");
    fetchDocumentos();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const TIPOS = {
    espelho_ponto: "Espelho de Ponto",
    relatorio_jornada: "Relatório de Jornada",
    acordo_compensacao: "Acordo de Compensação",
    convencao_coletiva: "Convenção Coletiva",
    auditoria: "Relatório de Auditoria",
    outro: "Outro",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" /> Documentos de Apoio
          </h3>
          <p className="text-sm text-muted-foreground">
            PDFs de evidência vinculados a empresa, unidade ou período
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Enviar Documento</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Enviar Documento de Apoio (PDF)</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                {file ? (
                  <p className="text-sm font-medium">{file.name} ({formatSize(file.size)})</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Arraste um PDF ou clique para selecionar</p>
                )}
              </div>

              <div>
                <Label className="text-xs">Nome do documento *</Label>
                <Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} className="mt-1" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select value={form.tipo} onValueChange={v => setForm(p => ({ ...p, tipo: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TIPOS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Vínculo</Label>
                  <Select value={form.vinculo_tipo} onValueChange={v => setForm(p => ({ ...p, vinculo_tipo: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="empresa">Empresa</SelectItem>
                      <SelectItem value="unidade">Unidade</SelectItem>
                      <SelectItem value="setor">Setor</SelectItem>
                      <SelectItem value="periodo">Período</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs">Valor do vínculo (nome da empresa, unidade, etc.)</Label>
                <Input value={form.vinculo_valor} onChange={e => setForm(p => ({ ...p, vinculo_valor: e.target.value }))} className="mt-1" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Período início</Label>
                  <Input type="date" value={form.periodo_inicio} onChange={e => setForm(p => ({ ...p, periodo_inicio: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Período fim</Label>
                  <Input type="date" value={form.periodo_fim} onChange={e => setForm(p => ({ ...p, periodo_fim: e.target.value }))} className="mt-1" />
                </div>
              </div>

              <div>
                <Label className="text-xs">Observações</Label>
                <Textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} className="mt-1" rows={2} />
              </div>

              <Button onClick={handleUpload} disabled={uploading || !file} className="w-full">
                {uploading ? "Enviando..." : "Enviar Documento"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : documentos.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p>Nenhum documento de apoio cadastrado.</p>
            <p className="text-xs mt-1">Envie PDFs como evidência documental para auditorias e NR-1.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {documentos.map(doc => (
            <Card key={doc.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{doc.nome}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px]">
                        {TIPOS[doc.tipo as keyof typeof TIPOS] || doc.tipo}
                      </Badge>
                      {doc.vinculo_valor && (
                        <Badge variant="secondary" className="text-[10px]">
                          <Building className="h-3 w-3 mr-1" />
                          {doc.vinculo_valor}
                        </Badge>
                      )}
                      {doc.periodo_inicio && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {doc.periodo_inicio} — {doc.periodo_fim || "..."}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">{formatSize(doc.arquivo_tamanho)}</span>
                    </div>
                    {doc.observacoes && <p className="text-xs text-muted-foreground mt-1 truncate">{doc.observacoes}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(doc)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(doc)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
