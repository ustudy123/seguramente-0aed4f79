import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, FileText, X, ExternalLink, Plus } from "lucide-react";
import { useTrilhaModulos } from "@/hooks/useTrilhas";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { TrilhaModulo, TrilhaModuloTipo, TrilhaOrdemTipo, TrilhaModuloConteudo } from "@/types/trilha";
import { MODULO_TIPO_LABELS } from "@/types/trilha";
import { ConteudoEditorItem } from "./ConteudoEditorItem";

interface ModuloFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trilhaId: string;
  modulo?: TrilhaModulo | null;
  nextOrdem?: number;
  onSuccess?: () => void;
}

const defaultForm = {
  titulo: "",
  descricao: "",
  objetivo: "",
  tipo: "video" as TrilhaModuloTipo,
  conteudo_url: "",
  conteudo_texto: "",
  conteudos: [] as TrilhaModuloConteudo[],
  tempo_estimado_min: 10,
  pontuacao: 10,
  ordem_tipo: "sequencial" as TrilhaOrdemTipo,
  evidencia_obrigatoria: false,
  competencia_relacionada: "",
};

export function ModuloForm({ open, onOpenChange, trilhaId, modulo, nextOrdem = 0, onSuccess }: ModuloFormProps) {
  const { criarModulo, atualizarModulo, criando } = useTrilhaModulos(trilhaId);
  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    if (modulo) {
      setForm({
        titulo: modulo.titulo,
        descricao: modulo.descricao || "",
        objetivo: modulo.objetivo || "",
        tipo: modulo.tipo,
        conteudo_url: modulo.conteudo_url || "",
        conteudo_texto: modulo.conteudo_texto || "",
        conteudos: Array.isArray(modulo.conteudos) ? modulo.conteudos : [],
        tempo_estimado_min: modulo.tempo_estimado_min,
        pontuacao: modulo.pontuacao,
        ordem_tipo: modulo.ordem_tipo,
        evidencia_obrigatoria: modulo.evidencia_obrigatoria,
        competencia_relacionada: modulo.competencia_relacionada || "",
      });
    } else {
      setForm(defaultForm);
    }
  }, [modulo, open]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const [uploading, setUploading] = useState(false);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);

  // Campo de conteúdo conforme o tipo selecionado
  const isVideo = form.tipo === "video";
  const isLink = form.tipo === "link";
  const isFile = form.tipo === "pdf" || form.tipo === "apresentacao"; // upload + URL alternativa
  const isQuiz = form.tipo === "quiz";
  const needsText = ["conteudo_interno", "atividade_pratica", "checklist", "reflexao", "estudo_caso", "microdesafio"].includes(form.tipo);

  const textLabel =
    form.tipo === "checklist" ? "Itens do checklist" :
    form.tipo === "atividade_pratica" ? "Instruções da atividade" :
    form.tipo === "estudo_caso" ? "Descrição do caso" :
    form.tipo === "reflexao" ? "Pergunta / tema de reflexão" :
    form.tipo === "microdesafio" ? "Descrição do microdesafio" :
    "Conteúdo";
  const textPlaceholder =
    form.tipo === "checklist" ? "Um item por linha..." :
    form.tipo === "atividade_pratica" ? "Descreva o que o colaborador deve fazer..." :
    "Escreva o conteúdo aqui...";

  const doUpload = async (file: File, expect: "pdf" | "apresentacao"): Promise<string | null> => {
    const pptTypes = [
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ];
    if (expect === "pdf" && file.type !== "application/pdf") {
      toast.error("Selecione um arquivo PDF.");
      return null;
    }
    if (expect === "apresentacao"
        && file.type !== "application/pdf"
        && !pptTypes.includes(file.type)
        && !file.type.startsWith("image/")) {
      toast.error("Formato não suportado. Use PDF ou PowerPoint.");
      return null;
    }
    if (file.size > 52428800) {
      toast.error("Arquivo muito grande (máx. 50 MB).");
      return null;
    }
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
      const path = `${trilhaId}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage
        .from("trilha-conteudo")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("trilha-conteudo").getPublicUrl(path);
      toast.success("Arquivo enviado.");
      return data.publicUrl;
    } catch (e: any) {
      toast.error(e?.message || "Falha ao enviar o arquivo.");
      return null;
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    const url = await doUpload(file, form.tipo as "pdf" | "apresentacao");
    if (url) set("conteudo_url", url);
    setUploading(false);
  };

  // Conteúdos adicionais (lista)
  const addConteudo = () =>
    setForm((p) => ({ ...p, conteudos: [...p.conteudos, { id: crypto.randomUUID(), tipo: "video" }] }));
  const updateConteudo = (id: string, patch: Partial<TrilhaModuloConteudo>) =>
    setForm((p) => ({ ...p, conteudos: p.conteudos.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const removeConteudo = (id: string) =>
    setForm((p) => ({ ...p, conteudos: p.conteudos.filter((c) => c.id !== id) }));
  const handleItemUpload = async (id: string, file: File, tipo: "pdf" | "apresentacao") => {
    setUploadingItemId(id);
    const url = await doUpload(file, tipo);
    if (url) updateConteudo(id, { url });
    setUploadingItemId(null);
  };

  const handleSubmit = async () => {
    if (!form.titulo.trim()) return;
    try {
      const payload = {
        titulo: form.titulo,
        descricao: form.descricao || null,
        objetivo: form.objetivo || null,
        tipo: form.tipo as never,
        conteudo_url: form.conteudo_url || null,
        conteudo_texto: form.conteudo_texto || null,
        conteudos: form.conteudos.filter((c) => (c.url && c.url.trim()) || (c.texto && c.texto.trim())) as never,
        tempo_estimado_min: form.tempo_estimado_min,
        pontuacao: form.pontuacao,
        ordem_tipo: form.ordem_tipo as never,
        evidencia_obrigatoria: form.evidencia_obrigatoria,
        competencia_relacionada: form.competencia_relacionada || null,
      };

      if (modulo) {
        await atualizarModulo({ id: modulo.id, ...payload } as any);
      } else {
        await criarModulo({ ...payload, ordem: nextOrdem } as any);
      }
      onOpenChange(false);
      onSuccess?.();
    } catch {}
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{modulo ? "Editar Módulo" : "Novo Módulo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Título *</Label>
            <Input value={form.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Ex: Introdução à Gestão de Tempo" />
          </div>
          <div>
            <Label>Tipo de conteúdo</Label>
            <Select value={form.tipo} onValueChange={(v) => set("tipo", v as TrilhaModuloTipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(MODULO_TIPO_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)} rows={2} placeholder="Breve descrição..." />
          </div>
          <div>
            <Label>Objetivo do módulo</Label>
            <Input value={form.objetivo} onChange={(e) => set("objetivo", e.target.value)} placeholder="O que o colaborador deve aprender?" />
          </div>

          {isVideo && (
            <div>
              <Label>Link do vídeo</Label>
              <Input value={form.conteudo_url} onChange={(e) => set("conteudo_url", e.target.value)} placeholder="https://youtu.be/... ou https://vimeo.com/..." />
              <p className="text-xs text-muted-foreground mt-1">Cole o link de compartilhar do YouTube/Vimeo — o vídeo é embutido automaticamente.</p>
            </div>
          )}

          {isLink && (
            <div>
              <Label>URL do link externo</Label>
              <Input value={form.conteudo_url} onChange={(e) => set("conteudo_url", e.target.value)} placeholder="https://..." />
            </div>
          )}

          {isFile && (
            <div className="space-y-2">
              <Label>{form.tipo === "pdf" ? "Arquivo PDF" : "Arquivo da apresentação"}</Label>
              {form.conteudo_url ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <a href={form.conteudo_url} target="_blank" rel="noopener noreferrer" className="truncate flex-1 text-primary hover:underline">
                    {decodeURIComponent(form.conteudo_url.split("/").pop() || form.conteudo_url)}
                  </a>
                  <button type="button" onClick={() => set("conteudo_url", "")} className="text-muted-foreground hover:text-destructive" title="Remover">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground cursor-pointer hover:bg-muted/40 transition-colors">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? "Enviando..." : `Enviar ${form.tipo === "pdf" ? "PDF" : "arquivo"} (até 50 MB)`}
                  <input
                    type="file"
                    className="hidden"
                    accept={form.tipo === "pdf" ? "application/pdf" : "application/pdf,.ppt,.pptx,image/*"}
                    disabled={uploading}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
                  />
                </label>
              )}
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[11px] text-muted-foreground">ou cole um link</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <Input value={form.conteudo_url} onChange={(e) => set("conteudo_url", e.target.value)} placeholder="https://... (Google Slides, Drive, etc.)" />
            </div>
          )}

          {isQuiz && (
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              <ExternalLink className="w-4 h-4 mt-0.5 shrink-0" />
              <span>As perguntas do quiz são configuradas após criar o módulo, na tela da trilha.</span>
            </div>
          )}

          {needsText && (
            <div>
              <Label>{textLabel}</Label>
              <Textarea value={form.conteudo_texto} onChange={(e) => set("conteudo_texto", e.target.value)} rows={4} placeholder={textPlaceholder} />
            </div>
          )}

          {/* Conteúdos adicionais (o módulo pode ter vários) */}
          <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Conteúdos adicionais</Label>
              <Button type="button" variant="ghost" size="sm" onClick={addConteudo} className="h-7 text-primary">
                <Plus className="w-4 h-4 mr-1" /> Adicionar conteúdo
              </Button>
            </div>
            {form.conteudos.length === 0 ? (
              <p className="text-xs text-muted-foreground">Anexe vídeos, PDFs, apresentações ou links extras a este módulo.</p>
            ) : (
              <div className="space-y-2">
                {form.conteudos.map((c, i) => (
                  <ConteudoEditorItem
                    key={c.id}
                    item={c}
                    index={i}
                    uploading={uploadingItemId === c.id}
                    onChange={(patch) => updateConteudo(c.id, patch)}
                    onRemove={() => removeConteudo(c.id)}
                    onUpload={(file, tipo) => handleItemUpload(c.id, file, tipo)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tempo estimado (min)</Label>
              <Input type="number" value={form.tempo_estimado_min} onChange={(e) => set("tempo_estimado_min", Number(e.target.value))} />
            </div>
            <div>
              <Label>Pontuação</Label>
              <Input type="number" value={form.pontuacao} onChange={(e) => set("pontuacao", Number(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Ordem</Label>
              <Select value={form.ordem_tipo} onValueChange={(v) => set("ordem_tipo", v as TrilhaOrdemTipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sequencial">Sequencial</SelectItem>
                  <SelectItem value="livre">Livre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Competência relacionada</Label>
              <Input value={form.competencia_relacionada} onChange={(e) => set("competencia_relacionada", e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label>Evidência obrigatória</Label>
            <Switch checked={form.evidencia_obrigatoria} onCheckedChange={(v) => set("evidencia_obrigatoria", v)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.titulo.trim() || criando || uploading || uploadingItemId !== null}>
              {criando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {modulo ? "Salvar" : "Adicionar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
