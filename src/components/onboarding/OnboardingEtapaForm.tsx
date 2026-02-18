import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useOnboardingEtapas } from "@/hooks/useOnboarding";
import type { OnboardingEtapa, OnboardingEtapaTipo } from "@/types/onboarding";
import { ETAPA_TIPO_LABELS } from "@/types/onboarding";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  etapa?: OnboardingEtapa | null;
  nextOrdem: number;
}

const defaultForm = {
  titulo: "",
  descricao: "",
  tipo: "conteudo_livre" as OnboardingEtapaTipo,
  conteudo_texto: "",
  conteudo_url: "",
  formato: "texto",
  pontuacao: 10,
  obrigatoria: true,
  tempo_estimado_min: 5,
  ordem: 0,
};

export function OnboardingEtapaForm({ open, onOpenChange, templateId, etapa, nextOrdem }: Props) {
  const { criarEtapa, atualizarEtapa, criando } = useOnboardingEtapas(templateId);
  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    if (etapa) {
      setForm({
        titulo: etapa.titulo,
        descricao: etapa.descricao || "",
        tipo: etapa.tipo,
        conteudo_texto: etapa.conteudo_texto || "",
        conteudo_url: etapa.conteudo_url || "",
        formato: etapa.formato || "texto",
        pontuacao: etapa.pontuacao,
        obrigatoria: etapa.obrigatoria,
        tempo_estimado_min: etapa.tempo_estimado_min,
        ordem: etapa.ordem,
      });
    } else {
      setForm({ ...defaultForm, ordem: nextOrdem });
    }
  }, [etapa, open, nextOrdem]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async () => {
    if (!form.titulo.trim()) return;
    const payload = {
      titulo: form.titulo,
      descricao: form.descricao || null,
      tipo: form.tipo,
      conteudo_texto: form.conteudo_texto || null,
      conteudo_url: form.conteudo_url || null,
      formato: form.formato,
      pontuacao: form.pontuacao,
      obrigatoria: form.obrigatoria,
      tempo_estimado_min: form.tempo_estimado_min,
      ordem: form.ordem,
    };
    try {
      if (etapa) {
        await atualizarEtapa({ id: etapa.id, ...payload } as never);
      } else {
        await criarEtapa(payload as never);
      }
      onOpenChange(false);
    } catch {}
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{etapa ? "Editar Etapa" : "Nova Etapa"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Título *</Label>
            <Input value={form.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Ex: Bem-vindo à empresa" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => set("tipo", v as OnboardingEtapaTipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ETAPA_TIPO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Formato</Label>
              <Select value={form.formato} onValueChange={(v) => set("formato", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="texto">Texto</SelectItem>
                  <SelectItem value="video">Vídeo</SelectItem>
                  <SelectItem value="apresentacao">Apresentação</SelectItem>
                  <SelectItem value="hibrido">Híbrido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {(form.tipo === "apresentacao_institucional" || form.tipo === "conteudo_livre" || form.tipo === "cultura_valores" || form.tipo === "reflexao") && (
            <div>
              <Label>Conteúdo (texto/markdown)</Label>
              <Textarea
                value={form.conteudo_texto}
                onChange={(e) => set("conteudo_texto", e.target.value)}
                rows={4}
                placeholder="Conteúdo que será apresentado ao colaborador..."
              />
            </div>
          )}

          {(form.formato === "video" || form.formato === "apresentacao") && (
            <div>
              <Label>URL do conteúdo</Label>
              <Input value={form.conteudo_url} onChange={(e) => set("conteudo_url", e.target.value)} placeholder="https://..." />
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Pontuação</Label>
              <Input type="number" value={form.pontuacao} onChange={(e) => set("pontuacao", Number(e.target.value))} />
            </div>
            <div>
              <Label>Tempo (min)</Label>
              <Input type="number" value={form.tempo_estimado_min} onChange={(e) => set("tempo_estimado_min", Number(e.target.value))} />
            </div>
            <div>
              <Label>Ordem</Label>
              <Input type="number" value={form.ordem} onChange={(e) => set("ordem", Number(e.target.value))} />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label>Obrigatória</Label>
            <Switch checked={form.obrigatoria} onCheckedChange={(v) => set("obrigatoria", v)} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.titulo.trim() || criando}>
              {criando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {etapa ? "Salvar" : "Adicionar Etapa"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
