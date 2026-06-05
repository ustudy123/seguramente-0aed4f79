import React from 'react';
import { cn } from "@/lib/utils";

interface TableRow {
  nivel: number;
  classificacao: string;
  criterio: string;
  colorClass: string;
  bgClass: string;
}

const probabilidadeData: TableRow[] = [
  { nivel: 5, classificacao: "Quase Certa", criterio: "Ocorrência contínua ou diária. Medidas de prevenção são inexistentes ou totalmente ineficazes.", colorClass: "text-red-700", bgClass: "bg-red-50" },
  { nivel: 4, classificacao: "Frequente", criterio: "Ocorre de forma regular na rotina de trabalho. Medidas de prevenção são insuficientes ou frágeis.", colorClass: "text-orange-700", bgClass: "bg-orange-50" },
  { nivel: 3, classificacao: "Possível", criterio: "Ocorrência documentada ou com relatos recorrentes. Medidas de prevenção apresentam falhas intermitentes.", colorClass: "text-yellow-700", bgClass: "bg-yellow-50" },
  { nivel: 2, classificacao: "Remota", criterio: "Pode ocorrer em situações muito específicas ou raramente no ano. Medidas de prevenção são majoritariamente eficazes.", colorClass: "text-blue-700", bgClass: "bg-blue-50" },
  { nivel: 1, classificacao: "Aceitável/Improvável", criterio: "Ocorrência imprevisível ou sem histórico no setor. Medidas de prevenção são totalmente eficazes.", colorClass: "text-green-700", bgClass: "bg-green-50" },
];

const severidadeData: TableRow[] = [
  { nivel: 5, classificacao: "Catastrófica/Crítica", criterio: "Incapacidade permanente para o trabalho ou comprometimento total e irreversível da saúde.", colorClass: "text-red-700", bgClass: "bg-red-50" },
  { nivel: 4, classificacao: "Grande/Alta", criterio: "Lesão crônica ou adoecimento ocupacional diagnosticado (ex: Burnout, ansiedade grave). Gera afastamento prolongado (> 15 dias).", colorClass: "text-orange-700", bgClass: "bg-orange-50" },
  { nivel: 3, classificacao: "Média/Moderada", criterio: "Agravamento clínico tratável, disfunção reversível. Pode gerar absenteísmo de curto prazo (até 15 dias).", colorClass: "text-yellow-700", bgClass: "bg-yellow-50" },
  { nivel: 2, classificacao: "Pequena/Menor", criterio: "Sintomas leves (ex: estresse pontual), sem necessidade de afastamento ou restrição médica.", colorClass: "text-blue-700", bgClass: "bg-blue-50" },
  { nivel: 1, classificacao: "Insignificante", criterio: "Desconforto temporário sem alteração clínica ou prejuízo ao desempenho laboral.", colorClass: "text-green-700", bgClass: "bg-green-50" },
];

