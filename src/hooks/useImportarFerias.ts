/**
 * Importação de saldos de férias — casamento com colaboradores e gravação.
 *
 * Fluxo (4 tempos, dirigido pelo modal):
 *   1. Modelo   → gerarModeloFerias (em feriasImport)
 *   2. Parse    → parsePlanilhaFerias + este hook resolve CPF contra admissoes
 *   3. Conferir → o modal mostra `linhasResolvidas` + `problemas`
 *   4. Confirmar→ importar() faz upsert e dispara o recálculo no banco
 */
import { useState, useCallback } from "react";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import {
  parsePlanilhaFerias,
  soDigitos,
  type LinhaFeriasImport,
  type ProblemaLinha,
} from "@/lib/feriasImport";

export interface LinhaResolvida extends LinhaFeriasImport {
  /** Colaborador casado por CPF em admissoes, se encontrado. */
  colaboradorId: string | null;
  colaboradorEmpresaId: string | null;
  encontrado: boolean;
  /** true se este período já existe no banco (será atualizado, não criado). */
  jaExiste: boolean;
}

export interface PreviaImportacao {
  linhas: LinhaResolvida[];
  problemas: ProblemaLinha[];
  totalValidas: number;
  totalErros: number;
  totalNaoEncontrados: number;
  totalAtualizar: number;
  totalCriar: number;
}

export function useImportarFerias() {
  const { tenantId } = useTenant();
  const { empresaAtivaId } = useEmpresaAtiva();
  const [previa, setPrevia] = useState<PreviaImportacao | null>(null);
  const [processando, setProcessando] = useState(false);

  /** Passo 2+3: lê o arquivo, casa CPF e monta a prévia para conferência. */
  const analisar = useCallback(
    async (file: File): Promise<PreviaImportacao> => {
      setProcessando(true);
      try {
        const buffer = await file.arrayBuffer();
        const { linhas, problemas } = parsePlanilhaFerias(buffer);

        // Universo de colaboradores para casar por CPF (admissões concluídas).
        let q = fromTable("admissoes")
          .select("id, nome_completo, cpf, empresa_id")
          .eq("tenant_id", tenantId)
          .eq("status", "concluido");
        if (empresaAtivaId) q = q.eq("empresa_id", empresaAtivaId);
        const { data: admissoes } = await q;

        const porCpf = new Map<string, { id: string; empresa_id: string | null }>();
        for (const a of admissoes ?? []) {
          const c = soDigitos(a.cpf);
          if (c) porCpf.set(c, { id: a.id, empresa_id: a.empresa_id });
        }

        // Períodos já existentes, para marcar atualização x criação.
        const cpfs = Array.from(new Set(linhas.map(l => l.cpf).filter(Boolean)));
        const existentes = new Set<string>();
        if (cpfs.length > 0) {
          const { data: peExist } = await fromTable("ferias_periodos_aquisitivos")
            .select("colaborador_cpf, aquisitivo_inicio")
            .eq("tenant_id", tenantId)
            .in("colaborador_cpf", cpfs);
          for (const p of peExist ?? []) {
            existentes.add(`${soDigitos(p.colaborador_cpf)}|${p.aquisitivo_inicio}`);
          }
        }

        const problemasExtra: ProblemaLinha[] = [];
        const resolvidas: LinhaResolvida[] = linhas.map(l => {
          const match = l.cpf ? porCpf.get(l.cpf) : undefined;
          if (l.cpf && !match) {
            problemasExtra.push({
              linhaExcel: l.linhaExcel,
              campo: "CPF",
              mensagem: `Nenhum colaborador com este CPF (${l.nome || "sem nome"}).`,
              gravidade: "erro",
            });
          }
          return {
            ...l,
            colaboradorId: match?.id ?? null,
            colaboradorEmpresaId: match?.empresa_id ?? null,
            encontrado: !!match,
            jaExiste: l.cpf && l.aquisitivoInicio
              ? existentes.has(`${l.cpf}|${l.aquisitivoInicio}`)
              : false,
          };
        });

        const todosProblemas = [...problemas, ...problemasExtra];
        const linhasComErro = new Set(
          todosProblemas.filter(p => p.gravidade === "erro").map(p => p.linhaExcel),
        );
        const validas = resolvidas.filter(l => !linhasComErro.has(l.linhaExcel) && l.encontrado);

        const resultado: PreviaImportacao = {
          linhas: resolvidas,
          problemas: todosProblemas,
          totalValidas: validas.length,
          totalErros: linhasComErro.size,
          totalNaoEncontrados: resolvidas.filter(l => !l.encontrado).length,
          totalAtualizar: validas.filter(l => l.jaExiste).length,
          totalCriar: validas.filter(l => !l.jaExiste).length,
        };
        setPrevia(resultado);
        return resultado;
      } finally {
        setProcessando(false);
      }
    },
    [tenantId, empresaAtivaId],
  );

  /** Passo 4: grava só as linhas válidas e casadas, depois recalcula. */
  const importar = useCallback(async (): Promise<{ gravadas: number; recalculadas: number }> => {
    if (!previa || !tenantId) return { gravadas: 0, recalculadas: 0 };
    setProcessando(true);
    try {
      const linhasComErro = new Set(
        previa.problemas.filter(p => p.gravidade === "erro").map(p => p.linhaExcel),
      );
      const gravar = previa.linhas.filter(l => !linhasComErro.has(l.linhaExcel) && l.encontrado);

      const registros = gravar.map(l => ({
        tenant_id: tenantId,
        empresa_id: l.colaboradorEmpresaId ?? empresaAtivaId ?? null,
        colaborador_cpf: l.cpf,
        colaborador_nome: l.nome,
        colaborador_id: l.colaboradorId,
        data_admissao: l.admissao,
        aquisitivo_inicio: l.aquisitivoInicio,
        aquisitivo_fim: l.aquisitivoFim,
        faltas_carga: l.faltas,
        dias_gozados: l.diasGozados,
        origem: "importacao",
      }));

      // Upsert pela chave estável (tenant, cpf, aquisitivo_inicio): reimportar
      // atualiza o período em vez de duplicar.
      const { error } = await fromTable("ferias_periodos_aquisitivos").upsert(registros, {
        onConflict: "tenant_id,colaborador_cpf,aquisitivo_inicio",
      });
      if (error) throw error;

      // Recalcula direito e saldo no banco (art. 130 x avos, ponto x carga).
      // RPC nova, ainda fora dos tipos gerados do supabase.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: qtd } = await (supabase.rpc as any)("ferias_recalcular_empresa", {
        p_tenant_id: tenantId,
        p_empresa_id: empresaAtivaId ?? null,
      });

      return { gravadas: registros.length, recalculadas: Number(qtd ?? 0) };
    } finally {
      setProcessando(false);
    }
  }, [previa, tenantId, empresaAtivaId]);

  const limpar = useCallback(() => setPrevia(null), []);

  return { previa, processando, analisar, importar, limpar };
}
