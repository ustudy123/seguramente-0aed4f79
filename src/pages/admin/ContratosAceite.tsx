import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, FileSignature, Copy, Eye, Edit, Trash2, Link as LinkIcon,
  Power, Search, Shield, Download, MapPin, Hash, Smartphone, Printer,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { confirm } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useContratosAceite,
  useAssinaturasContrato,
  useGerarLinkAssinatura,
  type ContratoAceite,
  type ContratoCategoria,
} from "@/hooks/useContratosAceite";

const CATEGORIAS: { value: ContratoCategoria; label: string }[] = [
  { value: "live", label: "LIVE / Webinar" },
  { value: "aula", label: "Aula / Curso" },
  { value: "uso_sistema", label: "Uso do Sistema" },
  { value: "parceria", label: "Parceria" },
  { value: "nda", label: "NDA / Sigilo" },
  { value: "evento", label: "Evento" },
  { value: "outro", label: "Outro" },
];

const PUBLIC_BASE = "https://www.youreyes.com.br";

function emptyContrato(): Partial<ContratoAceite> {
  return {
    titulo: "",
    categoria: "live",
    descricao_publica: "",
    corpo_html: "",
    requer_cpf: true,
    requer_rg: false,
    requer_endereco: false,
    requer_telefone: false,
    requer_selfie: false,
    requer_geolocalizacao: false,
    validade_dias: 30,
    limite_assinaturas: null,
    ativo: true,
  };
}

