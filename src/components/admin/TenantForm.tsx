 import { useState } from 'react';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from '@/components/ui/select';
 import { Loader2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type TenantPlan = Database['public']['Enums']['tenant_plan'];
 
 interface TenantFormProps {
  onSubmit: (data: { nome: string; slug: string; plano: TenantPlan }) => Promise<void>;
   isLoading?: boolean;
   onCancel: () => void;
   initialData?: {
     nome?: string;
     slug?: string;
    plano?: TenantPlan;
   };
 }
 
 export function TenantForm({ onSubmit, isLoading, onCancel, initialData }: TenantFormProps) {
   const [nome, setNome] = useState(initialData?.nome || '');
   const [slug, setSlug] = useState(initialData?.slug || '');
  const [plano, setPlano] = useState<TenantPlan>(initialData?.plano || 'starter');
 
   const generateSlug = (name: string) => {
     return name
       .toLowerCase()
       .normalize('NFD')
       .replace(/[\u0300-\u036f]/g, '')
       .replace(/[^a-z0-9]+/g, '-')
       .replace(/^-|-$/g, '');
   };
 
   const handleNomeChange = (value: string) => {
     setNome(value);
     if (!initialData?.slug) {
       setSlug(generateSlug(value));
     }
   };
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     await onSubmit({ nome, slug, plano });
   };
 
   return (
     <form onSubmit={handleSubmit} className="space-y-4">
       <div className="space-y-2">
         <Label htmlFor="nome">Nome da Empresa</Label>
         <Input
           id="nome"
           placeholder="Ex: Empresa ABC Ltda"
           value={nome}
           onChange={(e) => handleNomeChange(e.target.value)}
           required
         />
       </div>
 
       <div className="space-y-2">
         <Label htmlFor="slug">Slug (identificador único)</Label>
         <Input
           id="slug"
           placeholder="empresa-abc"
           value={slug}
           onChange={(e) => setSlug(e.target.value)}
           required
         />
         <p className="text-xs text-muted-foreground">
           Usado para URLs e identificação interna
         </p>
       </div>
 
       <div className="space-y-2">
         <Label htmlFor="plano">Plano</Label>
        <Select value={plano} onValueChange={(v) => setPlano(v as TenantPlan)}>
           <SelectTrigger>
             <SelectValue placeholder="Selecione o plano" />
           </SelectTrigger>
           <SelectContent>
             <SelectItem value="starter">Starter</SelectItem>
             <SelectItem value="professional">Professional</SelectItem>
             <SelectItem value="enterprise">Enterprise</SelectItem>
           </SelectContent>
         </Select>
       </div>
 
       <div className="flex justify-end gap-2 pt-4">
         <Button type="button" variant="outline" onClick={onCancel}>
           Cancelar
         </Button>
         <Button type="submit" disabled={isLoading || !nome || !slug}>
           {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
           Criar Empresa
         </Button>
       </div>
     </form>
   );
 }