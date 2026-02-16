import { useState } from "react";
import { Heart, Plus, Trash2, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useColaboradores } from "@/hooks/useColaboradores";
import type { CulturaPreferencia } from "@/types/cultura";

const PREF_ANIVERSARIO: Record<string, string> = {
  experiencia: "Experiência",
  presente: "Presente",
  folga: "Folga",
  indiferente: "Indiferente",
};

const TIPO_RECONHECIMENTO: Record<string, string> = {
  publico: "Público",
  reservado: "Reservado",
  tanto_faz: "Tanto faz",
};

interface Props {
  preferencias: CulturaPreferencia[];
  onCreatePreferencia: (data: Partial<CulturaPreferencia>) => Promise<void>;
  onDeletePreferencia: (id: string) => Promise<void>;
}

export const PreferenciasColaborador = ({ preferencias, onCreatePreferencia, onDeletePreferencia }: Props) => {
  const { colaboradores } = useColaboradores();
  const [showForm, setShowForm] = useState(false);
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState({
    colaborador_id: "",
    colaborador_nome: "",
    preferencia_aniversario: "indiferente",
    tipo_reconhecimento: "tanto_faz",
    observacoes: "",
  });

  const filtered = preferencias.filter(p =>
    !busca || p.colaborador_nome.toLowerCase().includes(busca.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!form.colaborador_nome) return;
    await onCreatePreferencia({
      colaborador_id: form.colaborador_id || form.colaborador_nome,
      colaborador_nome: form.colaborador_nome,
      preferencia_aniversario: form.preferencia_aniversario,
      tipo_reconhecimento: form.tipo_reconhecimento,
      observacoes: form.observacoes || null,
    });
    setShowForm(false);
    setForm({ colaborador_id: "", colaborador_nome: "", preferencia_aniversario: "indiferente", tipo_reconhecimento: "tanto_faz", observacoes: "" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar colaborador..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-[200px] h-8 text-xs"
          />
        </div>
        <Button size="sm" onClick={() => setShowForm(true)} className="gap-1">
          <Plus className="w-4 h-4" /> Registrar Preferência
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <Heart className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma preferência registrada</p>
          <p className="text-xs text-muted-foreground mt-1">
            Colete as preferências de celebração dos colaboradores durante o onboarding
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((p) => (
            <Card key={p.id} className="p-4 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm">{p.colaborador_nome}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px]">
                    🎂 {PREF_ANIVERSARIO[p.preferencia_aniversario] || p.preferencia_aniversario}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    🏆 {TIPO_RECONHECIMENTO[p.tipo_reconhecimento] || p.tipo_reconhecimento}
                  </Badge>
                </div>
                {p.observacoes && <p className="text-xs text-muted-foreground mt-1">{p.observacoes}</p>}
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" onClick={() => onDeletePreferencia(p.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>🎉 Como você gosta de ser celebrado?</DialogTitle>
            <DialogDescription>Registre as preferências de celebração do colaborador</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Colaborador *</Label>
              <Select
                value={form.colaborador_nome}
                onValueChange={v => {
                  const col = colaboradores.find(c => c.nome_completo === v);
                  setForm(f => ({ ...f, colaborador_nome: v, colaborador_id: col?.id || "" }));
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {colaboradores.map(c => (
                    <SelectItem key={c.id} value={c.nome_completo}>
                      {c.nome_completo}{c.cargo ? ` · ${c.cargo}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Preferência para aniversários</Label>
              <Select value={form.preferencia_aniversario} onValueChange={v => setForm(f => ({ ...f, preferencia_aniversario: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PREF_ANIVERSARIO).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de reconhecimento preferido</Label>
              <Select value={form.tipo_reconhecimento} onValueChange={v => setForm(f => ({ ...f, tipo_reconhecimento: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_RECONHECIMENTO).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observações pessoais (opcional)</Label>
              <Textarea
                value={form.observacoes}
                onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                rows={2}
                placeholder="Ex: gosta de chocolate, prefere flores..."
              />
            </div>
            <Button onClick={handleSubmit} className="w-full">Salvar Preferência</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
