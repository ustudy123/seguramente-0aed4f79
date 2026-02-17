import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface PopGerarModalProps {
  open: boolean;
  onClose: () => void;
  atividadeNome: string;
  atividadeDescricao?: string;
  frequencia?: string;
  complexidade?: string;
  classificacao?: string;
  funcaoNome?: string;
  nivel?: string;
  ferramentas?: string;
  interfaces?: string;
  responsavelDireto?: string;
  consequenciaErro?: string;
  conteudos?: string;
  onGenerated: (popContent: Record<string, unknown>) => void;
  gerarPopIA: (params: Record<string, string | undefined>) => Promise<Record<string, unknown>>;
}

export function PopGerarModal({
  open, onClose, atividadeNome, atividadeDescricao,
  frequencia, complexidade, classificacao,
  funcaoNome, nivel, ferramentas, interfaces,
  responsavelDireto, consequenciaErro, conteudos,
  onGenerated, gerarPopIA,
}: PopGerarModalProps) {
  const [loading, setLoading] = useState(false);
  const [objetivo, setObjetivo] = useState("");
  const [preRequisitos, setPreRequisitos] = useState("");
  const [epiNecessario, setEpiNecessario] = useState(false);
  const [materiais, setMateriais] = useState("");
  const [sistemas, setSistemas] = useState("");
  const [errosComuns, setErrosComuns] = useState("");
  const [criterios, setCriterios] = useState("");
  const [responsaveis, setResponsaveis] = useState("");

  // Pre-fill fields from activity data when modal opens
  useEffect(() => {
    if (open) {
      if (responsavelDireto) setResponsaveis(prev => prev || responsavelDireto);
      if (ferramentas) setSistemas(prev => prev || ferramentas);
      if (consequenciaErro) setErrosComuns(prev => prev || consequenciaErro);
    }
  }, [open, responsavelDireto, ferramentas, consequenciaErro]);

  const handleGerar = async () => {
    setLoading(true);
    try {
      const pop = await gerarPopIA({
        funcao_nome: funcaoNome,
        nivel,
        atividade_nome: atividadeNome,
        atividade_descricao: atividadeDescricao,
        frequencia,
        complexidade,
        classificacao,
        ferramentas,
        interfaces,
        responsavel_direto: responsavelDireto,
        consequencia_erro: consequenciaErro,
        conteudos_relacionados: conteudos,
        objetivo_pop: objetivo || undefined,
        pre_requisitos: preRequisitos || undefined,
        epi_necessario: epiNecessario ? "Sim" : "Não",
        materiais: materiais || undefined,
        sistemas: sistemas || undefined,
        erros_comuns: errosComuns || undefined,
        criterios_qualidade: criterios || undefined,
        responsaveis: responsaveis || undefined,
      });
      onGenerated(pop);
      toast.success("POP gerado pela IA com sucesso!");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar POP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Gerar POP via IA — {atividadeNome}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Complete as informações abaixo para uma geração mais precisa. Campos opcionais melhoram a qualidade do resultado.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Objetivo do POP</Label>
            <Input value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="Ex: Padronizar a rotina de..." />
          </div>
          <div className="space-y-1">
            <Label>Responsáveis (executante / aprovador)</Label>
            <Input value={responsaveis} onChange={(e) => setResponsaveis(e.target.value)} placeholder="Ex: Técnico SST / Gerente" />
          </div>
          <div className="space-y-1">
            <Label>Pré-requisitos</Label>
            <Textarea value={preRequisitos} onChange={(e) => setPreRequisitos(e.target.value)} placeholder="Acessos, treinamentos, condições..." rows={2} />
          </div>
          <div className="space-y-1">
            <Label>Materiais / Equipamentos</Label>
            <Textarea value={materiais} onChange={(e) => setMateriais(e.target.value)} placeholder="Ferramentas, materiais necessários..." rows={2} />
          </div>
          <div className="space-y-1">
            <Label>Sistemas / Ferramentas envolvidas</Label>
            <Input value={sistemas} onChange={(e) => setSistemas(e.target.value)} placeholder="Ex: SAP, Excel, sistema X..." />
          </div>
          <div className="space-y-1">
            <Label>Erros comuns a evitar</Label>
            <Input value={errosComuns} onChange={(e) => setErrosComuns(e.target.value)} placeholder="Ex: Esquecer de validar..." />
          </div>
          <div className="space-y-1">
            <Label>Critérios de qualidade</Label>
            <Input value={criterios} onChange={(e) => setCriterios(e.target.value)} placeholder="Como saber que está correto..." />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Switch checked={epiNecessario} onCheckedChange={setEpiNecessario} />
            <Label>EPI necessário?</Label>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleGerar} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? "Gerando POP..." : "Gerar POP com IA"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
