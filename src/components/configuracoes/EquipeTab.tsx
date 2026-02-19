import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { UserPlus, Mail, Key, Loader2, Users, Shield } from "lucide-react";

interface TenantUser {
  user_id: string;
  nome_completo: string | null;
  email?: string;
  roles: string[];
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Administrador",
  manager: "Gestor",
  user: "Usuário",
};

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  admin: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  manager: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  user: "bg-muted text-muted-foreground",
};

export function EquipeTab() {
  const { tenantId } = useTenant();
  const { hasMinimumRole } = useAuthContext();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("user");
  const [method, setMethod] = useState<"invite" | "password">("invite");
  const [password, setPassword] = useState("");

  const isOwner = hasMinimumRole("owner");

  // List users in this tenant
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["tenant-users", tenantId],
    queryFn: async (): Promise<TenantUser[]> => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("user_id, nome_completo")
        .eq("tenant_id", tenantId!)
        .order("nome_completo");

      if (error) throw error;

      // Get roles for all users
      const userIds = profiles.map((p) => p.user_id);
      const { data: allRoles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      const roleMap: Record<string, string[]> = {};
      allRoles?.forEach((r) => {
        if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
        roleMap[r.user_id].push(r.role);
      });

      return profiles.map((p) => ({
        user_id: p.user_id,
        nome_completo: p.nome_completo,
        roles: roleMap[p.user_id] || ["user"],
      }));
    },
    enabled: !!tenantId,
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("invite-tenant-user", {
        body: {
          email,
          nomeCompleto: nome,
          role,
          method,
          password: method === "password" ? password : undefined,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tenant-users"] });
      toast.success(
        data?.inviteSent
          ? "Convite enviado por e-mail!"
          : "Usuário criado com sucesso!"
      );
      resetForm();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao convidar usuário");
    },
  });

  const resetForm = () => {
    setNome("");
    setEmail("");
    setRole("user");
    setMethod("invite");
    setPassword("");
    setOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Equipe
          </CardTitle>
          <CardDescription>
            Gerencie os usuários com acesso ao sistema
          </CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Adicionar Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Usuário</DialogTitle>
              <DialogDescription>
                Convide um novo membro para sua equipe
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Nome Completo</Label>
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome do colaborador"
                />
              </div>

              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@empresa.com"
                />
              </div>

              <div className="space-y-2">
                <Label>Perfil de Acesso</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {isOwner && <SelectItem value="admin">Administrador</SelectItem>}
                    <SelectItem value="manager">Gestor</SelectItem>
                    <SelectItem value="user">Usuário</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Método de Acesso</Label>
                <RadioGroup
                  value={method}
                  onValueChange={(v) => setMethod(v as "invite" | "password")}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="invite" id="m-invite" />
                    <Label htmlFor="m-invite" className="flex items-center gap-1.5 cursor-pointer">
                      <Mail className="h-4 w-4" /> Convite por e-mail
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="password" id="m-password" />
                    <Label htmlFor="m-password" className="flex items-center gap-1.5 cursor-pointer">
                      <Key className="h-4 w-4" /> Criar com senha
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {method === "password" && (
                <div className="space-y-2">
                  <Label>Senha Temporária</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
              <Button
                onClick={() => inviteMutation.mutate()}
                disabled={
                  inviteMutation.isPending ||
                  !nome.trim() ||
                  !email.trim() ||
                  (method === "password" && password.length < 6)
                }
              >
                {inviteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : method === "invite" ? (
                  <Mail className="h-4 w-4 mr-2" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                {method === "invite" ? "Enviar Convite" : "Criar Usuário"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Nenhum usuário encontrado.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Perfil</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell className="font-medium">
                    {u.nome_completo || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1.5 flex-wrap">
                      {u.roles.map((r) => (
                        <Badge key={r} variant="outline" className={ROLE_COLORS[r] || ""}>
                          {ROLE_LABELS[r] || r}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
