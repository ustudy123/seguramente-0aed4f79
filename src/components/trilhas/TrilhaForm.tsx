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
import { Loader2, BookOpen, Video, FileText, Link2, PenSquare, HelpCircle, Lightbulb, Target, Sparkles } from "lucide-react";
import { useTrilhas, useTrilhaModulos } from "@/hooks/useTrilhas";
import type { Trilha, TrilhaTipo, TrilhaPrioridade, TrilhaVisibilidade, TrilhaModuloTipo } from "@/types/trilha";
import { TRILHA_TIPO_LABELS, TRILHA_PRIORIDADE_LABELS, MODULO_TIPO_LABELS } from "@/types/trilha";

const MODULO_TIPO_ICONS: Partial<Record<TrilhaModuloTipo, React.ElementType>> = {
  video: Video,
  pdf: FileText,
  link: Link2,
  apresentacao: FileText,
  conteudo_interno: PenSquare,
  quiz: HelpCircle,
  reflexao: Lightbulb,
  estudo_caso: Target,
  microdesafio: Sparkles,
};


interface TrilhaFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trilha?: Trilha | null;
  onSuccess?: () => void;
}

const defaultForm = {
  nome: "",
  descricao: "",
  objetivo: "",
  tipo: "tecnica" as TrilhaTipo,
  prioridade: "recomendada" as TrilhaPrioridade,
  visibilidade: "publica" as TrilhaVisibilidade,
  pontuacao_minima: 0,
  prazo_dias: undefined as number | undefined,
  conexao_pdi: false,
};

export function TrilhaForm({ open, onOpenChange, trilha, onSuccess }: TrilhaFormProps) {
  const { criarTrilha, atualizarTrilha, criando } = useTrilhas();
  const { modulos, isLoading: loadingModulos } = useTrilhaModulos(trilha?.id);

  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    if (trilha) {
      setForm({
        nome: trilha.nome,
        descricao: trilha.descricao || "",
        objetivo: trilha.objetivo || "",
        tipo: trilha.tipo,
        prioridade: trilha.prioridade,
        visibilidade: trilha.visibilidade,
        pontuacao_minima: trilha.pontuacao_minima,
        prazo_dias: trilha.prazo_dias ?? undefined,
        conexao_pdi: trilha.conexao_pdi,
      });
    } else {
      setForm(defaultForm);
    }
  }, [trilha, open]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async () => {
    if (!form.nome.trim()) return;
    try {
      if (trilha) {
        await atualizarTrilha({
          id: trilha.id,
          nome: form.nome,
          descricao: form.descricao || null,
          objetivo: form.objetivo || null,
          tipo: form.tipo as never,
          prioridade: form.prioridade as never,
          visibilidade: form.visibilidade as never,
          pontuacao_minima: form.pontuacao_minima,
          prazo_dias: form.prazo_dias ?? null,
          conexao_pdi: form.conexao_pdi,
        } as any);
      } else {
        await criarTrilha({
          nome: form.nome,
          descricao: form.descricao || null,
          objetivo: form.objetivo || null,
          tipo: form.tipo as never,
          prioridade: form.prioridade as never,
          visibilidade: form.visibilidade as never,
          pontuacao_minima: form.pontuacao_minima,
          prazo_dias: form.prazo_dias ?? null,
          conexao_pdi: form.conexao_pdi,
        } as any);
      }
      onOpenChange(false);
      onSuccess?.();
    } catch {}
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{trilha ? "Editar Trilha" : "Nova Trilha"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex: Gestão de Prioridades" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="Breve descrição da trilha..." rows={2} />
          </div>
          <div>
            <Label>Objetivo (o que muda na prática)</Label>
            <Textarea value={form.objetivo} onChange={(e) => set("objetivo", e.target.value)} placeholder="Descreva o resultado esperado..." rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => set("tipo", v as TrilhaTipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TRILHA_TIPO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={form.prioridade} onValueChange={(v) => set("prioridade", v as TrilhaPrioridade)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TRILHA_PRIORIDADE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Visibilidade</Label>
              <Select value={form.visibilidade} onValueChange={(v) => set("visibilidade", v as TrilhaVisibilidade)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="publica">Pública</SelectItem>
                  <SelectItem value="restrita">Restrita</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prazo (dias)</Label>
              <Input
                type="number"
                value={form.prazo_dias ?? ""}
                onChange={(e) => set("prazo_dias", e.target.value ? Number(e.target.value) : undefined)}
                placeholder="Opcional"
              />
            </div>
          </div>
          <div>
            <Label>Pontuação mínima para conclusão</Label>
            <Input
              type="number"
              value={form.pontuacao_minima}
              onChange={(e) => set("pontuacao_minima", Number(e.target.value))}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Conectar ao PDI</Label>
            <Switch checked={form.conexao_pdi} onCheckedChange={(v) => set("conexao_pdi", v)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.nome.trim() || criando}>
              {criando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {trilha ? "Salvar" : "Criar Trilha"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
