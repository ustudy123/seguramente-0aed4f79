/**
 * Resolve as situações de trabalho (Setor + Função — NR-17) de uma campanha
 * psicossocial para exportação ao GRO.
 *
 * Suporta os dois modelos de vínculo:
 * 1. Legado: pares Setor+Função gravados direto na campanha (situacoes_trabalho).
 * 2. Atual: campanha vinculada a GHEs (ghe_ids) — as situações são derivadas da
 *    composição de cada GHE (psicossocial_ghe_cargos: departamento + cargo).
 */
import { fromTable } from "@/integrations/supabase/untypedClient";
import type { CampanhaPsicossocial, SituacaoTrabalhoCampanha } from "@/types/psicossocial";

interface GheRow {
  id: string;
  nome: string;
  codigo: string | null;
}

interface GheCargoRow {
  ghe_id: string;
  cargo_id: string | null;
  departamento_id: string | null;
}

export async function resolverSituacoesTrabalho(
  campanha: Pick<CampanhaPsicossocial, "situacoes_trabalho" | "ghe_ids">
): Promise<SituacaoTrabalhoCampanha[]> {
  // Modelo legado: pares Setor+Função gravados na campanha
  const diretas = campanha.situacoes_trabalho ?? [];
  if (diretas.length > 0) return diretas;

  // Modelo atual: deriva dos GHEs vinculados
  const gheIds = (campanha.ghe_ids ?? []).filter(Boolean);
  if (gheIds.length === 0) return [];

  const [ghesRes, composicaoRes] = await Promise.all([
    fromTable("psicossocial_ghe").select("id, nome, codigo").in("id", gheIds),
    fromTable("psicossocial_ghe_cargos")
      .select("ghe_id, cargo_id, departamento_id")
      .in("ghe_id", gheIds),
  ]);
  if (ghesRes.error) throw ghesRes.error;
  if (composicaoRes.error) throw composicaoRes.error;

  const ghes = (ghesRes.data ?? []) as GheRow[];
  const composicao = (composicaoRes.data ?? []) as GheCargoRow[];

  const cargoIds = [...new Set(composicao.map((c) => c.cargo_id).filter(Boolean))] as string[];
  const deptIds = [...new Set(composicao.map((c) => c.departamento_id).filter(Boolean))] as string[];

  const [cargosRes, deptsRes] = await Promise.all([
    cargoIds.length
      ? fromTable("cargos").select("id, nome").in("id", cargoIds)
      : Promise.resolve({ data: [], error: null }),
    deptIds.length
      ? fromTable("departamentos").select("id, nome").in("id", deptIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (cargosRes.error) throw cargosRes.error;
  if (deptsRes.error) throw deptsRes.error;

  const cargoNome = new Map<string, string>(
    ((cargosRes.data ?? []) as { id: string; nome: string }[]).map((c) => [c.id, c.nome])
  );
  const deptNome = new Map<string, string>(
    ((deptsRes.data ?? []) as { id: string; nome: string }[]).map((d) => [d.id, d.nome])
  );
  const gheById = new Map(ghes.map((g) => [g.id, g]));

  const situacoes = new Map<string, SituacaoTrabalhoCampanha>();

  for (const item of composicao) {
    const ghe = gheById.get(item.ghe_id);
    const gheLabel = ghe ? (ghe.codigo ? `GHE ${ghe.codigo}` : ghe.nome) : "GHE";
    const setorId = item.departamento_id || item.ghe_id;
    const funcaoId = item.cargo_id || item.ghe_id;
    situacoes.set(`${setorId}::${funcaoId}`, {
      setorId,
      setorNome: (item.departamento_id && deptNome.get(item.departamento_id)) || gheLabel,
      funcaoId,
      funcaoNome: (item.cargo_id && cargoNome.get(item.cargo_id)) || (ghe?.nome ?? gheLabel),
    });
  }

  // GHE sem composição detalhada: usa o próprio GHE como situação de trabalho
  for (const ghe of ghes) {
    if (!composicao.some((c) => c.ghe_id === ghe.id)) {
      situacoes.set(ghe.id, {
        setorId: ghe.id,
        setorNome: ghe.codigo ? `GHE ${ghe.codigo}` : ghe.nome,
        funcaoId: ghe.id,
        funcaoNome: ghe.nome,
      });
    }
  }

  return [...situacoes.values()];
}
