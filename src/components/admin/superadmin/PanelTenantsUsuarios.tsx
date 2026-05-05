import { useState } from "react";
import { useSuperAdminTenantsStatus, useSuperAdminUsuarios } from "@/hooks/useSuperAdminPainel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, Brain, Users as UsersIcon, Activity } from "lucide-react";

export function TenantsStatusPanel() {
  const { data = [], isLoading } = useSuperAdminTenantsStatus();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Situação por Empresa
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead className="text-center">Usuários</TableHead>
                <TableHead className="text-center">Colaboradores</TableHead>
                <TableHead className="text-center">Campanhas Psico</TableHead>
                <TableHead>Último Acesso</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((t: any) => (
                <TableRow key={t.tenant_id}>
                  <TableCell className="font-medium">{t.tenant_nome}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{t.plano}</Badge></TableCell>
                  <TableCell className="text-center">{t.usuarios}</TableCell>
                  <TableCell className="text-center">{t.colaboradores}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Brain className="w-3 h-3 text-violet-500" />
                      <span className="font-semibold">{t.campanhas_ativas}</span>
                      <span className="text-xs text-muted-foreground">/{t.campanhas_total}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {t.ultimo_acesso
                      ? formatDistanceToNow(new Date(t.ultimo_acesso), { locale: ptBR, addSuffix: true })
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {t.ativo ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Ativa</Badge>
                    ) : (
                      <Badge variant="destructive">Inativa</Badge>
                    )}
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

export function UsuariosGlobalPanel() {
  const [search, setSearch] = useState("");
  const { data = [], isLoading } = useSuperAdminUsuarios(search);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <UsersIcon className="w-5 h-5" /> Usuários (Cross-Tenant)
        </CardTitle>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou empresa..." className="pl-9" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cadastro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((u: any) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.nome_completo || "—"}</TableCell>
                  <TableCell className="text-xs">{u.email || "—"}</TableCell>
                  <TableCell>{u.tenant_nome || <span className="text-muted-foreground italic">sem empresa</span>}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{u.tipo_usuario || "—"}</Badge></TableCell>
                  <TableCell className="text-xs">
                    {u.created_at ? format(new Date(u.created_at), "dd/MM/yy", { locale: ptBR }) : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                  Nenhum usuário encontrado
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
