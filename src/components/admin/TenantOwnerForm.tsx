 import { useState } from 'react';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Loader2, Eye, EyeOff } from 'lucide-react';
 import { useSuperAdmin } from '@/hooks/useSuperAdmin';
 import { toast } from 'sonner';
 
 interface TenantOwnerFormProps {
   tenantId: string;
   onSuccess: () => void;
   onCancel: () => void;
 }
 
 export function TenantOwnerForm({ tenantId, onSuccess, onCancel }: TenantOwnerFormProps) {
   const { createTenantOwner } = useSuperAdmin();
   const [isLoading, setIsLoading] = useState(false);
   const [showPassword, setShowPassword] = useState(false);
   
   const [form, setForm] = useState({
     email: '',
     password: '',
     nomeCompleto: '',
   });
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     setIsLoading(true);
 
     try {
       await createTenantOwner({
         tenantId,
         email: form.email,
         password: form.password,
         nomeCompleto: form.nomeCompleto,
       });
       toast.success('Usuário owner criado com sucesso!');
       onSuccess();
     } catch (error: any) {
       toast.error(error.message || 'Erro ao criar usuário');
     } finally {
       setIsLoading(false);
     }
   };
 
   return (
     <form onSubmit={handleSubmit} className="space-y-4">
       <div className="space-y-2">
         <Label htmlFor="nomeCompleto">Nome Completo</Label>
         <Input
           id="nomeCompleto"
           placeholder="Nome do administrador"
           value={form.nomeCompleto}
           onChange={(e) => setForm(prev => ({ ...prev, nomeCompleto: e.target.value }))}
           required
         />
       </div>
 
       <div className="space-y-2">
         <Label htmlFor="email">Email</Label>
         <Input
           id="email"
           type="email"
           placeholder="admin@empresa.com"
           value={form.email}
           onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
           required
         />
       </div>
 
       <div className="space-y-2">
         <Label htmlFor="password">Senha</Label>
         <div className="relative">
           <Input
             id="password"
             type={showPassword ? 'text' : 'password'}
             placeholder="Senha inicial"
             value={form.password}
             onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
             required
             minLength={6}
           />
           <Button
             type="button"
             variant="ghost"
             size="icon"
             className="absolute right-0 top-0"
             onClick={() => setShowPassword(!showPassword)}
           >
             {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
           </Button>
         </div>
         <p className="text-xs text-muted-foreground">Mínimo de 6 caracteres</p>
       </div>
 
       <div className="flex justify-end gap-2 pt-4">
         <Button type="button" variant="outline" onClick={onCancel}>
           Cancelar
         </Button>
         <Button 
           type="submit" 
           disabled={isLoading || !form.email || !form.password || !form.nomeCompleto}
         >
           {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
           Criar Usuário
         </Button>
       </div>
     </form>
   );
 }