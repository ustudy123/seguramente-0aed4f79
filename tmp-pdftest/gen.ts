import { gerarPdfPlanoAcao } from "../src/lib/planoAcaoPdf";
import { writeFileSync } from "fs";

const doc = gerarPdfPlanoAcao(
  {
    campanha: "COPSOQBR2",
    instrumento: "COPSOQ2BR",
    periodo: "28/05/2026 a 31/05/2026",
    totalRespondentes: 9,
    razaoSocial: "ARIANE APARECIDA LEONARDO DA SILVA",
    cnpj: "39.508.103/0001-00",
    ipsGlobal: 50,
    porteCategoria: "Categoria B",
    colaboradoresCnpj: 102,
    setorPorte: "Indústria e construção",
  },
  [
    {
      gheId: "1",
      gheNome: "GHE Administrativo",
      setores: ["Administrativo"],
      cargos: ["Analista"],
      acoes: [] as never[],
    },
  ],
  { critico: 0, alto: 3, medio: 7, baixo: 1, trivial: 0 },
);
writeFileSync("/tmp/pdftest/out.pdf", Buffer.from(doc.output("arraybuffer")));
console.log("ok");
