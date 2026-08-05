import { useState, useMemo } from "react";
import { useColaboradores } from "@/hooks/useColaboradores";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CompetenciaInput } from "@/components/ui/competencia-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePonto } from "@/hooks/usePonto";
import { usePontoFechamento } from "@/hooks/usePontoFechamento";
import { usePontoBancoHoras } from "@/hooks/usePontoBancoHoras";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { format } from "date-fns";
import { FileDown, FileText, Download } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { formatarHoraMinuto } from "@/lib/ponto/formatoHoras";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import {
  MARCA, ALTURA_CABECALHO, carregarLogo, desenharCabecalho, desenharRodape, estiloTabela,
} from "@/lib/ponto/pdfMarca";

type ReportType = "espelho" | "horas_extras" | "banco_horas" | "absenteismo" | "afd";

const REPORT_TYPES: { value: ReportType; label: string; desc: string }[] = [
  { value: "espelho", label: "Espelho de Ponto", desc: "Resumo mensal de marcações por colaborador" },
  { value: "horas_extras", label: "Horas Extras", desc: "Detalhamento de horas extras do período" },
  { value: "banco_horas", label: "Banco de Horas", desc: "Saldo e movimentações do banco de horas" },
  { value: "absenteismo", label: "Absenteísmo", desc: "Relatório de faltas e atrasos" },
  { value: "afd", label: "AFD (Arquivo Fonte de Dados)", desc: "Arquivo legal conforme Portaria 671" },
];

