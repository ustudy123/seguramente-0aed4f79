import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, ArrowDown, ArrowUp, Upload, Download, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";

interface Props { hub: any; }

const tipoLabels: Record<string, string> = {
  holerite: "Holerite", relatorio_folha: "Relatório Folha", darf: "DARF", fgts: "FGTS",
  grrf: "GRRF", comprovante: "Comprovante", calculo_rescisorio: "Cálculo Rescisório",
  recibo_ferias: "Recibo Férias", declaracao_acessoria: "Declaração Acessória", outro: "Outro",
};

export function HubDocumentos({ hub }: Props) {
  const { documentos, criarDocumento, loading } = hub;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ tipo: "", competencia: "", direcao: "enviado", descricao: "", colaborador_nome: "", observacoes: "" });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) setFile(acceptedFiles[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    accept: { "application/pdf": [".pdf"], "image/*": [".png", ".jpg", ".jpeg"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"], "text/csv": [".csv"] },
  });

  const handleSubmit = async () => {
    if (!form.tipo || !form.competencia) return;
    setUploading(true);
    try {
      let arquivo_url = null;
      let arquivo_nome = null;
      let arquivo_tamanho = null;

      if (file) {
        const path = `documentos/${form.competencia}/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from("hub-contabil").upload(path, file);
        if (upErr) { toast.error("Erro no upload: " + upErr.message); return; }
        arquivo_url = path;
        arquivo_nome = file.name;
        arquivo_tamanho = file.size;
      }

      await criarDocumento({ ...form, arquivo_url, arquivo_nome, arquivo_tamanho });
      setForm({ tipo: "", competencia: "", direcao: "enviado", descricao: "", colaborador_nome: "", observacoes: "" });
      setFile(null);
      setDialogOpen(false);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: any) => {
    if (!doc.arquivo_url) return;
    const { data, error } = await supabase.storage.from("hub-contabil").createSignedUrl(doc.arquivo_url, 60);
    if (error || !data?.signedUrl) { toast.error("Erro ao gerar link"); return; }
    const res = await fetch(data.signedUrl);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.arquivo_nome || "documento";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex items-center justify-center py-16 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Documentos Contábeis</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Novo Documento</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar Documento</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Tipo *</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(tipoLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Competência *</Label>
                <Input type="month" value={form.competencia} onChange={(e) => setForm({ ...form, competencia: e.target.value })} />
              </div>
              <div>
                <Label>Direção</Label>
                <Select value={form.direcao} onValueChange={(v) => setForm({ ...form, direcao: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enviado">Enviado (RH → Contabilidade)</SelectItem>
                    <SelectItem value="recebido">Recebido (Contabilidade → RH)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Colaborador (opcional)</Label>
                <Input value={form.colaborador_nome} onChange={(e) => setForm({ ...form, colaborador_nome: e.target.value })} placeholder="Nome do colaborador" />
              </div>
              <div>
                <Label>Arquivo</Label>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                >
                  <input {...getInputProps()} />
                  {file ? (
                    <p className="text-sm text-foreground">{file.name} ({(file.size / 1024).toFixed(0)} KB)</p>
                  ) : (
                    <div className="space-y-1">
                      <Upload className="w-6 h-6 mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Arraste ou clique para enviar</p>
                      <p className="text-xs text-muted-foreground">PDF, imagens, Excel (máx 10MB)</p>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Detalhes do documento" />
              </div>
              <Button onClick={handleSubmit} className="w-full" disabled={!form.tipo || !form.competencia || uploading}>
                {uploading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Enviando...</> : "Registrar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {documentos.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhum documento registrado.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {documentos.map((doc: any) => (
            <Card key={doc.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {doc.direcao === "enviado" ? <ArrowUp className="w-4 h-4 text-blue-500" /> : <ArrowDown className="w-4 h-4 text-green-500" />}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{tipoLabels[doc.tipo] || doc.tipo}</span>
                      <Badge variant="outline" className="text-xs">{doc.competencia}</Badge>
                      {doc.versao > 1 && <Badge variant="secondary" className="text-xs">v{doc.versao}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {doc.direcao === "enviado" ? "Enviado" : "Recebido"} por {doc.enviado_por || "—"} • {format(parseISO(doc.created_at), "dd/MM/yyyy HH:mm")}
                      {doc.colaborador_nome && ` • ${doc.colaborador_nome}`}
                      {doc.arquivo_nome && ` • 📎 ${doc.arquivo_nome}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {doc.arquivo_url && (
                    <Button size="sm" variant="ghost" onClick={() => handleDownload(doc)} title="Baixar arquivo">
                      <Download className="w-4 h-4" />
                    </Button>
                  )}
                  <Badge className={doc.status === "ativo" ? "bg-green-100 text-green-800" : doc.status === "substituido" ? "bg-gray-100 text-gray-600" : "bg-red-100 text-red-800"}>
                    {doc.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
