import { gerarPdfPlanoAcao } from "../src/lib/planoAcaoPdf";
import type { CabecalhoRelatorio, GrupoPlano, ContagemNiveis } from "../src/lib/planoAcaoPdf";
import fs from "fs";

const cabecalho: CabecalhoRelatorio = {
  campanha: "COPSOQ2BR",
  instrumento: "COPSOQ2BR",
  periodo: "28/05/2026 a 31/05/2026",
  totalRespondentes: 9,
  razaoSocial: "ARIANE APARECIDA LEONARDO DA SILVA 38059527835",
  cnpj: "39.508.103/0001-00",
  ipsGlobal: 50,
  colaboradoresCnpj: 102,
  setorPorte: "Indústria e construção",
};

const grupos: GrupoPlano[] = [
  {
    gheId: "ghe-1",
    gheNome: "Administrativo - Geral",
    setores: ["Administrativo"],
    cargos: ["Analista Administrativo", "Auxiliar Administrativo"],
    acoes: [
      {
        id: "a1",
        campanha_id: "c1",
        ghe_id: "ghe-1",
        fator: "Demanda excessiva",
        o_que: "Revisar distribuição de tarefas",
        quem: "Gestor RH",
        onde: "Setor Administrativo",
        por_que: "Reduzir sobrecarga",
        como: "Reunião semanal",
        quanto: "R$ 0,00",
        data_inicial: "2026-06-01",
        ate_quando: "2026-07-01",
        nivel_gro: "alto",
        created_at: "2026-06-01",
        updated_at: "2026-06-01",
      },
    ],
  },
];

const contagem: ContagemNiveis = {
  critico: 0,
  alto: 3,
  medio: 7,
  baixo: 1,
  trivial: 0,
};

const doc = gerarPdfPlanoAcao(cabecalho, grupos, contagem);
const bytes = doc.output("arraybuffer");
fs.writeFileSync("tmp-pdftest/teste.pdf", Buffer.from(bytes));
console.log("PDF gerado: tmp-pdftest/teste.pdf");
