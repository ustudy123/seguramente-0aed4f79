import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Building2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Sparkles,
  FolderTree,
  CheckCircle2,
  AlertCircle,
  Shield,
  Leaf,
  Users,
  FileText,
  Scale,
  Search,
  FileSearch,
} from "lucide-react";
import { cn } from "@/lib/utils";

// NR-04 2022 Grau de Risco mapping by CNAE division (first 2 digits)
const GRAU_RISCO_NR04: Record<string, number> = {
  "01": 3, "02": 3, "03": 3, "05": 3, "06": 3, "07": 3, "08": 3, "09": 3,
  "10": 3, "11": 2, "12": 2, "13": 3, "14": 3, "15": 3, "16": 3, "17": 3,
  "18": 3, "19": 3, "20": 3, "21": 3, "22": 3, "23": 3, "24": 3, "25": 3,
  "26": 2, "27": 3, "28": 3, "29": 3, "30": 3, "31": 2, "32": 2, "33": 2,
  "35": 4, "36": 2, "37": 4, "38": 4, "39": 4, "41": 3, "42": 3, "43": 3,
  "45": 1, "46": 1, "47": 1, "49": 3, "50": 3, "51": 3, "52": 1, "53": 1,
  "55": 1, "56": 1, "58": 1, "59": 1, "60": 1, "61": 1, "62": 1, "63": 1,
  "64": 1, "65": 1, "66": 1, "68": 1, "69": 1, "70": 1, "71": 1, "72": 1,
  "73": 1, "74": 1, "75": 1, "77": 1, "78": 1, "79": 1, "80": 1, "81": 2,
  "82": 1, "84": 1, "85": 1, "86": 2, "87": 2, "88": 2, "90": 1, "91": 1,
  "92": 1, "93": 1, "94": 1, "95": 1, "96": 1, "97": 1, "99": 1,
};

const CNAE_GRUPOS = [
  { divisao: "01-03", desc: "Agricultura, Pecuária e Silvicultura" },
  { divisao: "05-09", desc: "Indústrias Extrativas" },
  { divisao: "10-33", desc: "Indústrias de Transformação" },
  { divisao: "35-39", desc: "Eletricidade, Gás, Água e Saneamento" },
  { divisao: "41-43", desc: "Construção" },
  { divisao: "45-47", desc: "Comércio e Reparação de Veículos" },
  { divisao: "49-53", desc: "Transporte e Armazenagem" },
  { divisao: "55-56", desc: "Alojamento e Alimentação" },
  { divisao: "58-63", desc: "Informação e Comunicação" },
  { divisao: "64-66", desc: "Atividades Financeiras e Seguros" },
  { divisao: "68",    desc: "Atividades Imobiliárias" },
  { divisao: "69-75", desc: "Atividades Profissionais e Científicas" },
  { divisao: "77-82", desc: "Atividades Administrativas e Serviços" },
  { divisao: "84",    desc: "Administração Pública" },
  { divisao: "85",    desc: "Educação" },
  { divisao: "86-88", desc: "Saúde Humana e Serviços Sociais" },
  { divisao: "90-93", desc: "Arte, Cultura, Esporte e Recreação" },
  { divisao: "94-96", desc: "Outras Atividades de Serviços" },
  { divisao: "97-99", desc: "Serviços Domésticos e Outros" },
];

const PORTES = [
  { value: "mei", label: "MEI", desc: "Microempreendedor Individual (até 1 funcionário)" },
  { value: "micro", label: "Microempresa", desc: "Até 9 funcionários / faturamento até R$ 360k" },
  { value: "pequena", label: "Pequena Empresa", desc: "Até 49 funcionários / faturamento até R$ 4,8M" },
  { value: "media", label: "Média Empresa", desc: "Até 99 funcionários" },
  { value: "grande", label: "Grande Empresa", desc: "100 ou mais funcionários" },
];

