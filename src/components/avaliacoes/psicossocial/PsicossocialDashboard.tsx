import { useState } from "react";
import { 
  Brain, 
  Users, 
  Send, 
  BarChart3, 
  Plus,
  QrCode,
  Link as LinkIcon,
  AlertTriangle,
  TrendingUp,
  Heart
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { usePsicossocial } from "@/hooks/usePsicossocial";
import { CampanhaList } from "./CampanhaList";
import { CampanhaForm } from "./CampanhaForm";
import { ChecklistDeteccaoObservavel } from "./ChecklistDeteccaoObservavel";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function PsicossocialDashboard() {
  const [showForm, setShowForm] = useState(false);
  const { campanhas, campanhasAtivas, isLoadingCampanhas } = usePsicossocial();

  // Calcular estatísticas gerais
  const totalCampanhas = campanhas.length;
  const campanhasEncerradas = campanhas.filter(c => c.status === 'encerrada').length;

  if (isLoadingCampanhas) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-600" />
            Questionário Psicossocial
          </h2>
          <p className="text-muted-foreground">
            Avaliação de riscos psicossociais conforme NR-01, NR-17 e ISO 45003
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Campanha
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Campanhas Ativas</CardTitle>
            <div className="p-2 rounded-lg bg-purple-100">
              <Brain className="h-4 w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campanhasAtivas}</div>
            <p className="text-xs text-muted-foreground">
              de {totalCampanhas} campanhas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Respostas Coletadas</CardTitle>
            <div className="p-2 rounded-lg bg-blue-100">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">
              Selecione uma campanha
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">IRP-S Médio</CardTitle>
            <div className="p-2 rounded-lg bg-amber-100">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">
              Índice Risco Psicossocial
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Campanhas Concluídas</CardTitle>
            <div className="p-2 rounded-lg bg-emerald-100">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campanhasEncerradas}</div>
            <p className="text-xs text-muted-foreground">
              histórico disponível
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Indicadores Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Indicadores Gerados</CardTitle>
          <CardDescription>
            O questionário gera automaticamente os seguintes indicadores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="p-2 rounded-full bg-red-100">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="font-medium text-sm">IRP-S</p>
                <p className="text-xs text-muted-foreground">Risco Psicossocial</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="p-2 rounded-full bg-orange-100">
                <Brain className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <p className="font-medium text-sm">IBO-S</p>
                <p className="text-xs text-muted-foreground">Burnout</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="p-2 rounded-full bg-purple-100">
                <Heart className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-sm">IBD-S</p>
                <p className="text-xs text-muted-foreground">Boreout</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="p-2 rounded-full bg-blue-100">
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-sm">IREC-S</p>
                <p className="text-xs text-muted-foreground">Recuperação</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="p-2 rounded-full bg-emerald-100">
                <BarChart3 className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="font-medium text-sm">ICOP-S</p>
                <p className="text-xs text-muted-foreground">Clareza Organizacional</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Canais de Distribuição */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Canais de Distribuição</CardTitle>
          <CardDescription>
            Múltiplas formas de enviar o questionário aos colaboradores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex items-center gap-3 p-4 rounded-lg border">
              <div className="p-2 rounded-full bg-blue-100">
                <LinkIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">Link Único</p>
                <p className="text-sm text-muted-foreground">Envie por WhatsApp ou email</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg border">
              <div className="p-2 rounded-full bg-purple-100">
                <QrCode className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium">QR Code</p>
                <p className="text-sm text-muted-foreground">Imprima ou exiba em telas</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg border opacity-60">
              <div className="p-2 rounded-full bg-emerald-100">
                <Send className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-medium">WhatsApp API</p>
                <p className="text-sm text-muted-foreground">Em breve</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg border opacity-60">
              <div className="p-2 rounded-full bg-amber-100">
                <Users className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-medium">Totem/Quiosque</p>
                <p className="text-sm text-muted-foreground">Em breve</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Checklist de Detecção Observável */}
      <ChecklistDeteccaoObservavel />

      {/* Lista de Campanhas */}
      <CampanhaList campanhas={campanhas} onNovaCampanha={() => setShowForm(true)} />

      {/* Modal de Nova Campanha */}
      <CampanhaForm 
        open={showForm} 
        onOpenChange={setShowForm} 
      />
    </div>
  );
}
