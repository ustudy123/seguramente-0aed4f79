import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, CheckCircle, AlertTriangle, Clock, HardDrive } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export function PontoRepCTab() {
  const { profile } = useAuth();
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const [importando, setImportando] = useState(false);
  const [fabricante, setFabricante] = useState("");
  const [modelo, setModelo] = useState("");
  const [numeroSerie, setNumeroSerie] = useState("");

  const { data: importacoes = [], isLoading } = useQuery({
    queryKey: ["ponto-repc-importacoes", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await fromTable("ponto_repc_importacoes")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(50) as { data: any[] | null };
      return data || [];
    },
    enabled: !!tenantId,
  });

  const processarArquivoAFD = (conteudo: string): { marcacoes: any[]; erros: string[] } => {
    const linhas = conteudo.split("\n").filter(l => l.trim());
    const marcacoes: any[] = [];
    const erros: string[] = [];

    linhas.forEach((linha, idx) => {
      const tipo = linha.charAt(0);
      if (tipo !== "3") return; // Só processa registros tipo 3 (marcações)

      try {
        // Formato AFD: 3 + NSR(10) + Tipo(1) + Data(8) + Hora(4) + CPF(11)
        const nsr = linha.substring(1, 11);
        const dataStr = linha.substring(12, 20); // DDMMYYYY
        const horaStr = linha.substring(20, 24); // HHMM
        const cpf = linha.substring(24, 35);

        if (dataStr.length < 8 || horaStr.length < 4) {
          erros.push(`Linha ${idx + 1}: formato inválido`);
          return;
        }

        const dia = dataStr.substring(0, 2);
        const mes = dataStr.substring(2, 4);
        const ano = dataStr.substring(4, 8);
        const hora = horaStr.substring(0, 2);
        const minuto = horaStr.substring(2, 4);

        marcacoes.push({
          data_marcacao: `${ano}-${mes}-${dia}`,
          hora_marcacao: `${hora}:${minuto}:00`,
          colaborador_cpf: cpf.replace(/^0+/, ""),
          nsr,
        });
      } catch {
        erros.push(`Linha ${idx + 1}: erro de parse`);
      }
    });

    return { marcacoes, erros };
  };

  const handleImportar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;

    setImportando(true);
    try {
      const conteudo = await file.text();
      const { marcacoes, erros } = processarArquivoAFD(conteudo);

      // Registrar importação
      const { data: importacao, error: errImport } = await fromTable("ponto_repc_importacoes")
        .insert({
          tenant_id: tenantId,
          arquivo_nome: file.name,
          tipo_equipamento: "REP-C",
          fabricante: fabricante || null,
          modelo: modelo || null,
          numero_serie: numeroSerie || null,
          total_registros: marcacoes.length + erros.length,
          registros_importados: 0,
          registros_rejeitados: erros.length,
          status: "processando",
          erros: erros.length > 0 ? erros : null,
          importado_por: profile?.nome_completo,
          importado_por_id: profile?.id,
        } as any)
        .select()
        .single() as { data: any; error: any };

      if (errImport) throw errImport;

      // Inserir marcações no ponto_marcacoes
      let importados = 0;
      for (const m of marcacoes) {
        // Alterna entre entrada/saida com base na quantidade de marcações já existentes no dia
        const { data: existentes } = await fromTable("ponto_marcacoes")
          .select("tipo_marcacao")
          .eq("tenant_id", tenantId)
          .eq("colaborador_cpf", m.colaborador_cpf)
          .eq("data_marcacao", m.data_marcacao) as { data: any[] | null };

        const totalDia = (existentes || []).length;
        const tipoMarcacao = totalDia % 2 === 0 ? "entrada" : "saida";

        const { error: errMarcacao } = await fromTable("ponto_marcacoes")
          .insert({
            tenant_id: tenantId,
            colaborador_cpf: m.colaborador_cpf,
            colaborador_id: m.colaborador_cpf,
            colaborador_nome: `CPF ${m.colaborador_cpf}`,
            data_marcacao: m.data_marcacao,
            hora_marcacao: m.hora_marcacao,
            tipo_marcacao: tipoMarcacao,
            origem: "repc",
            ip_address: "REP-C Import",
          } as any);

        if (!errMarcacao) importados++;
      }

      // Atualizar status
      await fromTable("ponto_repc_importacoes")
        .update({
          status: "concluido",
          registros_importados: importados,
        } as any)
        .eq("id", importacao.id);

      queryClient.invalidateQueries({ queryKey: ["ponto-repc-importacoes"] });
      queryClient.invalidateQueries({ queryKey: ["ponto-diario"] });
      toast.success(`Importação concluída: ${importados} registros importados, ${erros.length} rejeitados`);
    } catch (err: any) {
      toast.error("Erro na importação: " + (err.message || "erro desconhecido"));
    } finally {
      setImportando(false);
      e.target.value = "";
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pendente: { label: "Pendente", variant: "outline" },
      processando: { label: "Processando", variant: "secondary" },
      concluido: { label: "Concluído", variant: "default" },
      erro: { label: "Erro", variant: "destructive" },
    };
    const cfg = map[status] || map.pendente;
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-primary" /> Importação REP-C (Relógios Físicos)
        </h3>
        <p className="text-sm text-muted-foreground">Importe arquivos AFD de registradores eletrônicos de ponto convencionais</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Dados do Equipamento (opcional)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Fabricante</Label>
              <Input value={fabricante} onChange={e => setFabricante(e.target.value)} placeholder="Ex: Henry, Dimep..." />
            </div>
            <div className="space-y-2">
              <Label>Modelo</Label>
              <Input value={modelo} onChange={e => setModelo(e.target.value)} placeholder="Ex: Orion 6" />
            </div>
            <div className="space-y-2">
              <Label>Nº de Série</Label>
              <Input value={numeroSerie} onChange={e => setNumeroSerie(e.target.value)} placeholder="Número de série" />
            </div>
          </div>

          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium mb-1">Selecione o arquivo AFD (.txt)</p>
            <p className="text-sm text-muted-foreground mb-4">Formato padrão Portaria 671 exportado do REP-C</p>
            <label className="cursor-pointer">
              <Input
                type="file"
                accept=".txt,.afd"
                className="hidden"
                onChange={handleImportar}
                disabled={importando}
              />
              <Button asChild disabled={importando}>
                <span>{importando ? "Importando..." : "Selecionar Arquivo"}</span>
              </Button>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Histórico de importações */}
      <Card>
        <CardHeader><CardTitle className="text-base">Histórico de Importações</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Arquivo</TableHead>
                <TableHead>Equipamento</TableHead>
                <TableHead className="text-center">Registros</TableHead>
                <TableHead className="text-center">Importados</TableHead>
                <TableHead className="text-center">Rejeitados</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">Carregando...</TableCell></TableRow>
              ) : importacoes.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma importação realizada.</TableCell></TableRow>
              ) : importacoes.map((imp: any) => (
                <TableRow key={imp.id}>
                  <TableCell className="font-medium flex items-center gap-2"><FileText className="w-4 h-4" />{imp.arquivo_nome}</TableCell>
                  <TableCell>{[imp.fabricante, imp.modelo].filter(Boolean).join(" ") || "N/I"}</TableCell>
                  <TableCell className="text-center">{imp.total_registros}</TableCell>
                  <TableCell className="text-center text-primary font-medium">{imp.registros_importados}</TableCell>
                  <TableCell className="text-center text-destructive font-medium">{imp.registros_rejeitados}</TableCell>
                  <TableCell className="text-center">{statusBadge(imp.status)}</TableCell>
                  <TableCell>{format(new Date(imp.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <h4 className="font-medium mb-2">📋 Sobre REP-C</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• <strong>REP-C</strong> — Registrador Eletrônico de Ponto Convencional (relógio físico)</li>
            <li>• O arquivo AFD (.txt) é exportado diretamente do equipamento</li>
            <li>• Os registros importados alimentam as mesmas tabelas do REP-P/REP-A</li>
            <li>• Marcações são atribuídas automaticamente (entrada → saída almoço → retorno → saída)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
