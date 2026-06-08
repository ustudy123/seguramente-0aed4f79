import { useMemo } from "react";
import { motion } from "framer-motion";
import { FileText } from "lucide-react";
import { AjustesAprovacaoPlanilha } from "./AjustesAprovacaoPlanilha";
import type { PontoAjuste } from "@/hooks/usePonto";

interface Props {
  ajustes: PontoAjuste[];
  processarAjuste: (args: any) => Promise<any>;
  processandoAjuste: boolean;
  excluirAjuste?: (args: { ajusteId: string }) => Promise<any>;
  excluindoAjuste?: boolean;
  setAnexosModalAjuste: (ajuste: PontoAjuste | null) => void;
}

export function PontoAjustesTab({ ajustes, processarAjuste, processandoAjuste, excluirAjuste, excluindoAjuste, setAnexosModalAjuste }: Props) {

  // O contador no topo deve mostrar o número de DIAS que possuem ajustes pendentes,
  // para bater com a visualização da planilha onde cada linha é um dia.
  const stats = useMemo(() => {
    const total = ajustes.length;
    
    // Agrupa por colaborador e data para contar quantos "blocos" de dia/colaborador existem
    const pendentes = ajustes.filter(a => a.status === "pendente");
    const uniqueDaysMap = new Map<string, Set<string>>();
    
    pendentes.forEach(a => {
      if (!uniqueDaysMap.has(a.colaborador_id)) {
        uniqueDaysMap.set(a.colaborador_id, new Set());
      }
      uniqueDaysMap.get(a.colaborador_id)!.add(a.data_referencia);
    });
    
    let pendenteDaysCount = 0;
    uniqueDaysMap.forEach(days => {
      pendenteDaysCount += days.size;
    });

    const apr = ajustes.filter(a => a.status === "aprovado").length;
    const rej = ajustes.filter(a => a.status === "rejeitado").length;

    return { total, pend: pendenteDaysCount, apr, rej };
  }, [ajustes]);

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card border rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Registros Pendentes</p>
            <p className="text-2xl font-bold tracking-tight">{ajustes.filter(a => a.status === "pendente").length}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <FileText className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4 border-l-4 border-l-amber-500 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-1">Pendentes (Dias)</p>
              <p className="text-2xl font-bold tracking-tight">{stats.pend}</p>
            </div>
            {stats.pend > 0 && <span className="bg-amber-500/10 text-amber-600 text-[10px] px-2 py-0.5 rounded font-semibold">Prioritário</span>}
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4 border-l-4 border-l-emerald-500 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1">Aprovadas</p>
          <p className="text-2xl font-bold tracking-tight">{stats.apr}</p>
        </div>
        <div className="bg-card border rounded-xl p-4 border-l-4 border-l-rose-500 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-rose-600 mb-1">Rejeitadas</p>
          <p className="text-2xl font-bold tracking-tight">{stats.rej}</p>
        </div>
      </motion.div>

      <AjustesAprovacaoPlanilha
        ajustes={ajustes}
        processarAjuste={processarAjuste}
        processando={processandoAjuste}
        onOpenAnexos={(a) => setAnexosModalAjuste(a)}
      />
    </div>
  );
}
