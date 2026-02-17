import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Check, X, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CATEGORIAS_EPI } from "@/types/epi";

const schema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
});

type FormData = z.infer<typeof schema>;

interface EpiTipoFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { nome: string }) => Promise<void>;
  customCategorias?: string[];
  isLoading?: boolean;
}

export function EpiTipoForm({
  open,
  onOpenChange,
  onSubmit,
  customCategorias = [],
  isLoading,
}: EpiTipoFormProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const allCategorias = [...new Set([...CATEGORIAS_EPI, ...customCategorias])].sort();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { nome: "" },
  });

  const handleSubmit = async (data: FormData) => {
    await onSubmit({ nome: data.nome });
    form.reset();
  };

  const handleEditStart = (index: number, nome: string) => {
    setEditingIndex(index);
    setEditValue(nome);
  };

  const handleEditSave = async () => {
    if (!editValue.trim() || editingIndex === null) return;
    // For custom categories we could update, but for now just create a new one
    // since the predefined ones are constants
    setEditingIndex(null);
    setEditValue("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Categorias de EPI</DialogTitle>
        </DialogHeader>

        {/* New category form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex gap-2 items-end">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Nova Categoria</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Proteção Térmica" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" size="sm" disabled={isLoading} className="mb-[2px]">
              <Plus className="w-4 h-4 mr-1" />
              {isLoading ? "..." : "Adicionar"}
            </Button>
          </form>
        </Form>

        {/* Categories grid */}
        <div className="mt-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            Categorias cadastradas ({allCategorias.length})
          </h4>
          <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
            {allCategorias.map((cat, idx) => (
              <div key={cat} className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors">
                {editingIndex === idx ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleEditSave();
                        if (e.key === "Escape") setEditingIndex(null);
                      }}
                    />
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={handleEditSave}>
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingIndex(null)}>
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm">{cat}</span>
                    {customCategorias.includes(cat) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100"
                        onClick={() => handleEditStart(idx, cat)}
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
