import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTrilhas } from "@/hooks/useTrilhas";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";

interface GerarTrilhaIAModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function GerarTrilhaIAModal({ open, onOpenChange, onSuccess }: GerarTrilhaIAModalProps) {
  const { tenantId } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();
  const { criarTrilha } = useTrilhas();
  const [cargoId, setCargoId] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: cargos = [], isLoading: isLoadingCargos } = useQuery({
    queryKey: ["cargos-simples", tenantId, empresaAtivaId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      let query = fromTable("cargos")
        .select("id, nome")
        .eq("tenant_id", tenantId)
        .eq("ativo", true);

      if (empresaAtivaId) {
        query = query.eq("empresa_id", empresaAtivaId);
      }
      
      const { data, error } = await query.order("nome");
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && open,
  });

  const handleGenerate = async () => {
    if (!cargoId) {
      toast.error("Selecione um cargo para gerar a trilha");
      return;
    }

    setIsGenerating(true);
    try {
      const { data: trailData, error: aiError } = await supabase.functions.invoke("ai-gerar-trilha-manual", {
        body: { cargo_id: cargoId },
      });

      if (aiError) throw aiError;

      // Save the generated trail
      const { modulos, ...trailInfo } = trailData;
      
      const newTrail = await criarTrilha(trailInfo);

      // Save modules
      if (modulos && modulos.length > 0) {
        for (const modulo of modulos) {
          const { quiz_perguntas, ...moduloInfo } = modulo;
          
          const { data: createdModulo, error: modError } = await fromTable("trilha_modulos")
            .insert({
              ...moduloInfo,
              trilha_id: (newTrail as any).id,
              tenant_id: tenantId,
            } as any)
            .select()
            .single();

          if (modError) throw modError;

          // Save quiz questions if any
          if (quiz_perguntas && quiz_perguntas.length > 0) {
            const questions = quiz_perguntas.map((q: any, index: number) => ({
              ...q,
              modulo_id: (createdModulo as any).id,
              tenant_id: tenantId,
              ordem: index + 1,
            }));

            const { error: quizError } = await fromTable("trilha_quiz_perguntas")
              .insert(questions as any);

            if (quizError) throw quizError;
          }
        }
      }

      toast.success("Trilha gerada com sucesso!");
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Erro ao gerar trilha:", error);
      toast.error("Erro ao gerar trilha por IA: " + (error.message || "Tente novamente"));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Gerar Trilha por IA
          </DialogTitle>
          <DialogDescription>
            Escolha um cargo para que a IA gere uma trilha de treinamento completa baseada no manual de função cadastrado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>Selecione a Função/Cargo</Label>
            <Select value={cargoId} onValueChange={setCargoId}>
              <SelectTrigger>
                <SelectValue placeholder={isLoadingCargos ? "Carregando cargos..." : "Selecione um cargo..."} />
              </SelectTrigger>
              <SelectContent>
                {cargos.map((cargo: any) => (
                  <SelectItem key={cargo.id} value={cargo.id}>
                    {cargo.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>
              Cancelar
            </Button>
            <Button 
              className="gradient-primary" 
              onClick={handleGenerate} 
              disabled={isGenerating || !cargoId}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando Trilha...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  Gerar Trilha Automática
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}