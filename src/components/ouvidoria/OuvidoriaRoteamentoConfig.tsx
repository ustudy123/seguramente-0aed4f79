import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Settings, Save, Loader2, UserCheck, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useColaboradores } from "@/hooks/useColaboradores";
import { useDepartamentos } from "@/hooks/useCadastros";
import {
  TIPO_MANIFESTACAO_LABELS,
  TIPO_MANIFESTACAO_ICONS,
  type TipoManifestacao,
} from "@/types/ouvidoria";

interface Roteamento {
  tipo_manifestacao: string;
  departamento_responsavel: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
}

const TIPOS: TipoManifestacao[] = ["sugestao", "reclamacao", "denuncia", "elogio", "duvida"];

export function OuvidoriaRoteamentoConfig() {
  const { tenantId } = useTenant();
  const { colaboradores } = useColaboradores();
  const { departamentos } = useDepartamentos();
  const [roteamentos, setRoteamentos] = useState<Record<string, Roteamento>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    loadRoteamentos();
  }, [tenantId]);

  const loadRoteamentos = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ouvidoria_roteamento")
        .select("*")
        .eq("tenant_id", tenantId);

      if (error) throw error;

      const map: Record<string, Roteamento> = {};
      TIPOS.forEach((tipo) => {
        const existing = data?.find((r: any) => r.tipo_manifestacao === tipo);
        map[tipo] = {
          tipo_manifestacao: tipo,
          departamento_responsavel: existing?.departamento_responsavel || null,
          responsavel_id: existing?.responsavel_id || null,
          responsavel_nome: existing?.responsavel_nome || null,
        };
      });
      setRoteamentos(map);
    } catch (err) {
      console.error("Erro ao carregar roteamentos:", err);
      toast.error("Erro ao carregar configurações de roteamento");
    } finally {
      setLoading(false);
    }
  };

  const handleDepartamentoChange = (tipo: string, value: string) => {
    setRoteamentos((prev) => ({
      ...prev,
      [tipo]: {
        ...prev[tipo],
        departamento_responsavel: value === "none" ? null : value,
      },
    }));
  };

  const handleResponsavelChange = (tipo: string, value: string) => {
    const colab = colaboradores.find((c) => c.id === value);
    setRoteamentos((prev) => ({
      ...prev,
      [tipo]: {
        ...prev[tipo],
        responsavel_id: value === "none" ? null : value,
        responsavel_nome: value === "none" ? null : colab?.nome_completo || null,
      },
    }));
  };

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      for (const tipo of TIPOS) {
        const rot = roteamentos[tipo];
        if (!rot) continue;

        const { error } = await supabase
          .from("ouvidoria_roteamento")
          .upsert(
            {
              tenant_id: tenantId,
              tipo_manifestacao: tipo,
              departamento_responsavel: rot.departamento_responsavel,
              responsavel_id: rot.responsavel_id,
              responsavel_nome: rot.responsavel_nome,
              ativo: true,
            },
            { onConflict: "tenant_id,tipo_manifestacao" }
          );

        if (error) throw error;
      }
      toast.success("Configurações de roteamento salvas com sucesso!");
    } catch (err) {
      console.error("Erro ao salvar roteamentos:", err);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Roteamento de Manifestações
        </CardTitle>
        <CardDescription>
          Configure qual departamento ou pessoa será responsável por receber e tratar cada tipo de manifestação.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {TIPOS.map((tipo) => {
          const rot = roteamentos[tipo];
          return (
            <motion.div
              key={tipo}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-lg border bg-muted/30 space-y-4"
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{TIPO_MANIFESTACAO_ICONS[tipo]}</span>
                <h3 className="font-semibold">{TIPO_MANIFESTACAO_LABELS[tipo]}</h3>
                {(rot?.departamento_responsavel || rot?.responsavel_nome) && (
                  <Badge variant="secondary" className="text-xs ml-auto">
                    Configurado
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-sm">
                    <Building2 className="w-3.5 h-3.5" />
                    Departamento Responsável
                  </Label>
                  <Select
                    value={rot?.departamento_responsavel || "none"}
                    onValueChange={(v) => handleDepartamentoChange(tipo, v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um departamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum (todos os gestores)</SelectItem>
                      {departamentos.map((dep) => (
                        <SelectItem key={dep.id} value={dep.nome}>
                          {dep.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-sm">
                    <UserCheck className="w-3.5 h-3.5" />
                    Pessoa Responsável
                  </Label>
                  <Select
                    value={rot?.responsavel_id || "none"}
                    onValueChange={(v) => handleResponsavelChange(tipo, v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum (qualquer gestor)</SelectItem>
                      {colaboradores.map((colab) => (
                        <SelectItem key={colab.id} value={colab.id}>
                          {colab.nome_completo} — {colab.cargo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </motion.div>
          );
        })}

        <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Salvar Configurações
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
