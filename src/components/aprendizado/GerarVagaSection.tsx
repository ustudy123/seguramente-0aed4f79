import { useState } from "react";
import { Briefcase, Sparkles, Loader2, Copy, Download, Check, Building2, Mail, MapPin, DollarSign, Clock, FileDown } from "lucide-react";
import { exportTextToPdf } from "@/utils/pdfExport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GerarVagaSectionProps {
  cargoId: string;
  cargoNome: string;
  cargoDescricao?: string | null;
  responsabilidade?: string | null;
}

export function GerarVagaSection({ cargoId, cargoNome, cargoDescricao, responsabilidade }: GerarVagaSectionProps) {
  const [gerando, setGerando] = useState(false);
  const [anuncio, setAnuncio] = useState("");
  const [copiado, setCopiado] = useState(false);

  // Additional fields
  const [contato, setContato] = useState("");
  const [localTrabalho, setLocalTrabalho] = useState("");
  const [tipoContrato, setTipoContrato] = useState("clt");
  const [jornada, setJornada] = useState("integral");
  const [faixaSalarial, setFaixaSalarial] = useState("");
  const [requisitosImprescindiveis, setRequisitosImprescindiveis] = useState("");
  const [requisitosDesejaveis, setRequisitosDesejaveis] = useState("");
  const [beneficios, setBeneficios] = useState("");
  const [prazoInscricao, setPrazoInscricao] = useState("");

  const handleGerar = async () => {
    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-gerar-vaga", {
        body: {
          cargoId,
          cargoNome,
          cargoDescricao,
          responsabilidade,
          contato,
          localTrabalho,
          tipoContrato,
          jornada,
          faixaSalarial,
          requisitosImprescindiveis,
          requisitosDesejaveis,
          beneficios,
          prazoInscricao,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setAnuncio(data.anuncio || data.result || "");
      toast.success("Anúncio gerado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao gerar anúncio: " + err.message);
    } finally {
      setGerando(false);
    }
  };

  const handleCopiar = async () => {
    await navigator.clipboard.writeText(anuncio);
    setCopiado(true);
    toast.success("Anúncio copiado!");
    setTimeout(() => setCopiado(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([anuncio], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Vaga_${cargoNome.replace(/\s+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            Dados Adicionais para Geração da Vaga
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> Contato para Envio do Currículo</Label>
              <Input value={contato} onChange={(e) => setContato(e.target.value)} placeholder="email@empresa.com ou link" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Local de Trabalho</Label>
              <Input value={localTrabalho} onChange={(e) => setLocalTrabalho(e.target.value)} placeholder="Cidade, Estado ou Remoto" />
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
                  <SelectItem value="freelancer">Freelancer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Jornada</Label>
              <Select value={jornada} onValueChange={setJornada}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="integral">Integral</SelectItem>
                  <SelectItem value="parcial">Parcial</SelectItem>
                  <SelectItem value="12x36">12x36</SelectItem>
                  <SelectItem value="escala">Escala</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> Faixa Salarial</Label>
              <Input value={faixaSalarial} onChange={(e) => setFaixaSalarial(e.target.value)} placeholder="Ex: R$ 2.000 a R$ 3.000 ou A combinar" />
            </div>
            <div className="space-y-1.5">
              <Label>Prazo de Inscrição</Label>
              <Input type="date" value={prazoInscricao} onChange={(e) => setPrazoInscricao(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Requisitos Imprescindíveis</Label>
            <Textarea value={requisitosImprescindiveis} onChange={(e) => setRequisitosImprescindiveis(e.target.value)} placeholder="Ex: Experiência mínima de 2 anos na área, formação em..." rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Requisitos Desejáveis</Label>
            <Textarea value={requisitosDesejaveis} onChange={(e) => setRequisitosDesejaveis(e.target.value)} placeholder="Ex: Pós-graduação, inglês intermediário..." rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Benefícios</Label>
            <Textarea value={beneficios} onChange={(e) => setBeneficios(e.target.value)} placeholder="Ex: Vale transporte, vale alimentação, plano de saúde..." rows={2} />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleGerar} disabled={gerando}>
              {gerando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
              Gerar Anúncio de Vaga
            </Button>
          </div>
        </CardContent>
      </Card>

      {anuncio && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Anúncio Gerado</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopiar}>
                  {copiado ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                  {copiado ? "Copiado!" : "Copiar"}
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-1" /> Baixar .txt
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea value={anuncio} onChange={(e) => setAnuncio(e.target.value)} rows={20} className="font-mono text-sm" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
