import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, X } from "lucide-react";
import { useOnboardingTemplates } from "@/hooks/useOnboarding";
import type { OnboardingTemplate } from "@/types/onboarding";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: OnboardingTemplate | null;
}

const defaultForm = {
  nome: "",
  descricao: "",
  prazo_dias: 15,
  emitir_certificado: true,
  conexao_pdi: true,
  ativo: true,
  funcoes: [] as string[],
  departamentos: [] as string[],
  tipos_vinculo: [] as string[],
};

export function OnboardingTemplateForm({ open, onOpenChange, template }: Props) {
  const { criarTemplate, atualizarTemplate, criando } = useOnboardingTemplates();
  const [form, setForm] = useState(defaultForm);
  const [tagInput, setTagInput] = useState({ funcoes: "", departamentos: "", tipos_vinculo: "" });

  useEffect(() => {
    if (template) {
      setForm({
        nome: template.nome,
        descricao: template.descricao || "",
        prazo_dias: template.prazo_dias,
        emitir_certificado: template.emitir_certificado,
        conexao_pdi: template.conexao_pdi,
        ativo: template.ativo,
        funcoes: template.funcoes || [],
        departamentos: template.departamentos || [],
        tipos_vinculo: template.tipos_vinculo || [],
      });
    } else {
      setForm(defaultForm);
    }
  }, [template, open]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const addTag = (field: "funcoes" | "departamentos" | "tipos_vinculo") => {
    const val = tagInput[field].trim();
    if (!val || form[field].includes(val)) return;
    set(field, [...form[field], val]);
    setTagInput((p) => ({ ...p, [field]: "" }));
  };

  const removeTag = (field: "funcoes" | "departamentos" | "tipos_vinculo", val: string) => {
    set(field, form[field].filter((v) => v !== val));
  };

  const handleSubmit = async () => {
    if (!form.nome.trim()) return;
    const payload = {
      nome: form.nome,
      descricao: form.descricao || null,
      prazo_dias: form.prazo_dias,
      emitir_certificado: form.emitir_certificado,
      conexao_pdi: form.conexao_pdi,
      ativo: form.ativo,
      funcoes: form.funcoes.length ? form.funcoes : null,
      departamentos: form.departamentos.length ? form.departamentos : null,
      tipos_vinculo: form.tipos_vinculo.length ? form.tipos_vinculo : null,
    };
    try {
      if (template) {
        await atualizarTemplate({ id: template.id, ...payload } as never);
      } else {
        await criarTemplate(payload as never);
      }
      onOpenChange(false);
    } catch {}
  };

  const TagField = ({ label, field }: { label: string; field: "funcoes" | "departamentos" | "tipos_vinculo" }) => (
    <div>
      <Label>{label} <span className="text-muted-foreground text-xs">(vazio = todos)</span></Label>
      <div className="flex gap-2 mt-1">
        <Input
          value={tagInput[field]}
          onChange={(e) => setTagInput((p) => ({ ...p, [field]: e.target.value }))}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(field); } }}
          placeholder="Digite e pressione Enter"
          className="flex-1"
        />
        <Button type="button" variant="outline" size="sm" onClick={() => addTag(field)}>+</Button>
      </div>
      {form[field].length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {form[field].map((v) => (
            <Badge key={v} variant="secondary" className="gap-1 text-xs">
              {v}
              <X className="w-3 h-3 cursor-pointer" onClick={() => removeTag(field, v)} />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Editar Template" : "Novo Template de Onboarding"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex: Onboarding CLT - Operações" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="Descrição do template..." rows={2} />
          </div>
          <div>
            <Label>Prazo (dias)</Label>
            <Input type="number" value={form.prazo_dias} onChange={(e) => set("prazo_dias", Number(e.target.value))} />
          </div>

          <TagField label="Funções aplicáveis" field="funcoes" />
          <TagField label="Departamentos aplicáveis" field="departamentos" />
          <TagField label="Tipos de vínculo" field="tipos_vinculo" />

          <div className="flex items-center justify-between">
            <Label>Emitir certificado ao concluir</Label>
            <Switch checked={form.emitir_certificado} onCheckedChange={(v) => set("emitir_certificado", v)} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Conectar ao PDI</Label>
            <Switch checked={form.conexao_pdi} onCheckedChange={(v) => set("conexao_pdi", v)} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Ativo</Label>
            <Switch checked={form.ativo} onCheckedChange={(v) => set("ativo", v)} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.nome.trim() || criando}>
              {criando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {template ? "Salvar" : "Criar Template"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
