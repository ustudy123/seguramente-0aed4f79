import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Shield,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Upload,
  Search,
  BarChart3,
  FileCheck,
  AlertCircle,
  ArrowRight,
  BookOpen,
  Target,
  Trash2,
  Loader2,
} from "lucide-react";
import { useSSTDocumentos, SSTDocumento } from "@/hooks/useSSTDocumentos";
import { SSTUploadModal } from "@/components/sst/SSTUploadModal";
import { SSTAnaliseIAModal } from "@/components/sst/SSTAnaliseIAModal";
import { SSTAcoesTab } from "@/components/sst/SSTAcoesTab";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

const ComplianceSST = () => {
  const [activeTab, setActiveTab] = useState("painel");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [analiseDoc, setAnaliseDoc] = useState<SSTDocumento | null>(null);
  const { documentos, isLoading, deleteDocumento } = useSSTDocumentos();
  const navigate = useNavigate();

  const docVigentes = documentos.filter(d => d.status === "vigente").length;
  const docVencidos = documentos.filter(d => d.status === "vencido").length;
  const docAnalisados = documentos.filter(d => d.analise_ia_status === "concluida").length;

  const alertas: {
    tipo: "critico" | "alerta" | "atencao";
    descricao: string;
    norma: string;
    documento: string;
  }[] = [];

  const indicadores = [
    { titulo: "Documentos Vigentes", valor: String(docVigentes), icone: Shield },
    { titulo: "Documentos Vencidos", valor: String(docVencidos), icone: AlertTriangle },
    { titulo: "Análises IA Concluídas", valor: String(docAnalisados), icone: CheckCircle2 },
    { titulo: "Total Documentos", valor: String(documentos.length), icone: FileText },
  ];

  const getStatusDisplay = (doc: SSTDocumento) => {
    if (doc.data_vigencia) {
      const vig = new Date(doc.data_vigencia);
      if (vig < new Date()) return { label: "Vencido", variant: "destructive" as const };
    }
    return { label: "Vigente", variant: "default" as const };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-7 h-7 text-primary" />
            Compliance SST
          </h1>
          <p className="text-muted-foreground mt-1">
            Governança, conformidade e inteligência legal em Saúde e Segurança do Trabalho
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <BookOpen className="w-4 h-4 mr-2" />
            Guia NRs
          </Button>
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Upload Documento
          </Button>
        </div>
      </div>

      {/* Disclaimer */}
      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
        <CardContent className="py-3 px-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Aviso legal:</strong> Este módulo não substitui profissionais legalmente habilitados nem elabora documentos obrigatórios (PGR, PCMSO, LTCAT). 
            Atua como orquestrador da execução, auditor de coerência e gerador de inteligência preventiva.
          </p>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full">
          <TabsTrigger value="painel" className="text-xs md:text-sm">
            <BarChart3 className="w-4 h-4 mr-1.5" />
            Painel
          </TabsTrigger>
          <TabsTrigger value="documentos" className="text-xs md:text-sm">
            <FileText className="w-4 h-4 mr-1.5" />
            Documentos
          </TabsTrigger>
          <TabsTrigger value="alertas" className="text-xs md:text-sm">
            <AlertTriangle className="w-4 h-4 mr-1.5" />
            Alertas
          </TabsTrigger>
          <TabsTrigger value="acoes" className="text-xs md:text-sm">
            <Target className="w-4 h-4 mr-1.5" />
            Ações
          </TabsTrigger>
          <TabsTrigger value="esocial" className="text-xs md:text-sm">
            <FileCheck className="w-4 h-4 mr-1.5" />
            eSocial
          </TabsTrigger>
        </TabsList>

        {/* PAINEL */}
        <TabsContent value="painel" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {indicadores.map((ind, i) => (
              <Card key={i}>
                <CardContent className="p-4 text-center">
                  <ind.icone className="w-6 h-6 mx-auto mb-2 text-primary" />
                  <p className="text-2xl font-bold text-foreground">{ind.valor}</p>
                  <p className="text-xs text-muted-foreground mt-1">{ind.titulo}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Documentos Legais</CardTitle>
                <CardDescription>Status de vigência dos documentos carregados</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : documentos.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    Nenhum documento carregado. Clique em "Upload Documento" para começar.
                  </div>
                ) : (
                  <>
                    {documentos.slice(0, 5).map((doc) => {
                      const st = getStatusDisplay(doc);
                      return (
                        <div key={doc.id} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div className="flex items-center gap-3">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-sm">{doc.tipo}</p>
                              <p className="text-xs text-muted-foreground">{doc.profissional_responsavel || doc.empresa_emissora || doc.arquivo_nome}</p>
                            </div>
                          </div>
                          <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
                        </div>
                      );
                    })}
                    {documentos.length > 5 && (
                      <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setActiveTab("documentos")}>
                        Ver todos <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Alertas Recentes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {alertas.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    Nenhum alerta de conformidade no momento.
                  </div>
                ) : (
                  alertas.slice(0, 4).map((alerta, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="mt-0.5">
                        {alerta.tipo === "critico" ? (
                          <div className="w-3 h-3 rounded-full bg-destructive" />
                        ) : alerta.tipo === "alerta" ? (
                          <div className="w-3 h-3 rounded-full bg-amber-500" />
                        ) : (
                          <div className="w-3 h-3 rounded-full bg-yellow-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm">{alerta.descricao}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">{alerta.norma}</Badge>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* DOCUMENTOS */}
        <TabsContent value="documentos" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Gestão de Documentos Legais</h2>
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Upload Documento
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
          ) : documentos.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">Nenhum documento SST carregado ainda.</p>
                <Button onClick={() => setUploadOpen(true)}>
                  <Upload className="w-4 h-4 mr-2" />
                  Enviar Primeiro Documento
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {documentos.map((doc) => {
                const st = getStatusDisplay(doc);
                return (
                  <Card key={doc.id}>
                    <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <FileText className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold">{doc.tipo}</p>
                          <p className="text-sm text-muted-foreground">
                            {doc.empresa_emissora ? `${doc.empresa_emissora} — ` : ""}{doc.profissional_responsavel || ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {doc.data_emissao ? `Emissão: ${format(new Date(doc.data_emissao), "dd/MM/yyyy")}` : ""}
                            {doc.data_vigencia ? ` | Vigência: ${format(new Date(doc.data_vigencia), "dd/MM/yyyy")}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">{doc.arquivo_nome}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={st.variant}>{st.label}</Badge>
                        {doc.analise_ia_status === "concluida" && (
                          <Badge variant="secondary" className="text-xs">✅ Analisado</Badge>
                        )}
                        <Button variant="outline" size="sm" onClick={() => setAnaliseDoc(doc)}>
                          <Search className="w-4 h-4 mr-1" />
                          Análise IA
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => {
                            if (confirm("Excluir este documento?")) {
                              deleteDocumento.mutate(doc);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ALERTAS */}
        <TabsContent value="alertas" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Alertas de Conformidade</h2>
            <div className="flex gap-2">
              <Badge variant="destructive">{alertas.filter(a => a.tipo === "critico").length} Críticos</Badge>
              <Badge variant="secondary">{alertas.filter(a => a.tipo === "alerta").length} Alertas</Badge>
              <Badge variant="outline">{alertas.filter(a => a.tipo === "atencao").length} Atenção</Badge>
            </div>
          </div>

          <div className="space-y-3">
            {alertas.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle2 className="w-10 h-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhum alerta ativo no momento.</p>
                </CardContent>
              </Card>
            ) : (
              alertas.map((alerta, i) => (
                <Card key={i} className={alerta.tipo === "critico" ? "border-destructive/50" : ""}>
                  <CardContent className="p-4 flex items-start gap-4">
                    <div className="mt-1">
                      {alerta.tipo === "critico" ? (
                        <AlertTriangle className="w-5 h-5 text-destructive" />
                      ) : alerta.tipo === "alerta" ? (
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-yellow-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={alerta.tipo === "critico" ? "destructive" : alerta.tipo === "alerta" ? "secondary" : "outline"} className="text-xs">
                          {alerta.tipo === "critico" ? "🔴 Crítico" : alerta.tipo === "alerta" ? "🟠 Alerta Técnico" : "🟡 Atenção"}
                        </Badge>
                      </div>
                      <p className="text-sm">{alerta.descricao}</p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">{alerta.norma}</Badge>
                        <Badge variant="outline" className="text-xs">{alerta.documento}</Badge>
                      </div>
                    </div>
                    <Button size="sm" variant="outline">
                      <Zap className="w-4 h-4 mr-1" />
                      Gerar Ação
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* AÇÕES */}
        <TabsContent value="acoes" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Ações de Compliance SST</h2>
            <Badge variant="secondary" className="text-xs">
              {documentos.filter(d => d.analise_ia_status === "concluida").length} doc{documentos.filter(d => d.analise_ia_status === "concluida").length !== 1 ? "s" : ""} analisado{documentos.filter(d => d.analise_ia_status === "concluida").length !== 1 ? "s" : ""}
            </Badge>
          </div>
          <SSTAcoesTab documentos={documentos} />
        </TabsContent>

        {/* eSocial */}
        <TabsContent value="esocial" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Auditoria eSocial — Eventos SST</CardTitle>
              <CardDescription>Confronto entre eventos enviados (S-2210, S-2220, S-2240) e dados dos documentos legais</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FileCheck className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Em breve: conecte o certificado digital da empresa para auditoria automática dos eventos SST no eSocial.
              </p>
              <Button variant="outline" className="mt-4" disabled>
                <Clock className="w-4 h-4 mr-2" />
                Em Desenvolvimento
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <SSTUploadModal open={uploadOpen} onOpenChange={setUploadOpen} />
      <SSTAnaliseIAModal open={!!analiseDoc} onOpenChange={(open) => !open && setAnaliseDoc(null)} documento={analiseDoc} />
    </div>
  );
};

export default ComplianceSST;
