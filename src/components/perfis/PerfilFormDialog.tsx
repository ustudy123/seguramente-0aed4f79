import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PermissoesEditor } from "./PermissoesEditor";
import type { PerfilAcesso, PerfilPermissao } from "@/hooks/usePerfisAcesso";
import { Loader2 } from "lucide-react";

const schema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  descricao: z.string().optional(),
  cor: z.string().optional(),
  icone: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const CORES_SUGERIDAS = [
  "#6366f1", "#dc2626", "#7c3aed", "#059669", "#0891b2",
  "#d97706", "#b45309", "#475569", "#64748b", "#ec4899",
];

interface PerfilFormDialogProps {
  open: boolean;
  onClose: () => void;
  perfilInicial?: PerfilAcesso;
  onSubmit: (data: FormData & { permissoes: Partial<PerfilPermissao>[] }) => Promise<void>;
  loading?: boolean;
}

export function PerfilFormDialog({ open, onClose, perfilInicial, onSubmit, loading }: PerfilFormDialogProps) {
  const [permissoes, setPermissoes] = useState<Partial<PerfilPermissao>[]>(
    perfilInicial?.permissoes || []
  );
  const [tab, setTab] = useState("geral");

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: perfilInicial?.nome || "",
      descricao: perfilInicial?.descricao || "",
      cor: perfilInicial?.cor || "#6366f1",
      icone: perfilInicial?.icone || "",
    },
  });

  const handleSubmit = async (data: FormData) => {
    await onSubmit({ ...data, permissoes });
    form.reset();
    setPermissoes([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{perfilInicial ? "Editar Perfil" : "Novo Perfil de Acesso"}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="shrink-0">
            <TabsTrigger value="geral">Informações gerais</TabsTrigger>
            <TabsTrigger value="permissoes">
              Permissões
              {permissoes.length > 0 && (
                <span className="ml-1.5 bg-primary text-primary-foreground text-[10px] rounded-full px-1.5 py-0.5">
                  {permissoes.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto py-4">
                <TabsContent value="geral" className="mt-0 space-y-4">
                  <FormField control={form.control} name="nome" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do perfil *</FormLabel>
                      <FormControl><Input placeholder="Ex: Gestor de RH" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="descricao" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Descreva o propósito deste perfil..." rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="cor" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cor de identificação</FormLabel>
                      <div className="flex items-center gap-3">
                        <div className="flex gap-2 flex-wrap">
                          {CORES_SUGERIDAS.map((cor) => (
                            <button
                              key={cor}
                              type="button"
                              onClick={() => field.onChange(cor)}
                              className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                              style={{
                                backgroundColor: cor,
                                borderColor: field.value === cor ? "#000" : "transparent",
                                outline: field.value === cor ? `2px solid ${cor}` : "none",
                                outlineOffset: "2px",
                              }}
                            />
                          ))}
                        </div>
                        <Input
                          type="color"
                          className="w-10 h-8 p-0.5 cursor-pointer"
                          value={field.value || "#6366f1"}
                          onChange={field.onChange}
                        />
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />
                </TabsContent>

                <TabsContent value="permissoes" className="mt-0">
                  <PermissoesEditor permissoes={permissoes} onChange={setPermissoes} />
                </TabsContent>
              </div>

              <DialogFooter className="shrink-0 pt-4 border-t">
                <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {perfilInicial ? "Salvar alterações" : "Criar perfil"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
