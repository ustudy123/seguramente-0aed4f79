import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, FileText, X, GripVertical } from "lucide-react";
import type { TrilhaConteudoTipo, TrilhaModuloConteudo } from "@/types/trilha";

const CONTEUDO_TIPO_LABELS: Record<TrilhaConteudoTipo, string> = {
  video: "Vídeo",
  pdf: "PDF",
  apresentacao: "Apresentação",
  link: "Link",
  texto: "Texto",
};

interface Props {
  item: TrilhaModuloConteudo;
  index: number;
  uploading: boolean;
  onChange: (patch: Partial<TrilhaModuloConteudo>) => void;
  onRemove: () => void;
  onUpload: (file: File, tipo: "pdf" | "apresentacao") => void;
}

export function ConteudoEditorItem({ item, index, uploading, onChange, onRemove, onUpload }: Props) {
  const isFile = item.tipo === "pdf" || item.tipo === "apresentacao";
  const isUrl = item.tipo === "video" || item.tipo === "link";
  const isText = item.tipo === "texto";

  return (
    <div className="rounded-md border border-border p-3 space-y-2 bg-background">
      <div className="flex items-center gap-2">
        <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground shrink-0">#{index + 1}</span>
        <Select value={item.tipo} onValueChange={(v) => onChange({ tipo: v as TrilhaConteudoTipo })}>
          <SelectTrigger className="h-8 flex-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(CONTEUDO_TIPO_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-destructive shrink-0" title="Remover conteúdo">
          <X className="w-4 h-4" />
        </button>
      </div>

      <Input
        value={item.titulo || ""}
        onChange={(e) => onChange({ titulo: e.target.value })}
        placeholder="Título deste conteúdo (opcional)"
        className="h-8"
      />

      {isUrl && (
        <Input
          value={item.url || ""}
          onChange={(e) => onChange({ url: e.target.value })}
          placeholder={item.tipo === "video" ? "https://youtu.be/... ou https://vimeo.com/..." : "https://..."}
          className="h-8"
        />
      )}

      {isFile && (
        <div className="space-y-2">
          {item.url ? (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-sm">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="truncate flex-1 text-primary hover:underline">
                {decodeURIComponent(item.url.split("/").pop() || item.url)}
              </a>
              <button type="button" onClick={() => onChange({ url: "" })} className="text-muted-foreground hover:text-destructive" title="Remover arquivo">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border px-2.5 py-3 text-sm text-muted-foreground cursor-pointer hover:bg-muted/40 transition-colors">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Enviando..." : `Enviar ${item.tipo === "pdf" ? "PDF" : "arquivo"} (até 50 MB)`}
              <input
                type="file"
                className="hidden"
                accept={item.tipo === "pdf" ? "application/pdf" : "application/pdf,.ppt,.pptx,image/*"}
                disabled={uploading}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f, item.tipo as "pdf" | "apresentacao"); e.target.value = ""; }}
              />
            </label>
          )}
          <Input
            value={item.url || ""}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="ou cole um link (Google Slides, Drive...)"
            className="h-8"
          />
        </div>
      )}

      {isText && (
        <Textarea
          value={item.texto || ""}
          onChange={(e) => onChange({ texto: e.target.value })}
          rows={3}
          placeholder="Escreva o conteúdo aqui..."
        />
      )}
    </div>
  );
}
