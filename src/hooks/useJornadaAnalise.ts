import { useState } from "react";
import { useTenant } from "./useTenant";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export interface DadoJornada {
  colaboradorId: string;
  colaboradorNome: string;
  colaboradorCpf: string;
  data: string;
  entrada: string | null;
  saidaAlmoco: string | null;
  retornoAlmoco: string | null;
  saida: string | null;
  horasTrabalhadas: number | null;
  horasExtras: number | null;
  atraso: number | null;
  ajusteManual: boolean;
  linha: number;
  erros: string[];
}

export interface MapeamentoColunas {
  colaboradorNome: number;
  colaboradorCpf: number;
  data: number;
  entrada: number;
  saidaAlmoco: number;
  retornoAlmoco: number;
  saida: number;
  horasTrabalhadas: number;
  horasExtras: number;
  atraso: number;
  ajusteManual: number;
}

interface ResultadoImportacaoJornada {
  total: number;
  importados: number;
  atualizados: number;
  erros: { linha: number; mensagem: string }[];
}

function parsarHora(valor: any): string | null {
  if (!valor) return null;
  const texto = String(valor).trim();
  
  // HH:MM or HH:MM:SS
  const match = texto.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match) {
    return `${match[1].padStart(2, "0")}:${match[2]}:${match[3] || "00"}`;
  }
  
  // Excel decimal time (0.75 = 18:00)
  if (typeof valor === "number" && valor >= 0 && valor <= 1) {
    const totalMinutes = Math.round(valor * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
  }
  
  return null;
}

function parsarNumero(valor: any): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const num = parseFloat(String(valor).replace(",", "."));
  return isNaN(num) ? null : num;
}

function parsarData(valor: any): string | null {
  if (!valor) return null;
  
  if (typeof valor === "number") {
    const data = XLSX.SSF.parse_date_code(valor);
    if (data) {
      return `${data.y}-${String(data.m).padStart(2, "0")}-${String(data.d).padStart(2, "0")}`;
    }
  }
  
  const texto = String(valor).trim();
  const matchDMY = texto.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (matchDMY) {
    return `${matchDMY[3]}-${matchDMY[2].padStart(2, "0")}-${matchDMY[1].padStart(2, "0")}`;
  }
  
  const matchYMD = texto.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (matchYMD) {
    return `${matchYMD[1]}-${matchYMD[2].padStart(2, "0")}-${matchYMD[3].padStart(2, "0")}`;
  }
  
  return null;
}

