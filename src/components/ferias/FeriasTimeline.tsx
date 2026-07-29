import { useMemo, useState } from "react";
import { Info, GripVertical } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatBRL } from "@/lib/feriasFinanceiro";
import type { LinhaProgramacao, SubPeriodo } from "@/hooks/useFeriasProgramacao";
import { cn } from "@/lib/utils";

interface Props {
  linhas: LinhaProgramacao[];
  /** Reposiciona um período (novo início, mesma duração) e persiste. */
  onMover: (linha: LinhaProgramacao, sub: 1 | 2 | 3, novoInicio: string) => void;
}

const MESES_LABEL = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const CORES_ESTADO: Record<string, string> = {
  sugerido:   "bg-slate-300",
  planejado:  "bg-blue-400",
  confirmado: "bg-emerald-500",
  ciente:     "bg-teal-500",
  solicitado: "bg-violet-500",
  aprovado:   "bg-green-500",
  em_gozo:    "bg-sky-500",
  concluido:  "bg-gray-400",
  cancelado:  "bg-red-300",
};

/** Janela de 12 meses a partir do mês atual. */
function janela12Meses(): { ano: number; mes: number; key: string; label: string }[] {
  const out = [];
  const hoje = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    out.push({
      ano: d.getFullYear(),
      mes: d.getMonth(),
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: `${MESES_LABEL[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
    });
  }
  return out;
}

export function FeriasTimeline({ linhas, onMover }: Props) {
  const meses = useMemo(janela12Meses, []);
  const [arrastando, setArrastando] = useState<{ cpf: string; sub: 1 | 2 | 3 } | null>(null);

  // Índice do mês (0–11 na janela) de uma data ISO; -1 se fora da janela.
  const idxMes = (iso: string | null): number => {
    if (!iso) return -1;
    const d = new Date(iso + "T12:00:00");
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return meses.findIndex(m => m.key === k);
  };

  const idxLimite = (linha: LinhaProgramacao): number => {
    const d = linha.limiteConcessivoDate;
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const i = meses.findIndex(m => m.key === k);
    return i;
  };

  // Totais por mês (rodapé): pessoas fora, dias, valor bruto.
  const totaisPorMes = useMemo(() => {
    return meses.map((m) => {
      let pessoas = 0, dias = 0, valor = 0;
      for (const l of linhas) {
        for (const sub of [l.p1, l.p2, l.p3]) {
          if (!sub.inicio || !sub.dias) continue;
          if (idxMes(sub.inicio) === meses.indexOf(m)) {
            pessoas += 1;
            dias += sub.dias;
            valor += (l.salario / 30) * sub.dias * (1 + 1 / 3);
          }
        }
      }
      const pctEquipe = linhas.length > 0 ? Math.round((pessoas / linhas.length) * 100) : 0;
      return { pessoas, dias, valor, pctEquipe };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas, meses]);

  const soltarNoMes = (linha: LinhaProgramacao, sub: 1 | 2 | 3, mesIdx: number) => {
    const s = sub === 1 ? linha.p1 : sub === 2 ? linha.p2 : linha.p3;
    if (!s.inicio || !s.dias) return;
    // Novo início: dia 1 do mês-alvo (simplifica; RH refina no modal se quiser).
    const alvo = meses[mesIdx];
    const novoInicio = `${alvo.ano}-${String(alvo.mes + 1).padStart(2, "0")}-01`;
    if (novoInicio === s.inicio) return;
    onMover(linha, sub, novoInicio);
  };

  const comProgramacao = linhas.filter(l =>
    l.p1.inicio || l.p2.inicio || l.p3.inicio);

  if (comProgramacao.length === 0 && linhas.length > 0) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-800">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <p>Nenhum período programado ainda. Programe férias na grade para vê-los na linha do tempo.</p>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Cabeçalho de meses */}
          <div className="flex border-b bg-muted/40 text-[10px] text-muted-foreground sticky top-0">
            <div className="w-44 shrink-0 px-3 py-2 font-medium">Colaborador</div>
            {meses.map(m => (
              <div key={m.key} className="flex-1 px-1 py-2 text-center border-l">{m.label}</div>
            ))}
          </div>

          {/* Linhas */}
          {linhas.map(linha => {
            const limiteIdx = idxLimite(linha);
            return (
              <div key={linha.cpf + linha.aquisitivoInicio} className="flex border-b hover:bg-accent/20">
                <div className="w-44 shrink-0 px-3 py-2">
                  <div className="text-xs font-medium truncate">{linha.nome}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{linha.departamento}</div>
                </div>
                <div className="flex-1 flex relative">
                  {meses.map((m, mi) => {
                    const noLimite = mi === limiteIdx;
                    const passouLimite = limiteIdx >= 0 && mi > limiteIdx;
                    return (
                      <div
                        key={m.key}
                        className={cn(
                          "flex-1 border-l min-h-[38px] relative",
                          noLimite && "border-l-2 border-l-red-400",
                          passouLimite && "bg-red-50/40",
                        )}
                        onDragOver={(e) => { if (arrastando?.cpf === linha.cpf) e.preventDefault(); }}
                        onDrop={() => { if (arrastando?.cpf === linha.cpf) { soltarNoMes(linha, arrastando.sub, mi); setArrastando(null); } }}
                      >
                        {([1, 2, 3] as const).map(n => {
                          const sub: SubPeriodo = n === 1 ? linha.p1 : n === 2 ? linha.p2 : linha.p3;
                          if (idxMes(sub.inicio) !== mi || !sub.dias) return null;
                          // Barra vermelha se este período começa após o limite.
                          const foraDoLimite = limiteIdx >= 0 && mi > limiteIdx;
                          const cor = foraDoLimite ? "bg-red-500" : CORES_ESTADO[linha.estado] ?? "bg-blue-400";
                          const travado = ["solicitado","aprovado","em_gozo","concluido"].includes(linha.estado);
                          return (
                            <div
                              key={n}
                              draggable={!travado}
                              onDragStart={() => setArrastando({ cpf: linha.cpf, sub: n })}
                              onDragEnd={() => setArrastando(null)}
                              title={`P${n}: ${sub.dias} dias a partir de ${new Date(sub.inicio! + "T12:00:00").toLocaleDateString("pt-BR")}`}
                              className={cn(
                                "absolute inset-x-0.5 top-1 h-5 rounded text-[9px] text-white flex items-center gap-0.5 px-1 shadow-sm",
                                cor, !travado && "cursor-grab active:cursor-grabbing",
                              )}
                            >
                              {!travado && <GripVertical className="h-2.5 w-2.5 opacity-70 shrink-0" />}
                              <span className="truncate">P{n} · {sub.dias}d</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Rodapé de totais por mês */}
          <div className="flex border-t-2 bg-muted/30 text-[10px]">
            <div className="w-44 shrink-0 px-3 py-2 font-medium text-muted-foreground">Totais / mês</div>
            {totaisPorMes.map((t, i) => (
              <div key={i} className={cn("flex-1 border-l px-1 py-2 text-center",
                t.pctEquipe > 20 && "bg-amber-50")}>
                {t.pessoas > 0 ? (
                  <div className="space-y-0.5">
                    <div className="font-semibold">{t.pessoas}p · {t.pctEquipe}%</div>
                    <div className="text-muted-foreground">{t.dias}d</div>
                    <div className="text-[9px] text-muted-foreground">{formatBRL(t.valor)}</div>
                  </div>
                ) : <span className="text-muted-foreground">—</span>}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