const RISCOS_OCUPACIONAIS = [
  { id: "fisico", label: "Físicos", desc: "Ruído, vibração, temperatura, radiação" },
  { id: "quimico", label: "Químicos", desc: "Poeiras, fumos, névoas, gases" },
  { id: "biologico", label: "Biológicos", desc: "Vírus, bactérias, fungos, parasitas" },
  { id: "ergonomico", label: "Ergonômicos", desc: "Esforço físico, posturas inadequadas, repetitividade" },
  { id: "psicossocial", label: "Psicossociais", desc: "Estresse, pressão, assédio, jornada excessiva" },
  { id: "acidente", label: "Mecânicos/Acidente", desc: "Quedas, cortes, esmagamentos, explosões" },
  { id: "altura", label: "Trabalho em Altura", desc: "Atividades acima de 2 metros (NR-35)" },
  { id: "espaco_confinado", label: "Espaço Confinado", desc: "Locais com entrada/saída limitada (NR-33)" },
  { id: "eletrico", label: "Elétrico", desc: "Instalações elétricas energizadas (NR-10)" },
  { id: "maquinas", label: "Máquinas e Equipamentos", desc: "Operação de máquinas perigosas (NR-12)" },
  { id: "ambiental", label: "Impacto Ambiental", desc: "Geração de resíduos, efluentes, emissões" },
];

export interface WizardParams {
  porte: string;
  cnae: string;
  grauRisco: number;
  numTrabalhadores: number;
  riscos: string[];
  atividadeEconomica: string;
}

interface GerarEstruturaWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGerar: (params: WizardParams) => Promise<void>;
  gerando: boolean;
  jaTemEstrutura: boolean;
}

const STEPS = ["Empresa", "Riscos", "Confirmar"];

function calcGrauRisco(cnae: string): number {
  if (!cnae) return 1;
  const division = cnae.slice(0, 2);
  return GRAU_RISCO_NR04[division] || 1;
}

function getPreviewEstrutura(params: Partial<WizardParams>) {
  const gr = params.grauRisco || 1;
  const riscos = params.riscos || [];

  const structure = [
    {
      nome: "Governança e Administração",
      icone: "⚖️",
      subs: ["Contrato Social e Estatuto", "Políticas e Diretrizes", "Licenças e Autorizações", "Certidões", "Registros em Conselhos"],
    },
    {
      nome: "Sistema de Gestão",
      icone: "📋",
      subs: [
        "Procedimentos e Instruções de Trabalho (POPs, ITs)",
        "Registros da Qualidade",
        ...(gr >= 3 ? ["Gestão de Mudanças (MOC)"] : []),
      ],
    },
    {
      nome: "Gestão de Riscos",
      icone: "🎯",
      subs: [
        "Inventário de Riscos",
        "Análise de Riscos (APR / HAZOP)",
        "Planos de Emergência",
        ...(gr >= 3 ? ["Análise de Processos Críticos"] : []),
      ],
    },
    {
      nome: "SST",
      icone: "🦺",
      subs: [
        "Programas Legais (PGR, PCMSO, LTCAT)",
        ...(riscos.includes("ergonomico") ? ["Ergonomia (AEP, AET)"] : []),
        ...(riscos.includes("psicossocial") ? ["Riscos Psicossociais (NR-01)"] : []),
        "Treinamentos (NR-01, NR-05, NR-06" +
          (riscos.includes("eletrico") ? ", NR-10" : "") +
          (riscos.includes("maquinas") ? ", NR-12" : "") +
          ((gr >= 3 || riscos.includes("espaco_confinado")) ? ", NR-33" : "") +
          ((gr >= 3 || riscos.includes("altura")) ? ", NR-35" : "") + ")",
        "Registros e Evidências (CAT, Inspeções)",
      ],
    },
    ...(riscos.includes("ambiental") ? [{
      nome: "Gestão Ambiental",
      icone: "🌿",
      subs: ["Licenciamento Ambiental", "Monitoramento e Controle", "PGRS — Gerenciamento de Resíduos"],
    }] : []),
    {
      nome: "Gestão de Pessoas",
      icone: "👥",
      subs: ["Pastas por colaborador → Admissão, Vida Funcional, Saúde Ocupacional, Desligamento"],
    },
    {
      nome: "Investigação de Incidentes",
      icone: "🔍",
      subs: ["Acidentes de Trabalho", "Quase Acidentes", "Não Conformidades"],
    },
    {
      nome: "Auditorias e Melhoria Contínua",
      icone: "✅",
      subs: ["Auditorias Internas", "Auditorias Externas e Certificações", "Ações Corretivas e Preventivas"],
    },
  ];

  return structure;
}

