import { useState } from "react";
import { motion } from "framer-motion";
import { format, addDays, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Cake, Award, CalendarHeart, Sparkles, Loader2, Bell, Briefcase } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { toast } from "sonner";
import type { CulturaAcao } from "@/types/cultura";
import { buscarDiaProfissao } from "@/lib/diasProfissao";
import { TIPO_ACAO_LABELS, STATUS_ACAO_COLORS, STATUS_ACAO_LABELS } from "@/types/cultura";

interface CelebracaoItem {
  nome: string;
  tipo: "aniversario" | "tempo_casa" | "dia_profissao" | "acao";
  data: Date;
  diasRestantes: number;
  avatar?: string;
  cargo?: string;
  anos?: number;
  acao?: CulturaAcao;
}


interface Props {
  acoes: CulturaAcao[];
  onCreateAcao?: (data: Partial<CulturaAcao>) => Promise<void>;
  onUpdateStatus?: (id: string, status: string) => Promise<void>;
}

export const ProximasCelebracoes = ({ acoes, onCreateAcao, onUpdateStatus }: Props) => {
  const { tenantId } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();
  const [criandoAcao, setCriandoAcao] = useState<string | null>(null);

  // Fetch upcoming birthdays and work anniversaries from admissoes
  const { data: celebracoesReais = [] } = useQuery({
    queryKey: ["proximas-celebracoes", tenantId, empresaAtivaId],
    queryFn: async (): Promise<CelebracaoItem[]> => {
      if (!tenantId || !empresaAtivaId) return [];

      const { data, error } = await supabase
        .from("admissoes")
        .select("nome_completo, data_nascimento, data_admissao, cargo, empresa_id")
        .eq("tenant_id", tenantId)
        .eq("empresa_id", empresaAtivaId)
        .eq("status", "concluido");

      if (error) throw error;
      if (!data || data.length === 0) return [];

      const today = new Date();
      const limite = addDays(today, 30);
      const items: CelebracaoItem[] = [];

      data.forEach((pessoa) => {
        // Check birthday
        if (pessoa.data_nascimento) {
          const birth = new Date(pessoa.data_nascimento);
          const thisYearBday = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
          if (thisYearBday < today) thisYearBday.setFullYear(today.getFullYear() + 1);
          const dias = differenceInDays(thisYearBday, today);
          if (dias >= 0 && dias <= 30) {
            items.push({
              nome: pessoa.nome_completo,
              tipo: "aniversario",
              data: thisYearBday,
              diasRestantes: dias,
              cargo: pessoa.cargo || undefined,
            });
          }
        }

        // Check work anniversary
        if (pessoa.data_admissao) {
          const adm = new Date(pessoa.data_admissao);
          const thisYearAdm = new Date(today.getFullYear(), adm.getMonth(), adm.getDate());
          if (thisYearAdm < today) thisYearAdm.setFullYear(today.getFullYear() + 1);
          const dias = differenceInDays(thisYearAdm, today);
          const anos = today.getFullYear() - adm.getFullYear();
          if (dias >= 0 && dias <= 30 && anos > 0) {
            items.push({
              nome: pessoa.nome_completo,
              tipo: "tempo_casa",
              data: thisYearAdm,
              diasRestantes: dias,
              anos,
              cargo: pessoa.cargo || undefined,
            });
          }
        }
        // Check dia da profissão
        if (pessoa.cargo) {
          const diaProfissao = buscarDiaProfissao(pessoa.cargo);
          if (diaProfissao) {
            const dataProfissao = new Date(today.getFullYear(), diaProfissao.mes - 1, diaProfissao.dia);
            if (dataProfissao < today) dataProfissao.setFullYear(today.getFullYear() + 1);
            const dias = differenceInDays(dataProfissao, today);
            if (dias >= 0 && dias <= 30) {
              // Avoid duplicates for same profession date
              const key = `profissao-${diaProfissao.mes}-${diaProfissao.dia}`;
              if (!items.find(i => i.tipo === "dia_profissao" && i.data.getTime() === dataProfissao.getTime() && i.cargo === pessoa.cargo)) {
                items.push({
                  nome: diaProfissao.nome,
                  tipo: "dia_profissao",
                  data: dataProfissao,
                  diasRestantes: dias,
                  cargo: pessoa.cargo || undefined,
                });
              }
            }
          }
        }
      });

      return items.sort((a, b) => a.diasRestantes - b.diasRestantes);
    },
    enabled: !!tenantId && !!empresaAtivaId,
  });

  // Merge ações pendentes as items
  const acoesProximas: CelebracaoItem[] = acoes
    .filter((a) => {
      if (a.status === "concluida" || a.status === "cancelada") return false;
      const dias = differenceInDays(new Date(a.data_referencia), new Date());
      return dias >= 0 && dias <= 30;
    })
    .map((a) => ({
      nome: a.colaborador_nome || a.titulo,
      tipo: "acao" as const,
      data: new Date(a.data_referencia),
      diasRestantes: differenceInDays(new Date(a.data_referencia), new Date()),
      acao: a,
    }));

  const celebracoes = [...celebracoesReais, ...acoesProximas].sort((a, b) => a.diasRestantes - b.diasRestantes);

  const handleCriarAcao = async (item: CelebracaoItem) => {
    if (!onCreateAcao) return;
    setCriandoAcao(item.nome);
    try {
      await onCreateAcao({
        tipo: item.tipo === "aniversario" ? "aniversario" : "tempo_casa",
        titulo: item.tipo === "aniversario"
          ? `Aniversário de ${item.nome}`
          : `${item.anos} anos de empresa - ${item.nome}`,
        colaborador_nome: item.nome,
        data_referencia: format(item.data, "yyyy-MM-dd"),
        status: "pendente",
      });
      toast.success("Ação criada! Ela também aparecerá no Mural Interno.");
    } catch {
      toast.error("Erro ao criar ação");
    } finally {
      setCriandoAcao(null);
    }
  };

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const getIcon = (tipo: string) => {
    if (tipo === "aniversario") return <Cake className="h-3.5 w-3.5" />;
    if (tipo === "tempo_casa") return <Award className="h-3.5 w-3.5" />;
    if (tipo === "dia_profissao") return <Briefcase className="h-3.5 w-3.5" />;
    return <CalendarHeart className="h-3.5 w-3.5" />;
  };

  const getBadgeLabel = (item: CelebracaoItem) => {
    if (item.tipo === "aniversario") return "Aniversário";
    if (item.tipo === "tempo_casa") return `${item.anos} ano${(item.anos || 0) > 1 ? "s" : ""} de empresa`;
    if (item.tipo === "dia_profissao") return "Dia da Profissão";
    return item.acao ? TIPO_ACAO_LABELS[item.acao.tipo] || "Ação" : "Ação";
  };

  const getDiasLabel = (dias: number) => {
    if (dias === 0) return "Hoje!";
    if (dias === 1) return "Amanhã";
    return `em ${dias} dias`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" strokeWidth={1.75} />
            Próximas Celebrações (30 dias)
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {celebracoes.slice(0, 8).map((item, i) => (
            <motion.div
              key={`${item.nome}-${item.tipo}-${i}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                item.diasRestantes === 0
                  ? "bg-primary/5 border border-primary/20"
                  : item.diasRestantes <= 3
                  ? "bg-amber-500/5 border border-amber-500/10"
                  : "hover:bg-muted/50"
              }`}
            >
              <Avatar className="h-10 w-10">
                {item.avatar && <AvatarImage src={item.avatar} />}
                <AvatarFallback className={
                  item.tipo === "aniversario"
                    ? "bg-pink-500/10 text-pink-600"
                    : item.tipo === "tempo_casa"
                    ? "bg-blue-500/10 text-blue-600"
                    : item.tipo === "dia_profissao"
                    ? "bg-amber-500/10 text-amber-600"
                    : "bg-violet-500/10 text-violet-600"
                }>
                  {getInitials(item.nome)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{item.nome}</p>
                  <Badge variant="outline" className="text-[10px] shrink-0 gap-1">
                    {getIcon(item.tipo)}
                    {getBadgeLabel(item)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {item.cargo && <span>{item.cargo}</span>}
                  {item.cargo && <span>·</span>}
                  <span>{format(item.data, "dd 'de' MMMM", { locale: ptBR })}</span>
                  <span className={`font-medium ${
                    item.diasRestantes === 0
                      ? "text-primary"
                      : item.diasRestantes <= 3
                      ? "text-amber-600"
                      : ""
                  }`}>
                    ({getDiasLabel(item.diasRestantes)})
                  </span>
                </div>
              </div>

              {item.tipo !== "acao" && onCreateAcao && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs shrink-0"
                  disabled={criandoAcao === item.nome}
                  onClick={() => handleCriarAcao(item)}
                >
                  {criandoAcao === item.nome ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3 mr-1" />
                      Criar Ação
                    </>
                  )}
                </Button>
              )}

              {item.tipo === "acao" && item.acao && item.acao.status !== "concluida" && onUpdateStatus && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs shrink-0"
                  onClick={() => onUpdateStatus(item.acao!.id, "concluida")}
                >
                  Concluir
                </Button>
              )}
              {item.tipo === "acao" && item.acao && item.acao.status === "concluida" && (
                <Badge className={`text-[10px] shrink-0 ${STATUS_ACAO_COLORS["concluida"]}`}>
                  Concluída
                </Badge>
              )}
            </motion.div>
          ))}

          {celebracoes.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma celebração nos próximos 30 dias
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
