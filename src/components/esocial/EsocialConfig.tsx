import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Shield, Upload, Plus, Trash2, CheckCircle2, AlertTriangle,
  Building2, UserCheck, KeyRound, RefreshCw, Eye, EyeOff
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Certificado {
  id: string;
  cnpj: string;
  nome_empresa: string;
  tipo: "propria" | "procuracao";
  cnpj_procurador?: string;
  nome_procurador?: string;
  certificado_path: string;
  certificado_nome: string;
  validade?: string;
  ambiente: "producao" | "homologacao";
  ativo: boolean;
  created_at: string;
}

export function EsocialConfig() {
  const { user, profile } = useAuth();
  const { tenant } = useTenant();
  const qc = useQueryClient();
  const tid = tenant?.id;

  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const [formData, setFormData] = useState({
    cnpj: "",
    nome_empresa: "",
    tipo: "propria" as "propria" | "procuracao",
    cnpj_procurador: "",
    nome_procurador: "",
    validade: "",
    ambiente: "homologacao" as "producao" | "homologacao",
    senha: "",
  });
  const [certFile, setCertFile] = useState<File | null>(null);

  const { data: certificados = [], isLoading } = useQuery({
    queryKey: ["esocial-certificados", tid],
    queryFn: async () => {
      if (!tid) return [];
      const { data, error } = await supabase
        .from("esocial_certificados" as any)
        .select("*")
        .eq("tenant_id", tid)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Certificado[];
    },
    enabled: !!tid,
  });

  const deleteCert = useMutation({
    mutationFn: async (id: string) => {
      const cert = certificados.find((c) => c.id === id);
      if (cert?.certificado_path) {
        await supabase.storage
          .from("esocial-certificados")
          .remove([cert.certificado_path]);
      }
      const { error } = await supabase
        .from("esocial_certificados" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["esocial-certificados"] });
      toast.success("Certificado removido");
    },
    onError: () => toast.error("Erro ao remover certificado"),
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("esocial_certificados" as any)
        .update({ ativo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["esocial-certificados"] });
    },
  });

  const handleUpload = async () => {
    if (!certFile || !tid) return;
    if (!formData.cnpj || !formData.nome_empresa) {
      toast.error("Preencha CNPJ e nome da empresa");
      return;
    }

    setUploading(true);
    try {
      const filePath = `${tid}/${Date.now()}_${certFile.name}`;

      const { error: storageErr } = await supabase.storage
        .from("esocial-certificados")
        .upload(filePath, certFile, { upsert: false });

      if (storageErr) throw storageErr;

      const payload: any = {
        tenant_id: tid,
        cnpj: formData.cnpj.replace(/\D/g, ""),
        nome_empresa: formData.nome_empresa,
        tipo: formData.tipo,
        certificado_path: filePath,
        certificado_nome: certFile.name,
        ambiente: formData.ambiente,
        ativo: true,
        criado_por: user?.id,
        criado_por_nome: profile?.nome_completo || user?.email,
      };

      if (formData.validade) payload.validade = formData.validade;
      if (formData.tipo === "procuracao") {
        payload.cnpj_procurador = formData.cnpj_procurador.replace(/\D/g, "");
        payload.nome_procurador = formData.nome_procurador;
      }

      const { error: dbErr } = await supabase
        .from("esocial_certificados" as any)
        .insert(payload);

      if (dbErr) {
        // Cleanup storage on DB error
        await supabase.storage.from("esocial-certificados").remove([filePath]);
        throw dbErr;
      }

      qc.invalidateQueries({ queryKey: ["esocial-certificados"] });
      toast.success("Certificado digital cadastrado com sucesso!");
      setShowForm(false);
      setCertFile(null);
      setFormData({
        cnpj: "", nome_empresa: "", tipo: "propria", cnpj_procurador: "",
        nome_procurador: "", validade: "", ambiente: "homologacao", senha: "",
      });
    } catch (err: any) {
      toast.error(err.message || "Erro ao cadastrar certificado");
    } finally {
      setUploading(false);
    }
  };

  const cnpjMask = (v: string) =>
    v.replace(/\D/g, "").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, "$1.$2.$3/$4-$5");

  const isVencido = (validade?: string) => {
    if (!validade) return false;
    return new Date(validade) < new Date();
  };

  const diasParaVencer = (validade?: string) => {
    if (!validade) return null;
    const diff = Math.ceil((new Date(validade).getTime() - Date.now()) / 86400000);
    return diff;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Integração eSocial
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Conecte ao portal eSocial usando certificado digital A1 (.pfx)
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} size="sm">
          <Plus className="w-4 h-4 mr-2" /> Adicionar Certificado
        </Button>
      </div>

      {/* Info card */}
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-3">
            <KeyRound className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-800 dark:text-blue-300">Certificado Digital A1</p>
              <p className="text-blue-700/80 dark:text-blue-400 mt-1">
                Suporte a <strong>certificado próprio da empresa</strong> e{" "}
                <strong>procuração eletrônica</strong> (escritório/procurador via e-CAC). 
                O arquivo <code>.pfx</code> é armazenado de forma segura e criptografada no servidor.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de certificados */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
      ) : certificados.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <Shield className="w-10 h-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground text-center">
              Nenhum certificado cadastrado.<br />
              Adicione um certificado A1 (.pfx) para habilitar a integração com o eSocial.
            </p>
            <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" /> Adicionar Certificado
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {certificados.map((cert) => {
            const dias = diasParaVencer(cert.validade);
            const vencido = isVencido(cert.validade);
            const vencendo = dias !== null && dias > 0 && dias <= 30;

            return (
              <Card key={cert.id} className={`transition-all ${!cert.ativo ? "opacity-60" : ""}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${cert.ativo ? "bg-primary/10" : "bg-muted"}`}>
                        {cert.tipo === "procuracao" ? (
                          <UserCheck className="w-5 h-5 text-primary" />
                        ) : (
                          <Building2 className="w-5 h-5 text-primary" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{cert.nome_empresa}</span>
                          <Badge variant="outline" className="text-xs">
                            {cert.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}
                          </Badge>
                          <Badge
                            variant={cert.ambiente === "producao" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {cert.ambiente === "producao" ? "Produção" : "Homologação"}
                          </Badge>
                          {cert.tipo === "procuracao" && (
                            <Badge variant="outline" className="text-xs border-purple-300 text-purple-700">
                              Procuração
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-muted-foreground">
                            📎 {cert.certificado_nome}
                          </span>
                          {cert.validade && (
                            <span
                              className={`text-xs font-medium ${
                                vencido
                                  ? "text-destructive"
                                  : vencendo
                                  ? "text-yellow-600"
                                  : "text-green-600"
                              }`}
                            >
                              {vencido
                                ? `⛔ Vencido em ${format(new Date(cert.validade), "dd/MM/yyyy")}`
                                : vencendo
                                ? `⚠️ Vence em ${dias} dias`
                                : `✓ Válido até ${format(new Date(cert.validade), "dd/MM/yyyy")}`}
                            </span>
                          )}
                        </div>

                        {cert.tipo === "procuracao" && cert.nome_procurador && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Procurador: <strong>{cert.nome_procurador}</strong>
                            {cert.cnpj_procurador && ` — ${cert.cnpj_procurador.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}`}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {vencido && <AlertTriangle className="w-4 h-4 text-destructive" />}
                      {!vencido && cert.ativo && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                      <Switch
                        checked={cert.ativo}
                        onCheckedChange={(v) => toggleAtivo.mutate({ id: cert.id, ativo: v })}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive h-8 w-8"
                        onClick={() => {
                          if (confirm("Remover este certificado?")) deleteCert.mutate(cert.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog de cadastro */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" /> Cadastrar Certificado Digital
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Tipo */}
            <div className="space-y-2">
              <Label>Tipo de Certificado</Label>
              <Select
                value={formData.tipo}
                onValueChange={(v: "propria" | "procuracao") =>
                  setFormData((f) => ({ ...f, tipo: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="propria">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Certificado da Própria Empresa
                    </div>
                  </SelectItem>
                  <SelectItem value="procuracao">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4" />
                      Procuração Eletrônica (Procurador)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {formData.tipo === "procuracao" && (
                <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                  💡 Para procuração, utilize o certificado do <strong>procurador</strong> (escritório/contador).
                  A procuração deve estar cadastrada no <strong>e-CAC</strong> com permissão para envio ao eSocial.
                </p>
              )}
            </div>

            <Separator />

            {/* Dados da empresa outorgante */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>CNPJ da Empresa <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="00.000.000/0001-00"
                  value={formData.cnpj}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, cnpj: cnpjMask(e.target.value) }))
                  }
                  maxLength={18}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ambiente <span className="text-destructive">*</span></Label>
                <Select
                  value={formData.ambiente}
                  onValueChange={(v: "producao" | "homologacao") =>
                    setFormData((f) => ({ ...f, ambiente: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="homologacao">🧪 Homologação</SelectItem>
                    <SelectItem value="producao">🚀 Produção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Nome da Empresa <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Razão social da empresa"
                value={formData.nome_empresa}
                onChange={(e) => setFormData((f) => ({ ...f, nome_empresa: e.target.value }))}
              />
            </div>

            {/* Dados do procurador (se procuração) */}
            {formData.tipo === "procuracao" && (
              <>
                <Separator />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Dados do Procurador
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>CNPJ do Procurador</Label>
                    <Input
                      placeholder="CNPJ do escritório"
                      value={formData.cnpj_procurador}
                      onChange={(e) =>
                        setFormData((f) => ({ ...f, cnpj_procurador: cnpjMask(e.target.value) }))
                      }
                      maxLength={18}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nome do Procurador</Label>
                    <Input
                      placeholder="Nome do escritório/contador"
                      value={formData.nome_procurador}
                      onChange={(e) =>
                        setFormData((f) => ({ ...f, nome_procurador: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Upload do .pfx */}
            <div className="space-y-1.5">
              <Label>Arquivo do Certificado (.pfx / .p12) <span className="text-destructive">*</span></Label>
              <div
                className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => document.getElementById("cert-upload")?.click()}
              >
                {certFile ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="font-medium">{certFile.name}</span>
                    <span className="text-muted-foreground">
                      ({(certFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload className="w-6 h-6 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Clique para selecionar o arquivo <strong>.pfx</strong>
                    </p>
                  </div>
                )}
              </div>
              <input
                id="cert-upload"
                type="file"
                accept=".pfx,.p12"
                className="hidden"
                onChange={(e) => setCertFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Validade do Certificado</Label>
                <Input
                  type="date"
                  value={formData.validade}
                  onChange={(e) => setFormData((f) => ({ ...f, validade: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Senha do Certificado</Label>
                <div className="relative">
                  <Input
                    type={showSenha ? "text" : "password"}
                    placeholder="Senha do .pfx"
                    value={formData.senha}
                    onChange={(e) => setFormData((f) => ({ ...f, senha: e.target.value }))}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowSenha((v) => !v)}
                  >
                    {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  A senha é necessária para assinar o XML na transmissão.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpload} disabled={uploading || !certFile}>
              {uploading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Enviando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" /> Cadastrar Certificado
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
