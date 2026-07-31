import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, Bot, FileText, History, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useYourEyes } from '@/hooks/useYourEyes';
import { YourEyesAgentesPanel } from '@/components/admin/youreyes/YourEyesAgentesPanel';
import { YourEyesDocsPanel } from '@/components/admin/youreyes/YourEyesDocsPanel';
import { YourEyesExecucoesPanel } from '@/components/admin/youreyes/YourEyesExecucoesPanel';

export default function YourEyesDashboard() {
  const navigate = useNavigate();
  const { agentes, documentos, execucoes } = useYourEyes();

  const execucoesFinalizadas = execucoes.filter((e) => e.status !== 'executando');
  const taxaSucesso = execucoesFinalizadas.length > 0
    ? Math.round((execucoesFinalizadas.filter((e) => e.status === 'sucesso').length / execucoesFinalizadas.length) * 100)
    : null;

  const stats = [
    { label: 'Agentes ativos', valor: `${agentes.filter((a) => a.ativo).length}/${agentes.length}`, icon: Bot },
    { label: 'Documentos de teste', valor: String(documentos.length), icon: FileText },
    { label: 'Execuções registradas', valor: String(execucoes.length), icon: History },
    { label: 'Taxa de sucesso', valor: taxaSucesso !== null ? `${taxaSucesso}%` : '—', icon: CheckCircle2 },
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Eye className="w-7 h-7 text-primary" />
              YourEyes · Central de Testes
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Equipe de agentes de IA com execuções agendadas · Documentação de testes por módulo · Exclusivo superadmin
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <s.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold leading-none">{s.valor}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="agentes" className="space-y-6">
          <TabsList>
            <TabsTrigger value="agentes"><Bot className="w-4 h-4 mr-2" />Equipe de Agentes</TabsTrigger>
            <TabsTrigger value="documentacao"><FileText className="w-4 h-4 mr-2" />Documentação</TabsTrigger>
            <TabsTrigger value="execucoes"><History className="w-4 h-4 mr-2" />Execuções</TabsTrigger>
          </TabsList>

          <TabsContent value="agentes"><YourEyesAgentesPanel /></TabsContent>
          <TabsContent value="documentacao"><YourEyesDocsPanel /></TabsContent>
          <TabsContent value="execucoes"><YourEyesExecucoesPanel /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
