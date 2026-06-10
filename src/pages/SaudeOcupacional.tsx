import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Plus,
  FileText, 
  Calendar, 
  Shield, 
  Search, 
  Filter, 
  Download,
  AlertCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAtestados } from "@/hooks/useAtestados";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInDays, addYears, isAfter, isBefore, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AtestadoForm } from "@/components/atestados/AtestadoForm";

const SaudeOcupacional = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const { atestados, isLoading, createAtestado, creatingAtestado } = useAtestados();

  // Filtrar apenas atestados do tipo ocupacional
  const asos = atestados?.filter(a => a.tipo === 'ocupacional') || [];

  const filteredAsos = asos.filter(aso => 
    aso.colaborador_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    aso.profissional_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    aso.cid_codigo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Lógica de vencimento (simplificada: periódico vence em 1 ano, outros tipos variam)
  const getProximoVencimento = (aso: any) => {
    if (!aso.data_emissao) return null;
    const dataEmissao = new Date(aso.data_emissao);
    
    if (aso.subtipo_ocupacional === 'periodico') {
      return addYears(dataEmissao, 1);
    }
    // Para outros tipos, a lógica pode variar, aqui vamos assumir 1 ano por padrão para demonstração
    return addYears(dataEmissao, 1);
  };

  const getStatusVencimento = (dataVencimento: Date | null) => {
    if (!dataVencimento) return { label: "N/A", color: "bg-slate-100 text-slate-800" };
    
    const hoje = new Date();
    const trintaDias = addMonths(hoje, 1);

    if (isBefore(dataVencimento, hoje)) {
      return { label: "Vencido", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" };
    }
    if (isBefore(dataVencimento, trintaDias)) {
      return { label: "Próximo ao Vencimento", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" };
    }
    return { label: "Regular", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" };
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-[500px]" />
      </div>
    );
  }

  // Estatísticas simples
  const stats = {
    total: asos.length,
    vencidos: asos.filter(aso => {
      const venc = getProximoVencimento(aso);
      return venc && isBefore(venc, new Date());
    }).length,
    aVencer: asos.filter(aso => {
      const venc = getProximoVencimento(aso);
      return venc && isAfter(venc, new Date()) && isBefore(venc, addMonths(new Date(), 1));
    }).length,
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Saúde Ocupacional (ASO)</h1>
          <p className="text-muted-foreground">Gestão de exames ocupacionais e controle de periodicidade.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Relatório
          </Button>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo ASO
          </Button>
        </div>
      </header>

      <AtestadoForm 
        open={formOpen} 
        onOpenChange={setFormOpen} 
        onSubmit={createAtestado}
        loading={creatingAtestado}
      />

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border-blue-100 dark:border-blue-900/20 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center text-blue-700 dark:text-blue-400">
              <Shield className="h-4 w-4 mr-2" />
              Total de ASOs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.total}</div>
            <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">Registros no sistema</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/10 dark:to-rose-900/10 border-red-100 dark:border-red-900/20 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center text-red-700 dark:text-red-400">
              <AlertTriangle className="h-4 w-4 mr-2" />
              ASOs Vencidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-900 dark:text-red-100">{stats.vencidos}</div>
            <p className="text-xs text-red-600 dark:text-red-500 mt-1">Exames fora do prazo</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 border-amber-100 dark:border-amber-900/20 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center text-amber-700 dark:text-amber-400">
              <Clock className="h-4 w-4 mr-2" />
              A Vencer (30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">{stats.aVencer}</div>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">Exames próximos do prazo</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela/Lista */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-900/20 border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Buscar por colaborador ou médico..." 
                className="pl-9 bg-white dark:bg-slate-950"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-9">
                <Filter className="h-4 w-4 mr-2" />
                Filtros
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-[10px]">Colaborador</th>
                  <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-[10px]">Tipo de Exame</th>
                  <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-[10px]">Realizado em</th>
                  <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-[10px]">Próximo Vencimento</th>
                  <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-[10px]">Status</th>
                  <th className="text-right px-6 py-3 font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-[10px]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredAsos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      Nenhum registro de ASO encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredAsos.map((aso) => {
                    const dataVencimento = getProximoVencimento(aso);
                    const status = getStatusVencimento(dataVencimento);
                    
                    return (
                      <tr key={aso.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                              <Users className="h-4 w-4 text-slate-500" />
                            </div>
                            <div>
                              <div className="font-medium text-slate-900 dark:text-slate-100">{aso.colaborador_nome}</div>
                              <div className="text-[11px] text-slate-500">{aso.colaborador_cargo || 'Cargo não informado'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 capitalize text-slate-600 dark:text-slate-400">
                          <Badge variant="outline" className="font-normal border-slate-200 dark:border-slate-800">
                            {aso.subtipo_ocupacional?.replace('_', ' ') || 'Ocupacional'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                          {format(new Date(aso.data_emissao), "dd/MM/yyyy", { locale: ptBR })}
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                          {dataVencimento ? format(dataVencimento, "dd/MM/yyyy", { locale: ptBR }) : 'N/A'}
                        </td>
                        <td className="px-6 py-4">
                          <Badge className={status.color + " border-none shadow-none font-medium"}>
                            {status.label}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <FileText className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SaudeOcupacional;
