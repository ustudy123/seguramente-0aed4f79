 import { useState } from 'react';
 import { useNavigate } from 'react-router-dom';
 import { 
   Building2, 
   Users, 
   Plus, 
   Search, 
   MoreVertical,
    Shield,
    TrendingUp,
    CheckCircle,
    XCircle,
    UserPlus,
    Eye,
    Edit,
    Power,
    ArrowLeft,
    BookOpen,
  } from 'lucide-react';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Badge } from '@/components/ui/badge';
 import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
 } from '@/components/ui/table';
 import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
 } from '@/components/ui/dropdown-menu';
 import {
   Dialog,
   DialogContent,
  DialogDescription,
   DialogHeader,
   DialogTitle,
 } from '@/components/ui/dialog';
 import { useSuperAdmin, TenantWithStats } from '@/hooks/useSuperAdmin';
 import { TenantForm } from '@/components/admin/TenantForm';
import { TenantOwnerForm } from '@/components/admin/TenantOwnerForm';
import { LandingLeadsTable } from '@/components/admin/LandingLeadsTable';
 import { format } from 'date-fns';
 import { ptBR } from 'date-fns/locale';
 import { toast } from 'sonner';
 
 export default function SuperAdminDashboard() {
   const navigate = useNavigate();
   const { 
     tenants, 
     isLoading, 
     createTenant, 
     toggleTenant,
     isCreatingTenant 
   } = useSuperAdmin();
   
   const [searchTerm, setSearchTerm] = useState('');
   const [showTenantForm, setShowTenantForm] = useState(false);
   const [showOwnerForm, setShowOwnerForm] = useState(false);
   const [selectedTenant, setSelectedTenant] = useState<TenantWithStats | null>(null);
 
   const filteredTenants = tenants.filter(t =>
     t.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
     t.slug.toLowerCase().includes(searchTerm.toLowerCase())
   );
 
   const stats = {
     totalEmpresas: tenants.length,
     empresasAtivas: tenants.filter(t => t.ativo).length,
     totalUsuarios: tenants.reduce((acc, t) => acc + t.total_usuarios, 0),
     totalColaboradores: tenants.reduce((acc, t) => acc + t.total_colaboradores, 0),
   };
 
   const handleToggleTenant = async (tenant: TenantWithStats) => {
     try {
       await toggleTenant({ id: tenant.id, ativo: !tenant.ativo });
       toast.success(tenant.ativo ? 'Empresa desativada' : 'Empresa ativada');
     } catch (error) {
       toast.error('Erro ao alterar status da empresa');
     }
   };
 
   const handleCreateOwner = (tenant: TenantWithStats) => {
     setSelectedTenant(tenant);
     setShowOwnerForm(true);
   };
 
   return (
     <div className="min-h-screen bg-background p-6">
       <div className="max-w-7xl mx-auto space-y-6">
         {/* Header */}
         <div className="flex items-center justify-between">
           <div>
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/')}
                  className="shrink-0"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                  <Shield className="w-8 h-8 text-primary" />
                  Painel Super Admin
                </h1>
              </div>
             <p className="text-muted-foreground mt-1">
               Gerencie todas as empresas cadastradas no sistema
             </p>
           </div>
             <div className="flex items-center gap-2">
               <Button variant="outline" onClick={() => {
                 const url = `${window.location.origin}/lp`;
                 navigator.clipboard.writeText(url);
                 toast.success('Link da landing page copiado!');
               }}>
                 <TrendingUp className="w-4 h-4 mr-2" />
                 Copiar Link LP
               </Button>
               <Button variant="outline" onClick={() => window.open('/lp', '_blank')}>
                 <Eye className="w-4 h-4 mr-2" />
                 Ver Landing Page
               </Button>
               <Button variant="outline" onClick={() => navigate('/admin/manual')}>
                 <BookOpen className="w-4 h-4 mr-2" />
                 Manual do Sistema
               </Button>
               <Button onClick={() => setShowTenantForm(true)}>
                 <Plus className="w-4 h-4 mr-2" />
                 Nova Empresa
               </Button>
             </div>
         </div>
 
         {/* Stats */}
         <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
           <Card>
             <CardContent className="p-4">
               <div className="flex items-center gap-3">
                 <div className="p-2 rounded-lg bg-primary/10">
                   <Building2 className="w-5 h-5 text-primary" />
                 </div>
                 <div>
                   <p className="text-sm text-muted-foreground">Total Empresas</p>
                   <p className="text-2xl font-bold">{stats.totalEmpresas}</p>
                 </div>
               </div>
             </CardContent>
           </Card>
           <Card>
             <CardContent className="p-4">
               <div className="flex items-center gap-3">
                 <div className="p-2 rounded-lg bg-success/10">
                   <CheckCircle className="w-5 h-5 text-success" />
                 </div>
                 <div>
                   <p className="text-sm text-muted-foreground">Ativas</p>
                   <p className="text-2xl font-bold">{stats.empresasAtivas}</p>
                 </div>
               </div>
             </CardContent>
           </Card>
           <Card>
             <CardContent className="p-4">
               <div className="flex items-center gap-3">
                 <div className="p-2 rounded-lg bg-info/10">
                   <Users className="w-5 h-5 text-info" />
                 </div>
                 <div>
                   <p className="text-sm text-muted-foreground">Usuários</p>
                   <p className="text-2xl font-bold">{stats.totalUsuarios}</p>
                 </div>
               </div>
             </CardContent>
           </Card>
           <Card>
             <CardContent className="p-4">
               <div className="flex items-center gap-3">
                 <div className="p-2 rounded-lg bg-warning/10">
                   <TrendingUp className="w-5 h-5 text-warning" />
                 </div>
                 <div>
                   <p className="text-sm text-muted-foreground">Colaboradores</p>
                   <p className="text-2xl font-bold">{stats.totalColaboradores}</p>
                 </div>
               </div>
             </CardContent>
           </Card>
         </div>

          {/* Leads da Landing Page */}
          <LandingLeadsTable />

          {/* Tenants List */}
         <Card>
           <CardHeader className="flex flex-row items-center justify-between">
             <CardTitle>Empresas Cadastradas</CardTitle>
             <div className="relative w-64">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
               <Input
                 placeholder="Buscar empresa..."
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="pl-9"
               />
             </div>
           </CardHeader>
           <CardContent>
             {isLoading ? (
               <div className="flex items-center justify-center py-8">
                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
               </div>
             ) : filteredTenants.length === 0 ? (
               <div className="text-center py-8 text-muted-foreground">
                 {searchTerm ? 'Nenhuma empresa encontrada' : 'Nenhuma empresa cadastrada ainda'}
               </div>
             ) : (
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead>Empresa</TableHead>
                     <TableHead>Slug</TableHead>
                     <TableHead>Plano</TableHead>
                     <TableHead className="text-center">Usuários</TableHead>
                     <TableHead className="text-center">Colaboradores</TableHead>
                     <TableHead>Criado em</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead className="w-12"></TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {filteredTenants.map((tenant) => (
                     <TableRow key={tenant.id}>
                       <TableCell className="font-medium">{tenant.nome}</TableCell>
                       <TableCell>
                         <code className="text-xs bg-muted px-2 py-1 rounded">
                           {tenant.slug}
                         </code>
                       </TableCell>
                       <TableCell>
                         <Badge variant="outline" className="capitalize">
                           {tenant.plano}
                         </Badge>
                       </TableCell>
                       <TableCell className="text-center">{tenant.total_usuarios}</TableCell>
                       <TableCell className="text-center">{tenant.total_colaboradores}</TableCell>
                       <TableCell>
                         {format(new Date(tenant.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                       </TableCell>
                       <TableCell>
                         {tenant.ativo ? (
                           <Badge className="bg-success/10 text-success hover:bg-success/20">
                             Ativa
                           </Badge>
                         ) : (
                           <Badge variant="destructive">Inativa</Badge>
                         )}
                       </TableCell>
                       <TableCell>
                         <DropdownMenu>
                           <DropdownMenuTrigger asChild>
                             <Button variant="ghost" size="icon">
                               <MoreVertical className="w-4 h-4" />
                             </Button>
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align="end">
                             <DropdownMenuItem onClick={() => navigate(`/admin/tenants/${tenant.id}`)}>
                               <Eye className="w-4 h-4 mr-2" />
                               Ver detalhes
                             </DropdownMenuItem>
                             <DropdownMenuItem onClick={() => handleCreateOwner(tenant)}>
                               <UserPlus className="w-4 h-4 mr-2" />
                               Criar usuário owner
                             </DropdownMenuItem>
                             <DropdownMenuItem onClick={() => handleToggleTenant(tenant)}>
                               <Power className="w-4 h-4 mr-2" />
                               {tenant.ativo ? 'Desativar' : 'Ativar'}
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
        </div>
 
       {/* Modal - Novo Tenant */}
       <Dialog open={showTenantForm} onOpenChange={setShowTenantForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
           <DialogHeader>
             <DialogTitle>Nova Empresa</DialogTitle>
            <DialogDescription>
              Cadastre a empresa e o administrador principal
            </DialogDescription>
           </DialogHeader>
           <TenantForm
             onSubmit={async (data) => {
               try {
                const result = await createTenant(data);
                if (result.inviteSent) {
                  toast.success('Empresa criada! Convite enviado para o e-mail do administrador.');
                } else {
                  toast.success('Empresa criada com sucesso! Credenciais definidas.');
                }
                 setShowTenantForm(false);
               } catch (error: any) {
                 toast.error(error.message || 'Erro ao criar empresa');
               }
             }}
             isLoading={isCreatingTenant}
             onCancel={() => setShowTenantForm(false)}
           />
         </DialogContent>
       </Dialog>
 
       {/* Modal - Criar Owner */}
       <Dialog open={showOwnerForm} onOpenChange={setShowOwnerForm}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>
              Adicionar Administrador - {selectedTenant?.nome}
             </DialogTitle>
            <DialogDescription>
              Crie um novo usuário administrador para esta empresa
            </DialogDescription>
           </DialogHeader>
           {selectedTenant && (
             <TenantOwnerForm
               tenantId={selectedTenant.id}
               onSuccess={() => {
                 setShowOwnerForm(false);
                 setSelectedTenant(null);
               }}
               onCancel={() => {
                 setShowOwnerForm(false);
                 setSelectedTenant(null);
               }}
             />
           )}
         </DialogContent>
       </Dialog>
     </div>
   );
 }