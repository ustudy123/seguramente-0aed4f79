import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import {
  Building2, Users, Plus, Bug, Search, MoreVertical, Shield, TrendingUp, CheckCircle,
  UserPlus, Eye, Power, ArrowLeft, BookOpen, FileText, LayoutDashboard, Target,
  Activity, MessageSquare, Brain, FileSignature, Rocket, Edit, Trash2, AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useSuperAdmin, TenantWithStats } from '@/hooks/useSuperAdmin';
import { TenantForm } from '@/components/admin/TenantForm';
import { TenantOwnerForm } from '@/components/admin/TenantOwnerForm';
import { PromoverContaRaizModal } from '@/components/admin/PromoverContaRaizModal';
import { LandingLeadsTable } from '@/components/admin/LandingLeadsTable';
import { SuperAdminOverview } from '@/components/admin/superadmin/SuperAdminOverview';
import { LeadsCRMKanban } from '@/components/admin/superadmin/LeadsCRMKanban';
import { TenantsStatusPanel, UsuariosGlobalPanel } from '@/components/admin/superadmin/PanelTenantsUsuarios';
import { EmpresasPromociveisPanel } from '@/components/admin/superadmin/EmpresasPromociveisPanel';
import { PsicossocialSuperAdminPanel } from '@/components/admin/superadmin/PsicossocialSuperAdminPanel';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { tenants, isLoading, createTenant, updateTenant, toggleTenant, deleteTenant, isCreatingTenant, isUpdatingTenant } = useSuperAdmin();

  const [searchTerm, setSearchTerm] = useState('');
  const [showTenantForm, setShowTenantForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showOwnerForm, setShowOwnerForm] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<TenantWithStats | null>(null);
  const [showSpinoff, setShowSpinoff] = useState(false);
  const [spinoffTenant, setSpinoffTenant] = useState<TenantWithStats | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredTenants = tenants.filter(t =>
    t.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Conta empresas derivadas (total - principal) por tenant para saber se "Promover" faz sentido
  const { data: empresasAll = [] } = useQuery({
    queryKey: ['superadmin-empresas-all'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('superadmin_list_all_empresas');
      if (error) throw error;
      return (data || []) as Array<{ tenant_id: string; total_empresas_tenant: number }>;
    },
  });
  const derivadasPorTenant = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of empresasAll) {
      const total = Number(e.total_empresas_tenant) || 0;
      map.set(e.tenant_id, Math.max(0, total - 1));
    }
    return map;
  }, [empresasAll]);


  const handleToggleTenant = async (tenant: TenantWithStats) => {
    try {
      await toggleTenant({ id: tenant.id, ativo: !tenant.ativo });
      toast.success(tenant.ativo ? 'Empresa desativada' : 'Empresa ativada');
    } catch { toast.error('Erro ao alterar status'); }
  };

  const handleDeleteTenant = async () => {
    if (!selectedTenant || deleteConfirmationText !== 'EXCLUIR') return;

    try {
      setIsDeleting(true);
      await deleteTenant(selectedTenant.id);
      toast.success('Empresa excluída permanentemente');
      setShowDeleteConfirm(false);
      setSelectedTenant(null);
      setDeleteConfirmationText('');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao excluir empresa');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                <Shield className="w-7 h-7 text-primary" />
                Painel Super Admin
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Controle total da plataforma · Tenants, usuários, leads e operações
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/manual')}>
              <BookOpen className="w-4 h-4 mr-2" />Manual
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/qa')}>
              <Bug className="w-4 h-4 mr-2" />QA
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/blog')}>
              <FileText className="w-4 h-4 mr-2" />Blog
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/contratos')}>
              <FileSignature className="w-4 h-4 mr-2" />Contratos
            </Button>
            <Button onClick={() => setShowTenantForm(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" />Nova Empresa
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid grid-cols-4 md:grid-cols-7 w-full">
            <TabsTrigger value="overview"><LayoutDashboard className="w-4 h-4 mr-2" />Visão Geral</TabsTrigger>
            <TabsTrigger value="tenants"><Building2 className="w-4 h-4 mr-2" />Empresas</TabsTrigger>
            <TabsTrigger value="usuarios"><Users className="w-4 h-4 mr-2" />Usuários</TabsTrigger>
            <TabsTrigger value="leads"><Target className="w-4 h-4 mr-2" />Leads CRM</TabsTrigger>
            <TabsTrigger value="landing"><TrendingUp className="w-4 h-4 mr-2" />Landing</TabsTrigger>
            <TabsTrigger value="psicossocial"><Brain className="w-4 h-4 mr-2" />Psicossocial</TabsTrigger>
            <TabsTrigger value="situacao"><Activity className="w-4 h-4 mr-2" />Situação</TabsTrigger>
          </TabsList>

          <TabsContent value="overview"><SuperAdminOverview /></TabsContent>

          <TabsContent value="tenants">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Empresas Cadastradas</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Buscar empresa..." value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">Carregando...</div>
                ) : filteredTenants.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">Nenhuma empresa</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Slug</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead className="text-center">Usuários</TableHead>
                        <TableHead className="text-center">Colab.</TableHead>
                        <TableHead>Criado</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTenants.map((tenant) => (
                        <TableRow key={tenant.id}>
                          <TableCell className="font-medium">{tenant.nome}</TableCell>
                          <TableCell><code className="text-xs bg-muted px-2 py-1 rounded">{tenant.slug}</code></TableCell>
                          <TableCell><Badge variant="outline" className="capitalize">{tenant.plano}</Badge></TableCell>
                          <TableCell className="text-center">{tenant.total_usuarios}</TableCell>
                          <TableCell className="text-center">{tenant.total_colaboradores}</TableCell>
                          <TableCell className="text-xs">{format(new Date(tenant.created_at), 'dd/MM/yy', { locale: ptBR })}</TableCell>
                          <TableCell>
                            {tenant.ativo
                              ? <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Ativa</Badge>
                              : <Badge variant="destructive">Inativa</Badge>}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                 <DropdownMenuItem onClick={() => { setSelectedTenant(tenant); setShowEditForm(true); }}>
                                  <Edit className="w-4 h-4 mr-2" />Editar empresa
                                </DropdownMenuItem>
                                 <DropdownMenuItem onClick={() => navigate(`/admin/tenants/${tenant.id}`)}>
                                  <Eye className="w-4 h-4 mr-2" />Ver detalhes
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSelectedTenant(tenant); setShowOwnerForm(true); }}>
                                  <UserPlus className="w-4 h-4 mr-2" />Criar usuário owner
                                </DropdownMenuItem>
                                {(derivadasPorTenant.get(tenant.id) ?? 0) > 0 && (
                                  <DropdownMenuItem onClick={() => { setSpinoffTenant(tenant); setShowSpinoff(true); }}>
                                    <Rocket className="w-4 h-4 mr-2" />Promover empresa a Conta-Raiz
                                  </DropdownMenuItem>
                                )}

                                <DropdownMenuItem onClick={() => handleToggleTenant(tenant)}>
                                  <Power className="w-4 h-4 mr-2" />{tenant.ativo ? 'Desativar' : 'Ativar'}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <div className="mt-6">
              <EmpresasPromociveisPanel />
            </div>
          </TabsContent>

          <TabsContent value="usuarios"><UsuariosGlobalPanel /></TabsContent>

          <TabsContent value="leads"><LeadsCRMKanban /></TabsContent>

          <TabsContent value="landing"><LandingLeadsTable /></TabsContent>

          <TabsContent value="psicossocial"><PsicossocialSuperAdminPanel /></TabsContent>

          <TabsContent value="situacao"><TenantsStatusPanel /></TabsContent>
        </Tabs>
      </div>

      {/* Modais */}
      <Dialog open={showTenantForm} onOpenChange={setShowTenantForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Empresa</DialogTitle>
            <DialogDescription>Cadastre a empresa e o administrador principal</DialogDescription>
          </DialogHeader>
          {showTenantForm && (
            <TenantForm
              key={`tenant-form-${showTenantForm}`}
              onSubmit={async (data) => {
                try {
                  const result = await createTenant(data);
                  toast.success(result.inviteSent ? 'Empresa criada! Convite enviado.' : 'Empresa criada com sucesso!');
                  setShowTenantForm(false);
                } catch (e: any) { toast.error(e.message || 'Erro'); }
              }}
              isLoading={isCreatingTenant}
              onCancel={() => setShowTenantForm(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showEditForm} onOpenChange={setShowEditForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Empresa</DialogTitle>
            <DialogDescription>Atualize os dados da empresa</DialogDescription>
          </DialogHeader>
          {showEditForm && selectedTenant && (
            <TenantForm
              initialData={{
                nome: selectedTenant.nome,
                slug: selectedTenant.slug,
                plano: selectedTenant.plano,
                email: selectedTenant.email,
                telefone: selectedTenant.telefone,
                cnpj: selectedTenant.cnpj,
              }}
              onSubmit={async (data) => {
                try {
                  await updateTenant({
                    id: selectedTenant.id,
                    nome: data.nome,
                    slug: data.slug,
                    plano: data.plano,
                    email: data.email,
                    telefone: data.telefone,
                    cnpj: data.cnpj,
                  });
                  toast.success('Empresa atualizada com sucesso!');
                  setShowEditForm(false);
                  setSelectedTenant(null);
                } catch (e: any) {
                  toast.error(e.message || 'Erro ao atualizar empresa');
                }
              }}
              isLoading={isUpdatingTenant}
              onCancel={() => {
                setShowEditForm(false);
                setSelectedTenant(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showOwnerForm} onOpenChange={setShowOwnerForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Administrador - {selectedTenant?.nome}</DialogTitle>
            <DialogDescription>Crie um novo usuário administrador</DialogDescription>
          </DialogHeader>
          {selectedTenant && (
            <TenantOwnerForm
              tenantId={selectedTenant.id}
              onSuccess={() => { setShowOwnerForm(false); setSelectedTenant(null); }}
              onCancel={() => { setShowOwnerForm(false); setSelectedTenant(null); }}
            />
          )}
        </DialogContent>
      </Dialog>

      {spinoffTenant && (
        <PromoverContaRaizModal
          open={showSpinoff}
          onOpenChange={(v) => { setShowSpinoff(v); if (!v) setSpinoffTenant(null); }}
          tenantId={spinoffTenant.id}
          tenantNome={spinoffTenant.nome}
        />
      )}
    </div>
  );
}
