import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ShieldAlert, Eye, CheckCircle2, XCircle, AlertTriangle, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; class: string; icon: any }> = {
  aberta: { label: "Aberta", class: "bg-red-100 text-red-700", icon: AlertTriangle },
  em_analise: { label: "Em Análise", class: "bg-amber-100 text-amber-700", icon: Clock },
  procedente: { label: "Procedente", class: "bg-red-100 text-red-700", icon: ShieldAlert },
  improcedente: { label: "Improcedente", class: "bg-muted text-muted-foreground", icon: XCircle },
  resolvida: { label: "Resolvida", class: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
};

const tipoLabels: Record<string, string> = {
  conduta_inadequada: "Conduta Inadequada",
  fora_escopo: "Fora do Escopo",
  fraude_documental: "Fraude Documental",
  nao_comparecimento: "Não Comparecimento",
  qualidade_insuficiente: "Qualidade Insuficiente",
  outro: "Outro",
};

const gravidadeConfig: Record<string, { label: string; class: string }> = {
  baixa: { label: "Baixa", class: "bg-blue-100 text-blue-700" },
  media: { label: "Média", class: "bg-amber-100 text-amber-700" },
  alta: { label: "Alta", class: "bg-orange-100 text-orange-700" },
  critica: { label: "Crítica", class: "bg-red-100 text-red-700" },
};

interface Denuncia {
  id: string;
  profissional_id: string;
  denunciante_nome: string | null;
  tipo: string;
  descricao: string;
  gravidade: string;
  status: string;
  acao_tomada: string | null;
  created_at: string;
  profissional?: { nome_completo: string; conselho: string };
}

export function DenunciasList() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Denuncia | null>(null);
  const [novoStatus, setNovoStatus] = useState("");
  const [acaoTomada, setAcaoTomada] = useState("");
  const [updating, setUpdating] = useState(false);

  const { data: realDenuncias = [], isLoading } = useQuery({
    queryKey: ["marketplace-denuncias", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("marketplace_denuncias")
        .select("*, profissional:marketplace_profissionais(nome_completo, conselho)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Denuncia[];
    },
    enabled: !!tenantId,
  });

  const demoDenuncias: Denuncia[] = [
    {
      id: "dd-1", profissional_id: "p1", denunciante_nome: "Ana Costa",
      tipo: "fora_escopo", descricao: "Profissional realizou orientação nutricional sem habilitação para tal.",
      gravidade: "alta", status: "aberta", acao_tomada: null,
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      profissional: { nome_completo: "Ricardo Mendes", conselho: "CREA" },
    },
    {
      id: "dd-2", profissional_id: "p2", denunciante_nome: "Carlos Lima",
      tipo: "nao_comparecimento", descricao: "Profissional não compareceu ao atendimento agendado sem aviso prévio.",
      gravidade: "media", status: "em_analise", acao_tomada: null,
      created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      profissional: { nome_completo: "Fernanda Costa", conselho: "CRP" },
    },
    {
      id: "dd-3", profissional_id: "p3", denunciante_nome: "Empresa XYZ",
      tipo: "qualidade_insuficiente", descricao: "Laudo entregue incompleto, sem as análises quantitativas previstas no escopo.",
      gravidade: "baixa", status: "resolvida", acao_tomada: "Profissional refez o laudo completo. Caso encerrado.",
      created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
      profissional: { nome_completo: "Paulo Nascimento", conselho: "CREA" },
    },
  ];

  const denuncias = realDenuncias.length > 0 ? realDenuncias : demoDenuncias;
  const isDemo = realDenuncias.length === 0 && denuncias.length > 0;

  const handleUpdate = async () => {
    if (!selected || !novoStatus) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from("marketplace_denuncias")
        .update({
          status: novoStatus,
          acao_tomada: acaoTomada.trim() || null,
          analisado_em: new Date().toISOString(),
        })
        .eq("id", selected.id);
      if (error) throw error;
      toast.success("Denúncia atualizada");
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ["marketplace-denuncias"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdating(false);
    }
  };

  if (isLoading) return <div className="text-center py-12 text-muted-foreground text-sm">Carregando...</div>;

  return (
    <>
      <div className="space-y-3">
        {isDemo && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span><strong>Modo Demonstração</strong> — dados fictícios para visualização.</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" /> Denúncias
          </h3>
          <Badge variant="secondary" className="text-xs">{denuncias.length} registro(s)</Badge>
        </div>

        {denuncias.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-400 mb-3" />
            <p className="text-muted-foreground font-medium">Nenhuma denúncia registrada</p>
          </div>
        ) : (
          <div className="space-y-2">
            {denuncias.map((d) => {
              const st = statusConfig[d.status] || statusConfig.aberta;
              const gv = gravidadeConfig[d.gravidade] || gravidadeConfig.media;
              return (
                <div key={d.id} className="bg-card border rounded-xl p-4 flex items-center gap-4 hover:border-primary/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{d.profissional?.nome_completo || "Profissional"}</p>
                      <Badge className={gv.class} variant="secondary">{gv.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {tipoLabels[d.tipo] || d.tipo} • por {d.denunciante_nome || "Anônimo"}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{d.descricao}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {format(new Date(d.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="text-right space-y-1.5">
                    <Badge className={st.class}>{st.label}</Badge>
                    <div>
                      <Button size="sm" variant="outline" onClick={() => { setSelected(d); setNovoStatus(d.status); setAcaoTomada(d.acao_tomada || ""); }} className="text-xs gap-1">
                        <Eye className="h-3 w-3" /> Analisar
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" /> Análise de Denúncia
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-xl">
                <p className="font-medium text-sm">{selected.profissional?.nome_completo}</p>
                <p className="text-xs text-muted-foreground">{tipoLabels[selected.tipo]} • Gravidade: {gravidadeConfig[selected.gravidade]?.label}</p>
              </div>
              <div className="p-3 bg-card border rounded-lg text-sm">
                <p className="text-xs text-muted-foreground mb-1">Descrição</p>
                <p>{selected.descricao}</p>
              </div>
              <div className="space-y-1.5">
                <Label>Alterar Status</Label>
                <Select value={novoStatus} onValueChange={setNovoStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aberta">Aberta</SelectItem>
                    <SelectItem value="em_analise">Em Análise</SelectItem>
                    <SelectItem value="procedente">Procedente</SelectItem>
                    <SelectItem value="improcedente">Improcedente</SelectItem>
                    <SelectItem value="resolvida">Resolvida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Ação Tomada</Label>
                <Textarea
                  value={acaoTomada}
                  onChange={(e) => setAcaoTomada(e.target.value)}
                  rows={2}
                  placeholder="Descreva a ação tomada pela equipe..."
                />
              </div>
              <Button onClick={handleUpdate} disabled={updating} className="w-full">
                {updating ? "Salvando..." : "Salvar Análise"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
