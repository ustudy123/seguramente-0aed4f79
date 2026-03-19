import { useState } from "react";
import { Target, Sparkles, ArrowRight, Loader2, Bot, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { usePlanoAcao } from "@/hooks/usePlanoAcao";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { OceanoQuadrante } from "@/types/estrategia";
import { OCEANO_QUADRANTE_LABELS } from "@/types/estrategia";

interface OceanoItemAcaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: {
    id: string;
    descricao: string;
    quadrante: OceanoQuadrante;
  };
  oceanoTitulo: string;
}

interface SugestaoIA {
  titulo: string;
  descricao: string;
  porque: string;
  como: string;
  tipo: "corretiva" | "preventiva" | "melhoria";
  prioridade: "baixa" | "media" | "alta" | "urgente";
}

const QUADRANTE_COLORS: Record<OceanoQuadrante, string> = {
  eliminar: "text-red-700",
  reduzir: "text-amber-700",
  elevar: "text-blue-700",
  criar: "text-emerald-700",
};

export function OceanoItemAcaoModal({ open, onOpenChange, item, oceanoTitulo }: OceanoItemAcaoModalProps) {
  const { createAcao, isCreatingAcao } = usePlanoAcao();
  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    porque: `Estratégia Oceano Azul "${oceanoTitulo}" — Quadrante: ${OCEANO_QUADRANTE_LABELS[item.quadrante]}. Item: ${item.descricao}`,
    como: "",
    onde: "",
    prazo: "",
    responsavel_nome: "",
    tipo: "melhoria" as "corretiva" | "preventiva" | "melhoria",
  });

  const [sugestoesIA, setSugestoesIA] = useState<SugestaoIA[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [loadingIA, setLoadingIA] = useState(false);
  const [iaGerada, setIaGerada] = useState(false);
  const [criandoMultiplas, setCriandoMultiplas] = useState(false);

  const toggleSelection = (idx: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIndices.size === sugestoesIA.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(sugestoesIA.map((_, i) => i)));
    }
  };

  const handleUsarSugestaoIA = (s: SugestaoIA) => {
    setForm({
      ...form,
      titulo: s.titulo,
      descricao: s.descricao,
      porque: s.porque,
      como: s.como,
      tipo: s.tipo,
    });
    // Scroll to form
    setTimeout(() => {
      document.getElementById("oceano-form-titulo")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const handleGerarSugestoesIA = async () => {
    setLoadingIA(true);
    setSelectedIndices(new Set());
    try {
      const { data, error } = await supabase.functions.invoke("ai-oceano-azul", {
        body: {
          quadrante: item.quadrante,
          descricao_item: item.descricao,
          oceano_titulo: oceanoTitulo,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      if (data?.sugestoes?.length) {
        setSugestoesIA(data.sugestoes);
        setIaGerada(true);
        toast.success(`${data.sugestoes.length} sugestões geradas pela IA!`);
      } else {
        toast.error("Nenhuma sugestão retornada pela IA");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar sugestões";
      toast.error(msg);
    } finally {
      setLoadingIA(false);
    }
  };

  const buildAcaoPayload = (s: SugestaoIA) => ({
    titulo: s.titulo,
    descricao: s.descricao || undefined,
    porque: s.porque || undefined,
    como: s.como || undefined,
    tipo: s.tipo,
    origem_modulo: "estrategia" as const,
    origem_descricao: `Oceano Azul: ${oceanoTitulo} → ${OCEANO_QUADRANTE_LABELS[item.quadrante]}`,
    gravidade: item.quadrante === "eliminar" ? 4 : item.quadrante === "reduzir" ? 3 : 3,
    urgencia: item.quadrante === "eliminar" ? 4 : item.quadrante === "reduzir" ? 3 : 2,
    tendencia: item.quadrante === "criar" ? 4 : 3,
    prioridade: item.quadrante === "eliminar" ? "urgente" as const : "medio" as const,
    exige_evidencia: false,
  });

  const handleCriarSelecionadas = async () => {
    if (selectedIndices.size === 0) {
      toast.error("Selecione pelo menos uma sugestão");
      return;
    }
    setCriandoMultiplas(true);
    let criadas = 0;
    try {
      for (const idx of selectedIndices) {
        const s = sugestoesIA[idx];
        await createAcao(buildAcaoPayload(s));
        criadas++;
      }
      toast.success(`${criadas} ação(ões) criada(s) no Plano de Ação!`);
      onOpenChange(false);
      setSugestoesIA([]);
      setSelectedIndices(new Set());
      setIaGerada(false);
    } catch {
      toast.error(`Erro ao criar ações. ${criadas} de ${selectedIndices.size} criadas.`);
    } finally {
      setCriandoMultiplas(false);
    }
  };

  const handleSubmitManual = async () => {
    if (!form.titulo.trim()) return;

    await createAcao({
      titulo: form.titulo,
      descricao: form.descricao || undefined,
      porque: form.porque || undefined,
      como: form.como || undefined,
      onde: form.onde || undefined,
      prazo: form.prazo || undefined,
      responsavel_nome: form.responsavel_nome || undefined,
      tipo: form.tipo,
      origem_modulo: "estrategia",
      origem_descricao: `Oceano Azul: ${oceanoTitulo} → ${OCEANO_QUADRANTE_LABELS[item.quadrante]}`,
      gravidade: item.quadrante === "eliminar" ? 4 : item.quadrante === "reduzir" ? 3 : 3,
      urgencia: item.quadrante === "eliminar" ? 4 : item.quadrante === "reduzir" ? 3 : 2,
      tendencia: item.quadrante === "criar" ? 4 : 3,
      prioridade: item.quadrante === "eliminar" ? "urgente" : "medio",
      exige_evidencia: false,
    });

    onOpenChange(false);
    setForm({ titulo: "", descricao: "", porque: "", como: "", onde: "", prazo: "", responsavel_nome: "", tipo: "melhoria" });
    setSugestoesIA([]);
    setIaGerada(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Criar Ação no Plano de Ação
          </DialogTitle>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className={QUADRANTE_COLORS[item.quadrante]}>
              {OCEANO_QUADRANTE_LABELS[item.quadrante]}
            </Badge>
            <span className="text-sm text-muted-foreground truncate">{item.descricao}</span>
          </div>
        </DialogHeader>

        {/* Botão de IA */}
        <Button
          onClick={handleGerarSugestoesIA}
          disabled={loadingIA}
          variant="outline"
          className="w-full border-primary/30 hover:bg-primary/5"
        >
          {loadingIA ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Bot className="w-4 h-4 mr-2 text-primary" />
          )}
          {loadingIA ? "Gerando sugestões com IA..." : iaGerada ? "Gerar novas sugestões com IA" : "🤖 Sugerir ações com IA"}
        </Button>

        {/* Sugestões da IA */}
        {sugestoesIA.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-primary" />
                Sugestões da IA para "{item.descricao}"
              </p>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={selectAll}>
                {selectedIndices.size === sugestoesIA.length ? "Desmarcar todas" : "Selecionar todas"}
              </Button>
            </div>

            <div className="grid gap-2">
              {sugestoesIA.map((s, i) => {
                const isSelected = selectedIndices.has(i);
                return (
                  <Card
                    key={i}
                    className={`cursor-pointer transition-all ${
                      isSelected ? "border-primary ring-1 ring-primary/30 shadow-sm" : "hover:border-primary/40"
                    }`}
                    onClick={() => toggleSelection(i)}
                  >
                    <CardContent className="p-3 space-y-1">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelection(i)}
                          className="mt-0.5 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium">{s.titulo}</p>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Badge variant="secondary" className="text-[10px]">{s.tipo}</Badge>
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  s.prioridade === "urgente"
                                    ? "border-red-500 text-red-700"
                                    : s.prioridade === "alta"
                                    ? "border-amber-500 text-amber-700"
                                    : "border-muted"
                                }`}
                              >
                                {s.prioridade}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                title="Usar apenas esta sugestão"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUsarSugestaoIA(s);
                                }}
                              >
                                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{s.como}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Botão criar selecionadas */}
            <Button
              onClick={handleCriarSelecionadas}
              disabled={selectedIndices.size === 0 || criandoMultiplas}
              className="w-full"
            >
              {criandoMultiplas ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              {criandoMultiplas
                ? "Criando ações..."
                : `Criar ${selectedIndices.size} ação(ões) selecionada(s) no Plano`}
            </Button>
          </div>
        )}

        <Separator />

        {/* Formulário manual */}
        <div className="space-y-3">
          <p className="text-sm font-medium flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary" />
            Ou crie uma ação manualmente
          </p>

          <div className="space-y-1">
            <Label>Título da Ação *</Label>
            <Input
              id="oceano-form-titulo"
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder={`${OCEANO_QUADRANTE_LABELS[item.quadrante]}: ${item.descricao}`}
            />
          </div>

          <div className="space-y-1">
            <Label>Por quê (Justificativa)</Label>
            <Textarea
              value={form.porque}
              onChange={(e) => setForm({ ...form, porque: e.target.value })}
              rows={2}
            />
          </div>

          <div className="space-y-1">
            <Label>Como será executada</Label>
            <Textarea
              value={form.como}
              onChange={(e) => setForm({ ...form, como: e.target.value })}
              rows={2}
              placeholder="Descreva como executar a ação..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Onde</Label>
              <Input
                value={form.onde}
                onChange={(e) => setForm({ ...form, onde: e.target.value })}
                placeholder="Área ou departamento"
              />
            </div>
            <div className="space-y-1">
              <Label>Prazo</Label>
              <Input
                type="date"
                value={form.prazo}
                onChange={(e) => setForm({ ...form, prazo: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Responsável</Label>
              <Input
                value={form.responsavel_nome}
                onChange={(e) => setForm({ ...form, responsavel_nome: e.target.value })}
                placeholder="Nome do responsável"
              />
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="corretiva">Corretiva</SelectItem>
                  <SelectItem value="preventiva">Preventiva</SelectItem>
                  <SelectItem value="melhoria">Melhoria</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSubmitManual} disabled={!form.titulo.trim() || isCreatingAcao}>
              <Target className="w-4 h-4 mr-1" />
              Criar Ação Manual
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