export default function ContratosAceite() {
  const navigate = useNavigate();
  const { data: contratos, isLoading, createContrato, updateContrato, deleteContrato } = useContratosAceite();


  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<ContratoAceite> | null>(null);
  const [assinaturasOpen, setAssinaturasOpen] = useState(false);
  const [contratoAtivo, setContratoAtivo] = useState<ContratoAceite | null>(null);

  const filtered = (contratos || []).filter(c =>
    c.titulo.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    if (!editing?.titulo || !editing?.corpo_html) {
      toast.error("Título e corpo do contrato são obrigatórios");
      return;
    }
    if (editing.id) {
      await updateContrato.mutateAsync(editing as ContratoAceite);
    } else {
      await createContrato.mutateAsync(editing);
    }
    setEditorOpen(false);
    setEditing(null);
  };

  const handleDelete = async (c: ContratoAceite) => {
    const ok = await confirm({
      title: "Excluir contrato?",
      description: `O contrato "${c.titulo}" e todas as assinaturas associadas serão removidos.`,
      confirmLabel: "Excluir",
      variant: "destructive",
    });
    if (ok) deleteContrato.mutate(c.id);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-[1400px] mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <FileSignature className="w-6 h-6 text-primary" />
                Contratos & Termos de Aceite
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Crie contratos, gere links de assinatura e gerencie aceites com validade jurídica
              </p>
            </div>
          </div>
          <Button onClick={() => { setEditing(emptyContrato()); setEditorOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />Novo Contrato
          </Button>
        </div>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6 flex gap-3">
            <Shield className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div className="text-sm">
              <strong>Validade jurídica:</strong> Toda assinatura é registrada com IP, geolocalização (se exigida),
              selfie (se exigida), hash SHA-256 do documento e carimbo de tempo — conforme{" "}
              <strong>Lei 14.063/2020</strong> e <strong>MP 2.200-2/2001</strong>.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Contratos Cadastrados</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileSignature className="w-12 h-12 mx-auto mb-3 opacity-30" />
                Nenhum contrato cadastrado ainda
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Limite</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.titulo}</TableCell>
                      <TableCell><Badge variant="outline">{CATEGORIAS.find(x => x.value === c.categoria)?.label || c.categoria}</Badge></TableCell>
                      <TableCell>{c.validade_dias ? `${c.validade_dias} dias` : "—"}</TableCell>
                      <TableCell>{c.limite_assinaturas ?? "Ilimitado"}</TableCell>
                      <TableCell>
                        {c.ativo
                          ? <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Ativo</Badge>
                          : <Badge variant="destructive">Inativo</Badge>}
                      </TableCell>
                      <TableCell className="text-xs">{format(new Date(c.created_at), "dd/MM/yy", { locale: ptBR })}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" title="Ver assinaturas"
                            onClick={() => { setContratoAtivo(c); setAssinaturasOpen(true); }}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" title="Editar"
                            onClick={() => { setEditing(c); setEditorOpen(true); }}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" title={c.ativo ? "Desativar" : "Ativar"}
                            onClick={() => updateContrato.mutate({ id: c.id, ativo: !c.ativo })}>
                            <Power className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" title="Excluir" onClick={() => handleDelete(c)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Editor */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar Contrato" : "Novo Contrato"}</DialogTitle>
            <DialogDescription>Cadastre o termo que será apresentado ao signatário</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label>Título *</Label>
                  <Input value={editing.titulo || ""} onChange={e => setEditing({ ...editing, titulo: e.target.value })} />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={editing.categoria} onValueChange={(v: ContratoCategoria) => setEditing({ ...editing, categoria: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Validade do link (dias)</Label>
                  <Input type="number" value={editing.validade_dias ?? ""} onChange={e =>
                    setEditing({ ...editing, validade_dias: e.target.value ? Number(e.target.value) : null })} />
                </div>
                <div>
                  <Label>Limite de assinaturas (vazio = ilimitado)</Label>
                  <Input type="number" value={editing.limite_assinaturas ?? ""} onChange={e =>
                    setEditing({ ...editing, limite_assinaturas: e.target.value ? Number(e.target.value) : null })} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editing.ativo} onCheckedChange={v => setEditing({ ...editing, ativo: v })} />
                  <Label>Contrato ativo</Label>
                </div>
              </div>

              <div>
                <Label>Descrição pública (mostrada ao signatário antes do contrato)</Label>
                <Textarea rows={2} value={editing.descricao_publica || ""}
                  onChange={e => setEditing({ ...editing, descricao_publica: e.target.value })} />
              </div>

              <div>
                <Label>Corpo do contrato (texto/HTML) *</Label>
                <Textarea rows={12} className="font-mono text-xs" value={editing.corpo_html || ""}
                  onChange={e => setEditing({ ...editing, corpo_html: e.target.value })}
                  placeholder="Use parágrafos, listas e formatação HTML básica (<p>, <ul>, <strong>, etc.)" />
              </div>

              <div className="space-y-2 border rounded-lg p-4">
                <Label className="font-semibold">Dados exigidos do signatário</Label>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    { k: "requer_cpf", l: "CPF" },
                    { k: "requer_rg", l: "RG" },
                    { k: "requer_telefone", l: "Telefone" },
                    { k: "requer_endereco", l: "Endereço completo" },
                    { k: "requer_selfie", l: "Selfie (foto ao vivo)" },
                    { k: "requer_geolocalizacao", l: "Geolocalização" },
                  ].map(f => (
                    <div key={f.k} className="flex items-center gap-2">
                      <Switch
                        checked={(editing as any)[f.k]}
                        onCheckedChange={v => setEditing({ ...editing, [f.k]: v })}
                      />
                      <Label>{f.l}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editing?.id ? "Salvar" : "Criar contrato"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Painel de assinaturas */}
      <Dialog open={assinaturasOpen} onOpenChange={setAssinaturasOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          {contratoAtivo && (
            <AssinaturasPainel contrato={contratoAtivo} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AssinaturasPainel({ contrato }: { contrato: ContratoAceite }) {
  const { data: assinaturas, isLoading, refetch } = useAssinaturasContrato(contrato.id);
  const gerarLink = useGerarLinkAssinatura();
  const [novoEmail, setNovoEmail] = useState("");
  const [novoNome, setNovoNome] = useState("");

  const copyLink = (token: string) => {
    const url = `${PUBLIC_BASE}/assinar-contrato/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const handleGerar = async () => {
    const a = await gerarLink.mutateAsync({
      contrato_id: contrato.id,
      validade_dias: contrato.validade_dias,
      signatario_email: novoEmail || undefined,
      signatario_nome: novoNome || undefined,
    });
    const url = `${PUBLIC_BASE}/assinar-contrato/${a.token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link gerado e copiado para a área de transferência!");
    setNovoEmail(""); setNovoNome("");
    refetch();
  };

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <FileSignature className="w-5 h-5" />
          {contrato.titulo}
        </DialogTitle>
        <DialogDescription>
          Gerar links de assinatura e acompanhar aceites
        </DialogDescription>
      </DialogHeader>

      <Tabs defaultValue="gerar">
        <TabsList>
          <TabsTrigger value="gerar">Gerar Link</TabsTrigger>
          <TabsTrigger value="assinaturas">
            Assinaturas ({assinaturas?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gerar" className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <Label>Nome do signatário (opcional)</Label>
                  <Input value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="João Silva" />
                </div>
                <div>
                  <Label>E-mail (opcional)</Label>
                  <Input type="email" value={novoEmail} onChange={e => setNovoEmail(e.target.value)} placeholder="joao@empresa.com" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Você pode gerar um link sem signatário definido (genérico) ou pré-vincular a uma pessoa.
                {contrato.validade_dias && ` O link expira em ${contrato.validade_dias} dias.`}
              </p>
              <Button onClick={handleGerar} disabled={gerarLink.isPending} className="w-full">
                <LinkIcon className="w-4 h-4 mr-2" />
                {gerarLink.isPending ? "Gerando..." : "Gerar link de assinatura"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assinaturas">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : !assinaturas?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma assinatura gerada ainda
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Signatário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assinado em</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assinaturas.map(a => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{a.signatario_nome || "—"}</div>
                      <div className="text-xs text-muted-foreground">{a.signatario_email || a.signatario_cpf || "Sem identificação"}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        a.status === "assinado" ? "default" :
                        a.status === "expirado" ? "destructive" :
                        a.status === "revogado" ? "destructive" : "outline"
                      } className={a.status === "assinado" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : ""}>
                        {a.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {a.assinado_em ? format(new Date(a.assinado_em), "dd/MM/yy HH:mm", { locale: ptBR }) : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{a.ip_address || "—"}</TableCell>
                    <TableCell className="text-right">
                      {a.status === "pendente" && (
                        <Button size="sm" variant="ghost" onClick={() => copyLink(a.token)}>
                          <Copy className="w-3 h-3 mr-1" />Copiar link
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
