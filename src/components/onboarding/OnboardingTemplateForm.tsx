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
import { Loader2, X, ChevronsUpDown, Check } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useOnboardingTemplates } from "@/hooks/useOnboarding";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import type { OnboardingTemplate } from "@/types/onboarding";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: OnboardingTemplate | null;
}

const TIPOS_VINCULO_PADRAO = [
  "CLT",
  "PJ",
  "Estágio",
  "Temporário",
  "Aprendiz",
  "Terceirizado",
  "Cooperado",
  "Autônomo",
];

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

function useFormOptions(tenantId: string | null | undefined) {
  const { data: cargos = [] } = useQuery({
    queryKey: ["cargos-options", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("cargos")
        .select("nome")
        .eq("tenant_id", tenantId)
        .eq("ativo", true)
        .order("nome");
      return (data || []).map((c) => c.nome);
    },
    enabled: !!tenantId,
  });

  const { data: departamentosOpts = [] } = useQuery({
    queryKey: ["departamentos-options", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("departamentos")
        .select("nome")
        .eq("tenant_id", tenantId)
        .eq("ativo", true)
        .order("nome");
      return (data || []).map((d) => d.nome);
    },
    enabled: !!tenantId,
  });

  const { data: tiposVinculo = [] } = useQuery({
    queryKey: ["tipos-vinculo-options", tenantId],
    queryFn: async () => {
      if (!tenantId) return TIPOS_VINCULO_PADRAO;
      const { data } = await supabase
        .from("admissoes")
        .select("tipo_contrato")
        .eq("tenant_id", tenantId)
        .not("tipo_contrato", "is", null);
      const fromDb = [...new Set((data || []).map((a) => a.tipo_contrato).filter(Boolean) as string[])];
      // Merge with defaults (dedup)
      const merged = [...new Set([...TIPOS_VINCULO_PADRAO, ...fromDb])].sort();
      return merged;
    },
    enabled: !!tenantId,
  });

  return { cargos, departamentosOpts, tiposVinculo };
}

// Multi-select combobox component
function MultiSelectCombobox({
  label,
  options,
  selected,
  onToggle,
  placeholder = "Pesquisar...",
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (val: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <Label>
        {label}{" "}
        <span className="text-muted-foreground text-xs">(vazio = todos)</span>
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="w-full justify-between mt-1 h-auto min-h-9 font-normal"
          >
            {selected.length === 0 ? (
              <span className="text-muted-foreground text-sm">{placeholder}</span>
            ) : (
              <div className="flex flex-wrap gap-1 max-w-full">
                {selected.map((v) => (
                  <Badge key={v} variant="secondary" className="text-xs">
                    {v}
                  </Badge>
                ))}
              </div>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder={placeholder} />
            <CommandList>
              <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt}
                    value={opt}
                    onSelect={() => onToggle(opt)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selected.includes(opt) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {opt}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selected.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1 text-xs">
              {v}
              <X
                className="w-3 h-3 cursor-pointer"
                onClick={() => onToggle(v)}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function OnboardingTemplateForm({ open, onOpenChange, template }: Props) {
  const { criarTemplate, atualizarTemplate, criando } = useOnboardingTemplates();
  const { tenantId } = useAuth();
  const [form, setForm] = useState(defaultForm);
  const { cargos, departamentosOpts, tiposVinculo } = useFormOptions(tenantId);

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

  const toggleItem = (field: "funcoes" | "departamentos" | "tipos_vinculo", val: string) => {
    const current = form[field];
    if (current.includes(val)) {
      set(field, current.filter((v) => v !== val));
    } else {
      set(field, [...current, val]);
    }
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
        await atualizarTemplate({ id: template.id, ...payload } as any);
      } else {
        await criarTemplate(payload as any);
      }
      onOpenChange(false);
    } catch {}
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Editar Template" : "Novo Template de Onboarding"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input
              value={form.nome}
              onChange={(e) => set("nome", e.target.value)}
              placeholder="Ex: Onboarding CLT - Operações"
            />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea
              value={form.descricao}
              onChange={(e) => set("descricao", e.target.value)}
              placeholder="Descrição do template..."
              rows={2}
            />
          </div>
          <div>
            <Label>Prazo (dias)</Label>
            <Input
              type="number"
              value={form.prazo_dias}
              onChange={(e) => set("prazo_dias", Number(e.target.value))}
            />
          </div>

          <MultiSelectCombobox
            label="Funções aplicáveis"
            options={cargos}
            selected={form.funcoes}
            onToggle={(v) => toggleItem("funcoes", v)}
            placeholder="Pesquisar cargos..."
          />

          <MultiSelectCombobox
            label="Departamentos aplicáveis"
            options={departamentosOpts}
            selected={form.departamentos}
            onToggle={(v) => toggleItem("departamentos", v)}
            placeholder="Pesquisar departamentos..."
          />

          <MultiSelectCombobox
            label="Tipos de vínculo"
            options={tiposVinculo}
            selected={form.tipos_vinculo}
            onToggle={(v) => toggleItem("tipos_vinculo", v)}
            placeholder="Pesquisar tipos de vínculo..."
          />

          <div className="flex items-center justify-between">
            <Label>Emitir certificado ao concluir</Label>
            <Switch
              checked={form.emitir_certificado}
              onCheckedChange={(v) => set("emitir_certificado", v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Conectar ao PDI</Label>
            <Switch
              checked={form.conexao_pdi}
              onCheckedChange={(v) => set("conexao_pdi", v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Ativo</Label>
            <Switch checked={form.ativo} onCheckedChange={(v) => set("ativo", v)} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
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
