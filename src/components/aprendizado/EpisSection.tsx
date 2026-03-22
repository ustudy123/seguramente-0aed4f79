import { useState } from "react";
import { Plus, Trash2, ExternalLink, Shield, HelpCircle, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAprendizado } from "@/hooks/useAprendizado";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

const OBRIG_LABELS: Record<string, string> = { obrigatorio: "Obrigatório", recomendado: "Recomendado", condicional: "Condicional" };
const OBRIG_COLORS: Record<string, string> = { obrigatorio: "bg-destructive/10 text-destructive", recomendado: "bg-warning/10 text-warning", condicional: "bg-primary/10 text-primary" };
const CONTEUDO_LABELS: Record<string, string> = { manual: "Manual", pop: "POP", instrucao: "Instrução", video: "Vídeo", apresentacao: "Apresentação", documento: "Documento", link: "Link" };

interface EpisSectionProps {
  cargoId: string;
}

export function EpisSection({ cargoId }: EpisSectionProps) {
  const { tenantId } = useAuth();
  const {
    epiVinculacoes, criarEpiVinculacao, excluirEpiVinculacao,
    epiConteudos, criarEpiConteudo, excluirEpiConteudo,
    epiQuestionarios, criarEpiQuestionario, excluirEpiQuestionario,
  } = useAprendizado(cargoId);

  // Load EPI types for selection
  const { data: epiTipos = [] } = useQuery({
    queryKey: ["epi_tipos", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("epi_tipos" as never)
        .select("id, nome, categoria")
        .eq("tenant_id", tenantId)
        .eq("ativo", true)
        .order("categoria") as { data: { id: string; nome: string; categoria: string }[] | null; error: Error | null };
      if (error) return [];
      return data || [];
    },
    enabled: !!tenantId,
  });

  const [showVincForm, setShowVincForm] = useState(false);
  const [selectedEpiTipo, setSelectedEpiTipo] = useState("");
  const [obrigatoriedade, setObrigatoriedade] = useState("obrigatorio");

  const [conteudoForm, setConteudoForm] = useState<{ vincId: string; tipo: string; titulo: string; url: string } | null>(null);
  const [questionarioForm, setQuestionarioForm] = useState<{ vincId: string; pergunta: string; opcoes: string; correta: string } | null>(null);

  const alreadyLinked = new Set(epiVinculacoes.map((v) => v.epi_tipo_id));
  const availableEpis = epiTipos.filter((e) => !alreadyLinked.has(e.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">EPIs Vinculados ({epiVinculacoes.length})</h3>
        <Button size="sm" onClick={() => setShowVincForm(!showVincForm)} disabled={availableEpis.length === 0}>
          <Plus className="w-4 h-4 mr-1" /> Vincular EPI
        </Button>
      </div>

      {showVincForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>EPI *</Label>
                <Select value={selectedEpiTipo} onValueChange={setSelectedEpiTipo}>
                  <SelectTrigger><SelectValue placeholder="Selecione o EPI" /></SelectTrigger>
                  <SelectContent>
                    {availableEpis.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.categoria} — {e.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Obrigatoriedade</Label>
                <Select value={obrigatoriedade} onValueChange={setObrigatoriedade}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(OBRIG_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowVincForm(false)}>Cancelar</Button>
              <Button size="sm" onClick={async () => {
                await criarEpiVinculacao({ epi_tipo_id: selectedEpiTipo, obrigatoriedade });
                setSelectedEpiTipo(""); setShowVincForm(false);
              }} disabled={!selectedEpiTipo}>Vincular</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {epiVinculacoes.length === 0 && !showVincForm && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Nenhum EPI vinculado. Cadastre tipos de EPI e vincule-os à função.
        </div>
      )}

      {epiVinculacoes.map((vinc) => {
        const vincConteudos = epiConteudos.filter((c) => c.vinculacao_id === vinc.id);
        const vincPerguntas = epiQuestionarios.filter((q) => q.vinculacao_id === vinc.id);

        return (
          <Card key={vinc.id}>
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  <CardTitle className="text-sm">
                    {vinc.epi_tipo_categoria && <span className="text-muted-foreground">{vinc.epi_tipo_categoria} — </span>}
                    {vinc.epi_tipo_nome || "EPI"}
                  </CardTitle>
                  <Badge className={`text-xs ${OBRIG_COLORS[vinc.obrigatoriedade]}`}>{OBRIG_LABELS[vinc.obrigatoriedade]}</Badge>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => excluirEpiVinculacao(vinc.id)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              {/* Conteúdos de Treinamento */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Conteúdos ({vincConteudos.length})</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setConteudoForm({ vincId: vinc.id, tipo: "video", titulo: "", url: "" })}>
                    <Plus className="w-3 h-3 mr-1" /> Conteúdo
                  </Button>
                </div>
                {conteudoForm?.vincId === vinc.id && (
                  <div className="flex gap-1">
                    <Select value={conteudoForm.tipo} onValueChange={(v) => setConteudoForm({ ...conteudoForm, tipo: v })}>
                      <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(CONTEUDO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input className="h-7 text-xs" placeholder="Título" value={conteudoForm.titulo} onChange={(e) => setConteudoForm({ ...conteudoForm, titulo: e.target.value })} />
                    <Input className="h-7 text-xs" placeholder="URL" value={conteudoForm.url} onChange={(e) => setConteudoForm({ ...conteudoForm, url: e.target.value })} />
                    <Button size="sm" className="h-7" onClick={async () => {
                      await criarEpiConteudo({ vinculacao_id: vinc.id, tipo: conteudoForm.tipo, titulo: conteudoForm.titulo, url: conteudoForm.url });
                      setConteudoForm(null);
                    }} disabled={!conteudoForm.titulo || !conteudoForm.url}>OK</Button>
                    <Button variant="ghost" size="sm" className="h-7" onClick={() => setConteudoForm(null)}>✕</Button>
                  </div>
                )}
                {vincConteudos.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1">
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                      <Badge variant="outline" className="text-xs">{CONTEUDO_LABELS[c.tipo]}</Badge>
                      {c.titulo} <ExternalLink className="w-3 h-3" />
                    </a>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => excluirEpiConteudo(c.id)}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Questionário */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium flex items-center gap-1"><HelpCircle className="w-3.5 h-3.5" /> Questionário ({vincPerguntas.length})</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setQuestionarioForm({ vincId: vinc.id, pergunta: "", opcoes: "", correta: "0" })}>
                    <Plus className="w-3 h-3 mr-1" /> Pergunta
                  </Button>
                </div>
                {questionarioForm?.vincId === vinc.id && (
                  <div className="space-y-2 bg-muted/30 rounded-lg p-2">
                    <Input className="text-xs" placeholder="Pergunta" value={questionarioForm.pergunta} onChange={(e) => setQuestionarioForm({ ...questionarioForm, pergunta: e.target.value })} />
                    <Textarea className="text-xs" placeholder="Opções (uma por linha)" value={questionarioForm.opcoes} onChange={(e) => setQuestionarioForm({ ...questionarioForm, opcoes: e.target.value })} rows={3} />
                    <div className="flex gap-2 items-center">
                      <Label className="text-xs">Resposta correta (índice 0-based):</Label>
                      <Input className="w-16 h-7 text-xs" type="number" value={questionarioForm.correta} onChange={(e) => setQuestionarioForm({ ...questionarioForm, correta: e.target.value })} />
                      <Button size="sm" className="h-7" onClick={async () => {
                        const opcoes = questionarioForm.opcoes.split("\n").filter(Boolean);
                        await criarEpiQuestionario({
                          vinculacao_id: vinc.id,
                          pergunta: questionarioForm.pergunta,
                          opcoes,
                          resposta_correta: parseInt(questionarioForm.correta),
                          ordem: vincPerguntas.length,
                        });
                        setQuestionarioForm(null);
                      }} disabled={!questionarioForm.pergunta || !questionarioForm.opcoes}>Salvar</Button>
                      <Button variant="ghost" size="sm" className="h-7" onClick={() => setQuestionarioForm(null)}>✕</Button>
                    </div>
                  </div>
                )}
                {vincPerguntas.map((q, i) => (
                  <div key={q.id} className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1">
                    <span>{i + 1}. {q.pergunta} <span className="text-muted-foreground">({(q.opcoes as string[]).length} opções)</span></span>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => excluirEpiQuestionario(q.id)}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
