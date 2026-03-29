import { useState, useEffect } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Plus, Trash2, ChevronRight, Target, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useEstrategia } from "@/hooks/useEstrategia";
import { SwotDetail } from "./SwotDetail";
import type { EstrategiaSwot } from "@/types/estrategia";
import type { EstrategiaEscopo } from "./EstrategiaEscopoSelector";

interface Props { escopo: EstrategiaEscopo; }

export function SwotSection({ escopo }: Props) {
  const { swots, loadingSwots, createSwot, deleteSwot } = useEstrategia(escopo);
  const [selectedSwot, setSelectedSwot] = useState<EstrategiaSwot | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ titulo: "", descricao: "", escopo: "empresa", periodo: "" });

  // Reset selected SWOT when scope changes
  useEffect(() => {
    setSelectedSwot(null);
  }, [escopo?.tipo, escopo?.grupoId]);

  if (selectedSwot) {
    return <SwotDetail swot={selectedSwot} onBack={() => setSelectedSwot(null)} />;
  }

  const handleCreate = () => {
    if (!form.titulo.trim()) {
      toast.error("Preencha o título da análise SWOT");
      return;
    }
    createSwot.mutate(form, { onSuccess: () => { setShowNew(false); setForm({ titulo: "", descricao: "", escopo: "empresa", periodo: "" }); } });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" /> Análises SWOT
          </h3>
          <p className="text-sm text-muted-foreground">Identifique forças, fraquezas, oportunidades e ameaças</p>
        </div>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Nova SWOT</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Análise SWOT</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Título</Label>
                <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: SWOT Estratégica 2026" />
              </div>
              <div className="space-y-1">
                <Label>Descrição</Label>
                <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Contexto da análise..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Escopo</Label>
                  <Select value={form.escopo} onValueChange={(v) => setForm({ ...form, escopo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="empresa">Empresa</SelectItem>
                      <SelectItem value="unidade">Unidade</SelectItem>
                      <SelectItem value="projeto">Projeto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Período</Label>
                  <Input value={form.periodo} onChange={(e) => setForm({ ...form, periodo: e.target.value })} placeholder="Ex: 2026 Q1" />
                </div>
              </div>
              <Button onClick={handleCreate} disabled={createSwot.isPending} className="w-full">
                {createSwot.isPending ? "Criando..." : "Criar Análise"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loadingSwots ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2].map((i) => <div key={i} className="h-32 bg-muted/50 rounded-xl animate-pulse" />)}
        </div>
      ) : swots.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <BarChart3 className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhuma análise SWOT criada</p>
            <p className="text-xs text-muted-foreground mt-1">Clique em "Nova SWOT" para começar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {swots.map((swot, i) => (
            <motion.div key={swot.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all group" onClick={() => setSelectedSwot(swot)}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{swot.titulo}</CardTitle>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {swot.descricao && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{swot.descricao}</p>}
                  <div className="flex gap-2">
                    <Badge variant="outline">{swot.escopo}</Badge>
                    {swot.periodo && <Badge variant="secondary">{swot.periodo}</Badge>}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    {swot.criado_por_nome} · {new Date(swot.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
