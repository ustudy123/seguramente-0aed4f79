import { useState } from "react";
import { Brain, Loader2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Alerta {
  titulo: string;
  descricao: string;
  categoria: string;
  tipo: string;
  item: string;
  colaborador?: string;
}

interface AlertaAcaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alerta: Alerta;
}

export function AlertaAcaoModal({ open, onOpenChange, alerta }: AlertaAcaoModalProps) {
  const { user, profile } = useAuth();
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  const [titulo, setTitulo] = useState(alerta.titulo);
  const [descricao, setDescricao] = useState(alerta.descricao);
  const [tipo, setTipo] = useState<string>("corretiva");
  const [prioridade, setPrioridade] = useState<string>(
    alerta.tipo === "critico" ? "imediato" : alerta.tipo === "urgente" ? "urgente" : "medio"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingIA, setIsLoadingIA] = useState(false);

  const gerarComIA = async () => {
    setIsLoadingIA(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-plano-acao", {
        body: {
          tipo: "gerar_5w2h",
          contexto: `Alerta de EPI: ${alerta.titulo}. ${alerta.descricao}. Item: ${alerta.item}. ${alerta.colaborador ? `Colaborador: ${alerta.colaborador}` : ""}`,
          dados: {
            titulo: alerta.titulo,
            descricao: alerta.descricao,
            origem: "Alertas de EPI",
          },
        },
      });
      if (error) throw error;
      if (data?.w5h2) {
        setTitulo(data.w5h2.what || titulo);
        setDescricao(`${data.w5h2.why || ""}\n\nComo: ${data.w5h2.how || ""}\n\nOnde: ${data.w5h2.where || ""}`);
      }
      if (data?.resumo) {
        toast.success("Sugestão gerada pela IA!");
      }
    } catch {
      toast.error("Erro ao gerar sugestão");
    } finally {
      setIsLoadingIA(false);
    }
  };

  const criarAcao = async () => {
    if (!tenantId) return;
    setIsLoading(true);
    const userName = profile?.nome_completo || user?.email || "Usuário";
    const gutMap: Record<string, { g: number; u: number; t: number }> = {
      imediato: { g: 5, u: 5, t: 5 },
      urgente: { g: 4, u: 4, t: 3 },
      medio: { g: 3, u: 3, t: 3 },
      baixo: { g: 2, u: 2, t: 2 },
    };
    const gut = gutMap[prioridade] || gutMap.medio;

    try {
      const { data: created, error } = await supabase
        .from("plano_acoes")
        .insert({
          tenant_id: tenantId,
          codigo: "",
          titulo,
          descricao,
          porque: `Alerta de EPI: ${alerta.categoria} — ${alerta.item}`,
          origem_modulo: "epi",
          origem_descricao: `Alertas EPI → ${alerta.categoria}`,
          tipo: tipo as any,
          prioridade: prioridade as any,
          gravidade: gut.g,
          urgencia: gut.u,
          tendencia: gut.t,
          pontuacao_gut: gut.g * gut.u * gut.t,
          criado_por: user?.id,
          criado_por_nome: userName,
        })
        .select()
        .single();

      if (error) throw error;

      await supabase.from("plano_historico").insert({
        tenant_id: tenantId,
        acao_id: created.id,
        tipo_evento: "criacao",
        descricao: `Ação criada a partir do alerta de EPI: ${alerta.categoria}`,
        usuario_id: user?.id,
        usuario_nome: userName,
      });

      queryClient.invalidateQueries({ queryKey: ["plano-acoes"] });
      queryClient.invalidateQueries({ queryKey: ["plano-acoes-stats"] });
      toast.success("Ação criada no Plano de Ação!");
      onOpenChange(false);
    } catch (err) {
      toast.error("Erro ao criar ação");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Criar Ação — {alerta.categoria}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={gerarComIA} disabled={isLoadingIA} className="gap-2">
              {isLoadingIA ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              Sugerir com IA
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={4} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="corretiva">Corretiva</SelectItem>
                  <SelectItem value="preventiva">Preventiva</SelectItem>
                  <SelectItem value="melhoria">Melhoria</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="imediato">Imediato</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                  <SelectItem value="medio">Médio</SelectItem>
                  <SelectItem value="baixo">Baixo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={criarAcao} disabled={isLoading || !titulo.trim()} className="gap-2">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Criar Ação
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
