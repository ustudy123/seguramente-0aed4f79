import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAvaliacoes } from "@/hooks/useAvaliacoes";
import type { 
  AvaliacaoTemplate, 
  AvaliacaoTemplateInsert, 
  Categoria, 
  Criterio 
} from "@/types/avaliacao";

const formSchema = z.object({
  nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  descricao: z.string().optional(),
  tipo: z.enum(["simples", "360"]).default("simples"),
  escala_min: z.number().min(0).max(10).default(1),
  escala_max: z.number().min(1).max(10).default(5),
  permite_comentarios: z.boolean().default(true),
});

type FormData = z.infer<typeof formSchema>;

interface TemplateFormProps {
  template?: AvaliacaoTemplate;
  onSuccess: () => void;
}

export function TemplateForm({ template, onSuccess }: TemplateFormProps) {
  const { createTemplate, updateTemplate, isCreatingTemplate } = useAvaliacoes();
  const [categorias, setCategorias] = useState<Categoria[]>(template?.categorias || []);
  const [criterios, setCriterios] = useState<Criterio[]>(template?.criterios || []);
  const [newCategoria, setNewCategoria] = useState("");
  const [newCriterio, setNewCriterio] = useState({ nome: "", categoria: "" });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: template?.nome || "",
      descricao: template?.descricao || "",
      tipo: template?.tipo || "simples",
      escala_min: template?.escala_min || 1,
      escala_max: template?.escala_max || 5,
      permite_comentarios: template?.permite_comentarios ?? true,
    },
  });

  const addCategoria = () => {
    if (!newCategoria.trim()) return;
    const categoria: Categoria = {
      id: `cat-${Date.now()}`,
      nome: newCategoria.trim(),
      peso: 1,
    };
    setCategorias([...categorias, categoria]);
    setNewCategoria("");
  };

  const removeCategoria = (id: string) => {
    setCategorias(categorias.filter(c => c.id !== id));
    setCriterios(criterios.filter(c => c.categoria !== id));
  };

  const addCriterio = () => {
    if (!newCriterio.nome.trim() || !newCriterio.categoria) return;
    const criterio: Criterio = {
      id: `crit-${Date.now()}`,
      nome: newCriterio.nome.trim(),
      categoria: newCriterio.categoria,
      peso: 1,
    };
    setCriterios([...criterios, criterio]);
    setNewCriterio({ nome: "", categoria: newCriterio.categoria });
  };

  const removeCriterio = (id: string) => {
    setCriterios(criterios.filter(c => c.id !== id));
  };

  const onSubmit = async (data: FormData) => {
    const templateData: AvaliacaoTemplateInsert = {
      nome: data.nome,
      descricao: data.descricao,
      tipo: data.tipo,
      escala_min: data.escala_min,
      escala_max: data.escala_max,
      permite_comentarios: data.permite_comentarios,
      categorias,
      criterios,
    };

    if (template) {
      await updateTemplate({ id: template.id, ...templateData });
    } else {
      await createTemplate(templateData);
    }
    onSuccess();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="nome"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do Template</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Avaliação de Competências" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="descricao"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Descreva o objetivo deste template..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="tipo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Avaliação</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="simples">Simples (Gestor avalia)</SelectItem>
                    <SelectItem value="360">360° (Múltiplos avaliadores)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-2">
            <FormField
              control={form.control}
              name="escala_min"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Escala Mín</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min="0" 
                      max="10"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="escala_max"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Escala Máx</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min="1" 
                      max="10"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <FormField
          control={form.control}
          name="permite_comentarios"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <FormLabel>Permitir Comentários</FormLabel>
                <FormDescription>
                  Avaliadores podem adicionar comentários por critério
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Categorias */}
        <div className="space-y-3">
          <FormLabel>Categorias de Competências</FormLabel>
          <div className="flex gap-2">
            <Input
              placeholder="Nome da categoria (ex: Comunicação)"
              value={newCategoria}
              onChange={(e) => setNewCategoria(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCategoria())}
            />
            <Button type="button" onClick={addCategoria} variant="secondary">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          {categorias.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {categorias.map((cat) => (
                <Badge 
                  key={cat.id} 
                  variant="secondary" 
                  className="gap-1 py-1.5"
                >
                  {cat.nome}
                  <button 
                    type="button"
                    onClick={() => removeCategoria(cat.id)}
                    className="ml-1 hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Critérios */}
        {categorias.length > 0 && (
          <div className="space-y-3">
            <FormLabel>Critérios de Avaliação</FormLabel>
            <div className="flex gap-2">
              <Select 
                value={newCriterio.categoria} 
                onValueChange={(v) => setNewCriterio({ ...newCriterio, categoria: v })}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Nome do critério"
                value={newCriterio.nome}
                onChange={(e) => setNewCriterio({ ...newCriterio, nome: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCriterio())}
                className="flex-1"
              />
              <Button type="button" onClick={addCriterio} variant="secondary">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            {criterios.length > 0 && (
              <div className="space-y-2">
                {categorias.map((cat) => {
                  const catCriterios = criterios.filter(c => c.categoria === cat.id);
                  if (catCriterios.length === 0) return null;
                  
                  return (
                    <div key={cat.id} className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">{cat.nome}</p>
                      <div className="pl-3 border-l-2 border-muted space-y-1">
                        {catCriterios.map((crit) => (
                          <div 
                            key={crit.id} 
                            className="flex items-center justify-between p-2 bg-muted/50 rounded"
                          >
                            <span className="text-sm">{crit.nome}</span>
                            <button 
                              type="button"
                              onClick={() => removeCriterio(crit.id)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isCreatingTemplate}>
            {isCreatingTemplate ? "Salvando..." : template ? "Salvar Alterações" : "Criar Template"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
