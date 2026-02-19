import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, ShieldCheck, Download, Upload, Loader2 } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";

interface Props { hub: any; }

const tipoLabels: Record<string, string> = {
  receita_federal: "Receita Federal", fgts: "FGTS (CRF)", cndt: "CNDT",
  estadual: "Estadual", municipal: "Municipal", previdenciaria: "Previdenciária", outro: "Outro",
};

const statusConfig: Record<string, { color: string; label: string }> = {
  valida: { color: "bg-green-100 text-green-800", label: "Válida" },
  a_vencer: { color: "bg-amber-100 text-amber-800", label: "A Vencer" },
  vencida: { color: "bg-red-100 text-red-800", label: "Vencida" },
  irregular: { color: "bg-red-200 text-red-900", label: "Irregular" },
};

export function HubCertidoes({ hub }: Props) {
  const { certidoes, criarCertidao, loading } = hub;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ tipo: "", orgao_emissor: "", numero: "", data_emissao: "", data_validade: "" });

  const onDrop = useCallback((files: File[]) => { if (files.length) setFile(files[0]); }, []);
  const { getRootProps, getInputProps } = useDropzone({ onDrop, maxFiles: 1, maxSize: 10 * 1024 * 1024 });

  const handleSubmit = async () => {
    if (!form.tipo || !form.orgao_emissor || !form.data_emissao || !form.data_validade) return;
    setUploading(true);
    try {
      let arquivo_url = null;
      let arquivo_nome = null;
      if (file) {
        const path = `certidoes/${form.tipo}/${Date.now()}_${file.name}`;
        const { error } = await supabase.storage.from("hub-contabil").upload(path, file);
        if (error) { toast.error("Erro no upload: " + error.message); return; }
        arquivo_url = path;
        arquivo_nome = file.name;
      }
      await criarCertidao({ ...form, arquivo_url, arquivo_nome });
      setForm({ tipo: "", orgao_emissor: "", numero: "", data_emissao: "", data_validade: "" });
      setFile(null);
      setDialogOpen(false);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (cert: any) => {
    if (!cert.arquivo_url) return;
    const { data, error } = await supabase.storage.from("hub-contabil").createSignedUrl(cert.arquivo_url, 60);
    if (error || !data?.signedUrl) { toast.error("Erro ao gerar link"); return; }
    const res = await fetch(data.signedUrl);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = cert.arquivo_nome || "certidao";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex items-center justify-center py-16 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Certidões (CNDs)</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Nova Certidão</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar Certidão</DialogTitle></DialogHeader>
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
                <Label>Órgão Emissor *</Label>
                <Input value={form.orgao_emissor} onChange={(e) => setForm({ ...form, orgao_emissor: e.target.value })} placeholder="Ex: Receita Federal do Brasil" />
              </div>
              <div>
                <Label>Número</Label>
                <Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data Emissão *</Label>
                  <Input type="date" value={form.data_emissao} onChange={(e) => setForm({ ...form, data_emissao: e.target.value })} />
                </div>
                <div>
                  <Label>Data Validade *</Label>
                  <Input type="date" value={form.data_validade} onChange={(e) => setForm({ ...form, data_validade: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Documento (PDF)</Label>
                <div {...getRootProps()} className="border-2 border-dashed rounded-lg p-3 text-center cursor-pointer hover:border-primary/50">
                  <input {...getInputProps()} />
                  {file ? (
                    <p className="text-sm">{file.name}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground"><Upload className="w-4 h-4 inline mr-1" /> Anexar certidão</p>
                  )}
                </div>
              </div>
              <Button onClick={handleSubmit} className="w-full" disabled={!form.tipo || !form.orgao_emissor || !form.data_emissao || !form.data_validade || uploading}>
                {uploading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Enviando...</> : "Registrar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {certidoes.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhuma certidão registrada.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {certidoes.map((cert: any) => {
            const dias = differenceInDays(parseISO(cert.data_validade), new Date());
            const cfg = statusConfig[cert.status] || statusConfig.valida;
            return (
              <Card key={cert.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className={`w-4 h-4 ${cert.status === "valida" ? "text-green-500" : cert.status === "a_vencer" ? "text-amber-500" : "text-red-500"}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{tipoLabels[cert.tipo] || cert.tipo}</span>
                        <Badge className={cfg.color}>{cfg.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {cert.orgao_emissor} {cert.numero && `• Nº ${cert.numero}`} • Válida até {format(parseISO(cert.data_validade), "dd/MM/yyyy")}
                        {dias > 0 && dias <= 30 && <span className="text-amber-600 ml-1">({dias}d restantes)</span>}
                        {cert.arquivo_nome && ` • 📎 ${cert.arquivo_nome}`}
                      </p>
                    </div>
                  </div>
                  {cert.arquivo_url && (
                    <Button size="sm" variant="ghost" onClick={() => handleDownload(cert)} title="Baixar certidão">
                      <Download className="w-4 h-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
