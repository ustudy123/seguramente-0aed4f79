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
import { Loader2 } from "lucide-react";
import { useTrilhaModulos } from "@/hooks/useTrilhas";
import type { TrilhaModulo, TrilhaModuloTipo, TrilhaOrdemTipo } from "@/types/trilha";
import { MODULO_TIPO_LABELS } from "@/types/trilha";

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

  const needsUrl = ["video", "pdf", "link", "apresentacao"].includes(form.tipo);
  const needsText = ["conteudo_interno", "reflexao", "estudo_caso", "microdesafio"].includes(form.tipo);

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
        tempo_estimado_min: form.tempo_estimado_min,
        pontuacao: form.pontuacao,
        ordem_tipo: form.ordem_tipo as never,
        evidencia_obrigatoria: form.evidencia_obrigatoria,
        competencia_relacionada: form.competencia_relacionada || null,
      };

      if (modulo) {
        await atualizarModulo({ id: modulo.id, ...payload } as never);
      } else {
        await criarModulo({ ...payload, ordem: nextOrdem } as never);
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

          {needsUrl && (
            <div>
              <Label>URL do conteúdo</Label>
              <Input value={form.conteudo_url} onChange={(e) => set("conteudo_url", e.target.value)} placeholder="https://..." />
            </div>
          )}
          {needsText && (
            <div>
              <Label>Conteúdo / Instruções</Label>
              <Textarea value={form.conteudo_texto} onChange={(e) => set("conteudo_texto", e.target.value)} rows={4} placeholder="Conteúdo ou instruções da atividade..." />
            </div>
          )}

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
            <Button onClick={handleSubmit} disabled={!form.titulo.trim() || criando}>
              {criando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {modulo ? "Salvar" : "Adicionar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
