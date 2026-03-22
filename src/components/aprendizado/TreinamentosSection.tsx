import { useState } from "react";
import { Plus, Trash2, ExternalLink, BookOpen, Clock, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAprendizado } from "@/hooks/useAprendizado";

const TIPO_LABELS: Record<string, string> = {
  video: "Vídeo",
  documento: "Documento",
  link: "Link",
  apresentacao: "Apresentação",
  manual: "Manual",
  pop: "POP",
  instrucao: "Instrução",
};

const TIPO_COLORS: Record<string, string> = {
  video: "bg-destructive/10 text-destructive",
  documento: "bg-primary/10 text-primary",
  link: "bg-secondary/10 text-secondary-foreground",
  apresentacao: "bg-accent/10 text-accent-foreground",
  manual: "bg-muted text-muted-foreground",
  pop: "bg-warning/10 text-warning",
  instrucao: "bg-success/10 text-success",
};

interface TreinamentosSectionProps {
  cargoId: string;
}

export function TreinamentosSection({ cargoId }: TreinamentosSectionProps) {
  const { treinamentos, criarTreinamento, excluirTreinamento } = useAprendizado(cargoId);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    titulo: "",
    tipo: "video",
    url: "",
    descricao: "",
    obrigatorio: true,
    carga_horaria_min: "",
  });

  const handleAdd = async () => {
    if (!form.titulo.trim() || !form.url.trim()) return;
    await criarTreinamento({
      titulo: form.titulo,
      tipo: form.tipo,
      url: form.url,
      descricao: form.descricao || undefined,
      obrigatorio: form.obrigatorio,
      carga_horaria_min: form.carga_horaria_min ? Number(form.carga_horaria_min) : undefined,
    });
    setForm({ titulo: "", tipo: "video", url: "", descricao: "", obrigatorio: true, carga_horaria_min: "" });
    setShowForm(false);
  };

  const obrigatorios = treinamentos.filter((t: any) => t.obrigatorio);
  const complementares = treinamentos.filter((t: any) => !t.obrigatorio);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground">Treinamentos da Função ({treinamentos.length})</h3>
          {obrigatorios.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {obrigatorios.length} obrigatório{obrigatorios.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-1" /> Adicionar Treinamento
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label>Título *</Label>
                <Input
                  placeholder="Ex: NR-35 Trabalho em Altura"
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Carga horária (min)</Label>
                <Input
                  type="number"
                  placeholder="Ex: 480"
                  value={form.carga_horaria_min}
                  onChange={(e) => setForm({ ...form, carga_horaria_min: e.target.value })}
                />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>URL / Link *</Label>
                <Input
                  placeholder="https://..."
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Descrição (opcional)</Label>
                <Input
                  placeholder="Breve descrição do conteúdo..."
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2 col-span-2">
                <Switch
                  checked={form.obrigatorio}
                  onCheckedChange={(v) => setForm({ ...form, obrigatorio: v })}
                />
                <Label className="cursor-pointer">Treinamento obrigatório</Label>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleAdd} disabled={!form.titulo.trim() || !form.url.trim()}>
                Adicionar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {treinamentos.length === 0 && !showForm && (
        <div className="text-center py-8 text-muted-foreground text-sm space-y-1">
          <BookOpen className="w-8 h-8 mx-auto opacity-30 mb-2" />
          <p>Nenhum treinamento cadastrado para esta função.</p>
          <p className="text-xs">Adicione vídeos, documentos, manuais e links de capacitação.</p>
        </div>
      )}

      {obrigatorios.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-destructive" /> Obrigatórios
          </p>
          {obrigatorios.map((t: any) => (
            <TreinamentoCard key={t.id} treinamento={t} onDelete={() => excluirTreinamento(t.id)} />
          ))}
        </div>
      )}

      {complementares.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Circle className="w-3.5 h-3.5 text-muted-foreground" /> Complementares
          </p>
          {complementares.map((t: any) => (
            <TreinamentoCard key={t.id} treinamento={t} onDelete={() => excluirTreinamento(t.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function TreinamentoCard({ treinamento: t, onDelete }: { treinamento: any; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2.5 gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <Badge className={`text-xs shrink-0 ${TIPO_COLORS[t.tipo] || ""}`}>
          {TIPO_LABELS[t.tipo] || t.tipo}
        </Badge>
        <a
          href={t.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-foreground hover:text-primary hover:underline truncate flex items-center gap-1"
        >
          {t.titulo}
          <ExternalLink className="w-3 h-3 shrink-0 opacity-50" />
        </a>
        {t.descricao && (
          <span className="text-xs text-muted-foreground truncate hidden sm:block">— {t.descricao}</span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {t.carga_horaria_min && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {t.carga_horaria_min >= 60
              ? `${Math.floor(t.carga_horaria_min / 60)}h${t.carga_horaria_min % 60 > 0 ? `${t.carga_horaria_min % 60}min` : ""}`
              : `${t.carga_horaria_min}min`}
          </span>
        )}
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDelete}>
          <Trash2 className="w-3.5 h-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
