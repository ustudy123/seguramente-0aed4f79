import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Shield, UserPlus, X, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const CONSELHOS = [
  "CREA", "CRP", "CREFITO", "CRM", "CRN", "CREF", "OAB", "CRA", "COREN", "CONFEA", "Outro"
];

const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

interface ProfissionalFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ProfissionalFormModal({ open, onClose, onSuccess }: ProfissionalFormModalProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    nome_completo: "",
    email: "",
    telefone: "",
    cpf_cnpj: "",
    bio: "",
    formacao_academica: "",
    registro_profissional: "",
    conselho: "",
    uf_registro: "",
    registro_validade: "",
    certificacoes: "",
    especialidades: "",
    areas_atuacao: "",
    cidade: "",
    estado: "",
    modalidades: [] as string[],
    aceite_etica: false,
  });

  const updateField = (field: string, value: string | boolean) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const toggleModalidade = (mod: string) => {
    setForm((f) => ({
      ...f,
      modalidades: f.modalidades.includes(mod)
        ? f.modalidades.filter((m) => m !== mod)
        : [...f.modalidades, mod],
    }));
  };

  const handleSubmit = async () => {
    if (!form.nome_completo || !form.email || !form.registro_profissional || !form.conselho) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    if (!form.aceite_etica) {
      toast.error("É necessário aceitar o Código de Ética");
      return;
    }
    if (form.modalidades.length === 0) {
      toast.error("Selecione ao menos uma modalidade de atendimento");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.from("marketplace_profissionais").insert({
        user_id: user?.id || null,
        nome_completo: form.nome_completo,
        email: form.email,
        telefone: form.telefone || null,
        cpf_cnpj: form.cpf_cnpj || null,
        bio: form.bio || null,
        formacao_academica: form.formacao_academica || null,
        registro_profissional: form.registro_profissional,
        conselho: form.conselho,
        uf_registro: form.uf_registro || null,
        registro_validade: form.registro_validade || null,
        certificacoes: form.certificacoes ? form.certificacoes.split(",").map((s) => s.trim()) : null,
        especialidades: form.especialidades ? form.especialidades.split(",").map((s) => s.trim()) : null,
        areas_atuacao: form.areas_atuacao ? form.areas_atuacao.split(",").map((s) => s.trim()) : null,
        modalidades_atendimento: form.modalidades as ("presencial" | "online" | "hibrido")[],
        cidade: form.cidade || null,
        estado: form.estado || null,
        aceite_codigo_etica: true,
        aceite_codigo_etica_data: new Date().toISOString(),
        status: "pendente" as const,
      });
      if (error) throw error;
      toast.success("Cadastro enviado! Aguarde validação documental.");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao cadastrar");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Cadastro de Profissional
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Info banner */}
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-800">
            <p className="font-medium mb-1">📌 Validação obrigatória</p>
            <p>Seu perfil será analisado antes de ficar visível no marketplace. Profissionais com registro vencido são bloqueados automaticamente.</p>
          </div>

          {/* Dados pessoais */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-foreground">Dados Pessoais</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome completo *</Label>
                <Input value={form.nome_completo} onChange={(e) => updateField("nome_completo", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail *</Label>
                <Input type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={(e) => updateField("telefone", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>CPF/CNPJ</Label>
                <Input value={form.cpf_cnpj} onChange={(e) => updateField("cpf_cnpj", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Cidade</Label>
                <Input value={form.cidade} onChange={(e) => updateField("cidade", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select value={form.estado} onValueChange={(v) => updateField("estado", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {UFS.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Formação */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-foreground">Formação e Registro</h4>
            <div className="space-y-1.5">
              <Label>Formação acadêmica</Label>
              <Input value={form.formacao_academica} onChange={(e) => updateField("formacao_academica", e.target.value)} placeholder="Ex: Fisioterapia - USP" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Conselho *</Label>
                <Select value={form.conselho} onValueChange={(v) => updateField("conselho", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {CONSELHOS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Nº Registro *</Label>
                <Input value={form.registro_profissional} onChange={(e) => updateField("registro_profissional", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>UF Registro</Label>
                <Select value={form.uf_registro} onValueChange={(v) => updateField("uf_registro", v)}>
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    {UFS.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Validade do registro</Label>
              <Input type="date" value={form.registro_validade} onChange={(e) => updateField("registro_validade", e.target.value)} />
            </div>
          </div>

          {/* Especialidades */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-foreground">Especialidades e Atuação</h4>
            <div className="space-y-1.5">
              <Label>Especialidades (separadas por vírgula)</Label>
              <Input value={form.especialidades} onChange={(e) => updateField("especialidades", e.target.value)} placeholder="Ergonomia, NR-17, Saúde Mental" />
            </div>
            <div className="space-y-1.5">
              <Label>Certificações complementares (separadas por vírgula)</Label>
              <Input value={form.certificacoes} onChange={(e) => updateField("certificacoes", e.target.value)} placeholder="Pós em Ergonomia, Auditor ISO 45001" />
            </div>
            <div className="space-y-1.5">
              <Label>Áreas de atuação legal (separadas por vírgula)</Label>
              <Input value={form.areas_atuacao} onChange={(e) => updateField("areas_atuacao", e.target.value)} placeholder="AEP, AET, Laudo Ergonômico" />
            </div>
            <div className="space-y-1.5">
              <Label>Bio / Apresentação</Label>
              <Textarea value={form.bio} onChange={(e) => updateField("bio", e.target.value)} rows={3} placeholder="Descreva sua experiência e abordagem profissional..." />
            </div>
          </div>

          {/* Modalidades */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-foreground">Modalidades de atendimento *</h4>
            <div className="flex gap-3">
              {(["presencial", "online", "hibrido"] as const).map((mod) => (
                <button
                  key={mod}
                  type="button"
                  onClick={() => toggleModalidade(mod)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    form.modalidades.includes(mod)
                      ? "bg-indigo-100 border-indigo-300 text-indigo-700"
                      : "bg-card border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {mod.charAt(0).toUpperCase() + mod.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Código de ética */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
            <div className="flex items-start gap-2">
              <Shield className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-semibold">Código de Ética e Conduta do Seguramente</p>
                <ul className="list-disc ml-4 mt-2 space-y-1 text-xs">
                  <li>Atuar exclusivamente dentro do escopo legal da profissão</li>
                  <li>Não armazenar conteúdo clínico ou sensível na plataforma</li>
                  <li>Não realizar gravações de atendimentos (vídeo, áudio ou chat)</li>
                  <li>Respeitar sigilo profissional e LGPD</li>
                  <li>Manter registro profissional válido e atualizado</li>
                  <li>Não ofertar serviços fora do escopo de habilitação</li>
                  <li>Confirmar execução de serviços com veracidade</li>
                </ul>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="etica"
                checked={form.aceite_etica}
                onCheckedChange={(v) => updateField("aceite_etica", !!v)}
              />
              <label htmlFor="etica" className="text-xs text-amber-800 font-medium cursor-pointer">
                Li, compreendo e aceito integralmente o Código de Ética e Conduta *
              </label>
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-0"
          >
            {isLoading ? "Enviando..." : "Enviar Cadastro para Validação"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
