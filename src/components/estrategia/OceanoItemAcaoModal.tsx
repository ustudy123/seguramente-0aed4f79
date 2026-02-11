import { useState } from "react";
import { Target, Sparkles, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { usePlanoAcao } from "@/hooks/usePlanoAcao";
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

const SUGESTOES_POR_QUADRANTE: Record<OceanoQuadrante, string[]> = {
  eliminar: [
    "Descontinuar o processo/prática obsoleta e comunicar stakeholders",
    "Substituir por alternativa mais eficiente e documentar a transição",
    "Automatizar para eliminar atividade manual desnecessária",
    "Revisar normas internas e remover exigências que não agregam valor",
  ],
  reduzir: [
    "Simplificar o processo reduzindo etapas desnecessárias",
    "Reduzir frequência de execução com base em análise de risco",
    "Otimizar recursos alocados mantendo qualidade mínima aceitável",
    "Renegociar SLAs e expectativas com partes envolvidas",
  ],
  elevar: [
    "Investir em capacitação e treinamento da equipe nesta competência",
    "Ampliar escopo e abrangência da prática para outras áreas",
    "Implementar indicadores de desempenho e metas mais ambiciosas",
    "Adotar tecnologia/ferramenta de ponta para potencializar resultados",
  ],
  criar: [
    "Desenvolver programa piloto e validar com grupo de teste",
    "Benchmarking com empresas referência e adaptar melhores práticas",
    "Criar equipe multidisciplinar para concepção e implementação",
    "Lançar MVP (mínimo produto viável) e iterar com feedback contínuo",
  ],
};

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

  const sugestoes = SUGESTOES_POR_QUADRANTE[item.quadrante];

  const handleUsarSugestao = (sugestao: string) => {
    setForm((prev) => ({
      ...prev,
      titulo: prev.titulo || `${OCEANO_QUADRANTE_LABELS[item.quadrante]}: ${item.descricao}`,
      como: sugestao,
    }));
  };

  const handleSubmit = async () => {
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
      origem_modulo: "manual",
      origem_descricao: `Oceano Azul: ${oceanoTitulo} → ${OCEANO_QUADRANTE_LABELS[item.quadrante]}`,
      gravidade: item.quadrante === "eliminar" ? 4 : item.quadrante === "reduzir" ? 3 : 3,
      urgencia: item.quadrante === "eliminar" ? 4 : item.quadrante === "reduzir" ? 3 : 2,
      tendencia: item.quadrante === "criar" ? 4 : 3,
      prioridade: item.quadrante === "eliminar" ? "urgente" : "medio",
      exige_evidencia: false,
    });

    onOpenChange(false);
    setForm({
      titulo: "",
      descricao: "",
      porque: "",
      como: "",
      onde: "",
      prazo: "",
      responsavel_nome: "",
      tipo: "melhoria",
    });
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

        {/* Sugestões de como executar */}
        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary" />
            Sugestões de como {OCEANO_QUADRANTE_LABELS[item.quadrante].toLowerCase()}
          </p>
          <div className="grid gap-2">
            {sugestoes.map((s, i) => (
              <Card
                key={i}
                className="cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all"
                onClick={() => handleUsarSugestao(s)}
              >
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <p className="text-sm">{s}</p>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Separator />

        {/* Formulário da ação */}
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Título da Ação *</Label>
            <Input
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
              placeholder="Selecione uma sugestão acima ou descreva..."
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
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!form.titulo.trim() || isCreatingAcao}>
            <Target className="w-4 h-4 mr-1" />
            Criar Ação no Plano
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
