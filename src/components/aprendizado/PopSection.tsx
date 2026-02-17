import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Sparkles, Plus, Pencil, Trash2 } from "lucide-react";
import { usePopAtividade } from "@/hooks/usePopAtividade";
import { PopGerarModal } from "./PopGerarModal";
import { PopEditorModal } from "./PopEditorModal";
import type { FuncaoAtividade } from "@/types/aprendizado";

interface PopSectionProps {
  atividade: FuncaoAtividade;
  cargoId: string;
  funcaoNome?: string;
  nivel?: string;
  ferramentas?: string;
  interfaces?: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-yellow-100 text-yellow-800" },
  em_revisao: { label: "Em revisão", color: "bg-blue-100 text-blue-800" },
  publicado: { label: "Publicado", color: "bg-green-100 text-green-800" },
  desatualizado: { label: "Desatualizado", color: "bg-red-100 text-red-800" },
};

export function PopSection({ atividade, cargoId, funcaoNome, nivel, ferramentas, interfaces }: PopSectionProps) {
  const { getPopByAtividade, criarPop, criandoPop, atualizarPop, atualizandoPop, excluirPop, gerarPopIA, reescreverTrechoIA, buscarVersoes } = usePopAtividade(cargoId, funcaoNome);
  const [showGerarModal, setShowGerarModal] = useState(false);
  const [showEditorModal, setShowEditorModal] = useState(false);

  const pop = getPopByAtividade(atividade.id);

  const handleGerarIA = async (popContent: Record<string, unknown>) => {
    await criarPop({
      atividade_id: atividade.id,
      titulo: `POP – ${atividade.nome}`,
      gerado_por_ia: true,
      popContent,
    });
  };

  const handleCriarManual = async () => {
    await criarPop({
      atividade_id: atividade.id,
      titulo: `POP – ${atividade.nome}`,
      gerado_por_ia: false,
    });
  };

  const handleSave = async (id: string, updates: any, motivo?: string) => {
    await atualizarPop({ id, updates, motivo });
  };

  const st = pop ? (STATUS_LABELS[pop.status] || STATUS_LABELS.rascunho) : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium">
          <FileText className="w-4 h-4" /> POP da Atividade
        </span>
      </div>

      {pop ? (
        <div className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <Badge className={`text-xs ${st?.color}`}>{st?.label}</Badge>
            <span className="text-sm font-medium">{pop.codigo}</span>
            <span className="text-xs text-muted-foreground">v{pop.versao_atual}</span>
            {pop.gerado_por_ia && <Badge variant="outline" className="text-xs gap-1"><Sparkles className="w-3 h-3" /> IA</Badge>}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => setShowEditorModal(true)}>
              <Pencil className="w-3 h-3" /> Editar
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => excluirPop(pop.id)}>
              <Trash2 className="w-3 h-3 text-destructive" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">Não existe</Badge>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowGerarModal(true)} disabled={criandoPop}>
            <Sparkles className="w-3 h-3" /> Gerar POP (IA)
          </Button>
          <Button variant="ghost" size="sm" className="gap-1" onClick={handleCriarManual} disabled={criandoPop}>
            <Plus className="w-3 h-3" /> Criar POP manual
          </Button>
        </div>
      )}

      <PopGerarModal
        open={showGerarModal}
        onClose={() => setShowGerarModal(false)}
        atividadeNome={atividade.nome}
        atividadeDescricao={atividade.descricao || undefined}
        frequencia={atividade.frequencia}
        complexidade={atividade.complexidade}
        classificacao={atividade.classificacao}
        funcaoNome={funcaoNome}
        nivel={nivel}
        ferramentas={ferramentas}
        interfaces={interfaces}
        onGenerated={handleGerarIA}
        gerarPopIA={gerarPopIA}
      />

      {pop && showEditorModal && (
        <PopEditorModal
          open={showEditorModal}
          onClose={() => setShowEditorModal(false)}
          pop={pop}
          onSave={handleSave}
          saving={atualizandoPop}
          buscarVersoes={buscarVersoes}
          reescreverTrechoIA={reescreverTrechoIA}
        />
      )}
    </div>
  );
}
