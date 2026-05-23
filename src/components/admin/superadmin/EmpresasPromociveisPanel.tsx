import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Rocket, Building2, ShieldCheck } from "lucide-react";
import { PromoverContaRaizModal } from "@/components/admin/PromoverContaRaizModal";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EmpresaRow {
  empresa_id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  ativo: boolean;
  empresa_created_at: string;
  tenant_id: string;
  tenant_nome: string;
  tenant_slug: string;
  total_empresas_tenant: number;
  is_principal: boolean;
}

export function EmpresasPromociveisPanel() {
  const [search, setSearch] = useState("");
  const [onlyDerivadas, setOnlyDerivadas] = useState(true);
  const [target, setTarget] = useState<EmpresaRow | null>(null);
  const [open, setOpen] = useState(false);

  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ["superadmin-empresas-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("superadmin_list_all_empresas");
      if (error) throw error;
      return (data || []) as EmpresaRow[];
    },
  });

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return data.filter((e) => {
      if (onlyDerivadas && e.is_principal) return false;
      if (!s) return true;
      return (
        e.razao_social?.toLowerCase().includes(s) ||
        e.cnpj?.toLowerCase().includes(s) ||
        e.tenant_nome?.toLowerCase().includes(s)
      );
    });
  }, [data, search, onlyDerivadas]);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Empresas (todas, incluindo derivadas)
              </CardTitle>
              <CardDescription>
                Lista todas as empresas cadastradas em cada tenant. Promova uma empresa derivada para transformá-la em Conta-Raiz independente.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant={onlyDerivadas ? "default" : "outline"}
                size="sm"
                onClick={() => setOnlyDerivadas((v) => !v)}
              >
                {onlyDerivadas ? "Mostrando: só derivadas" : "Mostrando: todas"}
              </Button>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar empresa, CNPJ ou tenant..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhuma empresa encontrada</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Tenant atual</TableHead>
                  <TableHead className="text-center">Empresas no tenant</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Criada</TableHead>
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.empresa_id}>
                    <TableCell className="font-medium">
                      {e.razao_social}
                      {!e.ativo && <Badge variant="secondary" className="ml-2">Inativa</Badge>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.cnpj || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">{e.tenant_nome}</span>
                        <code className="text-[10px] text-muted-foreground">{e.tenant_slug}</code>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{e.total_empresas_tenant}</TableCell>
                    <TableCell>
                      {e.is_principal ? (
                        <Badge className="bg-primary/10 text-primary border-primary/20">
                          <ShieldCheck className="w-3 h-3 mr-1" />Principal (raiz)
                        </Badge>
                      ) : (
                        <Badge variant="outline">Derivada</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(e.empresa_created_at), "dd/MM/yy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant={e.is_principal ? "ghost" : "default"}
                        disabled={e.is_principal}
                        onClick={() => { setTarget(e); setOpen(true); }}
                        title={e.is_principal ? "A empresa principal do tenant não pode ser promovida (já é a raiz)" : "Promover a Conta-Raiz"}
                      >
                        <Rocket className="w-3.5 h-3.5 mr-1" />
                        Promover
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {target && (
        <PromoverContaRaizModal
          open={open}
          onOpenChange={(v) => { setOpen(v); if (!v) setTarget(null); }}
          tenantId={target.tenant_id}
          tenantNome={target.tenant_nome}
          preselectedEmpresaId={target.empresa_id}
          preselectedEmpresaNome={target.razao_social}
          onSuccess={() => refetch()}
        />
      )}
    </>
  );
}
