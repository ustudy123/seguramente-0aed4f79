import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "./useTenant";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Sincroniza departamentos e cargos a partir dos dados existentes em admissões.
 * Garante que todo departamento/cargo referenciado em admissões exista nas tabelas dedicadas.
 */
export function useSyncCadastros() {
  const { tenantId } = useTenant();
  const { empresaAtivaId } = useEmpresaAtiva();
  const qc = useQueryClient();
  const syncingRef = useRef(false);

  const sincronizar = useCallback(async () => {
    if (!tenantId || !empresaAtivaId || syncingRef.current) return;
    syncingRef.current = true;

    try {
      // 1. Buscar departamentos e cargos únicos dos colaboradores ativos
      const { data: admissoes } = await supabase
        .from("admissoes")
        .select("departamento, cargo")
        .eq("tenant_id", tenantId)
        .eq("empresa_id", empresaAtivaId)
        .eq("status", "concluido");

      if (!admissoes || admissoes.length === 0) return;

      // Deduplicar por LOWER para evitar variações de case (ex: "Administrativo" vs "administrativo")
      const deptMap = new Map<string, string>(); // lower -> nome canônico (primeiro encontrado)
      const cargoMap = new Map<string, string>();
      admissoes.forEach((a) => {
        if (a.departamento?.trim()) {
          const nome = a.departamento.trim();
          const key = nome.toLowerCase();
          if (!deptMap.has(key)) deptMap.set(key, nome);
        }
        if (a.cargo?.trim()) {
          const nome = a.cargo.trim();
          const key = nome.toLowerCase();
          if (!cargoMap.has(key)) cargoMap.set(key, nome);
        }
      });
      const deptSet = new Set<string>(deptMap.values());
      const cargoSet = new Set<string>(cargoMap.values());

      // 2. Buscar departamentos existentes para esta empresa
      const { data: depsExistentes } = await supabase
        .from("departamentos")
        .select("id, nome")
        .eq("tenant_id", tenantId)
        .eq("empresa_id", empresaAtivaId);

      const depsMap = new Map<string, string>();
      depsExistentes?.forEach((d) => depsMap.set(d.nome.toLowerCase().trim(), d.id));

      // 3. Criar departamentos faltantes
      let deptsCriados = 0;
      const novosDepts = new Map<string, string>(); // nome lower -> id

      for (const nome of deptSet) {
        const key = nome.toLowerCase().trim();
        if (!depsMap.has(key)) {
          const { data: novo } = await supabase
            .from("departamentos")
            .insert({
              tenant_id: tenantId,
              empresa_id: empresaAtivaId,
              nome,
              ativo: true,
            })
            .select("id")
            .single();

          if (novo) {
            depsMap.set(key, novo.id);
            novosDepts.set(key, novo.id);
            deptsCriados++;
          }
        }
      }

      // 4. Buscar cargos existentes para esta empresa
      const { data: cargosExistentes } = await supabase
        .from("cargos")
        .select("id, nome, departamento_id")
        .eq("tenant_id", tenantId)
        .eq("empresa_id", empresaAtivaId);

      const cargosMap = new Map<string, { id: string; departamento_id: string | null }>();
      cargosExistentes?.forEach((c) =>
        cargosMap.set(c.nome.toLowerCase().trim(), { id: c.id, departamento_id: c.departamento_id })
      );

      // 5. Criar cargos faltantes e vincular departamento_id onde possível
      let cargosCriados = 0;
      let cargosAtualizados = 0;

      // Mapear cargo -> departamento mais frequente nos admissoes
      const cargoDeptFreq = new Map<string, Map<string, number>>();
      admissoes.forEach((a) => {
        if (!a.cargo?.trim()) return;
        const cargoKey = a.cargo.trim().toLowerCase();
        if (!cargoDeptFreq.has(cargoKey)) cargoDeptFreq.set(cargoKey, new Map());
        if (a.departamento?.trim()) {
          const deptKey = a.departamento.trim().toLowerCase();
          const freq = cargoDeptFreq.get(cargoKey)!;
          freq.set(deptKey, (freq.get(deptKey) || 0) + 1);
        }
      });

      for (const nome of cargoSet) {
        const key = nome.toLowerCase().trim();
        const existing = cargosMap.get(key);

        // Descobrir departamento_id mais provável
        const deptFreqs = cargoDeptFreq.get(key);
        let bestDeptId: string | null = null;
        if (deptFreqs) {
          let maxFreq = 0;
          for (const [deptKey, freq] of deptFreqs) {
            if (freq > maxFreq) {
              maxFreq = freq;
              bestDeptId = depsMap.get(deptKey) || null;
            }
          }
        }

        if (!existing) {
          const { data: novo } = await supabase
            .from("cargos")
            .insert({
              tenant_id: tenantId,
              empresa_id: empresaAtivaId,
              nome,
              departamento_id: bestDeptId,
              ativo: true,
            })
            .select("id")
            .single();

          if (novo) {
            cargosMap.set(key, { id: novo.id, departamento_id: bestDeptId });
            cargosCriados++;
          }
        } else if (!existing.departamento_id && bestDeptId) {
          // Atualizar cargo existente sem departamento_id
          await supabase
            .from("cargos")
            .update({ departamento_id: bestDeptId })
            .eq("id", existing.id);
          cargosAtualizados++;
        }
      }

      // 6. Invalidar queries se houve mudanças
      if (deptsCriados > 0 || cargosCriados > 0 || cargosAtualizados > 0) {
        qc.invalidateQueries({ queryKey: ["departamentos"] });
        qc.invalidateQueries({ queryKey: ["cargos"] });
        console.log(
          `[SyncCadastros] Sincronizado: ${deptsCriados} departamentos criados, ${cargosCriados} cargos criados, ${cargosAtualizados} cargos atualizados`
        );
      }
    } catch (err) {
      console.error("[SyncCadastros] Erro na sincronização:", err);
    } finally {
      syncingRef.current = false;
    }
  }, [tenantId, empresaAtivaId, qc]);

  return { sincronizar };
}
