import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShieldCheck, Plus, Search, LayoutGrid, RefreshCw,
} from "lucide-react";
import { usePerfisAcesso, type PerfilAcesso, type PerfilPermissao } from "@/hooks/usePerfisAcesso";
import { PerfilCard } from "@/components/perfis/PerfilCard";
import { TemplateCard } from "@/components/perfis/TemplateCard";
import { PerfilFormDialog } from "@/components/perfis/PerfilFormDialog";
import { VinculosPerfilDialog } from "@/components/perfis/VinculosPerfilDialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function PerfisAcesso() {
  const {
    templates, loadingTemplates,
    perfis, loadingPerfis,
    vinculos, loadingVinculos,
    createPerfil, updatePerfil, togglePerfilStatus,
    clonarTemplate, vincularPerfil, desvincularPerfil,
  } = usePerfisAcesso();

  const { tenantId } = useAuth();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("perfis");
  const [perfilFormOpen, setPerfilFormOpen] = useState(false);
  const [perfilEditando, setPerfilEditando] = useState<PerfilAcesso | undefined>();
  const [perfilVinculos, setPerfilVinculos] = useState<PerfilAcesso | undefined>();
  const [submitting, setSubmitting] = useState(false);

  // Buscar usuários do tenant para vinculação
  const { data: usuarios = [] } = useQuery({
    queryKey: ["usuarios_base_lista", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await (supabase as any)
        .from("usuarios_base")
        .select("id, nome_completo, email_principal")
        .eq("tenant_id", tenantId)
        .order("nome_completo");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const perfisFiltered = perfis.filter((p) =>
    p.nome.toLowerCase().includes(search.toLowerCase()) ||
    p.descricao?.toLowerCase().includes(search.toLowerCase())
  );

  const perfisSistema = perfisFiltered.filter((p) => p.tipo !== "personalizado");
  const perfisPersonalizados = perfisFiltered.filter((p) => p.tipo === "personalizado");

  const templateIds = new Set(perfis.map((p) => p.template_origem_id).filter(Boolean));

  const handleCreateOrEdit = async (data: Partial<PerfilAcesso> & { permissoes: Partial<PerfilPermissao>[] }) => {
    setSubmitting(true);
    try {
      if (perfilEditando) {
        await updatePerfil.mutateAsync({ id: perfilEditando.id, ...data });
      } else {
        await createPerfil.mutateAsync(data);
      }
      setPerfilFormOpen(false);
      setPerfilEditando(undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditar = (perfil: PerfilAcesso) => {
    setPerfilEditando(perfil);
    setPerfilFormOpen(true);
  };

  const handleClonar = async (perfil: PerfilAcesso) => {
    await createPerfil.mutateAsync({
      nome: `${perfil.nome} (cópia)`,
      descricao: perfil.descricao,
      cor: perfil.cor,
      icone: perfil.icone,
      tipo: "personalizado",
      permissoes: perfil.permissoes || [],
    });
  };

  const loading = loadingTemplates || loadingPerfis;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Perfis & Níveis de Acesso</h1>
            <p className="text-sm text-muted-foreground">
              Configure quem pode acessar o quê no Seguramente
            </p>
          </div>
        </div>
        <Button
          onClick={() => { setPerfilEditando(undefined); setPerfilFormOpen(true); }}
          className="shrink-0"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Perfil
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Perfis ativos", value: perfis.filter((p) => p.ativo).length, color: "text-primary" },
          { label: "Templates disponíveis", value: templates.length, color: "text-violet-500" },
          { label: "Usuários com perfil", value: vinculos.length, color: "text-emerald-500" },
          { label: "Perfis personalizados", value: perfisPersonalizados.length, color: "text-amber-500" },
        ].map((stat) => (
          <div key={stat.label} className="border rounded-xl p-3 bg-card">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="perfis">
              Meus Perfis
              {perfis.length > 0 && <Badge variant="secondary" className="ml-1.5 h-4 text-[10px]">{perfis.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="templates">
              Templates do Sistema
              {templates.length > 0 && <Badge variant="secondary" className="ml-1.5 h-4 text-[10px]">{templates.length}</Badge>}
            </TabsTrigger>
          </TabsList>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar perfil..."
              className="pl-8 h-8 w-52 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Perfis do Tenant */}
        <TabsContent value="perfis" className="mt-4">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-36 rounded-xl" />
              ))}
            </div>
          ) : perfisFiltered.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <LayoutGrid className="w-10 h-10 text-muted-foreground/30 mx-auto" />
              <p className="text-muted-foreground font-medium">Nenhum perfil encontrado</p>
              <p className="text-sm text-muted-foreground/60">
                Crie um novo perfil ou use um template do sistema como base
              </p>
              <Button variant="outline" size="sm" onClick={() => setActiveTab("templates")}>
                <RefreshCw className="w-3.5 h-3.5 mr-2" />
                Ver templates
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {perfisSistema.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Baseados em template
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {perfisSistema.map((perfil, i) => (
                      <motion.div key={perfil.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                        <PerfilCard
                          perfil={perfil}
                          onEdit={handleEditar}
                          onClone={handleClonar}
                          onToggleStatus={(id, ativo) => togglePerfilStatus.mutate({ id, ativo })}
                          onVerVinculos={setPerfilVinculos}
                        />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
              {perfisPersonalizados.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Personalizados
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {perfisPersonalizados.map((perfil, i) => (
                      <motion.div key={perfil.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                        <PerfilCard
                          perfil={perfil}
                          onEdit={handleEditar}
                          onClone={handleClonar}
                          onToggleStatus={(id, ativo) => togglePerfilStatus.mutate({ id, ativo })}
                          onVerVinculos={setPerfilVinculos}
                        />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Templates */}
        <TabsContent value="templates" className="mt-4">
          {loadingTemplates ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates
                .filter((t) =>
                  t.nome.toLowerCase().includes(search.toLowerCase()) ||
                  t.descricao?.toLowerCase().includes(search.toLowerCase())
                )
                .map((template, i) => (
                  <motion.div key={template.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                    <TemplateCard
                      template={template}
                      onUsar={() => clonarTemplate.mutate(template)}
                      jaClonado={templateIds.has(template.id)}
                    />
                  </motion.div>
                ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <PerfilFormDialog
        open={perfilFormOpen}
        onClose={() => { setPerfilFormOpen(false); setPerfilEditando(undefined); }}
        perfilInicial={perfilEditando}
        onSubmit={handleCreateOrEdit}
        loading={submitting}
      />

      {perfilVinculos && (
        <VinculosPerfilDialog
          open={!!perfilVinculos}
          onClose={() => setPerfilVinculos(undefined)}
          perfil={perfilVinculos}
          vinculos={vinculos}
          usuarios={usuarios}
          onVincular={(usuarioId) => vincularPerfil.mutate({ usuario_id: usuarioId, perfil_id: perfilVinculos.id })}
          onDesvincular={(vinculoId) => desvincularPerfil.mutate(vinculoId)}
        />
      )}
    </div>
  );
}
