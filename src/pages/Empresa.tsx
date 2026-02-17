import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Building2, Save, Shield, Users, TrendingUp, Clock, Target, Upload, ArrowLeft } from 'lucide-react';
import { useEmpresaCadastro } from '@/hooks/useEmpresaCadastro';
import { EmpresaDadosBasicos } from '@/components/empresa/EmpresaDadosBasicos';
import { EmpresaEnquadramentoLegal } from '@/components/empresa/EmpresaEnquadramentoLegal';
import { EmpresaObrigacoesInclusao } from '@/components/empresa/EmpresaObrigacoesInclusao';
import { EmpresaIndicadores } from '@/components/empresa/EmpresaIndicadores';
import { EmpresaJornadaCondicoes } from '@/components/empresa/EmpresaJornadaCondicoes';
import { EmpresaObrigacoesTab } from '@/components/empresa/EmpresaObrigacoesTab';
import { EmpresaImportExport } from '@/components/empresa/EmpresaImportExport';
import { EmpresaList } from '@/components/empresa/EmpresaList';
import type { EmpresaCadastro } from '@/types/empresa';
import { toast } from 'sonner';

type ViewMode = 'list' | 'edit' | 'new';

export default function Empresa() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string | null>(null);

  const {
    empresas,
    isLoadingList,
    cadastro,
    isLoading,
    upsertCadastro,
    toggleAtivoEmpresa,
  } = useEmpresaCadastro(viewMode === 'edit' ? selectedEmpresaId : undefined);

  const [formData, setFormData] = useState<Partial<EmpresaCadastro>>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (viewMode === 'edit' && cadastro) {
      setFormData(cadastro);
    }
    if (viewMode === 'new') {
      setFormData({});
    }
  }, [cadastro, viewMode]);

  const handleChange = (updates: Partial<EmpresaCadastro>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    await upsertCadastro.mutateAsync(formData);
    setHasChanges(false);
    setViewMode('list');
    setSelectedEmpresaId(null);
  };

  const handleEdit = (id: string) => {
    setSelectedEmpresaId(id);
    setViewMode('edit');
    setHasChanges(false);
  };

  const handleNew = () => {
    setSelectedEmpresaId(null);
    setFormData({});
    setViewMode('new');
    setHasChanges(false);
  };

  const handleToggleAtivo = (id: string, ativo: boolean) => {
    toggleAtivoEmpresa.mutate({ id, ativo }, {
      onSuccess: () => toast.success(ativo ? 'Empresa ativada' : 'Empresa inativada'),
      onError: (err: Error) => toast.error('Erro: ' + err.message),
    });
  };

  const handleBack = () => {
    setViewMode('list');
    setSelectedEmpresaId(null);
    setHasChanges(false);
  };

  // LIST VIEW
  if (viewMode === 'list') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="w-7 h-7 text-primary" />
            Empresas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie o cadastro de todas as empresas do grupo
          </p>
        </div>
        <EmpresaList
          empresas={empresas}
          isLoading={isLoadingList}
          onEdit={handleEdit}
          onNew={handleNew}
          onToggleAtivo={handleToggleAtivo}
        />
      </div>
    );
  }

  // EDIT/NEW VIEW
  const isFormLoading = viewMode === 'edit' && isLoading;

  if (isFormLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Building2 className="w-7 h-7 text-primary" />
              {viewMode === 'new' ? 'Nova Empresa' : 'Editar Empresa'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {viewMode === 'new'
                ? 'Preencha os dados para cadastrar uma nova empresa'
                : formData.razao_social || 'Cadastro da Empresa'}
            </p>
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || upsertCadastro.isPending}
        >
          {upsertCadastro.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Salvar
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="dados" className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-7">
          <TabsTrigger value="dados" className="text-xs">
            <Building2 className="w-3.5 h-3.5 mr-1 hidden sm:inline" />
            Dados
          </TabsTrigger>
          <TabsTrigger value="enquadramento" className="text-xs">
            <Shield className="w-3.5 h-3.5 mr-1 hidden sm:inline" />
            Enquadramento
          </TabsTrigger>
          <TabsTrigger value="inclusao" className="text-xs">
            <Users className="w-3.5 h-3.5 mr-1 hidden sm:inline" />
            Inclusão
          </TabsTrigger>
          <TabsTrigger value="indicadores" className="text-xs">
            <TrendingUp className="w-3.5 h-3.5 mr-1 hidden sm:inline" />
            Indicadores
          </TabsTrigger>
          <TabsTrigger value="jornada" className="text-xs">
            <Clock className="w-3.5 h-3.5 mr-1 hidden sm:inline" />
            Jornada
          </TabsTrigger>
          <TabsTrigger value="obrigacoes" className="text-xs">
            <Target className="w-3.5 h-3.5 mr-1 hidden sm:inline" />
            Obrigações
          </TabsTrigger>
          <TabsTrigger value="importar" className="text-xs">
            <Upload className="w-3.5 h-3.5 mr-1 hidden sm:inline" />
            Importar
          </TabsTrigger>
        </TabsList>

        <Card className="mt-4">
          <TabsContent value="dados" className="mt-0">
            <CardHeader>
              <CardTitle className="text-lg">Dados Básicos da Empresa</CardTitle>
              <CardDescription>Informações de identificação e localização</CardDescription>
            </CardHeader>
            <CardContent>
              <EmpresaDadosBasicos data={formData} onChange={handleChange} />
            </CardContent>
          </TabsContent>

          <TabsContent value="enquadramento" className="mt-0">
            <CardHeader>
              <CardTitle className="text-lg">Enquadramento Legal</CardTitle>
              <CardDescription>CNAE, Grau de Risco, SESMT e CIPA</CardDescription>
            </CardHeader>
            <CardContent>
              <EmpresaEnquadramentoLegal data={formData} onChange={handleChange} />
            </CardContent>
          </TabsContent>

          <TabsContent value="inclusao" className="mt-0">
            <CardHeader>
              <CardTitle className="text-lg">Obrigações de Inclusão</CardTitle>
              <CardDescription>Cotas PCD e Jovem Aprendiz</CardDescription>
            </CardHeader>
            <CardContent>
              <EmpresaObrigacoesInclusao data={formData} onChange={handleChange} />
            </CardContent>
          </TabsContent>

          <TabsContent value="indicadores" className="mt-0">
            <CardHeader>
              <CardTitle className="text-lg">Indicadores Previdenciários</CardTitle>
              <CardDescription>FAP e TAC</CardDescription>
            </CardHeader>
            <CardContent>
              <EmpresaIndicadores data={formData} onChange={handleChange} />
            </CardContent>
          </TabsContent>

          <TabsContent value="jornada" className="mt-0">
            <CardHeader>
              <CardTitle className="text-lg">Jornada e Condições Especiais</CardTitle>
              <CardDescription>Turnos, escalas e condições especiais de trabalho</CardDescription>
            </CardHeader>
            <CardContent>
              <EmpresaJornadaCondicoes data={formData} onChange={handleChange} />
            </CardContent>
          </TabsContent>

          <TabsContent value="obrigacoes" className="mt-0">
            <CardHeader>
              <CardTitle className="text-lg">Obrigações Detectadas</CardTitle>
              <CardDescription>
                Obrigações legais identificadas automaticamente a partir do cadastro
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmpresaObrigacoesTab cadastro={viewMode === 'edit' ? cadastro : null} />
            </CardContent>
          </TabsContent>

          <TabsContent value="importar" className="mt-0">
            <CardHeader>
              <CardTitle className="text-lg">Importação de Empresas</CardTitle>
              <CardDescription>Importe empresas via Excel/CSV ou baixe o modelo</CardDescription>
            </CardHeader>
            <CardContent>
              <EmpresaImportExport />
            </CardContent>
          </TabsContent>
        </Card>
      </Tabs>
    </div>
  );
}