export function PontoRelatoriosTab() {
  const [competencia, setCompetencia] = useState(format(new Date(), "yyyy-MM"));
  const [tipoRelatorio, setTipoRelatorio] = useState<ReportType>("espelho");
  const [formatoExport, setFormatoExport] = useState<"pdf" | "excel">("pdf");
  const [gerando, setGerando] = useState(false);

  const { usePontoDiario } = usePonto();
  const { useEspelhos } = usePontoFechamento();
  const { useBancoHorasPorCompetencia } = usePontoBancoHoras();

  const year = parseInt(competencia.split("-")[0]);
  const month = parseInt(competencia.split("-")[1]);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const { tenantId } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();

  // Nome das empresas: o relatório de Banco de Horas mistura filiais e o RH
  // pediu para identificar de quem é cada linha.
  const { data: empresas = [] } = useQuery({
    queryKey: ["ponto-relatorio-empresas", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await fromTable("empresa_cadastro")
        .select("id, razao_social, nome_fantasia, cnpj")
        .eq("tenant_id", tenantId) as { data: any[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
  });
  const empresaPorId = (id?: string | null) =>
    id ? empresas.find((x: any) => x.id === id) : undefined;
  const nomeEmpresa = (id?: string | null) => {
    if (!id) return "Sem empresa vinculada";
    const e = empresaPorId(id);
    return e?.nome_fantasia || e?.razao_social || "Sem empresa vinculada";
  };
  // Razão social é o que vale juridicamente no cabeçalho do relatório.
  const razaoSocialEmpresa = (id?: string | null) => {
    const e = empresaPorId(id);
    return e?.razao_social || e?.nome_fantasia || null;
  };
  const soDigitos = (v?: string | null) => (v || "").replace(/\D/g, "");
  const formatarCnpj = (v?: string | null) => {
    const d = soDigitos(v);
    if (d.length !== 14) return null;
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  };
  const empresaDoRelatorio = empresaAtivaId ? razaoSocialEmpresa(empresaAtivaId) : null;
  const cnpjDoRelatorio = empresaAtivaId
    ? formatarCnpj(empresaPorId(empresaAtivaId)?.cnpj)
    : null;


  const { data: espelhos = [] } = useEspelhos(competencia);
  const { data: bancosHorasTodos = [] } = useBancoHorasPorCompetencia(competencia);
  const { colaboradores } = useColaboradores();

  // Demitido não entra no relatório de Banco de Horas: o saldo dele é
  // quitado na rescisão, não na conferência mensal do RH.
  // (useColaboradores já devolve apenas ativos — inativos/desligados ficam fora.)
  const bancosHoras = useMemo(() => {
    const cpfsAtivos = new Set(colaboradores.map((c) => soDigitos(c.cpf)));
    const idsAtivos = new Set(colaboradores.map((c) => c.id));
    return bancosHorasTodos.filter((b: any) => {
      const cpf = soDigitos(b.colaborador_cpf);
      if (cpf && cpfsAtivos.has(cpf)) return true;
      return Boolean(b.colaborador_id && idsAtivos.has(b.colaborador_id));
    });
  }, [bancosHorasTodos, colaboradores]);
  const { data: registrosMes = [], isLoading: carregandoRegistros } = usePontoDiario(startDate, endDate);

  const formatMinutos = (min: number) => formatarHoraMinuto(Math.abs(min || 0));

  // Saldo com sinal (negativo = devendo horas).
  const formatSaldo = (min: number) => formatarHoraMinuto(min || 0);

  // ---------------------------------------------------------------------
  // Espelho de ponto: dia a dia, da MESMA fonte do Banco de Horas
  // (`ponto_saldo_dias_competencia`). Antes o espelho lia os totais gravados
  // em `ponto_espelhos` no fechamento — por isso os dois relatórios não
  // batiam. Espelho é documento de conferência: precisa mostrar cada dia.
  // ---------------------------------------------------------------------
  type MarcacaoDia = {
    hora: string;
    tipo: string | null;
    /** RN26 — origem: O = original do colaborador, A = ajuste do RH. */
    origem: "O" | "A";
  };

  type DiaEspelho = {
    dia: string;
    entrada: string | null;
    saida: string | null;
    trabalhado_min: number;
    jornada_min: number;
    saldo_min: number;
    protegido: boolean;
    equalizacao: boolean;
    excedente_retido_min: number;
    marcacoes: MarcacaoDia[];
  };

  const DIAS_SEMANA = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
  const diaDaSemana = (iso: string) => {
    const [a, m, d] = iso.split("-").map(Number);
    return DIAS_SEMANA[new Date(a, m - 1, d).getDay()];
  };
  const ehDomingo = (iso: string) => diaDaSemana(iso) === "DOM";
  const ehSabado = (iso: string) => diaDaSemana(iso) === "SAB";
  const dataBr = (iso: string) => {
    const [a, m, d] = iso.split("-");
    return `${d}/${m}/${a}`;
  };

  /** RN25 — rótulo de ocorrência do dia. */
  const situacaoDia = (d: DiaEspelho) => {
    if (d.equalizacao) return "Equalização";
    if (d.excedente_retido_min > 0) return "Excede limite diário";
    if (d.protegido) return d.trabalhado_min > 0 ? "Justificado (com trabalho)" : "Justificado";
    if (d.trabalhado_min === 0 && d.jornada_min > 0) return "Falta";
    if (d.trabalhado_min === 0) return ehDomingo(d.dia) ? "DSR" : ehSabado(d.dia) ? "Sábado" : "Sem jornada";
    if (d.jornada_min === 0) return ehDomingo(d.dia) ? "DSR trabalhado" : "Trabalho fora da escala";
    if (d.saldo_min < 0) return "Atraso / débito";
    if (d.saldo_min > 0) return "Trabalhando (crédito)";
    return "Trabalhando";
  };

  /** Percentual aplicável ao excedente do dia (RN17 / art. 59 CLT). */
  const percentualHE = (d: DiaEspelho) =>
    ehDomingo(d.dia) || d.jornada_min === 0 ? "100%" : "50%";

  /** Marcações do dia formatadas com o indicador de origem (RN26). */
  const marcacoesTexto = (d: DiaEspelho) =>
    d.marcacoes.length > 0
      ? d.marcacoes.map((m) => `${m.hora}${m.origem}`).join("  ")
      : "—";

  const carregarEspelhoDetalhado = async () => {
    // Quem entra no espelho: os colaboradores do fechamento quando existe;
    // caso contrário, quem tem marcação na competência.
    const base = espelhos.length > 0
      ? espelhos.map((e: any) => ({ nome: e.colaborador_nome, cpf: soDigitos(e.colaborador_cpf) }))
      : Array.from(new Set(registrosMes.map(r => soDigitos(r.colaborador_cpf)))).map(cpf => ({
          nome: registrosMes.find(r => soDigitos(r.colaborador_cpf) === cpf)?.colaborador_nome || "N/A",
          cpf,
        }));

    const unicos = Array.from(new Map(base.filter(b => b.cpf).map(b => [b.cpf, b])).values())
      .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

    // RN26 — todas as batidas da competência, com origem rastreável.
    const ultimoDia = new Date(year, month, 0).getDate();
    const { data: marcacoesMes } = await fromTable("ponto_marcacoes")
      .select("colaborador_cpf, data_marcacao, hora_marcacao, tipo_marcacao, marcacao_original")
      .gte("data_marcacao", `${competencia}-01`)
      .lte("data_marcacao", `${competencia}-${String(ultimoDia).padStart(2, "0")}`)
      .order("hora_marcacao") as { data: any[] | null; error: any };

    const porCpfDia = new Map<string, MarcacaoDia[]>();
    (marcacoesMes || []).forEach((m: any) => {
      const chave = `${soDigitos(m.colaborador_cpf)}|${m.data_marcacao}`;
      const lista = porCpfDia.get(chave) || [];
      lista.push({
        hora: String(m.hora_marcacao || "").substring(0, 5),
        tipo: m.tipo_marcacao ?? null,
        origem: m.marcacao_original === false ? "A" : "O",
      });
      porCpfDia.set(chave, lista);
    });

    const resultado: Array<{
      nome: string; cpf: string; dias: DiaEspelho[];
      trabalhado: number; previsto: number; creditos: number; debitos: number;
      saldo: number; faltas: number; protegidos: number;
      he50: number; he100: number;
    }> = [];

    for (const c of unicos) {
      const { data, error } = await (supabase.rpc as any)("ponto_saldo_dias_competencia", {
        p_tenant_id: tenantId,
        p_colaborador_cpf: c.cpf,
        p_competencia: competencia,
      });
      if (error) throw error;

      const dias: DiaEspelho[] = ((data || []) as any[]).map(d => ({
        dia: String(d.dia),
        entrada: d.entrada ? String(d.entrada).substring(0, 5) : null,
        saida: d.saida ? String(d.saida).substring(0, 5) : null,
        trabalhado_min: Number(d.trabalhado_min) || 0,
        jornada_min: Number(d.jornada_min) || 0,
        saldo_min: Number(d.saldo_min) || 0,
        protegido: Boolean(d.protegido),
        equalizacao: Boolean(d.equalizacao),
        excedente_retido_min: Number(d.excedente_retido_min) || 0,
        marcacoes: (porCpfDia.get(`${c.cpf}|${String(d.dia)}`) || [])
          .slice()
          .sort((a, b) => a.hora.localeCompare(b.hora)),
      })).sort((a, b) => a.dia.localeCompare(b.dia));

      resultado.push({
        nome: c.nome,
        cpf: c.cpf,
        dias,
        trabalhado: dias.reduce((s, d) => s + d.trabalhado_min, 0),
        previsto: dias.reduce((s, d) => s + d.jornada_min, 0),
        creditos: dias.reduce((s, d) => s + (d.saldo_min > 0 ? d.saldo_min : 0), 0),
        debitos: dias.reduce((s, d) => s + (d.saldo_min < 0 ? -d.saldo_min : 0), 0),
        saldo: dias.reduce((s, d) => s + d.saldo_min, 0),
        faltas: dias.filter(d => !d.protegido && d.jornada_min > 0 && d.trabalhado_min === 0).length,
        protegidos: dias.filter(d => d.protegido).length,
        // Extras separadas por percentual (RN28): 100% em domingo/dia sem
        // escala, 50% nos demais.
        he50: dias.reduce((s, d) => s + (d.saldo_min > 0 && percentualHE(d) === "50%" ? d.saldo_min : 0), 0),
        he100: dias.reduce((s, d) => s + (d.saldo_min > 0 && percentualHE(d) === "100%" ? d.saldo_min : 0), 0),
      });
    }

    return resultado;
  };





  const gerarRelatorio = async () => {
    setGerando(true);
    try {
      if (tipoRelatorio === "afd") {
        await gerarAFD();
        return;
      }

      if (formatoExport === "pdf") {
        await gerarPDF();
      } else {
        await gerarExcel();
      }
    } catch (error) {
      toast.error("Erro ao gerar relatório");
    } finally {
      setGerando(false);
    }
  };

  const gerarAFD = async () => {
    // AFD - Arquivo Fonte de Dados (formato texto conforme Portaria 671)
    // Puxa marcações REAIS da tabela ponto_marcacoes
    const startDate2 = `${competencia}-01`;
    const endMonth2 = parseInt(competencia.split("-")[1]);
    const endYear2 = parseInt(competencia.split("-")[0]);
    const lastDay2 = new Date(endYear2, endMonth2, 0).getDate();
    const endDate2 = `${competencia}-${String(lastDay2).padStart(2, "0")}`;

    const { data: marcacoes, error } = await fromTable("ponto_marcacoes")
      .select("*")
      .gte("data_marcacao", startDate2)
      .lte("data_marcacao", endDate2)
      .order("data_marcacao")
      .order("hora_marcacao") as { data: any[] | null; error: any };

    if (error) {
      toast.error("Erro ao buscar marcações: " + error.message);
      return;
    }

    const registros = marcacoes || [];
    let conteudo = "";

    // Registro tipo 1 - Cabeçalho
    const dataGeracao = format(new Date(), "ddMMyyyy");
    const horaGeracao = format(new Date(), "HHmmss");
    // AFD exige CNPJ e razão social do empregador (Portaria 671/MTP).
    const cnpj = soDigitos(empresaPorId(empresaAtivaId)?.cnpj).padStart(14, "0").slice(0, 14);
    const razaoSocial = (razaoSocialEmpresa(empresaAtivaId) || "YourEyes").slice(0, 150).padEnd(150);

    conteudo += `1${cnpj}${razaoSocial}${dataGeracao}${horaGeracao}\n`;

    // Registro tipo 2 - Identificação do REP-P
    conteudo += `2YourEyes REP-P v1.0\n`;

    // Registro tipo 3 - Marcações de ponto (uma por linha)
    let seq = 0;
    registros.forEach((m: any) => {
      seq++;
      const nsr = String(seq).padStart(10, "0");
      const tipoReg = "3";
      const dataMarcacao = (m.data_marcacao || "").replace(/-/g, "");
      const horaMarcacao = (m.hora_marcacao || "").replace(/:/g, "").substring(0, 4);
      const cpf = (m.colaborador_cpf || "").replace(/\D/g, "").padStart(11, "0");
      
      // Formato: 3 + NSR(10) + Tipo(1) + Data(8) + Hora(4) + CPF(11)
      conteudo += `${tipoReg}${nsr}1${dataMarcacao}${horaMarcacao}${cpf}\n`;
    });

    // Registro tipo 9 - Trailer
    const totalRegistros = String(seq + 2).padStart(10, "0");
    conteudo += `9${totalRegistros}\n`;

    if (seq === 0) {
      toast.warning("Nenhuma marcação encontrada para esta competência.");
      return;
    }

    const blob = new Blob([conteudo], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AFD_${competencia}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`AFD gerado com ${seq} marcações!`);
  };

  const gerarPDF = async () => {
    const doc = new jsPDF();
    const titulo = REPORT_TYPES.find(r => r.value === tipoRelatorio)?.label || "Relatório";
    const subtitulo = REPORT_TYPES.find(r => r.value === tipoRelatorio)?.desc;
    const logo = await carregarLogo();
    const geradoEm = format(new Date(), "dd/MM/yyyy 'às' HH:mm");

    const cabecalho = () => desenharCabecalho(doc, {
      titulo,
      subtitulo,
      empresa: empresaDoRelatorio,
      cnpj: cnpjDoRelatorio,

      competencia,
      geradoEm,
      logoDataUrl: logo,
    });

    if (tipoRelatorio === "espelho") {
      const detalhado = await carregarEspelhoDetalhado();

      if (detalhado.length === 0) {
        autoTable(doc, {
          ...estiloTabela(),
          head: [["Colaborador"]],
          body: [["Nenhum registro no período"]],
          didDrawPage: cabecalho,
        });
      }

      // 1) Resumo da competência — os mesmos números do Banco de Horas.
      if (detalhado.length > 0) {
        autoTable(doc, {
          ...estiloTabela(),
          head: [["Colaborador", "CPF", "Trabalhado", "Previsto", "Créditos", "Débitos", "Saldo", "Faltas"]],
          body: detalhado.map(c => [
            c.nome, c.cpf,
            formatMinutos(c.trabalhado), formatMinutos(c.previsto),
            formatMinutos(c.creditos), formatMinutos(c.debitos),
            formatSaldo(c.saldo), String(c.faltas),
          ]),
          columnStyles: {
            2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" },
            5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "center" },
          },
          didDrawPage: cabecalho,
        });

        // 2) Detalhamento dia a dia — um bloco por colaborador (RN25).
        detalhado.forEach(c => {
          doc.addPage();
          cabecalho();

          const col = colaboradores.find((x: any) => soDigitos(x.cpf) === c.cpf) as any;
          const banco: any = bancosHorasTodos.find(
            (b: any) => soDigitos(b.colaborador_cpf) === c.cpf,
          );

          // Identificação do colaborador
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(MARCA.navy[0], MARCA.navy[1], MARCA.navy[2]);
          doc.text(c.nome, 14, ALTURA_CABECALHO + 2);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(MARCA.cinza[0], MARCA.cinza[1], MARCA.cinza[2]);
          const ident = [
            `CPF ${c.cpf}`,
            col?.cargo ? `Cargo: ${col.cargo}` : null,
            col?.departamento ? `Setor: ${col.departamento}` : null,
            col?.data_admissao ? `Admissão: ${dataBr(String(col.data_admissao).substring(0, 10))}` : null,
            col?.tipo_contrato ? `Contrato: ${col.tipo_contrato}` : null,
          ].filter(Boolean).join("   ·   ");
          doc.text(ident, 14, ALTURA_CABECALHO + 7);

          autoTable(doc, {
            ...estiloTabela(ALTURA_CABECALHO + 11),
            head: [["Data", "Dia", "Marcações", "H.D.", "H.N.", "H.E.", "A.N.", "Saldo", "Ocorrência"]],
            body: c.dias.length > 0
              ? c.dias.map(d => [
                  dataBr(d.dia), diaDaSemana(d.dia),
                  marcacoesTexto(d),
                  formatMinutos(d.trabalhado_min), formatMinutos(d.jornada_min),
                  d.saldo_min > 0 ? `${formatMinutos(d.saldo_min)} (${percentualHE(d)})` : "—",
                  "n/a",
                  formatSaldo(d.saldo_min), situacaoDia(d),
                ])
              : [["Sem dias apurados", "", "", "", "", "", "", "", ""]],
            foot: [[
              "Total", "", "",
              formatMinutos(c.trabalhado), formatMinutos(c.previsto),
              formatMinutos(c.he50 + c.he100), "n/a",
              formatSaldo(c.saldo), `${c.faltas} falta(s)`,
            ]],
            footStyles: {
              fillColor: MARCA.cinzaClaro, textColor: MARCA.navy, fontStyle: "bold" as const,
            },
            styles: { ...estiloTabela().styles, fontSize: 7.5 },
            columnStyles: {
              0: { cellWidth: 15 }, 1: { cellWidth: 10, halign: "center" },
              2: { cellWidth: 42 },
              3: { halign: "right" }, 4: { halign: "right" },
              5: { halign: "right" }, 6: { halign: "center" }, 7: { halign: "right" },
            },
            didDrawPage: cabecalho,
          });

          // Resumo de horas do mês + banco de horas (seções 3.2 e 3.3)
          autoTable(doc, {
            ...estiloTabela((doc as any).lastAutoTable.finalY + 6),
            head: [["Resumo do mês", "", "Banco de horas", ""]],
            body: [
              ["Horas trabalhadas", formatMinutos(c.trabalhado),
                "Saldo anterior", formatSaldo(banco?.saldo_anterior_minutos ?? 0)],
              ["Horas normais previstas", formatMinutos(c.previsto),
                "Créditos do período", formatMinutos(banco?.creditos_minutos ?? c.creditos)],
              ["Extras 50%", formatMinutos(c.he50),
                "Débitos do período", formatMinutos(banco?.debitos_minutos ?? c.debitos)],
              ["Extras 100%", formatMinutos(c.he100),
                "Compensados", formatMinutos(banco?.compensados_minutos ?? 0)],
              ["Adicional noturno", "não apurado neste modelo",
                "Saldo atual", formatSaldo(banco?.saldo_atual_minutos ?? c.saldo)],
              ["Dias justificados (atestado/férias/afastamento)", String(c.protegidos),
                "Faltas não justificadas", String(c.faltas)],
            ],
            columnStyles: { 1: { halign: "right" }, 3: { halign: "right" } },
            didDrawPage: cabecalho,
          });

          // Legenda (3.4) e ciência do colaborador (RN27)
          let y = (doc as any).lastAutoTable.finalY + 8;
          const pageH = doc.internal.pageSize.getHeight();
          if (y > pageH - 60) { doc.addPage(); cabecalho(); y = ALTURA_CABECALHO + 6; }

          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(MARCA.navy[0], MARCA.navy[1], MARCA.navy[2]);
          doc.text("Legenda", 14, y);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(MARCA.cinza[0], MARCA.cinza[1], MARCA.cinza[2]);
          doc.setFontSize(7);
          [
            "H.D. horas do dia · H.N. horas normais previstas · H.E. horas extras · A.N. adicional noturno · Saldo crédito/débito no banco de horas.",
            "Origem da marcação (Portaria MTP 671/2021): O = marcação original do colaborador; A = inclusão/ajuste posterior pelo RH.",
            "Ocorrências: Equalização (compensação mensal), DSR (domingo), Sábado, Justificado (atestado/férias/afastamento), Falta, Atraso/débito, Excede limite diário (art. 59 CLT).",
          ].forEach((linha, i) => {
            doc.text(doc.splitTextToSize(linha, doc.internal.pageSize.getWidth() - 28), 14, y + 5 + i * 7);
          });

          y += 26;
          doc.setFontSize(7.5);
          doc.setTextColor(30, 41, 59);
          doc.text(
            doc.splitTextToSize(
              "Estou de pleno acordo com o que demonstram as marcações acima, sendo que representam o ocorrido neste período. Ressalvas: ______________________________________________",
              doc.internal.pageSize.getWidth() - 28,
            ),
            14, y,
          );
          y += 18;
          doc.setDrawColor(148, 163, 184);
          doc.line(14, y, 95, y);
          doc.line(110, y, 190, y);
          doc.setFontSize(7);
          doc.setTextColor(MARCA.cinza[0], MARCA.cinza[1], MARCA.cinza[2]);
          doc.text(`${c.nome} — colaborador`, 14, y + 4);
          doc.text("Responsável pelo RH — data ___/___/______", 110, y + 4);
        });
      }


    } else if (tipoRelatorio === "horas_extras") {
      // O modelo atual apura saldo em minutos, não percentuais: imprimir
      // "0h 00min" em HE 50/100 afirmaria que não houve hora extra.
      const head = [["Colaborador", "Trabalhado", "Previsto", "Excedente do período"]];
      const comExcedente = espelhos.filter(e => (e.banco_horas_saldo_minutos ?? 0) > 0);
      const body = comExcedente.length > 0
        ? comExcedente.map(e => [
            e.colaborador_nome,
            formatMinutos(e.total_trabalhado_minutos ?? 0),
            formatMinutos(e.total_jornada_prevista_minutos ?? 0),
            "+" + formatMinutos(e.banco_horas_saldo_minutos ?? 0),
          ])
        : [["Nenhum excedente apurado no período", "", "", ""]];

      autoTable(doc, {
        ...estiloTabela(),
        head,
        body,
        columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
        didDrawPage: cabecalho,
      });

      const yFim = (doc as any).lastAutoTable?.finalY || ALTURA_CABECALHO;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(MARCA.cinza[0], MARCA.cinza[1], MARCA.cinza[2]);
      doc.text(
        "A separação entre hora extra 50% e 100% não é apurada neste modelo — a apuração trabalha em saldo de minutos.",
        14, yFim + 6);
      doc.text(
        "O adicional de feriado trabalhado é calculado em campo próprio, na exportação da Folha.",
        14, yFim + 10);
    } else if (tipoRelatorio === "absenteismo") {
      const head = [["Colaborador", "Faltas", "Atrasos"]];
      const faltosos = registrosMes.filter(r => r.status === "falta" || r.status === "atraso");
      const body: any[] = [];
      if (faltosos.length > 0) {
        const colabNames = Array.from(new Set(faltosos.map(f => f.colaborador_nome)));
        colabNames.forEach(nome => {
          const totalFaltas = faltosos.filter(f => f.colaborador_nome === nome && f.status === "falta").length;
          const totalAtrasos = faltosos.filter(f => f.colaborador_nome === nome && f.status === "atraso").length;
          body.push([nome, String(totalFaltas), String(totalAtrasos)]);
        });
      } else {
        body.push(["Nenhuma falta ou atraso registrado no período", "", ""]);
      }

      autoTable(doc, {
        ...estiloTabela(),
        head,
        body,
        columnStyles: { 1: { halign: "center" }, 2: { halign: "center" } },
        didDrawPage: cabecalho,
      });
    } else if (tipoRelatorio === "banco_horas") {
      // Agrupado por empresa: o RH pediu para saber de quem é cada linha, e
      // o subtotal por empresa é o que ele leva para a conferência.
      const head = [["Colaborador", "Saldo Anterior", "Créditos", "Débitos", "Compensados", "Saldo Atual"]];
      const porEmpresa = new Map<string, any[]>();
      bancosHoras.forEach(b => {
        const chave = nomeEmpresa((b as any).empresa_id);
        if (!porEmpresa.has(chave)) porEmpresa.set(chave, []);
        porEmpresa.get(chave)!.push(b);
      });

      const body: any[] = [];
      const estilosLinha: Record<number, any> = {};
      let idx = 0;
      let totalGeral = 0;

      Array.from(porEmpresa.keys())
        .sort((a, b) => a.localeCompare(b, "pt-BR"))
        .forEach(emp => {
          const lista = porEmpresa.get(emp)!;
          estilosLinha[idx] = {
            fillColor: [226, 236, 247],
            fontStyle: "bold",
            textColor: MARCA.navy,
          };
          body.push([emp, "", "", "", "", ""]);
          idx += 1;

          let soma = 0;
          lista.forEach((b: any) => {
            soma += b.saldo_atual_minutos || 0;
            body.push([
              "   " + b.colaborador_nome,
              formatSaldo(b.saldo_anterior_minutos),
              "+" + formatMinutos(b.creditos_minutos),
              "-" + formatMinutos(b.debitos_minutos),
              formatMinutos(b.compensados_minutos),
              formatSaldo(b.saldo_atual_minutos),
            ]);
            idx += 1;
          });

          estilosLinha[idx] = { fillColor: MARCA.cinzaClaro, fontStyle: "bold" };
          body.push([`   Subtotal — ${lista.length} colaborador(es)`, "", "", "", "", formatSaldo(soma)]);
          idx += 1;
          totalGeral += soma;
        });

      if (body.length > 0) {
        estilosLinha[idx] = { fillColor: MARCA.navy, textColor: MARCA.branco, fontStyle: "bold" };
        body.push(["TOTAL GERAL", "", "", "", "", formatSaldo(totalGeral)]);
      }

      autoTable(doc, {
        ...estiloTabela(),
        head,
        body: body.length > 0
          ? body
          : [['Nenhum saldo apurado nesta competência. Use "Apurar agora" no Banco de Horas.', "", "", "", "", ""]],
        columnStyles: {
          1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" },
          4: { halign: "right" }, 5: { halign: "right" },
        },
        didParseCell: (data: any) => {
          if (data.section === "body" && estilosLinha[data.row.index]) {
            Object.assign(data.cell.styles, estilosLinha[data.row.index]);
          }
        },
        didDrawPage: cabecalho,
      });
    }

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      desenharRodape(doc, i, pageCount);
    }

    doc.save(`${titulo.replace(/\s/g, "_")}_${competencia}.pdf`);
    toast.success("PDF gerado!");
  };

  const gerarExcel = async () => {
    const titulo = REPORT_TYPES.find(r => r.value === tipoRelatorio)?.label || "Relatório";
    const wb = XLSX.utils.book_new();

    if (tipoRelatorio === "espelho") {
      // Duas abas: resumo (mesmos números do Banco de Horas) e dia a dia.
      const detalhado = await carregarEspelhoDetalhado();
      const resumo = detalhado.map(c => ({
        Colaborador: c.nome,
        CPF: c.cpf,
        "Trabalhado (min)": c.trabalhado,
        "Previsto (min)": c.previsto,
        "Créditos (min)": c.creditos,
        "Débitos (min)": c.debitos,
        "Saldo (min)": c.saldo,
        Faltas: c.faltas,
        "Dias justificados": c.protegidos,
        Competência: competencia,
      }));
      const diario = detalhado.flatMap(c => c.dias.map(d => ({
        Colaborador: c.nome,
        CPF: c.cpf,
        Data: dataBr(d.dia),
        "Dia da semana": diaDaSemana(d.dia),
        "Marcações (O=original, A=ajuste)": marcacoesTexto(d),
        Entrada: d.entrada || "",
        Saída: d.saida || "",
        "Trabalhado (min)": d.trabalhado_min,
        "Previsto (min)": d.jornada_min,
        "Extras (min)": d.saldo_min > 0 ? d.saldo_min : 0,
        "% Extras": d.saldo_min > 0 ? percentualHE(d) : "",
        "Saldo (min)": d.saldo_min,
        Ocorrência: situacaoDia(d),
      })));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), "Resumo");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(diario), "Dia a dia");
      XLSX.writeFile(wb, `Espelho_de_Ponto_${competencia}.xlsx`);
      toast.success("Excel gerado!");
      return;
    }

    let dados: any[] = [];

    if (tipoRelatorio === "banco_horas") {
      dados = bancosHoras.map(b => ({
        Empresa: nomeEmpresa((b as any).empresa_id),
        Colaborador: b.colaborador_nome,
        CPF: b.colaborador_cpf,
        "Saldo Anterior (min)": b.saldo_anterior_minutos,
        "Créditos (min)": b.creditos_minutos,
        "Débitos (min)": b.debitos_minutos,
        "Compensados (min)": b.compensados_minutos,
        "Saldo Atual (min)": b.saldo_atual_minutos,
        Competência: b.competencia,
      }));
    } else {
      dados = registrosMes.map(r => ({
        Data: r.data,
        Colaborador: r.colaborador_nome,
        CPF: r.colaborador_cpf,
        Entrada: r.entrada,
        "Saída Almoço": r.saida_almoco,
        "Retorno Almoço": r.retorno_almoco,
        Saída: r.saida,
        Status: r.status,
        Observação: r.observacao
      }));
    }

    const ws = XLSX.utils.json_to_sheet(dados);
    XLSX.utils.book_append_sheet(wb, ws, titulo);
    XLSX.writeFile(wb, `${titulo.replace(/\s/g, "_")}_${competencia}.xlsx`);
    toast.success("Excel gerado!");
  };


  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileDown className="w-5 h-5 text-primary" /> Relatórios do Ponto
        </h3>
        <p className="text-sm text-muted-foreground">Gere relatórios legais e gerenciais</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Competência</Label>
          <CompetenciaInput value={competencia} onChange={setCompetencia} />
        </div>
        <div className="space-y-2">
          <Label>Tipo de Relatório</Label>
          <Select value={tipoRelatorio} onValueChange={v => setTipoRelatorio(v as ReportType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {REPORT_TYPES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Formato</Label>
          {tipoRelatorio === "afd" ? (
            <Input value="TXT (Portaria 671)" disabled />
          ) : (
            <Select value={formatoExport} onValueChange={v => setFormatoExport(v as "pdf" | "excel")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="excel">Excel</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Data preview/summary */}
      {!carregandoRegistros && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Resumo do Período</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-2xl font-bold">{registrosMes.length}</p>
                <p className="text-xs text-muted-foreground">Total de Batidas</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{new Set(registrosMes.map(r => r.colaborador_cpf)).size}</p>
                <p className="text-xs text-muted-foreground">Colaboradores</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-500">
                  {registrosMes.filter(r => r.status === "falta").length}
                </p>
                <p className="text-xs text-muted-foreground">Faltas Identificadas</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-500">
                  {espelhos.length > 0 ? "Fechado" : "Aberto"}
                </p>
                <p className="text-xs text-muted-foreground">Status do Mês</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report description */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">{REPORT_TYPES.find(r => r.value === tipoRelatorio)?.label}</p>
              <p className="text-sm text-muted-foreground">{REPORT_TYPES.find(r => r.value === tipoRelatorio)?.desc}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={gerarRelatorio} disabled={gerando} className="w-full md:w-auto">
        <Download className="w-4 h-4 mr-2" />
        {gerando ? "Gerando..." : "Gerar Relatório"}
      </Button>

      {/* Info about AFD/AEFP */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <h4 className="font-medium mb-2">📋 Arquivos Legais (Portaria MTP 671/2021)</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• <strong>AFD</strong> — Arquivo Fonte de Dados: registro imutável de todas as marcações (.txt)</li>
            <li>• <strong>AEFP</strong> — Espelho de Ponto: gerado automaticamente na aba Fechamento</li>
            <li>• Retenção mínima: 5 anos para fiscalização trabalhista</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