export const ProbabilidadeTable = () => (
  <div className="overflow-x-auto rounded-lg shadow-sm border border-slate-200">
    <table className="w-full text-left border-collapse min-w-[600px]">
      <thead className="bg-slate-800 text-white">
        <tr>
          <th className="px-4 py-3 font-semibold text-sm w-32">Índice/Nível</th>
          <th className="px-4 py-3 font-semibold text-sm w-44">Classificação</th>
          <th className="px-4 py-3 font-semibold text-sm">Critério Operacional</th>
        </tr>
      </thead>
      <tbody className="text-sm">
        {probabilidadeData.map((row) => (
          <tr key={row.nivel} className={cn("border-b border-slate-100 last:border-0", row.bgClass)}>
            <td className={cn("px-4 py-3 font-bold", row.colorClass)}>Nível {row.nivel}</td>
            <td className={cn("px-4 py-3 font-medium", row.colorClass)}>{row.classificacao}</td>
            <td className="px-4 py-3 text-slate-700">{row.criterio}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const SeveridadeTable = () => (
  <div className="overflow-x-auto rounded-lg shadow-sm border border-slate-200">
    <table className="w-full text-left border-collapse min-w-[600px]">
      <thead className="bg-slate-800 text-white">
        <tr>
          <th className="px-4 py-3 font-semibold text-sm w-32">Índice/Nível</th>
          <th className="px-4 py-3 font-semibold text-sm w-44">Classificação</th>
          <th className="px-4 py-3 font-semibold text-sm">Impacto à Saúde</th>
        </tr>
      </thead>
      <tbody className="text-sm">
        {severidadeData.map((row) => (
          <tr key={row.nivel} className={cn("border-b border-slate-100 last:border-0", row.bgClass)}>
            <td className={cn("px-4 py-3 font-bold", row.colorClass)}>Nível {row.nivel}</td>
            <td className={cn("px-4 py-3 font-medium", row.colorClass)}>{row.classificacao}</td>
            <td className="px-4 py-3 text-slate-700">{row.criterio}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

interface MatrizCell {
  label: string;
  bg: string;
  text: string;
}

const getMatrizCell = (p: number, s: number): MatrizCell => {
  // Coordenadas baseadas no prompt (1x1 a 5x5)
  // TRIVIAL: (1x1, 1x2, 2x1)
  if ((p === 1 && s === 1) || (p === 1 && s === 2) || (p === 2 && s === 1)) 
    return { label: "TRIVIAL", bg: "bg-green-100", text: "text-green-800" };
  
  // BAIXO: (1x3, 1x4, 2x2, 2x3, 3x1, 3x2)
  if ((p === 1 && s === 3) || (p === 1 && s === 4) || (p === 2 && s === 2) || (p === 2 && s === 3) || (p === 3 && s === 1) || (p === 3 && s === 2))
    return { label: "BAIXO", bg: "bg-blue-100", text: "text-blue-800" };

  // INACEITÁVEL / CRÍTICO: (4x5, 5x4, 5x5)
  if ((p === 4 && s === 5) || (p === 5 && s === 4) || (p === 5 && s === 5))
    return { label: "CRÍTICO", bg: "bg-red-100", text: "text-red-800" };

  // ALTO: (2x5, 3x4, 3x5, 4x4, 5x3)
  if ((p === 2 && s === 5) || (p === 3 && s === 4) || (p === 3 && s === 5) || (p === 4 && s === 4) || (p === 5 && s === 3))
    return { label: "ALTO", bg: "bg-orange-100", text: "text-orange-800" };

  // TOLERÁVEL / MÉDIO: O restante (1x5, 2x4, 3x3, 4x1, 4x2, 4x3, 5x1, 5x2)
  return { label: "MÉDIO", bg: "bg-yellow-100", text: "text-yellow-800" };
};

export const MatrizRisco = () => {
  const levels = [5, 4, 3, 2, 1];
  const severities = [1, 2, 3, 4, 5];

  return (
    <div className="overflow-x-auto p-1">
      <div className="min-w-[500px] border border-slate-200 rounded-lg shadow-sm overflow-hidden bg-white">
        <div className="grid grid-cols-6 border-b bg-slate-800 text-white font-semibold text-[11px] uppercase tracking-wider">
          <div className="p-3 border-r bg-slate-900 flex items-center justify-center text-center leading-tight">Prob. \ Sev.</div>
          {severities.map(s => (
            <div key={s} className="p-3 text-center border-r last:border-r-0">S{s}</div>
          ))}
        </div>
        
        {levels.map(p => (
          <div key={p} className="grid grid-cols-6 border-b last:border-b-0">
            <div className="bg-slate-800 text-white font-bold text-xs p-3 flex items-center justify-center border-r">P{p}</div>
            {severities.map(s => {
              const cell = getMatrizCell(p, s);
              return (
                <div key={s} className={cn("p-4 flex flex-col items-center justify-center text-center gap-1 border-r last:border-r-0 min-h-[80px]", cell.bg)}>
                  <span className={cn("text-[10px] font-black uppercase leading-none", cell.text)}>{cell.label}</span>
                  <span className={cn("text-[9px] font-medium opacity-60", cell.text)}>(P{p}xS{s})</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-center gap-4 text-[10px] text-slate-500 font-medium italic">
        <span>Y: Probabilidade (5 - Quase Certa → 1 - Improvável)</span>
        <span>X: Severidade (1 - Insignificante → 5 - Catastrófica)</span>
      </div>
    </div>
  );
};