export function GerarEstruturaWizard({ open, onOpenChange, onGerar, gerando, jaTemEstrutura }: GerarEstruturaWizardProps) {
  const [step, setStep] = useState(0);
  const [params, setParams] = useState<Partial<WizardParams>>({
    porte: "",
    cnae: "",
    grauRisco: 1,
    numTrabalhadores: 0,
    riscos: [],
    atividadeEconomica: "",
  });
  const [cnaeSearch, setCnaeSearch] = useState("");
  const [importandoPGR, setImportandoPGR] = useState(false);
  const [pgrInfo, setPgrInfo] = useState<{ nome: string; data: string } | null>(null);
  const { empresaAtiva } = useEmpresaAtiva();
  const { toast } = useToast();

  // Pré-preencher com dados da empresa ativa ao abrir o wizard
  useEffect(() => {
    if (!open) return;

    const empresa = empresaAtiva;
    if (!empresa) return;

    // Determinar porte com base em total_colaboradores
    const n = empresa.total_colaboradores || 0;
    let porte = "";
    if (n <= 1) porte = "mei";
    else if (n <= 9) porte = "micro";
    else if (n <= 49) porte = "pequena";
    else if (n <= 99) porte = "media";
    else porte = "grande";

    // Extrair primeiros 2 dígitos do CNAE
    const cnaeRaw = empresa.cnae_principal || "";
    const cnaeDigitos = cnaeRaw.replace(/\D/g, "").slice(0, 2).padStart(2, "0");
    const grauRiscoEmpresa = empresa.grau_risco || GRAU_RISCO_NR04[cnaeDigitos] || 1;

    // Encontrar a descrição do setor com base no CNAE
    const divNum = parseInt(cnaeDigitos, 10);
    const grupoMatch = CNAE_GRUPOS.find(g => {
      const partes = g.divisao.split("-");
      const min = parseInt(partes[0]);
      const max = partes[1] ? parseInt(partes[1]) : min;
      return divNum >= min && divNum <= max;
    });

    setParams(prev => ({
      ...prev,
      porte: porte || prev.porte || "",
      cnae: cnaeDigitos || prev.cnae || "",
      grauRisco: grauRiscoEmpresa,
      numTrabalhadores: n > 0 ? n : (prev.numTrabalhadores || 0),
      atividadeEconomica: empresa.cnae_descricao || grupoMatch?.desc || prev.atividadeEconomica || "",
    }));

    if (cnaeDigitos) setCnaeSearch("");
  }, [open, empresaAtiva]);

  const grauRiscoAuto = calcGrauRisco(params.cnae || "");
  const grauRiscoFinal = params.grauRisco || grauRiscoAuto;

  const grauLabel = ["", "Grau 1 — Baixo", "Grau 2 — Médio", "Grau 3 — Alto", "Grau 4 — Muito Alto"];
  const grauColor = ["", "text-green-600", "text-yellow-600", "text-orange-600", "text-red-600"];

  const filteredGrupos = CNAE_GRUPOS.filter(g =>
    g.desc.toLowerCase().includes(cnaeSearch.toLowerCase()) || g.divisao.includes(cnaeSearch)
  );

  const toggleRisco = (id: string) => {
    setParams(p => ({
      ...p,
      riscos: p.riscos?.includes(id)
        ? p.riscos.filter(r => r !== id)
        : [...(p.riscos || []), id],
    }));
  };

  const canNext = () => {
    if (step === 0) return !!params.porte && !!params.cnae && (params.numTrabalhadores || 0) > 0;
    if (step === 1) return true;
    return true;
  };

  const handleGerar = async () => {
    await onGerar({
      porte: params.porte!,
      cnae: params.cnae!,
      grauRisco: grauRiscoFinal,
      numTrabalhadores: params.numTrabalhadores || 1,
      riscos: params.riscos || [],
      atividadeEconomica: params.atividadeEconomica || "",
    });
    onOpenChange(false);
    setStep(0);
  };

  const importarRiscosDoPGR = async () => {
    if (!empresaAtiva) {
      toast({ title: "Nenhuma empresa selecionada", variant: "destructive" });
      return;
    }
    setImportandoPGR(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", session?.user?.id)
        .single();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-pgr-riscos`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            empresa_id: empresaAtiva.id,
            tenant_id: profile?.tenant_id,
          }),
        }
      );

      const result = await response.json();

      if (!result.found) {
        toast({
          title: "PGR não encontrado",
          description: "Nenhum PGR cadastrado no Compliance SST para esta empresa. Selecione os riscos manualmente.",
          variant: "destructive",
        });
        return;
      }

      if (result.riscos?.length > 0) {
        setParams(p => ({ ...p, riscos: result.riscos }));
        setPgrInfo({ nome: result.pgr_nome || "PGR", data: result.pgr_data || "" });
        toast({
          title: "Riscos importados do PGR! ✅",
          description: `${result.riscos.length} categoria(s) identificada(s) em "${result.pgr_nome}".${result.from_cache ? " (cache)" : " (IA)"}`,
        });
      } else {
        toast({
          title: "PGR encontrado, mas sem riscos mapeados",
          description: "Não foi possível identificar riscos automaticamente. Complete manualmente.",
        });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao importar riscos", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setImportandoPGR(false);
    }
  };

  const preview = getPreviewEstrutura({ ...params, grauRisco: grauRiscoFinal });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl h-[90vh] max-h-[90vh] overflow-hidden flex flex-col p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {jaTemEstrutura ? "Gerar Estrutura Padrão de Documentos" : "Configurar estrutura de documentos"}
          </DialogTitle>
          <DialogDescription>
            {jaTemEstrutura
              ? "Configure os parâmetros da empresa para gerar a estrutura ideal de pastas"
              : "Detectamos que sua empresa ainda não tem pastas de documentos. Confirme os dados abaixo — já pré-preenchidos com o perfil da empresa — e gere a estrutura completa em segundos."}
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 px-1">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              <span className={cn("text-xs font-medium", i === step ? "text-foreground" : "text-muted-foreground")}>{s}</span>
              {i < STEPS.length - 1 && <div className={cn("flex-1 h-px", i < step ? "bg-primary" : "bg-border")} />}
            </div>
          ))}
        </div>

        {jaTemEstrutura && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 border border-primary/30 text-sm">
            <AlertCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <span className="text-foreground">
              <strong>Estrutura existente detectada.</strong> Serão criadas apenas as pastas que ainda não existem — nenhum dado será removido ou substituído.
            </span>
          </div>
        )}

        <ScrollArea className="flex-1 min-h-0 pr-2">
          <AnimatePresence mode="wait">

            {/* STEP 0 — Empresa */}
            {step === 0 && (
              <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 py-2">
                {/* Banner empresa ativa */}
                {empresaAtiva ? (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                    <Building2 className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <span className="font-medium">Empresa selecionada: </span>
                      <span className="text-primary">{empresaAtiva.razao_social || empresaAtiva.nome_fantasia}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">Os campos abaixo foram pré-preenchidos com os dados do cadastro desta empresa.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-sm">
                    <Building2 className="w-4 h-4 text-destructive shrink-0" />
                    <p className="text-destructive">Nenhuma empresa selecionada no cabeçalho. Preencha os campos manualmente.</p>
                  </div>
                )}
                {/* Porte */}
                <div className="space-y-2">
                  <Label className="font-semibold">Porte da empresa *</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {PORTES.map(p => (
                      <div
                        key={p.value}
                        onClick={() => setParams(prev => ({ ...prev, porte: p.value }))}
                        className={cn(
                          "p-3 rounded-lg border cursor-pointer transition-all",
                          params.porte === p.value ? "border-primary bg-primary/5" : "hover:border-primary/40"
                        )}
                      >
                        <p className="font-medium text-sm">{p.label}</p>
                        <p className="text-xs text-muted-foreground">{p.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CNAE */}
                <div className="space-y-2">
                  <Label className="font-semibold">Atividade Econômica (CNAE) *</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar setor (ex: saúde, construção...)"
                      className="pl-9"
                      value={cnaeSearch}
                      onChange={e => setCnaeSearch(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto">
                    {filteredGrupos.map(g => {
                      const div = parseInt(g.divisao.split("-")[0]);
                      const divStr = div.toString().padStart(2, "0");
                      const gr = GRAU_RISCO_NR04[divStr] || 1;
                      return (
                        <div
                          key={g.divisao}
                          onClick={() => {
                            setParams(prev => ({
                              ...prev,
                              cnae: divStr,
                              atividadeEconomica: g.desc,
                              grauRisco: gr,
                            }));
                          }}
                          className={cn(
                            "flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all text-sm",
                            params.cnae === divStr ? "border-primary bg-primary/5" : "hover:border-primary/40"
                          )}
                        >
                          <span>{g.desc}</span>
                          <Badge variant="outline" className={cn("text-[10px]", grauColor[gr])}>
                            GR {gr}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                  {params.cnae && (
                    <div className={cn("text-sm font-medium mt-1", grauColor[grauRiscoFinal])}>
                      ✓ {params.atividadeEconomica} — {grauLabel[grauRiscoFinal]} (NR-04)
                    </div>
                  )}
                </div>

                {/* Número de trabalhadores */}
                <div className="space-y-2">
                  <Label className="font-semibold">Número de trabalhadores *</Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Ex: 50"
                    value={params.numTrabalhadores || ""}
                    onChange={e => setParams(prev => ({ ...prev, numTrabalhadores: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </motion.div>
            )}

            {/* STEP 1 — Riscos */}
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 py-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <Label className="font-semibold">Exposição a riscos ocupacionais</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={importarRiscosDoPGR}
                      disabled={importandoPGR}
                      className="gap-2 text-xs h-8"
                    >
                      {importandoPGR
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <FileSearch className="w-3.5 h-3.5 text-primary" />
                      }
                      {importandoPGR ? "Analisando PGR..." : "Importar do PGR"}
                    </Button>
                  </div>
                  {pgrInfo && (
                    <div className="flex items-center gap-2 p-2 rounded-md bg-primary/5 border border-primary/20 text-xs text-primary">
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span>Riscos identificados via IA a partir do PGR: <strong>{pgrInfo.nome}</strong>{pgrInfo.data ? ` (${pgrInfo.data})` : ""}</span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Selecione os riscos presentes na empresa. Isso define quais pastas e treinamentos serão incluídos.</p>
                  <div className="grid grid-cols-1 gap-2">
                    {RISCOS_OCUPACIONAIS.map(r => (
                      <label
                        key={r.id}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                          params.riscos?.includes(r.id) ? "border-primary bg-primary/5" : "hover:border-primary/30"
                        )}
                      >
                        <Checkbox
                          checked={params.riscos?.includes(r.id)}
                          onCheckedChange={() => toggleRisco(r.id)}
                          className="mt-0.5"
                        />
                        <div>
                          <p className="text-sm font-medium">{r.label}</p>
                          <p className="text-xs text-muted-foreground">{r.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2 — Preview */}
            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 py-2">
                <div className="p-3 rounded-lg bg-muted/50 border text-sm space-y-1">
                  <p><span className="font-medium">Porte:</span> {PORTES.find(p => p.value === params.porte)?.label}</p>
                  <p><span className="font-medium">Atividade:</span> {params.atividadeEconomica}</p>
                  <p><span className="font-medium">Grau de Risco:</span> <span className={grauColor[grauRiscoFinal]}>{grauLabel[grauRiscoFinal]}</span></p>
                  <p><span className="font-medium">Trabalhadores:</span> {params.numTrabalhadores}</p>
                  <p><span className="font-medium">Riscos selecionados:</span> {(params.riscos?.length || 0) === 0 ? "Nenhum específico" : params.riscos?.join(", ")}</p>
                </div>

                <div className="space-y-2">
                  <Label className="font-semibold flex items-center gap-2">
                    <FolderTree className="w-4 h-4 text-primary" />
                    Estrutura que será criada ({preview.length} categorias raiz)
                  </Label>
                  <div className="space-y-2">
                    {preview.map((cat, i) => (
                      <div key={i} className="rounded-lg border p-3">
                        <p className="text-sm font-semibold flex items-center gap-2">
                          <span>{cat.icone}</span> {cat.nome}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {cat.subs.map((s, j) => (
                            <Badge key={j} variant="secondary" className="text-[10px] font-normal">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </ScrollArea>

        {/* Footer */}
        <div className="flex flex-col gap-2 pt-3 border-t">
          {step === 0 && (!params.porte || !params.cnae || !(params.numTrabalhadores && params.numTrabalhadores > 0)) && (
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {!params.porte && <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3 text-destructive" /> Porte obrigatório</span>}
              {!params.cnae && <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3 text-destructive" /> Atividade econômica obrigatória</span>}
              {!(params.numTrabalhadores && params.numTrabalhadores > 0) && <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3 text-destructive" /> Nº de trabalhadores obrigatório</span>}
            </div>
          )}
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={gerando}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
            )}
            <div className="flex-1" />
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep(s => s + 1)} disabled={!canNext()}>
                Próximo <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleGerar} disabled={gerando} className="gap-2">
                {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {gerando ? "Gerando..." : "Gerar Estrutura"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
