import { useState, useEffect } from "react";
import { Heart, Plus, X, Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useEstrategia } from "@/hooks/useEstrategia";

export function CulturaSection() {
  const { cultura, loadingCultura, upsertCultura } = useEstrategia();
  const [form, setForm] = useState({
    missao: "",
    visao: "",
    valores: [] as string[],
    principios: [] as string[],
    comportamentos_esperados: [] as string[],
    comportamentos_nao_tolerados: [] as string[],
  });
  const [newValue, setNewValue] = useState({ valores: "", principios: "", comportamentos_esperados: "", comportamentos_nao_tolerados: "" });

  useEffect(() => {
    if (cultura) {
      setForm({
        missao: cultura.missao || "",
        visao: cultura.visao || "",
        valores: Array.isArray(cultura.valores) ? cultura.valores : [],
        principios: Array.isArray(cultura.principios) ? cultura.principios : [],
        comportamentos_esperados: Array.isArray(cultura.comportamentos_esperados) ? cultura.comportamentos_esperados : [],
        comportamentos_nao_tolerados: Array.isArray(cultura.comportamentos_nao_tolerados) ? cultura.comportamentos_nao_tolerados : [],
      });
    }
  }, [cultura]);

  const addItem = (field: keyof typeof newValue) => {
    const val = newValue[field].trim();
    if (!val) return;
    setForm({ ...form, [field]: [...form[field], val] });
    setNewValue({ ...newValue, [field]: "" });
  };

  const removeItem = (field: keyof typeof newValue, idx: number) => {
    setForm({ ...form, [field]: form[field].filter((_, i) => i !== idx) });
  };

  const handleSave = () => {
    upsertCultura.mutate(form);
  };

  if (loadingCultura) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  const listFields = [
    { key: "valores" as const, label: "Valores", color: "bg-primary/10 text-primary" },
    { key: "principios" as const, label: "Princípios Culturais", color: "bg-accent text-accent-foreground" },
    { key: "comportamentos_esperados" as const, label: "Comportamentos Esperados", color: "bg-emerald-100 text-emerald-800" },
    { key: "comportamentos_nao_tolerados" as const, label: "Comportamentos Não Tolerados", color: "bg-red-100 text-red-800" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Heart className="w-5 h-5 text-primary" /> Missão, Visão e Valores
          </h3>
          <p className="text-sm text-muted-foreground">Formalize a identidade cultural da empresa</p>
        </div>
        <Button onClick={handleSave} disabled={upsertCultura.isPending}>
          <Save className="w-4 h-4 mr-1" /> {upsertCultura.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Missão</CardTitle></CardHeader>
          <CardContent>
            <Textarea value={form.missao} onChange={(e) => setForm({ ...form, missao: e.target.value })} placeholder="Por que existimos? Qual o propósito da empresa?" rows={4} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Visão</CardTitle></CardHeader>
          <CardContent>
            <Textarea value={form.visao} onChange={(e) => setForm({ ...form, visao: e.target.value })} placeholder="Onde queremos chegar? Como será o futuro?" rows={4} />
          </CardContent>
        </Card>
      </div>

      {listFields.map(({ key, label, color }) => (
        <Card key={key}>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{label}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder={`Adicionar ${label.toLowerCase()}...`}
                value={newValue[key]}
                onChange={(e) => setNewValue({ ...newValue, [key]: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && addItem(key)}
              />
              <Button variant="outline" size="icon" onClick={() => addItem(key)}><Plus className="w-4 h-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {form[key].map((item, i) => (
                <Badge key={i} className={`${color} gap-1`}>
                  {item}
                  <button onClick={() => removeItem(key, i)} className="ml-1 hover:opacity-70"><X className="w-3 h-3" /></button>
                </Badge>
              ))}
              {form[key].length === 0 && <p className="text-xs text-muted-foreground">Nenhum item adicionado</p>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
