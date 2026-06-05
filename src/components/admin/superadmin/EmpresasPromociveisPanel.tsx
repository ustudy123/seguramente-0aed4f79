import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Rocket, Building2, ShieldCheck, Crown } from "lucide-react";
import { PromoverContaRaizModal } from "@/components/admin/PromoverContaRaizModal";
import { DefinirPrincipalModal } from "@/components/admin/DefinirPrincipalModal";
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
  tenant_owner_email: string | null;
}

export function EmpresasPromociveisPanel() {
  const [search, setSearch] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState<string>("__all__");
  const [target, setTarget] = useState<EmpresaRow | null>(null);
  const [open, setOpen] = useState(false);
  const [openPrincipal, setOpenPrincipal] = useState(false);

  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ["superadmin-empresas-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("superadmin_list_all_empresas");
      if (error) throw error;
      return (data || []) as EmpresaRow[];
    },
  });

  // Lista de empresas-mãe (principais) para o seletor
  const maes = useMemo(() => {
    const map = new Map<string, { tenant_id: string; tenant_nome: string; razao_social: string; total: number }>();
    for (const e of data) {
      if (e.is_principal) {
        map.set(e.tenant_id, {
          tenant_id: e.tenant_id,
          tenant_nome: e.tenant_nome,
          razao_social: e.razao_social,
          total: e.total_empresas_tenant - 1, // derivadas
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.razao_social.localeCompare(b.razao_social));
  }, [data]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return data.filter((e) => {
      // Quando uma mãe é selecionada, mostra só as derivadas dela
      if (selectedTenantId !== "__all__") {
        if (e.tenant_id !== selectedTenantId) return false;
        if (e.is_principal) return false;
      }
      if (!s) return true;
      return (
        e.razao_social?.toLowerCase().includes(s) ||
        e.cnpj?.toLowerCase().includes(s) ||
        e.tenant_nome?.toLowerCase().includes(s) ||
        e.tenant_owner_email?.toLowerCase().includes(s)
      );
    });
  }, [data, search, selectedTenantId]);

  const maeSelecionada = useMemo(
    () => maes.find((m) => m.tenant_id === selectedTenantId) || null,
    [maes, selectedTenantId]
  );

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
              <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Filtrar por empresa-mãe..." />
                </SelectTrigger>
                <SelectContent className="max-h-[400px]">
                  <SelectItem value="__all__">Todas as empresas (todos os tenants)</SelectItem>
                  {maes.map((m) => (
                    <SelectItem key={m.tenant_id} value={m.tenant_id}>
                      {m.razao_social} {m.total > 0 ? `(${m.total} derivada${m.total > 1 ? "s" : ""})` : "(sem derivadas)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTenantId !== "__all__" && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedTenantId("__all__")}>
                  Limpar
                </Button>
              )}
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar empresa, CNPJ, tenant ou email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {maeSelecionada && (
            <div className="mb-4 p-3 rounded-md border bg-muted/40 text-sm">
              Exibindo derivadas de <strong>{maeSelecionada.razao_social}</strong> · tenant <code className="text-xs">{maeSelecionada.tenant_nome}</code>
            </div>
          )}
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
                  <TableHead>Proprietário</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Criada</TableHead>
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {maes.map((m) => {
                  // Recuperamos o objeto original da empresa principal para ter todos os campos (cnpj, ativo, etc)
                  const mae = data.find(e => e.tenant_id === m.tenant_id && e.is_principal);
                  if (!mae) return null;

                  const derivadas = data.filter(e => e.tenant_id === mae.tenant_id && !e.is_principal);
                  const isExpanded = selectedTenantId === mae.tenant_id;
                  
                  const searchTerms = search.toLowerCase().trim();
                  const matchesSearch = (row: EmpresaRow) => 
                    !searchTerms || 
                    row.razao_social?.toLowerCase().includes(searchTerms) ||
                    row.cnpj?.toLowerCase().includes(searchTerms) ||
                    row.tenant_owner_email?.toLowerCase().includes(searchTerms);

                  if (selectedTenantId !== "__all__" && !isExpanded) return null;
                  if (!matchesSearch(mae) && !derivadas.some(matchesSearch)) return null;

                  return (
                    <React.Fragment key={mae.tenant_id}>
                      <TableRow 
                        className={`cursor-pointer transition-colors ${isExpanded ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/50'}`}
                        onClick={() => setSelectedTenantId(isExpanded ? "__all__" : mae.tenant_id)}
                      >
                        <TableCell className="font-bold flex items-center gap-2">
                          {derivadas.length > 0 && (
                            <div className="w-4 h-4 flex items-center justify-center font-mono text-xs">
                              {isExpanded ? "−" : "+"}
                            </div>
                          )}
                          {mae.razao_social}
                          {!mae.ativo && <Badge variant="secondary" className="ml-2">Inativa</Badge>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{mae.cnpj || "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold">{mae.tenant_nome}</span>
                            <code className="text-[10px] text-muted-foreground">{mae.tenant_slug}</code>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{mae.total_empresas_tenant}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {mae.tenant_owner_email || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-primary/10 text-primary border-primary/20">
                            <ShieldCheck className="w-3 h-3 mr-1" />Principal
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {format(new Date(mae.empresa_created_at), "dd/MM/yy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled
                            className="opacity-50"
                          >
                            <Rocket className="w-3.5 h-3.5 mr-1" />
                            Promover
                          </Button>
                        </TableCell>
                      </TableRow>

                      {isExpanded && derivadas.filter(matchesSearch).map((e) => (
                        <TableRow key={e.empresa_id} className="bg-muted/30 border-l-4 border-l-primary/30">
                          <TableCell className="pl-8 font-medium italic text-muted-foreground">
                            └ {e.razao_social}
                            {!e.ativo && <Badge variant="secondary" className="ml-2">Inativa</Badge>}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground opacity-70">{e.cnpj || "—"}</TableCell>
                          <TableCell className="opacity-70">
                            <span className="text-xs italic">Mesmo tenant</span>
                          </TableCell>
                          <TableCell className="text-center opacity-70">—</TableCell>
                          <TableCell className="text-xs text-muted-foreground opacity-70">
                            {e.tenant_owner_email || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-muted-foreground">Derivada</Badge>
                          </TableCell>
                          <TableCell className="text-xs opacity-70">
                            {format(new Date(e.empresa_created_at), "dd/MM/yy", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={(ev) => { ev.stopPropagation(); setTarget(e); setOpen(true); }}
                                title="Promover a Conta-Raiz (Novo Tenant)"
                              >
                                <Rocket className="w-3.5 h-3.5 mr-1" />
                                Promover
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-amber-200 hover:bg-amber-50 text-amber-600"
                                onClick={(ev) => { ev.stopPropagation(); setTarget(e); setOpenPrincipal(true); }}
                                title="Tornar esta a unidade Principal (Matriz) dentro do mesmo tenant"
                              >
                                <Crown className="w-3.5 h-3.5 mr-1" />
                                Matriz
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  );
                })}
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

      {target && (
        <DefinirPrincipalModal
          open={openPrincipal}
          onOpenChange={(v) => { setOpenPrincipal(v); if (!v) setTarget(null); }}
          empresaId={target.empresa_id}
          empresaNome={target.razao_social}
          tenantId={target.tenant_id}
          tenantNome={target.tenant_nome}
          onSuccess={() => refetch()}
        />
      )}
    </>
  );
}
