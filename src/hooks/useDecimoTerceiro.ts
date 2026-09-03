/**
 * Apuração do 13º salário (RF-001 / RF-002 / CA-001 / CA-002 do YE-DP-13-001).
 *
 * Chama a apuração do banco (`decimo_terceiro_apurar`), que:
 *   • conta os avos da Lei 4.090/1962 — 1/12 por mês, fração de 15 dias —
 *     a partir da admissão, das faltas injustificadas do ponto e do
 *     afastamento previdenciário;
 *   • soma a média das variáveis do ano pelas rubricas marcadas como
 *     integrantes do 13º no cadastro de rubricas;
 *   • devolve as duas MEMÓRIAS — mês a mês e competência a competência —
 *     que são o que torna o valor reproduzível e auditável depois.
 *
 * Somente leitura: nada é gravado pela apuração.
 */
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";

export interface AvosMes {
  mes: number;
  dias_vinculo: number;
  faltas: number;
  dias_inss: number;
  dias_computados: number;
  conta: boolean;
}

export interface MemoriaAvos {
  avos: number;
  admissao: string | null;
  desligamento: string | null;
  tem_ponto: boolean;
  afastamento_regra: string;
  dias_empregador: number;
  parametros_vigencia: string;
  fundamento: string;
  meses: AvosMes[];
  avisos: string[];
}

export interface MemoriaMediaCompetencia {
  competencia: string;
  valor: number;
}

export interface MemoriaMediaRubrica {
  codigo: string | null;
  descricao: string;
  valor: number;
}

export interface MemoriaMedia {
  media: number;
  total: number;
  meses_divisor: number;
  meses_com_valor: number;
  divisor_regra: string;
  rubricas_marcadas: number;
  janela_inicio: string;
  janela_fim: string;
  parametros_vigencia: string;
  fundamento: string;
  competencias: MemoriaMediaCompetencia[];
  rubricas: MemoriaMediaRubrica[];
  avisos: string[];
}

export interface Apuracao13 {
  ano: number;
  avos: number;
  remuneracao_base: number;
  media_variaveis: number;
  base_integral: number;
  base_proporcional: number;
  apurado_em: string;
  memoria_avos: MemoriaAvos;
  memoria_media: MemoriaMedia;
  avisos: string[];
}

export interface Apurar13Params {
  cpf: string;
  ano: number;
  salario?: number;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function nomeMes(mes: number): string {
  return MESES[mes - 1] ?? String(mes);
}

export function useDecimoTerceiro() {
  const { tenantId } = useTenant();
  const { empresaAtivaId } = useEmpresaAtiva();
  const [apurando, setApurando] = useState(false);

  const apurar = useCallback(
    async (p: Apurar13Params): Promise<Apuracao13 | null> => {
      if (!tenantId) return null;
      setApurando(true);
      try {
        // A função é nova: ainda não está no schema tipado gerado pelo Supabase.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rpc = (supabase as any).rpc.bind(supabase);
        const { data, error } = await rpc("decimo_terceiro_apurar", {
          p_tenant: tenantId,
          p_cpf: p.cpf,
          p_ano: p.ano,
          p_salario: p.salario ?? null,
          p_empresa: empresaAtivaId || null,
        });
        if (error) throw error;
        const bruto = (data || {}) as Record<string, unknown>;
        return {
          ano: Number(bruto.ano ?? p.ano),
          avos: Number(bruto.avos ?? 0),
          remuneracao_base: Number(bruto.remuneracao_base ?? 0),
          media_variaveis: Number(bruto.media_variaveis ?? 0),
          base_integral: Number(bruto.base_integral ?? 0),
          base_proporcional: Number(bruto.base_proporcional ?? 0),
          apurado_em: String(bruto.apurado_em ?? ""),
          memoria_avos: (bruto.memoria_avos as MemoriaAvos) ?? ({ meses: [], avisos: [] } as unknown as MemoriaAvos),
          memoria_media: (bruto.memoria_media as MemoriaMedia) ?? ({ competencias: [], rubricas: [], avisos: [] } as unknown as MemoriaMedia),
          avisos: (bruto.avisos as string[]) ?? [],
        };
      } finally {
        setApurando(false);
      }
    },
    [tenantId, empresaAtivaId],
  );

  return { apurar, apurando };
}

/** Frase curta que explica de onde saíram os avos, para a tela e para a memória. */
export function descreverAvos(a: Apuracao13): string {
  const contados = a.memoria_avos.meses?.filter(m => m.conta).map(m => nomeMes(m.mes)) ?? [];
  if (contados.length === 0) return "Nenhum mês do ano fechou 15 dias de trabalho.";
  return `${a.avos}/12 avos — meses que fecharam 15 dias: ${contados.join(", ")}.`;
}

/** Frase curta que explica de onde saiu a média das variáveis. */
export function descreverMedia13(a: Apuracao13): string {
  const m = a.memoria_media;
  const total = (m.total ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  const divisor =
    m.divisor_regra === "doze_avos" ? "12 avos"
      : m.divisor_regra === "meses_com_valor" ? `${m.meses_divisor} mês(es) com valor`
        : `${m.meses_divisor} avo(s) apurado(s)`;
  return `Soma de R$ ${total} nas competências ${m.janela_inicio} a ${m.janela_fim}, dividida por ${divisor}.`;
}
