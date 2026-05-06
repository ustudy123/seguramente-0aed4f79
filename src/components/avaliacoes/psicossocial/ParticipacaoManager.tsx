import { useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  UserPlus,
  CheckCircle2,
  Clock,
  Copy,
  Trash2,
  Upload,
  Download,
  Search,
  ShieldCheck,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { CampanhaPsicossocial } from "@/types/psicossocial";
import { cn } from "@/lib/utils";
import { formatCpf, cleanCpf, validateCpf } from "@/lib/cpf";

interface Participacao {
  id: string;
  token: string;
  colaborador_nome: string | null;
  colaborador_cpf: string | null;
  setor: string | null;
  cargo: string | null;
  unidade: string | null;
  turno: string | null;
  respondido: boolean;
  respondido_em: string | null;
  enviado_via: string | null;
  created_at: string;
}

interface ParticipacaoManagerProps {
  campanha: CampanhaPsicossocial;
}

// Usa a URL atual do navegador para garantir que o domínio correto seja utilizado
const BASE_URL = typeof window !== 'undefined' ? window.location.origin : "https://youreyes.com.br";

function getLinkParticipacao(token: string) {
  return `${BASE_URL}/p/${token}`;
}

export function ParticipacaoManager({ campanha }: ParticipacaoManagerProps) {
  const { profile } = useAuthContext();
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [busca, setBusca] = useState("");

  // Campos do formulário de adição
  const [form, setForm] = useState({
    colaborador_nome: "",
    colaborador_cpf: "",
    setor: "",
    cargo: "",
    unidade: "",
    turno: "",
  });

  // Buscar participações da campanha
  const { data: participacoes = [], isLoading } = useQuery({
    queryKey: ["psicossocial-participacoes", campanha.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("psicossocial_participacoes")
        .select("*")
        .eq("campanha_id", campanha.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Participacao[];
    },
  });

  // Total de respostas reais (inclui Link Geral anônimo)
  const { data: totalRespostasReais = 0 } = useQuery({
    queryKey: ["psicossocial-respostas-count", campanha.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("questionario_psicossocial_respostas")
        .select("id", { count: "exact", head: true })
        .eq("campanha_id", campanha.id);
      if (error) throw error;
      return count || 0;
    },
  });

  // Adicionar participante elegível
  const adicionarParticipante = useMutation({
    mutationFn: async (dados: typeof form) => {
      const { data: tenantData } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", profile?.user_id)
        .single();

      const { error } = await supabase.from("psicossocial_participacoes").insert({
        tenant_id: tenantData?.tenant_id,
        campanha_id: campanha.id,
        colaborador_nome: dados.colaborador_nome || null,
        colaborador_cpf: dados.colaborador_cpf || null,
        setor: dados.setor || null,
        cargo: dados.cargo || null,
        unidade: dados.unidade || null,
        turno: dados.turno || null,
        enviado_via: "link",
        enviado_em: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["psicossocial-participacoes", campanha.id] });
      toast.success("Participante adicionado com sucesso");
      setForm({ colaborador_nome: "", colaborador_cpf: "", setor: "", cargo: "", unidade: "", turno: "" });
      setShowAddDialog(false);
    },
    onError: (err: Error) => {
      toast.error(`Erro ao adicionar: ${err.message}`);
    },
  });

  // Remover participante (somente se não respondeu)
  const removerParticipante = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("psicossocial_participacoes")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["psicossocial-participacoes", campanha.id] });
      toast.success("Participante removido");
    },
  });

  const copiarLink = (token: string) => {
    navigator.clipboard.writeText(getLinkParticipacao(token));
    toast.success("Link individual copiado!");
  };

  const exportarLinks = () => {
    const linhas = [
      "Nome,Setor,Cargo,Link Individual,Status",
      ...participacoes.map(p =>
        `"${p.colaborador_nome || 'Sem nome'}","${p.setor || ''}","${p.cargo || ''}","${getLinkParticipacao(p.token)}","${p.respondido ? 'Respondido' : 'Pendente'}"`
      ),
    ];
    const blob = new Blob([linhas.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `participantes_${campanha.nome.replace(/ /g, "_")}.csv`;
    a.click();
  };

  // Estatísticas — combina elegíveis individuais + respostas anônimas (Link Geral)
  // Quando a campanha é anônima (sem elegíveis nominais), usamos o total de respostas
  // como fonte de verdade — espelhando a lógica do modal de Resultados.
  const elegiveisNominais = participacoes.length;
  const respondidosIndividuais = participacoes.filter(p => p.respondido).length;
  const responderam = Math.max(respondidosIndividuais, totalRespostasReais);
  const elegiveis = elegiveisNominais > 0 ? elegiveisNominais : responderam;
  const total = Math.max(elegiveis, responderam);
  const pendentes = Math.max(0, elegiveisNominais - respondidosIndividuais);
  const taxa = total > 0 ? Math.round((responderam / total) * 100) : 0;
  const MINIMO = 5;

  const participacoesFiltradas = participacoes.filter(p => {
    if (!busca) return true;
    const q = busca.toLowerCase();
    return (
      p.colaborador_nome?.toLowerCase().includes(q) ||
      p.setor?.toLowerCase().includes(q) ||
      p.cargo?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Painel de estatísticas */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Elegíveis</span>
            </div>
            <p className="text-2xl font-bold mt-1">{elegiveis}</p>
            {elegiveisNominais === 0 && totalRespostasReais > 0 ? (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Campanha anônima — respostas via Link Geral
              </p>
            ) : totalRespostasReais > elegiveisNominais ? (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                +{totalRespostasReais - respondidosIndividuais} via Link Geral (anônimo)
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-xs text-muted-foreground">Responderam</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-emerald-600">{responderam}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Pendentes</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-amber-500">{pendentes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Taxa de Adesão</span>
            </div>
            <p className="text-2xl font-bold mt-1">{taxa}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Barra de progresso */}
      {total > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progresso da Campanha</span>
              <span className="text-sm text-muted-foreground">{responderam}/{total}</span>
            </div>
            <Progress value={taxa} className="h-2.5" />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">
                {responderam >= MINIMO
                  ? "✅ Anonimato garantido — análise liberada"
                  : `⚠️ Faltam ${MINIMO - responderam} respostas para liberar análise`}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  taxa >= 80 ? "text-emerald-600 border-emerald-300" :
                  taxa >= 50 ? "text-amber-600 border-amber-300" :
                  "text-muted-foreground"
                )}
              >
                {taxa >= 80 ? "Excelente" : taxa >= 50 ? "Regular" : "Baixa"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Aviso de anonimato */}
      <Card className="border-blue-200 bg-blue-50/40">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-800">Identificação técnica + Anonimização analítica</p>
              <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
                O sistema registra <strong>quem respondeu</strong> (para controle de adesão), mas o relatório <strong>nunca vincula a resposta à identidade</strong>. Os dados são armazenados separadamente — participação e resposta são objetos distintos.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-xs">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar participante..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {total > 0 && (
            <Button variant="outline" size="sm" onClick={exportarLinks}>
              <Download className="h-4 w-4 mr-1" />
              Exportar Links
            </Button>
          )}
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <UserPlus className="h-4 w-4 mr-1" />
            Adicionar Elegível
          </Button>
        </div>
      </div>

      {/* Tabela de participantes */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : participacoesFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="font-medium text-sm">Nenhum participante adicionado</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Adicione os colaboradores elegíveis para gerar links individuais e controlar a participação
              </p>
              <Button size="sm" className="mt-4" onClick={() => setShowAddDialog(true)}>
                <UserPlus className="h-4 w-4 mr-1" />
                Adicionar primeiro elegível
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Setor / Cargo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {participacoesFiltradas.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{p.colaborador_nome || "Participante"}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.colaborador_cpf ? `CPF: ${p.colaborador_cpf}` : "CPF não informado"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{p.setor || "—"}</p>
                        <p className="text-xs text-muted-foreground">{p.cargo || "—"}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {p.respondido ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Respondido
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          Pendente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => copiarLink(p.token)}
                          title="Copiar link individual"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        {!p.respondido && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => removerParticipante.mutate(p.id)}
                            title="Remover elegível"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Adicionar participante */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Participante Elegível</DialogTitle>
            <DialogDescription>
              O sistema gerará um link individual único. O colaborador só poderá responder uma vez.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input
                  placeholder="Nome completo"
                  value={form.colaborador_nome}
                  onChange={e => setForm(f => ({ ...f, colaborador_nome: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>CPF</Label>
                <Input
                  placeholder="000.000.000-00"
                  value={form.colaborador_cpf}
                  inputMode="numeric"
                  maxLength={14}
                  onChange={e =>
                    setForm(f => ({ ...f, colaborador_cpf: formatCpf(e.target.value) }))
                  }
                  className={cn(
                    form.colaborador_cpf &&
                      cleanCpf(form.colaborador_cpf).length === 11 &&
                      !validateCpf(form.colaborador_cpf) &&
                      "border-destructive focus-visible:ring-destructive"
                  )}
                />
                {form.colaborador_cpf &&
                  cleanCpf(form.colaborador_cpf).length === 11 &&
                  !validateCpf(form.colaborador_cpf) && (
                    <p className="text-[11px] text-destructive">CPF inválido</p>
                  )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Setor</Label>
                <Input
                  placeholder="Ex: Operações"
                  value={form.setor}
                  onChange={e => setForm(f => ({ ...f, setor: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cargo</Label>
                <Input
                  placeholder="Ex: Analista"
                  value={form.cargo}
                  onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Unidade</Label>
                <Input
                  placeholder="Ex: Matriz"
                  value={form.unidade}
                  onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Turno</Label>
                <Input
                  placeholder="Ex: Manhã"
                  value={form.turno}
                  onChange={e => setForm(f => ({ ...f, turno: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 mt-1">
            <strong>Privacidade:</strong> Os dados de identificação são usados exclusivamente para controlar a participação. As respostas serão armazenadas sem vínculo com o nome ou CPF.
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => adicionarParticipante.mutate(form)}
              disabled={
                !form.colaborador_nome ||
                adicionarParticipante.isPending ||
                (!!form.colaborador_cpf && !validateCpf(form.colaborador_cpf))
              }
            >
              {adicionarParticipante.isPending ? "Adicionando..." : "Adicionar e Gerar Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