export function useJornadaImportacao() {
  const { tenantId } = useTenant();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const lerArquivo = async (file: File): Promise<{ headers: string[]; dados: string[][] }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array", cellDates: true });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as string[][];
          
          if (jsonData.length < 2) {
            reject(new Error("Arquivo vazio ou sem dados"));
            return;
          }
          
          const headers = jsonData[0].map(h => String(h || "").trim());
          resolve({ headers, dados: jsonData.slice(1) });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
      reader.readAsArrayBuffer(file);
    });
  };

  const processarDados = (
    dados: string[][],
    mapeamento: Partial<MapeamentoColunas>
  ): DadoJornada[] => {
    const resultado: DadoJornada[] = [];
    
    for (let i = 0; i < dados.length; i++) {
      const linha = dados[i];
      const erros: string[] = [];
      
      const nome = mapeamento.colaboradorNome !== undefined ? String(linha[mapeamento.colaboradorNome] || "").trim() : "";
      const cpf = mapeamento.colaboradorCpf !== undefined ? String(linha[mapeamento.colaboradorCpf] || "").replace(/\D/g, "").padStart(11, "0") : "";
      const data = mapeamento.data !== undefined ? parsarData(linha[mapeamento.data]) : null;
      const entrada = mapeamento.entrada !== undefined ? parsarHora(linha[mapeamento.entrada]) : null;
      const saidaAlmoco = mapeamento.saidaAlmoco !== undefined ? parsarHora(linha[mapeamento.saidaAlmoco]) : null;
      const retornoAlmoco = mapeamento.retornoAlmoco !== undefined ? parsarHora(linha[mapeamento.retornoAlmoco]) : null;
      const saida = mapeamento.saida !== undefined ? parsarHora(linha[mapeamento.saida]) : null;
      const horasTrabalhadas = mapeamento.horasTrabalhadas !== undefined ? parsarNumero(linha[mapeamento.horasTrabalhadas]) : null;
      const horasExtras = mapeamento.horasExtras !== undefined ? parsarNumero(linha[mapeamento.horasExtras]) : null;
      const atraso = mapeamento.atraso !== undefined ? parsarNumero(linha[mapeamento.atraso]) : null;
      const ajusteManual = mapeamento.ajusteManual !== undefined ? ["sim", "s", "1", "true", "yes"].includes(String(linha[mapeamento.ajusteManual] || "").toLowerCase()) : false;
      
      if (!nome && !cpf) continue;
      if (!nome) erros.push("Nome é obrigatório");
      if (!data) erros.push("Data inválida ou ausente");
      
      resultado.push({
        colaboradorId: cpf || nome,
        colaboradorNome: nome,
        colaboradorCpf: cpf,
        data: data || "",
        entrada,
        saidaAlmoco,
        retornoAlmoco,
        saida,
        horasTrabalhadas,
        horasExtras,
        atraso,
        ajusteManual,
        linha: i + 2,
        erros,
      });
    }
    
    return resultado;
  };

  const importarParaPontoDiario = async (
    dados: DadoJornada[],
    nomeArquivo: string
  ): Promise<ResultadoImportacaoJornada> => {
    if (!tenantId) throw new Error("Tenant não encontrado");
    
    setIsProcessing(true);
    setProgress(0);
    
    const resultado: ResultadoImportacaoJornada = {
      total: dados.length,
      importados: 0,
      atualizados: 0,
      erros: [],
    };
    
    try {
      const dadosValidos = dados.filter(d => d.erros.length === 0);
      const dadosComErros = dados.filter(d => d.erros.length > 0);
      
      dadosComErros.forEach(d => {
        resultado.erros.push({ linha: d.linha, mensagem: d.erros.join("; ") });
      });
      
      // Create import record
      const { data: importacao } = await supabase
        .from("jornada_importacoes")
        .insert({
          tenant_id: tenantId,
          nome_arquivo: nomeArquivo,
          tipo_arquivo: nomeArquivo.endsWith(".csv") ? "csv" : "xlsx",
          total_registros: dados.length,
          status: "processando",
        })
        .select("id")
        .single();
      
      setProgress(10);
      
      // Check existing records
      const cpfsUnicos = [...new Set(dadosValidos.map(d => d.colaboradorCpf).filter(Boolean))];
      const { data: existentes } = await supabase
        .from("ponto_diario")
        .select("id, colaborador_cpf, data")
        .eq("tenant_id", tenantId)
        .in("colaborador_cpf", cpfsUnicos.length > 0 ? cpfsUnicos : ["__none__"]);
      
      const existenteMap = new Map<string, string>();
      existentes?.forEach(e => {
        existenteMap.set(`${e.colaborador_cpf}_${e.data}`, e.id);
      });
      
      setProgress(20);
      
      // Process in batches
      const batchSize = 50;
      for (let i = 0; i < dadosValidos.length; i += batchSize) {
        const batch = dadosValidos.slice(i, i + batchSize);
        
        for (const dado of batch) {
          const chave = `${dado.colaboradorCpf}_${dado.data}`;
          const registro = {
            tenant_id: tenantId,
            colaborador_cpf: dado.colaboradorCpf,
            colaborador_id: dado.colaboradorCpf,
            colaborador_nome: dado.colaboradorNome,
            data: dado.data,
            entrada: dado.entrada,
            saida_almoco: dado.saidaAlmoco,
            retorno_almoco: dado.retornoAlmoco,
            saida: dado.saida,
            horas_trabalhadas: dado.horasTrabalhadas ? `${Math.floor(dado.horasTrabalhadas)}:${String(Math.round((dado.horasTrabalhadas % 1) * 60)).padStart(2, "0")}:00` : null,
            horas_extras: dado.horasExtras ? `${Math.floor(dado.horasExtras)}:${String(Math.round((dado.horasExtras % 1) * 60)).padStart(2, "0")}:00` : null,
            status: dado.entrada && dado.saida ? "regular" : "incompleto",
            observacao: dado.ajusteManual ? "Ajuste manual identificado na importação" : null,
          };
          
          try {
            if (existenteMap.has(chave)) {
              const { error } = await supabase
                .from("ponto_diario")
                .update(registro)
                .eq("id", existenteMap.get(chave)!);
              if (error) {
                resultado.erros.push({ linha: dado.linha, mensagem: error.message });
              } else {
                resultado.atualizados++;
              }
            } else {
              const { error } = await supabase
                .from("ponto_diario")
                .insert(registro);
              if (error) {
                resultado.erros.push({ linha: dado.linha, mensagem: error.message });
              } else {
                resultado.importados++;
              }
            }
          } catch (err: any) {
            resultado.erros.push({ linha: dado.linha, mensagem: err.message });
          }
        }
        
        setProgress(20 + Math.round((i / dadosValidos.length) * 80));
      }
      
      // Update import record
      if (importacao?.id) {
        await supabase
          .from("jornada_importacoes")
          .update({
            registros_importados: resultado.importados + resultado.atualizados,
            registros_erros: resultado.erros.length,
            status: resultado.erros.length === 0 ? "concluido" : resultado.importados > 0 ? "parcial" : "erro",
            erros: resultado.erros as any,
          })
          .eq("id", importacao.id);
      }
      
      return resultado;
    } finally {
      setIsProcessing(false);
      setProgress(100);
    }
  };

  const analisarJornada = async (periodoInicio: string, periodoFim: string) => {
    if (!tenantId) throw new Error("Tenant não encontrado");
    
    // Fetch ponto_diario data for the period
    const { data: pontos, error } = await supabase
      .from("ponto_diario")
      .select("*")
      .eq("tenant_id", tenantId)
      .gte("data", periodoInicio)
      .lte("data", periodoFim)
      .order("data", { ascending: true });
    
    if (error) throw error;
    if (!pontos || pontos.length === 0) return [];
    
    // Group by collaborator
    const porColaborador = new Map<string, typeof pontos>();
    pontos.forEach(p => {
      const key = p.colaborador_cpf;
      if (!porColaborador.has(key)) porColaborador.set(key, []);
      porColaborador.get(key)!.push(p);
    });
    
    // Fetch parameters
    const { data: parametros } = await supabase
      .from("jornada_parametros")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("ativo", true)
      .limit(1)
      .single();
    
    const params = parametros || {
      jornada_diaria_max: 8,
      jornada_semanal_max: 44,
      horas_extras_diaria_max: 2,
      intervalo_intrajornada_min: 60,
      descanso_interjornada_min: 11,
    };
    
    // Fetch admissoes for department/cargo enrichment
    const { data: admissoes } = await supabase
      .from("admissoes")
      .select("cpf, departamento, cargo")
      .eq("tenant_id", tenantId);
    
    const profileMap = new Map<string, any>();
    admissoes?.forEach(p => { if (p.cpf) profileMap.set(p.cpf.replace(/\D/g, ""), p); });
    
    const analises: any[] = [];
    
    for (const [cpf, registros] of porColaborador) {
      let totalHoras = 0;
      let totalExtras = 0;
      let totalAtrasos = 0;
      let totalAjustes = 0;
      let violacoesIntervalo = 0;
      let violacoesInterjornada = 0;
      let violacoesJornadaDiaria = 0;
      let violacoesHorasExtras = 0;
      let violacoesDsr = 0;
      
      let saidaAnterior: string | null = null;
      
      // DSR: check for 7 consecutive days without rest
      const datasSet = new Set(registros.map(r => r.data));
      const sortedDates = [...datasSet].sort();
      let consecutivos = 0;
      for (let d = 0; d < sortedDates.length; d++) {
        if (d === 0) { consecutivos = 1; continue; }
        const prev = new Date(sortedDates[d - 1]);
        const curr = new Date(sortedDates[d]);
        const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
        if (diff === 1) {
          consecutivos++;
          if (consecutivos >= 7) violacoesDsr++;
        } else {
          consecutivos = 1;
        }
      }
      
      registros.forEach(r => {
        const horas = parseIntervalToHours(r.horas_trabalhadas);
        const extras = parseIntervalToHours(r.horas_extras);
        
        totalHoras += horas;
        totalExtras += extras;
        
        if (r.status === "atraso") totalAtrasos++;
        if (r.observacao?.includes("ajuste") || r.observacao?.includes("manual")) totalAjustes++;
        
        if (horas > Number(params.jornada_diaria_max) + Number(params.horas_extras_diaria_max)) {
          violacoesJornadaDiaria++;
        }
        if (extras > Number(params.horas_extras_diaria_max)) {
          violacoesHorasExtras++;
        }
        
        if (saidaAnterior && r.entrada) {
          const saidaH = parseTimeToHours(saidaAnterior);
          const entradaH = parseTimeToHours(r.entrada);
          const descanso = entradaH + 24 - saidaH;
          if (descanso < Number(params.descanso_interjornada_min) && descanso > 0) {
            violacoesInterjornada++;
          }
        }
        
        if (r.saida_almoco && r.retorno_almoco) {
          const saAlm = parseTimeToMinutes(r.saida_almoco);
          const retAlm = parseTimeToMinutes(r.retorno_almoco);
          if (retAlm - saAlm < Number(params.intervalo_intrajornada_min)) {
            violacoesIntervalo++;
          }
        }
        
        saidaAnterior = r.saida;
      });
      
      const diasTrabalhados = registros.length;
      const mediaDiaria = diasTrabalhados > 0 ? totalHoras / diasTrabalhados : 0;
      const semanas = Math.max(1, diasTrabalhados / 5);
      const mediaSemanal = totalHoras / semanas;
      
      const violations = violacoesIntervalo + violacoesInterjornada + violacoesJornadaDiaria + violacoesHorasExtras + violacoesDsr;
      const scoreRisco = Math.min(100, (violations / Math.max(1, diasTrabalhados)) * 100 + (totalExtras / Math.max(1, totalHoras)) * 50);
      const nivelRisco = scoreRisco >= 60 ? "alto" : scoreRisco >= 30 ? "moderado" : "baixo";
      const statusConformidade = violations > diasTrabalhados * 0.3 ? "nao_conforme" : violations > 0 ? "atencao" : "conforme";
      
      const profile = profileMap.get(cpf);
      
      const analise = {
        tenant_id: tenantId,
        colaborador_cpf: cpf,
        colaborador_nome: registros[0].colaborador_nome,
        departamento: profile?.departamento || null,
        cargo: profile?.cargo || null,
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim,
        dias_trabalhados: diasTrabalhados,
        total_horas_trabalhadas: Math.round(totalHoras * 100) / 100,
        total_horas_extras: Math.round(totalExtras * 100) / 100,
        media_diaria_horas: Math.round(mediaDiaria * 100) / 100,
        media_semanal_horas: Math.round(mediaSemanal * 100) / 100,
        total_atrasos: totalAtrasos,
        total_ajustes_manuais: totalAjustes,
        violacoes_intervalo: violacoesIntervalo,
        violacoes_interjornada: violacoesInterjornada,
        violacoes_jornada_diaria: violacoesJornadaDiaria,
        violacoes_horas_extras: violacoesHorasExtras,
        violacoes_dsr: violacoesDsr,
        nivel_risco: nivelRisco,
        score_risco: Math.round(scoreRisco * 100) / 100,
        status_conformidade: statusConformidade,
      };
      
      analises.push(analise);
    }
    
    // Save analyses
    if (analises.length > 0) {
      // Delete previous analyses for this period
      await supabase
        .from("jornada_analises")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("periodo_inicio", periodoInicio)
        .eq("periodo_fim", periodoFim);
      
      const { error: insertError } = await supabase
        .from("jornada_analises")
        .insert(analises);
      
      if (insertError) {
        console.error("Erro ao salvar análises:", insertError);
        toast.error("Erro ao salvar análises");
      }
      
      // Generate alerts
      await gerarAlertas(analises);
    }
    
    return analises;
  };

  const gerarAlertas = async (analises: any[]) => {
    if (!tenantId) return;
    
    const alertas: any[] = [];
    
    for (const a of analises) {
      if (a.total_horas_extras > a.dias_trabalhados * 1.5) {
        alertas.push({
          tenant_id: tenantId,
          colaborador_cpf: a.colaborador_cpf,
          colaborador_nome: a.colaborador_nome,
          tipo: "excesso_horas_extras",
          severidade: a.total_horas_extras > a.dias_trabalhados * 2 ? "alta" : "media",
          titulo: `Excesso de horas extras — ${a.colaborador_nome}`,
          descricao: `${a.total_horas_extras.toFixed(1)}h extras em ${a.dias_trabalhados} dias trabalhados.`,
          acao_sugerida: "Verificar demanda de trabalho e redistribuir tarefas",
        });
      }
      
      if (a.violacoes_intervalo > 3) {
        alertas.push({
          tenant_id: tenantId,
          colaborador_cpf: a.colaborador_cpf,
          colaborador_nome: a.colaborador_nome,
          tipo: "falta_intervalo",
          severidade: "alta",
          titulo: `Intervalo intrajornada insuficiente — ${a.colaborador_nome}`,
          descricao: `${a.violacoes_intervalo} violações de intervalo no período.`,
          acao_sugerida: "Garantir cumprimento do intervalo mínimo de 1h",
        });
      }
      
      if (a.violacoes_interjornada > 2) {
        alertas.push({
          tenant_id: tenantId,
          colaborador_cpf: a.colaborador_cpf,
          colaborador_nome: a.colaborador_nome,
          tipo: "descanso_insuficiente",
          severidade: "critica",
          titulo: `Descanso interjornada insuficiente — ${a.colaborador_nome}`,
          descricao: `${a.violacoes_interjornada} violações de descanso mínimo de 11h.`,
          acao_sugerida: "Ação imediata: ajustar escalas para garantir 11h de descanso",
        });
      }
      
      if (a.media_diaria_horas > 10) {
        alertas.push({
          tenant_id: tenantId,
          colaborador_cpf: a.colaborador_cpf,
          colaborador_nome: a.colaborador_nome,
          tipo: "jornada_excessiva",
          severidade: "alta",
          titulo: `Jornada excessiva — ${a.colaborador_nome}`,
          descricao: `Média de ${a.media_diaria_horas.toFixed(1)}h/dia no período.`,
          acao_sugerida: "Avaliar carga de trabalho e riscos psicossociais",
        });
      }
    }
    
    if (alertas.length > 0) {
      await supabase.from("jornada_alertas").insert(alertas);
    }
  };

  return {
    lerArquivo,
    processarDados,
    importarParaPontoDiario,
    analisarJornada,
    isProcessing,
    progress,
  };
}

function parseIntervalToHours(val: any): number {
  if (!val) return 0;
  const str = String(val);
  const match = str.match(/(\d+):(\d+)/);
  if (match) return parseInt(match[1]) + parseInt(match[2]) / 60;
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function parseTimeToHours(val: string): number {
  const match = String(val).match(/(\d+):(\d+)/);
  if (!match) return 0;
  return parseInt(match[1]) + parseInt(match[2]) / 60;
}

function parseTimeToMinutes(val: string): number {
  const match = String(val).match(/(\d+):(\d+)/);
  if (!match) return 0;
  return parseInt(match[1]) * 60 + parseInt(match[2]);
}
