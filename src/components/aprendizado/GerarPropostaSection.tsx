import { useState } from "react";
import { FileText, Sparkles, Loader2, Copy, Download, Check, Calendar, DollarSign, Gift, Clock, Building2, FileDown } from "lucide-react";
import { exportTextToPdf } from "@/utils/pdfExport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GerarPropostaSectionProps {
  cargoId: string;
  cargoNome: string;
  cargoDescricao?: string | null;
  responsabilidade?: string | null;
}

export function GerarPropostaSection({ cargoId, cargoNome, cargoDescricao, responsabilidade }: GerarPropostaSectionProps) {
  const [gerando, setGerando] = useState(false);
  const [proposta, setProposta] = useState("");
  const [copiado, setCopiado] = useState(false);

  // Proposal fields
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [nomeCandidato, setNomeCandidato] = useState("");
  const [salarioBase, setSalarioBase] = useState("");
  const [tipoContrato, setTipoContrato] = useState("clt");
  const [dataInicio, setDataInicio] = useState("");
  const [horarioTrabalho, setHorarioTrabalho] = useState("");
  const [beneficiosOferecidos, setBeneficiosOferecidos] = useState("");
  const [periodoExperiencia, setPeriodoExperiencia] = useState("90");
  const [localTrabalho, setLocalTrabalho] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const handleGerar = async () => {
    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-gerar-vaga", {
        body: {
          tipo: "proposta",
          cargoId,
          cargoNome,
          cargoDescricao,
          responsabilidade,
          nomeEmpresa,
          nomeCandidato,
          salarioBase,
          tipoContrato,
          dataInicio,
          horarioTrabalho,
          beneficiosOferecidos,
          periodoExperiencia,
          localTrabalho,
          observacoes,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setProposta(data.anuncio || data.proposta || data.result || "");
      toast.success("Proposta gerada com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao gerar proposta: " + err.message);
    } finally {
      setGerando(false);
    }
  };

  const handleCopiar = async () => {
    await navigator.clipboard.writeText(proposta);
    setCopiado(true);
    toast.success("Proposta copiada!");
    setTimeout(() => setCopiado(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([proposta], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Proposta_${cargoNome.replace(/\s+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = () => {
    exportTextToPdf(proposta, `Proposta_${cargoNome.replace(/\s+/g, "_")}.pdf`, `Proposta de Oportunidade - ${cargoNome}`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Dados da Proposta de Oportunidade
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> Nome da Empresa</Label>
              <Input value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} placeholder="Razão social ou fantasia" />
            </div>
            <div className="space-y-1.5">
              <Label>Nome do Candidato</Label>
              <Input value={nomeCandidato} onChange={(e) => setNomeCandidato(e.target.value)} placeholder="Nome completo do candidato" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> Salário Base</Label>
              <Input value={salarioBase} onChange={(e) => setSalarioBase(e.target.value)} placeholder="R$ 0.000,00" />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de Contrato</Label>
              <Select value={tipoContrato} onValueChange={setTipoContrato}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="clt">CLT</SelectItem>
                  <SelectItem value="pj">PJ</SelectItem>
                  <SelectItem value="estagio">Estágio</SelectItem>
                  <SelectItem value="temporario">Temporário</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Data Prevista de Início</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Horário de Trabalho</Label>
              <Input value={horarioTrabalho} onChange={(e) => setHorarioTrabalho(e.target.value)} placeholder="Ex: 08:00 às 17:00" />
            </div>
            <div className="space-y-1.5">
              <Label>Período de Experiência (dias)</Label>
              <Select value={periodoExperiencia} onValueChange={setPeriodoExperiencia}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="45">45 dias</SelectItem>
                  <SelectItem value="90">90 dias</SelectItem>
                  <SelectItem value="0">Sem experiência</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Local de Trabalho</Label>
              <Input value={localTrabalho} onChange={(e) => setLocalTrabalho(e.target.value)} placeholder="Endereço ou 'Remoto'" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1"><Gift className="w-3.5 h-3.5" /> Benefícios Oferecidos</Label>
            <Textarea value={beneficiosOferecidos} onChange={(e) => setBeneficiosOferecidos(e.target.value)} placeholder="Vale transporte, vale alimentação, plano de saúde, bônus..." rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Observações Adicionais</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Informações complementares para a proposta..." rows={2} />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleGerar} disabled={gerando}>
              {gerando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
              Gerar Proposta
            </Button>
          </div>
        </CardContent>
      </Card>

      {proposta && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Proposta Gerada</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopiar}>
                  {copiado ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                  {copiado ? "Copiado!" : "Copiar"}
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-1" /> Baixar .txt
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
                  <FileDown className="w-4 h-4 mr-1" /> Baixar PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea value={proposta} onChange={(e) => setProposta(e.target.value)} rows={20} className="font-mono text-sm" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
