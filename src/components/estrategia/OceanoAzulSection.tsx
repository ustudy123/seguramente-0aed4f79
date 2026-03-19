import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Plus, Trash2, ChevronRight, Waves, MinusCircle, ArrowDownCircle, ArrowUpCircle, Sparkles, Target, Bot } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useEstrategia } from "@/hooks/useEstrategia";
import { OceanoItemAcaoModal } from "./OceanoItemAcaoModal";
import type { EstrategiaOceanoAzul, OceanoQuadrante } from "@/types/estrategia";
import type { EstrategiaEscopo } from "./EstrategiaEscopoSelector";
import { OCEANO_QUADRANTE_LABELS } from "@/types/estrategia";

const QUADRANT_CONFIG: Record<OceanoQuadrante, { icon: React.ElementType; bg: string; border: string; text: string; description: string }> = {
  eliminar: { icon: MinusCircle, bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-700", description: "O que devemos parar de fazer?" },
  reduzir: { icon: ArrowDownCircle, bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-700", description: "O que devemos fazer menos?" },
  elevar: { icon: ArrowUpCircle, bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-700", description: "O que devemos fazer mais?" },
  criar: { icon: Sparkles, bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-700", description: "O que devemos começar a fazer?" },
};

export function OceanoAzulSection({ escopo }: { escopo: EstrategiaEscopo }) {
  const { oceanos, loadingOceanos, createOceano, deleteOceano, useOceanoItens, createOceanoItem, deleteOceanoItem, swots } = useEstrategia(escopo);
  const [selectedOceano, setSelectedOceano] = useState<EstrategiaOceanoAzul | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ titulo: "", descricao: "", swot_id: "" });

  const handleCreate = () => {
    if (!form.titulo.trim()) {
      toast.error("Preencha o título da matriz");
      return;
    }
    const payload = { titulo: form.titulo, descricao: form.descricao || undefined, swot_id: form.swot_id || undefined };
    createOceano.mutate(payload, { onSuccess: () => { setShowNew(false); setForm({ titulo: "", descricao: "", swot_id: "" }); } });
  };

  if (selectedOceano) {
    return <OceanoDetail oceano={selectedOceano} onBack={() => setSelectedOceano(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Waves className="w-5 h-5 text-primary" /> Matriz Oceano Azul
          </h3>
          <p className="text-sm text-muted-foreground">Eliminar, Reduzir, Elevar e Criar para inovar</p>
        </div>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Nova Matriz</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Matriz Oceano Azul</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Título</Label>
                <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Oceano Azul 2026" />
              </div>
              <div className="space-y-1">
                <Label>Descrição</Label>
                <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              </div>
              {swots.length > 0 && (
                <div className="space-y-1">
                  <Label>Vincular à SWOT (opcional)</Label>
                  <Select value={form.swot_id} onValueChange={(v) => setForm({ ...form, swot_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {swots.map((s) => <SelectItem key={s.id} value={s.id}>{s.titulo}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button onClick={handleCreate} disabled={createOceano.isPending} className="w-full">Criar Matriz</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loadingOceanos ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2].map((i) => <div key={i} className="h-32 bg-muted/50 rounded-xl animate-pulse" />)}
        </div>
      ) : oceanos.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Waves className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhuma matriz criada</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {oceanos.map((o, i) => (
            <motion.div key={o.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all group" onClick={() => setSelectedOceano(o)}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{o.titulo}</CardTitle>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {o.descricao && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{o.descricao}</p>}
                  <p className="text-[10px] text-muted-foreground">{new Date(o.created_at).toLocaleDateString("pt-BR")}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// Map SWOT types to suggested Oceano quadrants
const SWOT_TO_OCEANO: Record<string, OceanoQuadrante> = {
  fraqueza: "eliminar",
  ameaca: "reduzir",
  forca: "elevar",
  oportunidade: "criar",
};

const SWOT_TIPO_LABELS: Record<string, string> = {
  forca: "Força",
  fraqueza: "Fraqueza",
  oportunidade: "Oportunidade",
  ameaca: "Ameaça",
};

// Detail view
function OceanoDetail({ oceano, onBack }: { oceano: EstrategiaOceanoAzul; onBack: () => void }) {
  const { useOceanoItens, createOceanoItem, deleteOceanoItem, deleteOceano, useSwotItens } = useEstrategia();
  const { data: itens = [] } = useOceanoItens(oceano.id);
  const { data: swotItens = [] } = useSwotItens(oceano.swot_id || null);
  const [newItemQuad, setNewItemQuad] = useState<OceanoQuadrante>("eliminar");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [acaoModalItem, setAcaoModalItem] = useState<{ id: string; descricao: string; quadrante: OceanoQuadrante } | null>(null);

  // Track which swot items are already imported
  const importedSwotIds = new Set(itens.map((i) => i.swot_item_id).filter(Boolean));

  const handleAdd = () => {
    if (!newItemDesc.trim()) {
      toast.error("Preencha a descrição do item");
      return;
    }
    createOceanoItem.mutate({ oceano_id: oceano.id, quadrante: newItemQuad, descricao: newItemDesc }, {
      onSuccess: () => setNewItemDesc(""),
    });
  };

  const handleImportSwotItem = (swotItem: { id: string; tipo: string; descricao: string }, quadrante: OceanoQuadrante) => {
    createOceanoItem.mutate({ oceano_id: oceano.id, quadrante, descricao: swotItem.descricao, swot_item_id: swotItem.id });
  };

  const quadrantes: OceanoQuadrante[] = ["eliminar", "reduzir", "elevar", "criar"];

  // Group SWOT suggestions by quadrant
  const suggestionsByQuadrant = quadrantes.reduce((acc, q) => {
    acc[q] = swotItens.filter((si) => SWOT_TO_OCEANO[si.tipo] === q && !importedSwotIds.has(si.id));
    return acc;
  }, {} as Record<OceanoQuadrante, typeof swotItens>);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}><ChevronRight className="w-4 h-4 mr-1 rotate-180" /> Voltar</Button>
          <h3 className="text-lg font-semibold">{oceano.titulo}</h3>
        </div>
        <Button variant="destructive" size="sm" onClick={() => { deleteOceano.mutate(oceano.id); onBack(); }}>
          <Trash2 className="w-4 h-4 mr-1" /> Excluir
        </Button>
      </div>

      {/* Add item */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <Select value={newItemQuad} onValueChange={(v) => setNewItemQuad(v as OceanoQuadrante)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {quadrantes.map((q) => <SelectItem key={q} value={q}>{OCEANO_QUADRANTE_LABELS[q]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input className="flex-1" placeholder="Descreva..." value={newItemDesc} onChange={(e) => setNewItemDesc(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAdd()} />
            <Button onClick={handleAdd}><Plus className="w-4 h-4" /></Button>
          </div>
        </CardContent>
      </Card>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {quadrantes.map((q) => {
          const config = QUADRANT_CONFIG[q];
          const qItens = itens.filter((i) => i.quadrante === q);
          const suggestions = suggestionsByQuadrant[q] || [];
          return (
            <Card key={q} className={`${config.border} border-2`}>
              <CardHeader className={`pb-2 ${config.bg} rounded-t-lg`}>
                <CardTitle className={`text-sm font-semibold ${config.text} flex items-center gap-2`}>
                  <config.icon className="w-4 h-4" />
                  {OCEANO_QUADRANTE_LABELS[q]} ({qItens.length})
                </CardTitle>
                <p className="text-[10px] text-muted-foreground">{config.description}</p>
              </CardHeader>
              <CardContent className="p-3 space-y-2">
                {qItens.length === 0 && suggestions.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhum item</p>
                ) : (
                  <>
                    {qItens.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-background border">
                        <p className="text-sm flex-1">{item.descricao}</p>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 text-primary hover:text-primary"
                            title="Sugerir ações com IA"
                            onClick={() => setAcaoModalItem({ id: item.id, descricao: item.descricao, quadrante: q })}
                          >
                            <Bot className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteOceanoItem.mutate(item.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {/* SWOT suggestions */}
                    {suggestions.length > 0 && (
                      <div className="pt-2 border-t border-dashed space-y-1.5">
                        <p className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Sugestões da SWOT
                        </p>
                        {suggestions.map((si) => (
                          <div key={si.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/40 border border-dashed">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{si.descricao}</p>
                              <Badge variant="outline" className="text-[10px] mt-0.5">{SWOT_TIPO_LABELS[si.tipo] || si.tipo}</Badge>
                            </div>
                            <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => handleImportSwotItem(si, q)}>
                              <Plus className="w-3 h-3 mr-1" /> Usar
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Modal para criar ação no Plano de Ação */}
      {acaoModalItem && (
        <OceanoItemAcaoModal
          open={!!acaoModalItem}
          onOpenChange={(open) => !open && setAcaoModalItem(null)}
          item={acaoModalItem}
          oceanoTitulo={oceano.titulo}
        />
      )}
    </div>
  );
}
